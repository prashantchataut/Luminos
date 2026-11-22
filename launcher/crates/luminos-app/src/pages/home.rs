//! Home: greeting, quick play, featured content, playtime and the news panel.
use crate::{
    app::{App, Loadable, Page},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{
    self, pos2, vec2, Align2, Color32, CornerRadius, FontId, Rect, Sense, Stroke, StrokeKind, Ui,
};
use luminos_core::{modrinth::Project, playtime, store};

const GREETINGS: [&str; 6] = [
    "Time to torch up the base",
    "Ready to mine some diamonds",
    "Your world is waiting",
    "Let's go build something",
    "The creepers missed you",
    "Another day, another biome",
];

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    let name = app
        .accounts
        .active()
        .map(|a| a.username.clone())
        .unwrap_or_else(|| "player".into());
    let greet = GREETINGS[(store::now_unix() / 86400) as usize % GREETINGS.len()];
    hero(app, ui, accent, &format!("{greet}, {name}"));
    ui.add_space(10.0);
    ui.add_space(6.0);

    // Quick play
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            widgets::eyebrow(ui, "Quick play");
            ui.add_space(8.0);
            let insts: Vec<_> = app.instances.iter().take(8).cloned().collect();
            if insts.is_empty() {
                widgets::muted(ui, "No instances yet — create one to get started.");
                if widgets::button_sized(
                    ui,
                    accent,
                    "New instance",
                    Some(Icon::Plus),
                    Btn::Primary,
                    true,
                    0.0,
                    32.0,
                )
                .clicked()
                {
                    app.open_create();
                }
            }
            for inst in insts {
                let (r, resp) = ui.allocate_exact_size(vec2(52.0, 52.0), Sense::click());
                let h = ui
                    .ctx()
                    .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
                widgets::instance_icon(ui, r.shrink(3.0 - 3.0 * h), &inst.name, inst.color);
                if h > 0.0 {
                    ui.painter().circle_filled(
                        r.center(),
                        14.0 * h,
                        Color32::from_black_alpha((120.0 * h) as u8),
                    );
                    crate::icons::paint(
                        ui.painter(),
                        Icon::Play,
                        r.center() + vec2(1.0, 0.0),
                        14.0 * h + 2.0,
                        Color32::from_white_alpha((255.0 * h) as u8),
                    );
                }
                let resp = resp
                    .on_hover_text(format!("Play {}", inst.name))
                    .on_hover_cursor(egui::CursorIcon::PointingHand);
                if resp.clicked() {
                    app.play(&inst.id);
                }
                if resp.secondary_clicked() {
                    app.open_instance(&inst.id);
                }
            }
        });
    });
    ui.add_space(8.0);

    // Featured
    widgets::subheading(ui, "Explore content hub");
    let feat: Vec<Project> = app.featured.ready().cloned().unwrap_or_default();
    match &app.featured {
        Loadable::Loading | Loadable::Idle => {
            widgets::muted(ui, "Loading featured packs…");
        }
        Loadable::Failed(_) => widgets::muted(
            ui,
            "You're offline — featured packs will appear when you reconnect.",
        ),
        _ => {}
    }
    if !feat.is_empty() {
        let gap = 14.0;
        let w = ((ui.available_width() - gap * 2.0) / 3.0).floor();
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            for p in feat.iter().take(3) {
                featured_card(app, ui, p, w);
            }
        });
    }
    ui.add_space(8.0);

    // Playtime
    ui.columns(2, |cols| {
        widgets::subheading(&mut cols[0], "Recent instances");
        let list: Vec<_> = app.instances.iter().take(3).cloned().collect();
        if list.is_empty() {
            widgets::muted(&mut cols[0], "Nothing played yet.");
        }
        for inst in list {
            let (r, resp) =
                cols[0].allocate_exact_size(vec2(cols[0].available_width(), 64.0), Sense::click());
            let h = cols[0]
                .ctx()
                .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
            let p = cols[0].painter();
            p.rect_filled(
                r,
                CornerRadius::same(4),
                theme::mix(theme::BG2, theme::BG3, h),
            );
            p.rect_stroke(
                r,
                CornerRadius::same(4),
                Stroke::new(1.0, theme::LINE),
                StrokeKind::Inside,
            );
            widgets::instance_icon(
                &cols[0],
                Rect::from_min_size(r.min + vec2(10.0, 10.0), vec2(44.0, 44.0)),
                &inst.name,
                inst.color,
            );
            let p = cols[0].painter();
            p.text(
                r.min + vec2(66.0, 14.0),
                Align2::LEFT_TOP,
                &inst.name,
                FontId::new(15.0, theme::bold()),
                theme::TEXT,
            );
            p.text(
                r.min + vec2(66.0, 36.0),
                Align2::LEFT_TOP,
                format!(
                    "{} · {}",
                    inst.subtitle(),
                    store::fmt_duration(inst.playtime_secs)
                ),
                FontId::new(12.5, egui::FontFamily::Proportional),
                theme::MUTED,
            );
            if resp
                .on_hover_cursor(egui::CursorIcon::PointingHand)
                .clicked()
            {
                app.open_instance(&inst.id);
            }
        }
        playtime_card(app, &mut cols[1]);
    });
}

