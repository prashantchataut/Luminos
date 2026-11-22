//! Reusable, animated widgets with a consistent Luminos look.
use crate::{
    icons::{self, Icon},
    theme,
};
use eframe::egui::{
    self, pos2, vec2, Align2, Color32, CornerRadius, FontId, Frame, Margin, Rect, Response, Sense,
    Stroke, StrokeKind, Ui,
};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Btn {
    Primary,
    Secondary,
    Ghost,
    Danger,
}

pub fn button(
    ui: &mut Ui,
    accent: Color32,
    label: &str,
    icon: Option<Icon>,
    kind: Btn,
    enabled: bool,
) -> Response {
    button_sized(ui, accent, label, icon, kind, enabled, 0.0, 36.0)
}

#[allow(clippy::too_many_arguments)]
pub fn button_sized(
    ui: &mut Ui,
    accent: Color32,
    label: &str,
    icon: Option<Icon>,
    kind: Btn,
    enabled: bool,
    min_w: f32,
    h: f32,
) -> Response {
    let font = FontId::new(14.0, theme::bold());
    let galley = ui
        .painter()
        .layout_no_wrap(label.to_string(), font, Color32::WHITE);
    let icon_w = if icon.is_some() { 22.0 } else { 0.0 };
    let w = (galley.size().x + icon_w + 30.0).max(min_w);
    let (rect, resp) = ui.allocate_exact_size(
        vec2(w, h),
        if enabled {
            Sense::click()
        } else {
            Sense::hover()
        },
    );
    let hover = ui
        .ctx()
        .animate_bool_with_time(resp.id, resp.hovered() && enabled, 0.12);
    let press = resp.is_pointer_button_down_on() && enabled;
    let (fill, stroke, fg) = match kind {
        Btn::Primary => (
            theme::mix(accent, Color32::WHITE, 0.10 * hover),
            Stroke::new(1.0, theme::mix(accent, Color32::WHITE, 0.35)),
            Color32::WHITE,
        ),
        Btn::Secondary => (
            theme::mix(theme::BG2, theme::BG3, hover),
            Stroke::new(1.0, theme::mix(theme::LINE, accent, hover * 0.6)),
            theme::TEXT,
        ),
        Btn::Ghost => (
            theme::alpha(theme::BG3, (hover * 255.0) as u8),
            Stroke::NONE,
            theme::mix(theme::MUTED, theme::TEXT, hover),
        ),
        Btn::Danger => (
            theme::alpha(theme::BAD, (30.0 + 60.0 * hover) as u8),
            Stroke::new(1.0, theme::alpha(theme::BAD, 120)),
            theme::BAD,
        ),
    };
    let (fill, fg) = if enabled {
        (fill, fg)
    } else {
        (theme::alpha(fill, 90), theme::alpha(fg, 110))
    };
    let r = rect.shrink(if press { 1.0 } else { 0.0 });
    ui.painter().rect_filled(r, CornerRadius::same(3), fill);
    if kind == Btn::Primary && enabled {
        // hard 1px top light: reads as a pressed-metal key, not a glossy blob
        ui.painter().rect_filled(
            Rect::from_min_size(r.min + vec2(1.0, 1.0), vec2(r.width() - 2.0, 1.0)),
            0.0,
            Color32::from_white_alpha(70),
        );
    }
    if stroke.width > 0.0 {
        ui.painter()
            .rect_stroke(r, CornerRadius::same(3), stroke, StrokeKind::Inside);
    }
    let total = galley.size().x + icon_w;
    let x0 = r.center().x - total / 2.0;
    if let Some(i) = icon {
        icons::paint(ui.painter(), i, pos2(x0 + 8.0, r.center().y), 16.0, fg);
    }
    ui.painter().galley(
        pos2(x0 + icon_w, r.center().y - galley.size().y / 2.0),
        galley,
        fg,
    );
    resp.on_hover_cursor(if enabled {
        egui::CursorIcon::PointingHand
    } else {
        egui::CursorIcon::NotAllowed
    })
}

pub fn icon_button(ui: &mut Ui, accent: Color32, icon: Icon, tip: &str, danger: bool) -> Response {
    let (rect, resp) = ui.allocate_exact_size(vec2(32.0, 32.0), Sense::click());
    let h = ui
        .ctx()
        .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
    let col = if danger { theme::BAD } else { accent };
    ui.painter().rect_filled(
        rect,
        CornerRadius::same(3),
        theme::alpha(col, (h * 40.0) as u8),
    );
    icons::paint(
        ui.painter(),
        icon,
        rect.center(),
        17.0,
        theme::mix(
            theme::MUTED,
            if danger { theme::BAD } else { theme::TEXT },
            h,
        ),
    );
    resp.on_hover_text(tip)
        .on_hover_cursor(egui::CursorIcon::PointingHand)
}

