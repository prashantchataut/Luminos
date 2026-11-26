//! Luminos desktop shell: a thin Tauri 2 layer over `luminos-core`, which stays the engine.
//! Every command is async and runs engine work on a blocking thread so the window never stalls.
use luminos_core::{
    accounts::{Account, AccountKind, AccountStore},
    config::Settings,
    content, cosmetics,
    download::Progress,
    instances::{self, Loader},
    launch, modrinth, namecheck, playtime, preset, servers, storage, update,
};
mod discord;
mod engine;
mod game;
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Manager};

type R<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    format!("{e:#}")
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(err)?
}

fn b64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    out
}

#[tauri::command]
async fn bootstrap() -> R<Value> {
    blocking(|| {
        let store = AccountStore::load();
        let account = store.active().map(|a| {
            json!({ "username": a.username, "uuid": a.uuid, "kind": a.kind.label(), "cape": a.cape_id, "skin": a.skin_id })
        });
        Ok(json!({
            "version": luminos_core::VERSION,
            "settings": Settings::load(),
            "account": account,
            "instances": instances::list(),
            "playtime_total": playtime::total(&playtime::load()),
        }))
    })
    .await
}

#[tauri::command]
async fn set_setting(key: String, value: Value) -> R<()> {
    blocking(move || {
        let mut v = serde_json::to_value(Settings::load()).map_err(err)?;
        v[key] = value;
        let s: Settings = serde_json::from_value(v).map_err(err)?;
        s.save();
        Ok(())
    })
    .await
}

#[tauri::command]
async fn name_check(name: String) -> R<Value> {
    blocking(move || {
        if let Err(reason) = namecheck::check_format(&name) {
            return Ok(json!({ "status": "invalid", "reason": reason }));
        }
        Ok(match namecheck::lookup(&name) {
            Ok(namecheck::NameStatus::Premium(id)) => json!({ "status": "premium", "id": id }),
            Ok(namecheck::NameStatus::Free) => json!({ "status": "free" }),
            Ok(_) => json!({ "status": "invalid", "reason": "That name is not allowed." }),
            Err(e) => json!({ "status": "unknown", "reason": err(e) }),
        })
    })
    .await
}

const NO_MS_ID: &str = "No Microsoft app id is configured. Set LUMINOS_MS_CLIENT_ID (an Azure public-client app with device-code flow) or use an offline profile.";

/// Step 1 of Microsoft sign-in: ask Microsoft for a device code the player types at microsoft.com/link.
#[tauri::command]
async fn ms_device_begin() -> R<Value> {
    blocking(|| {
        let id = luminos_core::msauth::client_id().ok_or_else(|| NO_MS_ID.to_string())?;
        let dc = luminos_core::msauth::begin(&id).map_err(err)?;
        Ok(json!({
            "user_code": dc.user_code,
            "device_code": dc.device_code,
            "verification_uri": dc.verification_uri,
            "expires_in": dc.expires_in,
            "interval": dc.interval,
        }))
    })
    .await
}

/// Poll Microsoft until the player approves, then run the Xbox, XSTS and Minecraft chain, store the
/// tokens in the OS secure store and make the account active. Blocking: call from a worker thread.
fn finish_microsoft_login(device_code: String, expires_in: u64, interval: u64) -> R<Value> {
    let id = luminos_core::msauth::client_id().ok_or_else(|| NO_MS_ID.to_string())?;
    let dc = luminos_core::msauth::DeviceCode {
        user_code: String::new(),
        device_code,
        verification_uri: String::new(),
        expires_in,
        interval,
    };
    let (access, refresh) = luminos_core::msauth::wait_for_approval(&id, &dc, &|| false).map_err(err)?;
    let session = luminos_core::msauth::minecraft_login(&access, &refresh).map_err(err)?;
    luminos_core::msauth::remember(&session).map_err(err)?;
    // Keep the session: without this the player signs in and nothing changes.
    let acc = Account {
        username: session.username.clone(),
        uuid: session.uuid.clone(),
        kind: luminos_core::accounts::AccountKind::Microsoft,
        skin_id: None,
        auth_server: None,
        access_token: Some(session.minecraft_token.clone()),
        client_token: None,
        cape_id: None,
    };
    let mut store = AccountStore::load();
    if let Some(i) = store.accounts.iter().position(|a| a.username == acc.username) {
        store.accounts[i] = acc;
        store.active = i;
    } else {
        store.add(acc);
    }
    store.save();
    let mut s = Settings::load();
    s.setup_done = true;
    s.save();
    Ok(json!({ "username": session.username, "uuid": session.uuid, "expires_at": session.expires_at }))
}

