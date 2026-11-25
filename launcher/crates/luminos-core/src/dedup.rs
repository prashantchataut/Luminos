//! Mod and resource deduplication: one copy of each jar on disk, hard-linked into every instance that uses it.
//!
//! * Content-addressed store: `<store>/<first 2 hex>/<sha256>.jar`. The first copy seen becomes a second *name* for the
//!   same data (a hard link), so nothing is copied and nothing is lost if linking fails.
//! * A ledger (`<store>/ledger.json`) records which instance files were replaced and how many bytes that saved, so the
//!   "saved N" figure shown in the UI is measured, not guessed, and survives restarts.
//! * Order of attempts (same as Pandora's `fastcopy`): **reflink** (ReFS / Dev Drive block cloning on Windows, Btrfs / XFS on
//!   Linux, APFS on macOS; independent files that share blocks), then **hard link** (NTFS and every Unix file system, one
//!   volume only), else the file is left alone and counted. Reflink success is **UNVERIFIED on ReFS** (no Windows here); the
//!   fallback to hard links is tested.
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq, Eq)]
pub struct Ledger {
    /// instance file path -> (sha256, size) at the time it was linked
    pub linked: BTreeMap<String, (String, u64)>,
}

#[derive(Serialize, Default, Clone, Debug, PartialEq, Eq)]
pub struct Report {
    pub scanned: usize,
    pub newly_linked: usize,
    pub skipped_other_volume: usize,
    pub reflinked: usize,
    pub hardlinked: usize,
    pub bytes_saved_now: u64,
    /// Total saved by every link still in place (from the ledger).
    pub bytes_saved_total: u64,
    pub instances_counted: usize,
}

fn is_content(p: &Path) -> bool {
    let n = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    n.ends_with(".jar") || n.ends_with(".jar.disabled") || n.ends_with(".zip")
}