fn featured_card(app: &mut App, ui: &mut Ui, p: &Project, w: f32) {
    let h = 262.0;
    let (r, resp) = ui.allocate_exact_size(vec2(w, h), Sense::click());
    let hv = ui
        .ctx()
        .animate_bool_with_time(resp.id, resp.hovered(), 0.15);
    let rr = r.translate(vec2(0.0, -3.0 * hv));
    ui.painter()
        .rect_filled(rr, CornerRadius::same(4), theme::BG2);
    let banner = Rect::from_min_size(rr.min, vec2(w, 112.0));
    let url = p.featured_gallery.clone().or(p.icon_url.clone());
    let seed = p.title.bytes().fold(0u8, |a, b| a.wrapping_add(b));
    app.paint_remote(ui, banner, url.as_deref(), 16, |ui| {
        widgets::instance_icon(ui, banner, &p.title, seed);
    });
    // gradient fade at bottom of banner
    ui.painter().rect_filled(
        Rect::from_min_size(banner.left_bottom() - vec2(0.0, 40.0), vec2(w, 40.0)),
        0.0,
        theme::alpha(theme::BG2, 90),
    );
    let icon = Rect::from_min_size(banner.left_bottom() + vec2(14.0, -26.0), vec2(48.0, 48.0));
    app.paint_remote(ui, icon, p.icon_url.as_deref(), 12, |ui| {
        widgets::instance_icon(ui, icon, &p.title, seed)
    });
    ui.painter().rect_stroke(
        icon,
        CornerRadius::same(3),
        Stroke::new(2.0, theme::BG2),
        StrokeKind::Outside,
    );
    let g = ui.painter().layout(
        p.title.clone(),
        FontId::new(15.5, theme::bold()),
        theme::TEXT,
        w - 28.0,
    );
    let ty = banner.bottom() + 30.0;
    ui.painter()
        .galley(pos2(rr.left() + 14.0, ty), g, theme::TEXT);
    let g = ui.painter().layout(
        p.description.clone(),
        FontId::new(12.5, egui::FontFamily::Proportional),
        theme::MUTED,
        w - 28.0,
    );
    let g = if g.rows.len() > 2 {
        ui.painter().layout(
            format!(
                "{}…",
                p.description
                    .chars()
                    .take(70)
                    .collect::<String>()
                    .trim_end()
            ),
            FontId::new(12.5, egui::FontFamily::Proportional),
            theme::MUTED,
            w - 28.0,
        )
    } else {
        g
    };
    ui.painter()
        .galley(pos2(rr.left() + 14.0, ty + 24.0), g, theme::MUTED);
    ui.painter().text(
        rr.left_bottom() + vec2(14.0, -16.0),
        Align2::LEFT_CENTER,
        p.author.as_str(),
        FontId::new(12.5, egui::FontFamily::Proportional),
        theme::MUTED,
    );
    ui.painter().text(
        rr.right_bottom() + vec2(-14.0, -16.0),
        Align2::RIGHT_CENTER,
        format!("↓ {}", store::fmt_count(p.downloads)),
        FontId::new(12.5, theme::bold()),
        theme::MUTED,
    );
    ui.painter().rect_stroke(
        rr,
        CornerRadius::same(4),
        Stroke::new(1.0, theme::mix(theme::LINE, app.accent(), hv)),
        StrokeKind::Inside,
    );
    if resp
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked()
    {
        app.discover.kind = "modpack";
        app.discover.query = p.title.clone();
        app.discover.key.clear();
        app.goto(Page::Discover);
    }
}

