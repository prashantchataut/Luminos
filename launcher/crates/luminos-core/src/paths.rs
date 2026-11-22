//! Where Luminos keeps everything. Override with `LUMINOS_HOME` for portable installs.
use std::path::PathBuf;

pub fn root() -> PathBuf {
    if let Ok(p) = std::env::var("LUMINOS_HOME") {
        return PathBuf::from(p);
    }
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("LuminosLauncher")
}

pub fn instances_dir() -> PathBuf {
    root().join("instances")
}
pub fn versions_dir() -> PathBuf {
    root().join("versions")
}
pub fn libraries_dir() -> PathBuf {
    root().join("libraries")
}
pub fn assets_dir() -> PathBuf {
    root().join("assets")
}
pub fn runtimes_dir() -> PathBuf {
    root().join("runtimes")
}
pub fn skins_dir() -> PathBuf {
    root().join("skins")
}
pub fn cache_dir() -> PathBuf {
    root().join("cache")
}
pub fn settings_file() -> PathBuf {
    root().join("settings.json")
}
pub fn accounts_file() -> PathBuf {
    root().join("accounts.json")
}
pub fn playtime_file() -> PathBuf {
    root().join("playtime.json")
}

/// `My Cool Pack!` -> `my-cool-pack`
pub fn slugify(s: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in s.trim().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        "instance".into()
    } else {
        out
    }
}
