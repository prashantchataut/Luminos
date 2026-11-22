//! Skin studio: library, fetch-by-username from open services, a pixel editor and a live preview.
use crate::{
    app::{App, Editor, Msg, SkinState, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use eframe::egui::{
    self, pos2, vec2, Align2, Color32, ColorImage, CornerRadius, FontId, Painter, Rect, Sense,
    Stroke, StrokeKind, TextureHandle, TextureId, TextureOptions, Ui,
};
use luminos_core::{paths, skins};
use std::collections::HashMap;

pub fn new_state() -> SkinState {
    SkinState {
        lib: skins::SkinLibrary::default(),
        tex: HashMap::new(),
        selected: None,
        username: String::new(),
        fetching: false,
        editing: false,
        editor: Editor {
            pixels: default_skin(),
            tool: 0,
            color: Color32::from_rgb(79, 140, 255),
            undo: vec![],
            tex: None,
            dirty: true,
            slim: false,
            name: "Luminos Blue".into(),
        },
    }
}

fn fr(px: &mut [Color32], x: usize, y: usize, w: usize, h: usize, c: Color32) {
    for yy in y..y + h {
        for xx in x..x + w {
            px[yy * 64 + xx] = c;
        }
    }
}

/// A friendly starter skin in the Luminos palette (original artwork, not a Mojang texture).
pub fn default_skin() -> Vec<Color32> {
    let mut px = vec![Color32::TRANSPARENT; 64 * 64];
    let skin = Color32::from_rgb(236, 190, 152);
    let hair = Color32::from_rgb(28, 40, 96);
    let shirt = Color32::from_rgb(59, 130, 246);
    let shirt_dk = Color32::from_rgb(37, 99, 235);
    let pants = Color32::from_rgb(30, 41, 90);
    let shoes = Color32::from_rgb(15, 23, 52);
    fr(&mut px, 0, 8, 32, 8, skin);
    fr(&mut px, 8, 0, 8, 8, hair);
    fr(&mut px, 16, 0, 8, 8, skin);
    fr(&mut px, 8, 8, 8, 2, hair);
    fr(&mut px, 0, 8, 8, 3, hair);
    fr(&mut px, 16, 8, 8, 3, hair);
    fr(&mut px, 24, 8, 8, 8, hair);
    fr(&mut px, 9, 12, 1, 1, Color32::WHITE);
    fr(&mut px, 10, 12, 1, 1, Color32::from_rgb(34, 211, 238));
    fr(&mut px, 13, 12, 1, 1, Color32::from_rgb(34, 211, 238));
    fr(&mut px, 14, 12, 1, 1, Color32::WHITE);
    fr(&mut px, 11, 14, 2, 1, Color32::from_rgb(190, 120, 110));
    fr(&mut px, 16, 16, 24, 16, shirt);
    fr(&mut px, 20, 16, 8, 4, shirt_dk);
    fr(&mut px, 28, 16, 8, 4, shirt_dk);
    fr(&mut px, 40, 16, 16, 16, skin);
    fr(&mut px, 44, 16, 4, 4, shirt);
    fr(&mut px, 40, 20, 16, 5, shirt);
    fr(&mut px, 32, 48, 16, 16, skin);
    fr(&mut px, 36, 48, 4, 4, shirt);
    fr(&mut px, 32, 52, 16, 5, shirt);
    fr(&mut px, 0, 16, 16, 16, pants);
    fr(&mut px, 0, 28, 16, 4, shoes);
    fr(&mut px, 16, 48, 16, 16, pants);
    fr(&mut px, 16, 60, 16, 4, shoes);
    px
}

fn flip_copy(px: &mut [Color32], sx: usize, sy: usize, w: usize, h: usize, dx: usize, dy: usize) {
    for yy in 0..h {
        for xx in 0..w {
            px[(dy + yy) * 64 + dx + (w - 1 - xx)] = px[(sy + yy) * 64 + sx + xx];
        }
    }
}

/// Legacy 64x32 skins have no left limbs; mirror the right ones into the 64x64 layout.
fn mirror_limb(px: &mut [Color32], ox: usize, oy: usize, dx: usize, dy: usize) {
    for (sx, sy, w, h, tx, ty) in [
        (4, 0, 4, 4, 4, 0),
        (8, 0, 4, 4, 8, 0),
        (0, 4, 4, 12, 8, 4),
        (4, 4, 4, 12, 4, 4),
        (8, 4, 4, 12, 0, 4),
        (12, 4, 4, 12, 12, 4),
    ] {
        flip_copy(px, ox + sx, oy + sy, w, h, dx + tx, dy + ty);
    }
}

pub fn decode(png: &[u8]) -> Option<Vec<Color32>> {
    let im = image::load_from_memory(png).ok()?.to_rgba8();
    let (w, h) = (im.width() as usize, im.height() as usize);
    if w != 64 || (h != 64 && h != 32) {
        return None;
    }
    let mut px = vec![Color32::TRANSPARENT; 64 * 64];
    for y in 0..h {
        for x in 0..w {
            let p = im.get_pixel(x as u32, y as u32).0;
            px[y * 64 + x] = Color32::from_rgba_unmultiplied(p[0], p[1], p[2], p[3]);
        }
    }
    if h == 32 {
        mirror_limb(&mut px, 0, 16, 16, 48);
        mirror_limb(&mut px, 40, 16, 32, 48);
    }
    Some(px)
}

pub fn encode(px: &[Color32]) -> Vec<u8> {
    let img = image::RgbaImage::from_fn(64, 64, |x, y| {
        image::Rgba(px[(y * 64 + x) as usize].to_srgba_unmultiplied())
    });
    let mut buf = vec![];
    let _ = img.write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png);
    buf
}

pub fn skin_tex(app: &mut App, id: &str) -> Option<TextureHandle> {
    if let Some(t) = app.skins.tex.get(id) {
        return Some(t.clone());
    }
    if !app.persist {
        return None;
    }
    let px = decode(&skins::read_png(id)?)?;
    let t = app.ctx.load_texture(
        format!("skin-{id}"),
        ColorImage::new([64, 64], px),
        TextureOptions::NEAREST,
    );
    app.skins.tex.insert(id.to_string(), t.clone());
    Some(t)
}

pub fn import_png(app: &mut App, name: &str, png: &[u8], source: &str) {
    let Some(px) = decode(png) else {
        app.toast(
            "That image isn't a valid 64×64 or 64×32 skin",
            ToastKind::Bad,
        );
        return;
    };
    app.skins.editor.pixels = px.clone();
    app.skins.editor.dirty = true;
    app.skins.editor.name = name.to_string();
    app.skins.editor.undo.clear();
    if app.persist {
        match skins::save(name, &encode(&px), false, source) {
            Ok(e) => {
                app.skins.selected = Some(e.id);
                app.skins.lib = skins::load();
                app.toast(format!("Added “{name}” to your library"), ToastKind::Good);
            }
            Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
        }
    }
}

fn uv(x: f32, y: f32, w: f32, h: f32) -> Rect {
    Rect::from_min_size(pos2(x / 64.0, y / 64.0), vec2(w / 64.0, h / 64.0))
}

/// Draw a front or back view of the skin at `scale` screen px per skin px.
pub fn draw_character(
    p: &Painter,
    tex: TextureId,
    o: egui::Pos2,
    scale: f32,
    slim: bool,
    back: bool,
) {
    let aw = if slim { 3.0 } else { 4.0 };
    let put = |dx: f32, dy: f32, w: f32, h: f32, u: Rect, grow: f32| {
        let r =
            Rect::from_min_size(o + vec2(dx, dy) * scale, vec2(w, h) * scale).expand(grow * scale);
        p.image(tex, r, u, Color32::WHITE);
    };
    if !back {
        put(4.0 - aw, 8.0, aw, 12.0, uv(44.0, 20.0, aw, 12.0), 0.0);
        put(12.0, 8.0, aw, 12.0, uv(36.0, 52.0, aw, 12.0), 0.0);
        put(4.0, 20.0, 4.0, 12.0, uv(4.0, 20.0, 4.0, 12.0), 0.0);
        put(8.0, 20.0, 4.0, 12.0, uv(20.0, 52.0, 4.0, 12.0), 0.0);
        put(4.0, 8.0, 8.0, 12.0, uv(20.0, 20.0, 8.0, 12.0), 0.0);
        put(4.0, 0.0, 8.0, 8.0, uv(8.0, 8.0, 8.0, 8.0), 0.0);
        put(4.0, 8.0, 8.0, 12.0, uv(20.0, 36.0, 8.0, 12.0), 0.25);
        put(4.0, 0.0, 8.0, 8.0, uv(40.0, 8.0, 8.0, 8.0), 0.5);
    } else {
        put(12.0, 8.0, aw, 12.0, uv(48.0 + aw, 20.0, aw, 12.0), 0.0);
        put(4.0 - aw, 8.0, aw, 12.0, uv(40.0 + aw, 52.0, aw, 12.0), 0.0);
        put(8.0, 20.0, 4.0, 12.0, uv(12.0, 20.0, 4.0, 12.0), 0.0);
        put(4.0, 20.0, 4.0, 12.0, uv(28.0, 52.0, 4.0, 12.0), 0.0);
        put(4.0, 8.0, 8.0, 12.0, uv(32.0, 20.0, 8.0, 12.0), 0.0);
        put(4.0, 0.0, 8.0, 8.0, uv(24.0, 8.0, 8.0, 8.0), 0.0);
        put(4.0, 8.0, 8.0, 12.0, uv(32.0, 36.0, 8.0, 12.0), 0.25);
        put(4.0, 0.0, 8.0, 8.0, uv(56.0, 8.0, 8.0, 8.0), 0.5);
    }
}

fn swatches() -> [Color32; 24] {
    let c = Color32::from_rgb;
    [
        c(0, 0, 0),
        c(51, 51, 51),
        c(102, 102, 102),
        c(170, 170, 170),
        c(230, 230, 230),
        c(255, 255, 255),
        c(15, 23, 52),
        c(30, 41, 90),
        c(37, 99, 235),
        c(59, 130, 246),
        c(96, 165, 250),
        c(147, 197, 253),
        c(8, 145, 178),
        c(34, 211, 238),
        c(52, 211, 153),
        c(132, 204, 22),
        c(250, 204, 21),
        c(251, 146, 60),
        c(239, 68, 68),
        c(236, 72, 153),
        c(168, 85, 247),
        c(236, 190, 152),
        c(180, 120, 80),
        c(92, 58, 30),
    ]
}

fn flood(px: &mut [Color32], x: usize, y: usize, to: Color32) {
    let from = px[y * 64 + x];
    if from == to {
        return;
    }
    let mut stack = vec![(x, y)];
    while let Some((cx, cy)) = stack.pop() {
        if px[cy * 64 + cx] != from {
            continue;
        }
        px[cy * 64 + cx] = to;
        if cx > 0 {
            stack.push((cx - 1, cy));
        }
        if cx < 63 {
            stack.push((cx + 1, cy));
        }
        if cy > 0 {
            stack.push((cx, cy - 1));
        }
        if cy < 63 {
            stack.push((cx, cy + 1));
        }
    }
}

fn sync_editor_tex(app: &mut App) {
    let e = &mut app.skins.editor;
    if e.dirty || e.tex.is_none() {
        let img = ColorImage::new([64, 64], e.pixels.clone());
        match &mut e.tex {
            Some(t) => t.set(img, TextureOptions::NEAREST),
            None => {
                e.tex = Some(
                    app.ctx
                        .load_texture("skin-editor", img, TextureOptions::NEAREST),
                )
            }
        }
        e.dirty = false;
    }
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    sync_editor_tex(app);
    widgets::heading(ui, "Skins");
    widgets::muted(
        ui,
        "Collect skins from open libraries, edit them pixel by pixel, and wear them in-game.",
    );
    ui.add_space(4.0);
    ui.horizontal_top(|ui| {
        ui.vertical(|ui| {
            ui.set_width(318.0);
            preview(app, ui);
        });
        ui.vertical(|ui| {
            ui.set_width(ui.available_width());
            ui.horizontal(|ui| {
                if widgets::chip(ui, accent, "Library", Some(Icon::Grid), !app.skins.editing)
                    .clicked()
                {
                    app.skins.editing = false;
                }
                if widgets::chip(ui, accent, "Studio", Some(Icon::Brush), app.skins.editing)
                    .clicked()
                {
                    app.skins.editing = true;
                }
            });
            if app.skins.editing {
                studio(app, ui);
            } else {
                library(app, ui);
            }
        });
    });
}

fn preview(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 276.0), Sense::hover());
        let p = ui.painter();
        p.rect_filled(r, CornerRadius::same(4), theme::BG0);
        p.rect_stroke(
            r,
            CornerRadius::same(4),
            Stroke::new(1.0, theme::LINE),
            StrokeKind::Inside,
        );
        // dither floor glow
        for i in 0..14 {
            let w = 220.0 - i as f32 * 12.0;
            p.rect_filled(
                Rect::from_center_size(pos2(r.center().x, r.bottom() - 18.0), vec2(w, 10.0)),
                CornerRadius::same(2),
                theme::alpha(accent, 7),
            );
        }
        if let Some(t) = &app.skins.editor.tex {
            let s = 7.0;
            draw_character(
                p,
                t.id(),
                pos2(r.center().x - 16.0 * s - 6.0, r.top() + 20.0),
                s,
                app.skins.editor.slim,
                false,
            );
            draw_character(
                p,
                t.id(),
                pos2(r.center().x + 6.0, r.top() + 20.0),
                s,
                app.skins.editor.slim,
                true,
            );
        }
        p.text(
            pos2(r.center().x - 62.0, r.bottom() - 8.0),
            Align2::CENTER_CENTER,
            "FRONT",
            FontId::new(10.0, theme::bold()),
            theme::MUTED,
        );
        p.text(
            pos2(r.center().x + 62.0, r.bottom() - 8.0),
            Align2::CENTER_CENTER,
            "BACK",
            FontId::new(10.0, theme::bold()),
            theme::MUTED,
        );
        ui.add(
            egui::TextEdit::singleline(&mut app.skins.editor.name)
                .desired_width(f32::INFINITY)
                .margin(egui::Margin::symmetric(10, 8)),
        );
        widgets::setting_row(ui, "Slim arms", "3px “Alex” model", |ui| {
            widgets::toggle(ui, accent, &mut app.skins.editor.slim);
        });
        let acc_name = app
            .accounts
            .active()
            .map(|a| a.username.clone())
            .unwrap_or_default();
        if widgets::button_sized(
            ui,
            accent,
            &format!("Wear as {acc_name}"),
            Some(Icon::Check),
            Btn::Primary,
            !acc_name.is_empty(),
            ui.available_width(),
            38.0,
        )
        .clicked()
        {
            wear(app);
        }
        ui.horizontal(|ui| {
            if widgets::button_sized(
                ui,
                accent,
                "Save",
                Some(Icon::Download),
                Btn::Secondary,
                true,
                0.0,
                34.0,
            )
            .clicked()
            {
                let png = encode(&app.skins.editor.pixels);
                if app.persist {
                    match skins::save(
                        &app.skins.editor.name,
                        &png,
                        app.skins.editor.slim,
                        "Studio",
                    ) {
                        Ok(e) => {
                            app.skins.selected = Some(e.id);
                            app.skins.lib = skins::load();
                            app.toast("Saved to your library", ToastKind::Good);
                        }
                        Err(e) => app.toast(format!("{e:#}"), ToastKind::Bad),
                    }
                }
            }
            if widgets::button_sized(
                ui,
                accent,
                "Folder",
                Some(Icon::Folder),
                Btn::Ghost,
                true,
                0.0,
                34.0,
            )
            .clicked()
            {
                let _ = std::fs::create_dir_all(paths::skins_dir());
                let _ = open::that(paths::skins_dir());
            }
        });
    });
}

