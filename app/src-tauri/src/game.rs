//! Game process tracking (status, exit detection, stop), real worlds/servers from disk, and the in-game client install.
//! Everything here reports what is really on the PC: no sample data.
use luminos_core::{
    instances::{self, Instance, Loader},
    preset, worlds,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    process::Child,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{blocking, err, launch_watch, R};

/// The one running (or starting) Minecraft process. `status` is "idle" | "preparing" | "running".
pub struct GameProcessState {
    pub child: Arc<Mutex<Option<Arc<Mutex<Child>>>>>,
    pub status: Arc<Mutex<String>>,
    pub pid: Arc<Mutex<Option<u32>>>,
    pub instance: Mutex<Option<String>>,
    /// Bumped by every launch and every stop, so a launch that was stopped while preparing never spawns.
    pub generation: AtomicU64,
}

impl Default for GameProcessState {
    fn default() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new("idle".into())),
            pid: Arc::new(Mutex::new(None)),
            instance: Mutex::new(None),
            generation: AtomicU64::new(0),
        }
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct GameStatusPayload {
    pub status: String,
    pub pid: Option<u32>,
    pub instance: Option<String>,
}

impl GameProcessState {
    pub fn snapshot(&self) -> GameStatusPayload {
        GameStatusPayload {
            status: self.status.lock().map(|s| s.clone()).unwrap_or_else(|_| "idle".into()),
            pid: self.pid.lock().ok().and_then(|p| *p),
            instance: self.instance.lock().ok().and_then(|i| i.clone()),
        }
    }

    /// Claim the single game slot. Fails when Minecraft is already starting or running.
    pub fn begin(&self, instance: &str) -> R<u64> {
        let mut s = self.status.lock().map_err(err)?;
        if *s != "idle" {
            return Err("Minecraft is already running. Use Stop Game first.".into());
        }
        *s = "preparing".into();
        if let Ok(mut i) = self.instance.lock() {
            *i = Some(instance.to_string());
        }
        Ok(self.generation.fetch_add(1, Ordering::SeqCst) + 1)
    }

    pub fn is_current(&self, gen: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == gen
    }

    /// Remember the spawned child (so Cancel / Stop Game can kill it) WITHOUT claiming the game is running yet:
    /// the window only flips to "running" once Minecraft has really opened its window (`mark_running`).
    pub fn attach_child(&self, child: Arc<Mutex<Child>>, gen: u64) -> bool {
        if !self.is_current(gen) {
            return false;
        }
        let pid = child.lock().map(|c| c.id()).ok();
        if let Ok(mut c) = self.child.lock() {
            *c = Some(child);
        }
        if let Ok(mut p) = self.pid.lock() {
            *p = pid;
        }
        true
    }

    /// Minecraft's window is open. Only the launch that still owns the slot may say so.
    pub fn mark_running(&self, gen: u64) -> bool {
        if !self.is_current(gen) {
            return false;
        }
        if let Ok(mut s) = self.status.lock() {
            *s = "running".into();
        }
        true
    }

    fn clear(&self) {
        if let Ok(mut c) = self.child.lock() {
            *c = None;
        }
        if let Ok(mut p) = self.pid.lock() {
            *p = None;
        }
        if let Ok(mut s) = self.status.lock() {
            *s = "idle".into();
        }
        if let Ok(mut i) = self.instance.lock() {
            *i = None;
        }
    }
}

/// Back to idle (only for the launch that still owns the slot) and tell the window straight away.
pub fn finish(app: &AppHandle, gen: u64, code: Option<i32>) {
    let st = app.state::<GameProcessState>();
    if st.is_current(gen) {
        st.clear();
        let _ = app.emit("game-state", json!({ "status": "idle", "exitCode": code }));
    }
}

/// The game died before its window opened (or a launch step failed): back to idle, and tell the window WHY with the real log.
pub fn finish_crashed(app: &AppHandle, gen: u64, code: Option<i32>, error_log: String) {
    let st = app.state::<GameProcessState>();
    if st.is_current(gen) {
        st.clear();
        let _ = app.emit("game-state", json!({ "status": "crashed", "exitCode": code, "errorLog": error_log }));
    }
}

