//! # luminos-core
//! The headless engine behind Luminos Launcher. No UI code lives here, so the same crate can power
//! a CLI, tests, or any other front-end.
pub mod accounts;
pub mod backup;
pub mod config;
pub mod content;
pub mod crash;
pub mod download;
pub mod http;
pub mod instances;
pub mod java;
pub mod jvmflags;
pub mod launch;
pub mod modrinth;
pub mod mojang;
pub mod mrpack;
pub mod msauth;
pub mod netaudit;
pub mod news;
pub mod paths;
pub mod playtime;
pub mod preset;
pub mod servers;
pub mod skins;
pub mod store;
pub mod sys;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub mod compat;
pub mod directory;
pub mod joinlink;
pub mod loginprobe;
pub mod yggdrasil;
pub mod cosmetics;
pub mod namecheck;
pub mod offlineskin;
pub mod storage;
pub mod update;
pub mod resolve;
