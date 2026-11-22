//! Discover: browse and install mods, modpacks, resource packs and shaders from Modrinth.
use crate::{
    app::{App, Loadable, Msg, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{
    self, pos2, vec2, Align, Align2, CornerRadius, FontId, Layout, Rect, Sense, Stroke, StrokeKind,
    Ui,
};
use luminos_core::{
    content::{self, Kind},
    download::Progress,
    instances::Instance,
    modrinth::{self, Project, SearchQuery},
    mrpack, store,
};

const KINDS: [(&str, &str, Icon); 5] = [
    ("mod", "Mods", Icon::Cube),
    ("modpack", "Modpacks", Icon::Layers),
    ("resourcepack", "Resource packs", Icon::Brush),
    ("shader", "Shaders", Icon::Bolt),
    ("datapack", "Data packs", Icon::Grid),
];
const SORTS: [(&str, &str); 5] = [
    ("relevance", "Relevance"),
    ("downloads", "Downloads"),
    ("follows", "Follows"),
    ("newest", "Newest"),
    ("updated", "Updated"),
];

pub fn target(app: &App) -> Option<Instance> {
    app.discover
        .target
        .as_ref()
        .and_then(|id| app.instance(id).cloned())
        .or_else(|| app.instances.first().cloned())
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    widgets::heading(ui, "Discover");
    widgets::muted(ui, "Mods, modpacks, resource packs and shaders from Modrinth — one click to install, auto-updated for you.");
    ui.add_space(4.0);
    ui.horizontal_wrapped(|ui| {
        for (id, label, icon) in KINDS {
            if widgets::chip(ui, accent, label, Some(icon), app.discover.kind == id).clicked() {
                app.discover.kind = id;
            }
        }
    });
    ui.horizontal(|ui| {
        let edit = ui.add(
            egui::TextEdit::singleline(&mut app.discover.query)
                .hint_text("Search mods, packs, shaders…")
                .desired_width((ui.available_width() - 130.0).max(160.0))
                .margin(egui::Margin::symmetric(12, 10)),
        );
        let enter = edit.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));
        if (widgets::button_sized(
            ui,
            accent,
            "Search",
            Some(Icon::Search),
            Btn::Primary,
            true,
            0.0,
            40.0,
        )
        .clicked()
            || enter)
            && app.discover.query != app.discover.submitted
        {
            app.discover.submitted = app.discover.query.clone();
            app.discover.page = 0;
        }
    });
    ui.add_space(4.0);

    // fire a search whenever the effective query changes
    let inst = target(app);
    let kind = app.discover.kind;
    let loader = if app.discover.filter_loader && kind == "mod" {
        inst.as_ref()
            .and_then(|i| i.loader.modrinth_id())
            .map(String::from)
    } else {
        None
    };
    let version = if app.discover.filter_version && kind != "modpack" {
        inst.as_ref().map(|i| i.mc_version.clone())
    } else {
        None
    };
    let key = format!(
        "{}|{kind}|{}|{loader:?}|{version:?}|{}",
        app.discover.submitted, app.discover.sort, app.discover.page
    );
    if key != app.discover.key && app.persist {
        app.discover.key = key;
        app.discover.generation += 1;
        app.discover.results = Loadable::Loading;
        let gen = app.discover.generation;
        let q = SearchQuery {
            text: app.discover.submitted.clone(),
            project_type: kind.into(),
            loader,
            game_version: version,
            sort: app.discover.sort.into(),
            offset: app.discover.page * 18,
            limit: 18,
        };
        let bg = app.bg();
        std::thread::spawn(move || {
            bg.send(Msg::Search(
                gen,
                modrinth::search(&q).map_err(|e| format!("{e:#}")),
            ))
        });
    }

    match &app.discover.results {
        Loadable::Loading | Loadable::Idle => {
            let dots = ".".repeat(((app.time * 3.0) as usize) % 4);
            widgets::muted(ui, &format!("Searching Modrinth{dots}"));
            ui.ctx()
                .request_repaint_after(std::time::Duration::from_millis(200));
        }
        Loadable::Failed(e) => {
            widgets::card(ui, |ui| {
                ui.set_width(ui.available_width());
                ui.label(
                    egui::RichText::new("Couldn't reach Modrinth")
                        .font(FontId::new(15.0, theme::bold()))
                        .color(theme::WARN),
                );
                widgets::muted(ui, e);
            });
        }
        Loadable::Ready(res) => {
            let hits = res.hits.clone();
            let total = res.total_hits;
            if hits.is_empty() {
                widgets::muted(
                    ui,
                    "No results. Try a different search or relax the filters.",
                );
            }
            let gap = 14.0;
            let cols = (((ui.available_width() + gap) / (290.0 + gap)).floor() as usize).max(1);
            let w = ((ui.available_width() - gap * (cols as f32 - 1.0)) / cols as f32).floor();
            for row in hits.chunks(cols) {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = gap;
                    for p in row {
                        card(app, ui, p, w);
                    }
                });
                ui.add_space(2.0);
            }
            ui.horizontal(|ui| {
                if widgets::button(
                    ui,
                    accent,
                    "Previous",
                    Some(Icon::Back),
                    Btn::Secondary,
                    app.discover.page > 0,
                )
                .clicked()
                {
                    app.discover.page -= 1;
                }
                ui.label(
                    egui::RichText::new(format!(
                        "Page {} · {} results",
                        app.discover.page + 1,
                        total
                    ))
                    .color(theme::MUTED),
                );
                if widgets::button(
                    ui,
                    accent,
                    "Next",
                    None,
                    Btn::Secondary,
                    (app.discover.page as u64 + 1) * 18 < total,
                )
                .clicked()
                {
                    app.discover.page += 1;
                }
            });
        }
    }
}