/// Step 2: block on a worker thread until the player approves (kept for callers that drive the polling themselves).
#[tauri::command]
async fn ms_device_finish(device_code: String, expires_in: u64, interval: u64) -> R<Value> {
    blocking(move || finish_microsoft_login(device_code, expires_in, interval)).await
}

/// One call for the whole Microsoft sign-in: returns the code to show now, then keeps polling in the
/// background and reports through the `ms-login` event: `{ ok, username?, uuid?, error? }`.
#[tauri::command]
async fn start_microsoft_device_login(app: AppHandle) -> R<Value> {
    let begun = ms_device_begin().await?;
    let (dc, exp, int) = (
        begun["device_code"].as_str().unwrap_or_default().to_string(),
        begun["expires_in"].as_u64().unwrap_or(900),
        begun["interval"].as_u64().unwrap_or(5),
    );
    std::thread::spawn(move || {
        let payload = match finish_microsoft_login(dc, exp, int) {
            Ok(v) => json!({ "ok": true, "username": v["username"], "uuid": v["uuid"] }),
            Err(e) => json!({ "ok": false, "error": e }),
        };
        let _ = app.emit("ms-login", payload);
    });
    Ok(begun)
}

/// Look a player up through Mojang only. Three outcomes: found, no such player, no skin set.
#[tauri::command]
async fn mojang_skin_lookup(name: String) -> R<Value> {
    use luminos_core::skinlookup::{lookup, Outcome};
    blocking(move || {
        Ok(match lookup(name.trim()).map_err(err)? {
            Outcome::NoSuchPlayer => json!({ "status": "no_such_player" }),
            Outcome::NoSkin { name, uuid } => json!({ "status": "no_skin", "name": name, "uuid": uuid }),
            Outcome::Found(f) => json!({ "status": "found", "name": f.name, "uuid": f.uuid, "slim": f.slim, "png": format!("data:image/png;base64,{}", b64(&f.png)) }),
        })
    })
    .await
}

/// Set the signed-in Microsoft account's skin through Mojang, so the server serves it to everyone.
#[tauri::command]
async fn mojang_skin_apply(png_b64: String, slim: bool) -> R<()> {
    blocking(move || {
        let store = AccountStore::load();
        let acc = store.active().ok_or_else(|| "No account is signed in.".to_string())?;
        if acc.kind != luminos_core::accounts::AccountKind::Microsoft {
            return Err("Only a Microsoft account can change its skin on Mojang. Offline accounts have no Mojang skin.".to_string());
        }
        let token = acc.access_token.clone().ok_or_else(|| "Sign in again: the saved session has no token.".to_string())?;
        let png = luminos_core::skinlookup::b64_decode(png_b64.rsplit(',').next().unwrap_or("")).map_err(err)?;
        luminos_core::skinlookup::upload(&token, &png, slim).map_err(err)
    })
    .await
}

/// Persist the locker next to the other config so the client can read it after a restart.
/// Export an instance as a .mrpack into the user's Documents/Luminos folder and return the path.
#[tauri::command]
async fn export_instance(id: String) -> R<String> {
    blocking(move || {
        let inst = instances::list().into_iter().find(|i| i.id == id).ok_or("That instance no longer exists")?;
        let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(std::path::PathBuf::from).unwrap_or_else(std::env::temp_dir);
        let dir = home.join("Documents").join("Luminos");
        let file: String = inst.name.chars().map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '_' }).collect();
        let dest = dir.join(format!("{file}.mrpack"));
        luminos_core::mrpack::export(&inst, &dest).map_err(err)?;
        Ok(dest.to_string_lossy().to_string())
    })
    .await
}

/// Save the Locker (equipped items, skin) where the Luminos Client reads it, next to accounts.json.
#[tauri::command]
async fn locker_save(json: String) -> R<()> {
    blocking(move || {
        serde_json::from_str::<Value>(&json).map_err(err)?;
        let dir = luminos_core::paths::accounts_file().parent().map(|p| p.to_path_buf()).ok_or("no config directory".to_string())?;
        std::fs::write(dir.join("luminos-cosmetics.json"), json).map_err(err)
    })
    .await
}

