//! Launch progress, as plain data and plain functions (no Tauri types, so every rule here is unit-tested).
//!
//! The window shows six real stages. Stages 1-5 are emitted by `launch_instance` as the work happens; stage 6 follows the
//! game's own stdout/stderr (the log buffer `luminos-core` fills from the piped child) until Minecraft has really opened
//! its OpenGL window, or the process exits first (then the last lines become the error log).
use serde::Serialize;
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub const TOTAL_STEPS: u8 = 6;

pub const STAGE_NAMES: [&str; 6] = [
    "Checking Java Runtime",
    "Cleaning Old Mods & Injecting Luminos Client",
    "Verifying Game Assets & Libraries",
    "Provisioning Sodium & Performance Stack",
    "Spawning JVM Process",
    "Waiting for Minecraft OpenGL Window",
];

/// One `launch-progress` event. `step_index` is 1-based.
#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchProgress {
    pub stage: String,
    pub percent: u8,
    pub detail: String,
    pub step_index: u8,
    pub total_steps: u8,
    /// The most recent real log line (stage 6) or work item, for the one-line live status under the bar.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_line: Option<String>,
}

impl LaunchProgress {
    pub fn with_log(mut self, line: impl Into<String>) -> Self {
        let l: String = line.into();
        self.log_line = if l.is_empty() { None } else { Some(l) };
        self
    }
}

/// Build the event for stage `step` (1..=6).
pub fn progress(step: u8, percent: u8, detail: impl Into<String>) -> LaunchProgress {
    let step = step.clamp(1, TOTAL_STEPS);
    LaunchProgress {
        stage: format!("{}. {}", step, STAGE_NAMES[usize::from(step) - 1]),
        percent: percent.min(100),
        detail: detail.into(),
        step_index: step,
        total_steps: TOTAL_STEPS,
        log_line: None,
    }
}

/// What a game log line tells us. `window` = Minecraft has opened its window (progress is 100%).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Milestone {
    pub percent: u8,
    pub detail: &'static str,
    pub window: bool,
}

/// Recognise the log lines that mark real startup milestones. Anything else is not a milestone (it is still shown as the live log line).
pub fn classify(line: &str) -> Option<Milestone> {
    let l = line;
    let m = |percent, detail, window| Some(Milestone { percent, detail, window });
    // The window is up: the LWJGL backend is chosen right after the GLFW window is created; the sound engine and the first atlas follow.
    if l.contains("Backend library: LWJGL") {
        return m(100, "Backend library: LWJGL - Minecraft window created", true);
    }
    if l.contains("OpenAL initialized") {
        return m(100, "OpenAL initialized - Minecraft window is open", true);
    }
    if l.contains("Sound engine started") {
        return m(100, "Sound engine started - Minecraft window is open", true);
    }
    if l.contains("Created:") && l.contains("-atlas") {
        return m(100, "Texture atlas created - Minecraft window is open", true);
    }
    if l.contains("Reloading ResourceManager") {
        return m(95, "Loading resource packs and textures...", false);
    }
    if (l.contains("Luminos Client") && l.contains("loaded")) || l.contains("[luminos]") || l.contains("(Sodium)") || l.contains("[Sodium]") {
        return m(92, "Initializing Luminos Native Engine & Sodium renderer...", false);
    }
    if l.contains("Setting user:") {
        return m(89, "Starting your Minecraft session...", false);
    }
    if (l.contains("FabricLoader") && l.contains("Loading")) || (l.contains("Mixin") && l.contains("subsystem")) {
        return m(86, "Loading Fabric Loader & Mixin subsystem...", false);
    }
    None
}

/// What stage 6 knows after reading more of the log.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Tick {
    /// Highest percent reached so far (never goes backwards).
    pub percent: u8,
    pub detail: String,
    /// The most recent log line, flattened for a one-line display.
    pub last_line: String,
    pub window_open: bool,
    /// True when new log lines arrived since the last call.
    pub changed: bool,
}

