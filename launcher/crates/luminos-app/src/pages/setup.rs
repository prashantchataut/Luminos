//! First-run experience: a live dithered orb, a boot log made of real machine facts,
//! then a left-rail stepper (player → system → client → install).
use crate::{
    app::{App, Msg},
    brand,
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{
    self, pos2, vec2, Align, Align2, Color32, CornerRadius, FontId, Layout, Rect, Sense, Stroke,
    StrokeKind, Ui, UiBuilder,
};
use luminos_core::{
    accounts::{self, Account},
    config,
    instances::{self, Loader},
    java, preset,
};
use std::sync::atomic::Ordering;

const RAIL_W: f32 = 272.0;
const STEP_NAMES: [&str; 4] = ["Player", "System", "Client", "Install"];

fn go(app: &mut App, step: usize) {
    app.wizard.step = step;
    app.wizard.step_t0 = app.time;
}

pub fn wizard_ui(app: &mut App, ui: &mut Ui, body: Rect) {
    let step = app.wizard.step;
    let t = (((app.time - app.wizard.step_t0) / 0.45) as f32).clamp(0.0, 1.0);
    let ease = 1.0 - (1.0 - t).powi(3);
    if t < 1.0 || step == 0 {
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(if step == 0 {
                33
            } else {
                16
            }));
    }
    if step == 0 {
        welcome(app, ui, body);
        return;
    }
    let accent = app.accent();
    let rail = Rect::from_min_size(body.min, vec2(RAIL_W, body.height()));
    rail_ui(app, ui, rail, step, accent);
    let left = rail.right() + 64.0;
    let area = Rect::from_min_max(
        pos2(left + (1.0 - ease) * 22.0, body.top() + 48.0),
        pos2(
            (left + 640.0).min(body.right() - 40.0),
            body.bottom() - 36.0,
        ),
    );
    ui.scope_builder(UiBuilder::new().max_rect(area), |ui| {
        ui.set_opacity(ease);
        match step {
            1 => profile(app, ui),
            2 => performance(app, ui),
            3 => choice(app, ui),
            _ => finish(app, ui),
        }
    });
}

