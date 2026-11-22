//! Instance detail: header, stats, and tabs for content, worlds, logs and settings.
use super::library::ago;
use crate::{
    app::{App, DTab, Loadable, Msg, Page, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use luminos_core::{
    content::{self, Entry, Kind},
    instances::{self, Instance},
    store,
};
use eframe::egui::{self, pos2, vec2, Align, Align2, Color32, CornerRadius, FontId, Layout, Rect, Sense, Stroke, StrokeKind, Ui, UiBuilder};

pub fn ui(app: &mut App, ui: &mut Ui, id: &str) {
    let accent = app.accent();
    let Some(inst) = app.instance(id).cloned() else {
        widgets::muted(ui, "This instance no longer exists.");
        if widgets::button(ui, accent, "Back to library", Some(Icon::Back), Btn::Secondary, true).clicked() {
            app.goto(Page::Library);
        }
        return;
    };
    if widgets::button_sized(ui, accent, "Back", Some(Icon::Back), Btn::Ghost, true, 0.0, 32.0).clicked() {
        app.goto(Page::Library);
    }
    header(app, ui, &inst);
    ui.add_space(6.0);
    // tabs
    ui.horizontal(|ui| {
        for (tab, label, icon) in [(DTab::Content, "Content", Icon::Layers), (DTab::Worlds, "Worlds", Icon::Compass), (DTab::Logs, "Logs", Icon::Clock), (DTab::Settings, "Settings", Icon::Gear)] {
            let sel = app.detail.tab == tab;
            let g = ui.painter().layout_no_wrap(label.into(), FontId::new(15.0, if sel { theme::bold() } else { egui::FontFamily::Proportional }), Color32::WHITE);
            let (r, resp) = ui.allocate_exact_size(vec2(g.size().x + 52.0, 38.0), Sense::click());
            let a = ui.ctx().animate_bool_with_time(resp.id, sel, 0.2);
            let h = ui.ctx().animate_bool_with_time(resp.id.with("h"), resp.hovered(), 0.12);
            let col = theme::mix(theme::MUTED, accent, a).gamma_multiply(1.0);
            let col = theme::mix(col, Color32::WHITE, h * 0.4 * (1.0 - a));
            icons_paint(ui, icon, r.left_center() + vec2(18.0, 0.0), col);
            ui.painter().galley(pos2(r.left() + 36.0, r.center().y - g.size().y / 2.0), g, col);
            ui.painter().rect_filled(Rect::from_min_size(pos2(r.left() + 6.0, r.bottom() - 2.0), vec2((r.width() - 12.0) * a, 2.5)), CornerRadius::same(2), accent);
            if resp.on_hover_cursor(egui::CursorIcon::PointingHand).clicked() {
                app.detail.tab = tab;
            }
        }
    });
    let y = ui.cursor().min.y;
    ui.painter().line_segment([pos2(ui.min_rect().left(), y), pos2(ui.min_rect().right(), y)], Stroke::new(1.0, theme::LINE));
    ui.add_space(8.0);
    match app.detail.tab {
        DTab::Content => content_tab(app, ui, &inst),
        DTab::Worlds => worlds_tab(app, ui, &inst),
        DTab::Logs => logs_tab(app, ui, &inst),
        DTab::Settings => settings_tab(app, ui, &inst),
    }
}

fn icons_paint(ui: &Ui, icon: Icon, c: egui::Pos2, col: Color32) {
    crate::icons::paint(ui.painter(), icon, c, 17.0, col);
}

fn header(app: &mut App, ui: &mut Ui, inst: &Instance) {
    let accent = app.accent();
    let running = app.game.as_ref().map(|g| g.instance_id == inst.id).unwrap_or(false);
    let launching = app.launching.as_ref().map(|l| l.id == inst.id).unwrap_or(false);
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            let (r, _) = ui.allocate_exact_size(vec2(88.0, 88.0), Sense::hover());
            widgets::instance_icon(ui, r, &inst.name, inst.color);
            ui.vertical(|ui| {
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    widgets::pill(ui, inst.loader.label(), accent);
                    widgets::pill(ui, &format!("MC {}", inst.mc_version), theme::MUTED);
                    if inst.preset.is_some() {
                        widgets::pill(ui, "Luminos Client", theme::GOOD);
                    }
                });
                ui.label(egui::RichText::new(&inst.name).font(FontId::new(30.0, theme::bold())));
            });
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                let (label, kind, enabled) = if running {
                    ("Stop", Btn::Danger, true)
                } else if launching {
                    ("Launching…", Btn::Secondary, false)
                } else {
                    ("Play", Btn::Primary, true)
                };
                if widgets::button_sized(ui, accent, label, Some(if running { Icon::Stop } else { Icon::Play }), kind, enabled, 190.0, 52.0).clicked() {
                    if running {
                        if let Some(g) = &app.game {
                            g.kill();
                        }
                    } else {
                        app.play(&inst.id);
                    }
                }
            });
        });
        ui.add_space(6.0);
        let y = ui.cursor().min.y;
        ui.painter().line_segment([pos2(ui.min_rect().left(), y), pos2(ui.min_rect().right(), y)], Stroke::new(1.0, theme::LINE));
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            let status = if running { ("Playing now", theme::GOOD) } else if launching { ("Launching…", accent) } else { ("Ready to play", theme::TEXT) };
            let updates = app.detail.updates.ready().map(|u| u.len()).unwrap_or(0);
            let cells: [(&str, String, Color32); 3] = [
                ("Status", if updates > 0 && !running { format!("{updates} updates available") } else { status.0.to_string() }, if updates > 0 && !running { theme::WARN } else { status.1 }),
                ("Last played", ago(inst.last_played), theme::TEXT),
                ("Playtime", store::fmt_duration(inst.playtime_secs), theme::TEXT),
            ];
            let w = (ui.available_width() - 170.0) / 3.0;
            for (k, v, c) in cells {
                ui.vertical(|ui| {
                    ui.set_width(w);
                    widgets::eyebrow(ui, k);
                    ui.label(egui::RichText::new(v).font(FontId::new(16.0, theme::bold())).color(c));
                });
            }
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                if widgets::button_sized(ui, accent, "Folder", Some(Icon::Folder), Btn::Secondary, true, 0.0, 34.0).clicked() {
                    let _ = open::that(inst.game_dir());
                }
            });
        });
    });
}

