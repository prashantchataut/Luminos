//! Mojang metadata: the version manifest, version JSON, libraries, rules, and loader profiles.
use crate::{
    http,
    instances::{Instance, Loader},
    paths, store,
};
use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs};

const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
pub struct Latest {
    pub release: String,
    pub snapshot: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
pub struct ManifestVersion {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: String,
    #[serde(rename = "releaseTime", default)]
    pub release_time: String,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
pub struct Manifest {
    pub latest: Latest,
    pub versions: Vec<ManifestVersion>,
}

/// Fetch (and cache) the version manifest. Falls back to the cache when offline.
pub fn fetch_manifest() -> Result<Manifest> {
    let cache = paths::cache_dir().join("version_manifest.json");
    match http::get_json::<Manifest>(MANIFEST_URL) {
        Ok(m) => {
            let _ = store::write_json(&cache, &m);
            Ok(m)
        }
        Err(e) => {
            let m: Manifest = store::read_json(&cache);
            if m.versions.is_empty() {
                Err(e)
            } else {
                Ok(m)
            }
        }
    }
}

// ───────────────────────────── version JSON ─────────────────────────────

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct OsRule {
    pub name: Option<String>,
    pub arch: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Rule {
    pub action: String,
    pub os: Option<OsRule>,
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum ArgValue {
    One(String),
    Many(Vec<String>),
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(untagged)]
pub enum Arg {
    Plain(String),
    Ruled { rules: Vec<Rule>, value: ArgValue },
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Arguments {
    pub game: Vec<Arg>,
    pub jvm: Vec<Arg>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Artifact {
    pub path: Option<String>,
    pub url: String,
    pub sha1: Option<String>,
    pub size: u64,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct LibDownloads {
    pub artifact: Option<Artifact>,
    pub classifiers: Option<HashMap<String, Artifact>>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Library {
    pub name: String,
    pub downloads: Option<LibDownloads>,
    pub url: Option<String>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<HashMap<String, String>>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct AssetIndexRef {
    pub id: String,
    pub url: String,
    pub sha1: Option<String>,
    pub size: u64,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct DownloadRef {
    pub url: String,
    pub sha1: Option<String>,
    pub size: u64,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default)]
pub struct VersionDownloads {
    pub client: Option<DownloadRef>,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct JavaVersion {
    pub major_version: u32,
}

#[derive(Deserialize, Serialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct VersionJson {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub main_class: String,
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<Arguments>,
    pub libraries: Vec<Library>,
    pub asset_index: Option<AssetIndexRef>,
    pub assets: Option<String>,
    pub downloads: Option<VersionDownloads>,
    pub java_version: Option<JavaVersion>,
    pub inherits_from: Option<String>,
}

pub fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

fn os_matches(o: &OsRule) -> bool {
    if let Some(n) = &o.name {
        if n != os_name() {
            return false;
        }
    }
    if let Some(a) = &o.arch {
        let ok = match a.as_str() {
            "x86" => cfg!(target_arch = "x86"),
            "arm64" | "aarch64" => cfg!(target_arch = "aarch64"),
            _ => true,
        };
        if !ok {
            return false;
        }
    }
    true
}

/// Evaluate Mojang-style allow/disallow rules (feature rules never match).
pub fn rules_allow(rules: &Option<Vec<Rule>>) -> bool {
    let Some(rules) = rules else { return true };
    if rules.is_empty() {
        return true;
    }
    let mut allowed = false;
    for r in rules {
        let mut m = r.os.as_ref().map(os_matches).unwrap_or(true);
        if r.features.is_some() {
            m = false;
        }
        if m {
            allowed = r.action == "allow";
        }
    }
    allowed
}

/// `org.ow2.asm:asm:9.6` -> `org/ow2/asm/asm/9.6/asm-9.6.jar`
pub fn maven_path(name: &str) -> String {
    let (coord, ext) = match name.split_once('@') {
        Some((c, e)) => (c, e),
        None => (name, "jar"),
    };
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() < 3 {
        return coord.replace(':', "/");
    }
    let (g, a, v) = (parts[0].replace('.', "/"), parts[1], parts[2]);
    let cls = parts.get(3).map(|c| format!("-{c}")).unwrap_or_default();
    format!("{g}/{a}/{v}/{a}-{v}{cls}.{ext}")
}

/// A concrete file the game needs on disk.
#[derive(Clone, Debug)]
pub struct LibFile {
    pub path: String,
    pub url: String,
    pub sha1: Option<String>,
    pub size: u64,
    pub native: bool,
}

pub fn lib_files(lib: &Library) -> Vec<LibFile> {
    if !rules_allow(&lib.rules) {
        return vec![];
    }
    let mut out = vec![];
    if let Some(d) = &lib.downloads {
        if let Some(a) = &d.artifact {
            let path = a.path.clone().unwrap_or_else(|| maven_path(&lib.name));
            out.push(LibFile {
                path,
                url: a.url.clone(),
                sha1: a.sha1.clone(),
                size: a.size,
                native: lib.name.contains(":natives-"),
            });
        }
        if let (Some(n), Some(cls)) = (&lib.natives, &d.classifiers) {
            if let Some(key) = n.get(os_name()) {
                let key = key.replace(
                    "${arch}",
                    if cfg!(target_pointer_width = "32") {
                        "32"
                    } else {
                        "64"
                    },
                );
                if let Some(a) = cls.get(&key) {
                    out.push(LibFile {
                        path: a.path.clone().unwrap_or_else(|| {
                            format!(
                                "{}-{key}.jar",
                                maven_path(&lib.name).trim_end_matches(".jar")
                            )
                        }),
                        url: a.url.clone(),
                        sha1: a.sha1.clone(),
                        size: a.size,
                        native: true,
                    });
                }
            }
        }
    } else {
        let base = lib
            .url
            .clone()
            .unwrap_or_else(|| "https://libraries.minecraft.net/".into());
        let path = maven_path(&lib.name);
        let base = if base.ends_with('/') {
            base
        } else {
            format!("{base}/")
        };
        out.push(LibFile {
            url: format!("{base}{path}"),
            path,
            sha1: None,
            size: 0,
            native: false,
        });
    }
    out
}

// ───────────────────────────── resolving ─────────────────────────────

fn version_file(id: &str) -> std::path::PathBuf {
    paths::versions_dir().join(id).join(format!("{id}.json"))
}

fn load_vanilla(id: &str) -> Result<VersionJson> {
    let f = version_file(id);
    if let Ok(b) = fs::read(&f) {
        if let Ok(v) = serde_json::from_slice::<VersionJson>(&b) {
            return Ok(v);
        }
    }
    let manifest = fetch_manifest()?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| anyhow!("Minecraft {id} is not in Mojang's manifest"))?;
    let raw: serde_json::Value = http::get_json(&entry.url)?;
    if let Some(p) = f.parent() {
        fs::create_dir_all(p)?;
    }
    fs::write(&f, serde_json::to_vec(&raw)?)?;
    serde_json::from_value(raw).context("parsing version json")
}

fn loader_profile(mc: &str, loader: Loader, wanted: Option<&str>) -> Result<VersionJson> {
    let (meta, list_url) = match loader {
        Loader::Fabric => (
            "https://meta.fabricmc.net/v2/versions/loader",
            format!("https://meta.fabricmc.net/v2/versions/loader/{mc}"),
        ),
        Loader::Quilt => (
            "https://meta.quiltmc.org/v3/versions/loader",
            format!("https://meta.quiltmc.org/v3/versions/loader/{mc}"),
        ),
        _ => {
            return Err(anyhow!(
                "{} launching is not implemented yet",
                loader.label()
            ))
        }
    };
    let ver = match wanted {
        Some(v) => v.to_string(),
        None => {
            let list: Vec<serde_json::Value> = http::get_json(&list_url)?;
            list.iter()
                .find(|e| e["loader"]["stable"].as_bool().unwrap_or(true))
                .or_else(|| list.first())
                .and_then(|e| e["loader"]["version"].as_str())
                .ok_or_else(|| anyhow!("{} has no loader for Minecraft {mc}", loader.label()))?
                .to_string()
        }
    };
    let id = format!(
        "{}-loader-{ver}-{mc}",
        loader.modrinth_id().unwrap_or("loader")
    );
    let f = version_file(&id);
    if let Ok(b) = fs::read(&f) {
        if let Ok(v) = serde_json::from_slice::<VersionJson>(&b) {
            return Ok(v);
        }
    }
    let raw: serde_json::Value = http::get_json(&format!("{meta}/{mc}/{ver}/profile/json"))?;
    if let Some(p) = f.parent() {
        fs::create_dir_all(p)?;
    }
    fs::write(&f, serde_json::to_vec(&raw)?)?;
    serde_json::from_value(raw).context("parsing loader profile")
}

fn merge(parent: VersionJson, child: VersionJson) -> VersionJson {
    let mut libs = child.libraries.clone();
    libs.extend(parent.libraries.clone());
    let arguments = match (parent.arguments.clone(), child.arguments.clone()) {
        (Some(mut p), Some(c)) => {
            p.game.extend(c.game);
            p.jvm.extend(c.jvm);
            Some(p)
        }
        (p, c) => c.or(p),
    };
    VersionJson {
        id: child.id,
        kind: if child.kind.is_empty() {
            parent.kind
        } else {
            child.kind
        },
        main_class: if child.main_class.is_empty() {
            parent.main_class
        } else {
            child.main_class
        },
        minecraft_arguments: child.minecraft_arguments.or(parent.minecraft_arguments),
        arguments,
        libraries: libs,
        asset_index: child.asset_index.or(parent.asset_index),
        assets: child.assets.or(parent.assets),
        downloads: child.downloads.or(parent.downloads),
        java_version: child.java_version.or(parent.java_version),
        inherits_from: None,
    }
}

/// Fully merged version description for an instance (vanilla + loader profile).
pub fn resolve(inst: &Instance) -> Result<VersionJson> {
    let vanilla = load_vanilla(&inst.mc_version)?;
    match inst.loader {
        Loader::Vanilla => Ok(vanilla),
        l => {
            let profile = loader_profile(&inst.mc_version, l, inst.loader_version.as_deref())?;
            Ok(merge(vanilla, profile))
        }
    }
}

/// Loader versions for the "create instance" dialog.
pub fn loader_versions(mc: &str, loader: Loader) -> Result<Vec<String>> {
    let url = match loader {
        Loader::Fabric => format!("https://meta.fabricmc.net/v2/versions/loader/{mc}"),
        Loader::Quilt => format!("https://meta.quiltmc.org/v3/versions/loader/{mc}"),
        _ => return Ok(vec![]),
    };
    let list: Vec<serde_json::Value> = http::get_json(&url)?;
    Ok(list
        .iter()
        .filter_map(|e| e["loader"]["version"].as_str().map(String::from))
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maven_paths() {
        assert_eq!(
            maven_path("org.ow2.asm:asm:9.6"),
            "org/ow2/asm/asm/9.6/asm-9.6.jar"
        );
        assert_eq!(
            maven_path("org.lwjgl:lwjgl:3.3.3:natives-linux"),
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar"
        );
    }

    #[test]
    fn rules() {
        let r = Some(vec![
            Rule {
                action: "allow".into(),
                os: None,
                features: None,
            },
            Rule {
                action: "disallow".into(),
                os: Some(OsRule {
                    name: Some(os_name().into()),
                    arch: None,
                }),
                features: None,
            },
        ]);
        assert!(!rules_allow(&r));
        assert!(rules_allow(&None));
    }
}