/// Left rail: brand, vertical stepper, a dithered fade rising from the bottom and a small orb.
fn rail_ui(app: &mut App, ui: &mut Ui, rail: Rect, step: usize, accent: Color32) {
    let p = ui.painter().clone();
    p.rect_filled(rail, 0.0, theme::BG1);
    // dither rising from the bottom edge
    let (w, h) = ((rail.width() / 4.0) as usize, 70usize);
    if app.rail_tex.is_none() {
        app.rail_tex = Some(app.ctx.load_texture(
            "luminos-rail",
            crate::dither::band(w, h, accent),
            egui::TextureOptions::NEAREST,
        ));
    }
    if let Some(tex) = &app.rail_tex {
        p.image(
            tex.id(),
            Rect::from_min_max(
                pos2(rail.left(), rail.bottom() - 280.0),
                rail.right_bottom(),
            ),
            Rect::from_min_max(pos2(0.0, 1.0), pos2(1.0, 0.0)),
            Color32::WHITE,
        );
    }
    p.line_segment(
        [rail.right_top(), rail.right_bottom()],
        Stroke::new(1.0, theme::LINE),
    );
    widgets::logo_mark(
        &p,
        pos2(rail.left() + 44.0, rail.top() + 48.0),
        32.0,
        accent,
        0.0,
    );
    p.text(
        pos2(rail.left() + 68.0, rail.top() + 48.0),
        Align2::LEFT_CENTER,
        "LUMINOS",
        FontId::new(14.0, theme::bold()),
        theme::TEXT,
    );
    let y0 = rail.top() + 128.0;
    for (i, name) in STEP_NAMES.iter().enumerate() {
        let n = i + 1;
        let y = y0 + i as f32 * 62.0;
        let done = n < step;
        let active = n == step;
        let a = ui
            .ctx()
            .animate_bool_with_time(egui::Id::new(("rail", i)), active, 0.25);
        let bx = Rect::from_min_size(pos2(rail.left() + 32.0, y), vec2(26.0, 26.0));
        let fill = if done {
            accent
        } else {
            theme::mix(theme::BG1, theme::alpha(accent, 255), a * 0.22)
        };
        p.rect_filled(bx, CornerRadius::same(3), fill);
        p.rect_stroke(
            bx,
            CornerRadius::same(3),
            Stroke::new(1.0, if done || active { accent } else { theme::LINE }),
            StrokeKind::Inside,
        );
        if done {
            crate::icons::paint(&p, Icon::Check, bx.center(), 13.0, Color32::WHITE);
        } else {
            p.text(
                bx.center(),
                Align2::CENTER_CENTER,
                format!("{n:02}"),
                FontId::new(11.0, egui::FontFamily::Monospace),
                if active { theme::TEXT } else { theme::MUTED },
            );
        }
        if i + 1 < STEP_NAMES.len() {
            p.line_segment(
                [
                    pos2(bx.center().x, bx.bottom() + 4.0),
                    pos2(bx.center().x, bx.bottom() + 32.0),
                ],
                Stroke::new(1.0, if done { accent } else { theme::LINE }),
            );
        }
        p.text(
            pos2(bx.right() + 16.0, bx.center().y),
            Align2::LEFT_CENTER,
            name.to_uppercase(),
            FontId::new(12.0, egui::FontFamily::Monospace),
            theme::mix(theme::MUTED, theme::TEXT, if done { 0.6 } else { a }),
        );
    }
    let t = app.time as f32;
    let angle = if app.settings.reduce_motion {
        -2.36
    } else {
        -2.36 + (t * 0.6).sin() * 0.9
    };
    widgets::orb(
        &p,
        pos2(rail.left() + 32.0 + 44.0, rail.bottom() - 100.0),
        88.0,
        22,
        angle,
    );
    p.text(
        pos2(rail.left() + 32.0, rail.bottom() - 36.0),
        Align2::LEFT_CENTER,
        format!("v{}  ·  offline-friendly", luminos_core::VERSION),
        FontId::new(10.0, egui::FontFamily::Monospace),
        theme::MUTED,
    );
    let _ = brand::INK;
}

