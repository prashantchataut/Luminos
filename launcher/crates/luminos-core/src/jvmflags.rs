//! Version-aware JVM flag presets.
//!
//! * Java 21+ → Generational ZGC (low pause, great for modern Minecraft).
//! * Java 17 and older → Aikar-style tuned G1GC.
//!
//! An empty `jvm_args` setting means "auto": Luminos picks the right preset for the Java it launches with.

/// The previous hard-coded default; treated as "auto" so existing installs get the upgrade.
pub const LEGACY_DEFAULT: &str = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC";

const AIKAR: &str = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1";

const ZGC: &str = "-XX:+UseZGC -XX:+ZGenerational -XX:+DisableExplicitGC -XX:+AlwaysPreTouch";

/// Flags recommended for a given Java major version.
pub fn recommended(java_major: u32) -> &'static str {
    if java_major >= 21 {
        ZGC
    } else {
        AIKAR
    }
}

/// Resolve the effective base flags from the user's setting.
pub fn effective(setting: &str, java_major: u32) -> String {
    let s = setting.trim();
    if s.is_empty() || s == LEGACY_DEFAULT {
        recommended(java_major).to_string()
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_by_java_version() {
        assert!(recommended(21).contains("UseZGC"));
        assert!(recommended(17).contains("UseG1GC"));
        assert!(recommended(8).contains("G1NewSizePercent"));
    }

    #[test]
    fn user_flags_win_and_legacy_default_upgrades() {
        assert_eq!(effective("-Dfoo=1", 21), "-Dfoo=1");
        assert!(effective("", 21).contains("ZGC"));
        assert!(effective(LEGACY_DEFAULT, 17).contains("AlwaysPreTouch"));
    }
}
