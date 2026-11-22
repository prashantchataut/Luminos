#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use eframe::egui;
use luminos_app::App;

fn main() -> eframe::Result<()> {
    // One launcher per data folder: a second double-click must not stack windows.
    let Some(_single) = luminos_core::sys::SingleInstance::acquire() else {
        return Ok(());
    };
    install_panic_log();
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Luminos")
            .with_icon(window_icon())
            .with_inner_size([1240.0, 780.0])
            .with_min_inner_size([980.0, 620.0])
            .with_decorations(false)
            .with_transparent(false),
        ..Default::default()
    };
    eframe::run_native(
        "Luminos",
        options,
        Box::new(|cc| Ok(Box::new(App::new(&cc.egui_ctx, true)))),
    )
}

/// A windowed Windows app has no console, so panics would vanish silently. Keep them in a log file.
fn install_panic_log() {
    let path = luminos_core::paths::root().join("luminos-crash.log");
    std::panic::set_hook(Box::new(move |info| {
        let _ = std::fs::write(&path, format!("{info}\n"));
    }));
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
