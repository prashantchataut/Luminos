//! Mojang-only skin lookup and upload. No skin website is contacted.
//!
//! Lookup: `api.mojang.com` (name to UUID), then `sessionserver.mojang.com` (UUID to textures),
//! then the skin PNG from `textures.minecraft.net`. Upload: `api.minecraftservices.com`, with the
//! player's own Minecraft access token. A browser cannot make these calls (no CORS headers), so
//! the Tauri app does it here and hands the PNG to the UI.
use crate::{http, netaudit};
use anyhow::{anyhow, bail, Context, Result};
use serde_json::Value;

pub struct Found {
    pub name: String,
    pub uuid: String,
    pub slim: bool,
    pub png: Vec<u8>,
}

pub enum Outcome {
    /// Mojang has no account with that name.
    NoSuchPlayer,
    /// The account exists but never set a skin (it wears the default Steve or Alex).
    NoSkin {
        name: String,
        uuid: String,
    },
    Found(Found),
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.bytes().filter(|c| *c != b'=' && !c.is_ascii_whitespace()) {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            _ => bail!("not base64"),
        };
        acc = (acc << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

/// Pull `(skin url, is_slim)` out of a session-server profile. `None` means the profile has no skin.
pub fn parse_textures(profile: &Value) -> Result<Option<(String, bool)>> {
    let props = profile["properties"]
        .as_array()
        .context("profile has no properties")?;
    let Some(p) = props.iter().find(|p| p["name"] == "textures") else {
        return Ok(None);
    };
    let raw = b64_decode(p["value"].as_str().context("textures value")?)?;
    let v: Value = serde_json::from_slice(&raw).context("textures JSON")?;
    let Some(skin) = v.pointer("/textures/SKIN") else {
        return Ok(None);
    };
    let url = skin["url"].as_str().context("skin url")?.to_string();
    if !url.starts_with("https://textures.minecraft.net/")
        && !url.starts_with("http://textures.minecraft.net/")
    {
        bail!("skin URL is not on textures.minecraft.net");
    }
    let slim = skin.pointer("/metadata/model").and_then(|m| m.as_str()) == Some("slim");
    Ok(Some((url.replace("http://", "https://"), slim)))
}

fn get_status(url: &str) -> Result<(u16, Value)> {
    netaudit::check(url)?;
    let mut resp = http::agent()
        .get(url)
        .config()
        .http_status_as_error(false)
        .build()
        .call()
        .with_context(|| format!("GET {url}"))?;
    let st = resp.status().as_u16();
    let v = if st == 200 {
        resp.body_mut().read_json().unwrap_or(Value::Null)
    } else {
        Value::Null
    };
    Ok((st, v))
}

pub fn lookup(name: &str) -> Result<Outcome> {
    if !crate::accounts::valid_username(name) {
        bail!("A Minecraft name is 3 to 16 letters, numbers or underscores.");
    }
    let (st, v) = get_status(&format!(
        "https://api.mojang.com/users/profiles/minecraft/{name}"
    ))?;
    match st {
        200 => {}
        204 | 404 => return Ok(Outcome::NoSuchPlayer),
        429 => bail!("Mojang is limiting requests. Wait a minute and try again."),
        s => bail!("Mojang answered {s}."),
    }
    let uuid = v["id"].as_str().context("profile id")?.to_string();
    let canonical = v["name"].as_str().unwrap_or(name).to_string();
    let (st, prof) = get_status(&format!(
        "https://sessionserver.mojang.com/session/minecraft/profile/{uuid}"
    ))?;
    match st {
        200 => {}
        204 | 404 => {
            return Ok(Outcome::NoSkin {
                name: canonical,
                uuid,
            })
        }
        429 => bail!("Mojang is limiting requests. Wait a minute and try again."),
        s => bail!("Mojang answered {s}."),
    }
    let Some((url, slim)) = parse_textures(&prof)? else {
        return Ok(Outcome::NoSkin {
            name: canonical,
            uuid,
        });
    };
    netaudit::check(&url)?;
    let png = http::get_bytes(&url)?;
    if png.len() < 8 || &png[1..4] != b"PNG" {
        bail!("Mojang returned something that is not a PNG.");
    }
    Ok(Outcome::Found(Found {
        name: canonical,
        uuid,
        slim,
        png,
    }))
}

/// Body of `POST /minecraft/profile/skins`: two multipart fields, `variant` and `file`.
pub fn multipart_body(boundary: &str, slim: bool, png: &[u8]) -> Vec<u8> {
    let mut b = Vec::new();
    let variant = if slim { "slim" } else { "classic" };
    b.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"variant\"\r\n\r\n{variant}\r\n"
        )
        .as_bytes(),
    );
    b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"skin.png\"\r\nContent-Type: image/png\r\n\r\n").as_bytes());
    b.extend_from_slice(png);
    b.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    b
}

