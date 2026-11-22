//! First-run experience: animated welcome, profile, performance, client choice, install.
use crate::{
    app::{App, Msg},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use luminos_core::{
    accounts::{self, Account},
    config, instances::{self, Loader}, java, preset,
};
use eframe::egui::{self, pos2, vec2, Align, Align2, Color32, CornerRadius, FontId, Layout, Rect, Sense, Stroke, StrokeKind, Ui, UiBuilder};
use std::sync::atomic::Ordering;

const STEPS: usize = 5;

fn go(app: &mut App, step: usize) {
    app.wizard.step = step;
    app.wizard.step_t0 = app.time;
}

pub fn wizard_ui(app: &mut App, ui: &mut Ui, body: Rect) {
    let step = app.wizard.step;
    let t = (((app.time - app.wizard.step_t0) / 0.55) as f32).clamp(0.0, 1.0);
    let ease = 1.0 - (1.0 - t).powi(3);
    if t < 1.0 || step == 0 {
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(16));
    }
    if step == 0 {
        welcome(app, ui, body);
    } else {
        let w = 740.0f32.min(body.width() - 40.0);
        let h = 590.0f32.min(body.height() - 40.0);
        let card = Rect::from_center_size(body.center() + vec2(0.0, 6.0 + (1.0 - ease) * 16.0), vec2(w, h));
        let p = ui.painter();
        p.rect_filled(card.translate(vec2(0.0, 10.0)).expand(4.0), CornerRadius::same(28), Color32::from_black_alpha((100.0 * ease) as u8));
        p.rect_filled(card, CornerRadius::same(24), theme::alpha(theme::BG1, (238.0 * ease) as u8));
        p.rect_stroke(card, CornerRadius::same(24), Stroke::new(1.0, theme::alpha(theme::LINE, (255.0 * ease) as u8)), StrokeKind::Inside);
        ui.scope_builder(UiBuilder::new().max_rect(card.shrink2(vec2(44.0, 36.0))), |ui| {
            ui.set_opacity(ease);
            match step {
                1 => profile(app, ui),
                2 => performance(app, ui),
                3 => choice(app, ui),
                _ => finish(app, ui),
            }
        });
    }
    // progress dots
    let accent = app.accent();
    let total_w = (STEPS as f32 - 1.0) * 22.0 + 34.0;
    let mut x = body.center().x - total_w / 2.0;
    let y = body.bottom() - 26.0;
    for i in 0..STEPS {
        let a = ui.ctx().animate_bool_with_time(egui::Id::new(("dot", i)), i == step, 0.3);
        let w = 10.0 + 24.0 * a;
        let r = Rect::from_min_size(pos2(x, y - 4.0), vec2(w, 8.0));
        ui.painter().rect_filled(r, CornerRadius::same(4), theme::mix(theme::BG3, accent, (if i <= step { 1.0f32 } else { 0.0 }).max(a)));
        x += w + 12.0;
    }
}