#[tauri::command]
pub fn get_game_status(app: AppHandle, state: State<'_, GameProcessState>) -> GameStatusPayload {
    // Ask the OS about the child right now, so a closed game window is noticed even if the watcher is mid-sleep.
    let child = state.child.lock().ok().and_then(|c| c.clone());
    if let Some(child) = child {
        let exited = child.lock().ok().and_then(|mut c| c.try_wait().ok().flatten());
        if let Some(status) = exited {
            let gen = state.generation.load(Ordering::SeqCst);
            finish(&app, gen, status.code());
        }
    }
    state.snapshot()
}

#[tauri::command]
pub fn stop_game(app: AppHandle, state: State<'_, GameProcessState>) -> R<()> {
    let child = state.child.lock().map_err(err)?.clone();
    if let Some(child) = child {
        if let Ok(mut c) = child.lock() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
    // Invalidate a launch that is still downloading, then reset the slot.
    let gen = state.generation.fetch_add(1, Ordering::SeqCst) + 1;
    state.clear();
    let _ = app.emit("game-state", json!({ "status": "idle", "exitCode": null, "stopped": true }));
    let _ = gen;
    Ok(())
}

#[tauri::command]
pub fn quit_launcher(app: AppHandle) {
    app.exit(0);
}

// ------------------------------------------------------------------ real worlds and servers

fn roots() -> Vec<(String, PathBuf, Option<String>)> {
    let mut v: Vec<(String, PathBuf, Option<String>)> = vec![];
    if let Some(mc) = worlds::default_minecraft_dir() {
        v.push((".minecraft".into(), mc, None));
    }
    for i in instances::list() {
        v.push((format!("{} {}", i.name, i.mc_version), i.game_dir(), Some(i.id.clone())));
    }
    v
}

/// Free physical memory right now, in MiB (what the launch-time heap clamp uses). `None` when the OS cannot say.
#[tauri::command]
pub fn free_memory_mb() -> Option<u64> {
    luminos_core::memguard::available_memory_mb()
}

#[tauri::command]
pub async fn scan_local_worlds_and_servers() -> R<Value> {
    blocking(|| {
        let roots = roots();
        let plain: Vec<(String, PathBuf)> = roots.iter().map(|(l, p, _)| (l.clone(), p.clone())).collect();
        let found = worlds::scan_worlds(&plain);
        let worlds_out: Vec<Value> = found
            .iter()
            .map(|w| {
                let inst = roots.iter().find(|(_, p, _)| p.to_string_lossy() == w.source_dir).and_then(|(_, _, id)| id.clone());
                let mut v = serde_json::to_value(w).unwrap_or(Value::Null);
                v["instance_id"] = json!(inst);
                v
            })
            .collect();
        let mut seen = std::collections::HashSet::new();
        let mut servers_out = vec![];
        for (label, dir, _) in &roots {
            for s in worlds::read_servers(dir, label) {
                if seen.insert(s.ip.to_lowercase()) {
                    servers_out.push(s);
                }
            }
        }
        let mc = worlds::default_minecraft_dir();
        Ok(json!({
            "worlds": worlds_out,
            "servers": servers_out,
            "minecraft_dir": mc.as_ref().map(|p| p.to_string_lossy().to_string()),
            "minecraft_dir_exists": mc.as_ref().is_some_and(|p| p.exists()),
        }))
    })
    .await
}

/// Write a server into the real `servers.dat` of the Minecraft folder and of every Luminos instance, so it shows up in game too.
#[tauri::command]
pub async fn add_saved_server(name: String, ip: String) -> R<bool> {
    blocking(move || {
        let mut added = false;
        let mut any = false;
        for (_, dir, id) in roots() {
            // The vanilla folder is only written when it exists: never create a stray .minecraft just for this.
            if id.is_none() && !dir.exists() {
                continue;
            }
            any = true;
            added |= worlds::add_server(&dir, &name, &ip).map_err(err)?;
        }
        if !any {
            return Err("No Minecraft folder or Luminos instance exists yet. Launch Minecraft once first.".into());
        }
        Ok(added)
    })
    .await
}

#[tauri::command]
pub async fn open_minecraft_folder() -> R<String> {
    blocking(|| {
        let dir = worlds::default_minecraft_dir().ok_or("Could not work out where Minecraft keeps its files on this PC.")?;
        if !dir.exists() {
            return Err(format!("{} does not exist yet. Launch Minecraft once and it will be created.", dir.display()));
        }
        let opener = if cfg!(windows) { "explorer" } else if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener).arg(&dir).spawn().map_err(err)?;
        Ok(dir.to_string_lossy().to_string())
    })
    .await
}

