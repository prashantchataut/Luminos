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

/// Export an instance as a `.mrpack` (Modrinth pack format 1) another launcher can import.
/// Every jar and config travels under `overrides/`, so the file works offline and without Modrinth lookups.
/// Saves are never included. Returns the number of files written.
pub fn export(inst: &crate::instances::Instance, dest: &std::path::Path) -> Result<usize> {
    use std::io::Write;
    let loader_dep = match inst.loader {
        crate::instances::Loader::Vanilla => None,
        crate::instances::Loader::Fabric => Some("fabric-loader"),
        crate::instances::Loader::Quilt => Some("quilt-loader"),
        crate::instances::Loader::Forge => Some("forge"),
        crate::instances::Loader::NeoForge => Some("neoforge"),
    };
    let mut deps = serde_json::Map::new();
    deps.insert("minecraft".into(), inst.mc_version.clone().into());
    if let (Some(k), Some(v)) = (loader_dep, inst.loader_version.as_ref()) {
        deps.insert(k.into(), v.clone().into());
    }
    let index = serde_json::json!({
        "formatVersion": 1, "game": "minecraft", "versionId": "1.0.0", "name": inst.name,
        "summary": "Exported from Luminos", "files": [], "dependencies": deps
    });
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut zw = zip::ZipWriter::new(fs::File::create(dest)?);
    let opts = zip::write::SimpleFileOptions::default();
    zw.start_file("modrinth.index.json", opts)?;
    zw.write_all(serde_json::to_string_pretty(&index)?.as_bytes())?;
    let mut n = 0usize;
    for sub in ["mods", "config", "resourcepacks", "shaderpacks"] {
        let root = inst.game_dir().join(sub);
        let mut stack = vec![root.clone()];
        while let Some(d) = stack.pop() {
            let Ok(rd) = fs::read_dir(&d) else { continue };
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    stack.push(p);
                } else if let Ok(rel) = p.strip_prefix(inst.game_dir()) {
                    zw.start_file(
                        format!("overrides/{}", rel.to_string_lossy().replace('\\', "/")),
                        opts,
                    )?;
                    zw.write_all(&fs::read(&p)?)?;
                    n += 1;
                }
            }
        }
    }
    zw.finish()?;
    Ok(n)
}

#[cfg(test)]
mod export_tests {
    use super::*;

    #[test]
    fn export_writes_index_and_overrides_but_never_saves() {
        let _g = crate::paths::test_home_lock();
        let home = std::env::temp_dir().join(format!("luminos-exp-{}", std::process::id()));
        std::env::set_var("LUMINOS_HOME", &home);
        let inst = crate::instances::Instance {
            id: "exp1".into(),
            name: "My Pack".into(),
            mc_version: "1.21.4".into(),
            loader: crate::instances::Loader::Fabric,
            loader_version: Some("0.16.0".into()),
            ..Default::default()
        };
        for (sub, f) in [
            ("mods", "a.jar"),
            ("config", "x/y.toml"),
            ("saves", "world/level.dat"),
        ] {
            let p = inst.game_dir().join(sub).join(f);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, b"data").unwrap();
        }
        let out = home.join("out").join("My Pack.mrpack");
        assert_eq!(export(&inst, &out).unwrap(), 2);
        let mut z = zip::ZipArchive::new(fs::File::open(&out).unwrap()).unwrap();
        let names: Vec<String> = (0..z.len())
            .map(|i| {
                z.by_index(i)
                    .unwrap()
                    .name()
                    .map(|c| c.into_owned())
                    .unwrap()
            })
            .collect();
        assert!(names.contains(&"modrinth.index.json".to_string()));
        assert!(names.contains(&"overrides/mods/a.jar".to_string()));
        assert!(names.contains(&"overrides/config/x/y.toml".to_string()));
        assert!(
            !names.iter().any(|n| n.contains("saves")),
            "saves must not be exported: {names:?}"
        );
        let idx: serde_json::Value =
            serde_json::from_reader(z.by_name("modrinth.index.json").unwrap()).unwrap();
        assert_eq!(idx["dependencies"]["minecraft"], "1.21.4");
        assert_eq!(idx["dependencies"]["fabric-loader"], "0.16.0");
    }
}