/// Settings the in-game client reads: luminos-client-settings.json (theme, crosshair, keystrokes, fog, fonts, classic client).
#[tauri::command]
async fn write_client_settings(json: String) -> R<()> {
    blocking(move || {
        serde_json::from_str::<Value>(&json).map_err(err)?;
        let dir = luminos_core::paths::accounts_file().parent().map(|p| p.to_path_buf()).ok_or("no config directory".to_string())?;
        std::fs::write(dir.join("luminos-client-settings.json"), json).map_err(err)
    })
    .await
}

#[tauri::command]
async fn create_account(name: String) -> R<()> {
    blocking(move || {
        let mut store = AccountStore::load();
        store.add(Account::offline(&name));
        store.save();
        let mut s = Settings::load();
        s.setup_done = true;
        s.save();
        Ok(())
    })
    .await
}

#[tauri::command]
async fn create_instance(name: String, mc: String, with_preset: bool) -> R<Value> {
    blocking(move || {
        let inst = instances::create(&name, &mc, Loader::Fabric, None).map_err(err)?;
        let mut dropped = vec![];
        if with_preset {
            let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT.iter().filter(|m| m.default_on).collect();
            let r = preset::install(&inst, &mods, |_, _, _| {});
            dropped = r.skipped.into_iter().map(|(n, why)| json!({ "name": n, "reason": why })).collect();
        }
        Ok(json!({ "instance": inst, "dropped": dropped }))
    })
    .await
}

/// Starts the game on its own thread and streams `launch` events (preparing -> launching -> running -> exited) plus
/// `game-state` events (idle | preparing | running) that the window uses for the Launch / Stop Game button.
#[tauri::command]
async fn launch_instance(app: AppHandle, state: tauri::State<'_, game::GameProcessState>, id: String, quick: Option<String>, world_path: Option<String>) -> R<()> {
    let inst = instances::list().into_iter().find(|i| i.id == id).ok_or("That instance no longer exists")?;
    let gen = state.begin(&inst.id)?;
    let _ = app.emit("game-state", json!({ "status": "preparing", "pid": null, "instance": inst.id }));
    std::thread::spawn(move || {
        let emit = |v: Value| {
            let _ = app.emit("launch", v);
        };
        let fail = |msg: String| {
            game::finish(&app, gen, None);
            emit(json!({ "id": inst.id, "phase": "failed", "error": msg }));
        };
        let settings = Settings::load();
        let account = AccountStore::load().active().cloned().unwrap_or_else(|| Account::offline("Player"));
        let progress = Progress::new();
        let stop = Arc::new(AtomicBool::new(false));
        {
            let (p, stop, app2, id2) = (progress.clone(), stop.clone(), app.clone(), inst.id.clone());
            std::thread::spawn(move || {
                while !stop.load(Ordering::Relaxed) {
                    let _ = app2.emit("launch", json!({ "id": id2, "phase": "preparing", "stage": p.stage(), "fraction": p.fraction() }));
                    std::thread::sleep(std::time::Duration::from_millis(150));
                }
            });
        }
        // Queued switches ("applies next launch") are applied now, before the game starts.
        match luminos_core::pending::apply_all(&inst.game_dir()) {
            Ok(log) if !log.is_empty() => emit(json!({ "id": inst.id, "phase": "pending-applied", "log": log })),
            Err(e) => {
                stop.store(true, Ordering::Relaxed);
                return fail(err(e));
            }
            _ => {}
        }
        // The Luminos Client (title screen, Right Ctrl quick panel, HUD) only exists if its jar is in mods/ before Fabric starts.
        let client = game::ensure_client(&app, &inst);
        emit(json!({ "id": inst.id, "phase": "client", "client": client }));
        // A world from the vanilla Minecraft folder is linked (not copied) into this instance so quick play can open it.
        if let Some(wp) = world_path.as_deref() {
            if let Err(e) = luminos_core::worlds::link_world(&inst.game_dir(), std::path::Path::new(wp)) {
                emit(json!({ "id": inst.id, "phase": "notice", "note": format!("Could not open that world directly: {e:#}") }));
            }
        }
        let prep = launch::prepare(&inst, &settings, &progress);
        stop.store(true, Ordering::Relaxed);
        let prep = match prep {
            Ok(p) => p,
            Err(e) => return fail(err(e)),
        };
        if !state_is_current(&app, gen) {
            return; // Stop Game was pressed while files were downloading
        }
        // Never start vanilla by accident: a Fabric instance must boot through Fabric Loader's KnotClient.
        if inst.loader == Loader::Fabric && !prep.version.main_class.contains("KnotClient") {
            return fail(format!("Fabric Loader was not set up for this instance (main class {}). Luminos will not start plain Minecraft instead.", prep.version.main_class));
        }
        emit(json!({ "id": inst.id, "phase": "launching", "mods": serde_json::to_value(&prep.mod_report).unwrap_or(Value::Null) }));
        match launch::spawn_ext(&inst, &settings, &account, &prep, quick.as_deref()) {
            Ok(h) => {
                if !app.state::<game::GameProcessState>().set_running(h.child.clone(), gen) {
                    h.kill();
                    return;
                }
                let pid = app.state::<game::GameProcessState>().snapshot().pid;
                emit(json!({ "id": inst.id, "phase": "running", "pid": pid }));
                let _ = app.emit("game-state", json!({ "status": "running", "pid": pid, "instance": inst.id }));
                // Keep Discord's state in step with the game: ask the in-game agent for its world/server every few seconds.
                let watching = Arc::new(AtomicBool::new(true));
                {
                    let w = watching.clone();
                    std::thread::spawn(move || {
                        discord::set_world("menus", None);
                        while w.load(Ordering::Relaxed) {
                            std::thread::sleep(std::time::Duration::from_secs(5));
                            if let Some(hub) = luminos_core::agent::global().filter(|h| h.connected()) {
                                let _ = hub.send(json!({ "t": "snapshot" }));
                                if let Some(hello) = hub.hello() {
                                    let world = hello["world"].as_str().unwrap_or("menus").to_string();
                                    let server = hello["server"].as_str().filter(|s| !s.is_empty()).map(String::from);
                                    discord::set_world(&world, server);
                                }
                            }
                        }
                        discord::clear_world();
                    });
                }
                // Polls `try_wait` every 400 ms: returns the moment Minecraft quits, whether the player closed the window or pressed Stop Game.
                let code = launch::wait_and_record(&h);
                watching.store(false, Ordering::Relaxed);
                // Tell the window first. Syncing settings below can take a moment and must not keep the button on "Running".
                game::finish(&app, gen, Some(code));
                // Push whatever the player changed in this session (keybinds, HUD layout, servers) to the shared store.
                let synced = if std::env::var_os("LUMINOS_NO_SYNC").is_none() {
                    luminos_core::sync::Syncer::new(Default::default()).reconcile(&inst.id, &inst.game_dir()).ok()
                } else {
                    None
                };
                emit(json!({ "id": inst.id, "phase": "exited", "code": code, "log": h.log_tail(60), "sync": serde_json::to_value(&synced).unwrap_or(Value::Null) }));
            }
            Err(e) => fail(err(e)),
        }
    });
    Ok(())
}