fn playtime_card(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    widgets::subheading(ui, "Your playtime");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        let week = playtime::last_days_total(&app.playtime, 7);
        ui.label(
            egui::RichText::new(store::fmt_duration(week)).font(FontId::new(32.0, theme::bold())),
        );
        widgets::muted(ui, "Last 7 days");
        ui.add_space(6.0);
        bar_chart(ui, accent, &playtime::daily(&app.playtime, 7), 92.0);
    });
}

/// Compact bar chart shared with the Stats page.
pub fn bar_chart(ui: &mut Ui, accent: Color32, data: &[(String, u64)], height: f32) {
    let (r, resp) = ui.allocate_exact_size(vec2(ui.available_width(), height), Sense::hover());
    let max = data.iter().map(|d| d.1).max().unwrap_or(0).max(60) as f32;
    let n = data.len().max(1) as f32;
    let slot = r.width() / n;
    let bw = (slot * 0.52).min(36.0);
    for (i, (label, v)) in data.iter().enumerate() {
        let x = r.left() + slot * (i as f32 + 0.5);
        let area_h = r.height() - 20.0;
        let hgt = (*v as f32 / max * area_h).max(4.0);
        let bar = Rect::from_min_max(
            pos2(x - bw / 2.0, r.top() + area_h - hgt),
            pos2(x + bw / 2.0, r.top() + area_h),
        );
        let hover = resp
            .hover_pos()
            .map(|p| (p.x - x).abs() < slot / 2.0)
            .unwrap_or(false);
        let col = if *v == 0 {
            theme::BG3
        } else {
            theme::mix(accent, Color32::WHITE, if hover { 0.25 } else { 0.0 })
        };
        ui.painter().rect_filled(bar, CornerRadius::same(2), col);
        ui.painter().text(
            pos2(x, r.bottom() - 6.0),
            Align2::CENTER_CENTER,
            label,
            FontId::new(11.0, egui::FontFamily::Proportional),
            theme::MUTED,
        );
        if hover && *v > 0 {
            ui.painter().text(
                pos2(x, bar.top() - 9.0),
                Align2::CENTER_CENTER,
                store::fmt_duration(*v),
                FontId::new(11.5, theme::bold()),
                theme::TEXT,
            );
        }
    }
}