fn welcome(app: &mut App, ui: &mut Ui, body: Rect) {
    let accent = app.accent();
    let t = (app.time - app.wizard.step_t0) as f32;
    let p = ui.painter().clone();
    // instrument-panel dot grid
    let mut y = body.top() + 20.0;
    while y < body.bottom() {
        let mut x = body.left() + 20.0;
        while x < body.right() {
            p.rect_filled(
                Rect::from_min_size(pos2(x, y), vec2(2.0, 2.0)),
                0.0,
                theme::alpha(theme::LINE, 150),
            );
            x += 28.0;
        }
        y += 28.0;
    }
    // orb: left, vertically centred
    let d = (body.height() - 150.0).clamp(280.0, 460.0);
    let oc = pos2(body.left() + body.width() * 0.29, body.center().y);
    let reveal = ((t / 1.1).clamp(0.0, 1.0) * 100.0) as usize; // cells appear in a sweep
    let n = 44usize;
    let u = d / n as f32;
    let angle = if app.settings.reduce_motion {
        -2.36
    } else {
        -2.36 + t * 0.55
    };
    let light = (angle.cos(), angle.sin());
    let o = oc - vec2(d / 2.0, d / 2.0);
    for gy in 0..n {
        for gx in 0..n {
            let ring = (((gx as f32 - 21.5).powi(2) + (gy as f32 - 21.5).powi(2)).sqrt() / 22.0
                * 100.0) as usize;
            if ring > reveal {
                continue;
            }
            if let Some(tn) = brand::orb_cell(n, gx, gy, light) {
                let min = pos2((o.x + gx as f32 * u).round(), (o.y + gy as f32 * u).round());
                let max = pos2(
                    (o.x + (gx + 1) as f32 * u).round(),
                    (o.y + (gy + 1) as f32 * u).round(),
                );
                p.rect_filled(Rect::from_min_max(min, max), 0.0, brand::TONES[tn]);
            }
        }
    }
    // text column
    let x = body.left() + body.width() * 0.52;
    let fade = |at: f32| ((t - at) / 0.5).clamp(0.0, 1.0);
    let mut y = body.center().y - 190.0;
    let a = fade(0.25);
    p.text(
        pos2(x, y),
        Align2::LEFT_TOP,
        format!("LUMINOS LAUNCHER  /  {}", luminos_core::VERSION),
        FontId::new(11.0, egui::FontFamily::Monospace),
        theme::alpha(accent, (a * 255.0) as u8),
    );
    y += 30.0;
    for (i, line) in ["Every version.", "Every mod.", "No nonsense."]
        .iter()
        .enumerate()
    {
        let a = fade(0.45 + i as f32 * 0.18);
        p.text(
            pos2(x + (1.0 - a) * 18.0, y),
            Align2::LEFT_TOP,
            *line,
            FontId::new(46.0, theme::bold()),
            theme::alpha(
                if i == 2 {
                    theme::mix(accent, Color32::WHITE, 0.55)
                } else {
                    theme::TEXT
                },
                (a * 255.0) as u8,
            ),
        );
        y += 56.0;
    }
    y += 18.0;
    // boot log with real data
    let mem = config::system_memory_mb();
    let java_line = match &app.java_list {
        crate::app::Loadable::Ready(l) if !l.is_empty() => {
            let mut v: Vec<u32> = l.iter().map(|j| j.major).collect();
            v.sort_unstable();
            v.dedup();
            format!(
                "Java {} found on this PC",
                v.iter()
                    .map(|m| m.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        }
        crate::app::Loadable::Ready(_) => {
            "none installed — Luminos fetches the right one".to_string()
        }
        _ => format!("scanning{}", ".".repeat((app.time * 3.0) as usize % 4)),
    };
    let root = luminos_core::paths::root().to_string_lossy().to_string();
    let root = if root.chars().count() > 46 {
        format!(
            "…{}",
            root.chars()
                .skip(root.chars().count() - 45)
                .collect::<String>()
        )
    } else {
        root
    };
    let lines = [
        ("data", root),
        ("java", java_line),
        ("memory", format!("{:.1} GB installed", mem as f32 / 1024.0)),
        ("content", "Modrinth official API · nothing else".into()),
    ];
    for (i, (k, v)) in lines.iter().enumerate() {
        let a = fade(1.3 + i as f32 * 0.35);
        if a <= 0.0 {
            continue;
        }
        let col = theme::alpha(theme::MUTED, (a * 255.0) as u8);
        p.text(
            pos2(x, y),
            Align2::LEFT_TOP,
            format!("{k:<8}"),
            FontId::new(12.0, egui::FontFamily::Monospace),
            theme::alpha(accent, (a * 255.0) as u8),
        );
        p.text(
            pos2(x + 74.0, y),
            Align2::LEFT_TOP,
            v,
            FontId::new(12.0, egui::FontFamily::Monospace),
            col,
        );
        y += 21.0;
    }
    y += 22.0;
    let a = fade(2.9);
    if a > 0.0 {
        ui.scope_builder(
            UiBuilder::new().max_rect(Rect::from_min_size(pos2(x, y), vec2(320.0, 52.0))),
            |ui| {
                ui.set_opacity(a);
                if widgets::button_sized(
                    ui,
                    accent,
                    "Set up Luminos",
                    Some(Icon::Bolt),
                    Btn::Primary,
                    true,
                    220.0,
                    44.0,
                )
                .clicked()
                {
                    go(app, 1);
                }
            },
        );
    }
    if (t * 2.0) as i32 % 2 == 0 && fade(2.9) < 1.0 {
        p.rect_filled(
            Rect::from_min_size(pos2(x, y + 6.0), vec2(8.0, 14.0)),
            0.0,
            accent,
        );
    }
}

fn title(ui: &mut Ui, eyebrow: &str, heading: &str, sub: &str) {
    widgets::eyebrow(ui, eyebrow);
    ui.add_space(6.0);
    ui.label(egui::RichText::new(heading).font(FontId::new(32.0, theme::bold())));
    ui.add_space(2.0);
    widgets::muted(ui, sub);
    ui.add_space(20.0);
}

fn nav(app: &mut App, ui: &mut Ui, next_label: &str, next_ok: bool, back_to: usize) -> bool {
    let accent = app.accent();
    let mut next = false;
    ui.with_layout(Layout::bottom_up(Align::Min), |ui| {
        ui.horizontal(|ui| {
            if widgets::button_sized(
                ui,
                accent,
                "Back",
                Some(Icon::Back),
                Btn::Ghost,
                true,
                100.0,
                42.0,
            )
            .clicked()
            {
                go(app, back_to);
            }
            ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                next = widgets::button_sized(
                    ui,
                    accent,
                    next_label,
                    None,
                    Btn::Primary,
                    next_ok,
                    190.0,
                    42.0,
                )
                .clicked();
            });
        });
    });
    next
}