/// Follows a growing log buffer. Call `feed` with the whole buffer as often as you like.
#[derive(Debug, Default)]
pub struct Tracker {
    cursor: usize,
    percent: u8,
    detail: String,
    last_line: String,
    window_open: bool,
}

impl Tracker {
    pub fn new(start_percent: u8) -> Self {
        Self { percent: start_percent, detail: "Starting the game process...".into(), ..Self::default() }
    }

    pub fn feed(&mut self, log: &[String]) -> Tick {
        // The log buffer is trimmed from the front when it grows past its cap; never read past the end.
        if self.cursor > log.len() {
            self.cursor = 0;
        }
        let mut changed = false;
        for line in &log[self.cursor..] {
            let t = line.trim();
            if t.is_empty() {
                continue;
            }
            self.last_line = one_line(t);
            changed = true;
            if let Some(m) = classify(t) {
                if m.percent > self.percent || (m.window && !self.window_open) {
                    self.percent = self.percent.max(m.percent);
                    self.detail = m.detail.into();
                }
                self.window_open |= m.window;
            }
        }
        self.cursor = log.len();
        Tick { percent: self.percent, detail: self.detail.clone(), last_line: self.last_line.clone(), window_open: self.window_open, changed }
    }

    pub fn window_open(&self) -> bool {
        self.window_open
    }
}

/// Collapse a log line to something that fits a single status row (the window truncates visually; this bounds the payload).
pub fn one_line(s: &str) -> String {
    let flat: String = s.chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    let flat = flat.trim();
    if flat.chars().count() > 220 {
        let cut: String = flat.chars().take(219).collect();
        format!("{cut}…")
    } else {
        flat.to_string()
    }
}

/// The last `n` non-empty lines, joined: the text of the diagnostic dialog when the game dies before its window opens.
pub fn error_log(log: &[String], n: usize) -> String {
    let lines: Vec<&str> = log.iter().map(|s| s.as_str()).filter(|s| !s.trim().is_empty()).collect();
    lines[lines.len().saturating_sub(n)..].join("\n")
}

// ------------------------------------------------------------------ the Luminos Client jar in <game dir>/mods

/// A file that belongs to a Luminos Client install of any version: `luminos-client*`, `luminos_client*`, or ANY jar (or disabled jar)
/// with "luminos" in its name (`*luminos*.jar`, `*luminos*.jar.disabled`).
pub fn is_luminos_client_file(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    n.starts_with("luminos-client")
        || n.starts_with("luminos_client")
        || (n.contains("luminos") && (n.ends_with(".jar") || n.ends_with(".jar.disabled") || n.ends_with(".jar.part")))
}

/// Delete every `*luminos*.jar` under a Luminos cache folder (recursively), so no old client jar can be re-used from there.
/// A missing folder is fine. Returns the file names removed.
pub fn purge_cache_jars(dir: &Path) -> io::Result<Vec<String>> {
    let mut removed = vec![];
    let rd = match fs::read_dir(dir) {
        Ok(r) => r,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(removed),
        Err(e) => return Err(e),
    };
    for e in rd.flatten() {
        let path = e.path();
        let name = e.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            removed.extend(purge_cache_jars(&path)?);
        } else if is_luminos_client_file(&name) {
            fs::remove_file(&path).map_err(|err| io::Error::new(err.kind(), format!("could not remove cached {name}: {err}")))?;
            removed.push(name);
        }
    }
    removed.sort();
    Ok(removed)
}

/// Delete every Luminos Client file in `mods` so the game can never load a stale version next to the fresh one.
/// Returns the names removed. A file that cannot be removed is an error: leaving it would put two clients on the classpath.
pub fn purge_stale_client_jars(mods: &Path) -> io::Result<Vec<String>> {
    purge_except(mods, None)
}

/// Same, but keeps the one file called `keep` (used for the last check just before the JVM is spawned).
pub fn purge_except(mods: &Path, keep: Option<&str>) -> io::Result<Vec<String>> {
    let mut removed = vec![];
    let rd = match fs::read_dir(mods) {
        Ok(r) => r,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(removed),
        Err(e) => return Err(e),
    };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if keep == Some(name.as_str()) {
            continue;
        }
        if e.path().is_file() && is_luminos_client_file(&name) {
            fs::remove_file(e.path()).map_err(|err| io::Error::new(err.kind(), format!("could not remove stale {name}: {err}")))?;
            removed.push(name);
        }
    }
    removed.sort();
    Ok(removed)
}

