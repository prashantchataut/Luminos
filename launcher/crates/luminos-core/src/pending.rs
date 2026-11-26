//! Queued switches ("applies next launch"): persisted per instance, applied by renaming jars just before the game starts.
//! A mod jar is enabled as `x.jar` and disabled as `x.jar.disabled`; jars are never edited.
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Task {
    /// Enabled file name, e.g. `zoomify.jar`.
    pub file: String,
    pub enable: bool,
    pub label: String,
    /// Switches queued together share a batch id, so Undo reverts the whole switch.
    pub batch: u64,
}

fn path(game_dir: &Path) -> std::path::PathBuf {
    game_dir.join("luminos-pending.json")
}

pub fn load(game_dir: &Path) -> Vec<Task> {
    fs::read_to_string(path(game_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(game_dir: &Path, t: &[Task]) -> Result<()> {
    fs::create_dir_all(game_dir)?;
    let tmp = path(game_dir).with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(t)?)?;
    fs::rename(&tmp, path(game_dir)).context("save pending switches")
}

/// Queue tasks. A newer task for the same file replaces the older one.
pub fn push(game_dir: &Path, tasks: Vec<Task>) -> Result<Vec<Task>> {
    let mut cur = load(game_dir);
    for t in tasks {
        cur.retain(|c| c.file != t.file);
        cur.push(t);
    }
    save(game_dir, &cur)?;
    Ok(cur)
}

/// Remove every task of one batch (Undo of a queued switch). Returns how many were removed.
pub fn cancel_batch(game_dir: &Path, batch: u64) -> Result<usize> {
    let cur = load(game_dir);
    let keep: Vec<Task> = cur.iter().filter(|t| t.batch != batch).cloned().collect();
    let n = cur.len() - keep.len();
    save(game_dir, &keep)?;
    Ok(n)
}

/// Apply and clear the queue. Returns one line per task, including the ones that could not be applied.
pub fn apply_all(game_dir: &Path) -> Result<Vec<String>> {
    let tasks = load(game_dir);
    let mods = game_dir.join("mods");
    let mut log = vec![];
    for t in &tasks {
        let (on, off) = (
            mods.join(&t.file),
            mods.join(format!("{}.disabled", t.file)),
        );
        let (from, to) = if t.enable { (&off, &on) } else { (&on, &off) };
        if from.exists() {
            fs::rename(from, to).with_context(|| format!("switch {}", t.file))?;
            log.push(format!(
                "{} {}",
                if t.enable { "enabled" } else { "disabled" },
                t.label
            ));
        } else if to.exists() {
            log.push(format!(
                "{} was already {}",
                t.label,
                if t.enable { "enabled" } else { "disabled" }
            ));
        } else {
            log.push(format!("{}: file {} is gone, skipped", t.label, t.file));
        }
    }
    save(game_dir, &[])?;
    Ok(log)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dir(n: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("lum-pending-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join("mods")).unwrap();
        d
    }
    fn t(file: &str, enable: bool, batch: u64) -> Task {
        Task {
            file: file.into(),
            enable,
            label: file.trim_end_matches(".jar").into(),
            batch,
        }
    }

    #[test]
    fn queue_apply_and_undo() {
        let d = dir("a");
        fs::write(d.join("mods/a.jar"), b"1").unwrap();
        fs::write(d.join("mods/b.jar.disabled"), b"2").unwrap();
        push(&d, vec![t("a.jar", false, 1), t("b.jar", true, 1)]).unwrap();
        assert_eq!(load(&d).len(), 2);
        assert_eq!(
            cancel_batch(&d, 1).unwrap(),
            2,
            "undo removes the whole batch"
        );
        assert!(load(&d).is_empty() && d.join("mods/a.jar").exists());
        push(&d, vec![t("a.jar", false, 2), t("b.jar", true, 2)]).unwrap();
        let log = apply_all(&d).unwrap();
        assert_eq!(log, vec!["disabled a", "enabled b"]);
        assert!(d.join("mods/a.jar.disabled").exists() && d.join("mods/b.jar").exists());
        assert!(load(&d).is_empty());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn newer_task_replaces_older_and_missing_files_are_reported() {
        let d = dir("b");
        fs::write(d.join("mods/a.jar"), b"1").unwrap();
        push(&d, vec![t("a.jar", false, 1)]).unwrap();
        let cur = push(&d, vec![t("a.jar", true, 2), t("ghost.jar", false, 2)]).unwrap();
        assert_eq!(cur.len(), 2);
        let log = apply_all(&d).unwrap();
        assert_eq!(log[0], "a was already enabled");
        assert!(log[1].contains("is gone"));
        let _ = fs::remove_dir_all(&d);
    }
}
