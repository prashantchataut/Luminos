//! Launcher-wide settings persisted to `settings.json`.
use crate::{paths, store};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct Settings {
    pub setup_done: bool,
    /// Max heap for the game in MiB.
    pub memory_mb: u32,
    pub java_path: Option<String>,
    pub jvm_args: String,
    pub reduce_motion: bool,
    pub dither_background: bool,
    pub close_on_launch: bool,
    pub download_threads: usize,
    pub auto_update_content: bool,
    pub show_snapshots: bool,
    /// Index into the accent palette in the UI theme.
    pub accent: u8,
    pub ui_scale: f32,
    pub game_width: u32,
    pub game_height: u32,
    pub fullscreen: bool,
    /// Registry hosts (see `netaudit::REGISTRY`) the user switched off in Network activity.
    pub net_disabled: Vec<String>,
    /// Look for a new Luminos release on start (one request to api.github.com).
    pub check_updates: bool,
    /// Unix time of the last update check.
    pub last_update_check: i64,
    /// Serve the account's skin and cape to the game from a local server (offline accounts).
    pub offline_skins: bool,
    /// Let the mod solver use beta/alpha builds. Off by default: stable builds only.
    pub allow_beta_mods: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            setup_done: false,
            memory_mb: 4096,
            java_path: None,
            jvm_args: String::new(), // empty = auto (see jvmflags.rs)
            reduce_motion: false,
            dither_background: true,
            close_on_launch: false,
            download_threads: 16,
            auto_update_content: true,
            show_snapshots: false,
            accent: 0,
            ui_scale: 1.0,
            game_width: 0,
            game_height: 0,
            fullscreen: false,
            net_disabled: Vec::new(),
            check_updates: true,
            last_update_check: 0,
            offline_skins: true,
            allow_beta_mods: false,
        }
    }
}

impl Settings {
    pub fn load() -> Self {
        let s: Self = store::read_json(&paths::settings_file());
        crate::netaudit::set_disabled(&s.net_disabled);
        s
    }
    pub fn save(&self) {
        crate::netaudit::set_disabled(&self.net_disabled);
        let _ = store::write_json(&paths::settings_file(), self);
    }
}

/// Total system RAM in MiB (best effort, used to cap the memory slider).
pub fn system_memory_mb() -> u32 {
    #[cfg(target_os = "linux")]
    {
        if let Ok(s) = std::fs::read_to_string("/proc/meminfo") {
            for line in s.lines() {
                if let Some(rest) = line.strip_prefix("MemTotal:") {
                    let kb: u64 = rest
                        .trim()
                        .trim_end_matches("kB")
                        .trim()
                        .parse()
                        .unwrap_or(0);
                    if kb > 0 {
                        return (kb / 1024) as u32;
                    }
                }
            }
        }
    }
    8192
}
