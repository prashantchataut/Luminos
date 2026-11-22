//! Installed content (mods, resource packs, shaders, data packs): install, toggle, remove,
//! unlink, identify untracked files and auto-update through Modrinth.
use crate::{
    download::{self, Task},
    instances::{Instance, Loader},
    modrinth::{self, Version},
    store,
};
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Kind {
    Mod,
    ResourcePack,
    Shader,
    DataPack,
}

impl Kind {
    pub const ALL: [Kind; 4] = [Kind::Mod, Kind::ResourcePack, Kind::Shader, Kind::DataPack];
    pub fn folder(self) -> &'static str {
        match self {
            Kind::Mod => "mods",
            Kind::ResourcePack => "resourcepacks",
            Kind::Shader => "shaderpacks",
            Kind::DataPack => "datapacks",
        }
    }
    pub fn label(self) -> &'static str {
        match self {
            Kind::Mod => "Mods",
            Kind::ResourcePack => "Resource Packs",
            Kind::Shader => "Shaders",
            Kind::DataPack => "Data Packs",
        }
    }
    pub fn project_type(self) -> &'static str {
        match self {
            Kind::Mod => "mod",
            Kind::ResourcePack => "resourcepack",
            Kind::Shader => "shader",
            Kind::DataPack => "datapack",
        }
    }
    pub fn from_project_type(t: &str) -> Kind {
        match t {
            "resourcepack" => Kind::ResourcePack,
            "shader" => Kind::Shader,
            "datapack" => Kind::DataPack,
            _ => Kind::Mod,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct LockEntry {
    pub project_id: String,
    pub version_id: String,
    pub name: String,
    pub version: String,
    pub icon_url: Option<String>,
    pub description: String,
    pub sha1: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Lock {
    /// key = `<folder>/<file name without .disabled>`
    entries: HashMap<String, LockEntry>,
}

#[derive(Clone, Debug)]
pub struct Entry {
    pub file: String,
    pub display_name: String,
    pub version: String,
    pub enabled: bool,
    pub linked: bool,
    pub project_id: Option<String>,
    pub icon_url: Option<String>,
    pub description: String,
    pub size: u64,
}

fn lock_path(inst: &Instance) -> PathBuf {
    inst.dir().join("content.lock.json")
}
fn load_lock(inst: &Instance) -> Lock {
    store::read_json(&lock_path(inst))
}
fn save_lock(inst: &Instance, l: &Lock) {
    let _ = store::write_json(&lock_path(inst), l);
}
fn key(kind: Kind, file: &str) -> String {
    format!("{}/{}", kind.folder(), file.trim_end_matches(".disabled"))
}
fn dir(inst: &Instance, kind: Kind) -> PathBuf {
    inst.game_dir().join(kind.folder())
}

fn pretty_name(file: &str) -> String {
    file.trim_end_matches(".disabled")
        .trim_end_matches(".jar")
        .trim_end_matches(".zip")
        .to_string()
}

pub fn list(inst: &Instance, kind: Kind) -> Vec<Entry> {
    let lock = load_lock(inst);
    let mut out = vec![];
    if let Ok(rd) = fs::read_dir(dir(inst, kind)) {
        for e in rd.flatten() {
            let file = e.file_name().to_string_lossy().to_string();
            let base = file.trim_end_matches(".disabled");
            if !(base.ends_with(".jar") || base.ends_with(".zip")) {
                continue;
            }
            let l = lock.entries.get(&key(kind, &file));
            out.push(Entry {
                display_name: l
                    .map(|l| l.name.clone())
                    .unwrap_or_else(|| pretty_name(&file)),
                version: l.map(|l| l.version.clone()).unwrap_or_default(),
                enabled: !file.ends_with(".disabled"),
                linked: l.is_some(),
                project_id: l.map(|l| l.project_id.clone()),
                icon_url: l.and_then(|l| l.icon_url.clone()),
                description: l.map(|l| l.description.clone()).unwrap_or_default(),
                size: e.metadata().map(|m| m.len()).unwrap_or(0),
                file,
            });
        }
    }
    out.sort_by_key(|e| e.display_name.to_lowercase());
    out
}

pub fn set_enabled(inst: &Instance, kind: Kind, file: &str, enabled: bool) -> Result<()> {
    let d = dir(inst, kind);
    let base = file.trim_end_matches(".disabled");
    let (from, to) = if enabled {
        (d.join(format!("{base}.disabled")), d.join(base))
    } else {
        (d.join(base), d.join(format!("{base}.disabled")))
    };
    if from.exists() {
        fs::rename(from, to)?;
    }
    Ok(())
}

pub fn remove(inst: &Instance, kind: Kind, file: &str) -> Result<()> {
    let p = dir(inst, kind).join(file);
    if p.exists() {
        fs::remove_file(p)?;
    }
    let mut lock = load_lock(inst);
    lock.entries.remove(&key(kind, file));
    save_lock(inst, &lock);
    Ok(())
}

/// Stop tracking a file: it stays on disk but is never auto-updated again.
pub fn unlink(inst: &Instance, kind: Kind, file: &str) {
    let mut lock = load_lock(inst);
    lock.entries.remove(&key(kind, file));
    save_lock(inst, &lock);
}

fn game_filters(inst: &Instance, kind: Kind) -> (Option<&'static str>, Option<String>) {
    let loader = if kind == Kind::Mod {
        inst.loader.modrinth_id()
    } else {
        None
    };
    (loader, Some(inst.mc_version.clone()))
}

/// Download one version file into the instance and record it.
pub fn install_version(
    inst: &Instance,
    kind: Kind,
    proj: &modrinth::Project,
    v: &Version,
) -> Result<String> {
    let f = v
        .primary_file()
        .ok_or_else(|| anyhow!("{} has no downloadable file", proj.title))?;
    let path = dir(inst, kind).join(&f.filename);
    fs::create_dir_all(dir(inst, kind))?;
    let progress = download::Progress::new();
    download::download_all(
        vec![Task {
            url: f.url.clone(),
            path,
            sha1: Some(f.hashes.sha1.clone()),
            size: f.size,
        }],
        1,
        &progress,
    )?;
    let mut lock = load_lock(inst);
    lock.entries.insert(
        key(kind, &f.filename),
        LockEntry {
            project_id: proj.id.clone(),
            version_id: v.id.clone(),
            name: proj.title.clone(),
            version: v.version_number.clone(),
            icon_url: proj.icon_url.clone(),
            description: proj.description.clone(),
            sha1: f.hashes.sha1.clone(),
        },
    );
    save_lock(inst, &lock);
    Ok(f.filename.clone())
}

/// Install a project (newest compatible release) plus its required dependencies.
pub fn install_project(inst: &Instance, project_id: &str, kind: Kind) -> Result<Vec<String>> {
    let mut installed_projects: HashSet<String> = load_lock(inst)
        .entries
        .values()
        .map(|e| e.project_id.clone())
        .collect();
    let mut done = vec![];
    install_rec(
        inst,
        project_id,
        kind,
        0,
        &mut installed_projects,
        &mut done,
    )?;
    Ok(done)
}

fn install_rec(
    inst: &Instance,
    id: &str,
    kind: Kind,
    depth: u8,
    seen: &mut HashSet<String>,
    done: &mut Vec<String>,
) -> Result<()> {
    let proj = modrinth::project(id)?;
    if seen.contains(&proj.id) {
        return Ok(());
    }
    seen.insert(proj.id.clone());
    let (loader, gv) = game_filters(inst, kind);
    let v = modrinth::best_version(modrinth::versions(&proj.id, loader, gv.as_deref())?)
        .ok_or_else(|| {
            anyhow!(
                "{} has no version for {} {}",
                proj.title,
                inst.loader.label(),
                inst.mc_version
            )
        })?;
    let file = install_version(inst, kind, &proj, &v)?;
    done.push(format!("{} {}", proj.title, v.version_number));
    let _ = file;
    if depth < 3 {
        for d in &v.dependencies {
            if d.dependency_type == "required" {
                if let Some(pid) = &d.project_id {
                    if !seen.contains(pid) {
                        let _ = install_rec(inst, pid, Kind::Mod, depth + 1, seen, done);
                    }
                }
            }
        }
    }
    Ok(())
}

/// Link untracked jars to Modrinth projects by hash so they can be updated too.
pub fn identify(inst: &Instance, kind: Kind) -> Result<usize> {
    let mut lock = load_lock(inst);
    let mut hash_to_file: HashMap<String, String> = HashMap::new();
    for e in list(inst, kind).into_iter().filter(|e| !e.linked) {
        if let Ok(h) = store::sha1_file(&dir(inst, kind).join(&e.file)) {
            hash_to_file.insert(h, e.file);
        }
    }
    let hashes: Vec<String> = hash_to_file.keys().cloned().collect();
    let found = modrinth::versions_by_hashes(&hashes)?;
    let ids: Vec<String> = found
        .values()
        .map(|v| v.project_id.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let projs: HashMap<String, modrinth::Project> = modrinth::projects(&ids)?
        .into_iter()
        .map(|p| (p.id.clone(), p))
        .collect();
    let mut n = 0;
    for (hash, v) in found {
        if let (Some(file), Some(p)) = (hash_to_file.get(&hash), projs.get(&v.project_id)) {
            lock.entries.insert(
                key(kind, file),
                LockEntry {
                    project_id: p.id.clone(),
                    version_id: v.id.clone(),
                    name: p.title.clone(),
                    version: v.version_number.clone(),
                    icon_url: p.icon_url.clone(),
                    description: p.description.clone(),
                    sha1: hash,
                },
            );
            n += 1;
        }
    }
    save_lock(inst, &lock);
    Ok(n)
}

#[derive(Clone, Debug)]
pub struct Update {
    pub kind: Kind,
    pub file: String,
    pub name: String,
    pub from: String,
    pub to: Version,
}

/// One API call per content kind: which linked files have a newer compatible version?
pub fn check_updates(inst: &Instance) -> Result<Vec<Update>> {
    let mut out = vec![];
    let lock = load_lock(inst);
    for kind in Kind::ALL {
        let mut by_hash: HashMap<String, (String, LockEntry)> = HashMap::new();
        for e in list(inst, kind)
            .into_iter()
            .filter(|e| e.linked && e.enabled)
        {
            if let Some(l) = lock.entries.get(&key(kind, &e.file)) {
                by_hash.insert(l.sha1.clone(), (e.file.clone(), l.clone()));
            }
        }
        if by_hash.is_empty() {
            continue;
        }
        let hashes: Vec<String> = by_hash.keys().cloned().collect();
        let loaders: Vec<String> = if kind == Kind::Mod {
            inst.loader
                .modrinth_id()
                .map(|s| vec![s.to_string()])
                .unwrap_or_else(|| {
                    vec![
                        "fabric".into(),
                        "quilt".into(),
                        "forge".into(),
                        "neoforge".into(),
                    ]
                })
        } else {
            vec![]
        };
        let latest =
            modrinth::latest_for_hashes(&hashes, &loaders, std::slice::from_ref(&inst.mc_version))?;
        for (hash, newest) in latest {
            if let Some((file, l)) = by_hash.get(&hash) {
                if newest.id != l.version_id {
                    out.push(Update {
                        kind,
                        file: file.clone(),
                        name: l.name.clone(),
                        from: l.version.clone(),
                        to: newest,
                    });
                }
            }
        }
    }
    out.sort_by_key(|u| u.name.to_lowercase());
    Ok(out)
}

pub fn apply_update(inst: &Instance, u: &Update) -> Result<()> {
    let proj = modrinth::project(&u.to.project_id)?;
    let enabled = !u.file.ends_with(".disabled");
    let new_file = install_version(inst, u.kind, &proj, &u.to)?;
    if new_file != u.file.trim_end_matches(".disabled") {
        remove(inst, u.kind, &u.file)?;
    }
    if !enabled {
        set_enabled(inst, u.kind, &new_file, false)?;
    }
    Ok(())
}

/// Convenience used by the "Update all" button.
pub fn update_all(inst: &Instance) -> Result<usize> {
    let ups = check_updates(inst)?;
    let mut n = 0;
    for u in &ups {
        if apply_update(inst, u).is_ok() {
            n += 1;
        }
    }
    Ok(n)
}

/// Does this loader take Fabric-style mods? (used to warn about unsupported combos)
pub fn loader_accepts_mods(l: Loader) -> bool {
    l != Loader::Vanilla
}