pub fn news_panel(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    ui.horizontal(|ui| {
        crate::icons::paint(
            ui.painter(),
            Icon::Layers,
            ui.cursor().min + vec2(10.0, 12.0),
            17.0,
            accent,
        );
        ui.add_space(26.0);
        widgets::subheading(ui, "Minecraft news");
    });
    ui.add_space(4.0);
    let items = app.news.ready().cloned().unwrap_or_default();
    if items.is_empty() {
        widgets::muted(
            ui,
            if matches!(app.news, Loadable::Failed(_)) {
                "News unavailable offline."
            } else {
                "Loading the latest patch notes…"
            },
        );
    }
    for item in items.iter().take(5) {
        let (r, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 74.0), Sense::click());
        let h = ui
            .ctx()
            .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
        ui.painter().rect_filled(
            r,
            CornerRadius::same(4),
            theme::alpha(theme::BG3, (h * 255.0) as u8),
        );
        let img = Rect::from_min_size(r.min + vec2(6.0, 6.0), vec2(62.0, 62.0));
        let seed = item.version.bytes().fold(3u8, |a, b| a.wrapping_add(b));
        app.paint_remote(ui, img, item.image_url.as_deref(), 10, |ui| {
            widgets::instance_icon(ui, img, "MC", seed)
        });
        let g = ui.painter().layout(
            item.title.clone(),
            FontId::new(14.0, theme::bold()),
            theme::TEXT,
            r.width() - 86.0,
        );
        ui.painter()
            .galley(pos2(r.left() + 78.0, r.top() + 10.0), g, theme::TEXT);
        let tag = format!("{} · {}", item.kind.to_uppercase(), item.date);
        ui.painter().text(
            pos2(r.left() + 78.0, r.bottom() - 14.0),
            Align2::LEFT_CENTER,
            tag,
            FontId::new(11.5, egui::FontFamily::Monospace),
            theme::MUTED,
        );
        if resp
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            let _ = open::that("https://www.minecraft.net/en-us/articles");
        }
    }
    ui.add_space(8.0);
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.horizontal(|ui| {
            crate::icons::paint(
                ui.painter(),
                Icon::Bolt,
                ui.cursor().min + vec2(10.0, 14.0),
                18.0,
                accent,
            );
            ui.add_space(26.0);
            widgets::subheading(ui, "Luminos tips");
        });
        let tips = [
            "Right-click an instance in Quick play to open its page.",
            "Use “Update all” on an instance to refresh every linked mod at once.",
            "Unlink a mod to keep a specific version forever.",
            "The Skins studio can fetch any player's skin by name.",
        ];
        widgets::muted(ui, tips[(store::now_unix() / 3600) as usize % tips.len()]);
    });
}

