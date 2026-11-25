//! Cross-instance sharing of options, keybinds, saves and configs, with an explicit conflict step.
//!
//! Unlike Pandora (newest file silently wins), nothing here is overwritten without a choice: [`scan`] lists every item on which
//! two instances disagree, [`resolve`] applies the player's choice, and whatever loses is copied to `<backup_root>` first.
//! Options keys follow `sync.rs`'s allow-list; whole-file configs are compared by hash; saves by their `level.dat`.
use crate::{compat::sha256_bytes, sync::OPTION_KEYS};
use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

#[derive(Clone, Debug)]
pub struct InstanceRef {
    pub id: String,
    pub name: String,
    pub game_dir: PathBuf,
}

#[derive(Clone, Copy, Debug)]
pub struct Targets {
    pub options: bool,
    pub keybinds: bool,
    pub saves: bool,
    pub configs: bool,
}

impl Default for Targets {
    fn default() -> Self {
        Targets { options: true, keybinds: true, saves: false, configs: true } // saves are opt-in
    }
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct Side {
    pub instance: String,
    pub name: String,
    pub value: String,
    pub modified: i64,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct Disagreement {
    /// `options:<key>`, `save:<folder>` or `config:<file>`
    pub item: String,
    pub kind: String,
    pub sides: Vec<Side>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Choice {
    /// Make every instance match this instance's version.
    Use(String),
    /// Saves only: every instance gets the others' versions as extra copies named `<world> (<instance>)`.
    KeepBoth,
}

fn mtime(p: &Path) -> i64 {
    fs::metadata(p).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_secs() as i64).unwrap_or(0)
}

fn read_options(p: &Path) -> BTreeMap<String, String> {
    let mut m = BTreeMap::new();
    for line in fs::read_to_string(p).unwrap_or_default().lines() {
        if let Some((k, v)) = line.split_once(':') {
            m.insert(k.to_string(), v.to_string());
        }
    }
    m
}

fn wanted_key(k: &str, t: &Targets) -> bool {
    (t.keybinds && k.starts_with("key_")) || (t.options && OPTION_KEYS.contains(&k))
}

fn dir_size(p: &Path) -> u64 {
    fs::read_dir(p)
        .map(|rd| rd.flatten().map(|e| match e.metadata() { Ok(m) if m.is_dir() => dir_size(&e.path()), Ok(m) => m.len(), _ => 0 }).sum())
        .unwrap_or(0)
}

fn copy_dir(from: &Path, to: &Path) -> Result<()> {
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)?.flatten() {
        let (src, dst) = (e.path(), to.join(e.file_name()));
        if e.metadata()?.is_dir() {
            copy_dir(&src, &dst)?;
        } else {
            fs::copy(&src, &dst).with_context(|| format!("copy {}", src.display()))?;
        }
    }
    Ok(())
}

pub fn scan(insts: &[InstanceRef], t: &Targets) -> Vec<Disagreement> {
    let mut out = vec![];
    let mut keys: BTreeMap<String, Vec<Side>> = BTreeMap::new();
    for i in insts {
        let p = i.game_dir.join("options.txt");
        let ts = mtime(&p);
        for (k, v) in read_options(&p).into_iter().filter(|(k, _)| wanted_key(k, t)) {
            keys.entry(k).or_default().push(Side { instance: i.id.clone(), name: i.name.clone(), value: v, modified: ts });
        }
    }
    for (k, sides) in keys {
        if sides.len() > 1 && sides.iter().any(|s| s.value != sides[0].value) {
            let kind = if k.starts_with("key_") { "keybind" } else { "options" };
            out.push(Disagreement { item: format!("options:{k}"), kind: kind.into(), sides });
        }
    }
    if t.configs {
        let mut files: BTreeMap<String, Vec<(Side, String)>> = BTreeMap::new();
        for i in insts {
            let Ok(rd) = fs::read_dir(i.game_dir.join("config")) else { continue };
            for e in rd.flatten() {
                let n = e.file_name().to_string_lossy().to_string();
                let ok_ext = [".json", ".toml", ".properties", ".json5"].iter().any(|x| n.ends_with(x));
                if !ok_ext || !e.path().is_file() {
                    continue;
                }
                let Ok(b) = fs::read(e.path()) else { continue };
                let side = Side { instance: i.id.clone(), name: i.name.clone(), value: format!("{} bytes", b.len()), modified: mtime(&e.path()) };
                files.entry(n).or_default().push((side, sha256_bytes(&b)));
            }
        }
        for (n, v) in files {
            if v.len() > 1 && v.iter().any(|(_, h)| *h != v[0].1) {
                out.push(Disagreement { item: format!("config:{n}"), kind: "config".into(), sides: v.into_iter().map(|(s, _)| s).collect() });
            }
        }
    }
    if t.saves {
        let mut worlds: BTreeMap<String, Vec<(Side, String)>> = BTreeMap::new();
        for i in insts {
            let Ok(rd) = fs::read_dir(i.game_dir.join("saves")) else { continue };
            for e in rd.flatten() {
                let lv = e.path().join("level.dat");
                let Ok(b) = fs::read(&lv) else { continue };
                let n = e.file_name().to_string_lossy().to_string();
                let value = format!("{} MB, last played {}", dir_size(&e.path()) / 1_000_000, mtime(&lv));
                worlds.entry(n).or_default().push((Side { instance: i.id.clone(), name: i.name.clone(), value, modified: mtime(&lv) }, sha256_bytes(&b)));
            }
        }
        for (n, v) in worlds {
            if v.len() > 1 && v.iter().any(|(_, h)| *h != v[0].1) {
                out.push(Disagreement { item: format!("save:{n}"), kind: "save".into(), sides: v.into_iter().map(|(s, _)| s).collect() });
            }
        }
    }
    out
}

fn stash(backup_root: &Path, label: &str, p: &Path) -> Result<()> {
    if !p.exists() {
        return Ok(());
    }
    let dest = backup_root.join(format!("{}-{}", crate::store::now_unix(), label.replace(['/', ':', ' ', '\\'], "_")));
    fs::create_dir_all(backup_root)?;
    if p.is_dir() {
        copy_dir(p, &dest)
    } else {
        fs::copy(p, &dest).map(|_| ()).map_err(Into::into)
    }
}

/// Apply one choice for one `item` from [`scan`]. Returns the ids of the instances that were changed.
pub fn resolve(insts: &[InstanceRef], item: &str, choice: &Choice, backup_root: &Path) -> Result<Vec<String>> {
    let (kind, name) = item.split_once(':').context("bad item id")?;
    if name.contains(['/', '\\']) || name.contains("..") {
        bail!("bad item name");
    }
    let by_id = |id: &str| insts.iter().find(|i| i.id == id).with_context(|| format!("unknown instance {id}"));
    let mut changed = vec![];
    match (kind, choice) {
        ("options", Choice::Use(id)) => {
            let win = by_id(id)?;
            let val = read_options(&win.game_dir.join("options.txt")).get(name).cloned().context("that instance has no such option")?;
            for i in insts.iter().filter(|i| i.id != win.id) {
                let p = i.game_dir.join("options.txt");
                if read_options(&p).get(name).is_some_and(|v| *v != val) {
                    stash(backup_root, &format!("{}-options.txt", i.id), &p)?;
                    let text = fs::read_to_string(&p)?;
                    let mut lines: Vec<String> = text.lines().map(String::from).collect();
                    for l in lines.iter_mut() {
                        if l.split_once(':').is_some_and(|(k, _)| k == name) {
                            *l = format!("{name}:{val}");
                        }
                    }
                    fs::write(&p, lines.join("\n") + "\n")?;
                    changed.push(i.id.clone());
                }
            }
        }
        ("config", Choice::Use(id)) => {
            let src = by_id(id)?.game_dir.join("config").join(name);
            for i in insts.iter().filter(|i| i.id != *id) {
                let dst = i.game_dir.join("config").join(name);
                if dst.is_file() && fs::read(&dst)? != fs::read(&src)? {
                    stash(backup_root, &format!("{}-{name}", i.id), &dst)?;
                    fs::copy(&src, &dst)?;
                    changed.push(i.id.clone());
                }
            }
        }
        ("save", Choice::Use(id)) => {
            let src = by_id(id)?.game_dir.join("saves").join(name);
            for i in insts.iter().filter(|i| i.id != *id) {
                let dst = i.game_dir.join("saves").join(name);
                if dst.join("level.dat").is_file() && fs::read(dst.join("level.dat"))? != fs::read(src.join("level.dat"))? {
                    stash(backup_root, &format!("{}-save-{name}", i.id), &dst)?;
                    fs::remove_dir_all(&dst)?;
                    copy_dir(&src, &dst)?;
                    changed.push(i.id.clone());
                }
            }
        }
        ("save", Choice::KeepBoth) => {
            for a in insts {
                for b in insts.iter().filter(|b| b.id != a.id) {
                    let src = b.game_dir.join("saves").join(name);
                    let dst = a.game_dir.join("saves").join(format!("{name} ({})", b.name.replace(['/', '\\'], "_")));
                    let has_both = src.join("level.dat").is_file() && a.game_dir.join("saves").join(name).join("level.dat").is_file();
                    if has_both && !dst.exists() {
                        copy_dir(&src, &dst)?;
                        if !changed.contains(&a.id) {
                            changed.push(a.id.clone());
                        }
                    }
                }
            }
        }
        _ => bail!("that choice does not apply to {kind}"),
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn world(n: &str) -> Vec<InstanceRef> {
        let root = std::env::temp_dir().join(format!("lum-shares-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        ["a", "b"]
            .iter()
            .map(|id| {
                let g = root.join(id);
                fs::create_dir_all(g.join("config")).unwrap();
                fs::create_dir_all(g.join("saves/Home")).unwrap();
                InstanceRef { id: (*id).into(), name: format!("Inst {id}"), game_dir: g }
            })
            .collect()
    }

    #[test]
    fn options_disagreement_is_found_and_resolved_with_a_backup() {
        let i = world("opt");
        fs::write(i[0].game_dir.join("options.txt"), "fov:70.0\nkey_key.jump:key.keyboard.space\nlang:en_us\n").unwrap();
        fs::write(i[1].game_dir.join("options.txt"), "fov:90.0\nkey_key.jump:key.keyboard.space\nlang:es_es\n").unwrap();
        let d = scan(&i, &Targets::default());
        assert_eq!(d.len(), 1, "only fov differs; lang is not a shared option; jump agrees");
        assert_eq!(d[0].item, "options:fov");
        let bk = i[0].game_dir.join("../backup");
        assert_eq!(resolve(&i, "options:fov", &Choice::Use("a".into()), &bk).unwrap(), vec!["b"]);
        let b = fs::read_to_string(i[1].game_dir.join("options.txt")).unwrap();
        assert!(b.contains("fov:70.0") && b.contains("lang:es_es"), "other lines untouched");
        assert_eq!(fs::read_dir(&bk).unwrap().count(), 1, "the loser was backed up first");
        assert!(scan(&i, &Targets::default()).is_empty());
    }

    #[test]
    fn saves_are_opt_in_and_keep_both_copies_each_version() {
        let i = world("save");
        fs::write(i[0].game_dir.join("saves/Home/level.dat"), b"one").unwrap();
        fs::write(i[1].game_dir.join("saves/Home/level.dat"), b"two").unwrap();
        assert!(scan(&i, &Targets::default()).is_empty(), "saves off by default");
        let d = scan(&i, &Targets { saves: true, ..Default::default() });
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].item, "save:Home");
        resolve(&i, "save:Home", &Choice::KeepBoth, &i[0].game_dir.join("../bk")).unwrap();
        assert!(i[0].game_dir.join("saves/Home (Inst b)/level.dat").is_file());
        assert!(i[1].game_dir.join("saves/Home (Inst a)/level.dat").is_file());
        assert_eq!(fs::read(i[0].game_dir.join("saves/Home/level.dat")).unwrap(), b"one", "originals untouched");
    }

    #[test]
    fn configs_use_one_side_and_hostile_names_are_refused() {
        let i = world("cfg");
        fs::write(i[0].game_dir.join("config/x.json"), b"{\"a\":1}").unwrap();
        fs::write(i[1].game_dir.join("config/x.json"), b"{\"a\":2}").unwrap();
        assert_eq!(scan(&i, &Targets::default())[0].item, "config:x.json");
        resolve(&i, "config:x.json", &Choice::Use("b".into()), &i[0].game_dir.join("../bk")).unwrap();
        assert_eq!(fs::read(i[0].game_dir.join("config/x.json")).unwrap(), b"{\"a\":2}");
        assert!(resolve(&i, "config:../../etc/passwd", &Choice::Use("a".into()), &i[0].game_dir).is_err());
        assert!(resolve(&i, "options:fov", &Choice::KeepBoth, &i[0].game_dir).is_err());
    }
}
