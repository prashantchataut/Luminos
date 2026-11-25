//! Tauri commands for the engine pieces added in session 18: live panel, store, dedup, deps, redact, Quick Play, presence,
//! cross-instance sharing and the P2P bridge. Every command runs on a blocking thread and returns `Result<_, String>`.
//! The TypeScript side is `app/src/engine.ts`; `app/tools/bindings.test.mjs` fails if the two drift apart.
use crate::discord;
use luminos_core::{
    agent, content,
    dedup,
    deps::{Graph, ModNode},
    instances::{self, Instance},
    livemod::{self, Kind},
    p2p, paths, pending,
    presence::PresenceInput,
    quickplay, redact, shares,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    path::{Path, PathBuf},
    sync::{Arc, OnceLock},
};
use tauri::{AppHandle, Emitter};

type R<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    format!("{e:#}")
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(err)?
}

fn find(id: &str) -> R<Instance> {
    instances::list().into_iter().find(|i| i.id == id).ok_or_else(|| "That instance no longer exists".to_string())
}

fn refs() -> Vec<shares::InstanceRef> {
    instances::list().into_iter().map(|i| shares::InstanceRef { id: i.id.clone(), name: i.name.clone(), game_dir: i.game_dir() }).collect()
}

// ------------------------------------------------------------------------------------------------ live panel

fn offline_modules(gd: &Path) -> Value {
    let v: Value = std::fs::read_to_string(gd.join("config/luminos-client.json")).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(Value::Null);
    let list: Vec<Value> = v["modules"].as_object().map(|m| m.iter().map(|(k, c)| json!({ "id": k, "enabled": c["enabled"].as_bool().unwrap_or(true) })).collect()).unwrap_or_default();
    Value::Array(list)
}

fn offline_packs(gd: &Path) -> Value {
    let selected = std::fs::read_to_string(gd.join("options.txt")).unwrap_or_default();
    let mut out = vec![];
    if let Ok(rd) = std::fs::read_dir(gd.join("resourcepacks")) {
        for e in rd.flatten() {
            let n = e.file_name().to_string_lossy().to_string();
            out.push(json!({ "id": format!("file/{n}"), "enabled": selected.contains(&format!("\"file/{n}\"")) }));
        }
    }
    Value::Array(out)
}

#[tauri::command]
pub async fn live_snapshot(instance: String) -> R<Value> {
    blocking(move || {
        let inst = find(&instance)?;
        let gd = inst.game_dir();
        let pend = pending::load(&gd);
        let hub = agent::global();
        let hello = hub.and_then(|h| h.hello());
        let connected = hub.is_some_and(|h| h.connected());
        let mods: Vec<Value> = livemod::list_mods(&gd)
            .iter()
            .map(|m| {
                let p = pend.iter().find(|t| t.file == m.file).map(|t| t.enable);
                json!({ "id": m.id, "file": m.file, "name": m.name, "version": m.version, "enabled": m.enabled, "requires": m.requires, "verdict": m.verdict, "pending": p })
            })
            .collect();
        let h = |k: &str| hello.as_ref().map(|h| h[k].clone()).filter(|v| !v.is_null());
        Ok(json!({
            "mods": mods,
            "pending": pend,
            "agent": { "connected": connected, "mc": h("mc"), "world": h("world"), "server": h("server") },
            "modules": h("modules").unwrap_or_else(|| offline_modules(&gd)),
            "packs": h("packs").unwrap_or_else(|| offline_packs(&gd)),
            "kinds": { "module": livemod::classify_kind(Kind::LuminosModule), "resourcepack": livemod::classify_kind(Kind::ResourcePack), "datapack": livemod::classify_kind(Kind::DataPack), "shader": livemod::classify_kind(Kind::Shader) },
        }))
    })
    .await
}

#[derive(Deserialize)]
pub struct Change {
    kind: String,
    id: String,
    file: Option<String>,
    label: String,
    to: bool,
}

fn write_module_offline(gd: &Path, id: &str, on: bool) -> R<()> {
    let p = gd.join("config/luminos-client.json");
    let mut v: Value = std::fs::read_to_string(&p).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| json!({}));
    v["modules"][id]["enabled"] = json!(on);
    std::fs::create_dir_all(p.parent().unwrap_or(gd)).map_err(err)?;
    std::fs::write(&p, serde_json::to_vec_pretty(&v).map_err(err)?).map_err(err)
}

