//! The Luminos Client bundle: a curated, one-click set of open-source Fabric mods.
//! Every slug below was verified against the live Modrinth API. Missing/incompatible
//! mods are skipped gracefully so the bundle works across Minecraft versions.
use crate::{content, http, instances::Instance};
use anyhow::{bail, Context, Result};

#[derive(Clone, Copy, Debug)]
pub struct PresetMod {
    pub slug: &'static str,
    pub name: &'static str,
    pub group: &'static str,
    pub why: &'static str,
    pub default_on: bool,
}

pub const LUMINOS_CLIENT: &[PresetMod] = &[
    PresetMod {
        slug: "fabric-api",
        name: "Fabric API",
        group: "Core",
        why: "Required by almost every Fabric mod",
        default_on: true,
    },
    PresetMod {
        slug: "sodium",
        name: "Sodium",
        group: "Performance",
        why: "Modern rendering engine, huge FPS boost",
        default_on: true,
    },
    PresetMod {
        slug: "lithium",
        name: "Lithium",
        group: "Performance",
        why: "Game logic and tick optimisations",
        default_on: true,
    },
    PresetMod {
        slug: "entityculling",
        name: "Entity Culling",
        group: "Performance",
        why: "Skips rendering entities you cannot see",
        default_on: true,
    },
    PresetMod {
        slug: "ferrite-core",
        name: "FerriteCore",
        group: "Performance",
        why: "Cuts memory usage",
        default_on: true,
    },
    PresetMod {
        slug: "modernfix",
        name: "ModernFix",
        group: "Performance",
        why: "Faster startup and less RAM",
        default_on: true,
    },
    PresetMod {
        slug: "immediatelyfast",
        name: "ImmediatelyFast",
        group: "Performance",
        why: "Speeds up immediate-mode rendering and HUD",
        default_on: true,
    },
    PresetMod {
        slug: "moreculling",
        name: "More Culling",
        group: "Performance",
        why: "Extra face and block-entity culling",
        default_on: true,
    },
    PresetMod {
        slug: "dynamic-fps",
        name: "Dynamic FPS",
        group: "Performance",
        why: "Saves battery and GPU when unfocused",
        default_on: true,
    },
    PresetMod {
        slug: "krypton",
        name: "Krypton",
        group: "Performance",
        why: "Faster networking stack",
        default_on: true,
    },
    PresetMod {
        slug: "sodium-extra",
        name: "Sodium Extra",
        group: "Performance",
        why: "More video options for Sodium",
        default_on: true,
    },
    PresetMod {
        slug: "reeses-sodium-options",
        name: "Reese's Sodium Options",
        group: "Performance",
        why: "Cleaner Sodium settings screen",
        default_on: true,
    },
    PresetMod {
        slug: "badoptimizations",
        name: "BadOptimizations",
        group: "Performance",
        why: "Tiny render and chunk wins",
        default_on: true,
    },
    PresetMod {
        slug: "scalablelux",
        name: "ScalableLux",
        group: "Performance",
        why: "Fast lighting engine",
        default_on: true,
    },
    PresetMod {
        slug: "memoryleakfix",
        name: "Memory Leak Fix",
        group: "Performance",
        why: "Fixes vanilla memory leaks",
        default_on: true,
    },
    PresetMod {
        slug: "armor-hud",
        name: "Armor HUD",
        group: "HUD",
        why: "Shows your armour and durability on screen",
        default_on: true,
    },
    PresetMod {
        slug: "appleskin",
        name: "AppleSkin",
        group: "HUD",
        why: "Hunger and saturation preview",
        default_on: true,
    },
    PresetMod {
        slug: "status-effect-bars",
        name: "Status Effect Bars",
        group: "HUD",
        why: "Clear potion effect timers",
        default_on: true,
    },
    PresetMod {
        slug: "betterf3",
        name: "BetterF3",
        group: "HUD",
        why: "A readable, customisable F3 screen",
        default_on: true,
    },
    PresetMod {
        slug: "paperdoll",
        name: "Paper Doll",
        group: "HUD",
        why: "Live character preview in the corner",
        default_on: false,
    },
    PresetMod {
        slug: "better-ping-display-fabric",
        name: "Better Ping Display",
        group: "HUD",
        why: "Numeric ping in the tab list",
        default_on: true,
    },
    PresetMod {
        slug: "zoomify",
        name: "Zoomify",
        group: "Utility",
        why: "Smooth, configurable zoom key",
        default_on: true,
    },
    PresetMod {
        slug: "mouse-tweaks",
        name: "Mouse Tweaks",
        group: "Utility",
        why: "Faster inventory management",
        default_on: true,
    },
    PresetMod {
        slug: "3dskinlayers",
        name: "3D Skin Layers",
        group: "Visuals",
        why: "Real 3D hat and jacket layers",
        default_on: false,
    },
    PresetMod {
        slug: "iris",
        name: "Iris Shaders",
        group: "Visuals",
        why: "Shader pack support, built for Sodium",
        default_on: false,
    },
    PresetMod {
        slug: "customskinloader",
        name: "CustomSkinLoader",
        group: "Skins",
        why: "Shows your chosen skin even in offline mode",
        default_on: true,
    },
    PresetMod {
        slug: "modmenu",
        name: "Mod Menu",
        group: "Menu",
        why: "In-game mod list and config entry point",
        default_on: true,
    },
    PresetMod {
        slug: "yacl",
        name: "YetAnotherConfigLib",
        group: "Menu",
        why: "Modern config screens used by many mods",
        default_on: true,
    },
    PresetMod {
        slug: "cloth-config",
        name: "Cloth Config API",
        group: "Menu",
        why: "Config screens used by many mods",
        default_on: true,
    },
    PresetMod {
        slug: "crash-assistant",
        name: "Crash Assistant",
        group: "Utility",
        why: "Friendly crash analysis screen",
        default_on: true,
    },
];