fn welcome(app: &mut App, ui: &mut Ui, body: Rect) {
    let accent = app.accent();
    let t = (app.time - app.wizard.step_t0) as f32;
    let c = body.center() + vec2(0.0, -70.0);
    let pulse = 0.6 + 0.4 * (app.time as f32 * 1.6).sin();
    let rise = (1.0 - (1.0 - (t / 0.9).clamp(0.0, 1.0)).powi(3)).clamp(0.0, 1.0);
    ui.set_opacity(1.0);
    widgets::logo_mark(ui.painter(), c + vec2(0.0, (1.0 - rise) * 30.0), 120.0 * (0.7 + 0.3 * rise), accent, pulse * rise);
    // letter-by-letter wordmark
    let word = "LUMINOS";
    let font = FontId::new(64.0, theme::bold());
    let letters: Vec<_> = word.chars().map(|ch| ui.painter().layout_no_wrap(ch.to_string(), font.clone(), Color32::WHITE)).collect();
    let spacing = 10.0;
    let total: f32 = letters.iter().map(|g| g.size().x).sum::<f32>() + spacing * (letters.len() as f32 - 1.0);
    let mut x = body.center().x - total / 2.0;
    let base_y = c.y + 100.0;
    for (i, g) in letters.into_iter().enumerate() {
        let a = ((t - 0.5 - i as f32 * 0.09) / 0.4).clamp(0.0, 1.0);
        let e = 1.0 - (1.0 - a).powi(3);
        let w = g.size().x;
        let col = theme::alpha(theme::mix(Color32::WHITE, accent, 0.0), (255.0 * e) as u8);
        ui.painter().galley(pos2(x, base_y + (1.0 - e) * 26.0), g, col);
        x += w + spacing;
    }
    // typewriter tagline
    let tag = "The launcher that respects your RAM — and your time.";
    let n = (((t - 1.5) * 38.0).max(0.0) as usize).min(tag.chars().count());
    let shown: String = tag.chars().take(n).collect();
    let cursor = if n < tag.chars().count() || (app.time * 2.0) as i64 % 2 == 0 { "▌" } else { " " };
    ui.painter().text(pos2(body.center().x, base_y + 96.0), Align2::CENTER_CENTER, format!("{shown}{cursor}"), FontId::new(17.0, egui::FontFamily::Proportional), theme::MUTED);
    // feature pills
    let feats = ["Mod library", "Auto-updates", "Skin studio", "Playtime stats", "Luminos Client"];
    let widths: Vec<f32> = feats.iter().map(|f| ui.painter().layout_no_wrap(f.to_string(), FontId::new(13.0, theme::bold()), Color32::WHITE).size().x + 30.0).collect();
    let total: f32 = widths.iter().sum::<f32>() + 10.0 * (feats.len() as f32 - 1.0);
    let mut x = body.center().x - total / 2.0;
    for (i, f) in feats.iter().enumerate() {
        let a = ((t - 3.0 - i as f32 * 0.12) / 0.5).clamp(0.0, 1.0);
        let r = Rect::from_min_size(pos2(x, base_y + 140.0 + (1.0 - a) * 12.0 + 3.0 * (app.time as f32 * 1.3 + i as f32).sin() * a), vec2(widths[i], 30.0));
        ui.painter().rect_filled(r, CornerRadius::same(15), theme::alpha(theme::BG2, (210.0 * a) as u8));
        ui.painter().rect_stroke(r, CornerRadius::same(15), Stroke::new(1.0, theme::alpha(accent, (110.0 * a) as u8)), StrokeKind::Inside);
        ui.painter().text(r.center(), Align2::CENTER_CENTER, *f, FontId::new(13.0, theme::bold()), theme::alpha(theme::TEXT, (255.0 * a) as u8));
        x += widths[i] + 10.0;
    }
    let a = ((t - 3.6) / 0.6).clamp(0.0, 1.0);
    let btn_rect = Rect::from_center_size(pos2(body.center().x, base_y + 215.0), vec2(240.0, 50.0));
    ui.scope_builder(UiBuilder::new().max_rect(btn_rect), |ui| {
        ui.set_opacity(a);
        if widgets::button_sized(ui, accent, "Get started", Some(Icon::Bolt), Btn::Primary, a > 0.9, 240.0, 50.0).clicked() {
            go(app, 1);
        }
    });
}

fn title(ui: &mut Ui, eyebrow: &str, heading: &str, sub: &str) {
    widgets::eyebrow(ui, eyebrow);
    ui.add_space(2.0);
    widgets::heading(ui, heading);
    widgets::muted(ui, sub);
    ui.add_space(14.0);
}

fn nav(app: &mut App, ui: &mut Ui, next_label: &str, next_ok: bool, back_to: usize) -> bool {
    let accent = app.accent();
    let mut next = false;
    ui.with_layout(Layout::bottom_up(Align::Min), |ui| {
        ui.horizontal(|ui| {
            if widgets::button_sized(ui, accent, "Back", Some(Icon::Back), Btn::Ghost, true, 110.0, 42.0).clicked() {
                go(app, back_to);
            }
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                next = widgets::button_sized(ui, accent, next_label, None, Btn::Primary, next_ok, 190.0, 42.0).clicked();
            });
        });
    });
    next
}

