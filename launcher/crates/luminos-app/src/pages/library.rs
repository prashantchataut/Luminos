//! Library: all instances as cards, plus the "create instance" dialog.
use crate::{
    app::{App, Msg, Page},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use luminos_core::{
    instances::{self, Loader},
    preset, store,
};
use eframe::egui::{self, pos2, vec2, Align, Align2, Color32, CornerRadius, FontId, Layout, Rect, Sense, Stroke, StrokeKind, Ui};

pub fn ago(ts: Option<i64>) -> String {
    let Some(ts) = ts else { return "Never".into() };
    let d = (store::now_unix() - ts).max(0);
    match d {
        0..=3599 => "Just now".into(),
        3600..=86_399 => "Today".into(),
        86_400..=172_799 => "Yesterday".into(),
        _ => format!("{} days ago", d / 86_400),
    }
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            widgets::heading(ui, "Library");
            widgets::muted(ui, &format!("{} instance{} · every instance has its own mods, packs and settings", app.instances.len(), if app.instances.len() == 1 { "" } else { "s" }));
        });
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "New instance", Some(Icon::Plus), Btn::Primary, true, 0.0, 44.0).clicked() {
                app.open_create();
            }
        });
    });
    ui.add_space(8.0);
    if app.instances.is_empty() {
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.add_space(30.0);
            ui.vertical_centered(|ui| {
                widgets::logo_mark(ui.painter(), ui.cursor().min + vec2(ui.available_width() / 2.0, 40.0), 64.0, accent, 0.5);
                ui.add_space(90.0);
                widgets::subheading(ui, "No instances yet");
                widgets::muted(ui, "Create one to start playing — or install a modpack from Discover.");
                ui.add_space(10.0);
                if widgets::button(ui, accent, "Create instance", Some(Icon::Plus), Btn::Primary, true).clicked() {
                    app.open_create();
                }
            });
            ui.add_space(30.0);
        });
        return;
    }
    let gap = 14.0;
    let cols = (((ui.available_width() + gap) / (300.0 + gap)).floor() as usize).max(1);
    let w = ((ui.available_width() - gap * (cols as f32 - 1.0)) / cols as f32).floor();
    let insts = app.instances.clone();
    for row in insts.chunks(cols) {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            for inst in row {
                let (r, resp) = ui.allocate_exact_size(vec2(w, 132.0), Sense::click());
                let h = ui.ctx().animate_bool_with_time(resp.id, resp.hovered(), 0.15);
                let rr = r.translate(vec2(0.0, -2.0 * h));
                let p = ui.painter();
                p.rect_filled(rr, CornerRadius::same(16), theme::mix(theme::BG2, theme::BG3, h));
                p.rect_stroke(rr, CornerRadius::same(16), Stroke::new(1.0, theme::mix(theme::LINE, accent, h)), StrokeKind::Inside);
                widgets::instance_icon(ui, Rect::from_min_size(rr.min + vec2(14.0, 14.0), vec2(60.0, 60.0)), &inst.name, inst.color);
                let p = ui.painter();
                let g = p.layout(inst.name.clone(), FontId::new(16.0, theme::bold()), theme::TEXT, w - 100.0);
                p.galley(rr.min + vec2(86.0, 16.0), g, theme::TEXT);
                p.text(rr.min + vec2(86.0, 44.0), Align2::LEFT_TOP, inst.subtitle(), FontId::new(13.0, egui::FontFamily::Proportional), theme::MUTED);
                p.text(rr.min + vec2(86.0, 62.0), Align2::LEFT_TOP, format!("{} played · {}", store::fmt_duration(inst.playtime_secs), ago(inst.last_played)), FontId::new(12.0, egui::FontFamily::Proportional), theme::MUTED);
                if inst.preset.is_some() {
                    p.text(rr.right_top() + vec2(-14.0, 18.0), Align2::RIGHT_CENTER, "CLIENT", FontId::new(10.5, theme::bold()), theme::mix(accent, Color32::WHITE, 0.4));
                }
                // play button
                let btn = Rect::from_min_size(rr.left_bottom() + vec2(14.0, -42.0), vec2(w - 28.0, 32.0));
                let running = app.game.as_ref().map(|g| g.instance_id == inst.id).unwrap_or(false);
                ui.scope_builder(egui::UiBuilder::new().max_rect(btn), |ui| {
                    if widgets::button_sized(ui, accent, if running { "Running" } else { "Play" }, Some(Icon::Play), if running { Btn::Secondary } else { Btn::Primary }, !running, btn.width(), 32.0).clicked() {
                        app.play(&inst.id);
                    }
                });
                if resp.on_hover_cursor(egui::CursorIcon::PointingHand).clicked() && ui.input(|i| i.pointer.interact_pos()).map(|p| !btn.contains(p)).unwrap_or(true) {
                    app.open_instance(&inst.id);
                }
            }
        });
        ui.add_space(4.0);
    }
}