/// Change the skin on the signed-in Microsoft account. The server then serves it to everyone.
pub fn upload(minecraft_token: &str, png: &[u8], slim: bool) -> Result<()> {
    if png.len() < 8 || &png[1..4] != b"PNG" {
        bail!("That is not a PNG.");
    }
    let url = "https://api.minecraftservices.com/minecraft/profile/skins";
    netaudit::check(url)?;
    let boundary = "----luminos-skin-boundary";
    let body = multipart_body(boundary, slim, png);
    let resp = http::agent()
        .post(url)
        .header("Authorization", &format!("Bearer {minecraft_token}"))
        .header(
            "Content-Type",
            &format!("multipart/form-data; boundary={boundary}"),
        )
        .config()
        .http_status_as_error(false)
        .build()
        .send(&body[..])
        .context("POST skins")?;
    match resp.status().as_u16() {
        200 => Ok(()),
        401 => Err(anyhow!(
            "Your Microsoft session has expired. Sign in again."
        )),
        429 => Err(anyhow!(
            "Mojang is limiting skin changes. Wait a minute and try again."
        )),
        s => Err(anyhow!("Mojang rejected the skin ({s}).")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn base64_round_trip() {
        assert_eq!(b64_decode("TWFuIGlz").unwrap(), b"Man is");
        assert_eq!(b64_decode("TWE=").unwrap(), b"Ma");
    }

    fn profile(model: Option<&str>, with_skin: bool) -> Value {
        let mut skin = json!({ "url": "http://textures.minecraft.net/texture/abc" });
        if let Some(m) = model {
            skin["metadata"] = json!({ "model": m });
        }
        let t = if with_skin {
            json!({ "textures": { "SKIN": skin } })
        } else {
            json!({ "textures": {} })
        };
        let raw = t.to_string();
        let mut enc = String::new();
        const A: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for c in raw.as_bytes().chunks(3) {
            let n = (c[0] as u32) << 16
                | (*c.get(1).unwrap_or(&0) as u32) << 8
                | *c.get(2).unwrap_or(&0) as u32;
            for i in 0..4 {
                if i <= c.len() {
                    enc.push(A[(n >> (18 - 6 * i) & 63) as usize] as char)
                } else {
                    enc.push('=')
                }
            }
        }
        json!({ "id": "x", "name": "Test", "properties": [{ "name": "textures", "value": enc }] })
    }

    #[test]
    fn reads_classic_slim_and_missing_skin() {
        assert_eq!(
            parse_textures(&profile(None, true)).unwrap(),
            Some(("https://textures.minecraft.net/texture/abc".into(), false))
        );
        assert_eq!(
            parse_textures(&profile(Some("slim"), true))
                .unwrap()
                .unwrap()
                .1,
            true
        );
        assert_eq!(parse_textures(&profile(None, false)).unwrap(), None);
    }

    #[test]
    fn refuses_a_skin_url_off_mojang() {
        let mut p = profile(None, true);
        let t =
            json!({ "textures": { "SKIN": { "url": "https://evil.example/x.png" } } }).to_string();
        let mut enc = String::new();
        for b in t.bytes() {
            enc.push_str(&format!("{b:02x}"));
        }
        p["properties"][0]["value"] = json!(enc); // not base64 at all: must also be refused
        assert!(parse_textures(&p).is_err());
    }

    #[test]
    fn multipart_has_variant_and_file() {
        let b = multipart_body("B", true, &[0x89, b'P', b'N', b'G']);
        let s = String::from_utf8_lossy(&b);
        assert!(s.contains("name=\"variant\"\r\n\r\nslim"));
        assert!(s.contains("name=\"file\"; filename=\"skin.png\""));
        assert!(s.ends_with("--B--\r\n"));
    }

    #[test]
    #[ignore = "live: calls Mojang"]
    fn live_lookup_known_and_unknown() {
        assert!(matches!(
            lookup("Notch").unwrap(),
            Outcome::Found(_) | Outcome::NoSkin { .. }
        ));
        assert!(matches!(
            lookup("zzzzzzzzzzzzzzzz").unwrap(),
            Outcome::NoSuchPlayer
        ));
    }
}