fn state_is_current(app: &AppHandle, gen: u64) -> bool {
    app.state::<game::GameProcessState>().is_current(gen)
}

/// Empty path means the default `sync-export` folder inside the Luminos data directory.
fn sync_dir(p: &str) -> std::path::PathBuf {
    if p.is_empty() { luminos_core::paths::root().join("sync-export") } else { std::path::PathBuf::from(p) }
}

/// Reconcile every instance with the shared store now; returns one report per instance.
#[tauri::command]
async fn sync_run() -> R<Value> {
    blocking(|| {
        let s = luminos_core::sync::Syncer::new(Default::default());
        let mut out = serde_json::Map::new();
        for i in instances::list() {
            let rep = s.reconcile(&i.id, &i.game_dir()).map_err(err)?;
            out.insert(i.name.clone(), serde_json::to_value(rep).map_err(err)?);
        }
        Ok(Value::Object(out))
    })
    .await
}

#[tauri::command]
async fn sync_export(path: String) -> R<usize> {
    blocking(move || luminos_core::sync::Syncer::new(Default::default()).export(&sync_dir(&path)).map_err(err)).await
}

#[tauri::command]
async fn sync_import(path: String) -> R<usize> {
    blocking(move || luminos_core::sync::Syncer::new(Default::default()).import(&sync_dir(&path)).map_err(err)).await
}

#[tauri::command]
async fn mod_report(id: String) -> R<Value> {
    blocking(move || {
        let f = luminos_core::paths::instances_dir().join(id).join("resolve-report.json");
        Ok(std::fs::read_to_string(f).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(Value::Null))
    })
    .await
}

