//! Luminos Client compatibility manifest (`client-compat.json`).
//!
//! The launcher fetches this file, picks the entry for the instance's Minecraft version + loader, downloads
//! the jar, verifies its SHA-256, and — if anything doesn't match — falls back to loader-only/vanilla with a
//! human message instead of crashing on a version-range error.
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{io::Read, path::Path};

pub const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/prashantchataut/Luminos/main/client/client-compat.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Entry {
    /// Exact Minecraft versions this jar was built for and tested on.
    pub minecraft: Vec<String>,
    pub loader: String,
    pub url: String,
    pub sha256: String,
    pub client_version: String,
    /// Modrinth slugs that must be present for the client to work.
    #[serde(default)]
    pub required_mods: Vec<String>,
    /// Client features that are switched off on this version, with the reason shown in the UI.
    #[serde(default)]
    pub disabled_features: Vec<DisabledFeature>,
    /// Java major version needed (mirrors Mojang's `javaVersion.majorVersion`).
    #[serde(default)]
    pub java: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DisabledFeature {
    pub feature: String,
    pub reason: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Manifest {
    pub schema: u32,
    #[serde(default)]
    pub entries: Vec<Entry>,
}

#[derive(Debug, PartialEq)]
pub enum Resolution<'a> {
    Match(&'a Entry),
    /// No jar for this combination. `reason` is shown to the user; the instance runs without the client.
    Fallback { reason: String },
}

pub fn parse(json: &str) -> Result<Manifest> {
    let m: Manifest = serde_json::from_str(json).context("client-compat.json")?;
    if m.schema != 1 {
        bail!("unsupported client-compat schema {}", m.schema);
    }
    for e in &m.entries {
        if e.sha256.len() != 64 || !e.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
            bail!("entry for {:?} has an invalid sha256", e.minecraft);
        }
    }
    Ok(m)
}

pub fn fetch() -> Result<Manifest> {
    parse(&String::from_utf8(crate::http::get_bytes(MANIFEST_URL)?)?)
}

/// Pick the entry for `(mc_version, loader)`.
pub fn resolve<'a>(m: &'a Manifest, mc_version: &str, loader: &str) -> Resolution<'a> {
    if let Some(e) = m
        .entries
        .iter()
        .find(|e| e.loader.eq_ignore_ascii_case(loader) && e.minecraft.iter().any(|v| v == mc_version))
    {
        return Resolution::Match(e);
    }
    let known: Vec<&str> = m
        .entries
        .iter()
        .filter(|e| e.loader.eq_ignore_ascii_case(loader))
        .flat_map(|e| e.minecraft.iter().map(|s| s.as_str()))
        .collect();
    let reason = if !loader.eq_ignore_ascii_case("fabric") {
        format!("Luminos Client is built for Fabric; this instance uses {loader}. Running without it.")
    } else if known.is_empty() {
        "No Luminos Client build is published yet. Running with the performance mods only.".into()
    } else {
        format!(
            "Luminos Client doesn't support Minecraft {mc_version} yet (supported: {}). Running with the performance mods only.",
            known.join(", ")
        )
    };
    Resolution::Fallback { reason }
}

pub fn sha256_bytes(data: &[u8]) -> String {
    crate::store::hex(&Sha256::digest(data))
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut f = std::fs::File::open(path)?;
    let mut h = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(crate::store::hex(&h.finalize()))
}

/// Download an entry's jar into `dest_dir`, verify the hash, and return the path. Never leaves a bad jar behind.
pub fn install(e: &Entry, dest_dir: &Path) -> Result<std::path::PathBuf> {
    std::fs::create_dir_all(dest_dir)?;
    let name = e.url.rsplit('/').next().unwrap_or("luminos-client.jar");
    let dest = dest_dir.join(name);
    let tmp = dest.with_extension("part");
    crate::http::download_to(&e.url, &tmp)?;
    let got = sha256_file(&tmp)?;
    if !got.eq_ignore_ascii_case(&e.sha256) {
        let _ = std::fs::remove_file(&tmp);
        bail!("checksum mismatch for {name}: expected {}, got {got}. Not installing it.", e.sha256);
    }
    std::fs::rename(&tmp, &dest)?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{"schema":1,"entries":[
      {"minecraft":["1.21.4"],"loader":"fabric","url":"https://x/luminos-client-1.21.4.jar",
       "sha256":"0000000000000000000000000000000000000000000000000000000000000000","client_version":"0.3.0","java":21,
       "required_mods":["fabric-api"]},
      {"minecraft":["26.1","26.1.1","26.1.2"],"loader":"fabric","url":"https://x/luminos-client-26.1.jar",
       "sha256":"1111111111111111111111111111111111111111111111111111111111111111","client_version":"0.3.0","java":25,
       "disabled_features":[{"feature":"zoom","reason":"test"}]}]}"#;

    #[test]
    fn resolves_exact_version_and_loader() {
        let m = parse(SAMPLE).unwrap();
        match resolve(&m, "26.1.2", "fabric") {
            Resolution::Match(e) => assert_eq!(e.java, 25),
            r => panic!("{r:?}"),
        }
        assert!(matches!(resolve(&m, "1.21.4", "Fabric"), Resolution::Match(_)));
    }

    #[test]
    fn unsupported_version_falls_back_with_a_human_message() {
        let m = parse(SAMPLE).unwrap();
        match resolve(&m, "26.3", "fabric") {
            Resolution::Fallback { reason } => {
                assert!(reason.contains("26.3") && reason.contains("1.21.4") && reason.contains("performance mods"));
            }
            r => panic!("{r:?}"),
        }
        match resolve(&m, "1.21.4", "quilt") {
            Resolution::Fallback { reason } => assert!(reason.contains("Fabric")),
            r => panic!("{r:?}"),
        }
    }

    #[test]
    fn bad_manifests_are_rejected() {
        assert!(parse(r#"{"schema":2,"entries":[]}"#).is_err());
        assert!(parse(r#"{"schema":1,"entries":[{"minecraft":["1"],"loader":"fabric","url":"u","sha256":"abc","client_version":"1"}]}"#).is_err());
    }

    #[test]
    fn sha256_known_vector() {
        assert_eq!(
            sha256_bytes(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
