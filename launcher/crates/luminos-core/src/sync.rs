//! Launcher-level sync of keybinds, options, HUD layouts, mod configs and the server list across instances and
//! Minecraft versions. The launcher owns one store (`<root>/sync/`); every instance is reconciled against it before
//! launch and after exit.
//!
//! * Whole-file items (`config/luminos-client.json`, `servers.dat`, `config/luminos-profiles/*.json`): three-way
//!   decision using the hash that was last synced for *this* instance, so a change on one side never silently
//!   overwrites a change on the other.
//! * `options.txt`: merged **per key** (all `key_*` bindings plus a short allow-list such as `fov`). Keys a given
//!   Minecraft version does not know are never added to it, and keys it has that the store lacks are pushed.
//! * Conflicts (both sides changed to different values) follow a [`Policy`]; the losing value is always kept under
//!   `<root>/sync/conflicts/` so nothing is lost.
//! * `export` / `import` copy the store to / from any folder (share between PCs, back up, or hand-edit).
use crate::{compat::sha256_bytes, paths, store};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

/// Options (besides every `key_*`) that follow the player between instances.
pub const OPTION_KEYS: &[&str] = &[
    "fov",
    "mouseSensitivity",
    "guiScale",
    "renderDistance",
    "maxFps",
    "gamma",
    "autoJump",
    "toggleCrouch",
    "toggleSprint",
    "chatScale",
    "chatOpacity",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Policy {
    /// The side edited most recently wins (default).
    #[default]
    NewestWins,
    /// The instance's value wins.
    KeepLocal,
    /// The shared store's value wins.
    KeepStore,
}

#[derive(Default, Serialize, Deserialize)]
struct Meta {
    items: BTreeMap<String, ItemMeta>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ItemMeta {
    hash: String,
    ts: i64,
    by: String,
}

/// Per-instance memory of what was last in sync (stored in the instance, `.luminos-sync.json`).
#[derive(Default, Serialize, Deserialize)]
struct Local {
    synced: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Conflict {
    pub item: String,
    /// `"instance"` or `"store"`.
    pub winner: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Report {
    pub pulled: Vec<String>,
    pub pushed: Vec<String>,
    pub conflicts: Vec<Conflict>,
}

impl Report {
    pub fn is_quiet(&self) -> bool {
        self.pulled.is_empty() && self.pushed.is_empty() && self.conflicts.is_empty()
    }
}

pub struct Syncer {
    root: PathBuf,
    policy: Policy,
}

fn mtime(p: &Path) -> i64 {
    fs::metadata(p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn is_synced_key(k: &str) -> bool {
    k.starts_with("key_") || OPTION_KEYS.contains(&k)
}

fn parse_synced(text: &str) -> BTreeMap<String, String> {
    let mut m = BTreeMap::new();
    for line in text.lines() {
        if let Some((k, v)) = line.split_once(':') {
            if is_synced_key(k) {
                m.insert(k.to_string(), v.to_string());
            }
        }
    }
    m
}

impl Syncer {
    /// The real store under the Luminos data directory.
    pub fn new(policy: Policy) -> Self {
        Self::at(paths::root().join("sync"), policy)
    }

    pub fn at(root: impl Into<PathBuf>, policy: Policy) -> Self {
        Self {
            root: root.into(),
            policy,
        }
    }

    fn meta_path(&self) -> PathBuf {
        self.root.join("meta.json")
    }

    fn store_file(&self, id: &str) -> PathBuf {
        self.root.join("store").join(id.replace('/', "__"))
    }

    fn backup(&self, instance: &str, id: &str, bytes: &[u8]) {
        let dir = self.root.join("conflicts");
        let name = format!(
            "{}-{}-{}",
            store::now_unix(),
            paths::slugify(instance),
            id.replace(['/', ':'], "_")
        );
        if fs::create_dir_all(&dir).is_ok() {
            let _ = fs::write(dir.join(name), bytes);
        }
    }

    fn decide(&self, inst_ts: i64, store_ts: i64) -> bool {
        match self.policy {
            Policy::KeepLocal => true,
            Policy::KeepStore => false,
            Policy::NewestWins => inst_ts >= store_ts,
        }
    }

    /// Bring one instance and the store into agreement. Call before launch (pulls) and after exit (pushes).
    pub fn reconcile(&self, instance: &str, game_dir: &Path) -> Result<Report> {
        let mut meta: Meta = store::read_json(&self.meta_path());
        let lpath = game_dir.join(".luminos-sync.json");
        let mut local: Local = store::read_json(&lpath);
        let mut rep = Report::default();
        let now = store::now_unix();

        let mut files: Vec<(String, PathBuf)> = vec![
            (
                "client-config".into(),
                game_dir.join("config").join("luminos-client.json"),
            ),
            ("servers".into(), game_dir.join("servers.dat")),
        ];
        let pdir = game_dir.join("config").join("luminos-profiles");
        let mut names: BTreeSet<String> = meta
            .items
            .keys()
            .filter_map(|k| k.strip_prefix("profile/").map(String::from))
            .collect();
        if let Ok(rd) = fs::read_dir(&pdir) {
            for e in rd.flatten() {
                let n = e.file_name().to_string_lossy().to_string();
                if n.ends_with(".json") {
                    names.insert(n);
                }
            }
        }
        for n in names {
            files.push((format!("profile/{n}"), pdir.join(&n)));
        }
        for (id, path) in &files {
            self.file_item(instance, id, path, &mut meta, &mut local, &mut rep, now)?;
        }
        self.options_item(instance, game_dir, &mut meta, &mut local, &mut rep, now)?;

        store::write_json(&self.meta_path(), &meta)?;
        store::write_json(&lpath, &local)?;
        Ok(rep)
    }

    #[allow(clippy::too_many_arguments)]
    fn file_item(
        &self,
        instance: &str,
        id: &str,
        path: &Path,
        meta: &mut Meta,
        local: &mut Local,
        rep: &mut Report,
        now: i64,
    ) -> Result<()> {
        enum Act {
            Nothing,
            Pull,
            Push,
        }
        let sfile = self.store_file(id);
        let inst = fs::read(path).ok();
        let stored = meta.items.get(id).and_then(|_| fs::read(&sfile).ok());
        let ih = inst.as_deref().map(sha256_bytes);
        let sh = stored.as_deref().map(sha256_bytes);
        let last = local.synced.get(id).cloned();
        let act = match (&ih, &sh) {
            (None, None) => Act::Nothing,
            (Some(_), None) => Act::Push,
            (None, Some(_)) => Act::Pull,
            (Some(a), Some(b)) if a == b => Act::Nothing,
            (Some(a), Some(b)) => {
                if last.as_deref() == Some(a.as_str()) {
                    Act::Pull
                } else if last.as_deref() == Some(b.as_str()) {
                    Act::Push
                } else {
                    let store_ts = meta.items.get(id).map(|m| m.ts).unwrap_or(0);
                    let inst_wins = self.decide(mtime(path), store_ts);
                    let loser = if inst_wins { &stored } else { &inst };
                    if let Some(l) = loser {
                        self.backup(instance, id, l);
                    }
                    rep.conflicts.push(Conflict {
                        item: id.into(),
                        winner: if inst_wins { "instance" } else { "store" }.into(),
                    });
                    if inst_wins {
                        Act::Push
                    } else {
                        Act::Pull
                    }
                }
            }
        };
        match act {
            Act::Nothing => {
                if let Some(h) = ih {
                    local.synced.insert(id.into(), h);
                }
            }
            Act::Push => {
                let (bytes, h) = (inst.unwrap_or_default(), ih.unwrap_or_default());
                if let Some(p) = sfile.parent() {
                    fs::create_dir_all(p)?;
                }
                fs::write(&sfile, &bytes).with_context(|| format!("writing {}", sfile.display()))?;
                meta.items.insert(
                    id.into(),
                    ItemMeta {
                        hash: h.clone(),
                        ts: now,
                        by: instance.into(),
                    },
                );
                local.synced.insert(id.into(), h);
                rep.pushed.push(id.into());
            }
            Act::Pull => {
                let (bytes, h) = (stored.unwrap_or_default(), sh.unwrap_or_default());
                if let Some(p) = path.parent() {
                    fs::create_dir_all(p)?;
                }
                fs::write(path, &bytes).with_context(|| format!("writing {}", path.display()))?;
                local.synced.insert(id.into(), h);
                rep.pulled.push(id.into());
            }
        }
        Ok(())
    }

    fn options_item(
        &self,
        instance: &str,
        game_dir: &Path,
        meta: &mut Meta,
        local: &mut Local,
        rep: &mut Report,
        now: i64,
    ) -> Result<()> {
        let opath = game_dir.join("options.txt");
        let sfile = self.store_file("options");
        let mut smap: BTreeMap<String, String> = store::read_json(&sfile);
        let text = fs::read_to_string(&opath).ok();
        let store_ts = meta.items.get("options").map(|m| m.ts).unwrap_or(0);
        let Some(text) = text else {
            // Fresh instance: seed it with everything the player has set so far.
            if !smap.is_empty() {
                let body: String = smap.iter().map(|(k, v)| format!("{k}:{v}\n")).collect();
                fs::create_dir_all(game_dir)?;
                fs::write(&opath, body)?;
                for (k, v) in &smap {
                    local.synced.insert(format!("options:{k}"), v.clone());
                }
                rep.pulled.push("options".into());
            }
            return Ok(());
        };
        let imap = parse_synced(&text);
        let inst_ts = mtime(&opath);
        let mut pulls: BTreeMap<String, String> = BTreeMap::new();
        let mut changed_store = false;
        let (mut pushed_any, mut pulled_any) = (false, false);
        for (k, iv) in &imap {
            let lk = format!("options:{k}");
            let last = local.synced.get(&lk).cloned();
            match smap.get(k) {
                None => {
                    smap.insert(k.clone(), iv.clone());
                    changed_store = true;
                    pushed_any = true;
                    local.synced.insert(lk, iv.clone());
                }
                Some(sv) if sv == iv => {
                    local.synced.insert(lk, iv.clone());
                }
                Some(sv) => {
                    if last.as_deref() == Some(iv.as_str()) {
                        pulls.insert(k.clone(), sv.clone());
                        local.synced.insert(lk, sv.clone());
                        pulled_any = true;
                    } else if last.as_deref() == Some(sv.as_str()) {
                        smap.insert(k.clone(), iv.clone());
                        changed_store = true;
                        pushed_any = true;
                        local.synced.insert(lk, iv.clone());
                    } else {
                        let inst_wins = self.decide(inst_ts, store_ts);
                        let loser = if inst_wins { sv } else { iv };
                        self.backup(instance, &format!("options:{k}"), format!("{k}:{loser}\n").as_bytes());
                        rep.conflicts.push(Conflict {
                            item: format!("options:{k}"),
                            winner: if inst_wins { "instance" } else { "store" }.into(),
                        });
                        if inst_wins {
                            smap.insert(k.clone(), iv.clone());
                            changed_store = true;
                            local.synced.insert(lk, iv.clone());
                        } else {
                            pulls.insert(k.clone(), sv.clone());
                            local.synced.insert(lk, sv.clone());
                        }
                    }
                }
            }
        }
        if !pulls.is_empty() {
            let mut out = String::with_capacity(text.len());
            for line in text.lines() {
                match line.split_once(':').and_then(|(k, _)| pulls.get(k).map(|v| (k, v))) {
                    Some((k, v)) => out.push_str(&format!("{k}:{v}\n")),
                    None => {
                        out.push_str(line);
                        out.push('\n');
                    }
                }
            }
            fs::write(&opath, out)?;
        }
        if changed_store {
            store::write_json(&sfile, &smap)?;
            meta.items.insert(
                "options".into(),
                ItemMeta {
                    hash: sha256_bytes(serde_json::to_string(&smap)?.as_bytes()),
                    ts: now,
                    by: instance.into(),
                },
            );
        }
        if pushed_any {
            rep.pushed.push("options".into());
        }
        if pulled_any || !pulls.is_empty() {
            rep.pulled.push("options".into());
        }
        Ok(())
    }

    /// Copy the whole store (and its index) to `dest` so it can be moved to another PC.
    pub fn export(&self, dest: &Path) -> Result<usize> {
        fs::create_dir_all(dest.join("store"))?;
        let mut n = 0;
        if self.meta_path().exists() {
            fs::copy(self.meta_path(), dest.join("meta.json"))?;
        }
        if let Ok(rd) = fs::read_dir(self.root.join("store")) {
            for e in rd.flatten() {
                fs::copy(e.path(), dest.join("store").join(e.file_name()))?;
                n += 1;
            }
        }
        Ok(n)
    }

    /// Merge an exported store into this one: files the store does not have are added; existing items keep the newer side.
    pub fn import(&self, src: &Path) -> Result<usize> {
        let theirs: Meta = store::read_json(&src.join("meta.json"));
        let mut mine: Meta = store::read_json(&self.meta_path());
        let mut n = 0;
        for (id, tm) in theirs.items {
            let newer = mine.items.get(&id).map(|m| tm.ts > m.ts).unwrap_or(true);
            if !newer {
                continue;
            }
            let from = src.join("store").join(id.replace('/', "__"));
            let bytes = fs::read(&from).with_context(|| format!("reading {}", from.display()))?;
            let to = self.store_file(&id);
            if let Some(p) = to.parent() {
                fs::create_dir_all(p)?;
            }
            fs::write(&to, bytes)?;
            mine.items.insert(id, tm);
            n += 1;
        }
        store::write_json(&self.meta_path(), &mine)?;
        Ok(n)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("luminos-sync-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn write(p: &Path, s: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, s).unwrap();
    }

    #[test]
    fn keybinds_hud_and_servers_follow_the_player_across_instances() {
        let root = tmp("share");
        let (a, b) = (root.join("a"), root.join("b"));
        write(
            &a.join("options.txt"),
            "version:4189\nkey_key.attack:key.mouse.left\nkey_key.luminos.panel:key.keyboard.right.control\nfov:90.0\nrenderDistance:12\n",
        );
        write(&a.join("config/luminos-client.json"), "{\"snap\":true}");
        write(&a.join("servers.dat"), "SERVERS-A");
        let s = Syncer::at(root.join("sync"), Policy::NewestWins);
        let r = s.reconcile("A", &a).unwrap();
        assert!(r.pushed.contains(&"options".to_string()) && r.pushed.contains(&"client-config".to_string()));

        // B is a different Minecraft version: it has its own, unrelated keys and a different binding for the panel.
        write(&b.join("options.txt"), "version:3955\nkey_key.attack:key.mouse.left\nkey_key.luminos.panel:key.keyboard.right.shift\nkey_key.only_in_b:key.keyboard.j\nfov:70.0\n");
        let s2 = Syncer::at(root.join("sync"), Policy::KeepStore);
        let r = s2.reconcile("B", &b).unwrap();
        let opts = fs::read_to_string(b.join("options.txt")).unwrap();
        assert!(opts.contains("key_key.luminos.panel:key.keyboard.right.control"), "store value wins: {opts}");
        assert!(opts.contains("fov:90.0"));
        assert!(opts.contains("version:3955"), "unsynced lines are untouched");
        assert!(!opts.contains("renderDistance"), "keys B never had are not invented");
        assert!(opts.contains("key_key.only_in_b:key.keyboard.j"));
        assert_eq!(fs::read_to_string(b.join("config/luminos-client.json")).unwrap(), "{\"snap\":true}");
        assert_eq!(fs::read_to_string(b.join("servers.dat")).unwrap(), "SERVERS-A");
        assert!(r.conflicts.iter().any(|c| c.item == "options:key_key.luminos.panel" && c.winner == "store"));
        // the losing value is recoverable
        let kept: Vec<_> = fs::read_dir(root.join("sync/conflicts")).unwrap().flatten().collect();
        assert!(!kept.is_empty());
        assert!(fs::read_to_string(kept[0].path()).unwrap().contains("right.shift"));

        // key only B has flows back to the store, then to a third instance that knows it
        s2.reconcile("B", &b).unwrap();
        let c = root.join("c");
        write(&c.join("options.txt"), "key_key.only_in_b:key.keyboard.k\n");
        // C already has its own, different binding and no sync history: a genuine conflict. KeepStore makes B's win.
        let s3 = Syncer::at(root.join("sync"), Policy::KeepStore);
        let r = s3.reconcile("C", &c).unwrap();
        assert!(r.conflicts.iter().any(|x| x.item == "options:key_key.only_in_b" && x.winner == "store"), "{r:?}");
        assert!(fs::read_to_string(c.join("options.txt")).unwrap().contains("key.keyboard.j"), "{r:?}");
    }

    #[test]
    fn second_run_is_quiet_and_one_sided_edits_propagate_without_conflict() {
        let root = tmp("quiet");
        let (a, b) = (root.join("a"), root.join("b"));
        write(&a.join("options.txt"), "fov:80.0\nkey_key.jump:key.keyboard.space\n");
        write(&a.join("config/luminos-client.json"), "v1");
        let s = Syncer::at(root.join("sync"), Policy::NewestWins);
        s.reconcile("A", &a).unwrap();
        s.reconcile("B", &b).unwrap(); // fresh: seeded
        assert_eq!(fs::read_to_string(b.join("options.txt")).unwrap().lines().count(), 2);
        assert!(s.reconcile("A", &a).unwrap().is_quiet());
        assert!(s.reconcile("B", &b).unwrap().is_quiet());
        // B edits; A picks it up on its next launch, no conflict
        write(&b.join("config/luminos-client.json"), "v2");
        write(&b.join("options.txt"), "fov:100.0\nkey_key.jump:key.keyboard.space\n");
        let rb = s.reconcile("B", &b).unwrap();
        assert!(rb.conflicts.is_empty() && rb.pushed.contains(&"client-config".to_string()));
        let ra = s.reconcile("A", &a).unwrap();
        assert!(ra.conflicts.is_empty(), "{ra:?}");
        assert_eq!(fs::read_to_string(a.join("config/luminos-client.json")).unwrap(), "v2");
        assert!(fs::read_to_string(a.join("options.txt")).unwrap().contains("fov:100.0"));
    }

    #[test]
    fn both_sides_edited_follows_policy_and_keeps_the_loser() {
        let root = tmp("conflict");
        let (a, b) = (root.join("a"), root.join("b"));
        write(&a.join("config/luminos-client.json"), "base");
        let s = Syncer::at(root.join("sync"), Policy::KeepLocal);
        s.reconcile("A", &a).unwrap();
        s.reconcile("B", &b).unwrap();
        write(&a.join("config/luminos-client.json"), "from-a");
        write(&b.join("config/luminos-client.json"), "from-b");
        s.reconcile("A", &a).unwrap(); // pushes from-a
        let r = s.reconcile("B", &b).unwrap(); // B changed too: KeepLocal => B wins
        assert_eq!(r.conflicts, vec![Conflict { item: "client-config".into(), winner: "instance".into() }]);
        assert_eq!(fs::read_to_string(b.join("config/luminos-client.json")).unwrap(), "from-b");
        let lost = fs::read_dir(root.join("sync/conflicts")).unwrap().flatten().next().unwrap();
        assert_eq!(fs::read_to_string(lost.path()).unwrap(), "from-a");
    }

    #[test]
    fn export_then_import_moves_the_store_to_another_machine() {
        let root = tmp("export");
        let a = root.join("a");
        write(&a.join("options.txt"), "key_key.attack:key.mouse.left\nfov:75.0\n");
        write(&a.join("config/luminos-profiles/pvp.json"), "{}");
        let s = Syncer::at(root.join("one/sync"), Policy::NewestWins);
        s.reconcile("A", &a).unwrap();
        let out = root.join("bundle");
        assert!(s.export(&out).unwrap() >= 2);
        let other = Syncer::at(root.join("two/sync"), Policy::NewestWins);
        assert!(other.import(&out).unwrap() >= 2);
        let fresh = root.join("fresh");
        let r = other.reconcile("Fresh", &fresh).unwrap();
        assert!(r.pulled.contains(&"options".to_string()) && r.pulled.contains(&"profile/pvp.json".to_string()), "{r:?}");
        assert!(fs::read_to_string(fresh.join("options.txt")).unwrap().contains("fov:75.0"));
    }
}