/// Apply a confirmed switch. A change is reported `live` only when the game is connected and acknowledged the command was sent;
/// everything else is `queued` (applied by renaming jars at the next launch) or an error. Never the other way round.
#[tauri::command]
pub async fn live_apply(instance: String, changes: Vec<Change>) -> R<Value> {
    blocking(move || {
        let inst = find(&instance)?;
        let gd = inst.game_dir();
        let batch = luminos_core::store::now_unix() as u64 * 1000 + (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_millis()).unwrap_or(0) as u64);
        let hub = agent::global().filter(|h| h.connected());
        let mut results = vec![];
        let mut queue = vec![];
        for c in &changes {
            let r = match (c.kind.as_str(), hub) {
                ("module", Some(h)) => h.send(json!({ "t": "toggle_module", "id": c.id, "on": c.to })).map(|op| json!({ "id": c.id, "mode": "live", "op": op })).map_err(err),
                ("module", None) => write_module_offline(&gd, &c.id, c.to).map(|_| json!({ "id": c.id, "mode": "queued", "note": "saved; the game is not running" })),
                ("resourcepack", Some(h)) => h.send(json!({ "t": "set_pack", "id": c.id, "on": c.to })).map(|op| json!({ "id": c.id, "mode": "live", "op": op })).map_err(err),
                ("resourcepack", None) => Err("Start the game to switch resource packs live.".to_string()),
                ("mod" | "shader", _) => match &c.file {
                    Some(f) if !f.contains(['/', '\\']) && f.ends_with(".jar") => {
                        queue.push(pending::Task { file: f.clone(), enable: c.to, label: c.label.clone(), batch });
                        Ok(json!({ "id": c.id, "mode": "queued" }))
                    }
                    _ => Err("Missing or unsafe file name".to_string()),
                },
                (k, _) => Err(format!("Unknown kind {k}")),
            };
            results.push(r.unwrap_or_else(|e| json!({ "id": c.id, "mode": "error", "error": e })));
        }
        if !queue.is_empty() {
            pending::push(&gd, queue).map_err(err)?;
        }
        Ok(json!({ "batch": batch, "results": results }))
    })
    .await
}

#[tauri::command]
pub async fn live_cancel_batch(instance: String, batch: u64) -> R<usize> {
    blocking(move || pending::cancel_batch(&find(&instance)?.game_dir(), batch).map_err(err)).await
}

#[tauri::command]
pub async fn live_events(since: u64) -> R<Value> {
    blocking(move || {
        let (events, seq) = agent::global().map(|h| h.events_since(since)).unwrap_or((vec![], since));
        Ok(json!({ "events": events, "seq": seq, "connected": agent::global().is_some_and(|h| h.connected()) }))
    })
    .await
}

/// Pause (or resume) the running game. Errors when no game is connected: the UI then shows the pause toggle as unavailable.
#[tauri::command]
pub async fn live_pause(on: bool) -> R<u64> {
    blocking(move || agent::global().ok_or("The agent link is not available")?.send(json!({ "t": "pause", "on": on })).map_err(err)).await
}

// ------------------------------------------------------------------------------------------------ store

#[derive(Deserialize)]
pub struct StoreQuery {
    query: String,
    kind: String,
    limit: u32,
    offset: u32,
    sort: String,
    categories: Vec<String>,
    game_version: Option<String>,
    loader: Option<String>,
}

/// Real Modrinth search (mods, resource packs, shaders, data packs) with category facets.
#[tauri::command]
pub async fn store_search(q: StoreQuery) -> R<Value> {
    blocking(move || {
        if !["mod", "resourcepack", "shader", "datapack"].contains(&q.kind.as_str()) {
            return Err("Unknown project type".into());
        }
        let sq = luminos_core::modrinth::SearchQuery { text: q.query, project_type: q.kind, loader: q.loader, game_version: q.game_version, sort: q.sort, offset: q.offset, limit: q.limit };
        let r = luminos_core::modrinth::search_facets(&sq, &q.categories).map_err(err)?;
        Ok(json!({ "total": r.total_hits, "hits": r.hits }))
    })
    .await
}

fn kind_of(s: &str) -> R<content::Kind> {
    Ok(match s {
        "mod" => content::Kind::Mod,
        "resourcepack" => content::Kind::ResourcePack,
        "shader" => content::Kind::Shader,
        "datapack" => content::Kind::DataPack,
        _ => return Err("Unknown project type".into()),
    })
}

fn ledger_path(inst: &Instance) -> PathBuf {
    inst.game_dir().join("luminos-installed.json")
}

