//! Luminos design tokens: a deep-navy, dithered-blue identity.
use eframe::egui::{
    self, Color32, CornerRadius, FontData, FontDefinitions, FontFamily, FontId, Stroke, TextStyle,
};
use std::sync::Arc;

pub const BG0: Color32 = Color32::from_rgb(4, 7, 18);
pub const BG1: Color32 = Color32::from_rgb(8, 13, 30);
pub const BG2: Color32 = Color32::from_rgb(13, 21, 46);
pub const BG3: Color32 = Color32::from_rgb(21, 33, 70);
pub const LINE: Color32 = Color32::from_rgb(28, 42, 88);
pub const TEXT: Color32 = Color32::from_rgb(232, 238, 255);
pub const MUTED: Color32 = Color32::from_rgb(124, 140, 190);
pub const GOOD: Color32 = Color32::from_rgb(72, 214, 160);
pub const WARN: Color32 = Color32::from_rgb(255, 196, 66);
pub const BAD: Color32 = Color32::from_rgb(255, 104, 112);

/// Selectable accent colours – all in the blue family to keep the brand intact.
pub const ACCENTS: [(&str, Color32); 6] = [
    ("Lumen", Color32::from_rgb(76, 125, 255)),
    ("Cyan", Color32::from_rgb(53, 200, 240)),
    ("Indigo", Color32::from_rgb(101, 116, 245)),
    ("Sky", Color32::from_rgb(24, 160, 251)),
    ("Ice", Color32::from_rgb(156, 196, 255)),
    ("Cobalt", Color32::from_rgb(47, 91, 255)),
];

pub fn accent(idx: u8) -> Color32 {
    ACCENTS[(idx as usize).min(ACCENTS.len() - 1)].1
}

pub fn alpha(c: Color32, a: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(c.r(), c.g(), c.b(), a)
}

pub fn mix(a: Color32, b: Color32, t: f32) -> Color32 {
    let l = |x: u8, y: u8| (x as f32 + (y as f32 - x as f32) * t).round() as u8;
    Color32::from_rgb(l(a.r(), b.r()), l(a.g(), b.g()), l(a.b(), b.b()))
}

pub fn bold() -> FontFamily {
    FontFamily::Name("bold".into())
}

pub fn install_fonts(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    fonts.font_data.insert(
        "inter".into(),
        Arc::new(FontData::from_static(include_bytes!(
            "../assets/fonts/Inter-Regular.otf"
        ))),
    );
    fonts.font_data.insert(
        "inter-bold".into(),
        Arc::new(FontData::from_static(include_bytes!(
            "../assets/fonts/Inter-Bold.otf"
        ))),
    );
    fonts.font_data.insert(
        "jbmono".into(),
        Arc::new(FontData::from_static(include_bytes!(
            "../assets/fonts/JetBrainsMono-Regular.ttf"
        ))),
    );
    fonts
        .families
        .entry(FontFamily::Proportional)
        .or_default()
        .insert(0, "inter".into());
    fonts
        .families
        .entry(FontFamily::Monospace)
        .or_default()
        .insert(0, "jbmono".into());
    fonts
        .families
        .insert(bold(), vec!["inter-bold".into(), "inter".into()]);
    ctx.set_fonts(fonts);
}

pub fn apply(ctx: &egui::Context, accent: Color32) {
    ctx.all_styles_mut(|s| {
        let mut v = egui::Visuals::dark();
        v.panel_fill = BG1;
        v.window_fill = BG1;
        v.extreme_bg_color = BG0;
        v.faint_bg_color = BG2;
        v.override_text_color = Some(TEXT);
        v.window_corner_radius = CornerRadius::same(4);
        v.window_stroke = Stroke::new(1.0, LINE);
        v.menu_corner_radius = CornerRadius::same(4);
        v.selection.bg_fill = alpha(accent, 90);
        v.selection.stroke = Stroke::new(1.0, accent);
        v.hyperlink_color = accent;
        for w in [
            &mut v.widgets.noninteractive,
            &mut v.widgets.inactive,
            &mut v.widgets.hovered,
            &mut v.widgets.active,
            &mut v.widgets.open,
        ] {
            w.corner_radius = CornerRadius::same(4);
        }
        v.widgets.noninteractive.bg_fill = BG2;
        v.widgets.noninteractive.bg_stroke = Stroke::new(1.0, LINE);
        v.widgets.inactive.bg_fill = BG2;
        v.widgets.inactive.weak_bg_fill = BG2;
        v.widgets.inactive.bg_stroke = Stroke::new(1.0, LINE);
        v.widgets.hovered.bg_fill = BG3;
        v.widgets.hovered.weak_bg_fill = BG3;
        v.widgets.hovered.bg_stroke = Stroke::new(1.0, alpha(accent, 150));
        v.widgets.active.bg_fill = alpha(accent, 120);
        v.widgets.active.weak_bg_fill = alpha(accent, 120);
        v.widgets.active.bg_stroke = Stroke::new(1.0, accent);
        s.visuals = v;
        s.spacing.item_spacing = egui::vec2(10.0, 10.0);
        s.spacing.button_padding = egui::vec2(14.0, 8.0);
        s.spacing.interact_size.y = 34.0;
        s.spacing.scroll.bar_width = 6.0;
        s.spacing.scroll.floating = true;
        s.text_styles = [
            (TextStyle::Heading, FontId::new(24.0, bold())),
            (TextStyle::Body, FontId::new(14.5, FontFamily::Proportional)),
            (
                TextStyle::Button,
                FontId::new(14.0, FontFamily::Proportional),
            ),
            (
                TextStyle::Small,
                FontId::new(12.0, FontFamily::Proportional),
            ),
            (
                TextStyle::Monospace,
                FontId::new(12.0, FontFamily::Monospace),
            ),
        ]
        .into();
    });
}
