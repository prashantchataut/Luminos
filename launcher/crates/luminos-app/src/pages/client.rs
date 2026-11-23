//! Luminos Client, inside the launcher. One product, one config: every switch here edits the same
//! `config/luminos-client.json` the in-game menu (Right Shift) reads and writes.
use crate::{
    app::{App, Msg, Page, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{self, Ui};
use luminos_core::{
    content::{self, Kind},
    instances::Instance,
    preset,
};
use serde_json::{json, Value};

/// HUD modules of the client (ids match `Modules.java`).
const MODULES: [(&str, &str, &str); 7] = [
    ("armor_hud", "Armor HUD", "Durability of what you wear."),
    ("keystrokes", "Keystrokes", "WASD, mouse buttons and space on screen."),
    ("cps", "CPS", "Clicks per second."),
    ("fps", "FPS", "Frames per second."),
    ("coords", "Coordinates", "Where you are and which way you face."),
    ("potions", "Potion effects", "Active effects with timers."),
    ("sprint_status", "Sprint status", "Shows when toggle sprint is on."),
];

pub struct ClientState {
    pub loaded_for: f64,
    pub instance: Option<Instance>,
    pub cfg: Value,
    pub mods: Vec<content::Entry>,
}

impl Default for ClientState {
    fn default() -> Self {
        Self { loaded_for: -1.0, instance: None, cfg: json!({}), mods: vec![] }
    }
}

fn has_client(inst: &Instance) -> bool {
    content::list(inst, Kind::Mod).iter().any(|e| e.file.starts_with("luminos-client") && !e.file.contains("sources"))
}

fn cfg_path(inst: &Instance) -> std::path::PathBuf {
    inst.game_dir().join("config").join("luminos-client.json")
}

fn reload(app: &mut App) {
    if !app.persist {
        return;
    }
    let mut cands: Vec<Instance> = app.instances.iter().filter(|i| has_client(i)).cloned().collect();
    cands.sort_by_key(|i| std::cmp::Reverse(i.last_played.unwrap_or(0)));
    let inst = cands.into_iter().next();
    app.client.cfg = inst.as_ref().and_then(|i| std::fs::read_to_string(cfg_path(i)).ok()).and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_else(|| json!({}));
    app.client.mods = inst.as_ref().map(|i| content::list(i, Kind::Mod)).unwrap_or_default();
    app.client.instance = inst;
    app.client.loaded_for = app.page_t0;
}

fn save(app: &mut App) {
    let Some(inst) = &app.client.instance else { return };
    let p = cfg_path(inst);
    if let Some(d) = p.parent() {
        let _ = std::fs::create_dir_all(d);
    }
    if let Err(e) = luminos_core::store::write_json(&p, &app.client.cfg) {
        app.toast(format!("Couldn't save the client config: {e:#}"), ToastKind::Bad);
    }
}

fn get_bool(cfg: &Value, path: &[&str], default: bool) -> bool {
    path.iter().try_fold(cfg, |v, k| v.get(*k)).and_then(Value::as_bool).unwrap_or(default)
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    if app.client.loaded_for != app.page_t0 {
        reload(app);
    }
    widgets::heading(ui, "Luminos Client");
    widgets::muted(ui, "The launcher and the client are one product. These switches edit the same file as the in-game menu (Right Shift), so they always agree.");
    ui.add_space(10.0);

    let Some(inst) = app.client.instance.clone() else {
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(egui::RichText::new("No instance has Luminos Client yet").font(egui::FontId::new(16.0, theme::bold())));
            widgets::muted(ui, "Create an instance with the Luminos Client preset (Fabric + the performance stack + the HUD mod) and it shows up here.");
            ui.add_space(6.0);
            if widgets::button(ui, accent, "Create an instance", Some(Icon::Plus), Btn::Primary, true).clicked() {
                app.goto(Page::Library);
            }
        });
        return;
    };

    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(ui, &inst.name, &format!("{} · {} · config/luminos-client.json", inst.loader.label(), inst.mc_version), |ui| {
            if widgets::button(ui, accent, "Open folder", Some(Icon::Folder), Btn::Ghost, true).clicked() {
                let _ = open::that(inst.game_dir());
            }
        });
    });

    let mut dirty = false;
    widgets::subheading(ui, "HUD modules");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        for (id, name, desc) in MODULES {
            let mut on = get_bool(&app.client.cfg, &["modules", id, "enabled"], true);
            widgets::setting_row(ui, name, desc, |ui| {
                if widgets::toggle(ui, accent, &mut on).changed() {
                    dirty = true;
                }
            });
            if dirty && app.client.cfg["modules"][id]["enabled"].as_bool() != Some(on) {
                if !app.client.cfg["modules"].is_object() {
                    app.client.cfg["modules"] = json!({});
                }
                if !app.client.cfg["modules"][id].is_object() {
                    app.client.cfg["modules"][id] = json!({ "enabled": on, "x": 0, "y": 0, "scale": 1.0 });
                }
                app.client.cfg["modules"][id]["enabled"] = json!(on);
            }
        }
        widgets::muted(ui, "Positions and sizes are edited in game with the HUD editor, where you can see them.");
    });

    widgets::subheading(ui, "Movement and camera");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        let mut sprint = get_bool(&app.client.cfg, &["toggleSprint"], false);
        widgets::setting_row(ui, "Toggle sprint", "Tap once to sprint, tap again to stop.", |ui| {
            if widgets::toggle(ui, accent, &mut sprint).changed() {
                app.client.cfg["toggleSprint"] = json!(sprint);
                dirty = true;
            }
        });
        let mut bg = get_bool(&app.client.cfg, &["showBackground"], true);
        widgets::setting_row(ui, "HUD background", "A faint panel behind HUD text so it stays readable.", |ui| {
            if widgets::toggle(ui, accent, &mut bg).changed() {
                app.client.cfg["showBackground"] = json!(bg);
                dirty = true;
            }
        });
        let mut fov = app.client.cfg["zoomFov"].as_i64().unwrap_or(30) as i32;
        widgets::setting_row(ui, "Zoom FOV", &format!("{fov}° while the zoom key is held (lower is closer)"), |_| {});
        ui.spacing_mut().slider_width = ui.available_width() - 80.0;
        if ui.add(egui::Slider::new(&mut fov, 5..=110).suffix("°")).changed() {
            app.client.cfg["zoomFov"] = json!(fov);
            dirty = true;
        }
    });

    widgets::subheading(ui, "Optional mods");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::muted(ui, "Downloaded from Modrinth with hash checks. Switch them on or off any time; nothing is touched without you.");
        ui.add_space(4.0);
        let mut toggle: Option<(String, bool)> = None;
        let mut install: Option<&'static str> = None;
        for m in preset::OPTIONAL {
            let found = app.client.mods.iter().find(|e| e.file.to_lowercase().contains(m.file_key)).cloned();
            widgets::setting_row(ui, m.name, m.why, |ui| match &found {
                Some(e) => {
                    let mut on = e.enabled;
                    if widgets::toggle(ui, accent, &mut on).changed() {
                        toggle = Some((e.file.clone(), on));
                    }
                }
                None => {
                    if widgets::button(ui, accent, "Install", Some(Icon::Download), Btn::Secondary, true).clicked() {
                        install = Some(m.slug);
                    }
                }
            });
        }
        if let Some((file, on)) = toggle {
            match content::set_enabled(&inst, Kind::Mod, &file, on) {
                Ok(()) => reload(app),
                Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
            }
        }
        if let Some(slug) = install {
            let (bg, inst) = (app.bg(), inst.clone());
            app.toast(format!("Installing {slug}…"), ToastKind::Info);
            std::thread::spawn(move || match content::install_project(&inst, slug, Kind::Mod) {
                Ok(_) => {
                    bg.send(Msg::Toast(format!("{slug} installed"), ToastKind::Good));
                    bg.send(Msg::Content);
                }
                Err(e) => bg.send(Msg::Toast(format!("Couldn't install {slug}: {e:#}"), ToastKind::Bad)),
            });
            app.client.loaded_for = -1.0;
        }
    });

    if dirty {
        save(app);
    }
}