fn card(app: &mut App, ui: &mut Ui, p: &Project, w: f32) {
    let accent = app.accent();
    let h = 244.0;
    let (r, resp) = ui.allocate_exact_size(vec2(w, h), Sense::hover());
    let hv = ui
        .ctx()
        .animate_bool_with_time(resp.id, resp.hovered(), 0.15);
    ui.painter()
        .rect_filled(r, CornerRadius::same(16), theme::BG2);
    let banner = Rect::from_min_size(r.min, vec2(w, 96.0));
    let seed = p.title.bytes().fold(7u8, |a, b| a.wrapping_add(b));
    let gallery = p.featured_gallery.clone();
    app.paint_remote(ui, banner, gallery.as_deref(), 16, |ui| {
        widgets::instance_icon(ui, banner, &p.title, seed);
    });
    ui.painter().rect_filled(
        Rect::from_min_size(banner.left_bottom() - vec2(0.0, 30.0), vec2(w, 30.0)),
        0.0,
        theme::alpha(theme::BG2, 80),
    );
    let icon = Rect::from_min_size(banner.left_bottom() + vec2(12.0, -22.0), vec2(46.0, 46.0));
    app.paint_remote(ui, icon, p.icon_url.as_deref(), 12, |ui| {
        widgets::instance_icon(ui, icon, &p.title, seed)
    });
    ui.painter().rect_stroke(
        icon,
        CornerRadius::same(12),
        Stroke::new(2.0, theme::BG2),
        StrokeKind::Outside,
    );
    ui.painter().text(
        r.right_top() + vec2(-12.0, 108.0),
        Align2::RIGHT_CENTER,
        format!("↓ {}", store::fmt_count(p.downloads)),
        FontId::new(12.5, theme::bold()),
        theme::MUTED,
    );
    let g = ui.painter().layout(
        p.title.clone(),
        FontId::new(15.0, theme::bold()),
        theme::TEXT,
        w - 24.0,
    );
    ui.painter()
        .galley(pos2(r.left() + 14.0, r.top() + 124.0), g, theme::TEXT);
    let mut desc = p.description.clone();
    let mut g = ui.painter().layout(
        desc.clone(),
        FontId::new(12.5, egui::FontFamily::Proportional),
        theme::MUTED,
        w - 28.0,
    );
    if g.rows.len() > 2 {
        desc = format!("{}…", desc.chars().take(78).collect::<String>().trim_end());
        g = ui.painter().layout(
            desc,
            FontId::new(12.5, egui::FontFamily::Proportional),
            theme::MUTED,
            w - 28.0,
        );
    }
    ui.painter()
        .galley(pos2(r.left() + 14.0, r.top() + 146.0), g, theme::MUTED);
    ui.painter().text(
        r.left_bottom() + vec2(14.0, -26.0),
        Align2::LEFT_CENTER,
        format!("by {}", p.author),
        FontId::new(12.5, egui::FontFamily::Proportional),
        theme::MUTED,
    );
    let busy = app.discover.installing.contains(&p.id);
    let btn = Rect::from_min_size(r.right_bottom() - vec2(112.0, 42.0), vec2(100.0, 32.0));
    ui.scope_builder(egui::UiBuilder::new().max_rect(btn), |ui| {
        if widgets::button_sized(
            ui,
            accent,
            if busy { "Installing…" } else { "Install" },
            Some(Icon::Download),
            Btn::Primary,
            !busy,
            100.0,
            32.0,
        )
        .clicked()
        {
            install(app, p);
        }
    });
    ui.painter().rect_stroke(
        r,
        CornerRadius::same(16),
        Stroke::new(1.0, theme::mix(theme::LINE, accent, hv)),
        StrokeKind::Inside,
    );
}

