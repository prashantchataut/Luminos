//! Skin library: save, import and fetch skins from open services.
use crate::{http, paths, store};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SkinEntry {
    pub id: String,
    pub name: String,
    /// `true` for the 3px "Alex" arm model.
    pub slim: bool,
    pub source: String,
    pub added: i64,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct SkinLibrary {
    pub skins: Vec<SkinEntry>,
}

fn lib_file() -> std::path::PathBuf {
    paths::skins_dir().join("library.json")
}

pub fn load() -> SkinLibrary {
    store::read_json(&lib_file())
}

pub fn png_path(id: &str) -> std::path::PathBuf {
    paths::skins_dir().join(format!("{id}.png"))
}

pub fn read_png(id: &str) -> Option<Vec<u8>> {
    fs::read(png_path(id)).ok()
}

/// Save PNG bytes into the library and return the new entry.
pub fn save(name: &str, png: &[u8], slim: bool, source: &str) -> Result<SkinEntry> {
    if png.len() < 8 || &png[1..4] != b"PNG" {
        return Err(anyhow!("that is not a PNG image"));
    }
    let mut lib = load();
    let id = format!("{}-{}", paths::slugify(name), store::now_unix());
    fs::create_dir_all(paths::skins_dir())?;
    fs::write(png_path(&id), png)?;
    let e = SkinEntry {
        id,
        name: name.to_string(),
        slim,
        source: source.to_string(),
        added: store::now_unix(),
    };
    lib.skins.insert(0, e.clone());
    store::write_json(&lib_file(), &lib)?;
    Ok(e)
}

pub fn delete(id: &str) {
    let mut lib = load();
    lib.skins.retain(|s| s.id != id);
    let _ = fs::remove_file(png_path(id));
    let _ = store::write_json(&lib_file(), &lib);
}

/// Open sources that serve any player's skin by name, tried in order.
pub const OPEN_SOURCES: [(&str, &str); 2] = [
    ("Minotar", "https://minotar.net/skin/{name}"),
    ("MC-Heads", "https://mc-heads.net/skin/{name}"),
];

pub fn fetch_by_username(name: &str) -> Result<Vec<u8>> {
    if !crate::accounts::valid_username(name) {
        return Err(anyhow!("invalid Minecraft username"));
    }
    let mut last = anyhow!("no skin source answered");
    for (_, tpl) in OPEN_SOURCES {
        match http::get_bytes(&tpl.replace("{name}", name)) {
            Ok(b) if b.len() > 8 && &b[1..4] == b"PNG" => return Ok(b),
            Ok(_) => last = anyhow!("source returned a non-PNG response"),
            Err(e) => last = e,
        }
    }
    Err(last)
}