fn content_tab(app: &mut App, ui: &mut Ui, inst: &Instance) {
    let accent = app.accent();
    // kind selector + actions
    ui.horizontal_wrapped(|ui| {
        for k in Kind::ALL {
            let n = if k == app.detail.kind { app.detail.entries.len() } else { 0 };
            let label = if k == app.detail.kind { format!("{} · {}", k.label(), n) } else { k.label().to_string() };
            if widgets::chip(ui, accent, &label, None, app.detail.kind == k).clicked() {
                app.detail.kind = k;
                app.reload_content();
            }
        }
    });
    ui.add_space(2.0);
    ui.horizontal(|ui| {
        ui.add(egui::TextEdit::singleline(&mut app.detail.filter).hint_text("Search installed…").desired_width(220.0).margin(egui::Margin::symmetric(10, 8)));
        let busy = app.detail.busy.clone();
        if widgets::icon_button(ui, accent, Icon::Refresh, "Check for updates", false).clicked() && busy.is_none() && app.persist {
            app.detail.updates = Loadable::Loading;
            let (i2, bg) = (inst.clone(), app.bg());
            std::thread::spawn(move || bg.send(Msg::Updates(content::check_updates(&i2).map_err(|e| format!("{e:#}")))));
        }
        let n_updates = app.detail.updates.ready().map(|u| u.len()).unwrap_or(0);
        if n_updates > 0 && widgets::button_sized(ui, accent, &format!("Update all ({n_updates})"), Some(Icon::Download), Btn::Primary, busy.is_none(), 0.0, 34.0).clicked() && app.persist {
            app.detail.busy = Some("Updating…".into());
            let (i2, bg) = (inst.clone(), app.bg());
            std::thread::spawn(move || {
                let r = content::update_all(&i2);
                bg.send(Msg::Busy(None));
                bg.send(Msg::Content);
                bg.send(Msg::Updates(Ok(vec![])));
                bg.send(Msg::Toast(match r { Ok(n) => format!("Updated {n} item(s)"), Err(e) => format!("Update failed: {e:#}") }, ToastKind::Good));
            });
        }
        if widgets::button_sized(ui, accent, "Identify", Some(Icon::Link), Btn::Secondary, busy.is_none(), 0.0, 34.0).on_hover_text("Link untracked files to Modrinth so they can be updated").clicked() && app.persist {
            app.detail.busy = Some("Identifying…".into());
            let (i2, bg, kind) = (inst.clone(), app.bg(), app.detail.kind);
            std::thread::spawn(move || {
                let r = content::identify(&i2, kind);
                bg.send(Msg::Busy(None));
                bg.send(Msg::Content);
                bg.send(Msg::Toast(match r { Ok(n) => format!("Linked {n} file(s) to Modrinth"), Err(e) => format!("Identify failed: {e:#}") }, ToastKind::Info));
            });
        }
        if let Some(b) = &busy {
            let dots = ".".repeat(((app.time * 3.0) as usize) % 4);
            ui.label(egui::RichText::new(format!("{b}{dots}")).color(accent));
            ui.ctx().request_repaint_after(std::time::Duration::from_millis(200));
        }
        if app.detail.updates.is_loading() {
            ui.label(egui::RichText::new("Checking…").color(theme::MUTED));
        }
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Add", Some(Icon::Plus), Btn::Primary, true, 100.0, 34.0).clicked() {
                app.discover.target = Some(inst.id.clone());
                app.discover.kind = app.detail.kind.project_type();
                app.discover.key.clear();
                app.goto(Page::Discover);
            }
        });
    });
    ui.add_space(4.0);
    let filter = app.detail.filter.to_lowercase();
    let entries: Vec<Entry> = app.detail.entries.iter().filter(|e| filter.is_empty() || e.display_name.to_lowercase().contains(&filter)).cloned().collect();
    if entries.is_empty() {
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.add_space(14.0);
            ui.vertical_centered(|ui| {
                widgets::subheading(ui, &format!("No {} yet", app.detail.kind.label().to_lowercase()));
                widgets::muted(ui, "Press Add to browse Modrinth, or drop files into the instance folder and press Identify.");
            });
            ui.add_space(14.0);
        });
        return;
    }
    let updates = app.detail.updates.ready().cloned().unwrap_or_default();
    let kind = app.detail.kind;
    let mut act: Option<(String, &'static str)> = None;
    for (i, e) in entries.iter().enumerate() {
        let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 66.0), Sense::hover());
        let hovered = ui.rect_contains_pointer(r);
        let p = ui.painter();
        p.rect_filled(r, CornerRadius::same(14), theme::mix(theme::BG2, theme::BG3, if hovered { 1.0 } else { 0.0 }));
        p.rect_stroke(r, CornerRadius::same(14), Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
        let ir = Rect::from_min_size(r.min + vec2(10.0, 11.0), vec2(44.0, 44.0));
        let seed = e.display_name.bytes().fold(i as u8, |a, b| a.wrapping_add(b));
        app.paint_remote(ui, ir, e.icon_url.as_deref(), 10, |ui| widgets::instance_icon(ui, ir, &e.display_name, seed));
        let alpha = if e.enabled { 255 } else { 120 };
        let g = ui.painter().layout_no_wrap(e.display_name.clone(), FontId::new(15.0, theme::bold()), theme::alpha(theme::TEXT, alpha));
        let gw = g.size().x.min(r.width() * 0.35);
        ui.painter().galley(pos2(r.left() + 66.0, r.top() + 11.0), g, theme::alpha(theme::TEXT, alpha));
        let mut x = r.left() + 66.0 + gw + 10.0;
        if !e.version.is_empty() {
            let vg = ui.painter().layout_no_wrap(e.version.clone(), FontId::new(11.5, egui::FontFamily::Monospace), theme::MUTED);
            let vr = Rect::from_min_size(pos2(x, r.top() + 13.0), vec2(vg.size().x + 14.0, 20.0));
            ui.painter().rect_filled(vr, CornerRadius::same(7), theme::BG0);
            ui.painter().galley(pos2(vr.left() + 7.0, vr.center().y - vg.size().y / 2.0), vg, theme::MUTED);
            x = vr.right() + 8.0;
        }
        let (ic, col) = if e.linked { (Icon::Link, theme::GOOD) } else { (Icon::Close, theme::MUTED) };
        crate::icons::paint(ui.painter(), ic, pos2(x + 8.0, r.top() + 23.0), 13.0, col);
        let sub = if e.description.is_empty() { format!("{} · not linked to Modrinth", store::fmt_count(e.size)) } else { e.description.clone() };
        let sg = ui.painter().layout(sub, FontId::new(12.5, egui::FontFamily::Proportional), theme::MUTED, r.width() - 330.0);
        let sg = if sg.rows.len() > 1 { ui.painter().layout(format!("{}…", e.description.chars().take(70).collect::<String>()), FontId::new(12.5, egui::FontFamily::Proportional), theme::MUTED, r.width() - 330.0) } else { sg };
        ui.painter().galley(pos2(r.left() + 66.0, r.top() + 36.0), sg, theme::MUTED);
        // controls
        let ctrl = Rect::from_min_max(pos2(r.right() - 270.0, r.top() + 6.0), pos2(r.right() - 10.0, r.bottom() - 6.0));
        ui.scope_builder(UiBuilder::new().max_rect(ctrl).layout(Layout::right_to_left(Align::Center)), |ui| {
            if widgets::icon_button(ui, accent, Icon::Trash, "Delete", true).clicked() {
                act = Some((e.file.clone(), "delete"));
            }
            let mut on = e.enabled;
            if widgets::toggle(ui, accent, &mut on).changed() {
                act = Some((e.file.clone(), "toggle"));
            }
            if e.linked && widgets::icon_button(ui, accent, Icon::Link, "Unlink (stop auto-updating this file)", false).clicked() {
                act = Some((e.file.clone(), "unlink"));
            }
            if let Some(u) = updates.iter().find(|u| u.file == e.file && u.kind == kind) {
                if widgets::button_sized(ui, accent, &format!("→ {}", u.to.version_number.chars().take(12).collect::<String>()), Some(Icon::Download), Btn::Primary, app.detail.busy.is_none(), 0.0, 30.0).on_hover_text(format!("Update from {} to {}", u.from, u.to.version_number)).clicked() {
                    act = Some((e.file.clone(), "update"));
                }
            }
        });
    }
    if let Some((file, what)) = act {
        let inst = inst.clone();
        match what {
            "toggle" => {
                let enabled = file.ends_with(".disabled");
                let _ = content::set_enabled(&inst, kind, &file, enabled);
                app.reload_content();
            }
            "delete" => {
                let _ = content::remove(&inst, kind, &file);
                app.reload_content();
                app.toast("Removed from instance", ToastKind::Info);
            }
            "unlink" => {
                content::unlink(&inst, kind, &file);
                app.reload_content();
                app.toast("Unlinked — this file will no longer auto-update", ToastKind::Info);
            }
            "update" => {
                if let Some(u) = updates.into_iter().find(|u| u.file == file && u.kind == kind) {
                    app.detail.busy = Some(format!("Updating {}", u.name));
                    let bg = app.bg();
                    std::thread::spawn(move || {
                        let r = content::apply_update(&inst, &u);
                        bg.send(Msg::Busy(None));
                        bg.send(Msg::Content);
                        let msg = match r { Ok(()) => format!("Updated {}", u.name), Err(e) => format!("Update failed: {e:#}") };
                        bg.send(Msg::Toast(msg, ToastKind::Good));
                        let fresh = content::check_updates(&inst).map_err(|e| format!("{e:#}"));
                        bg.send(Msg::Updates(fresh));
                    });
                }
            }
            _ => {}
        }
    }
}

