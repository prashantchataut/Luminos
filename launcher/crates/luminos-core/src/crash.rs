//! Crash doctor: reads a crash report / latest.log and explains the likely cause in plain language.
//!
//! Purely heuristic and offline. Each rule returns a [`Finding`] with a human message and, when it can,
//! the mod that is probably responsible so the UI can offer “disable” / “update” buttons.
use crate::instances::Instance;
use std::{fs, path::PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Fix {
    MoreMemory,
    NewerJava,
    OlderJava,
    DisableMod(String),
    UpdateMod(String),
    InstallDependency(String),
    None,
}

#[derive(Clone, Debug)]
pub struct Finding {
    pub title: String,
    pub detail: String,
    pub fix: Fix,
}

fn between<'a>(hay: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let i = hay.find(start)? + start.len();
    let j = hay[i..].find(end)? + i;
    Some(&hay[i..j])
}

/// Analyse the text of a crash report (or the tail of `latest.log`).
pub fn analyse(text: &str) -> Vec<Finding> {
    let mut out = vec![];
    let t = text;

    if t.contains("java.lang.OutOfMemoryError") || t.contains("There is insufficient memory") {
        out.push(Finding {
            title: "Minecraft ran out of memory".into(),
            detail: "Give this instance more RAM in its settings (e.g. 4–6 GB for modded) or remove heavy mods / shaders.".into(),
            fix: Fix::MoreMemory,
        });
    }
    if let Some(ver) = between(t, "class file version ", ")") {
        let newer = ver
            .split(['.', ' '])
            .next()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0)
            >= 61;
        out.push(Finding {
            title: "Wrong Java version".into(),
            detail: format!("A class needs a newer Java (class file version {ver}). Luminos can download the matching runtime automatically — clear the Java path in instance settings."),
            fix: if newer { Fix::NewerJava } else { Fix::OlderJava },
        });
    } else if t.contains("UnsupportedClassVersionError") {
        out.push(Finding {
            title: "Wrong Java version".into(),
            detail: "Use the Java version the game asks for (17 for 1.18–1.20.4, 21 for 1.20.5+)."
                .into(),
            fix: Fix::NewerJava,
        });
    }
    // Fabric: "Mod 'x' (id) requires version 1.2 or later of mod 'y' (id), which is missing!"
    for line in t
        .lines()
        .filter(|l| l.contains("requires") && l.contains("which is missing"))
    {
        if let Some(dep) = line
            .rsplit("of mod ")
            .next()
            .and_then(|r| between(r, "(", ")"))
            .or_else(|| between(line, "mod '", "'"))
        {
            out.push(Finding {
                title: format!("Missing dependency: {dep}"),
                detail: line.trim().trim_start_matches(['-', ' ']).to_string(),
                fix: Fix::InstallDependency(dep.to_string()),
            });
        }
    }
    // Mixin failures name the mod config / owner
    for line in t.lines().filter(|l| {
        l.contains("Mixin apply")
            || l.contains("Mixin transformation")
            || l.contains("InvalidMixinException")
    }) {
        let who = between(line, "for mod ", " ")
            .or_else(|| between(line, "from mod ", " "))
            .or_else(|| between(line, "[", ".mixins.json"));
        if let Some(m) = who {
            let id = m
                .trim_matches(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
                .to_string();
            if !id.is_empty() && !out.iter().any(|f| f.fix == Fix::DisableMod(id.clone())) {
                out.push(Finding {
                    title: format!("A mixin from “{id}” failed to apply"),
                    detail: "Usually a mod built for a different Minecraft version or in conflict with another mod. Update it, or disable it.".into(),
                    fix: Fix::UpdateMod(id),
                });
            }
        }
    }
    // Forge/Fabric crash-report "Suspected Mod" section
    if let Some(sec) = between(t, "Suspected Mod", "Stacktrace") {
        for l in sec.lines().skip(1).take(3) {
            let l = l.trim();
            if let Some((name, id)) = l
                .split_once(" (")
                .and_then(|(n, r)| Some((n, r.split(')').next()?)))
            {
                out.push(Finding {
                    title: format!("Suspected mod: {name}"),
                    detail: "The crash report names this mod as the likely culprit.".into(),
                    fix: Fix::DisableMod(id.to_string()),
                });
                break;
            }
        }
    }
    if t.contains("GLFW error")
        || t.contains("Pixel format not accelerated")
        || t.contains("OpenGL: Failed")
    {
        out.push(Finding {
            title: "Graphics driver problem".into(),
            detail: "Update your GPU driver. On laptops make sure Java runs on the dedicated GPU. Try disabling shaders.".into(),
            fix: Fix::None,
        });
    }
    if t.contains("Address already in use") {
        out.push(Finding {
            title: "Port already in use".into(),
            detail: "Another Minecraft server or instance is still running — close it and retry."
                .into(),
            fix: Fix::None,
        });
    }
    if out.is_empty() && (t.contains("Exception") || t.contains("---- Minecraft Crash Report ----"))
    {
        let first = t
            .lines()
            .find(|l| l.contains("Exception") || l.contains("Error"))
            .unwrap_or("")
            .trim();
        out.push(Finding {
            title: "Unrecognised crash".into(),
            detail: format!("No known pattern matched. First error line: {first}"),
            fix: Fix::None,
        });
    }
    out
}

/// Newest crash report of an instance, if any.
pub fn latest_report(inst: &Instance) -> Option<PathBuf> {
    fs::read_dir(inst.game_dir().join("crash-reports"))
        .ok()?
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "txt"))
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok())
        .map(|e| e.path())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_oom() {
        let f = analyse("Caused by: java.lang.OutOfMemoryError: Java heap space");
        assert_eq!(f[0].fix, Fix::MoreMemory);
    }

    #[test]
    fn detects_java_version() {
        let f = analyse("java.lang.UnsupportedClassVersionError: x has been compiled by a more recent version (class file version 65.0)");
        assert_eq!(f[0].fix, Fix::NewerJava);
    }

    #[test]
    fn detects_missing_dependency() {
        let f = analyse("\t - Mod 'Mod Menu' (modmenu) 9.0 requires version 0.100 or later of mod 'Fabric API' (fabric-api), which is missing!");
        assert!(
            f.iter()
                .any(|x| x.fix == Fix::InstallDependency("fabric-api".into())),
            "{f:?}"
        );
    }

    #[test]
    fn detects_mixin_owner() {
        let f = analyse("Mixin apply for mod coolmod failed coolmod.mixins.json:FooMixin");
        assert!(
            f.iter().any(|x| x.fix == Fix::UpdateMod("coolmod".into())),
            "{f:?}"
        );
    }

    #[test]
    fn quiet_log_has_no_findings() {
        assert!(analyse("[12:00:00] [main/INFO]: Setting user: Steve").is_empty());
    }
}