fn profile(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(ui, "Step 1 of 4", "Who's playing?", "Pick the name you'll use in-game. You can add more accounts later.");
    ui.horizontal(|ui| {
        let (r, _) = ui.allocate_exact_size(vec2(88.0, 88.0), Sense::hover());
        widgets::face(ui, r, None, &app.wizard.name);
        ui.vertical(|ui| {
            ui.add_space(8.0);
            let edit = egui::TextEdit::singleline(&mut app.wizard.name).hint_text("Username (3–16 letters, numbers, _)").desired_width(360.0).font(FontId::new(18.0, egui::FontFamily::Proportional)).margin(egui::Margin::symmetric(12, 10));
            ui.add(edit);
            let ok = accounts::valid_username(&app.wizard.name);
            if app.wizard.name.is_empty() {
                widgets::muted(ui, "Letters, numbers and underscores only.");
            } else if ok {
                ui.label(egui::RichText::new("Looks good").color(theme::GOOD).size(13.0));
            } else {
                ui.label(egui::RichText::new("Needs 3–16 characters: letters, numbers or _").color(theme::BAD).size(13.0));
            }
        });
    });
    ui.add_space(14.0);
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Offline UUID");
        let uuid = if accounts::valid_username(&app.wizard.name) { accounts::offline_uuid(&app.wizard.name) } else { "—".to_string() };
        ui.label(egui::RichText::new(uuid).monospace().size(14.0).color(theme::mix(accent, Color32::WHITE, 0.4)));
        widgets::muted(ui, "This is the same ID a vanilla server derives for an offline-mode player, so your worlds and inventories always match.");
    });
    ui.add_space(8.0);
    widgets::muted(ui, "Microsoft sign-in is on the roadmap — offline accounts are fully supported today.");
    let ok = accounts::valid_username(&app.wizard.name);
    if nav(app, ui, "Continue", ok, 0) {
        go(app, 2);
    }
}

fn performance(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(ui, "Step 2 of 4", "Tune for your machine", "Luminos picks sensible defaults — tweak them if you like.");
    let total = config::system_memory_mb();
    let rec = (total / 2).clamp(2048, 8192) / 512 * 512;
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(ui, "Game memory", &format!("{:.1} GB selected · {:.1} GB recommended · {:.1} GB installed", app.settings.memory_mb as f32 / 1024.0, rec as f32 / 1024.0, total as f32 / 1024.0), |ui| {
            if widgets::button_sized(ui, accent, "Recommended", None, Btn::Secondary, true, 0.0, 30.0).clicked() {
                app.settings.memory_mb = rec;
            }
        });
        ui.spacing_mut().slider_width = ui.available_width() - 90.0;
        ui.add(egui::Slider::new(&mut app.settings.memory_mb, 1024..=total.max(2048).min(32768)).step_by(512.0).suffix(" MB"));
    });
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Java");
        match &app.java_list {
            crate::app::Loadable::Ready(list) if !list.is_empty() => {
                for j in list.iter().take(4) {
                    ui.horizontal(|ui| {
                        widgets::pill(ui, &format!("Java {}", j.major), theme::GOOD);
                        ui.label(egui::RichText::new(j.path.to_string_lossy()).monospace().size(11.5).color(theme::MUTED));
                    });
                }
                widgets::muted(ui, "Luminos downloads the exact runtime each Minecraft version needs when it's missing.");
            }
            crate::app::Loadable::Ready(_) => {
                widgets::muted(ui, "No Java found — no problem. Luminos will download the right runtime automatically.");
            }
            _ => {
                let dots = ".".repeat(((app.time * 3.0) as usize) % 4);
                widgets::muted(ui, &format!("Scanning for Java installs{dots}"));
            }
        }
    });
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(ui, "Dithered animated background", "The signature Luminos look. Turn off to save a little CPU.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.dither_background);
        });
        ui.add_space(4.0);
        widgets::setting_row(ui, "Reduce motion", "Disables background animation and slide transitions.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.reduce_motion);
        });
    });
    if nav(app, ui, "Continue", true, 1) {
        go(app, 3);
    }
}