pub fn chip(
    ui: &mut Ui,
    accent: Color32,
    label: &str,
    icon: Option<Icon>,
    selected: bool,
) -> Response {
    let font = FontId::new(
        13.5,
        if selected {
            theme::bold()
        } else {
            egui::FontFamily::Proportional
        },
    );
    let galley = ui
        .painter()
        .layout_no_wrap(label.to_string(), font, Color32::WHITE);
    let icon_w = if icon.is_some() { 20.0 } else { 0.0 };
    let (rect, resp) =
        ui.allocate_exact_size(vec2(galley.size().x + icon_w + 26.0, 32.0), Sense::click());
    let h = ui
        .ctx()
        .animate_bool_with_time(resp.id, resp.hovered(), 0.12);
    let sel = ui
        .ctx()
        .animate_bool_with_time(resp.id.with("sel"), selected, 0.15);
    let fill = theme::mix(
        theme::mix(theme::BG2, theme::BG3, h),
        theme::alpha(accent, 255).linear_multiply(0.35),
        sel,
    );
    ui.painter().rect_filled(rect, CornerRadius::same(4), fill);
    ui.painter().rect_stroke(
        rect,
        CornerRadius::same(4),
        Stroke::new(1.0, theme::mix(theme::LINE, accent, sel.max(h * 0.5))),
        StrokeKind::Inside,
    );
    let fg = theme::mix(theme::MUTED, theme::TEXT, sel.max(h));
    let x0 = rect.center().x - (galley.size().x + icon_w) / 2.0;
    if let Some(i) = icon {
        icons::paint(ui.painter(), i, pos2(x0 + 7.0, rect.center().y), 14.0, fg);
    }
    ui.painter().galley(
        pos2(x0 + icon_w, rect.center().y - galley.size().y / 2.0),
        galley,
        fg,
    );
    resp.on_hover_cursor(egui::CursorIcon::PointingHand)
}

pub fn toggle(ui: &mut Ui, accent: Color32, on: &mut bool) -> Response {
    let (rect, mut resp) = ui.allocate_exact_size(vec2(40.0, 20.0), Sense::click());
    if resp.clicked() {
        *on = !*on;
        resp.mark_changed();
    }
    let t = ui.ctx().animate_bool_with_time(resp.id, *on, 0.12);
    let r = CornerRadius::same(3);
    ui.painter().rect_filled(
        rect,
        r,
        theme::mix(theme::BG0, theme::alpha(accent, 255), t * 0.9),
    );
    ui.painter().rect_stroke(
        rect,
        r,
        Stroke::new(1.0, theme::mix(theme::LINE, accent, t)),
        StrokeKind::Inside,
    );
    let k = Rect::from_min_size(
        pos2(rect.left() + 3.0 + t * 20.0, rect.top() + 3.0),
        vec2(14.0, 14.0),
    );
    ui.painter().rect_filled(
        k,
        CornerRadius::same(2),
        theme::mix(theme::MUTED, Color32::WHITE, t),
    );
    resp.on_hover_cursor(egui::CursorIcon::PointingHand)
}

/// A labelled settings row: title + description on the left, control on the right.
pub fn setting_row(ui: &mut Ui, title: &str, desc: &str, right: impl FnOnce(&mut Ui)) {
    ui.horizontal(|ui| {
        ui.vertical(|ui| {
            ui.label(egui::RichText::new(title).font(FontId::new(14.5, theme::bold())));
            if !desc.is_empty() {
                ui.label(egui::RichText::new(desc).size(12.5).color(theme::MUTED));
            }
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), right);
    });
}

pub fn card<R>(ui: &mut Ui, add: impl FnOnce(&mut Ui) -> R) -> egui::InnerResponse<R> {
    Frame::new()
        .fill(theme::BG1)
        .stroke(Stroke::new(1.0, theme::LINE))
        .corner_radius(CornerRadius::same(4))
        .inner_margin(Margin::same(16))
        .show(ui, add)
}

pub fn heading(ui: &mut Ui, text: &str) {
    ui.label(egui::RichText::new(text).font(FontId::new(26.0, theme::bold())));
}

pub fn subheading(ui: &mut Ui, text: &str) {
    ui.label(egui::RichText::new(text).font(FontId::new(17.0, theme::bold())));
}

pub fn muted(ui: &mut Ui, text: &str) {
    ui.label(egui::RichText::new(text).color(theme::MUTED).size(13.5));
}