fn profile(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(
        ui,
        "01 — Player",
        "Who's playing?",
        "Pick the name you'll use in-game. You can add more accounts later.",
    );
    ui.horizontal(|ui| {
        let (r, _) = ui.allocate_exact_size(vec2(88.0, 88.0), Sense::hover());
        widgets::face(ui, r, None, &app.wizard.name);
        ui.vertical(|ui| {
            ui.add_space(8.0);
            let edit = egui::TextEdit::singleline(&mut app.wizard.name)
                .hint_text("Username (3–16 letters, numbers, _)")
                .desired_width(360.0)
                .font(FontId::new(18.0, egui::FontFamily::Proportional))
                .margin(egui::Margin::symmetric(12, 10));
            ui.add(edit);
            let ok = accounts::valid_username(&app.wizard.name);
            if app.wizard.name.is_empty() {
                widgets::muted(ui, "Letters, numbers and underscores only.");
            } else if ok {
                ui.label(
                    egui::RichText::new("Looks good")
                        .color(theme::GOOD)
                        .size(13.0),
                );
            } else {
                ui.label(
                    egui::RichText::new("Needs 3–16 characters: letters, numbers or _")
                        .color(theme::BAD)
                        .size(13.0),
                );
            }
        });
    });
    ui.add_space(14.0);
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Offline UUID");
        let uuid = if accounts::valid_username(&app.wizard.name) {
            accounts::offline_uuid(&app.wizard.name)
        } else {
            "—".to_string()
        };
        ui.label(
            egui::RichText::new(uuid)
                .monospace()
                .size(14.0)
                .color(theme::mix(accent, Color32::WHITE, 0.4)),
        );
        widgets::muted(ui, "This is the same ID a vanilla server derives for an offline-mode player, so your worlds and inventories always match.");
    });
    ui.add_space(8.0);
    widgets::muted(
        ui,
        "Microsoft sign-in is on the roadmap — offline accounts are fully supported today.",
    );
    let ok = accounts::valid_username(&app.wizard.name);
    if nav(app, ui, "Continue", ok, 0) {
        go(app, 2);
    }
}