#[tauri::command]
pub async fn store_install(instance: String, slug: String, kind: String) -> R<Vec<String>> {
    blocking(move || {
        let inst = find(&instance)?;
        let files = content::install_project(&inst, &slug, kind_of(&kind)?).map_err(err)?;
        let mut l: Vec<String> = std::fs::read_to_string(ledger_path(&inst)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        let key = format!("{kind}:{slug}");
        if !l.contains(&key) {
            l.push(key);
        }
        std::fs::write(ledger_path(&inst), serde_json::to_vec(&l).map_err(err)?).map_err(err)?;
        Ok(files)
    })
    .await
}

/// What counts as installed for "hide installed": items installed through the store, plus mod ids and pack file names found on disk.
#[tauri::command]
pub async fn store_installed(instance: String) -> R<Vec<String>> {
    blocking(move || {
        let inst = find(&instance)?;
        let gd = inst.game_dir();
        let mut out: Vec<String> = std::fs::read_to_string(ledger_path(&inst)).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        out.extend(livemod::list_mods(&gd).into_iter().map(|m| format!("mod:{}", m.id)));
        for (folder, kind) in [("resourcepacks", "resourcepack"), ("shaderpacks", "shader"), ("datapacks", "datapack")] {
            if let Ok(rd) = std::fs::read_dir(gd.join(folder)) {
                out.extend(rd.flatten().map(|e| format!("{kind}:{}", e.path().file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default())));
            }
        }
        Ok(out)
    })
    .await
}

// ------------------------------------------------------------------------------------------------ dedup, deps, redact

fn dedup_dirs() -> (Vec<Instance>, Vec<PathBuf>) {
    let insts = instances::list();
    let dirs = insts.iter().flat_map(|i| ["mods", "resourcepacks", "shaderpacks"].map(|f| i.game_dir().join(f))).collect();
    (insts, dirs)
}

fn per_instance(insts: &[Instance], dirs: &[PathBuf], store: &Path) -> Value {
    let saved = dedup::saved_per_dir(store, dirs);
    let mut m = serde_json::Map::new();
    for (n, i) in insts.iter().enumerate() {
        m.insert(i.id.clone(), json!(saved[n * 3..n * 3 + 3].iter().sum::<u64>()));
    }
    Value::Object(m)
}

fn dedup_store() -> PathBuf {
    paths::root().join("dedup-store")
}

#[tauri::command]
pub async fn dedup_status() -> R<Value> {
    blocking(|| {
        let (insts, dirs) = dedup_dirs();
        let p = per_instance(&insts, &dirs, &dedup_store());
        let total: u64 = p.as_object().map(|m| m.values().filter_map(Value::as_u64).sum()).unwrap_or(0);
        Ok(json!({ "total_saved": total, "per_instance": p }))
    })
    .await
}

#[tauri::command]
pub async fn dedup_run() -> R<Value> {
    blocking(|| {
        let (insts, dirs) = dedup_dirs();
        let rep = dedup::dedup(&dirs, &dedup_store()).map_err(err)?;
        Ok(json!({ "report": rep, "per_instance": per_instance(&insts, &dirs, &dedup_store()), "total_saved": rep.bytes_saved_total }))
    })
    .await
}

#[tauri::command]
pub async fn deps_check(instance: String) -> R<Value> {
    blocking(move || {
        let mods = livemod::list_mods(&find(&instance)?.game_dir());
        let g = Graph::new(mods.iter().map(|m| ModNode { id: m.id.clone(), name: m.name.clone(), enabled: m.enabled, requires: m.requires.clone() }));
        let missing: Vec<Value> = g.missing().into_iter().map(|m| json!({ "mod": m.mod_id, "needs": m.needs })).collect();
        let required_by: serde_json::Map<String, Value> = mods.iter().map(|m| (m.id.clone(), json!(g.required_by(&m.id)))).collect();
        Ok(json!({ "missing": missing, "required_by": required_by }))
    })
    .await
}

#[tauri::command]
pub fn redact_scrub(text: String) -> String {
    redact::scrub(&text)
}

// ------------------------------------------------------------------------------------------------ Quick Play

#[tauri::command]
pub fn quickplay_parse(link: String) -> R<Value> {
    let l = quickplay::PlayLink::parse(&link).map_err(err)?;
    Ok(match l.target {
        quickplay::Target::World(w) => json!({ "instance": l.instance, "kind": "world", "value": w }),
        quickplay::Target::Server(s) => json!({ "instance": l.instance, "kind": "server", "value": s }),
    })
}

fn desktop() -> PathBuf {
    let home = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from).unwrap_or_default();
    let d = home.join("Desktop");
    if d.is_dir() {
        d
    } else {
        paths::root().join("shortcuts")
    }
}

