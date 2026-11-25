//! Live-swap classification: what can change while the game runs, and what has to wait for the next launch.
//!
//! Honest rule (see `docs/LIVE_SWAP.md`): an item is [`Disposition::Live`] only when the in-game agent has an applier for it.
//! * Luminos modules (the built-in HUD / QoL set): toggled in-process.
//! * Resource packs and data packs: the vanilla resource reload path.
//! * Everything else, including every third-party mod, is [`Disposition::Queued`]: Luminos does not unload third-party code.
//!
//! For a third-party mod the verdict still carries the *real reasons* read from the jar (registry content, mixins, keep-on
//! list), and `live_candidate` says whether an agent that could unload code would be allowed to hot-swap it.
use anyhow::{Context, Result};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::BTreeSet,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Mod,
    ResourcePack,
    DataPack,
    Shader,
    LuminosModule,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    Live,
    Queued,
}

/// Never switched from the panel. Same ids and wording as `app/src/livepanel/plan.ts` (a test keeps them identical).
pub const KEEP_ON: &[(&str, &str)] = &[
    ("sodium", "Owns the renderer. Unloading it mid-session would tear down the GL state and redraw the world."),
    ("modernfix", "Patches core game classes at startup; those patches cannot be taken back while the game runs."),
    ("c2me", "Replaces the chunk loading threads; stopping it mid-session can corrupt chunks in flight."),
    ("lithium", "Rewrites core game logic in place; the original code is gone once it is loaded."),
    ("ferritecore", "Changes how block states are stored in memory; switching it would need every state rebuilt."),
    ("fabric-api", "Almost every other mod hooks into it, so removing it would break them all."),
    ("immediatelyfast", "Replaces the renderer's buffers; same reason as Sodium."),
];

pub fn keep_on_reason(id: &str) -> Option<&'static str> {
    KEEP_ON.iter().find(|(k, _)| *k == id).map(|(_, v)| *v)
}

/// Dynamic-registry folders: content here means the mod adds game content the running game cannot drop.
const REGISTRY_DIRS: &[&str] = &[
    "/worldgen/",
    "/dimension/",
    "/dimension_type/",
    "/enchantment/",
    "/damage_type/",
    "/painting_variant/",
    "/jukebox_song/",
    "/banner_pattern/",
    "/instrument/",
    "/wolf_variant/",
];

