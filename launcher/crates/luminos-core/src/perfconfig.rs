//! Pre-tuned performance configs for the Luminos Client performance stack
//! (Sodium, Lithium, FerriteCore, ImmediatelyFast, EntityCulling, ModernFix, MoreCulling; see `preset.rs`).
//!
//! The values follow what Fabulously Optimized ships (`Packwiz/*/config/modpack_defaults/config/`), which is the
//! reference for "conflict-free" defaults, plus Sodium's own performance switches (key names checked against
//! `SodiumOptions.java`: `performance.use_block_face_culling`, `use_fog_occlusion`, `use_entity_culling`,
//! `animate_only_visible_textures`, `use_no_error_g_l_context`).
//!
//! Files are only written when they do not exist yet, so a player's own settings are never overwritten (the same
//! rule Fabulously Optimized's `yosbr` mod follows).

use anyhow::{Context, Result};
use std::path::Path;

/// Sodium: weather FAST is Fabulously Optimized's default; the rest are Sodium's culling and texture switches.
pub const SODIUM_OPTIONS: &str = r#"{
  "quality": {
    "weather_quality": "FAST"
  },
  "performance": {
    "animate_only_visible_textures": true,
    "use_entity_culling": true,
    "use_fog_occlusion": true,
    "use_block_face_culling": true,
    "use_no_error_g_l_context": true
  }
}
"#;

/// ImmediatelyFast: batching for the HUD, text and buffer uploads. (Key names are the documented ones; not run against the mod
/// in this build, and an unknown key is ignored by the mod's JSON loader.)
pub const IMMEDIATELYFAST: &str = r#"{
  "hud_batching": true,
  "font_atlas_resizing": true,
  "fast_buffer_upload": true
}
"#;

/// ModernFix with dynamic resources ON: models and textures load on demand, which is what keeps Minecraft 1.21.x near 1 GB with
/// FerriteCore. (4.0/4.1 shipped `false`; it is upgraded below, but only when the file is still exactly what Luminos wrote.)
pub const MODERNFIX: &str = "# Luminos 4.2: dynamic resources on (loads models/textures on demand; large RAM saving).\n# Set it to false if a resource pack or mod misbehaves; Luminos will not overwrite your edit.\nmixin.perf.dynamic_resources=true\n";

/// The exact text Luminos 4.0/4.1 wrote. A file equal to this was never edited by the player, so it is safe to replace.
const MODERNFIX_V41: &str = "# Luminos: same conflict-free default as Fabulously Optimized.\n# Dynamic resources is opt-in because it breaks some resource packs and mods.\nmixin.perf.dynamic_resources=false\n";

fn write_if_missing(path: &Path, contents: &str) -> Result<bool> {
    if path.exists() {
        return Ok(false);
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).with_context(|| format!("creating {}", dir.display()))?;
    }
    std::fs::write(path, contents).with_context(|| format!("writing {}", path.display()))?;
    Ok(true)
}

/// Writes the three config files into `<game_dir>/config/`. Returns the names that were created.
pub fn write_defaults(game_dir: &Path) -> Result<Vec<&'static str>> {
    let cfg = game_dir.join("config");
    let mut made = Vec::new();
    for (name, body) in [
        ("sodium-options.json", SODIUM_OPTIONS),
        ("immediatelyfast.json", IMMEDIATELYFAST),
        ("modernfix-mixins.properties", MODERNFIX),
    ] {
        if write_if_missing(&cfg.join(name), body)? {
            made.push(name);
        }
    }
    // upgrade an untouched 4.0/4.1 ModernFix file; a file the player edited is never changed
    let mf = cfg.join("modernfix-mixins.properties");
    if std::fs::read_to_string(&mf)
        .map(|c| c.replace("\r\n", "\n") == MODERNFIX_V41)
        .unwrap_or(false)
    {
        std::fs::write(&mf, MODERNFIX).with_context(|| format!("writing {}", mf.display()))?;
        made.push("modernfix-mixins.properties");
    }
    Ok(made)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!("luminos-perfcfg-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&p);
        p
    }

    #[test]
    fn creates_all_three_and_they_parse() {
        let dir = scratch("a");
        let made = write_defaults(&dir).unwrap();
        assert_eq!(made.len(), 3);
        let sodium: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.join("config/sodium-options.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(sodium["performance"]["use_block_face_culling"], true);
        assert_eq!(sodium["performance"]["use_fog_occlusion"], true);
        assert_eq!(sodium["performance"]["use_entity_culling"], true);
        assert_eq!(sodium["performance"]["animate_only_visible_textures"], true);
        let imm: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(dir.join("config/immediatelyfast.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(imm["hud_batching"], true);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn modernfix_dynamic_resources_is_on_and_old_default_is_upgraded() {
        assert!(MODERNFIX.contains("mixin.perf.dynamic_resources=true"));
        let dir = scratch("c");
        std::fs::create_dir_all(dir.join("config")).unwrap();
        std::fs::write(
            dir.join("config/modernfix-mixins.properties"),
            MODERNFIX_V41,
        )
        .unwrap();
        write_defaults(&dir).unwrap();
        assert!(
            std::fs::read_to_string(dir.join("config/modernfix-mixins.properties"))
                .unwrap()
                .contains("dynamic_resources=true")
        );
        // a player's own edit is left alone
        std::fs::write(
            dir.join("config/modernfix-mixins.properties"),
            "mixin.perf.dynamic_resources=false\n",
        )
        .unwrap();
        write_defaults(&dir).unwrap();
        assert!(
            std::fs::read_to_string(dir.join("config/modernfix-mixins.properties"))
                .unwrap()
                .contains("=false")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn never_overwrites_a_players_file() {
        let dir = scratch("b");
        std::fs::create_dir_all(dir.join("config")).unwrap();
        std::fs::write(dir.join("config/sodium-options.json"), "{\"mine\":1}").unwrap();
        let made = write_defaults(&dir).unwrap();
        assert!(!made.contains(&"sodium-options.json"));
        assert_eq!(
            std::fs::read_to_string(dir.join("config/sodium-options.json")).unwrap(),
            "{\"mine\":1}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