pub fn eyebrow(ui: &mut Ui, text: &str) {
    ui.label(
        egui::RichText::new(text.to_uppercase())
            .font(FontId::new(10.5, egui::FontFamily::Monospace))
            .extra_letter_spacing(1.2)
            .color(theme::MUTED),
    );
}

/// Segmented pixel bar: 6-px cells, the leading edge flickers through a dither step.
pub fn progress_bar(ui: &mut Ui, accent: Color32, frac: f32, width: f32, time: f64) {
    let (rect, _) = ui.allocate_exact_size(vec2(width, 12.0), Sense::hover());
    let p = ui.painter();
    p.rect_filled(rect, CornerRadius::same(2), theme::BG0);
    p.rect_stroke(
        rect,
        CornerRadius::same(2),
        Stroke::new(1.0, theme::LINE),
        StrokeKind::Inside,
    );
    let inner = rect.shrink(2.0);
    let cells = (inner.width() / 6.0).floor() as usize;
    let lit = frac.clamp(0.0, 1.0) * cells as f32;
    for i in 0..cells {
        let x = inner.left() + i as f32 * 6.0;
        let cr = Rect::from_min_size(pos2(x, inner.top()), vec2(5.0, inner.height()));
        let col = if (i as f32) + 1.0 <= lit {
            accent
        } else if (i as f32) < lit {
            let on = ((time * 14.0) as usize + i) % 2 == 0;
            if on {
                accent
            } else {
                theme::alpha(accent, 70)
            }
        } else {
            theme::alpha(theme::BG3, 160)
        };
        p.rect_filled(cr, 0.0, col);
    }
}

const ICON_PALETTE: [(Color32, Color32); 8] = [
    (
        Color32::from_rgb(37, 99, 235),
        Color32::from_rgb(14, 165, 233),
    ),
    (
        Color32::from_rgb(79, 70, 229),
        Color32::from_rgb(56, 189, 248),
    ),
    (
        Color32::from_rgb(8, 145, 178),
        Color32::from_rgb(52, 211, 153),
    ),
    (
        Color32::from_rgb(29, 78, 216),
        Color32::from_rgb(129, 140, 248),
    ),
    (
        Color32::from_rgb(2, 132, 199),
        Color32::from_rgb(103, 232, 249),
    ),
    (
        Color32::from_rgb(67, 56, 202),
        Color32::from_rgb(147, 197, 253),
    ),
    (
        Color32::from_rgb(30, 64, 175),
        Color32::from_rgb(59, 130, 246),
    ),
    (
        Color32::from_rgb(14, 116, 144),
        Color32::from_rgb(125, 211, 252),
    ),
];

/// A generated, dithered instance icon with the instance's initials (wide rects become letterless banners).
pub fn instance_icon(ui: &Ui, rect: Rect, name: &str, color: u8) {
    let (a, b) = ICON_PALETTE[color as usize % ICON_PALETTE.len()];
    let p = ui.painter();
    let m = rect.width().min(rect.height());
    let banner = rect.width() > rect.height() * 1.6;
    let r = (m * 0.1).clamp(2.0, 5.0) as u8;
    p.rect_filled(rect, CornerRadius::same(r), a);
    let cell = if banner { 10.0 } else { m / 8.0 };
    let (nx, ny) = (
        (rect.width() / cell).ceil() as i32,
        (rect.height() / cell).ceil() as i32,
    );
    let clip = p.with_clip_rect(rect);
    for gy in 0..ny {
        for gx in 0..nx {
            let t = (gx as f32 / nx as f32 + gy as f32 / ny as f32) / 2.0;
            let thr = ((gx * 3 + gy * 5) % 8) as f32 / 8.0;
            if t > thr * 0.9 + 0.08 {
                let cr = Rect::from_min_size(
                    rect.min + vec2(gx as f32 * cell, gy as f32 * cell),
                    vec2(cell, cell),
                );
                clip.rect_filled(cr, 0.0, theme::alpha(b, 150));
            }
        }
    }
    p.rect_stroke(
        rect,
        CornerRadius::same(r),
        Stroke::new(1.0, Color32::from_white_alpha(40)),
        StrokeKind::Inside,
    );
    if banner {
        return;
    }
    let initials: String = name
        .split_whitespace()
        .filter_map(|w| w.chars().next())
        .take(2)
        .collect::<String>()
        .to_uppercase();
    let initials = if initials.is_empty() {
        "?".into()
    } else {
        initials
    };
    p.text(
        rect.center() + vec2(0.0, 1.0),
        Align2::CENTER_CENTER,
        initials,
        FontId::new(m * 0.4, theme::bold()),
        Color32::WHITE,
    );
}