/// Writes a `.url` shortcut that opens `luminos://play?...`. Registering the scheme with Windows is the installer's job (UNVERIFIED).
#[tauri::command]
pub async fn quickplay_shortcut(instance: String, kind: String, value: String) -> R<String> {
    blocking(move || {
        let inst = find(&instance)?;
        let target = if kind == "world" { quickplay::Target::World(value) } else { quickplay::Target::Server(value) };
        let link = quickplay::PlayLink { instance: inst.id.clone(), target };
        quickplay::PlayLink::parse(&link.to_link()).map_err(err)?; // refuse anything the parser would refuse
        let dir = desktop();
        std::fs::create_dir_all(&dir).map_err(err)?;
        let path = dir.join(link.shortcut_name());
        std::fs::write(&path, link.url_shortcut(None)).map_err(err)?;
        Ok(path.to_string_lossy().to_string())
    })
    .await
}

// ------------------------------------------------------------------------------------------------ presence

#[tauri::command]
pub fn presence_update(input: PresenceInput) -> Value {
    discord::set_base(input)
}

#[tauri::command]
pub fn presence_status() -> Value {
    discord::status()
}

#[tauri::command]
pub fn presence_preview(input: PresenceInput) -> Option<Value> {
    luminos_core::presence::build(&input)
}

// ------------------------------------------------------------------------------------------------ cross-instance sharing

#[tauri::command]
pub async fn shares_scan(saves: bool) -> R<Value> {
    blocking(move || {
        let t = shares::Targets { saves, ..Default::default() };
        Ok(json!({ "instances": refs().iter().map(|i| json!({ "id": i.id, "name": i.name })).collect::<Vec<_>>(), "disagreements": shares::scan(&refs(), &t) }))
    })
    .await
}

/// `choice` is an instance id, or `"both"` (saves only).
#[tauri::command]
pub async fn shares_resolve(item: String, choice: String) -> R<Vec<String>> {
    blocking(move || {
        let c = if choice == "both" { shares::Choice::KeepBoth } else { shares::Choice::Use(choice) };
        shares::resolve(&refs(), &item, &c, &paths::root().join("shares-backup")).map_err(err)
    })
    .await
}

// ------------------------------------------------------------------------------------------------ P2P bridge

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn enc(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { B64[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { B64[n as usize & 63] as char } else { '=' });
    }
    out
}

fn dec(s: &str) -> R<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut buf, mut bits) = (0u32, 0);
    for ch in s.bytes().filter(|b| *b != b'=') {
        let v = B64.iter().position(|b| *b == ch).ok_or("bad base64")? as u32;
        buf = buf << 6 | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

static BRIDGE: OnceLock<Arc<p2p::Bridge>> = OnceLock::new();

fn bridge(app: &AppHandle) -> Arc<p2p::Bridge> {
    BRIDGE
        .get_or_init(|| {
            let (a, b) = (app.clone(), app.clone());
            p2p::Bridge::new(
                Arc::new(move |conn, data| {
                    let _ = a.emit("p2p-data", json!({ "conn": conn, "b64": enc(&data) }));
                }),
                Arc::new(move |conn| {
                    let _ = b.emit("p2p-close", json!({ "conn": conn }));
                }),
            )
        })
        .clone()
}

#[tauri::command]
pub fn p2p_room_code() -> String {
    p2p::new_room_code()
}

/// Guest: open a loopback port. Add `localhost:<port>` as a server in Minecraft.
#[tauri::command]
pub async fn p2p_guest_listen(app: AppHandle) -> R<u16> {
    blocking(move || {
        let a = app.clone();
        bridge(&app).listen(Arc::new(move |conn| {
            let _ = a.emit("p2p-open", json!({ "conn": conn }));
        })).map_err(err)
    })
    .await
}

/// Host: connect one local socket to the world opened to LAN on `port`.
#[tauri::command]
pub async fn p2p_host_dial(app: AppHandle, port: u16) -> R<u32> {
    blocking(move || bridge(&app).dial(port).map_err(err)).await
}

#[tauri::command]
pub fn p2p_write(app: AppHandle, conn: u32, b64: String) -> R<()> {
    bridge(&app).write(conn, &dec(&b64)?).map_err(err)
}

#[tauri::command]
pub fn p2p_close(app: AppHandle, conn: u32) {
    bridge(&app).close(conn);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn base64_round_trips_every_length() {
        for n in 0..40usize {
            let d: Vec<u8> = (0..n).map(|i| (i * 37 + 11) as u8).collect();
            assert_eq!(dec(&enc(&d)).unwrap(), d);
        }
        assert!(dec("***").is_err());
    }
}