fn choice(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(ui, "Step 3 of 4", "Create your first instance", "Start with the optimised Luminos Client or a clean vanilla game.");
    let opts = [
        ("Luminos Client", "RECOMMENDED", "Fabric + Sodium, Lithium, Entity Culling, Armor HUD, Mod Menu and ~25 more open-source mods, pre-configured in one click."),
        ("Vanilla", "", "The untouched game. Add mods and packs any time from Discover."),
        ("Skip for now", "", "Jump straight into the launcher and set things up yourself."),
    ];
    for (i, (name, tag, desc)) in opts.iter().enumerate() {
        let (r, resp) = ui.allocate_exact_size(vec2(ui.available_width(), if i == 0 { 96.0 } else { 70.0 }), Sense::click());
        let sel = app.wizard.choice as usize == i;
        let a = ui.ctx().animate_bool_with_time(resp.id, sel, 0.2);
        let h = ui.ctx().animate_bool_with_time(resp.id.with("h"), resp.hovered(), 0.12);
        ui.painter().rect_filled(r, CornerRadius::same(16), theme::mix(theme::mix(theme::BG2, theme::BG3, h), theme::alpha(accent, 255).linear_multiply(0.3), a));
        ui.painter().rect_stroke(r, CornerRadius::same(16), Stroke::new(1.0 + a, theme::mix(theme::LINE, accent, a.max(h * 0.5))), StrokeKind::Inside);
        let ir = Rect::from_min_size(r.min + vec2(14.0, 14.0), vec2(42.0, 42.0));
        widgets::instance_icon(ui, ir, name, [0u8, 3, 2][i]);
        ui.painter().text(r.min + vec2(72.0, 18.0), Align2::LEFT_TOP, *name, FontId::new(16.5, theme::bold()), theme::TEXT);
        if !tag.is_empty() {
            let pr = Rect::from_min_size(r.min + vec2(72.0 + 130.0, 17.0), vec2(96.0, 20.0));
            ui.painter().rect_filled(pr, CornerRadius::same(10), theme::alpha(theme::GOOD, 36));
            ui.painter().text(pr.center(), Align2::CENTER_CENTER, *tag, FontId::new(10.5, theme::bold()), theme::GOOD);
        }
        let g = ui.painter().layout(desc.to_string(), FontId::new(13.0, egui::FontFamily::Proportional), theme::MUTED, r.width() - 96.0);
        ui.painter().galley(r.min + vec2(72.0, 42.0), g, theme::MUTED);
        if sel {
            ui.painter().circle_filled(r.right_top() + vec2(-20.0, 20.0), 8.0, accent);
            crate::icons::paint(ui.painter(), Icon::Check, r.right_top() + vec2(-20.0, 20.0), 10.0, Color32::WHITE);
        }
        if resp.on_hover_cursor(egui::CursorIcon::PointingHand).clicked() {
            app.wizard.choice = i as u8;
        }
    }
    if app.wizard.choice < 2 {
        ui.horizontal(|ui| {
            ui.label(egui::RichText::new("Minecraft version").size(13.5).color(theme::MUTED));
            let versions: Vec<String> = app.manifest.ready().map(|m| m.versions.iter().filter(|v| v.kind == "release").take(40).map(|v| v.id.clone()).collect()).unwrap_or_default();
            egui::ComboBox::from_id_salt("wiz_ver").selected_text(if app.wizard.mc_version.is_empty() { "loading…".to_string() } else { app.wizard.mc_version.clone() }).show_ui(ui, |ui| {
                for v in versions {
                    ui.selectable_value(&mut app.wizard.mc_version, v.clone(), v);
                }
            });
        });
    }
    let ready = app.wizard.choice == 2 || !app.wizard.mc_version.is_empty();
    let label = if app.wizard.choice == 2 { "Finish" } else { "Install & continue" };
    if nav(app, ui, label, ready, 2) {
        begin_install(app);
        go(app, 4);
    }
}

