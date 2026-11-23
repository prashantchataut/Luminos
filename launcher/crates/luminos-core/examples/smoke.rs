//! CI smoke test: "does the default preset get to the Minecraft title screen?"
//!
//! `cargo run -p luminos-core --example smoke -- <minecraft-version> <out-dir>`
//! Installs the default Luminos Client preset with the dependency solver, runs the pre-launch audit,
//! launches with an offline account (offline skin server on, exactly as the app does) and watches the
//! log. Exit code 0 only when the Luminos Client printed `[luminos] smoke-ok` (it reached the title
//! screen and exited cleanly) and Fabric reported no incompatibility.
use luminos_core::{accounts::Account, config::Settings, download::Progress, instances, instances::Loader, launch, preset};
use std::time::{Duration, Instant};

const BAD: &[&str] = &[
    "Incompatible mods found",
    "Incompatible mod set",
    "Mod resolution failed",
    "FormattedException",
    "requires version",
    "which is missing",
    "Mixin apply failed",
    "Crash report saved",
];

fn main() {
    let mut args = std::env::args().skip(1);
    let version = args.next().expect("minecraft version");
    let out = std::path::PathBuf::from(args.next().unwrap_or_else(|| "smoke-out".into()));
    std::fs::create_dir_all(&out).unwrap();
    let home = std::env::temp_dir().join(format!("luminos-smoke-{version}"));
    let _ = std::fs::remove_dir_all(&home);
    std::env::set_var("LUMINOS_HOME", &home);

    let inst = instances::create("smoke", &version, Loader::Fabric, None).expect("create instance");
    // LUMINOS_SMOKE_VARIANT narrows the preset so a failing run can be bisected in CI:
    //   full (default) | minimal (Fabric API only) | no-skin (without CustomSkinLoader) | no-render (without the renderer/culling mods)
    let variant = std::env::var("LUMINOS_SMOKE_VARIANT").unwrap_or_else(|_| "full".into());
    let render_mods = ["sodium", "immediately", "culling", "optimizations", "lithium", "ferrite", "krypton"];
    let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT
        .iter()
        .filter(|m| m.default_on)
        .filter(|m| match variant.as_str() {
            "minimal" => m.slug == "fabric-api",
            "no-skin" => !m.slug.contains("skin"),
            "no-render" => !render_mods.iter().any(|r| m.slug.contains(r)),
            _ => true,
        })
        .collect();
    println!("VARIANT {variant}: {} mods", mods.len());
    let report = preset::install(&inst, &mods, |i, t, n| eprintln!("install {i}/{t} {n}"));
    println!("INSTALLED {} mods; skipped {}", report.ok.len(), report.skipped.len());
    for (n, why) in &report.skipped {
        println!("DROPPED {n}: {why}");
    }
    for n in &report.notes {
        println!("NOTE {n}");
    }
    let mut settings = Settings::default();
    settings.memory_mb = 2048;
    let p = Progress::new();
    let prep = launch::prepare(&inst, &settings, &p).expect("prepare");
    let mr = &prep.mod_report;
    println!("PRELAUNCH ok={} checked={} replaced={:?} dropped={:?} notes={:?}", mr.ok, mr.checked, mr.replaced, mr.dropped, mr.notes);
    std::fs::write(out.join("mod-report.json"), serde_json::to_string_pretty(&serde_json::json!({
        "minecraft": version,
        "installed": report.ok, "dropped_at_install": report.skipped, "notes": report.notes,
        "prelaunch": { "ok": mr.ok, "checked": mr.checked, "replaced": mr.replaced, "dropped": mr.dropped, "notes": mr.notes },
    })).unwrap()).unwrap();
    // list final mods so the log shows exactly what Fabric was given
    if let Ok(rd) = std::fs::read_dir(inst.game_dir().join("mods")) {
        let mut names: Vec<String> = rd.flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect();
        names.sort();
        println!("MODS {}", names.join(", "));
    }

    // A fresh profile opens the accessibility onboarding screen *before* the title screen, and nobody clicks it in CI.
    // Skip it (and vsync, which stalls presents on a virtual display) the way a returning player's options.txt would.
    let opts = inst.game_dir().join("options.txt");
    let _ = std::fs::write(&opts, "onboardAccessibility:false\nenableVsync:false\nmaxFps:30\nskipMultiplayerWarning:true\ntutorialStep:none\njoinedFirstServer:true\nnarrator:0\n");
    std::env::set_var("LUMINOS_SMOKE", "1");
    let h = launch::spawn(&inst, &settings, &Account::offline("LuminosCI"), &prep).expect("spawn");
    let started = Instant::now();
    let mut seen = 0usize;
    let mut title = false;
    let mut ok = false;
    let mut bad: Vec<String> = vec![];
    let mut last_growth = Instant::now();
    let mut dumps = 0;
    loop {
        let lines = h.log_tail(100_000);
        for l in lines.iter().skip(seen) {
            println!("GAME {l}");
            if l.contains("[luminos] title-screen reached") {
                title = true;
            }
            if l.contains("[luminos] smoke-ok") {
                ok = true;
            }
            if BAD.iter().any(|b| l.contains(b)) {
                bad.push(l.clone());
            }
        }
        if lines.len() != seen {
            last_growth = Instant::now();
        } else if last_growth.elapsed() > Duration::from_secs(45) && dumps < 3 {
            // the game went quiet: ask the JVM for a thread dump (SIGQUIT) so the log shows where it is stuck
            let pid = h.child.lock().unwrap().id();
            println!("SILENT for 45 s - thread dump #{} of pid {pid}", dumps + 1);
            let _ = std::process::Command::new("kill").arg("-QUIT").arg(pid.to_string()).status();
            dumps += 1;
            last_growth = Instant::now();
        }
        seen = lines.len();
        let exited = h.child.lock().unwrap().try_wait().ok().flatten().is_some();
        if (ok && exited) || exited || started.elapsed() > Duration::from_secs(420) {
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    h.kill();
    let lines = h.log_tail(100_000);
    std::fs::write(out.join("game.log"), lines.join("\n")).unwrap();
    let pass = title && ok && bad.is_empty();
    std::fs::write(out.join("result.json"), serde_json::to_string_pretty(&serde_json::json!({
        "minecraft": version, "variant": variant, "title_screen": title, "clean_exit_marker": ok, "incompatibilities": bad, "pass": pass,
        "seconds": started.elapsed().as_secs(),
    })).unwrap()).unwrap();
    println!("RESULT minecraft={version} title_screen={title} smoke_ok={ok} incompatibilities={} pass={pass}", bad.len());
    if !pass {
        std::process::exit(1);
    }
}
