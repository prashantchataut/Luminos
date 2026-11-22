//! Luminos Launcher UI. Everything that draws lives here so the same code powers the desktop app
//! (`luminos`) and the headless screenshot renderer (`luminos-shots`).
pub mod app;
pub mod brand;
pub mod demo;
pub mod dither;
pub mod icons;
pub mod pages;
pub mod theme;
pub mod widgets;

pub use app::App;
