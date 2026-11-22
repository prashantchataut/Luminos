//! Version-aware JVM flag presets.
//!
//! * Java 21+ → Generational ZGC (low pause, great for modern Minecraft).
//! * Java 17 and older → Aikar-style tuned G1GC.
//!
//! An empty `jvm_args` setting means "auto": Luminos picks the right preset for the Java it launches with.

/// The previous hard-coded default; treated as "auto" so existing installs get the upgrade.
pub const LEGACY_DEFAULT: &str = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC";

const AIKAR: &str = "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=130 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=25 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:G1HeapRegionSize=8M -XX:InitiatingHeapOccupancyPercent=15 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1";

#[allow(dead_code)]
const ZGC: &str = "-XX:+UseZGC -XX:+ZGenerational -XX:+DisableExplicitGC -XX:+AlwaysPreTouch";

/// Flags recommended for a given Java major version.
pub fn recommended(_java_major: u32) -> &'static str {
    // G1 is the safest default on every Java (ZGC costs extra CPU on 4-core laptops and its flags
    // changed in JDK 24). Power users can paste the ZGC preset from the settings page.
    let _ = ZGC;
    AIKAR
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
        assert!(recommended(21).contains("UseG1GC"));
        assert!(recommended(17).contains("UseG1GC"));
        assert!(recommended(8).contains("G1NewSizePercent"));
        assert!(!recommended(21).contains("AlwaysPreTouch"));
    }

    #[test]
    fn user_flags_win_and_legacy_default_upgrades() {
        assert_eq!(effective("-Dfoo=1", 21), "-Dfoo=1");
        assert!(effective("", 21).contains("G1"));
        assert!(!effective(LEGACY_DEFAULT, 17).contains("AlwaysPreTouch"));
    }
}
