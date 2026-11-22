//! # luminos-core
//! The headless engine behind Luminos Launcher. No UI code lives here, so the same crate can power
//! a CLI, tests, or any other front-end.
pub mod accounts;
pub mod config;
pub mod content;
pub mod download;
pub mod http;
pub mod instances;
pub mod java;
pub mod launch;
pub mod modrinth;
pub mod mojang;
pub mod mrpack;
pub mod news;
pub mod paths;
pub mod playtime;
pub mod preset;
pub mod skins;
pub mod store;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