fn begin_install(app: &mut App) {
    app.accounts.add(Account::offline(&app.wizard.name));
    app.settings.save();
    app.accounts.save();
    app.wizard.error = None;
    if app.wizard.choice == 2 {
        app.wizard.finished = true;
        return;
    }
    app.wizard.installing = true;
    app.wizard.finished = false;
    if !app.persist {
        return;
    }
    let client = app.wizard.choice == 0;
    let version = app.wizard.mc_version.clone();
    let p = app.wizard.progress.clone();
    let bg = app.bg();
    std::thread::spawn(move || {
        let run = || -> anyhow::Result<instances::Instance> {
            let mut inst = instances::create(if client { "Luminos Client" } else { "Vanilla" }, &version, if client { Loader::Fabric } else { Loader::Vanilla }, None)?;
            if client {
                let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT.iter().filter(|m| m.default_on).collect();
                p.set_stage("Installing Luminos Client…");
                preset::install(&inst, &mods, |i, t, n| {
                    p.total.store(t as u64, Ordering::Relaxed);
                    p.done.store(i as u64, Ordering::Relaxed);
                    p.set_stage(format!("Installing {n}…"));
                });
                inst.preset = Some("luminos-client".into());
                inst.color = 0;
                inst.save()?;
            }
            Ok(inst)
        };
        bg.send(Msg::Created { result: run().map_err(|e| format!("{e:#}")), from_wizard: true });
    });
}

fn finish(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    if app.wizard.finished {
        title(ui, "Step 4 of 4", "You're all set", "Everything is ready. Your first launch will download the game files once.");
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                let (r, _) = ui.allocate_exact_size(vec2(56.0, 56.0), Sense::hover());
                widgets::face(ui, r, None, &app.wizard.name);
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new(&app.wizard.name).font(FontId::new(18.0, theme::bold())));
                    widgets::muted(ui, &format!("{} GB RAM · {}", app.settings.memory_mb as f32 / 1024.0, if app.wizard.choice == 0 { "Luminos Client" } else if app.wizard.choice == 1 { "Vanilla instance" } else { "No instance yet" }));
                });
            });
        });
        ui.add_space(10.0);
        widgets::muted(ui, "Tip: press Discover to browse thousands of mods, shaders and packs from Modrinth.");
        ui.with_layout(Layout::bottom_up(Align::Center), |ui| {
            if widgets::button_sized(ui, accent, "Open Luminos", Some(Icon::Bolt), Btn::Primary, true, 260.0, 50.0).clicked() {
                app.settings.setup_done = true;
                app.settings.save();
                app.goto(crate::app::Page::Home);
            }
        });
    } else if let Some(e) = app.wizard.error.clone() {
        title(ui, "Step 4 of 4", "Something went wrong", "The instance couldn't be created. You can retry or skip.");
        ui.label(egui::RichText::new(e).color(theme::BAD).size(13.0));
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if widgets::button(ui, accent, "Retry", Some(Icon::Refresh), Btn::Primary, true).clicked() {
                begin_install(app);
            }
            if widgets::button(ui, accent, "Skip", None, Btn::Secondary, true).clicked() {
                app.wizard.finished = true;
            }
        });
    } else {
        title(ui, "Step 4 of 4", "Building your client…", "Downloading and wiring up your mods. This only happens once.");
        let p = app.wizard.progress.clone();
        let frac = p.fraction();
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(egui::RichText::new(p.stage()).font(FontId::new(15.0, theme::bold())));
            ui.add_space(4.0);
            widgets::progress_bar(ui, accent, frac, ui.available_width(), app.time);
            ui.add_space(4.0);
            widgets::muted(ui, &format!("{} of {} mods", p.done.load(Ordering::Relaxed), p.total.load(Ordering::Relaxed)));
        });
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(60));
        let _ = java::probe;
    }
}