/// Of the bundled client jars for one Minecraft version, the one built for this app version (the installer ships exactly that one;
/// a dev checkout may hold several). Falls back to the last name in sort order so the choice is at least deterministic.
pub fn pick_bundled(mut candidates: Vec<PathBuf>, app_version: &str) -> Option<PathBuf> {
    candidates.sort();
    let tag = format!("luminos-client-{app_version}-mc");
    let exact = candidates.iter().find(|p| p.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with(&tag))).cloned();
    exact.or_else(|| candidates.pop())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lines(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn any_luminos_jar_is_stale_and_cache_is_purged() {
        assert!(is_luminos_client_file("Luminos-Client-1.jar"));
        assert!(is_luminos_client_file("my-luminos-thing.jar"));
        assert!(is_luminos_client_file("luminos-client-4.1.0-mc1.21.11.jar.disabled"));
        assert!(!is_luminos_client_file("sodium.jar") && !is_luminos_client_file("fabric-api.jar"));
        let dir = std::env::temp_dir().join(format!("luminos-cachepurge-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("client/old")).unwrap();
        for n in ["luminos-client-4.0.0.jar", "client/luminos-client-4.1.0-mc1.21.11.jar", "client/old/Luminos_X.jar", "client/keep.txt", "sodium.jar"] {
            fs::write(dir.join(n), b"x").unwrap();
        }
        let gone = purge_cache_jars(&dir).unwrap();
        assert_eq!(gone.len(), 3, "{gone:?}");
        assert!(dir.join("client/keep.txt").exists() && dir.join("sodium.jar").exists());
        assert!(purge_cache_jars(&dir.join("does-not-exist")).unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn six_named_stages() {
        assert_eq!(STAGE_NAMES.len(), usize::from(TOTAL_STEPS));
        let p = progress(5, 80, "x");
        assert_eq!(p.stage, "5. Spawning JVM Process");
        assert_eq!((p.step_index, p.total_steps, p.percent), (5, 6, 80));
        assert_eq!(progress(9, 250, "").percent, 100);
        let j = serde_json::to_value(progress(1, 10, "d")).unwrap();
        assert_eq!(j["stepIndex"], 1);
        assert_eq!(j["totalSteps"], 6);
        assert!(j.get("logLine").is_none());
        let k = serde_json::to_value(progress(6, 90, "d").with_log("a line")).unwrap();
        assert_eq!(k["logLine"], "a line");
    }

    #[test]
    fn window_lines_are_recognised() {
        for l in [
            "[12:00:01] [Render thread/INFO] (Minecraft) Backend library: LWJGL version 3.3.3-snapshot",
            "[12:00:03] [Render thread/INFO] (Minecraft) OpenAL initialized on device Speakers",
            "[12:00:03] [Render thread/INFO] (Minecraft) Sound engine started",
            "[12:00:04] [Render thread/INFO] (Minecraft) Created: 1024x512x0 minecraft:textures/atlas/blocks.png-atlas",
        ] {
            assert!(classify(l).is_some_and(|m| m.window && m.percent == 100), "{l}");
        }
        assert!(classify("[main/INFO] (FabricLoader) Loading 52 mods").is_some_and(|m| !m.window && m.percent == 86));
        assert!(classify("[Render thread/INFO] (Minecraft) Reloading ResourceManager: vanilla").is_some_and(|m| m.percent == 95));
        assert!(classify("[main/WARN] something unrelated").is_none());
        assert!(classify("Created: a texture with no atlas suffix").is_none());
    }

    #[test]
    fn tracker_is_monotonic_and_incremental() {
        let mut t = Tracker::new(80);
        let mut log = lines(&["[main/INFO] (FabricLoader) Loading 52 mods: a, b"]);
        let a = t.feed(&log);
        assert_eq!((a.percent, a.window_open, a.changed), (86, false, true));
        assert!(!t.feed(&log).changed, "nothing new");
        log.push("[Render thread/INFO] (Minecraft) Reloading ResourceManager: x".into());
        log.push("[Render thread/INFO] (Minecraft) Setting user: Steve".into()); // lower percent than the line before: must not go back
        let b = t.feed(&log);
        assert_eq!(b.percent, 95);
        assert!(b.last_line.contains("Setting user"));
        log.push("[Render thread/INFO] (Minecraft) Backend library: LWJGL version 3.3.3".into());
        let c = t.feed(&log);
        assert!(c.window_open && c.percent == 100);
        assert!(t.window_open());
    }

    #[test]
    fn tracker_survives_a_trimmed_buffer() {
        let mut t = Tracker::new(80);
        t.feed(&lines(&["a", "b", "c", "d"]));
        let after = t.feed(&lines(&["x"]));
        assert_eq!(after.last_line, "x");
    }

    #[test]
    fn error_log_keeps_the_last_lines() {
        let log: Vec<String> = (0..50).map(|i| format!("line {i}")).collect();
        let e = error_log(&log, 30);
        assert_eq!(e.lines().count(), 30);
        assert!(e.starts_with("line 20") && e.ends_with("line 49"));
        assert_eq!(error_log(&lines(&["", "  ", "only"]), 30), "only");
    }

    #[test]
    fn luminos_files_are_recognised() {
        for n in ["luminos-client-4.0.0-mc1.21.11.jar", "luminos-client-4.1.0-mc1.21.11.jar", "Luminos-Client-1.jar", "luminos_client_old.jar.disabled", "luminos-agent-1.jar"] {
            assert!(is_luminos_client_file(n), "{n}");
        }
        for n in ["sodium-fabric-0.6.jar", "fabric-api-0.141.jar", "lithium.jar", "luminos-notes.txt"] {
            assert!(!is_luminos_client_file(n), "{n}");
        }
    }

    #[test]
    fn purge_removes_every_stale_client_and_nothing_else() {
        let dir = std::env::temp_dir().join(format!("luminos-purge-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for n in ["luminos-client-4.0.0-mc1.21.11.jar", "luminos-client-3.9.0-mc1.21.11.jar", "luminos_client_x.jar", "sodium.jar", "fabric-api.jar"] {
            fs::write(dir.join(n), b"x").unwrap();
        }
        let gone = purge_stale_client_jars(&dir).unwrap();
        assert_eq!(gone.len(), 3);
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect();
        left.sort();
        assert_eq!(left, vec!["fabric-api.jar".to_string(), "sodium.jar".to_string()]);
        assert!(purge_stale_client_jars(&dir.join("missing")).unwrap().is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn purge_except_keeps_exactly_the_named_jar() {
        let dir = std::env::temp_dir().join(format!("luminos-keep-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        for n in ["luminos-client-4.0.0-mc1.21.11.jar", "luminos-client-4.1.0-mc1.21.11.jar", "sodium.jar"] {
            fs::write(dir.join(n), b"x").unwrap();
        }
        let gone = purge_except(&dir, Some("luminos-client-4.1.0-mc1.21.11.jar")).unwrap();
        assert_eq!(gone, vec!["luminos-client-4.0.0-mc1.21.11.jar".to_string()]);
        assert!(dir.join("luminos-client-4.1.0-mc1.21.11.jar").exists() && dir.join("sodium.jar").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn bundled_pick_prefers_this_app_version() {
        let c = vec![PathBuf::from("/r/luminos-client-4.0.0-mc1.21.11.jar"), PathBuf::from("/r/luminos-client-4.1.0-mc1.21.11.jar")];
        assert!(pick_bundled(c.clone(), "4.1.0").unwrap().to_string_lossy().contains("4.1.0"));
        assert!(pick_bundled(c.clone(), "4.0.0").unwrap().to_string_lossy().contains("4.0.0"));
        assert!(pick_bundled(c, "9.9.9").is_some());
        assert!(pick_bundled(vec![], "4.1.0").is_none());
    }
}
