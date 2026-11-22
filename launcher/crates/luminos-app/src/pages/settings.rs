//! Launcher settings.
use crate::{
    app::{App, Loadable, ToastKind},
    icons::Icon,
    theme,
    widgets::{self, Btn},
};
use luminos_core::{config, paths};
use eframe::egui::{self, vec2, Sense, Stroke, Ui};

pub fn ui(app: &mut App, ui: &mut Ui) {
    let accent = app.accent();
    let before = app.settings.clone();
    widgets::heading(ui, "Settings");
    widgets::muted(ui, "Changes are saved automatically.");
    ui.add_space(6.0);

    widgets::subheading(ui, "Appearance");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::eyebrow(ui, "Accent colour");
        ui.horizontal(|ui| {
            for (i, (name, c)) in theme::ACCENTS.iter().enumerate() {
                let (r, resp) = ui.allocate_exact_size(vec2(38.0, 38.0), Sense::click());
                let sel = app.settings.accent as usize == i;
                ui.painter().circle_filled(r.center(), 14.0, *c);
                if sel {
                    ui.painter().circle_stroke(r.center(), 18.0, Stroke::new(2.0, *c));
                    crate::icons::paint(ui.painter(), Icon::Check, r.center(), 14.0, egui::Color32::WHITE);
                }
                if resp.on_hover_text(*name).on_hover_cursor(egui::CursorIcon::PointingHand).clicked() {
                    app.settings.accent = i as u8;
                }
            }
        });
        ui.add_space(4.0);
        widgets::setting_row(ui, "Dithered background", "The signature animated blue dither.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.dither_background);
        });
        widgets::setting_row(ui, "Reduce motion", "Stops background animation to save CPU and battery.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.reduce_motion);
        });
    });

    widgets::subheading(ui, "Game");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        let total = config::system_memory_mb().max(2048);
        widgets::setting_row(ui, "Default memory", &format!("{:.1} GB of {:.1} GB installed", app.settings.memory_mb as f32 / 1024.0, total as f32 / 1024.0), |_| {});
        ui.spacing_mut().slider_width = ui.available_width() - 100.0;
        ui.add(egui::Slider::new(&mut app.settings.memory_mb, 1024..=total.min(32768)).step_by(512.0).suffix(" MB"));
        widgets::eyebrow(ui, "Default JVM arguments");
        ui.add(egui::TextEdit::singleline(&mut app.settings.jvm_args).desired_width(f32::INFINITY).margin(egui::Margin::symmetric(10, 8)));
        widgets::eyebrow(ui, "Java executable (empty = automatic)");
        let mut java = app.settings.java_path.clone().unwrap_or_default();
        if ui.add(egui::TextEdit::singleline(&mut java).hint_text("Auto-detect or download").desired_width(f32::INFINITY).margin(egui::Margin::symmetric(10, 8))).changed() {
            app.settings.java_path = if java.trim().is_empty() { None } else { Some(java) };
        }
        if let Loadable::Ready(list) = &app.java_list {
            ui.horizontal_wrapped(|ui| {
                for j in list {
                    if widgets::chip(ui, accent, &format!("Java {}", j.major), None, app.settings.java_path.as_deref() == Some(&j.path.to_string_lossy())).on_hover_text(j.path.to_string_lossy()).clicked() {
                        app.settings.java_path = Some(j.path.to_string_lossy().to_string());
                    }
                }
            });
        }
        widgets::setting_row(ui, "Fullscreen", "Start the game in fullscreen.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.fullscreen);
        });
    });

    widgets::subheading(ui, "Content & downloads");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(ui, "Auto-update mods on launch", "Before the game starts, update every Modrinth-linked mod and pack. Unlinked files are never touched.", |ui| {
            widgets::toggle(ui, accent, &mut app.settings.auto_update_content);
        });
        ui.add_space(4.0);
        widgets::setting_row(ui, "Parallel downloads", &format!("{} connections", app.settings.download_threads), |ui| {
            let mut n = app.settings.download_threads as u32;
            ui.add(egui::Slider::new(&mut n, 2..=32).show_value(false));
            app.settings.download_threads = n as usize;
        });
    });

    widgets::subheading(ui, "Data");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        widgets::setting_row(ui, "Launcher folder", &paths::root().to_string_lossy(), |ui| {
            if widgets::button_sized(ui, accent, "Open", Some(Icon::Folder), Btn::Secondary, true, 0.0, 32.0).clicked() {
                let _ = open::that(paths::root());
            }
        });
        ui.add_space(4.0);
        widgets::setting_row(ui, "Run setup again", "Replay the welcome experience.", |ui| {
            if widgets::button_sized(ui, accent, "Restart setup", Some(Icon::Refresh), Btn::Secondary, true, 0.0, 32.0).clicked() {
                app.settings.setup_done = false;
                app.wizard.step = 0;
                app.wizard.step_t0 = app.time;
                app.wizard.finished = false;
                app.wizard.installing = false;
            }
        });
    });
    widgets::subheading(ui, "About");
    widgets::card(ui, |ui| {
        ui.set_width(ui.available_width());
        ui.label(egui::RichText::new(format!("Luminos Launcher {} (beta)", luminos_core::VERSION)).font(egui::FontId::new(15.0, theme::bold())));
        widgets::muted(ui, "Open-source, written in Rust. Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang Synergies AB.");
    });

    if app.settings != before {
        app.settings.save();
        if before.setup_done && !app.settings.setup_done {
            app.toast("Setup will restart", ToastKind::Info);
        }
    }
}
