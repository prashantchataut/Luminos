//! One shared, connection-pooling HTTP agent (ureq: tiny, blocking, rustls).
use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use std::{sync::OnceLock, time::Duration};

pub const USER_AGENT: &str = "LuminosLauncher/0.1 (+https://github.com/prashantchataut/Luminos)";

pub fn agent() -> &'static ureq::Agent {
    static AGENT: OnceLock<ureq::Agent> = OnceLock::new();
    AGENT.get_or_init(|| {
        let cfg = ureq::Agent::config_builder()
            .user_agent(USER_AGENT)
            .timeout_global(Some(Duration::from_secs(90)))
            .timeout_connect(Some(Duration::from_secs(12)))
            .build();
        ureq::Agent::new_with_config(cfg)
    })
}

pub fn get_json<T: DeserializeOwned>(url: &str) -> Result<T> {
    let mut resp = agent()
        .get(url)
        .call()
        .with_context(|| format!("GET {url}"))?;
    resp.body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn get_json_query<T: DeserializeOwned>(url: &str, query: &[(&str, String)]) -> Result<T> {
    let mut req = agent().get(url);
    for (k, v) in query {
        req = req.query(k, v);
    }
    let mut resp = req.call().with_context(|| format!("GET {url}"))?;
    resp.body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn post_json<T: DeserializeOwned>(url: &str, body: &serde_json::Value) -> Result<T> {
    let mut resp = agent()
        .post(url)
        .send_json(body)
        .with_context(|| format!("POST {url}"))?;
    resp.body_mut()
        .read_json::<T>()
        .with_context(|| format!("decoding JSON from {url}"))
}

pub fn get_bytes(url: &str) -> Result<Vec<u8>> {
    let mut resp = agent()
        .get(url)
        .call()
        .with_context(|| format!("GET {url}"))?;
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
    let mut resp = agent()
        .get(url)
        .call()
        .with_context(|| format!("GET {url}"))?;
    let mut reader = resp.body_mut().with_config().limit(u64::MAX).reader();
    let mut file = std::fs::File::create(&tmp)?;
    let n = std::io::copy(&mut reader, &mut file)?;
    drop(file);
    std::fs::rename(&tmp, dest)?;
    Ok(n)
}
