#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use eframe::egui;
use luminos_app::App;

fn main() -> eframe::Result<()> {
    luminos_core::paths::root();
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Luminos Launcher")
            .with_inner_size([1240.0, 780.0])
            .with_min_inner_size([980.0, 620.0])
            .with_decorations(false)
            .with_transparent(false),
        ..Default::default()
    };
    eframe::run_native(
        "Luminos Launcher",
        options,
        Box::new(|cc| Ok(Box::new(App::new(&cc.egui_ctx, true)))),
    )
}
