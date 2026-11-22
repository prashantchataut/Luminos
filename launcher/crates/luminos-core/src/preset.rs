//! The Luminos Client bundle: a curated, one-click set of open-source Fabric mods.
//! Every slug below was verified against the live Modrinth API. Missing/incompatible
//! mods are skipped gracefully so the bundle works across Minecraft versions.
use crate::{content, instances::Instance};

#[derive(Clone, Copy, Debug)]
pub struct PresetMod {
    pub slug: &'static str,
    pub name: &'static str,
    pub group: &'static str,
    pub why: &'static str,
    pub default_on: bool,
}

pub const LUMINOS_CLIENT: &[PresetMod] = &[
    PresetMod { slug: "fabric-api", name: "Fabric API", group: "Core", why: "Required by almost every Fabric mod", default_on: true },
    PresetMod { slug: "sodium", name: "Sodium", group: "Performance", why: "Modern rendering engine, huge FPS boost", default_on: true },
    PresetMod { slug: "lithium", name: "Lithium", group: "Performance", why: "Game logic and tick optimisations", default_on: true },
    PresetMod { slug: "entityculling", name: "Entity Culling", group: "Performance", why: "Skips rendering entities you cannot see", default_on: true },
    PresetMod { slug: "ferrite-core", name: "FerriteCore", group: "Performance", why: "Cuts memory usage", default_on: true },
    PresetMod { slug: "modernfix", name: "ModernFix", group: "Performance", why: "Faster startup and less RAM", default_on: true },
    PresetMod { slug: "immediatelyfast", name: "ImmediatelyFast", group: "Performance", why: "Speeds up immediate-mode rendering and HUD", default_on: true },
    PresetMod { slug: "moreculling", name: "More Culling", group: "Performance", why: "Extra face and block-entity culling", default_on: true },
    PresetMod { slug: "dynamic-fps", name: "Dynamic FPS", group: "Performance", why: "Saves battery and GPU when unfocused", default_on: true },
    PresetMod { slug: "krypton", name: "Krypton", group: "Performance", why: "Faster networking stack", default_on: true },
    PresetMod { slug: "sodium-extra", name: "Sodium Extra", group: "Performance", why: "More video options for Sodium", default_on: true },
    PresetMod { slug: "reeses-sodium-options", name: "Reese's Sodium Options", group: "Performance", why: "Cleaner Sodium settings screen", default_on: true },
    PresetMod { slug: "badoptimizations", name: "BadOptimizations", group: "Performance", why: "Tiny render and chunk wins", default_on: true },
    PresetMod { slug: "scalablelux", name: "ScalableLux", group: "Performance", why: "Fast lighting engine", default_on: true },
    PresetMod { slug: "memoryleakfix", name: "Memory Leak Fix", group: "Performance", why: "Fixes vanilla memory leaks", default_on: true },
    PresetMod { slug: "armor-hud", name: "Armor HUD", group: "HUD", why: "Shows your armour and durability on screen", default_on: true },
    PresetMod { slug: "appleskin", name: "AppleSkin", group: "HUD", why: "Hunger and saturation preview", default_on: true },
    PresetMod { slug: "status-effect-bars", name: "Status Effect Bars", group: "HUD", why: "Clear potion effect timers", default_on: true },
    PresetMod { slug: "betterf3", name: "BetterF3", group: "HUD", why: "A readable, customisable F3 screen", default_on: true },
    PresetMod { slug: "paperdoll", name: "Paper Doll", group: "HUD", why: "Live character preview in the corner", default_on: false },
    PresetMod { slug: "better-ping-display-fabric", name: "Better Ping Display", group: "HUD", why: "Numeric ping in the tab list", default_on: true },
    PresetMod { slug: "zoomify", name: "Zoomify", group: "Utility", why: "Smooth, configurable zoom key", default_on: true },
    PresetMod { slug: "mouse-tweaks", name: "Mouse Tweaks", group: "Utility", why: "Faster inventory management", default_on: true },
    PresetMod { slug: "3dskinlayers", name: "3D Skin Layers", group: "Visuals", why: "Real 3D hat and jacket layers", default_on: false },
    PresetMod { slug: "iris", name: "Iris Shaders", group: "Visuals", why: "Shader pack support, built for Sodium", default_on: false },
    PresetMod { slug: "customskinloader", name: "CustomSkinLoader", group: "Skins", why: "Shows your chosen skin even in offline mode", default_on: true },
    PresetMod { slug: "modmenu", name: "Mod Menu", group: "Menu", why: "In-game mod list and config entry point", default_on: true },
    PresetMod { slug: "yacl", name: "YetAnotherConfigLib", group: "Menu", why: "Modern config screens used by many mods", default_on: true },
    PresetMod { slug: "cloth-config", name: "Cloth Config API", group: "Menu", why: "Config screens used by many mods", default_on: true },
    PresetMod { slug: "crash-assistant", name: "Crash Assistant", group: "Utility", why: "Friendly crash analysis screen", default_on: true },
];

pub struct InstallReport {
    pub ok: Vec<String>,
    pub skipped: Vec<(String, String)>,
}

/// Install the selected slugs into `inst`. Calls `step(done, total, name)` for progress.
pub fn install(inst: &Instance, slugs: &[&PresetMod], mut step: impl FnMut(usize, usize, &str)) -> InstallReport {
    let mut report = InstallReport { ok: vec![], skipped: vec![] };
    for (i, m) in slugs.iter().enumerate() {
        step(i, slugs.len(), m.name);
        match content::install_project(inst, m.slug, content::Kind::Mod) {
            Ok(names) => report.ok.extend(names),
            Err(e) => report.skipped.push((m.name.to_string(), format!("{e:#}"))),
        }
    }
    step(slugs.len(), slugs.len(), "Done");
    report
}