fn install(app: &mut App, p: &Project) {
    if !app.persist {
        app.toast("Demo mode — nothing was installed", ToastKind::Info);
        return;
    }
    let id = p.id.clone();
    let bg = app.bg();
    if app.discover.kind == "modpack" {
        app.discover.installing.insert(id.clone());
        app.toast(
            format!("Installing {} — this can take a minute…", p.title),
            ToastKind::Info,
        );
        let threads = app.settings.download_threads;
        std::thread::spawn(move || {
            let prog = Progress::new();
            bg.send(Msg::Created {
                result: mrpack::install_modpack(&id, threads, &prog).map_err(|e| format!("{e:#}")),
                from_wizard: false,
            });
        });
        return;
    }
    let Some(inst) = target(app) else {
        app.toast("Create an instance first", ToastKind::Bad);
        return;
    };
    let kind = Kind::from_project_type(app.discover.kind);
    app.discover.installing.insert(id.clone());
    let title = p.title.clone();
    std::thread::spawn(move || {
        let msg = match content::install_project(&inst, &id, kind) {
            Ok(done) => (
                format!(
                    "Installed {} into {}{}",
                    title,
                    inst.name,
                    if done.len() > 1 {
                        format!(" (+{} dependencies)", done.len() - 1)
                    } else {
                        String::new()
                    }
                ),
                ToastKind::Good,
            ),
            Err(e) => (format!("{e:#}"), ToastKind::Bad),
        };
        bg.send(Msg::Content);
        bg.send(Msg::Toast(msg.0, msg.1));
    });
}

pub fn filters(app: &mut App, ui: &mut Ui) {
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
        widgets::subheading(ui, "Filters");
    });
    widgets::eyebrow(ui, "Source");
    ui.horizontal(|ui| {
        widgets::chip(ui, accent, "Modrinth", None, true);
        widgets::chip(ui, accent, "CurseForge · soon", None, false);
    });
    widgets::eyebrow(ui, "Sort by");
    ui.horizontal_wrapped(|ui| {
        for (id, label) in SORTS {
            if widgets::chip(ui, accent, label, None, app.discover.sort == id).clicked() {
                app.discover.sort = id;
            }
        }
    });
    widgets::eyebrow(ui, "Install into");
    let insts = app.instances.clone();
    let cur = target(app).map(|i| i.id);
    if insts.is_empty() {
        widgets::muted(ui, "No instances yet.");
    }
    for inst in insts.iter().take(8) {
        let sel = cur.as_deref() == Some(inst.id.as_str());
        let (r, resp) = ui.allocate_exact_size(vec2(ui.available_width(), 44.0), Sense::click());
        let a = ui.ctx().animate_bool_with_time(resp.id, sel, 0.15);
        ui.painter().rect_filled(
            r,
            CornerRadius::same(12),
            theme::mix(
                theme::BG2,
                theme::alpha(accent, 255).linear_multiply(0.3),
                a,
            ),
        );
        ui.painter().rect_stroke(
            r,
            CornerRadius::same(12),
            Stroke::new(1.0, theme::mix(theme::LINE, accent, a)),
            StrokeKind::Inside,
        );
        widgets::instance_icon(
            ui,
            Rect::from_min_size(r.min + vec2(7.0, 7.0), vec2(30.0, 30.0)),
            &inst.name,
            inst.color,
        );
        ui.painter().text(
            r.min + vec2(46.0, 13.0),
            Align2::LEFT_CENTER,
            &inst.name,
            FontId::new(13.5, theme::bold()),
            theme::TEXT,
        );
        ui.painter().text(
            r.min + vec2(46.0, 30.0),
            Align2::LEFT_CENTER,
            inst.subtitle(),
            FontId::new(11.5, egui::FontFamily::Proportional),
            theme::MUTED,
        );
        if resp
            .on_hover_cursor(egui::CursorIcon::PointingHand)
            .clicked()
        {
            app.discover.target = Some(inst.id.clone());
        }
    }
    widgets::eyebrow(ui, "Compatibility");
    widgets::setting_row(ui, "Match game version", "", |ui| {
        widgets::toggle(ui, accent, &mut app.discover.filter_version);
    });
    widgets::setting_row(ui, "Match mod loader", "", |ui| {
        widgets::toggle(ui, accent, &mut app.discover.filter_loader);
    });
    ui.with_layout(Layout::bottom_up(Align::Min), |_| {});
}
