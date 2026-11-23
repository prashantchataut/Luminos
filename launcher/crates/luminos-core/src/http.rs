//! One shared, connection-pooling HTTP agent (ureq: tiny, blocking, rustls).
//!
//! Every request goes through [`crate::netaudit::check`] first, **including each redirect hop**:
//! the agent does not follow redirects by itself, [`send_get`] does, re-checking every target.
use crate::netaudit;
use anyhow::{bail, Context, Result};
use serde::de::DeserializeOwned;
use std::{sync::OnceLock, time::Duration};

pub const USER_AGENT: &str = "LuminosLauncher/0.1 (+https://github.com/prashantchataut/Luminos)";
const MAX_HOPS: usize = 6;

/// Shared agent. Redirects are disabled on purpose (see module docs); callers that need to follow
/// them use [`send_get`]. Callers using the agent directly MUST call `netaudit::check` first.
pub fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        let cfg = ureq::Agent::config_builder()
            .user_agent(USER_AGENT)
            .timeout_global(Some(Duration::from_secs(90)))
            .timeout_connect(Some(Duration::from_secs(12)))
            .max_redirects(0)
            .max_redirects_will_error(false)
            .build();
        ureq::Agent::new_with_config(cfg)
    })
}

/// Resolve a `Location` header against the URL that produced it.
fn resolve_location(base: &str, loc: &str) -> Result<String> {
    if loc.starts_with("https://") || loc.starts_with("http://") {
        return Ok(loc.to_string());
    }
    let host = netaudit::host_of(base).context("redirect from a URL without a host")?;
    let scheme = if base.starts_with("https://") {
        "https"
    } else {
        "http"
    };
    if let Some(path) = loc.strip_prefix('/') {
        return Ok(format!("{scheme}://{host}/{path}"));
    }
    bail!("unsupported redirect target `{loc}`")
}

/// GET with audited redirects. `query` is applied to the first hop only.
pub fn send_get(url: &str, query: &[(&str, String)]) -> Result<ureq::http::Response<ureq::Body>> {
    let mut cur = url.to_string();
    for hop in 0..MAX_HOPS {
        netaudit::check(&cur)?;
        let mut req = agent().get(&cur);
        if hop == 0 {
            for (k, v) in query {
                req = req.query(k, v);
            }
        }
        let resp = req.call().with_context(|| format!("GET {cur}"))?;
        if resp.status().is_redirection() {
            if let Some(loc) = resp.headers().get("location").and_then(|v| v.to_str().ok()) {
                cur = resolve_location(&cur, loc)?;
                continue;
            }
        }
        return Ok(resp);
    }
    bail!("too many redirects starting at {url}")
}

pub fn get_json<T: DeserializeOwned>(url: &str) -> Result<T> {
    send_get(url, &[])?
        .body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn get_json_query<T: DeserializeOwned>(url: &str, query: &[(&str, String)]) -> Result<T> {
    send_get(url, query)?
        .body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn post_json<T: DeserializeOwned>(url: &str, body: &serde_json::Value) -> Result<T> {
    netaudit::check(url)?;
    let mut resp = agent()
        .post(url)
        .send_json(body)
        .with_context(|| format!("POST {url}"))?;
    if resp.status().is_redirection() {
        bail!("POST {url} was redirected; Luminos does not follow redirects on POST");
    }
    resp.body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn get_bytes(url: &str) -> Result<Vec<u8>> {
    let mut resp = send_get(url, &[])?;
    Ok(resp
        .body_mut()
        .with_config()
        .limit(1024 * 1024 * 1024)
        .read_to_vec()?)
}

/// Stream a URL straight to disk, returning bytes written.
pub fn download_to(url: &str, dest: &std::path::Path) -> Result<u64> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = dest.with_extension("part");
    let mut resp = send_get(url, &[])?;
    let mut reader = resp.body_mut().with_config().limit(u64::MAX).reader();
    let mut file = std::fs::File::create(&tmp)?;
    let n = std::io::copy(&mut reader, &mut file)?;
    drop(file);
    std::fs::rename(&tmp, dest)?;
    Ok(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn location_resolution() {
        assert_eq!(
            resolve_location("https://github.com/a/b", "/x/y?z=1").unwrap(),
            "https://github.com/x/y?z=1"
        );
        assert_eq!(
            resolve_location("https://a.example/p", "https://b.example/q").unwrap(),
            "https://b.example/q"
        );
        assert!(resolve_location("https://a.example/p", "relative/path").is_err());
    }

    #[test]
    fn unlisted_host_never_reaches_the_network() {
        // Fails in `check`, before any socket is opened.
        let e = get_bytes("https://tracker.example.net/ping").unwrap_err();
        assert!(format!("{e:#}").contains("not on Luminos' network list"));
        let e =
            post_json::<serde_json::Value>("https://tracker.example.net/p", &serde_json::json!({}))
                .unwrap_err();
        assert!(format!("{e:#}").contains("not on Luminos' network list"));
    }
}