#[derive(Default, Debug, Clone)]
pub struct Facts {
    pub id: String,
    pub name: String,
    pub version: String,
    pub environment: Option<String>,
    pub entrypoints: Vec<String>,
    pub has_mixins: bool,
    pub requires: Vec<String>,
    pub entries: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Verdict {
    pub kind: Kind,
    pub disposition: Disposition,
    /// Would be safe to hot-swap by an agent that could unload code (client only, no registry content, no mixins, not keep-on).
    pub live_candidate: bool,
    pub keep_on: bool,
    pub registry_content: bool,
    pub mixins: bool,
    pub client_only: bool,
    pub reasons: Vec<String>,
}

/// Names of registry-content signals found in the jar entries (empty = none).
pub fn registry_signals(entries: &[String]) -> Vec<String> {
    let mut out = BTreeSet::new();
    for e in entries {
        if e.starts_with("assets/") && e.contains("/blockstates/") && e.ends_with(".json") {
            out.insert("blockstates (adds blocks)".to_string());
        }
        if e.starts_with("data/") {
            for d in REGISTRY_DIRS {
                if e.contains(d) {
                    out.insert(format!("data{d}*(adds {})", d.trim_matches('/').replace('_', " ")));
                }
            }
        }
    }
    out.into_iter().collect()
}

pub fn classify(f: &Facts) -> Verdict {
    let client_only = f.environment.as_deref() == Some("client")
        || (!f.entrypoints.is_empty() && f.entrypoints.iter().all(|e| e == "client"));
    let mut reasons = vec![];
    let keep = keep_on_reason(&f.id);
    if let Some(k) = keep {
        reasons.push(format!("Keep-on list: {k}"));
    }
    let signals = registry_signals(&f.entries);
    let common_entry = f.entrypoints.iter().any(|e| e == "main" || e == "server");
    let registry = !signals.is_empty() || (common_entry && !client_only);
    if !signals.is_empty() {
        reasons.push(format!("Adds game content ({}): the running game cannot remove blocks, items, entities, biomes or dimensions.", signals.join(", ")));
    } else if common_entry && !client_only {
        reasons.push("Has a common/server entrypoint, which normally registers content at startup.".into());
    }
    if f.has_mixins {
        reasons.push("Uses mixins merged into game classes at launch; they cannot be unloaded.".into());
    }
    let live_candidate = client_only && !registry && !f.has_mixins && keep.is_none();
    reasons.push(if live_candidate {
        "Looks safe to swap live, but Luminos does not unload third-party code, so it applies on the next launch.".into()
    } else {
        "Applies on the next launch.".into()
    });
    Verdict {
        kind: Kind::Mod,
        disposition: Disposition::Queued,
        live_candidate,
        keep_on: keep.is_some(),
        registry_content: registry,
        mixins: f.has_mixins,
        client_only,
        reasons,
    }
}

/// Verdict for items the agent *can* apply.
pub fn classify_kind(kind: Kind) -> Verdict {
    let (disp, why) = match kind {
        Kind::LuminosModule => (Disposition::Live, "Luminos module: switched in-process by the Luminos agent."),
        Kind::ResourcePack => (Disposition::Live, "Resource pack: applied through the game's own resource reload."),
        Kind::DataPack => (Disposition::Live, "Data pack: applied through the data pack reload (worlds only)."),
        Kind::Shader => (Disposition::Queued, "Shader packs are selected through Iris, whose reload path Luminos has not verified. Applies on the next launch."),
        Kind::Mod => (Disposition::Queued, "Applies on the next launch."),
    };
    Verdict {
        kind,
        disposition: disp,
        live_candidate: false,
        keep_on: false,
        registry_content: false,
        mixins: false,
        client_only: true,
        reasons: vec![why.into()],
    }
}

pub fn facts_from_json(meta: &Value, entries: Vec<String>) -> Facts {
    let s = |k: &str| meta.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let mut f = Facts {
        id: s("id"),
        name: s("name"),
        version: s("version"),
        environment: meta.get("environment").and_then(Value::as_str).map(String::from),
        entries,
        ..Default::default()
    };
    if f.name.is_empty() {
        f.name = f.id.clone();
    }
    if let Some(e) = meta.get("entrypoints").and_then(Value::as_object) {
        f.entrypoints = e.iter().filter(|(_, v)| v.as_array().is_some_and(|a| !a.is_empty())).map(|(k, _)| k.clone()).collect();
    }
    f.has_mixins = meta.get("mixins").and_then(Value::as_array).is_some_and(|a| !a.is_empty());
    if let Some(d) = meta.get("depends").and_then(Value::as_object) {
        for k in d.keys() {
            let k = k.as_str();
            if matches!(k, "minecraft" | "fabricloader" | "java" | "fabric-loader") {
                continue;
            }
            // Fabric API's modules (fabric-resource-loader-v0 ...) all come from the one fabric-api jar.
            let k = if k.starts_with("fabric-") && k != "fabric-api" { "fabric-api" } else { k };
            if !f.requires.iter().any(|r| r == k) {
                f.requires.push(k.to_string());
            }
        }
    }
    f
}

pub fn facts_from_jar(path: &Path) -> Result<Facts> {
    let file = fs::File::open(path).with_context(|| format!("open {}", path.display()))?;
    let mut zip = zip::ZipArchive::new(file).with_context(|| format!("read {}", path.display()))?;
    let entries: Vec<String> = zip.file_names().filter_map(|n| n.ok()).map(|c| c.into_owned()).collect();
    let mut text = String::new();
    zip.by_name("fabric.mod.json").context("no fabric.mod.json (not a Fabric mod)")?.read_to_string(&mut text)?;
    let meta: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).context("fabric.mod.json is not valid JSON")?;
    Ok(facts_from_json(&meta, entries))
}

/// One installed mod, with its verdict. `file` is the enabled name (`x.jar`), whether or not it is currently disabled.
#[derive(Serialize, Clone, Debug)]
pub struct ModInfo {
    pub id: String,
    pub file: String,
    pub name: String,
    pub version: String,
    pub enabled: bool,
    pub requires: Vec<String>,
    pub verdict: Verdict,
}

