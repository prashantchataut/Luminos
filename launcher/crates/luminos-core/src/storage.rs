//! What Luminos stores on disk, how much, and safe ways to give it back.
use crate::paths;
use anyhow::{bail, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug)]
pub struct Area {
    pub name: &'static str,
    pub detail: &'static str,
    pub path: PathBuf,
    pub bytes: u64,
    /// Safe to delete: it is downloaded again on demand and holds none of your data.
    pub reclaimable: bool,
}

/// Recursive size, never following symlinks (so a link cannot make us count or delete outside the folder).
pub fn dir_size(p: &Path) -> u64 {
    let Ok(md) = fs::symlink_metadata(p) else {
        return 0;
    };
    if md.is_file() {
        return md.len();
    }
    if !md.is_dir() {
        return 0;
    }
    fs::read_dir(p)
        .map(|rd| rd.flatten().map(|e| dir_size(&e.path())).sum())
        .unwrap_or(0)
}

pub fn areas() -> Vec<Area> {
    let mk = |name, detail, path: PathBuf, reclaimable| Area {
        name,
        detail,
        bytes: dir_size(&path),
        path,
        reclaimable,
    };
    vec![
        mk("Instances", "Worlds, mods, screenshots and settings of each instance. Yours; never deleted by cleanup.", paths::instances_dir(), false),
        Area {
            name: "Minecraft files",
            detail: "Game jars, libraries and sound/language assets from Mojang. Downloaded again when you launch.",
            path: paths::root(),
            bytes: game_file_dirs().iter().map(|d| dir_size(d)).sum(),
            reclaimable: true,
        },
        mk("Java runtimes", "Java builds Luminos downloaded for you. Downloaded again when needed.", paths::runtimes_dir(), true),
        mk("Downloads cache", "Update installers and temporary downloads.", paths::cache_dir(), true),
        mk("Skins", "Your skin library.", paths::skins_dir(), false),
    ]
}

/// The folders under the root that make up "Minecraft files" (see `paths.rs`).
fn game_file_dirs() -> Vec<PathBuf> {
    vec![
        paths::versions_dir(),
        paths::libraries_dir(),
        paths::assets_dir(),
    ]
}

/// Remove the contents of `dir` (not `dir` itself) and return the bytes freed.
fn empty_dir(dir: &Path) -> Result<u64> {
    let freed = dir_size(dir);
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            let md = fs::symlink_metadata(&p)?;
            if md.is_dir() {
                fs::remove_dir_all(&p)?;
            } else {
                fs::remove_file(&p)?;
            }
        }
    }
    Ok(freed)
}

fn inside_root(p: &Path) -> bool {
    p.starts_with(paths::root())
}

pub fn clear_cache() -> Result<u64> {
    let d = paths::cache_dir();
    if !inside_root(&d) {
        bail!("refusing to clean a folder outside the launcher folder");
    }
    empty_dir(&d)
}

pub fn clear_game_files() -> Result<u64> {
    let mut total = 0;
    for d in game_file_dirs() {
        if !inside_root(&d) {
            bail!("refusing to clean a folder outside the launcher folder");
        }
        total += empty_dir(&d)?;
    }
    Ok(total)
}

pub fn clear_runtimes() -> Result<u64> {
    empty_dir(&paths::runtimes_dir())
}

/// Accounts, settings, skin library and playtime history. Instances and worlds are kept.
pub fn reset_launcher_data() -> Result<()> {
    for f in [
        paths::settings_file(),
        paths::accounts_file(),
        paths::playtime_file(),
    ] {
        if f.exists() {
            fs::remove_file(f)?;
        }
    }
    empty_dir(&paths::skins_dir())?;
    Ok(())
}

/// Delete everything Luminos has stored, including instances and worlds. Irreversible.
pub fn wipe_everything() -> Result<u64> {
    let root = paths::root();
    if root.parent().is_none() || root.components().count() < 3 {
        bail!(
            "refusing to wipe `{}`: it does not look like a Luminos data folder",
            root.display()
        );
    }
    empty_dir(&root)
}

pub fn human(bytes: u64) -> String {
    const U: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut v = bytes as f64;
    let mut i = 0;
    while v >= 1024.0 && i < 3 {
        v /= 1024.0;
        i += 1;
    }
    if i == 0 {
        format!("{bytes} B")
    } else {
        format!("{v:.1} {}", U[i])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn human_sizes() {
        assert_eq!(human(0), "0 B");
        assert_eq!(human(1023), "1023 B");
        assert_eq!(human(1536), "1.5 KB");
        assert_eq!(human(5 * 1024 * 1024), "5.0 MB");
    }

    #[test]
    fn dir_size_counts_files_and_empty_dir_clears_them() {
        let d = std::env::temp_dir().join(format!("lum-storage-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join("a/b")).unwrap();
        fs::write(d.join("a/b/x.bin"), vec![0u8; 1000]).unwrap();
        fs::write(d.join("y.bin"), vec![0u8; 24]).unwrap();
        assert_eq!(dir_size(&d), 1024);
        assert_eq!(empty_dir(&d).unwrap(), 1024);
        assert_eq!(dir_size(&d), 0);
        assert!(d.exists(), "the folder itself stays");
        fs::remove_dir_all(&d).unwrap();
    }
}
