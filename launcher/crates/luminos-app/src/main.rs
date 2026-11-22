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
            .with_icon(window_icon())
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

/// The window / taskbar icon (same artwork as the installer and the .exe resource).
fn window_icon() -> egui::IconData {
    let img = image::load_from_memory(include_bytes!("../assets/luminos-256.png"))
        .expect("embedded icon")
        .to_rgba8();
    egui::IconData {
        width: img.width(),
        height: img.height(),
        rgba: img.into_raw(),
    }
}