/// The Luminos mark (lumen orb on an ink tile). Source of truth: `brand.rs`.
pub fn logo_mark(p: &egui::Painter, c: egui::Pos2, size: f32, _accent: Color32, _glow: f32) {
    paint_tile(p, c, size, false);
}

/// The Luminos Client mark: the orb inside HUD reticle brackets.
pub fn client_mark(p: &egui::Painter, c: egui::Pos2, size: f32) {
    paint_tile(p, c, size, true);
}

fn paint_tile(p: &egui::Painter, c: egui::Pos2, size: f32, client: bool) {
    let (n, g) = crate::brand::tile(client);
    let u = size / n as f32;
    let o = c - vec2(size / 2.0, size / 2.0);
    for y in 0..n {
        let mut x = 0;
        while x < n {
            if let Some(col) = g[y * n + x] {
                let mut run = 1;
                while x + run < n && g[y * n + x + run] == Some(col) {
                    run += 1;
                }
                // snap to whole pixels so the cells stay razor sharp at any scale
                let min = pos2((o.x + x as f32 * u).round(), (o.y + y as f32 * u).round());
                let max = pos2(
                    (o.x + (x + run) as f32 * u).round(),
                    (o.y + (y + 1) as f32 * u).round(),
                );
                p.rect_filled(Rect::from_min_max(min, max), 0.0, col);
                x += run;
            } else {
                x += 1;
            }
        }
    }
}

/// A big animated orb: the light source orbits, so the Bayer pattern crawls across the sphere.
pub fn orb(p: &egui::Painter, c: egui::Pos2, diameter: f32, n: usize, angle: f32) {
    let u = diameter / n as f32;
    let light = (angle.cos(), angle.sin());
    let o = c - vec2(diameter / 2.0, diameter / 2.0);
    for y in 0..n {
        for x in 0..n {
            if let Some(t) = crate::brand::orb_cell(n, x, y, light) {
                let min = pos2((o.x + x as f32 * u).round(), (o.y + y as f32 * u).round());
                let max = pos2(
                    (o.x + (x + 1) as f32 * u).round(),
                    (o.y + (y + 1) as f32 * u).round(),
                );
                p.rect_filled(Rect::from_min_max(min, max), 0.0, crate::brand::TONES[t]);
            }
        }
    }
}

/// Round avatar showing a Minecraft face from a skin texture, or a generated placeholder.
pub fn face(ui: &Ui, rect: Rect, tex: Option<&egui::TextureHandle>, name: &str) {
    let p = ui.painter();
    p.rect_filled(
        rect,
        CornerRadius::same((rect.width() * 0.1).clamp(2.0, 6.0) as u8),
        theme::BG3,
    );
    if let Some(t) = tex {
        let inner = rect.shrink(rect.width() * 0.1);
        let uv = |x: f32, y: f32, w: f32, h: f32| {
            Rect::from_min_size(pos2(x / 64.0, y / 64.0), vec2(w / 64.0, h / 64.0))
        };
        p.image(t.id(), inner, uv(8.0, 8.0, 8.0, 8.0), Color32::WHITE);
        p.image(
            t.id(),
            inner.expand(inner.width() * 0.06),
            uv(40.0, 8.0, 8.0, 8.0),
            Color32::WHITE,
        );
    } else {
        let ch = name
            .chars()
            .next()
            .unwrap_or('?')
            .to_uppercase()
            .to_string();
        p.text(
            rect.center(),
            Align2::CENTER_CENTER,
            ch,
            FontId::new(rect.width() * 0.5, theme::bold()),
            theme::TEXT,
        );
    }
    p.rect_stroke(
        rect,
        CornerRadius::same((rect.width() * 0.1).clamp(2.0, 6.0) as u8),
        Stroke::new(1.0, theme::LINE),
        StrokeKind::Inside,
    );
}

/// Small pill label (e.g. "Fabric", "1.21.4", "UPDATE").
pub fn pill(ui: &mut Ui, text: &str, color: Color32) {
    let galley = ui.painter().layout_no_wrap(
        text.to_string(),
        FontId::new(10.5, egui::FontFamily::Monospace),
        color,
    );
    let (rect, _) = ui.allocate_exact_size(vec2(galley.size().x + 14.0, 20.0), Sense::hover());
    ui.painter()
        .rect_filled(rect, CornerRadius::same(3), theme::alpha(color, 28));
    ui.painter().rect_stroke(
        rect,
        CornerRadius::same(3),
        Stroke::new(1.0, theme::alpha(color, 90)),
        StrokeKind::Inside,
    );
    ui.painter().galley(
        pos2(rect.left() + 8.0, rect.center().y - galley.size().y / 2.0),
        galley,
        color,
    );
}
