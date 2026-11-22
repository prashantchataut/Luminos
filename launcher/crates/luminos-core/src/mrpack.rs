//! Modrinth modpack (`.mrpack`) import: creates a new instance from a pack.
use crate::{
    content,
    download::{self, Progress, Task},
    instances::{self, Instance, Loader},
    modrinth, paths,
};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use std::{collections::HashMap, fs, io::Read};

#[derive(Deserialize, Default)]
#[serde(default)]
struct Index {
    name: String,
    files: Vec<IndexFile>,
    dependencies: HashMap<String, String>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct IndexFile {
    path: String,
    hashes: HashMap<String, String>,
    downloads: Vec<String>,
    #[serde(rename = "fileSize")]
    file_size: u64,
    env: Option<HashMap<String, String>>,
}

/// Download and install a Modrinth modpack project as a brand-new instance.
pub fn install_modpack(project_id: &str, threads: usize, p: &Progress) -> Result<Instance> {
    p.set_stage("Looking up modpack…");
    let proj = modrinth::project(project_id)?;
    let versions = modrinth::versions(&proj.id, None, None)?;
    let v = modrinth::best_version(versions)
        .ok_or_else(|| anyhow!("{} has no versions", proj.title))?;
    let file = v
        .files
        .iter()
        .find(|f| f.filename.ends_with(".mrpack"))
        .ok_or_else(|| anyhow!("{} has no .mrpack file", proj.title))?;
    let archive = paths::cache_dir().join(&file.filename);
    p.set_stage(format!("Downloading {}…", proj.title));
    crate::http::download_to(&file.url, &archive)?;

    let mut zip = zip::ZipArchive::new(fs::File::open(&archive)?)?;
    let index: Index = {
        let mut f = zip.by_name("modrinth.index.json")?;
        let mut s = String::new();
        f.read_to_string(&mut s)?;
        serde_json::from_str(&s)?
    };
    let mc = index
        .dependencies
        .get("minecraft")
        .cloned()
        .ok_or_else(|| anyhow!("pack has no Minecraft version"))?;
    let (loader, lv) = if let Some(v) = index.dependencies.get("fabric-loader") {
        (Loader::Fabric, Some(v.clone()))
    } else if let Some(v) = index.dependencies.get("quilt-loader") {
        (Loader::Quilt, Some(v.clone()))
    } else if index.dependencies.contains_key("neoforge") {
        (Loader::NeoForge, None)
    } else if index.dependencies.contains_key("forge") {
        (Loader::Forge, None)
    } else {
        (Loader::Vanilla, None)
    };
    let name = if index.name.is_empty() {
        proj.title.clone()
    } else {
        index.name.clone()
    };
    let mut inst = instances::create(&name, &mc, loader, lv)?;
    inst.notes = proj.description.clone();
    inst.save()?;

    let game = inst.game_dir();
    let tasks: Vec<Task> = index
        .files
        .iter()
        .filter(|f| {
            f.env
                .as_ref()
                .map(|e| e.get("client").map(|c| c != "unsupported").unwrap_or(true))
                .unwrap_or(true)
        })
        .filter(|f| !f.path.contains("..") && !f.path.starts_with('/'))
        .filter_map(|f| {
            Some(Task {
                url: f.downloads.first()?.clone(),
                path: game.join(&f.path),
                sha1: f.hashes.get("sha1").cloned(),
                size: f.file_size,
            })
        })
        .collect();
    p.reset_counts();
    p.set_stage(format!("Downloading {} files…", tasks.len()));
    download::download_all(tasks, threads, p)?;

    p.set_stage("Applying overrides…");
    for i in 0..zip.len() {
        let mut e = zip.by_index(i)?;
        let Some(name) = e.enclosed_name() else {
            continue;
        };
        let rel = name
            .strip_prefix("overrides")
            .or_else(|_| name.strip_prefix("client-overrides"));
        if let Ok(rel) = rel {
            let out = game.join(rel);
            if e.is_dir() {
                fs::create_dir_all(&out)?;
            } else {
                if let Some(parent) = out.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut f = fs::File::create(&out)?;
                std::io::copy(&mut e, &mut f)?;
            }
        }
    }
    let _ = fs::remove_file(&archive);
    // Link pack mods to Modrinth so they can be updated individually.
    p.set_stage("Linking mods for updates…");
    let _ = content::identify(&inst, content::Kind::Mod);
    Ok(inst)
}