#[tauri::command]
async fn modrinth_search(query: String, kind: String, limit: u32) -> R<Value> {
    blocking(move || {
        let q = modrinth::SearchQuery {
            text: query,
            project_type: kind,
            loader: Some("fabric".into()),
            game_version: None,
            sort: "downloads".into(),
            offset: 0,
            limit,
        };
        let r = modrinth::search(&q).map_err(err)?;
        Ok(json!({ "total": r.total_hits, "hits": r.hits }))
    })
    .await
}

#[tauri::command]
async fn install_mod(instance: String, slug: String) -> R<Vec<String>> {
    blocking(move || {
        let inst = instances::list().into_iter().find(|i| i.id == instance).ok_or("instance not found")?;
        content::install_project(&inst, &slug, content::Kind::Mod).map_err(err)
    })
    .await
}

#[tauri::command]
async fn builtin_skins() -> R<Value> {
    blocking(|| {
        let skins: Vec<Value> = cosmetics::SKINS
            .iter()
            .map(|s| json!({ "id": s.id, "name": s.name, "blurb": s.blurb, "slim": s.slim, "png": format!("data:image/png;base64,{}", b64(s.png)) }))
            .collect();
        let capes: Vec<Value> = cosmetics::CAPES
            .iter()
            .map(|c| json!({ "id": c.id, "name": c.name, "blurb": c.blurb, "png": format!("data:image/png;base64,{}", b64(c.png)) }))
            .collect();
        Ok(json!({ "skins": skins, "capes": capes }))
    })
    .await
}

#[tauri::command]
async fn servers_list() -> R<Value> {
    blocking(|| Ok(serde_json::to_value(servers::load()).map_err(err)?)).await
}

#[tauri::command]
async fn playtime_stats() -> R<Value> {
    blocking(|| {
        let log = playtime::load();
        Ok(json!({ "total": playtime::total(&log), "week": playtime::last_days_total(&log, 7), "streak": playtime::streak(&log),
                   "daily": playtime::daily(&log, 14), "per_instance": playtime::per_instance(&log) }))
    })
    .await
}

#[tauri::command]
async fn storage_areas() -> R<Value> {
    blocking(|| {
        let a: Vec<Value> = storage::areas()
            .into_iter()
            .map(|a| json!({ "name": a.name, "detail": a.detail, "bytes": a.bytes, "human": storage::human(a.bytes), "reclaimable": a.reclaimable }))
            .collect();
        Ok(Value::Array(a))
    })
    .await
}

#[tauri::command]
async fn clear_cache() -> R<u64> {
    blocking(|| storage::clear_cache().map_err(err)).await
}

#[tauri::command]
async fn check_update() -> R<Value> {
    blocking(|| {
        Ok(match update::check(luminos_core::VERSION).map_err(err)? {
            Some(r) => json!({ "version": r.version, "notes": r.notes, "page": r.page }),
            None => Value::Null,
        })
    })
    .await
}

/// Open an https page in the default browser. Only the Microsoft and GitHub pages Luminos itself sends people to.
#[tauri::command]
fn open_external(url: String) -> R<()> {
    let ok = ["https://www.microsoft.com/", "https://microsoft.com/", "https://login.live.com/", "https://github.com/prashantchataut/Luminos"];
    if !ok.iter().any(|p| url.starts_with(p)) {
        return Err("That address is not one Luminos opens.".into());
    }
    #[cfg(windows)]
    {
        let mut cmd = std::process::Command::new("rundll32");
        cmd.args(["url.dll,FileProtocolHandler", &url]);
        luminos_core::sys::quiet(&mut cmd);
        cmd.spawn().map_err(err)?;
    }
    #[cfg(not(windows))]
    {
        let opener = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(opener).arg(&url).spawn().map_err(err)?;
    }
    Ok(())
}

fn update_json(current: &str, r: Option<update::Release>) -> Value {
    match r {
        Some(r) => json!({ "updateAvailable": update::is_newer(&r.version, current), "currentVersion": current, "latestVersion": r.version,
            "downloadUrl": r.setup_url, "assetName": update::SETUP_ASSET, "assetSize": r.setup_size, "sizeBytes": r.setup_size,
            "releaseNotes": r.notes, "publishedAt": r.published_at, "page": r.page }),
        None => json!({ "updateAvailable": false, "currentVersion": current, "latestVersion": current,
            "downloadUrl": null, "assetName": null, "assetSize": 0, "sizeBytes": 0, "releaseNotes": "", "publishedAt": "", "page": null }),
    }
}