fn wear(app: &mut App) {
    if !app.persist {
        return;
    }
    let png = encode(&app.skins.editor.pixels);
    let id = match &app.skins.selected {
        Some(id)
            if skins::png_path(id).exists()
                && std::fs::read(skins::png_path(id)).ok().as_deref() == Some(&png[..]) =>
        {
            id.clone()
        }
        _ => match skins::save(
            &app.skins.editor.name,
            &png,
            app.skins.editor.slim,
            "Studio",
        ) {
            Ok(e) => {
                app.skins.lib = skins::load();
                e.id
            }
            Err(e) => {
                app.toast(format!("{e:#}"), ToastKind::Bad);
                return;
            }
        },
    };
    app.skins.selected = Some(id.clone());
    let active = app.accounts.active;
    if let Some(a) = app.accounts.accounts.get_mut(active) {
        a.skin_id = Some(id.clone());
    }
    app.accounts.save();
    app.skins.tex.remove(&id);
    app.toast(
        "Skin set — it's applied via CustomSkinLoader when you launch",
        ToastKind::Good,
    );
}

fn library(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Get a skin from an open library");
        ui.horizontal(|ui| {
            ui.add(
                egui::TextEdit::singleline(&mut app.skins.username)
                    .hint_text("Any Minecraft username")
                    .desired_width(240.0)
                    .margin(egui::Margin::symmetric(10, 8)),
            );
            let ok =
                luminos_core::accounts::valid_username(&app.skins.username) && !app.skins.fetching;
            if widgets::button_sized(
                ui,
                accent,
                if app.skins.fetching {
                    "Fetching…"
                } else {
                    "Fetch skin"
                },
                Some(Icon::Download),
                Btn::Primary,
                ok,
                0.0,
                36.0,
            )
            .clicked()
                && app.persist
            {
                app.skins.fetching = true;
                let name = app.skins.username.clone();
                let bg = app.bg();
                std::thread::spawn(move || {
                    bg.send(Msg::SkinFetched(
                        skins::fetch_by_username(&name)
                            .map(|b| (name, b))
                            .map_err(|e| format!("{e:#}")),
                    ))
                });
            }
        });
        widgets::muted(
            ui,
            &format!(
                "Sources: {} — open services that serve public skins.",
                skins::OPEN_SOURCES
                    .iter()
                    .map(|s| s.0)
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        );
    });
    ui.add_space(4.0);
    widgets::subheading(ui, &format!("Your library · {}", app.skins.lib.skins.len()));
    let list = app.skins.lib.skins.clone();
    if list.is_empty() {
        widgets::muted(
            ui,
            "Nothing saved yet. Fetch a skin above, or design one in the Studio.",
        );
    }
    let gap = 12.0;
    let cols = (((ui.available_width() + gap) / (150.0 + gap)).floor() as usize).max(1);
    let w = ((ui.available_width() - gap * (cols as f32 - 1.0)) / cols as f32).floor();
    let mut load: Option<String> = None;
    let mut del: Option<String> = None;
    for row in list.chunks(cols) {
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = gap;
            for s in row {
                let (r, resp) = ui.allocate_exact_size(vec2(w, 150.0), Sense::click());
                let sel = app.skins.selected.as_deref() == Some(s.id.as_str());
                let rid = resp.id;
                let h = ui
                    .ctx()
                    .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
                ui.painter().rect_filled(
                    r,
                    CornerRadius::same(4),
                    theme::mix(theme::BG2, theme::BG3, h),
                );
                ui.painter().rect_stroke(
                    r,
                    CornerRadius::same(4),
                    Stroke::new(
                        1.0 + sel as u8 as f32,
                        if sel { accent } else { theme::LINE },
                    ),
                    StrokeKind::Inside,
                );
                if let Some(t) = skin_tex(app, &s.id) {
                    draw_character(
                        ui.painter(),
                        t.id(),
                        pos2(r.center().x - 16.0 * 3.5 / 2.0 + 0.0, r.top() + 12.0),
                        3.5,
                        s.slim,
                        false,
                    );
                }
                ui.painter().text(
                    pos2(r.center().x, r.bottom() - 20.0),
                    Align2::CENTER_CENTER,
                    &s.name,
                    FontId::new(13.0, theme::bold()),
                    theme::TEXT,
                );
                if resp
                    .on_hover_cursor(egui::CursorIcon::PointingHand)
                    .clicked()
                {
                    load = Some(s.id.clone());
                }
                let x = Rect::from_center_size(r.right_top() + vec2(-16.0, 16.0), vec2(26.0, 26.0));
                if h > 0.0 {
                    let xr = ui.interact(x, rid.with("del"), Sense::click());
                    crate::icons::paint(
                        ui.painter(),
                        Icon::Trash,
                        x.center(),
                        14.0,
                        theme::alpha(theme::BAD, (200.0 * h) as u8),
                    );
                    if xr.clicked() {
                        del = Some(s.id.clone());
                        load = None;
                    }
                }
            }
        });
    }
    if let Some(id) = load {
        if let Some(px) = skins::read_png(&id).and_then(|b| decode(&b)) {
            app.skins.editor.pixels = px;
            app.skins.editor.dirty = true;
            app.skins.editor.undo.clear();
            if let Some(e) = app.skins.lib.skins.iter().find(|s| s.id == id) {
                app.skins.editor.name = e.name.clone();
                app.skins.editor.slim = e.slim;
            }
            app.skins.selected = Some(id);
        }
    }
    if let Some(id) = del {
        skins::delete(&id);
        app.skins.lib = skins::load();
        app.skins.tex.remove(&id);
    }
}

