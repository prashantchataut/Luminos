//! End-to-end launch check: downloads a real version, builds the command line exactly like the app,
//! spawns the JVM and reads the log. Without a display the game must still get as far as LWJGL/GLFW
//! initialisation, which proves classpath, natives, main class and arguments are right.
//! Run: `LUMINOS_SMOKE_JAVA=/path/to/java cargo test -p luminos-core --test launch_smoke -- --ignored --nocapture`
use luminos_core::{
    accounts::Account, config::Settings, download::Progress, instances, instances::Loader, launch,
};

#[test]
#[ignore]
fn vanilla_boots_to_graphics_init() {
    let home = std::env::temp_dir().join("luminos-smoke");
    let _ = std::fs::remove_dir_all(&home.join("instances"));
    std::env::set_var("LUMINOS_HOME", &home);
    let version = std::env::var("LUMINOS_SMOKE_VERSION").unwrap_or("1.21.4".into());
    let loader = match std::env::var("LUMINOS_SMOKE_LOADER").as_deref() {
        Ok("fabric") => Loader::Fabric,
        _ => Loader::Vanilla,
    };
    let inst = instances::create("smoke", &version, loader, None).unwrap();
    if std::env::var("LUMINOS_SMOKE_PRESET").is_ok() {
        let mods: Vec<&luminos_core::preset::PresetMod> = luminos_core::preset::LUMINOS_CLIENT
            .iter()
            .filter(|m| m.default_on)
            .collect();
        luminos_core::preset::install(&inst, &mods, |i, t, n| println!("mod {i}/{t} {n}"));
    }
    let mut settings = Settings::default();
    settings.java_path = std::env::var("LUMINOS_SMOKE_JAVA").ok();
    let p = Progress::new();
    let prep = launch::prepare(&inst, &settings, &p).unwrap();
    let h = launch::spawn(&inst, &settings, &Account::offline("SmokeTest"), &prep).unwrap();
    let code = launch::wait_and_record(&h);
    let log = h.log_tail(400).join("\n");
    println!("exit code {code}\n{log}");
    assert!(
        log.contains("Setting user")
            || log.contains("GLFW")
            || log.contains("LWJGL")
            || log.contains("Fabric"),
        "game never reached graphics init"
    );
}
