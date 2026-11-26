//! Microsoft / Xbox sign-in using the OAuth **device-code** flow (works without a browser embedded in the app).
//!
//! Chain: Microsoft token → Xbox Live → XSTS → Minecraft services → profile.
//!
//! You must register a (free) Azure app of type “public client / mobile & desktop” with device-code flow enabled and
//! Minecraft services permission, then provide its id via the `LUMINOS_MS_CLIENT_ID` env var or `settings.ms_client_id`.
//! Luminos intentionally does not ship someone else's client id.
//!
//! Status: UNVERIFIED end to end. The pure parts are unit-tested and tokens are saved through `secrets`; the network chain needs an Azure client id (docs/MICROSOFT_AUTH.md) and has not been run with a real account.
use crate::http;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const DEVICE: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const SCOPE: &str = "XboxLive.signin offline_access";

pub fn client_id() -> Option<String> {
    // Runtime override first, then the id CI embedded at build time (secret LUMINOS_MS_CLIENT_ID).
    std::env::var("LUMINOS_MS_CLIENT_ID")
        .ok()
        .or_else(|| option_env!("LUMINOS_MS_CLIENT_ID").map(str::to_string))
        .filter(|s| !s.trim().is_empty())
}

#[derive(Deserialize, Clone, Debug)]
pub struct DeviceCode {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    #[serde(default = "five")]
    pub interval: u64,
}
fn five() -> u64 {
    5
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Session {
    pub username: String,
    pub uuid: String,
    pub minecraft_token: String,
    pub expires_at: i64,
    /// Kept so the session can be silently refreshed. Stored only in the OS secure store (`remember`), never in a file.
    pub refresh_token: String,
}

fn form(url: &str, fields: &[(&str, &str)]) -> Result<(u16, Value)> {
    crate::netaudit::check(url)?;
    let mut resp = http::agent()
        .post(url)
        .config()
        .http_status_as_error(false)
        .build()
        .send_form(fields.iter().copied())
        .with_context(|| format!("POST {url}"))?;
    let status = resp.status().as_u16();
    let v: Value = resp.body_mut().read_json().unwrap_or(Value::Null);
    Ok((status, v))
}

fn json_post(url: &str, body: &Value) -> Result<Value> {
    crate::netaudit::check(url)?;
    let mut resp = http::agent()
        .post(url)
        .header("Accept", "application/json")
        .config()
        .http_status_as_error(false)
        .build()
        .send_json(body)
        .with_context(|| format!("POST {url}"))?;
    let status = resp.status();
    let v: Value = resp.body_mut().read_json().unwrap_or(Value::Null);
    if !status.is_success() {
        let xerr = v.get("XErr").and_then(|x| x.as_u64());
        bail!(
            "{}",
            explain_xerr(xerr).unwrap_or_else(|| format!("{url} returned HTTP {status}"))
        );
    }
    Ok(v)
}

/// Friendly text for the common XSTS error codes.
pub fn explain_xerr(code: Option<u64>) -> Option<String> {
    Some(
        match code? {
            2148916233 => "This Microsoft account has no Xbox profile yet — sign in once at xbox.com to create one.",
            2148916235 => "Xbox Live is not available in your country/region.",
            2148916236 | 2148916237 => "This account needs adult verification on the Xbox site.",
            2148916238 => "This is a child account — add it to a Microsoft Family to continue.",
            _ => return None,
        }
        .to_string(),
    )
}

/// Step 1: ask Microsoft for a user code to show the player.
pub fn begin(client_id: &str) -> Result<DeviceCode> {
    let (st, v) = form(DEVICE, &[("client_id", client_id), ("scope", SCOPE)])?;
    if st != 200 {
        bail!(
            "Device-code request failed: {}",
            v.get("error_description")
                .and_then(|x| x.as_str())
                .unwrap_or("unknown error")
        );
    }
    serde_json::from_value(v).context("device code response")
}

/// Step 2: poll until the player approves in the browser (blocking; call from a worker thread).
/// `cancelled` lets the UI abort. Returns the Microsoft (access, refresh) token pair.
pub fn wait_for_approval(
    client_id: &str,
    dc: &DeviceCode,
    cancelled: &dyn Fn() -> bool,
) -> Result<(String, String)> {
    let deadline = Instant::now() + Duration::from_secs(dc.expires_in);
    let mut interval = dc.interval.max(1);
    while Instant::now() < deadline {
        if cancelled() {
            bail!("Sign-in cancelled");
        }
        std::thread::sleep(Duration::from_secs(interval));
        let (_, v) = form(
            TOKEN,
            &[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id),
                ("device_code", &dc.device_code),
            ],
        )?;
        match v.get("error").and_then(|e| e.as_str()) {
            None => {
                let at = v["access_token"]
                    .as_str()
                    .context("access_token missing")?
                    .to_string();
                let rt = v["refresh_token"].as_str().unwrap_or_default().to_string();
                return Ok((at, rt));
            }
            Some("authorization_pending") => {}
            Some("slow_down") => interval += 5,
            Some("authorization_declined") => bail!("Sign-in was declined"),
            Some("expired_token") => bail!("The code expired — start again"),
            Some(other) => bail!("Sign-in failed: {other}"),
        }
    }
    bail!("The code expired — start again")
}