pub fn create_dialog(app: &mut App, ui: &mut Ui, full: Rect) {
    if app.create.is_none() {
        return;
    }
    let accent = app.accent();
    let ctx = ui.ctx().clone();
    egui::Area::new(egui::Id::new("dim")).order(egui::Order::Middle).fixed_pos(full.min).show(&ctx, |ui| {
        ui.allocate_rect(full, Sense::click_and_drag());
        ui.painter().rect_filled(full, 0.0, Color32::from_black_alpha(170));
    });
    let mut close = false;
    let mut do_create = false;
    egui::Area::new(egui::Id::new("create_dialog")).order(egui::Order::Foreground).anchor(Align2::CENTER_CENTER, vec2(0.0, 0.0)).show(&ctx, |ui| {
        widgets::card(ui, |ui| {
            ui.set_width(520.0);
            ui.horizontal(|ui| {
                widgets::heading(ui, "New instance");
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    if widgets::icon_button(ui, accent, Icon::Close, "Close", false).clicked() {
                        close = true;
                    }
                });
            });
            let c = app.create.as_mut().unwrap();
            widgets::eyebrow(ui, "Name");
            ui.add(egui::TextEdit::singleline(&mut c.name).hint_text("My survival world").desired_width(f32::INFINITY).margin(egui::Margin::symmetric(12, 10)));
            widgets::eyebrow(ui, "Mod loader");
            ui.horizontal_wrapped(|ui| {
                for l in Loader::ALL {
                    let label = if l.supported() { l.label().to_string() } else { format!("{} · soon", l.label()) };
                    if widgets::chip(ui, accent, &label, None, c.loader == l).clicked() && l.supported() {
                        c.loader = l;
                    }
                }
            });
            widgets::eyebrow(ui, "Minecraft version");
            ui.horizontal(|ui| {
                let versions: Vec<String> = app.manifest.ready().map(|m| m.versions.iter().filter(|v| c.show_snapshots || v.kind == "release").take(80).map(|v| v.id.clone()).collect()).unwrap_or_default();
                egui::ComboBox::from_id_salt("create_ver").width(180.0).selected_text(if c.mc_version.is_empty() { "loading…".into() } else { c.mc_version.clone() }).show_ui(ui, |ui| {
                    for v in versions {
                        ui.selectable_value(&mut c.mc_version, v.clone(), v);
                    }
                });
                ui.label(egui::RichText::new("Snapshots").size(13.0).color(theme::MUTED));
                widgets::toggle(ui, accent, &mut c.show_snapshots);
            });
            if c.loader == Loader::Fabric {
                ui.add_space(4.0);
                widgets::setting_row(ui, "Install the Luminos Client bundle", &format!("{} optimisation, HUD and utility mods — Sodium, Lithium, Entity Culling, Armor HUD…", preset::LUMINOS_CLIENT.iter().filter(|m| m.default_on).count()), |ui| {
                    widgets::toggle(ui, accent, &mut c.preset_client);
                });
            }
            if let Some(e) = &c.error {
                ui.label(egui::RichText::new(e).color(theme::BAD).size(13.0));
            }
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                if c.busy {
                    ui.label(egui::RichText::new("Creating…").color(theme::MUTED));
                }
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    let ok = !c.name.trim().is_empty() && !c.mc_version.is_empty() && !c.busy;
                    if widgets::button_sized(ui, accent, "Create", Some(Icon::Check), Btn::Primary, ok, 130.0, 40.0).clicked() {
                        do_create = true;
                    }
                    if widgets::button_sized(ui, accent, "Cancel", None, Btn::Ghost, true, 0.0, 40.0).clicked() {
                        close = true;
                    }
                });
            });
        });
    });
    if do_create && app.persist {
        let c = app.create.as_mut().unwrap();
        c.busy = true;
        c.error = None;
        let (name, ver, loader, client) = (c.name.clone(), c.mc_version.clone(), c.loader, c.preset_client && c.loader == Loader::Fabric);
        let bg = app.bg();
        std::thread::spawn(move || {
            let run = || -> anyhow::Result<instances::Instance> {
                let mut inst = instances::create(&name, &ver, loader, None)?;
                if client {
                    let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT.iter().filter(|m| m.default_on).collect();
                    let rep = preset::install(&inst, &mods, |_, _, _| {});
                    inst.preset = Some("luminos-client".into());
                    inst.save()?;
                    if !rep.skipped.is_empty() {
                        bg.send(Msg::Toast(format!("{} bundle mods skipped (not available for {ver})", rep.skipped.len()), crate::app::ToastKind::Info));
                    }
                }
                Ok(inst)
            };
            bg.send(Msg::Created { result: run().map_err(|e| format!("{e:#}")), from_wizard: false });
        });
    }
    if close {
        app.create = None;
    }
    let _ = Page::Library;
}
