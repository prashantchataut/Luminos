//! Instances: isolated game folders, each with its own version, loader, mods and settings.
use crate::{paths, store};
use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Loader {
    #[default]
    Vanilla,
    Fabric,
    Quilt,
    Forge,
    NeoForge,
}

impl Loader {
    pub const ALL: [Loader; 5] = [
        Loader::Vanilla,
        Loader::Fabric,
        Loader::Quilt,
        Loader::Forge,
        Loader::NeoForge,
    ];
    pub fn label(self) -> &'static str {
        match self {
            Loader::Vanilla => "Vanilla",
            Loader::Fabric => "Fabric",
            Loader::Quilt => "Quilt",
            Loader::Forge => "Forge",
            Loader::NeoForge => "NeoForge",
        }
    }
    /// Modrinth `categories` value for this loader.
    pub fn modrinth_id(self) -> Option<&'static str> {
        match self {
            Loader::Vanilla => None,
            Loader::Fabric => Some("fabric"),
            Loader::Quilt => Some("quilt"),
            Loader::Forge => Some("forge"),
            Loader::NeoForge => Some("neoforge"),
        }
    }
    /// Launching this loader is implemented in the engine today.
    pub fn supported(self) -> bool {
        matches!(self, Loader::Vanilla | Loader::Fabric | Loader::Quilt)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader: Loader,
    pub loader_version: Option<String>,
    pub created: i64,
    pub last_played: Option<i64>,
    pub playtime_secs: u64,
    pub memory_mb: Option<u32>,
    pub java_path: Option<String>,
    pub jvm_args: String,
    pub notes: String,
    pub favorite: bool,
    /// Palette index used for the generated icon.
    pub color: u8,
    /// Set when created from a preset such as the Luminos Client bundle.
    pub preset: Option<String>,
}

impl Instance {
    pub fn dir(&self) -> PathBuf {
        paths::instances_dir().join(&self.id)
    }
    pub fn game_dir(&self) -> PathBuf {
        self.dir().join("minecraft")
    }
    pub fn save(&self) -> Result<()> {
        store::write_json(&self.dir().join("instance.json"), self)
    }
    pub fn subtitle(&self) -> String {
        match self.loader {
            Loader::Vanilla => format!("Vanilla {}", self.mc_version),
            l => format!("{} · {}", l.label(), self.mc_version),
        }
    }
}

pub fn list() -> Vec<Instance> {
    let mut out = vec![];
    if let Ok(rd) = fs::read_dir(paths::instances_dir()) {
        for e in rd.flatten() {
            let f = e.path().join("instance.json");
            if f.exists() {
                let inst: Instance = store::read_json(&f);
                if !inst.id.is_empty() {
                    out.push(inst);
                }
            }
        }
    }
    out.sort_by(|a, b| {
        b.last_played
            .unwrap_or(0)
            .cmp(&a.last_played.unwrap_or(0))
            .then(b.created.cmp(&a.created))
    });
    out
}

pub fn create(
    name: &str,
    mc_version: &str,
    loader: Loader,
    loader_version: Option<String>,
) -> Result<Instance> {
    let name = name.trim();
    if name.is_empty() {
        bail!("Give your instance a name");
    }
    let base = paths::slugify(name);
    let mut id = base.clone();
    let mut n = 2;
    while paths::instances_dir().join(&id).exists() {
        id = format!("{base}-{n}");
        n += 1;
    }
    let inst = Instance {
        id,
        name: name.to_string(),
        mc_version: mc_version.to_string(),
        loader,
        loader_version,
        created: store::now_unix(),
        color: (store::now_unix() % 8) as u8,
        ..Default::default()
    };
    for sub in [
        "mods",
        "resourcepacks",
        "shaderpacks",
        "saves",
        "screenshots",
        "config",
    ] {
        fs::create_dir_all(inst.game_dir().join(sub))?;
    }
    inst.save()?;
    Ok(inst)
}

pub fn delete(id: &str) -> Result<()> {
    let dir = paths::instances_dir().join(id);
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    Ok(())
}

fn copy_dir(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for e in fs::read_dir(src)?.flatten() {
        let to = dst.join(e.file_name());
        if e.path().is_dir() {
            copy_dir(&e.path(), &to)?;
        } else {
            fs::copy(e.path(), to)?;
        }
    }
    Ok(())
}

pub fn duplicate(id: &str) -> Result<Instance> {
    let src: Instance = store::read_json(&paths::instances_dir().join(id).join("instance.json"));
    let mut copy = src.clone();
    copy.name = format!("{} (copy)", src.name);
    let base = paths::slugify(&copy.name);
    let mut nid = base.clone();
    let mut n = 2;
    while paths::instances_dir().join(&nid).exists() {
        nid = format!("{base}-{n}");
        n += 1;
    }
    copy.id = nid;
    copy.playtime_secs = 0;
    copy.last_played = None;
    copy.created = store::now_unix();
    copy_dir(&src.dir(), &copy.dir())?;
    copy.save()?;
    Ok(copy)
}

pub struct World {
    pub name: String,
    pub modified: i64,
}

pub fn worlds(inst: &Instance) -> Vec<World> {
    let mut v = vec![];
    if let Ok(rd) = fs::read_dir(inst.game_dir().join("saves")) {
        for e in rd.flatten() {
            if e.path().is_dir() {
                let modified = e
                    .metadata()
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                v.push(World {
                    name: e.file_name().to_string_lossy().to_string(),
                    modified,
                });
            }
        }
    }
    v.sort_by_key(|e| std::cmp::Reverse(e.modified));
    v
}