// ------------------------------------------------------------------ launcher <-> game config (config/luminos/config.json)

fn config_path(game_dir: &Path) -> PathBuf {
    game_dir.join("config").join("luminos").join("config.json")
}

/// Mirror the launcher's module toggles, hotkeys and HUD layout into every instance, where the in-game client reads them.
#[tauri::command]
pub async fn write_luminos_config(json: String) -> R<usize> {
    blocking(move || {
        serde_json::from_str::<Value>(&json).map_err(err)?;
        let mut n = 0;
        for i in instances::list() {
            let p = config_path(&i.game_dir());
            if let Some(parent) = p.parent() {
                std::fs::create_dir_all(parent).map_err(err)?;
            }
            std::fs::write(&p, &json).map_err(err)?;
            n += 1;
        }
        Ok(n)
    })
    .await
}

/// What the game last wrote (in-game toggles), so the launcher can show the same state after a session.
#[tauri::command]
pub async fn read_luminos_config(instance: Option<String>) -> R<Value> {
    blocking(move || {
        let list = instances::list();
        let inst = instance.and_then(|id| list.iter().find(|i| i.id == id).cloned()).or_else(|| list.first().cloned());
        Ok(inst
            .and_then(|i| std::fs::read_to_string(config_path(&i.game_dir())).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(Value::Null))
    })
    .await
}

// ------------------------------------------------------------------ in-game client install

fn bundled_client_jar(app: &AppHandle, mc: &str) -> Option<PathBuf> {
    let mut dirs: Vec<PathBuf> = vec![];
    if let Ok(r) = app.path().resource_dir() {
        dirs.push(r.join("resources").join("mods"));
        dirs.push(r.join("mods"));
    }
    dirs.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("mods"));
    let suffix = format!("-mc{mc}.jar");
    // The first folder that holds any client jar for this Minecraft version wins; inside it, the jar built for THIS app version.
    dirs.into_iter().find_map(|d| {
        let found: Vec<PathBuf> = std::fs::read_dir(d)
            .ok()?
            .flatten()
            .map(|e| e.path())
            .filter(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("luminos-client") && n.ends_with(&suffix) && !n.contains("sources")))
            .collect();
        launch_watch::pick_bundled(found, env!("CARGO_PKG_VERSION"))
    })
}

fn has_jar(mods: &Path, prefix: &str) -> bool {
    std::fs::read_dir(mods)
        .map(|rd| rd.flatten().any(|e| e.file_name().to_string_lossy().to_lowercase().starts_with(prefix) && e.file_name().to_string_lossy().ends_with(".jar")))
        .unwrap_or(false)
}