pub fn sha256_file(p: &Path) -> Result<String> {
    let mut f = fs::File::open(p).with_context(|| format!("open {}", p.display()))?;
    let (mut h, mut buf) = (Sha256::new(), vec![0u8; 1 << 16]);
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Method {
    Reflink,
    HardLink,
}

/// Make `dst` (which must not exist) share `src`'s data: reflink first, hard link second. `None` = neither is possible here.
pub fn link_or_clone(src: &Path, dst: &Path) -> Option<Method> {
    if std::env::var_os("LUMINOS_NO_REFLINK").is_none() && reflink_copy::reflink(src, dst).is_ok() {
        return Some(Method::Reflink);
    }
    let _ = fs::remove_file(dst); // a failed reflink can leave an empty file behind
    fs::hard_link(src, dst).ok().map(|_| Method::HardLink)
}

/// Bytes saved attributed to each directory (same order as `dirs`): every ledger entry after the first one for its hash is
/// a copy that costs nothing. Summing the result equals `Report::bytes_saved_total`.
pub fn saved_per_dir(store: &Path, dirs: &[PathBuf]) -> Vec<u64> {
    let ledger = load(store);
    let mut seen: BTreeMap<&str, ()> = BTreeMap::new();
    let mut out = vec![0u64; dirs.len()];
    for (k, (h, s)) in &ledger.linked {
        if seen.insert(h.as_str(), ()).is_none() {
            continue; // the first name pays for the bytes
        }
        if !fs::metadata(k).map(|m| m.len() == *s).unwrap_or(false) {
            continue;
        }
        if let Some(i) = dirs.iter().position(|d| Path::new(k).starts_with(d)) {
            out[i] += s;
        }
    }
    out
}

fn store_path(store: &Path, hash: &str) -> PathBuf {
    store.join(&hash[..2]).join(format!("{hash}.jar"))
}

fn load(store: &Path) -> Ledger {
    fs::read_to_string(store.join("ledger.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(store: &Path, l: &Ledger) -> Result<()> {
    fs::create_dir_all(store)?;
    let tmp = store.join("ledger.json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(l)?)?;
    fs::rename(tmp, store.join("ledger.json"))?;
    Ok(())
}

/// Link duplicate content in `dirs` (one `mods`/`resourcepacks`/... folder per instance) through `store`.
pub fn dedup(dirs: &[PathBuf], store: &Path) -> Result<Report> {
    let mut ledger = load(store);
    let mut rep = Report {
        instances_counted: dirs.len(),
        ..Default::default()
    };
    for dir in dirs {
        let Ok(rd) = fs::read_dir(dir) else { continue };
        for e in rd.flatten() {
            let path = e.path();
            if !path.is_file() || !is_content(&path) {
                continue;
            }
            rep.scanned += 1;
            let size = e.metadata()?.len();
            if size == 0 {
                continue;
            }
            let key = path.to_string_lossy().to_string();
            let hash = sha256_file(&path)?;
            if ledger
                .linked
                .get(&key)
                .is_some_and(|(h, s)| *h == hash && *s == size)
            {
                continue; // already linked and unchanged
            }
            let sp = store_path(store, &hash);
            fs::create_dir_all(sp.parent().context("store parent")?)?;
            if !sp.exists() {
                // First sighting: the store gets a second name for this file's data. Zero bytes copied.
                if link_or_clone(&path, &sp).is_none() {
                    rep.skipped_other_volume += 1;
                    continue;
                }
                ledger.linked.insert(key, (hash, size));
                continue; // this file *is* the store copy, nothing saved yet
            }
            // Replace this file with a link to the store copy: link to a temp name, then rename over (never a gap with no file).
            let tmp = path.with_extension("luminos-dedup-tmp");
            let _ = fs::remove_file(&tmp);
            let Some(method) = link_or_clone(&sp, &tmp) else {
                rep.skipped_other_volume += 1;
                continue;
            };
            if let Err(e) = fs::rename(&tmp, &path) {
                let _ = fs::remove_file(&tmp);
                return Err(e).with_context(|| format!("replace {}", path.display()));
            }
            ledger.linked.insert(key, (hash, size));
            match method {
                Method::Reflink => rep.reflinked += 1,
                Method::HardLink => rep.hardlinked += 1,
            }
            rep.newly_linked += 1;
            rep.bytes_saved_now += size;
        }
    }
    // Drop entries whose file is gone or changed; what is left is what is really saved. The store copy is the one name that
    // costs bytes, so each distinct hash counts once: saved = sum(size) - sum(size of one copy per hash).
    ledger
        .linked
        .retain(|k, (_, s)| fs::metadata(k).map(|m| m.len() == *s).unwrap_or(false));
    let mut per_hash: BTreeMap<&str, (u64, u64)> = BTreeMap::new();
    for (h, s) in ledger.linked.values() {
        let e = per_hash.entry(h.as_str()).or_insert((0, *s));
        e.0 += 1;
    }
    rep.bytes_saved_total = per_hash
        .values()
        .map(|(n, s)| n.saturating_sub(1) * s)
        .sum();
    save(store, &ledger)?;
    Ok(rep)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("luminos-dedup-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }
    #[test]
    fn same_jar_in_three_instances_is_stored_once() {
        let root = tmp("three");
        let mut dirs = vec![];
        for i in 0..3 {
            let d = root.join(format!("inst{i}/mods"));
            fs::create_dir_all(&d).unwrap();
            fs::write(d.join("sodium.jar"), vec![7u8; 100_000]).unwrap();
            fs::write(d.join(format!("only{i}.jar")), vec![i as u8; 5_000]).unwrap();
            dirs.push(d);
        }
        let store = root.join("store");
        let r = dedup(&dirs, &store).unwrap();
        assert_eq!(r.scanned, 6);
        assert_eq!(
            r.newly_linked, 2,
            "two of the three sodium copies become links"
        );
        assert_eq!(r.bytes_saved_total, 200_000);
        for d in &dirs {
            assert_eq!(
                fs::read(d.join("sodium.jar")).unwrap(),
                vec![7u8; 100_000],
                "content intact"
            );
        }
        // idempotent: second run changes nothing and reports the same total
        let r2 = dedup(&dirs, &store).unwrap();
        assert_eq!((r2.newly_linked, r2.bytes_saved_total), (0, 200_000));
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            assert_eq!(
                fs::metadata(dirs[0].join("sodium.jar")).unwrap().ino(),
                fs::metadata(dirs[2].join("sodium.jar")).unwrap().ino()
            );
        }
        let _ = fs::remove_dir_all(&root);
    }
    #[test]
    fn deleting_a_linked_copy_lowers_the_saving_and_other_copies_survive() {
        let root = tmp("del");
        let dirs: Vec<_> = (0..2)
            .map(|i| {
                let d = root.join(format!("i{i}"));
                fs::create_dir_all(&d).unwrap();
                fs::write(d.join("a.jar"), vec![1u8; 1000]).unwrap();
                d
            })
            .collect();
        let store = root.join("store");
        assert_eq!(dedup(&dirs, &store).unwrap().bytes_saved_total, 1000);
        fs::remove_file(dirs[0].join("a.jar")).unwrap();
        let r = dedup(&dirs, &store).unwrap();
        assert_eq!(r.bytes_saved_total, 0);
        assert_eq!(fs::read(dirs[1].join("a.jar")).unwrap().len(), 1000);
        let _ = fs::remove_dir_all(&root);
    }
    #[test]
    fn different_content_is_never_merged_and_empty_dirs_are_fine() {
        let root = tmp("diff");
        let d = root.join("m");
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("a.jar"), b"aaaa").unwrap();
        fs::write(d.join("b.jar"), b"bbbb").unwrap();
        let r = dedup(&[d.clone(), root.join("missing")], &root.join("store")).unwrap();
        assert_eq!((r.newly_linked, r.bytes_saved_total), (0, 0));
        assert_eq!(fs::read(d.join("b.jar")).unwrap(), b"bbbb");
        let _ = fs::remove_dir_all(&root);
    }
}