/// Silent refresh using a stored refresh token.
pub fn refresh_microsoft(client_id: &str, refresh_token: &str) -> Result<(String, String)> {
    let (st, v) = form(
        TOKEN,
        &[
            ("grant_type", "refresh_token"),
            ("client_id", client_id),
            ("refresh_token", refresh_token),
            ("scope", SCOPE),
        ],
    )?;
    if st != 200 {
        bail!("Session expired — please sign in again");
    }
    Ok((
        v["access_token"]
            .as_str()
            .context("access_token")?
            .to_string(),
        v["refresh_token"]
            .as_str()
            .unwrap_or(refresh_token)
            .to_string(),
    ))
}

/// `XBL3.0 x=<uhs>;<xsts>` — the identity token Minecraft services expects.
pub fn identity_token(uhs: &str, xsts: &str) -> String {
    format!("XBL3.0 x={uhs};{xsts}")
}

/// Keep the refresh token in the OS secure store so the next launch can sign in silently. Never written to a file.
pub fn remember(session: &Session) -> Result<()> {
    crate::secrets::put(
        &crate::secrets::refresh_key(&session.uuid),
        &session.refresh_token,
    )
}

/// Silent sign-in from the stored refresh token. Fails plainly if there is none (the player signs in again).
pub fn resume(client_id: &str, uuid: &str) -> Result<Session> {
    let rt = crate::secrets::get(&crate::secrets::refresh_key(uuid))
        .context("No saved Microsoft session. Sign in again.")?;
    let (access, refresh) = refresh_microsoft(client_id, &rt)?;
    let s = minecraft_login(&access, &refresh)?;
    remember(&s)?;
    Ok(s)
}

/// Step 3: exchange the Microsoft access token for a Minecraft session.
pub fn minecraft_login(ms_access: &str, ms_refresh: &str) -> Result<Session> {
    let xbl = json_post(
        "https://user.auth.xboxlive.com/user/authenticate",
        &json!({"Properties":{"AuthMethod":"RPS","SiteName":"user.auth.xboxlive.com","RpsTicket":format!("d={ms_access}")},"RelyingParty":"http://auth.xboxlive.com","TokenType":"JWT"}),
    )?;
    let xbl_token = xbl["Token"].as_str().context("XBL token")?;
    let xsts = json_post(
        "https://xsts.auth.xboxlive.com/xsts/authorize",
        &json!({"Properties":{"SandboxId":"RETAIL","UserTokens":[xbl_token]},"RelyingParty":"rp://api.minecraftservices.com/","TokenType":"JWT"}),
    )?;
    let xsts_token = xsts["Token"].as_str().context("XSTS token")?;
    let uhs = xsts
        .pointer("/DisplayClaims/xui/0/uhs")
        .and_then(|x| x.as_str())
        .context("XSTS user hash")?;
    let mc = json_post(
        "https://api.minecraftservices.com/authentication/login_with_xbox",
        &json!({"identityToken": identity_token(uhs, xsts_token)}),
    )?;
    let token = mc["access_token"]
        .as_str()
        .context("Minecraft token")?
        .to_string();
    let expires = mc["expires_in"].as_i64().unwrap_or(86_400);

    crate::netaudit::check("https://api.minecraftservices.com/minecraft/profile")?;
    let mut resp = http::agent()
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", &format!("Bearer {token}"))
        .config()
        .http_status_as_error(false)
        .build()
        .call()?;
    if resp.status().as_u16() == 404 {
        bail!("This Microsoft account does not own Minecraft: Java Edition. You can still play with an offline account.");
    }
    let p: Value = resp.body_mut().read_json().context("profile")?;
    Ok(Session {
        username: p["name"].as_str().context("profile name")?.to_string(),
        uuid: p["id"].as_str().context("profile id")?.to_string(),
        minecraft_token: token,
        expires_at: crate::store::now_unix() + expires,
        refresh_token: ms_refresh.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_token_format() {
        assert_eq!(identity_token("123", "abc"), "XBL3.0 x=123;abc");
    }

    #[test]
    fn xerr_messages() {
        assert!(explain_xerr(Some(2148916233))
            .unwrap()
            .contains("Xbox profile"));
        assert!(explain_xerr(Some(1)).is_none());
        assert!(explain_xerr(None).is_none());
    }

    #[test]
    fn device_code_defaults_interval() {
        let d: DeviceCode = serde_json::from_str(r#"{"user_code":"ABCD","device_code":"x","verification_uri":"https://microsoft.com/link","expires_in":900}"#).unwrap();
        assert_eq!(d.interval, 5);
    }
}
