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
use serde_json::{json, Value};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter};

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

/// Step 2: block on a worker thread until the player approves, then run the Xbox, XSTS and Minecraft chain.
#[tauri::command]
async fn ms_device_finish(device_code: String, expires_in: u64, interval: u64) -> R<Value> {
    blocking(move || {
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
        // Keep the session so the skin can be applied to this Mojang account later (mojang_set_skin).
        let mut store = AccountStore::load();
        let mut acc = Account::offline(&session.username);
        acc.uuid = session.uuid.clone();
        acc.kind = AccountKind::Microsoft;
        acc.skin_id = None;
        acc.access_token = Some(session.minecraft_token.clone());
        store.add(acc);
        if let Some(a) = store.accounts.iter_mut().find(|a| a.username == session.username) {
            a.access_token = Some(session.minecraft_token.clone());
        }
        store.save();
        Ok(json!({ "username": session.username, "uuid": session.uuid }))
    })
    .await
}

/// Copy a player's current skin by name. Mojang API only.
#[tauri::command]
async fn mojang_lookup(name: String) -> R<Value> {
    blocking(move || {
        Ok(match luminos_core::mojang::lookup(&name) {
            Ok(luminos_core::mojang::Found::NoUser) => json!({ "status": "nouser", "why": format!("No Minecraft account is named \u{201c}{name}\u{201d}.") }),
            Ok(luminos_core::mojang::Found::NoSkin(n)) => json!({ "status": "noskin", "why": format!("{n} has no custom skin. They use the default Steve or Alex.") }),
            Ok(luminos_core::mojang::Found::Skin { name, id, png, slim }) => json!({ "status": "found", "name": name, "id": id, "model": if slim { "slim" } else { "classic" }, "data": format!("data:image/png;base64,{}", b64(&png)) }),
            Err(e) => json!({ "status": "error", "why": format!("Could not reach Mojang: {}", err(e)) }),
        })
    })
    .await
}

/// Apply a skin (PNG data URL) to the signed-in Microsoft account.
#[tauri::command]
async fn mojang_set_skin(png: String, slim: bool) -> R<()> {
    blocking(move || {
        let store = AccountStore::load();
        let acc = store.active().filter(|a| a.kind == AccountKind::Microsoft).ok_or("Sign in with Microsoft first. Offline accounts have no Mojang skin to change.".to_string())?;
        let token = acc.access_token.clone().ok_or("The Microsoft sign-in has expired. Sign in again.".to_string())?;
        let data = png.split_once(',').map(|x| x.1).ok_or("That skin is not a PNG data URL.".to_string())?;
        let bytes = luminos_core::mojang::b64_decode(data).map_err(err)?;
        luminos_core::mojang::set_skin(&token, &bytes, slim).map_err(err)
    })
    .await
}

/// Persist the locker next to the other config so the client can read it after a restart.
#[tauri::command]
async fn write_cosmetics(json: String) -> R<()> {
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

/// Starts the game on its own thread and streams `launch` events: preparing -> launching -> running -> exited.
#[tauri::command]
async fn launch_instance(app: AppHandle, id: String) -> R<()> {
    let inst = instances::list().into_iter().find(|i| i.id == id).ok_or("That instance no longer exists")?;
    std::thread::spawn(move || {
        let emit = |v: Value| {
            let _ = app.emit("launch", v);
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
        let prep = launch::prepare(&inst, &settings, &progress);
        stop.store(true, Ordering::Relaxed);
        let prep = match prep {
            Ok(p) => p,
            Err(e) => return emit(json!({ "id": inst.id, "phase": "failed", "error": err(e) })),
        };
        emit(json!({ "id": inst.id, "phase": "launching", "mods": serde_json::to_value(&prep.mod_report).unwrap_or(Value::Null) }));
        match launch::spawn(&inst, &settings, &account, &prep) {
            Ok(h) => {
                emit(json!({ "id": inst.id, "phase": "running" }));
                let code = launch::wait_and_record(&h);
                // Push whatever the player changed in this session (keybinds, HUD layout, servers) to the shared store.
                let synced = if std::env::var_os("LUMINOS_NO_SYNC").is_none() {
                    luminos_core::sync::Syncer::new(Default::default()).reconcile(&inst.id, &inst.game_dir()).ok()
                } else {
                    None
                };
                emit(json!({ "id": inst.id, "phase": "exited", "code": code, "log": h.log_tail(60), "sync": serde_json::to_value(&synced).unwrap_or(Value::Null) }));
            }
            Err(e) => emit(json!({ "id": inst.id, "phase": "failed", "error": err(e) })),
        }
    });
    Ok(())
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
        .invoke_handler(tauri::generate_handler![
            app_ready,
            bootstrap,
            set_setting,
            name_check,
            create_account,
            ms_device_begin,
            ms_device_finish,
            mojang_lookup,
            mojang_set_skin,
            write_cosmetics,
            write_client_settings,
            create_instance,
            launch_instance,
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
            check_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running Luminos");
}