/// Ask GitHub (`/releases/latest`, then the release list; the shared HTTP agent sends `User-Agent: Luminos-Launcher/4.0.0`).
/// ALWAYS returns the latest release's download URL, even when this build is already current, so the UI can offer
/// "Reinstall / Test Auto-Updater". Errors are returned to the UI as text, never swallowed.
#[tauri::command]
async fn check_app_update() -> R<Value> {
    blocking(|| {
        let cur = env!("CARGO_PKG_VERSION");
        let latest = update::latest_release().map_err(|e| format!("Could not reach GitHub releases: {e:#}"))?;
        Ok(update_json(cur, latest))
    })
    .await
}

/// Stream the installer to `%TEMP%\Luminos-Update-Setup.exe` with live progress (`update-progress` and
/// `update-download-progress`: percent, done, total, bytesPerSec), verify size / `MZ` header / SHA-256, start the detached
/// `luminos_apply_update.cmd` (waits, runs the NSIS installer with /S, restarts Luminos) and exit this process so the
/// installer can replace the running exe. Works for a newer release and as "Reinstall latest" when already current.
#[tauri::command]
async fn install_app_update(app: AppHandle, download_url: String) -> R<()> {
    let handle = app.clone();
    blocking(move || {
        let dest = std::env::temp_dir().join("Luminos-Update-Setup.exe");
        let started = std::time::Instant::now();
        let say = |phase: &str, done: u64, total: u64| {
            let pct = if total == 0 { 0 } else { (done * 100 / total).min(100) };
            let bps = (done as f64 / started.elapsed().as_secs_f64().max(0.001)) as u64;
            let payload = json!({ "phase": phase, "percent": pct, "done": done, "total": total, "bytesPerSec": bps });
            let _ = handle.emit("update-progress", payload.clone());
            let _ = handle.emit("update-download-progress", payload);
        };
        say("downloading", 0, 0);
        let size = update::download_installer(&download_url, &dest, &mut |done, total| say("downloading", done, total)).map_err(err)?;
        say("installing", size, size);
        update::spawn_apply_script(&dest).map_err(err)?;
        // Give the script a moment to start, then leave so the installer can overwrite Luminos.exe.
        std::thread::sleep(std::time::Duration::from_millis(300));
        Ok(())
    })
    .await?;
    app.exit(0);
    Ok(())
}

static STARTED: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

/// The frontend calls this after its first painted frame. With LUMINOS_PERF_FILE set (CI only) the
/// time since process start is written there, so cold start is measured, not guessed.
#[tauri::command]
fn app_ready() {
    if let (Some(t), Ok(path)) = (STARTED.get(), std::env::var("LUMINOS_PERF_FILE")) {
        let _ = std::fs::write(path, format!("{}", t.elapsed().as_millis()));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = STARTED.set(std::time::Instant::now());
    tauri::Builder::default()
        .manage(game::GameProcessState::default())
        .setup(|_| {
            discord::start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_ready,
            bootstrap,
            set_setting,
            name_check,
            create_account,
            ms_device_begin,
            ms_device_finish,
            locker_save,
            export_instance,
            write_client_settings,
            mojang_skin_lookup,
            mojang_skin_apply,
            create_instance,
            launch_instance,
            game::get_game_status,
            game::stop_game,
            game::quit_launcher,
            game::scan_local_worlds_and_servers,
            game::add_saved_server,
            game::open_minecraft_folder,
            game::write_luminos_config,
            game::read_luminos_config,
            sync_run,
            sync_export,
            sync_import,
            mod_report,
            modrinth_search,
            install_mod,
            builtin_skins,
            servers_list,
            playtime_stats,
            storage_areas,
            clear_cache,
            check_update,
            check_app_update,
            open_external,
            install_app_update,
            start_microsoft_device_login,
            engine::live_snapshot,
            engine::live_apply,
            engine::live_cancel_batch,
            engine::live_events,
            engine::live_pause,
            engine::store_search,
            engine::store_install,
            engine::store_installed,
            engine::dedup_status,
            engine::dedup_run,
            engine::deps_check,
            engine::redact_scrub,
            engine::quickplay_parse,
            engine::quickplay_shortcut,
            engine::presence_update,
            engine::presence_status,
            engine::presence_preview,
            engine::shares_scan,
            engine::shares_resolve,
            engine::p2p_room_code,
            engine::p2p_guest_listen,
            engine::p2p_host_dial,
            engine::p2p_write,
            engine::p2p_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running Luminos");
}