/// Put `luminos-client-<mc>.jar` (bundled with the installer) and Fabric API into `<game dir>/mods` before the game starts.
/// Returns what happened, for the window to show. Never fatal: the game can still start without the client.
pub fn ensure_client(app: &AppHandle, inst: &Instance) -> Value {
    if inst.loader != Loader::Fabric {
        return json!({ "ok": false, "source": "none", "note": format!("{} instances run without the Luminos Client: it needs Fabric.", inst.loader.label()) });
    }
    let mods = inst.game_dir().join("mods");
    if let Err(e) = std::fs::create_dir_all(&mods) {
        return json!({ "ok": false, "source": "none", "note": format!("Could not create the mods folder: {e}") });
    }
    let bundled = bundled_client_jar(app, &inst.mc_version);
    let mut source = "none";
    let mut jar_name = Value::Null;
    // Purge FIRST, unconditionally and before anything is copied or downloaded: every `*luminos*.jar` in <game dir>/mods and in the
    // Luminos cache folders goes, so Minecraft can never boot (or be handed back) a stale client. This is what kept the old,
    // unclickable title screen alive after an update.
    let mut purged: Vec<String> = vec![];
    match launch_watch::purge_stale_client_jars(&mods) {
        Ok(v) => purged.extend(v),
        Err(e) => return json!({ "ok": false, "source": "none", "note": format!("Could not remove the old Luminos Client from mods: {e}") }),
    }
    for cache in [luminos_core::paths::cache_dir(), luminos_core::paths::root().join("client")] {
        match launch_watch::purge_cache_jars(&cache) {
            Ok(v) => purged.extend(v),
            Err(e) => return json!({ "ok": false, "source": "none", "note": format!("Could not clear the Luminos client cache: {e}") }),
        }
    }
    if let Some(src) = &bundled {
        let name = src.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        // The bundled jar is copied unconditionally (no size-equals shortcut that could keep an old file).
        if let Err(e) = std::fs::copy(src, mods.join(&name)) {
            return json!({ "ok": false, "source": "bundled", "note": format!("Could not copy the Luminos Client into mods: {e}") });
        }
        source = "bundled";
        jar_name = json!(name);
    } else {
        // No bundled jar (a development checkout): fetch the published, hash-verified one for this Minecraft version. Nothing stale is
        // kept as a fallback: offline means "no client this launch", and the note says so.
        match preset::install_first_party(inst) {
            Ok(n) => {
                source = "download";
                jar_name = json!(n);
            }
            Err(e) => return json!({ "ok": false, "source": "none", "note": format!("No Luminos Client build for Minecraft {}: {e:#}", inst.mc_version) }),
        }
    }
    // The client needs Fabric API. Install it (only it) when missing; the bundled jar is used so the client is not fetched again.
    if !has_jar(&mods, "fabric-api") {
        let api: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT.iter().filter(|m| m.slug == "fabric-api").collect();
        if let Some(p) = &bundled {
            std::env::set_var("LUMINOS_CLIENT_JAR", p);
        }
        let r = preset::install(inst, &api, |_, _, _| {});
        if bundled.is_some() {
            std::env::remove_var("LUMINOS_CLIENT_JAR");
        }
        if !has_jar(&mods, "fabric-api") {
            let why = r.skipped.first().map(|(_, w)| w.clone()).unwrap_or_else(|| "unknown".into());
            return json!({ "ok": false, "source": source, "jar": jar_name, "note": format!("Fabric API could not be installed ({why}). The Luminos Client needs it.") });
        }
    }
    json!({ "ok": true, "source": source, "jar": jar_name, "purged": purged, "appVersion": env!("CARGO_PKG_VERSION"), "note": "Luminos Client is in the mods folder." })
}

/// Last check before the JVM is spawned: exactly one Luminos Client jar may be in `<game dir>/mods`, and it is `expected`.
/// Returns the names of any strays it had to remove. Errors only when a stray cannot be deleted.
pub fn enforce_single_client(inst: &Instance, expected: &str) -> Result<Vec<String>, String> {
    launch_watch::purge_except(&inst.game_dir().join("mods"), Some(expected)).map_err(err)
}

/// Which members of the performance stack are really in `<game dir>/mods` right now (what the window shows for stage 4).
pub fn perf_stack(inst: &Instance) -> String {
    let names: Vec<String> = std::fs::read_dir(inst.game_dir().join("mods"))
        .map(|rd| rd.flatten().map(|e| e.file_name().to_string_lossy().to_lowercase()).collect())
        .unwrap_or_default();
    let has = |k: &str| names.iter().any(|n| n.contains(k) && n.ends_with(".jar"));
    let found: Vec<&str> = [("sodium", "Sodium"), ("lithium", "Lithium"), ("ferritecore", "FerriteCore"), ("immediatelyfast", "ImmediatelyFast")]
        .iter()
        .filter(|(k, _)| has(k))
        .map(|(_, n)| *n)
        .collect();
    if found.is_empty() {
        "no performance mods installed for this instance".to_string()
    } else {
        format!("{} ready", found.join(", "))
    }
}