pub fn list_mods(game_dir: &Path) -> Vec<ModInfo> {
    let dir = game_dir.join("mods");
    let mut out = vec![];
    let Ok(rd) = fs::read_dir(&dir) else { return out };
    let mut paths: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
    paths.sort();
    for p in paths {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
        let (file, enabled) = if let Some(b) = name.strip_suffix(".jar.disabled") {
            (format!("{b}.jar"), false)
        } else if name.ends_with(".jar") {
            (name.clone(), true)
        } else {
            continue;
        };
        let Ok(f) = facts_from_jar(&p) else { continue };
        let verdict = classify(&f);
        out.push(ModInfo { id: f.id, file, name: f.name, version: f.version, enabled, requires: f.requires, verdict });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn facts(meta: Value, entries: &[&str]) -> Facts {
        facts_from_json(&meta, entries.iter().map(|s| s.to_string()).collect())
    }

    #[test]
    fn client_only_hud_mod_is_a_live_candidate_but_still_queues() {
        let f = facts(json!({"id":"appleskin","environment":"client","entrypoints":{"client":["a.B"]}}), &["assets/appleskin/lang/en_us.json"]);
        let v = classify(&f);
        assert!(v.live_candidate && v.client_only && !v.registry_content);
        assert_eq!(v.disposition, Disposition::Queued, "third-party code is never unloaded");
    }

    #[test]
    fn registry_content_blocks_live_candidacy() {
        let f = facts(json!({"id":"cool","entrypoints":{"main":["a.B"]}}), &["assets/cool/blockstates/x.json", "data/cool/worldgen/biome/y.json"]);
        let v = classify(&f);
        assert!(v.registry_content && !v.live_candidate);
        assert!(v.reasons.iter().any(|r| r.contains("blockstates")));
        assert!(v.reasons.iter().any(|r| r.contains("worldgen")));
    }

    #[test]
    fn mixins_and_keep_on_are_reported() {
        let f = facts(json!({"id":"sodium","environment":"client","mixins":["sodium.mixins.json"],"entrypoints":{"client":["a.B"]}}), &[]);
        let v = classify(&f);
        assert!(v.keep_on && v.mixins && !v.live_candidate);
        assert!(v.reasons[0].starts_with("Keep-on list"));
    }

    #[test]
    fn only_owned_kinds_are_live() {
        assert_eq!(classify_kind(Kind::LuminosModule).disposition, Disposition::Live);
        assert_eq!(classify_kind(Kind::ResourcePack).disposition, Disposition::Live);
        assert_eq!(classify_kind(Kind::DataPack).disposition, Disposition::Live);
        assert_eq!(classify_kind(Kind::Shader).disposition, Disposition::Queued);
        assert_eq!(classify_kind(Kind::Mod).disposition, Disposition::Queued);
    }

    #[test]
    fn depends_filter_maps_fabric_modules_to_fabric_api() {
        let f = facts(json!({"id":"x","depends":{"minecraft":"*","fabricloader":"*","fabric-resource-loader-v0":"*","fabric-api-base":"*","sodium":"*"}}), &[]);
        assert_eq!(f.requires, vec!["fabric-api".to_string(), "sodium".to_string()]);
    }

    #[test]
    fn keep_on_list_matches_the_typescript_planner() {
        let ts = fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../../app/src/livepanel/plan.ts")).expect("plan.ts");
        for (id, why) in KEEP_ON {
            assert!(ts.contains(&format!("\"{id}\": \"{why}\"")) || ts.contains(&format!("{id}: \"{why}\"")), "keep-on entry {id} differs between livemod.rs and plan.ts");
        }
    }

    #[test]
    fn lists_real_jars_and_disabled_ones() {
        use std::io::Write;
        let dir = std::env::temp_dir().join(format!("lum-livemod-{}", std::process::id()));
        let mods = dir.join("mods");
        fs::create_dir_all(&mods).unwrap();
        let mk = |name: &str, json: &str| {
            let mut z = zip::ZipWriter::new(fs::File::create(mods.join(name)).unwrap());
            z.start_file("fabric.mod.json", zip::write::SimpleFileOptions::default()).unwrap();
            z.write_all(json.as_bytes()).unwrap();
            z.finish().unwrap();
        };
        mk("a.jar", r#"{"id":"a","version":"1","environment":"client","entrypoints":{"client":["x.Y"]}}"#);
        mk("b.jar.disabled", r#"{"id":"b","version":"2","depends":{"a":"*"}}"#);
        let l = list_mods(&dir);
        assert_eq!(l.len(), 2);
        assert!(l[0].enabled && l[0].id == "a");
        assert!(!l[1].enabled && l[1].file == "b.jar" && l[1].requires == vec!["a"]);
        let _ = fs::remove_dir_all(&dir);
    }
}
