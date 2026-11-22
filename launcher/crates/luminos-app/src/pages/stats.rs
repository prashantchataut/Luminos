//! Playtime statistics.
use super::home::bar_chart;
use crate::{app::App, theme, widgets};
use luminos_core::{playtime, store};
use eframe::egui::{self, vec2, CornerRadius, FontId, Sense, Stroke, StrokeKind, Ui};

fn stat(ui: &mut Ui, label: &str, value: String) {
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, label);
        ui.label(egui::RichText::new(value).font(FontId::new(28.0, theme::bold())));
    });
}

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    widgets::heading(ui, "Playtime");
    widgets::muted(ui, "Every session is tracked locally — nothing leaves your computer.");
    ui.add_space(6.0);
    let log = &app.playtime;
    ui.columns(4, |c| {
        stat(&mut c[0], "All time", store::fmt_duration(playtime::total(log)));
        stat(&mut c[1], "Last 7 days", store::fmt_duration(playtime::last_days_total(log, 7)));
        stat(&mut c[2], "Last 30 days", store::fmt_duration(playtime::last_days_total(log, 30)));
        stat(&mut c[3], "Day streak", format!("{} days", playtime::streak(log)));
    });
    widgets::subheading(ui, "Last 14 days");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        bar_chart(ui, accent, &playtime::daily(log, 14), 190.0);
    });
    ui.add_space(6.0);
    widgets::subheading(ui, "By instance");
    let per = playtime::per_instance(log);
    let max = per.first().map(|p| p.1).unwrap_or(1).max(1) as f32;
    if per.is_empty() {
        widgets::muted(ui, "Play something and it will show up here.");
    }
    for (id, secs) in per.iter().take(8) {
        let name = app.instance(id).map(|i| i.name.clone()).unwrap_or_else(|| id.clone());
        let color = app.instance(id).map(|i| i.color).unwrap_or(0);
        let (r, _) = ui.allocate_exact_size(vec2(ui.available_width(), 52.0), Sense::hover());
        ui.painter().rect_filled(r, CornerRadius::same(14), theme::BG2);
        ui.painter().rect_stroke(r, CornerRadius::same(14), Stroke::new(1.0, theme::LINE), StrokeKind::Inside);
        widgets::instance_icon(ui, egui::Rect::from_min_size(r.min + vec2(8.0, 8.0), vec2(36.0, 36.0)), &name, color);
        ui.painter().text(r.min + vec2(56.0, 16.0), egui::Align2::LEFT_CENTER, &name, FontId::new(14.5, theme::bold()), theme::TEXT);
        let track = egui::Rect::from_min_size(r.min + vec2(56.0, 33.0), vec2(r.width() - 160.0, 8.0));
        ui.painter().rect_filled(track, CornerRadius::same(4), theme::BG0);
        ui.painter().rect_filled(egui::Rect::from_min_size(track.min, vec2(track.width() * (*secs as f32 / max), 8.0)), CornerRadius::same(4), accent);
        ui.painter().text(r.right_center() - vec2(16.0, 0.0), egui::Align2::RIGHT_CENTER, store::fmt_duration(*secs), FontId::new(15.0, theme::bold()), theme::TEXT);
    }
}
