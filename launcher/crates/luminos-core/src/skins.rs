//! Skin library: save, import and fetch skins from open services.
use crate::{paths, store};
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

/// Make sure the built-in Luminos skins are in the library (idempotent). Returns the library.
pub fn ensure_builtin() -> SkinLibrary {
    let mut lib = load();
    let mut changed = false;
    for b in crate::cosmetics::SKINS {
        if !png_path(b.id).exists() {
            let _ = fs::create_dir_all(paths::skins_dir());
            let _ = fs::write(png_path(b.id), b.png);
        }
        if !lib.skins.iter().any(|s| s.id == b.id) {
            lib.skins.push(SkinEntry {
                id: b.id.into(),
                name: b.name.into(),
                slim: b.slim,
                source: "Luminos original".into(),
                added: 0,
            });
            changed = true;
        }
    }
    if changed {
        let _ = store::write_json(&lib_file(), &lib);
    }
    lib
}

pub fn delete(id: &str) {
    let mut lib = load();
    lib.skins.retain(|s| s.id != id);
    let _ = fs::remove_file(png_path(id));
    let _ = store::write_json(&lib_file(), &lib);
}

/// Open sources that serve any player's skin by name, tried in order.
/// The only place a skin is looked up by name: Mojang's own API (see `skinlookup`).
pub const OPEN_SOURCES: [(&str, &str); 1] =
    [("Mojang", "api.mojang.com + sessionserver.mojang.com")];

pub fn fetch_by_username(name: &str) -> Result<Vec<u8>> {
    match crate::skinlookup::lookup(name)? {
        crate::skinlookup::Outcome::Found(f) => Ok(f.png),
        crate::skinlookup::Outcome::NoSuchPlayer => {
            Err(anyhow!("no Minecraft account is named {name}"))
        }
        crate::skinlookup::Outcome::NoSkin { .. } => Err(anyhow!("{name} has not set a skin")),
    }
}