fn performance(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(
        ui,
        "02 — System",
        "Tune for your machine",
        "Luminos picks sensible defaults — tweak them if you like.",
    );
    let total = config::system_memory_mb();
    let rec = (total / 2).clamp(2048, 8192) / 512 * 512;
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(
            ui,
            "Game memory",
            &format!(
                "{:.1} GB selected · {:.1} GB recommended · {:.1} GB installed",
                app.settings.memory_mb as f32 / 1024.0,
                rec as f32 / 1024.0,
                total as f32 / 1024.0
            ),
            |ui| {
                if widgets::button_sized(
                    ui,
                    accent,
                    "Recommended",
                    None,
                    Btn::Secondary,
                    true,
                    0.0,
                    30.0,
                )
                .clicked()
                {
                    app.settings.memory_mb = rec;
                }
            },
        );
        ui.spacing_mut().slider_width = ui.available_width() - 90.0;
        ui.add(
            egui::Slider::new(
                &mut app.settings.memory_mb,
                1024..=total.max(2048).min(32768),
            )
            .step_by(512.0)
            .suffix(" MB"),
        );
    });
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Java");
        match &app.java_list {
            crate::app::Loadable::Ready(list) if !list.is_empty() => {
                for j in list.iter().take(4) {
                    ui.horizontal(|ui| {
                        widgets::pill(ui, &format!("Java {}", j.major), theme::GOOD);
                        ui.label(
                            egui::RichText::new(j.path.to_string_lossy())
                                .monospace()
                                .size(11.5)
                                .color(theme::MUTED),
                        );
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
        widgets::setting_row(
            ui,
            "Dithered animated background",
            "The signature Luminos look. Turn off to save a little CPU.",
            |ui| {
                widgets::toggle(ui, accent, &mut app.settings.dither_background);
            },
        );
        ui.add_space(4.0);
        widgets::setting_row(
            ui,
            "Reduce motion",
            "Disables background animation and slide transitions.",
            |ui| {
                widgets::toggle(ui, accent, &mut app.settings.reduce_motion);
            },
        );
    });
    if nav(app, ui, "Continue", true, 1) {
        go(app, 3);
    }
}

fn choice(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    title(
        ui,
        "03 — Client",
        "Create your first instance",
        "Start with the optimised Luminos Client or a clean vanilla game.",
    );
    let opts = [
        ("Luminos Client", "RECOMMENDED", "Fabric + Sodium, Lithium, Entity Culling, Armor HUD, Mod Menu and ~25 more open-source mods, pre-configured in one click."),
        ("Vanilla", "", "The untouched game. Add mods and packs any time from Discover."),
        ("Skip for now", "", "Jump straight into the launcher and set things up yourself."),
    ];
    for (i, (name, tag, desc)) in opts.iter().enumerate() {
        let (r, resp) = ui.allocate_exact_size(
            vec2(ui.available_width(), if i == 0 { 96.0 } else { 70.0 }),
            Sense::click(),
        );
        let sel = app.wizard.choice as usize == i;
        let a = ui.ctx().animate_bool_with_time(resp.id, sel, 0.2);
        let h = ui
            .ctx()
            .animate_bool_with_time(resp.id.with("h"), resp.hovered(), 0.12);
        ui.painter().rect_filled(
            r,
            CornerRadius::same(4),
            theme::mix(
                theme::mix(theme::BG2, theme::BG3, h),
                theme::alpha(accent, 255).linear_multiply(0.3),
                a,
            ),
        );
        ui.painter().rect_stroke(
            r,
            CornerRadius::same(4),
            Stroke::new(1.0 + a, theme::mix(theme::LINE, accent, a.max(h * 0.5))),
            StrokeKind::Inside,
        );
        let ir = Rect::from_min_size(r.min + vec2(14.0, 14.0), vec2(42.0, 42.0));
        widgets::instance_icon(ui, ir, name, [0u8, 3, 2][i]);
        ui.painter().text(
            r.min + vec2(72.0, 18.0),
            Align2::LEFT_TOP,
            *name,
            FontId::new(16.5, theme::bold()),
            theme::TEXT,
        );
        if !tag.is_empty() {
            let pr = Rect::from_min_size(r.min + vec2(72.0 + 130.0, 17.0), vec2(96.0, 20.0));
            ui.painter()
                .rect_filled(pr, CornerRadius::same(3), theme::alpha(theme::GOOD, 36));
            ui.painter().text(
                pr.center(),
                Align2::CENTER_CENTER,
                *tag,
                FontId::new(10.5, theme::bold()),
                theme::GOOD,
            );
        }
        let g = ui.painter().layout(
            desc.to_string(),
            FontId::new(13.0, egui::FontFamily::Proportional),
            theme::MUTED,
            r.width() - 96.0,
        );
        ui.painter()
            .galley(r.min + vec2(72.0, 42.0), g, theme::MUTED);
        if sel {
            ui.painter()
                .circle_filled(r.right_top() + vec2(-20.0, 20.0), 8.0, accent);
            crate::icons::paint(
                ui.painter(),
                Icon::Check,
                r.right_top() + vec2(-20.0, 20.0),
                10.0,
                Color32::WHITE,
            );
        }
        if resp
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            app.wizard.choice = i as u8;
        }
    }
    if app.wizard.choice < 2 {
        ui.horizontal(|ui| {
            ui.label(
                egui::RichText::new("Minecraft version")
                    .size(13.5)
                    .color(theme::MUTED),
            );
            let versions: Vec<String> = app
                .manifest
                .ready()
                .map(|m| {
                    m.versions
                        .iter()
                        .filter(|v| v.kind == "release")
                        .take(40)
                        .map(|v| v.id.clone())
                        .collect()
                })
                .unwrap_or_default();
            egui::ComboBox::from_id_salt("wiz_ver")
                .selected_text(if app.wizard.mc_version.is_empty() {
                    "loading…".to_string()
                } else {
                    app.wizard.mc_version.clone()
                })
                .show_ui(ui, |ui| {
                    for v in versions {
                        ui.selectable_value(&mut app.wizard.mc_version, v.clone(), v);
                    }
                });
        });
    }
    let ready = app.wizard.choice == 2 || !app.wizard.mc_version.is_empty();
    let label = if app.wizard.choice == 2 {
        "Finish"
    } else {
        "Install & continue"
    };
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
            let mut inst = instances::create(
                if client { "Luminos Client" } else { "Vanilla" },
                &version,
                if client {
                    Loader::Fabric
                } else {
                    Loader::Vanilla
                },
                None,
            )?;
            if client {
                let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT
                    .iter()
                    .filter(|m| m.default_on)
                    .collect();
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
        bg.send(Msg::Created {
            result: run().map_err(|e| format!("{e:#}")),
            from_wizard: true,
        });
    });
}