fn worlds_tab(app: &mut App, ui: &mut Ui, inst: &Instance) {
    let accent = app.accent();
    let worlds = if app.persist { instances::worlds(inst) } else { vec![] };
    ui.horizontal(|ui| {
        widgets::subheading(ui, &format!("{} world{}", worlds.len(), if worlds.len() == 1 { "" } else { "s" }));
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Open saves", Some(Icon::Folder), Btn::Secondary, true, 0.0, 34.0).clicked() {
                let _ = open::that(inst.game_dir().join("saves"));
            }
        });
    });
    if worlds.is_empty() {
        widgets::muted(ui, "No worlds yet. Launch the game and create one!");
    }
    for w in worlds {
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                crate::icons::paint(ui.painter(), Icon::Compass, ui.cursor().min + vec2(12.0, 14.0), 22.0, accent);
                ui.add_space(34.0);
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new(&w.name).font(FontId::new(15.0, theme::bold())));
                    widgets::muted(ui, &format!("Last played {}", ago(Some(w.modified))));
                });
            });
        });
    }
}

fn logs_tab(app: &mut App, ui: &mut Ui, inst: &Instance) {
    let accent = app.accent();
    let lines: Vec<String> = match &app.game {
        Some(g) if g.instance_id == inst.id => g.log_tail(600),
        _ => app.last_log.clone(),
    };
    ui.horizontal(|ui| {
        widgets::subheading(ui, "Game output");
        ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Copy", None, Btn::Secondary, !lines.is_empty(), 0.0, 32.0).clicked() {
                ui.ctx().copy_text(lines.join("\n"));
                app.toast("Log copied to clipboard", ToastKind::Good);
            }
        });
    });
    egui::Frame::new().fill(theme::BG0).corner_radius(CornerRadius::same(12)).inner_margin(egui::Margin::same(12)).stroke(Stroke::new(1.0, theme::LINE)).show(ui, |ui| {
        ui.set_width(ui.available_width());
        egui::ScrollArea::vertical().max_height(360.0).stick_to_bottom(true).auto_shrink([false, true]).show(ui, |ui| {
            if lines.is_empty() {
                widgets::muted(ui, "Nothing here yet — launch the game to see its output.");
            }
            for l in &lines {
                let col = if l.contains("ERROR") || l.starts_with("[stderr]") { theme::BAD } else if l.contains("WARN") { theme::WARN } else { theme::MUTED };
                ui.label(egui::RichText::new(l).monospace().size(11.5).color(col));
            }
        });
    });
}

