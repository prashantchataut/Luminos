//! Mojang skin lookup by name and skin upload for Microsoft accounts. Official endpoints only; no skin sites are scraped.
use crate::http;
use anyhow::{bail, Context, Result};
use serde_json::Value;

const PROFILE: &str = "https://api.mojang.com/users/profiles/minecraft/";
const SESSION: &str = "https://sessionserver.mojang.com/session/minecraft/profile/";
const UPLOAD: &str = "https://api.minecraftservices.com/minecraft/profile/skins";

pub enum Found {
    NoUser,
    NoSkin(String),
    Skin { name: String, id: String, png: Vec<u8>, slim: bool },
}

pub fn b64_decode(s: &str) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut acc, mut bits) = (0u32, 0u32);
    for c in s.bytes().filter(|c| *c != b'=' && !c.is_ascii_whitespace()) {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => bail!("not base64"),
        } as u32;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

/// Pull the skin URL and model out of a session-server profile.
pub fn parse_textures(profile: &Value) -> Result<Option<(String, bool)>> {
    let prop = profile["properties"]
        .as_array()
        .and_then(|a| a.iter().find(|p| p["name"] == "textures"))
        .context("profile has no textures property")?;
    let raw = b64_decode(prop["value"].as_str().context("textures value")?)?;
    let tex: Value = serde_json::from_slice(&raw).context("textures json")?;
    let skin = &tex["textures"]["SKIN"];
    Ok(skin["url"].as_str().map(|u| (u.to_string(), skin["metadata"]["model"] == "slim")))
}

pub fn lookup(name: &str) -> Result<Found> {
    let p: Value = match http::get_json(&format!("{PROFILE}{name}")) {
        Ok(v) => v,
        Err(e) if format!("{e:#}").contains("404") => return Ok(Found::NoUser),
        Err(e) => return Err(e),
    };
    let (id, exact) = (p["id"].as_str().context("id")?.to_string(), p["name"].as_str().unwrap_or(name).to_string());
    let prof: Value = http::get_json(&format!("{SESSION}{id}"))?;
    match parse_textures(&prof)? {
        None => Ok(Found::NoSkin(exact)),
        Some((url, slim)) => Ok(Found::Skin { name: exact, id, png: http::get_bytes(&url)?, slim }),
    }
}

pub fn multipart(png: &[u8], slim: bool, boundary: &str) -> Vec<u8> {
    let mut b = Vec::new();
    let variant = if slim { "slim" } else { "classic" };
    b.extend(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"variant\"\r\n\r\n{variant}\r\n").bytes());
    b.extend(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"skin.png\"\r\nContent-Type: image/png\r\n\r\n").bytes());
    b.extend(png);
    b.extend(format!("\r\n--{boundary}--\r\n").bytes());
    b
}

/// Apply a skin to the signed-in Mojang account. Online-mode servers then show it to everyone.
pub fn set_skin(token: &str, png: &[u8], slim: bool) -> Result<()> {
    crate::netaudit::check(UPLOAD)?;
    let boundary = "luminosskin7f3a9c";
    let body = multipart(png, slim, boundary);
    let resp = http::agent()
        .post(UPLOAD)
        .header("Authorization", &format!("Bearer {token}"))
        .header("Content-Type", &format!("multipart/form-data; boundary={boundary}"))
        .config()
        .http_status_as_error(false)
        .build()
        .send(&body[..])?;
    match resp.status().as_u16() {
        200 | 204 => Ok(()),
        401 | 403 => bail!("Mojang rejected the sign-in. Sign in with Microsoft again."),
        s => bail!("Mojang refused the skin (HTTP {s})."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn decodes_base64() {
        assert_eq!(b64_decode("TWFu").unwrap(), b"Man");
        assert_eq!(b64_decode("TWE=").unwrap(), b"Ma");
    }

    #[test]
    fn reads_skin_url_and_model_from_a_mocked_profile() {
        // {"textures":{"SKIN":{"url":"https://textures.minecraft.net/texture/abc","metadata":{"model":"slim"}}}}
        let v = "eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHBzOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlL2FiYyIsIm1ldGFkYXRhIjp7Im1vZGVsIjoic2xpbSJ9fX19";
        let p = json!({"properties":[{"name":"textures","value":v}]});
        assert_eq!(parse_textures(&p).unwrap(), Some(("https://textures.minecraft.net/texture/abc".to_string(), true)));
    }

    #[test]
    fn profile_without_a_skin_is_none() {
        let v = "eyJ0ZXh0dXJlcyI6e319"; // {"textures":{}}
        let p = json!({"properties":[{"name":"textures","value":v}]});
        assert_eq!(parse_textures(&p).unwrap(), None);
    }

    #[test]
    fn multipart_has_variant_file_and_closing_boundary() {
        let b = String::from_utf8_lossy(&multipart(b"PNGDATA", true, "XX")).to_string();
        assert!(b.contains("name=\"variant\"\r\n\r\nslim"));
        assert!(b.contains("filename=\"skin.png\"") && b.contains("PNGDATA") && b.ends_with("--XX--\r\n"));
    }
}