fn finish(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    if app.wizard.finished {
        title(
            ui,
            "04 — Install",
            "You're all set",
            "Everything is ready. Your first launch will download the game files once.",
        );
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                let (r, _) = ui.allocate_exact_size(vec2(56.0, 56.0), Sense::hover());
                widgets::face(ui, r, None, &app.wizard.name);
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new(&app.wizard.name)
                            .font(FontId::new(18.0, theme::bold())),
                    );
                    widgets::muted(
                        ui,
                        &format!(
                            "{} GB RAM · {}",
                            app.settings.memory_mb as f32 / 1024.0,
                            if app.wizard.choice == 0 {
                                "Luminos Client"
                            } else if app.wizard.choice == 1 {
                                "Vanilla instance"
                            } else {
                                "No instance yet"
                            }
                        ),
                    );
                });
            });
        });
        ui.add_space(10.0);
        widgets::muted(
            ui,
            "Tip: press Discover to browse thousands of mods, shaders and packs from Modrinth.",
        );
        ui.with_layout(Layout::bottom_up(Align::Center), |ui| {
            if widgets::button_sized(
                ui,
                accent,
                "Open Luminos",
                Some(Icon::Bolt),
                Btn::Primary,
                true,
                260.0,
                50.0,
            )
            .clicked()
            {
                app.settings.setup_done = true;
                app.settings.save();
                app.goto(crate::app::Page::Home);
            }
        });
    } else if let Some(e) = app.wizard.error.clone() {
        title(
            ui,
            "04 — Install",
            "Something went wrong",
            "The instance couldn't be created. You can retry or skip.",
        );
        ui.label(egui::RichText::new(e).color(theme::BAD).size(13.0));
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if widgets::button(ui, accent, "Retry", Some(Icon::Refresh), Btn::Primary, true)
                .clicked()
            {
                begin_install(app);
            }
            if widgets::button(ui, accent, "Skip", None, Btn::Secondary, true).clicked() {
                app.wizard.finished = true;
            }
        });
    } else {
        title(
            ui,
            "04 — Install",
            "Building your client…",
            "Downloading and wiring up your mods. This only happens once.",
        );
        let p = app.wizard.progress.clone();
        let frac = p.fraction();
        widgets::card(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(egui::RichText::new(p.stage()).font(FontId::new(15.0, theme::bold())));
            ui.add_space(4.0);
            widgets::progress_bar(ui, accent, frac, ui.available_width(), app.time);
            ui.add_space(4.0);
            widgets::muted(
                ui,
                &format!(
                    "{} of {} mods",
                    p.done.load(Ordering::Relaxed),
                    p.total.load(Ordering::Relaxed)
                ),
            );
        });
        ui.ctx()
            .request_repaint_after(std::time::Duration::from_millis(60));
        let _ = java::probe;
    }
}