/// Hero banner: greeting + one-click "Continue" on the left, real Minecraft art on the right that
/// dissolves into the panel through an ordered-dither edge (the launcher's signature look).
fn hero(app: &mut App, ui: &mut Ui, accent: Color32, title: &str) {
    let h = 176.0;
    let w = ui.available_width();
    let (rect, _) = ui.allocate_exact_size(vec2(w, h), Sense::hover());
    let radius = 20u8;
    let navy = Color32::from_rgb(9, 15, 44);
    let p = ui.painter().clone();
    p.rect_filled(rect, CornerRadius::same(radius), navy);
    // soft accent glow behind the text
    for i in 0..6 {
        p.circle_filled(
            rect.left_center() + vec2(60.0, 10.0),
            90.0 + i as f32 * 38.0,
            theme::alpha(accent, 9),
        );
    }
    p.rect_filled(rect, CornerRadius::same(radius), theme::alpha(navy, 150));

    // art panel (right 56%)
    let art = Rect::from_min_max(
        pos2(rect.right() - w * 0.42, rect.top()),
        rect.right_bottom(),
    );
    let url = app
        .featured
        .ready()
        .and_then(|f| f.iter().find_map(|p| p.featured_gallery.clone()));
    let mut have_art = false;
    if let Some(u) = url.as_deref() {
        let _ = app.icon_tex(u);
        if let Some(Some(tex)) = app.icons.get(u) {
            let tsz = tex.size_vec2();
            let target = art.width() / art.height();
            let ia = tsz.x / tsz.y;
            let (uw, uh) = if ia > target {
                (target / ia, 1.0)
            } else {
                (1.0, ia / target)
            };
            let (u0, v0) = ((1.0 - uw) / 2.0, (1.0 - uh) / 2.0);
            p.add(
                egui::epaint::RectShape::filled(
                    art,
                    CornerRadius {
                        nw: 0,
                        sw: 0,
                        ne: radius,
                        se: radius,
                    },
                    Color32::WHITE,
                )
                .with_texture(
                    tex.id(),
                    Rect::from_min_max(pos2(u0, v0), pos2(u0 + uw, v0 + uh)),
                ),
            );
            have_art = true;
        }
    }
    if !have_art {
        p.rect_filled(
            art,
            CornerRadius {
                nw: 0,
                sw: 0,
                ne: radius,
                se: radius,
            },
            theme::alpha(accent, 28),
        );
    }
    // ordered-dither dissolve between the dark panel and the art
    const BAYER: [[f32; 4]; 4] = [
        [0.0, 8.0, 2.0, 10.0],
        [12.0, 4.0, 14.0, 6.0],
        [3.0, 11.0, 1.0, 9.0],
        [15.0, 7.0, 13.0, 5.0],
    ];
    let cell = 7.0;
    let span = w * 0.16;
    let cols = (span / cell) as i32;
    let rows = (h / cell).ceil() as i32;
    for cy in 0..rows {
        for cx in 0..cols {
            let t = cx as f32 / cols as f32; // 0 = dark, 1 = art
            let thr = (BAYER[(cy % 4) as usize][(cx % 4) as usize] + 0.5) / 16.0;
            if thr > t {
                let r = Rect::from_min_size(
                    pos2(art.left() + cx as f32 * cell, rect.top() + cy as f32 * cell),
                    vec2(cell, cell),
                )
                .intersect(rect);
                if r.width() > 0.0 && r.height() > 0.0 {
                    p.rect_filled(r, 0.0, navy);
                }
            }
        }
    }
    p.rect_stroke(
        rect,
        CornerRadius::same(radius),
        Stroke::new(1.0, theme::alpha(accent, 60)),
        StrokeKind::Inside,
    );

    // text + actions
    let gal = p.layout(
        title.to_string(),
        FontId::new(25.0, theme::bold()),
        Color32::WHITE,
        w * 0.54,
    );
    let gh = gal.size().y;
    p.galley(rect.min + vec2(28.0, 26.0), gal, Color32::WHITE);
    let last = app
        .instances
        .iter()
        .filter(|i| i.last_played.is_some())
        .max_by_key(|i| i.last_played)
        .or_else(|| app.instances.first())
        .cloned();
    p.text(
        rect.min + vec2(28.0, 26.0 + gh + 6.0),
        Align2::LEFT_TOP,
        match &last {
            Some(i) => format!(
                "Jump back into {} — {} · {}",
                i.name,
                i.loader.label(),
                i.mc_version
            ),
            None => "Create your first instance to get started.".into(),
        },
        FontId::proportional(14.0),
        theme::MUTED,
    );
    let btns = Rect::from_min_size(rect.min + vec2(28.0, h - 62.0), vec2(w * 0.5, 44.0));
    ui.scope_builder(egui::UiBuilder::new().max_rect(btns), |ui| {
        ui.horizontal(|ui| {
            match &last {
                Some(i) => {
                    if widgets::button_sized(
                        ui,
                        accent,
                        "Continue",
                        Some(Icon::Play),
                        Btn::Primary,
                        true,
                        0.0,
                        44.0,
                    )
                    .clicked()
                    {
                        app.play(&i.id);
                    }
                }
                None => {
                    if widgets::button_sized(
                        ui,
                        accent,
                        "New instance",
                        Some(Icon::Plus),
                        Btn::Primary,
                        true,
                        0.0,
                        44.0,
                    )
                    .clicked()
                    {
                        app.open_create();
                    }
                }
            }
            if widgets::button_sized(
                ui,
                accent,
                "Browse library",
                Some(Icon::Compass),
                Btn::Secondary,
                true,
                0.0,
                44.0,
            )
            .clicked()
            {
                app.goto(Page::Discover);
            }
        });
    });
}