fn settings_tab(app: &mut App, ui: &mut Ui, inst: &Instance) {
    let accent = app.accent();
    let mut i = inst.clone();
    let mut changed = false;
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "General");
        changed |= ui.add(egui::TextEdit::singleline(&mut i.name).desired_width(f32::INFINITY).margin(egui::Margin::symmetric(10, 8))).changed();
        ui.add_space(4.0);
        widgets::eyebrow(ui, "Memory");
        let mut custom = i.memory_mb.is_some();
        widgets::setting_row(ui, "Override global memory", &format!("Global default is {:.1} GB", app.settings.memory_mb as f32 / 1024.0), |ui| {
            if widgets::toggle(ui, accent, &mut custom).changed() {
                i.memory_mb = if custom { Some(app.settings.memory_mb) } else { None };
                changed = true;
            }
        });
        if let Some(m) = &mut i.memory_mb {
            ui.spacing_mut().slider_width = ui.available_width() - 100.0;
            changed |= ui.add(egui::Slider::new(m, 1024..=luminos_core::config::system_memory_mb().max(2048)).step_by(512.0).suffix(" MB")).changed();
        }
        ui.add_space(4.0);
        widgets::eyebrow(ui, "Extra JVM arguments");
        changed |= ui.add(egui::TextEdit::singleline(&mut i.jvm_args).hint_text("-Dexample=1").desired_width(f32::INFINITY).margin(egui::Margin::symmetric(10, 8))).changed();
        widgets::eyebrow(ui, "Notes");
        changed |= ui.add(egui::TextEdit::multiline(&mut i.notes).desired_rows(3).desired_width(f32::INFINITY)).changed();
    });
    ui.horizontal(|ui| {
        if widgets::button(ui, accent, "Duplicate", Some(Icon::Layers), Btn::Secondary, true).clicked() && app.persist {
            match instances::duplicate(&inst.id) {
                Ok(c) => {
                    app.reload_instances();
                    app.toast(format!("Created {}", c.name), ToastKind::Good);
                }
                Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
            }
        }
        if app.detail.confirm_delete {
            if widgets::button(ui, accent, "Yes, delete forever", Some(Icon::Trash), Btn::Danger, true).clicked() {
                if app.persist {
                    let _ = instances::delete(&inst.id);
                    app.reload_instances();
                }
                app.detail.confirm_delete = false;
                app.goto(Page::Library);
            }
            if widgets::button(ui, accent, "Cancel", None, Btn::Ghost, true).clicked() {
                app.detail.confirm_delete = false;
            }
        } else if widgets::button(ui, accent, "Delete instance", Some(Icon::Trash), Btn::Danger, true).clicked() {
            app.detail.confirm_delete = true;
        }
    });
    if changed && app.persist {
        let _ = i.save();
        if let Some(slot) = app.instances.iter_mut().find(|x| x.id == i.id) {
            *slot = i;
        }
    }
    let _ = (Align2::CENTER_CENTER, pos2(0.0, 0.0), Stroke::NONE);
}