pub struct InstallReport {
    pub ok: Vec<String>,
    pub skipped: Vec<(String, String)>,
}

/// GitHub repository that publishes the first-party client mod as `client-v*` releases.
pub const CLIENT_REPO: &str = "prashantchataut/Luminos";

/// Third-party HUD mods that the first-party Luminos Client replaces.
const REPLACED_BY_FIRST_PARTY: &[&str] = &["armor-hud", "status-effect-bars"];

/// Pick the mod jar asset (never the `-sources` jar) from a GitHub release JSON.
pub fn pick_client_asset(release: &serde_json::Value) -> Option<(String, String)> {
    release["assets"].as_array()?.iter().find_map(|a| {
        let name = a["name"].as_str()?;
        (name.starts_with("luminos-client") && name.ends_with(".jar") && !name.contains("sources"))
            .then(|| {
                Some((
                    name.to_string(),
                    a["browser_download_url"].as_str()?.to_string(),
                ))
            })
            .flatten()
    })
}

/// Download the newest first-party `luminos-client` jar into the instance's `mods/` folder.
/// Returns the file name. Errors (no release yet, offline) are non-fatal for the bundle.
pub fn install_first_party(inst: &Instance) -> Result<String> {
    // Resolve through the compatibility manifest: only a jar built and listed for this exact
    // Minecraft version + loader is installed, and its SHA-256 is verified. Anything else is a clear,
    // non-fatal "running without the client" message (never a version-range crash at launch).
    let manifest = crate::compat::fetch()
        .or_else(|_| crate::compat::parse(include_str!("../../../../client/client-compat.json")))
        .context("reading the Luminos Client compatibility manifest")?;
    let entry = match crate::compat::resolve(&manifest, &inst.mc_version, inst.loader.label()) {
        crate::compat::Resolution::Match(e) => e.clone(),
        crate::compat::Resolution::Fallback { reason } => bail!("{reason}"),
    };
    let mods = inst.game_dir().join("mods");
    std::fs::create_dir_all(&mods)?;
    let jar = crate::compat::install(&entry, &mods)?;
    let name = jar.file_name().unwrap().to_string_lossy().to_string();
    // replace older copies so updates don't leave two versions behind
    for e in std::fs::read_dir(&mods)?.flatten() {
        let n = e.file_name().to_string_lossy().to_string();
        if n.starts_with("luminos-client") && n != name {
            let _ = std::fs::remove_file(e.path());
        }
    }
    Ok(name)
}

/// Install the selected slugs into `inst`. Calls `step(done, total, name)` for progress.
/// The first-party Luminos Client mod is installed first; when that works, the overlapping
/// third-party HUD mods are skipped.
pub fn install(
    inst: &Instance,
    slugs: &[&PresetMod],
    mut step: impl FnMut(usize, usize, &str),
) -> InstallReport {
    let mut report = InstallReport {
        ok: vec![],
        skipped: vec![],
    };
    step(0, slugs.len() + 1, "Luminos Client");
    let first_party = match install_first_party(inst) {
        Ok(n) => {
            report.ok.push(n);
            true
        }
        Err(e) => {
            report
                .skipped
                .push(("Luminos Client (first-party)".to_string(), format!("{e:#}")));
            false
        }
    };
    let total = slugs.len() + 1;
    for (i, m) in slugs.iter().enumerate() {
        step(i + 1, total, m.name);
        if first_party && REPLACED_BY_FIRST_PARTY.contains(&m.slug) {
            continue;
        }
        match content::install_project(inst, m.slug, content::Kind::Mod) {
            Ok(names) => report.ok.extend(names),
            Err(e) => report.skipped.push((m.name.to_string(), format!("{e:#}"))),
        }
    }
    step(total, total, "Done");
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_the_mod_jar_not_sources() {
        let rel = serde_json::json!({"assets":[
            {"name":"luminos-client-0.1.0-sources.jar","browser_download_url":"https://x/s"},
            {"name":"luminos-client-0.1.0.jar","browser_download_url":"https://x/m"}]});
        assert_eq!(pick_client_asset(&rel).unwrap().1, "https://x/m");
        assert!(pick_client_asset(&serde_json::json!({"assets":[]})).is_none());
    }
}
