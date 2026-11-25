//! Launcher self-update: find the newest `vX.Y.Z` GitHub release, download `Luminos-Setup.exe`,
//! verify it against the release's `SHA256SUMS.txt`, then run the installer silently.
//!
//! The repository also publishes `android-v*` and `client-v*` releases, so we never use
//! `/releases/latest` (it could return an APK release); we list releases and pick the highest `vX.Y.Z`
//! that has a Windows installer attached.
use crate::{compat, http, paths};
use anyhow::{anyhow, bail, Context, Result};
use serde_json::Value;
use std::path::PathBuf;

pub const RELEASES_API: &str =
    "https://api.github.com/repos/prashantchataut/Luminos/releases?per_page=40";
pub const SETUP_ASSET: &str = "Luminos-Setup.exe";
pub const SUMS_ASSET: &str = "SHA256SUMS.txt";

#[derive(Clone, Debug, PartialEq)]
pub struct Release {
    pub version: String,
    pub tag: String,
    pub notes: String,
    pub page: String,
    pub setup_url: String,
    pub setup_size: u64,
    pub sums_url: Option<String>,
}

/// `v1.2.3`, `1.2.3` or `1.2.3-beta` -> (1, 2, 3). Anything else -> None.
pub fn parse_version(s: &str) -> Option<(u64, u64, u64)> {
    let s = s.trim().trim_start_matches('v');
    let core = s.split(['-', '+']).next()?;
    let mut it = core.split('.');
    let v = (
        it.next()?.parse().ok()?,
        it.next()?.parse().ok()?,
        it.next()?.parse().ok()?,
    );
    if it.next().is_some() {
        return None;
    }
    Some(v)
}

pub fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(a), Some(b)) => a > b,
        _ => false,
    }
}

/// Pick the newest Windows launcher release from the GitHub `releases` array.
pub fn pick_release(releases: &Value) -> Option<Release> {
    // Release candidates are skipped unless explicitly asked for, so nobody is moved onto an rc by accident.
    pick_release_opts(releases, std::env::var("LUMINOS_UPDATE_PRERELEASE").is_ok_and(|v| v == "1"))
}

/// Same as [`pick_release`] with the prerelease choice made by the caller.
pub fn pick_release_opts(releases: &Value, include_pre: bool) -> Option<Release> {
    let mut best: Option<((u64, u64, u64), Release)> = None;
    for r in releases.as_array()? {
        if r["draft"].as_bool() == Some(true) || (r["prerelease"].as_bool() == Some(true) && !include_pre) {
            continue;
        }
        let tag = r["tag_name"].as_str()?;
        // Only plain `vX.Y.Z` tags are launcher releases (not android-v*, client-v*).
        if !tag.starts_with('v') {
            continue;
        }
        let Some(ver) = parse_version(tag) else {
            continue;
        };
        let assets = r["assets"].as_array()?;
        let find = |name: &str| assets.iter().find(|a| a["name"].as_str() == Some(name));
        let Some(setup) = find(SETUP_ASSET) else {
            continue;
        };
        let rel = Release {
            version: tag.trim_start_matches('v').to_string(),
            tag: tag.to_string(),
            notes: r["body"].as_str().unwrap_or("").to_string(),
            page: r["html_url"]
                .as_str()
                .unwrap_or("https://github.com/prashantchataut/Luminos/releases")
                .to_string(),
            setup_url: setup["browser_download_url"].as_str()?.to_string(),
            setup_size: setup["size"].as_u64().unwrap_or(0),
            sums_url: find(SUMS_ASSET)
                .and_then(|a| a["browser_download_url"].as_str().map(String::from)),
        };
        if best.as_ref().is_none_or(|(v, _)| ver > *v) {
            best = Some((ver, rel));
        }
    }
    best.map(|(_, r)| r)
}

/// Ask GitHub; `Some` only when a newer launcher release than `current` exists.
pub fn check(current: &str) -> Result<Option<Release>> {
    let v: Value = http::get_json(RELEASES_API)?;
    Ok(pick_release(&v).filter(|r| is_newer(&r.version, current)))
}

/// Extract the hash for `file` from a `sha256sum`-style text (`<hex>  <name>`).
pub fn hash_from_sums(text: &str, file: &str) -> Option<String> {
    text.lines().find_map(|l| {
        let mut it = l.split_whitespace();
        let (h, n) = (it.next()?, it.next()?.trim_start_matches('*'));
        (n == file && h.len() == 64).then(|| h.to_ascii_lowercase())
    })
}

/// Download the installer to the cache and verify its SHA-256. A mismatch deletes the file and fails.
pub fn download_verified(rel: &Release) -> Result<PathBuf> {
    let sums_url = rel.sums_url.as_ref().ok_or_else(|| {
        anyhow!("this release has no SHA256SUMS.txt; refusing to install an unverified file")
    })?;
    let sums = String::from_utf8_lossy(&http::get_bytes(sums_url)?).to_string();
    let want =
        hash_from_sums(&sums, SETUP_ASSET).context("SHA256SUMS.txt does not list the installer")?;
    let dir = paths::cache_dir().join("update");
    std::fs::create_dir_all(&dir)?;
    let dest = dir.join(format!("Luminos-Setup-{}.exe", rel.version));
    http::download_to(&rel.setup_url, &dest)?;
    let got = compat::sha256_file(&dest)?;
    if got != want {
        let _ = std::fs::remove_file(&dest);
        bail!("installer checksum mismatch (expected {want}, got {got}); deleted it");
    }
    Ok(dest)
}