fn studio(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    ui.horizontal_top(|ui| {
        // canvas
        let scale = 7.0;
        let (rect, resp) = ui.allocate_exact_size(vec2(64.0 * scale, 64.0 * scale), Sense::click_and_drag());
        let p = ui.painter();
        p.rect_filled(rect, CornerRadius::same(2), theme::BG0);
        for y in 0..64 {
            for x in 0..64 {
                if (x + y) % 2 == 0 {
                    p.rect_filled(Rect::from_min_size(rect.min + vec2(x as f32, y as f32) * scale, vec2(scale, scale)), 0.0, Color32::from_gray(26));
                }
            }
        }
        if let Some(t) = &app.skins.editor.tex {
            p.image(t.id(), rect, Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0)), Color32::WHITE);
        }
        for i in (0..=64).step_by(8) {
            let o = i as f32 * scale;
            p.line_segment([rect.min + vec2(o, 0.0), rect.min + vec2(o, rect.height())], Stroke::new(1.0, Color32::from_white_alpha(14)));
            p.line_segment([rect.min + vec2(0.0, o), rect.min + vec2(rect.width(), o)], Stroke::new(1.0, Color32::from_white_alpha(14)));
        }
        p.rect_stroke(rect, CornerRadius::same(2), Stroke::new(1.0, theme::LINE), StrokeKind::Outside);
        let pointer = resp.hover_pos().or_else(|| resp.interact_pointer_pos());
        if let Some(pos) = pointer.filter(|p| rect.contains(*p)) {
            let px = (((pos.x - rect.left()) / scale) as usize).min(63);
            let py = (((pos.y - rect.top()) / scale) as usize).min(63);
            ui.painter().rect_stroke(Rect::from_min_size(rect.min + vec2(px as f32, py as f32) * scale, vec2(scale, scale)), 0.0, Stroke::new(1.5, Color32::WHITE), StrokeKind::Outside);
            let pressed = resp.hovered() && ui.input(|i| i.pointer.primary_pressed());
            let active = pressed || resp.dragged();
            if active {
                let e = &mut app.skins.editor;
                if pressed {
                    e.undo.push(e.pixels.clone());
                    if e.undo.len() > 50 {
                        e.undo.remove(0);
                    }
                }
                match e.tool {
                    0 => e.pixels[py * 64 + px] = e.color,
                    1 => e.pixels[py * 64 + px] = Color32::TRANSPARENT,
                    2 if pressed => {
                        let c = e.color;
                        flood(&mut e.pixels, px, py, c);
                    }
                    3 if pressed => {
                        let c = e.pixels[py * 64 + px];
                        if c.a() > 0 {
                            e.color = c;
                        }
                        e.tool = 0;
                    }
                    _ => {}
                }
                e.dirty = true;
            }
        }
        ui.vertical(|ui| {
            ui.set_width(ui.available_width());
            widgets::eyebrow(ui, "Tools");
            ui.horizontal_wrapped(|ui| {
                for (i, (icon, name)) in [(Icon::Brush, "Pencil"), (Icon::Eraser, "Eraser"), (Icon::Bucket, "Fill"), (Icon::Pipette, "Picker")].into_iter().enumerate() {
                    if widgets::chip(ui, accent, name, Some(icon), app.skins.editor.tool == i).clicked() {
                        app.skins.editor.tool = i;
                    }
                }
            });
            widgets::eyebrow(ui, "Colour");
            ui.horizontal(|ui| {
                ui.color_edit_button_srgba(&mut app.skins.editor.color);
                let c = app.skins.editor.color;
                ui.label(egui::RichText::new(format!("#{:02X}{:02X}{:02X}", c.r(), c.g(), c.b())).monospace().color(theme::MUTED));
            });
            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing = vec2(6.0, 6.0);
                for c in swatches() {
                    let (r, resp) = ui.allocate_exact_size(vec2(22.0, 22.0), Sense::click());
                    ui.painter().rect_filled(r, CornerRadius::same(2), c);
                    ui.painter().rect_stroke(r, CornerRadius::same(2), Stroke::new(if app.skins.editor.color == c { 2.0 } else { 1.0 }, if app.skins.editor.color == c { Color32::WHITE } else { theme::LINE }), StrokeKind::Inside);
                    if resp.on_hover_cursor(egui::CursorIcon::PointingHand).clicked() {
                        app.skins.editor.color = c;
                    }
                }
            });
            ui.add_space(6.0);
            ui.horizontal(|ui| {
                let can = !app.skins.editor.undo.is_empty();
                if widgets::button_sized(ui, accent, "Undo", Some(Icon::Back), Btn::Secondary, can, 0.0, 34.0).clicked() {
                    if let Some(prev) = app.skins.editor.undo.pop() {
                        app.skins.editor.pixels = prev;
                        app.skins.editor.dirty = true;
                    }
                }
                if widgets::button_sized(ui, accent, "Template", Some(Icon::Refresh), Btn::Ghost, true, 0.0, 34.0).clicked() {
                    app.skins.editor.undo.push(app.skins.editor.pixels.clone());
                    app.skins.editor.pixels = default_skin();
                    app.skins.editor.dirty = true;
                }
            });
            widgets::muted(ui, "Tip: the layout is the standard 64×64 skin sheet — head top-left, body centre, limbs right.");
        });
    });
}
