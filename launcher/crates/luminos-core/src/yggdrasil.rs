//! Yggdrasil client for Ely.by and Luminos accounts + authlib-injector management.
//!
//! * `authenticate` / `refresh` / `validate` talk to `<api_root>/authserver/*`.
//! * The game is started with `-javaagent:authlib-injector.jar=<api_root>` so the *game* and any
//!   server it joins talk to the same Yggdrasil API.
//!
//! This never touches Mojang/Microsoft authentication.
use crate::{accounts::Account, accounts::AccountKind, compat, paths};
use anyhow::{anyhow, bail, Context, Result};
use serde_json::{json, Value};
use std::{path::PathBuf, time::Duration};

pub const ELY_API_ROOT: &str = "https://authserver.ely.by/api/authlib-injector";
pub const LUMINOS_API_ROOT: &str = "https://auth.luminos.invalid/api"; // replaced by the user's own instance, see docs/LUMINOS_AUTH_SERVER.md

pub const INJECTOR_VERSION: &str = "1.2.8";
pub const INJECTOR_URL: &str =
    "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.8/authlib-injector-1.2.8.jar";
/// Pinned: verified when downloaded. authlib-injector is AGPL-3.0, shipped as a separate downloaded jar
/// (never linked into Luminos), see THIRD_PARTY_NOTICES.md.
pub const INJECTOR_SHA256: &str =
    "9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10";

fn agent() -> ureq::Agent {
    let cfg = ureq::Agent::config_builder()
        .user_agent(crate::http::USER_AGENT)
        .timeout_global(Some(Duration::from_secs(20)))
        .http_status_as_error(false)
        .build();
    ureq::Agent::new_with_config(cfg)
}

fn post(url: &str, body: &Value) -> Result<(u16, Value)> {
    // The API root is either a known host (Ely.by) or one the user typed in; both are audited.
    if crate::netaudit::lookup(&crate::netaudit::host_of(url).unwrap_or_default()).is_some() {
        crate::netaudit::check(url)?;
    } else {
        crate::netaudit::check_user_configured(url)?;
    }
    let mut r = agent()
        .post(url)
        .send_json(body)
        .with_context(|| format!("contacting {url}"))?;
    let status = r.status().as_u16();
    let v = r.body_mut().read_json::<Value>().unwrap_or(Value::Null);
    Ok((status, v))
}

fn dash(id: &str) -> String {
    if id.len() == 32 {
        format!(
            "{}-{}-{}-{}-{}",
            &id[0..8],
            &id[8..12],
            &id[12..16],
            &id[16..20],
            &id[20..32]
        )
    } else {
        id.to_string()
    }
}

fn server_error(v: &Value) -> String {
    v["errorMessage"]
        .as_str()
        .or(v["error"].as_str())
        .unwrap_or("The server refused the request")
        .to_string()
}

/// Sign in. Returns a ready-to-store account.
pub fn authenticate(
    kind: AccountKind,
    api_root: &str,
    login: &str,
    password: &str,
) -> Result<Account> {
    let root = api_root.trim_end_matches('/');
    let (status, v) = post(
        &format!("{root}/authserver/authenticate"),
        &json!({
            "username": login,
            "password": password,
            "requestUser": true,
            "agent": {"name": "Minecraft", "version": 1}
        }),
    )?;
    if status != 200 {
        bail!("{}", server_error(&v));
    }
    let p = &v["selectedProfile"];
    let (id, name) = (
        p["id"]
            .as_str()
            .ok_or_else(|| anyhow!("no profile on this account"))?,
        p["name"].as_str().unwrap_or(login),
    );
    Ok(Account {
        username: name.to_string(),
        uuid: dash(id),
        kind,
        skin_id: None,
        auth_server: Some(root.to_string()),
        access_token: v["accessToken"].as_str().map(String::from),
        client_token: v["clientToken"].as_str().map(String::from),
    })
}

/// True when the stored access token is still accepted.
pub fn validate(acc: &Account) -> bool {
    let (Some(root), Some(at)) = (&acc.auth_server, &acc.access_token) else {
        return false;
    };
    post(
        &format!("{}/authserver/validate", root.trim_end_matches('/')),
        &json!({"accessToken": at, "clientToken": acc.client_token}),
    )
    .map(|(s, _)| s == 204 || s == 200)
    .unwrap_or(false)
}

/// Make sure the token is usable, refreshing it if needed. The caller must save the account afterwards,
/// because refresh invalidates the old token.
pub fn ensure_fresh(acc: &mut Account) -> Result<()> {
    if !acc.kind.uses_injector() || validate(acc) {
        return Ok(());
    }
    let (Some(root), Some(at)) = (acc.auth_server.clone(), acc.access_token.clone()) else {
        bail!("This account has no saved session. Sign in again.");
    };
    let (status, v) = post(
        &format!("{}/authserver/refresh", root.trim_end_matches('/')),
        &json!({"accessToken": at, "clientToken": acc.client_token, "requestUser": true}),
    )?;
    if status != 200 {
        bail!("Session expired: {}. Sign in again.", server_error(&v));
    }
    acc.access_token = v["accessToken"].as_str().map(String::from);
    if let Some(c) = v["clientToken"].as_str() {
        acc.client_token = Some(c.to_string());
    }
    Ok(())
}

/// Create an account on a luminos-auth instance (Luminos extension; not part of Yggdrasil).
pub fn register_luminos(api_root: &str, login: &str, password: &str, player: &str) -> Result<()> {
    let (status, v) = post(
        &format!("{}/luminos/register", api_root.trim_end_matches('/')),
        &json!({"login": login, "password": password, "playerName": player}),
    )?;
    if status == 201 {
        Ok(())
    } else {
        bail!("{}", server_error(&v))
    }
}

pub fn injector_path() -> PathBuf {
    paths::root()
        .join("tools")
        .join(format!("authlib-injector-{INJECTOR_VERSION}.jar"))
}

/// Download authlib-injector if missing; always verify the SHA-256.
pub fn ensure_injector() -> Result<PathBuf> {
    let p = injector_path();
    if p.exists()
        && compat::sha256_file(&p)
            .map(|h| h == INJECTOR_SHA256)
            .unwrap_or(false)
    {
        return Ok(p);
    }
    std::fs::create_dir_all(p.parent().unwrap())?;
    let tmp = p.with_extension("part");
    crate::http::download_to(INJECTOR_URL, &tmp)?;
    let got = compat::sha256_file(&tmp)?;
    if got != INJECTOR_SHA256 {
        let _ = std::fs::remove_file(&tmp);
        bail!("authlib-injector checksum mismatch (got {got}); refusing to use it");
    }
    std::fs::rename(&tmp, &p)?;
    Ok(p)
}

/// The JVM argument that routes the game's auth to the account's Yggdrasil server.
pub fn javaagent_arg(acc: &Account, jar: &std::path::Path) -> Option<String> {
    if !acc.kind.uses_injector() {
        return None;
    }
    let root = acc.auth_server.as_ref()?;
    Some(format!("-javaagent:{}={}", jar.display(), root))
}