/// Run the verified installer silently. Windows only; the caller should exit the launcher afterwards.
pub fn run_installer(path: &std::path::Path) -> Result<()> {
    if !cfg!(windows) {
        bail!("silent install is Windows-only; open the release page instead");
    }
    std::process::Command::new(path)
        .args([
            "/SILENT",
            "/SUPPRESSMSGBOXES",
            "/CLOSEAPPLICATIONS",
            "/RESTARTAPPLICATIONS",
        ])
        .spawn()
        .with_context(|| format!("starting {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn rel(tag: &str, assets: &[&str], draft: bool, pre: bool) -> Value {
        json!({
            "tag_name": tag, "draft": draft, "prerelease": pre, "body": "notes", "html_url": format!("https://github.com/x/y/releases/tag/{tag}"),
            "assets": assets.iter().map(|n| json!({"name": n, "size": 5, "browser_download_url": format!("https://github.com/x/y/releases/download/{tag}/{n}")})).collect::<Vec<_>>()
        })
    }

    #[test]
    fn versions_parse_and_compare() {
        assert_eq!(parse_version("v0.4.0"), Some((0, 4, 0)));
        assert_eq!(parse_version("1.10.2-beta+3"), Some((1, 10, 2)));
        assert_eq!(parse_version("android-v0.2.0"), None);
        assert_eq!(parse_version("1.2"), None);
        assert!(is_newer("0.10.0", "0.9.9"), "numeric, not lexicographic");
        assert!(!is_newer("0.4.0", "0.4.0"));
        assert!(!is_newer("0.3.9", "0.4.0"));
        assert!(!is_newer("garbage", "0.4.0"));
    }

    #[test]
    fn picks_newest_windows_release_and_ignores_other_families() {
        let all = json!([
            rel("android-v0.9.0", &["a.apk"], false, false),
            rel("client-v0.9.0", &["c.jar"], false, false),
            rel(
                "v0.5.0",
                &["Luminos-Setup.exe", "SHA256SUMS.txt"],
                false,
                false
            ),
            rel("v0.6.0", &["Luminos-Setup.exe"], true, false),
            rel("v0.7.0-rc1", &["Luminos-Setup.exe"], false, true),
            rel(
                "v0.4.0",
                &["Luminos-Setup.exe", "SHA256SUMS.txt"],
                false,
                false
            ),
            rel("v0.8.0", &["notes.txt"], false, false),
        ]);
        let r = pick_release(&all).unwrap();
        assert_eq!(r.version, "0.5.0");
        assert!(r.sums_url.is_some());
        assert!(r.setup_url.ends_with("/v0.5.0/Luminos-Setup.exe"));
        assert_eq!(pick_release(&json!([])), None);
    }

    #[test]
    fn reads_hash_from_sums_file() {
        let h = "06194c6143e640f643c7eeb87afc4d2ef44ef4309e3617a3193e62a5732c45f0";
        let text = format!(
            "{}  Luminos-Portable.exe\r\n{h}  Luminos-Setup.exe\r\n",
            "5".repeat(64)
        );
        assert_eq!(
            hash_from_sums(&text, "Luminos-Setup.exe").as_deref(),
            Some(h)
        );
        assert_eq!(hash_from_sums(&text, "Other.exe"), None);
        assert_eq!(
            hash_from_sums("short  Luminos-Setup.exe", "Luminos-Setup.exe"),
            None
        );
    }
}

#[cfg(test)]
mod prerelease_tests {
    use super::*;
    use serde_json::json;

    fn rel(tag: &str, pre: bool) -> Value {
        json!({"tag_name": tag, "draft": false, "prerelease": pre, "body": "n", "html_url": format!("https://github.com/x/y/releases/tag/{tag}"),
            "assets": [{"name": SETUP_ASSET, "browser_download_url": format!("https://x/{tag}/{SETUP_ASSET}"), "size": 10},
                       {"name": SUMS_ASSET, "browser_download_url": format!("https://x/{tag}/{SUMS_ASSET}"), "size": 1}]})
    }

    #[test]
    fn release_candidates_are_hidden_by_default_and_found_when_asked() {
        let list = json!([rel("v1.0.0-rc1", true), rel("v0.6.0", false), rel("client-v0.3.0", false)]);
        assert_eq!(pick_release_opts(&list, false).map(|r| r.tag), Some("v0.6.0".to_string()));
        assert_eq!(pick_release_opts(&list, true).map(|r| r.tag), Some("v1.0.0-rc1".to_string()));
        assert!(is_newer("v1.0.0-rc1", "0.6.0"));
    }
}
