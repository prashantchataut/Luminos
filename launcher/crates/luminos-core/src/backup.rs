//! World backups: zip a world into `<instance>/backups/`, list, restore (non-destructively) and prune.
//!
//! Restores never overwrite: an existing world folder is first renamed to `<name>.before-restore-<ts>`.
use crate::{instances::Instance, store};
use anyhow::{bail, Context, Result};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use zip::write::SimpleFileOptions;

#[derive(Clone, Debug)]
pub struct Backup {
    pub world: String,
    pub file: PathBuf,
    pub created: i64,
    pub size: u64,
}

pub fn backups_dir(inst: &Instance) -> PathBuf {
    inst.dir().join("backups")
}

fn safe_world_name(name: &str) -> Result<()> {
    if name.is_empty() || name.contains(['/', '\\']) || name == "." || name == ".." {
        bail!("Invalid world name: {name:?}");
    }
    Ok(())
}

fn add_dir(
    zip: &mut zip::ZipWriter<fs::File>,
    base: &Path,
    dir: &Path,
    prefix: &str,
    opts: SimpleFileOptions,
) -> Result<()> {
    for entry in fs::read_dir(dir)?.flatten() {
        let path = entry.path();
        let rel = path
            .strip_prefix(base)?
            .to_string_lossy()
            .replace('\\', "/");
        let name = format!("{prefix}/{rel}");
        if path.is_dir() {
            zip.add_directory(format!("{name}/"), opts)?;
            add_dir(zip, base, &path, prefix, opts)?;
        } else if path.file_name().is_some_and(|n| n == "session.lock") {
            continue; // held open by a running game; not needed
        } else {
            zip.start_file(name, opts)?;
            let mut f = fs::File::open(&path)?;
            let mut buf = [0u8; 64 * 1024];
            loop {
                let n = f.read(&mut buf)?;
                if n == 0 {
                    break;
                }
                zip.write_all(&buf[..n])?;
            }
        }
    }
    Ok(())
}

/// Zip `saves/<world>` into `backups/<world>__<unix>.zip` and return the backup record.
pub fn backup_world(inst: &Instance, world: &str) -> Result<Backup> {
    safe_world_name(world)?;
    let src = inst.game_dir().join("saves").join(world);
    if !src.is_dir() {
        bail!("World “{world}” was not found");
    }
    let dir = backups_dir(inst);
    fs::create_dir_all(&dir)?;
    let ts = store::now_unix();
    let file = dir.join(format!("{world}__{ts}.zip"));
    let out = fs::File::create(&file).with_context(|| format!("creating {}", file.display()))?;
    let mut zip = zip::ZipWriter::new(out);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    zip.add_directory(format!("{world}/"), opts)?;
    add_dir(&mut zip, &src, &src, world, opts)?;
    zip.finish()?;
    let size = fs::metadata(&file)?.len();
    Ok(Backup {
        world: world.to_string(),
        file,
        created: ts,
        size,
    })
}

fn parse_name(file: &Path) -> Option<(String, i64)> {
    let stem = file.file_stem()?.to_string_lossy().to_string();
    let (world, ts) = stem.rsplit_once("__")?;
    Some((world.to_string(), ts.parse().ok()?))
}

/// All backups of an instance, newest first.
pub fn list_backups(inst: &Instance) -> Vec<Backup> {
    let mut v: Vec<Backup> = fs::read_dir(backups_dir(inst))
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "zip"))
        .filter_map(|e| {
            let (world, created) = parse_name(&e.path())?;
            Some(Backup {
                world,
                created,
                size: e.metadata().ok()?.len(),
                file: e.path(),
            })
        })
        .collect();
    v.sort_by_key(|e| std::cmp::Reverse(e.created));
    v
}

/// Restore a backup. Returns the path of the restored world folder.
pub fn restore(inst: &Instance, backup: &Backup) -> Result<PathBuf> {
    safe_world_name(&backup.world)?;
    let saves = inst.game_dir().join("saves");
    fs::create_dir_all(&saves)?;
    let target = saves.join(&backup.world);
    if target.exists() {
        let moved = saves.join(format!(
            "{}.before-restore-{}",
            backup.world,
            store::now_unix()
        ));
        fs::rename(&target, &moved).context("moving the current world aside")?;
    }
    let mut z = zip::ZipArchive::new(fs::File::open(&backup.file)?)?;
    for i in 0..z.len() {
        let mut e = z.by_index(i)?;
        let Some(name) = e.enclosed_name() else {
            continue;
        }; // rejects ../ traversal
        let dest = saves.join(name);
        if e.is_dir() {
            fs::create_dir_all(&dest)?;
        } else {
            if let Some(p) = dest.parent() {
                fs::create_dir_all(p)?;
            }
            let mut out = fs::File::create(&dest)?;
            std::io::copy(&mut e, &mut out)?;
        }
    }
    Ok(target)
}

/// Keep only the newest `keep` backups of `world`; returns how many were deleted.
pub fn prune(inst: &Instance, world: &str, keep: usize) -> usize {
    let mut n = 0;
    for b in list_backups(inst)
        .into_iter()
        .filter(|b| b.world == world)
        .skip(keep)
    {
        if fs::remove_file(&b.file).is_ok() {
            n += 1;
        }
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_parsing() {
        let (w, t) = parse_name(Path::new("New World__1700000000.zip")).unwrap();
        assert_eq!((w.as_str(), t), ("New World", 1_700_000_000));
        assert!(parse_name(Path::new("junk.zip")).is_none());
    }

    #[test]
    fn rejects_traversal_names() {
        assert!(safe_world_name("../evil").is_err());
        assert!(safe_world_name("My World").is_ok());
    }

    #[test]
    fn backup_restore_roundtrip() {
        let _g = crate::paths::test_home_lock();
        let tmp = std::env::temp_dir().join(format!("luminos-bk-{}", std::process::id()));
        std::env::set_var("LUMINOS_HOME", &tmp);
        let inst = Instance {
            id: "t1".into(),
            name: "t".into(),
            mc_version: "1.21.4".into(),
            ..Default::default()
        };
        let w = inst.game_dir().join("saves/Alpha/region");
        fs::create_dir_all(&w).unwrap();
        fs::write(w.join("r.0.0.mca"), b"chunkdata").unwrap();
        let b = backup_world(&inst, "Alpha").unwrap();
        assert_eq!(list_backups(&inst).len(), 1);
        fs::write(w.join("r.0.0.mca"), b"corrupted").unwrap();
        restore(&inst, &b).unwrap();
        assert_eq!(
            fs::read(inst.game_dir().join("saves/Alpha/region/r.0.0.mca")).unwrap(),
            b"chunkdata"
        );
        assert!(
            fs::read_dir(inst.game_dir().join("saves")).unwrap().count() >= 2,
            "old world kept aside"
        );
        let _ = fs::remove_dir_all(&tmp);
    }
}
