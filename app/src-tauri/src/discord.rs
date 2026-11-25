//! Discord Rich Presence runner: owns the IPC connection, rebuilds the activity whenever the UI's settings or the game's
//! world/server change, and reconnects when Discord is started later.
//!
//! "Playing Luminos": Discord shows the *registered application's* name. Put that application's id in [`APP_ID`] (or set
//! `LUMINOS_DISCORD_CLIENT_ID`) and name the application "Luminos" in the Developer Portal (`docs/DISCORD.md`). With no id the
//! runner reports `no-app-id` and sends nothing, and the settings page says so. Nothing is faked.
use luminos_core::presence::{self, PresenceInput};
use serde_json::{json, Value};
use std::sync::{Condvar, Mutex, OnceLock};
use std::time::Duration;

/// The one-line change: paste the Discord Application ID (a public number, not a secret) between the quotes.
pub const APP_ID: &str = "";

#[derive(Default)]
struct Shared {
    base: Option<PresenceInput>,
    /// (state, server) reported by the in-game agent; overrides the UI's guess.
    world: Option<(String, Option<String>)>,
    status: String,
    detail: String,
    dirty: bool,
}

static SH: OnceLock<(Mutex<Shared>, Condvar)> = OnceLock::new();

fn sh() -> &'static (Mutex<Shared>, Condvar) {
    SH.get_or_init(|| (Mutex::new(Shared { status: "idle".into(), ..Default::default() }), Condvar::new()))
}

fn app_id() -> Option<String> {
    let e = std::env::var("LUMINOS_DISCORD_CLIENT_ID").unwrap_or_default();
    let id = if e.is_empty() { APP_ID.to_string() } else { e };
    (!id.is_empty() && id.chars().all(|c| c.is_ascii_digit())).then_some(id)
}

fn effective(g: &Shared) -> Option<PresenceInput> {
    let mut i = g.base.clone()?;
    if let Some((state, server)) = &g.world {
        i.state = state.clone();
        if server.is_some() {
            i.server_address = server.clone();
        }
    }
    Some(i)
}

pub fn set_base(i: PresenceInput) -> Value {
    let (m, cv) = sh();
    {
        let mut g = m.lock().unwrap_or_else(|e| e.into_inner());
        g.base = Some(i);
        g.dirty = true;
    }
    cv.notify_all();
    status()
}

pub fn set_world(state: &str, server: Option<String>) {
    let (m, cv) = sh();
    {
        let mut g = m.lock().unwrap_or_else(|e| e.into_inner());
        let new = Some((state.to_string(), server));
        if g.world != new {
            g.world = new;
            g.dirty = true;
        }
    }
    cv.notify_all();
}

pub fn clear_world() {
    let (m, cv) = sh();
    m.lock().unwrap_or_else(|e| e.into_inner()).world = None;
    cv.notify_all();
}

pub fn status() -> Value {
    let g = sh().0.lock().unwrap_or_else(|e| e.into_inner());
    let st = if app_id().is_none() { "no-app-id" } else { g.status.as_str() };
    json!({ "state": st, "detail": if app_id().is_none() { "No Discord application id is set (docs/DISCORD.md), so nothing is sent." } else { g.detail.as_str() } })
}

fn note(status: &str, detail: &str) {
    let mut g = sh().0.lock().unwrap_or_else(|e| e.into_inner());
    g.status = status.into();
    g.detail = detail.into();
}

pub fn start() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        std::thread::spawn(|| {
            let mut client: Option<presence::Client<presence::Stream>> = None;
            loop {
                let (m, cv) = sh();
                let input = {
                    let mut g = m.lock().unwrap_or_else(|e| e.into_inner());
                    if !g.dirty {
                        g = cv.wait_timeout(g, Duration::from_secs(10)).unwrap_or_else(|e| e.into_inner()).0;
                    }
                    g.dirty = false;
                    effective(&g)
                };
                let (Some(id), Some(input)) = (app_id(), input) else { continue };
                if client.is_none() {
                    note("connecting", "Looking for Discord…");
                    match presence::connect().and_then(|s| presence::Client::handshake(s, &id)) {
                        Ok(c) => client = Some(c),
                        Err(e) => {
                            note("waiting", &format!("Discord is not running ({e:#}). Will retry."));
                            continue;
                        }
                    }
                }
                let activity = presence::build(&input);
                match client.as_mut().map(|c| c.set_activity(activity.as_ref())) {
                    Some(Ok(())) => note("connected", if activity.is_some() { "Presence is showing" } else { "Presence is off" }),
                    Some(Err(e)) => {
                        client = None;
                        note("waiting", &format!("Lost Discord ({e:#}). Will retry."));
                        sh().0.lock().unwrap_or_else(|e| e.into_inner()).dirty = true;
                    }
                    None => {}
                }
            }
        });
    });
}
