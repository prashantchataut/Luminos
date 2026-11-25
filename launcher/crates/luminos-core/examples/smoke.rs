//! CI smoke test: "does the default preset get to the Minecraft title screen?"
//!
//! `cargo run -p luminos-core --example smoke -- <minecraft-version> <out-dir>`
//! Installs the default Luminos Client preset with the dependency solver, runs the pre-launch audit,
//! launches with an offline account (offline skin server on, exactly as the app does) and watches the
//! log. Exit code 0 only when the Luminos Client printed `[luminos] smoke-ok` (it reached the title
//! screen and exited cleanly) and Fabric reported no incompatibility.
use luminos_core::{
    accounts::Account, config::Settings, download::Progress, instances, instances::Loader, launch,
    preset,
};
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
    let render_mods = [
        "sodium",
        "immediately",
        "culling",
        "optimizations",
        "lithium",
        "ferrite",
        "krypton",
    ];
    let mods: Vec<&preset::PresetMod> = preset::LUMINOS_CLIENT
        .iter()
        .filter(|m| m.default_on)
        .filter(|m| match variant.as_str() {
            "minimal" => m.slug == "fabric-api",
            // the baseline the brief compares against: Fabric API + Sodium and nothing else (the Luminos jar is left out below)
            "sodium-only" => m.slug == "fabric-api" || m.slug == "sodium",
            "no-skin" => !m.slug.contains("skin"),
            "no-render" => !render_mods.iter().any(|r| m.slug.contains(r)),
            _ => true,
        })
        .collect();
    println!("VARIANT {variant}: {} mods", mods.len());
    if variant == "sodium-only" {
        std::env::remove_var("LUMINOS_CLIENT_JAR");
    }
    // LUMINOS_STARTUP_ONLY=1: stop as soon as the game is ready (title marker, or the last vanilla atlas for the baseline) and record timings.
    let startup_only = std::env::var("LUMINOS_STARTUP_ONLY").is_ok() || variant == "sodium-only";
    let report = preset::install(&inst, &mods, |i, t, n| eprintln!("install {i}/{t} {n}"));
    println!(
        "INSTALLED {} mods; skipped {}",
        report.ok.len(),
        report.skipped.len()
    );
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
    println!(
        "PRELAUNCH ok={} checked={} replaced={:?} dropped={:?} notes={:?}",
        mr.ok, mr.checked, mr.replaced, mr.dropped, mr.notes
    );
    std::fs::write(out.join("mod-report.json"), serde_json::to_string_pretty(&serde_json::json!({
        "minecraft": version,
        "installed": report.ok, "dropped_at_install": report.skipped, "notes": report.notes,
        "prelaunch": { "ok": mr.ok, "checked": mr.checked, "replaced": mr.replaced, "dropped": mr.dropped, "notes": mr.notes },
    })).unwrap()).unwrap();
    // list final mods so the log shows exactly what Fabric was given
    if let Ok(rd) = std::fs::read_dir(inst.game_dir().join("mods")) {
        let mut names: Vec<String> = rd
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        println!("MODS {}", names.join(", "));
    }

    // A fresh profile opens the accessibility onboarding screen *before* the title screen, and nobody clicks it in CI.
    // Skip it (and vsync, which stalls presents on a virtual display) the way a returning player's options.txt would.
    let opts = inst.game_dir().join("options.txt");
    let _ = std::fs::write(&opts, "onboardAccessibility:false\nenableVsync:false\nmaxFps:30\nguiScale:2\noverrideWidth:1920\noverrideHeight:1080\nskipMultiplayerWarning:true\ntutorialStep:none\njoinedFirstServer:true\nnarrator:0\n");
    // LUMINOS_AGENT_E2E=1: instead of the scripted tour, hold the game at the title screen and drive the real in-game agent
    // over the real loopback link (module toggle, resource pack reload, pause refusal). See `agent_checks`.
    let e2e = std::env::var_os("LUMINOS_AGENT_E2E").is_some();
    let hub = luminos_core::agent::global().expect("agent hub");
    if e2e {
        let packs = inst.game_dir().join("resourcepacks");
        let _ = std::fs::create_dir_all(&packs);
        let mut z = zip::ZipWriter::new(std::fs::File::create(packs.join("agent-test.zip")).expect("pack zip"));
        z.start_file("pack.mcmeta", zip::write::SimpleFileOptions::default()).expect("pack.mcmeta");
        std::io::Write::write_all(&mut z, br#"{"pack":{"pack_format":75,"description":"Luminos agent test pack"}}"#).expect("write");
        z.finish().expect("finish pack");
    } else {
        std::env::set_var("LUMINOS_SMOKE", "1");
    }
    let mut agent_result = serde_json::Value::Null;
    let h = launch::spawn(&inst, &settings, &Account::offline("LuminosCI"), &prep).expect("spawn");
    let started = Instant::now();
    let mut seen = 0usize;
    let mut title = false;
    let mut ok = false;
    let mut bad: Vec<String> = vec![];
    let mut last_growth = Instant::now();
    let mut dumps = 0;
    // Same vanilla marker in every variant: the GUI atlas is stitched at the end of the first resource reload, just before the title screen.
    let mut atlas_at: Option<f64> = None;
    let mut title_at: Option<f64> = None;
    let mut ready_since: Option<Instant> = None;
    loop {
        let lines = h.log_tail(100_000);
        for l in lines.iter().skip(seen) {
            println!("GAME {l}");
            if atlas_at.is_none() && l.contains("textures/atlas/gui.png-atlas") {
                atlas_at = Some(started.elapsed().as_secs_f64());
            }
            if l.contains("[luminos] title-screen reached") {
                title = true;
                title_at = Some(started.elapsed().as_secs_f64());
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
            let _ = std::process::Command::new("kill")
                .arg("-QUIT")
                .arg(pid.to_string())
                .status();
            dumps += 1;
            last_growth = Instant::now();
        }
        seen = lines.len();
        if e2e && title {
            agent_result = agent_checks(hub);
            ok = agent_result["pass"].as_bool().unwrap_or(false);
            break;
        }
        if startup_only {
            // baseline has no Luminos marker: give the game 8 s after the atlas line to reach the title, then count it as ready
            if atlas_at.is_some() && ready_since.is_none() {
                ready_since = Some(Instant::now());
            }
            if (title && atlas_at.is_some())
                || ready_since.map_or(false, |t| t.elapsed() > Duration::from_secs(8))
            {
                title = true;
                ok = true;
                break;
            }
        }
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
        "mods": mods.len(),
        "gui_atlas_seconds": atlas_at, "title_marker_seconds": title_at, "agent": agent_result,
        "note": "seconds are measured from process spawn by the harness (500 ms polling); gui_atlas_seconds is the same vanilla log line in every variant",
    })).unwrap()).unwrap();
    println!("RESULT minecraft={version} title_screen={title} smoke_ok={ok} incompatibilities={} pass={pass}", bad.len());
    if !pass {
        std::process::exit(1);
    }
}

fn wait_for(secs: u64, f: impl Fn() -> bool) -> bool {
    let t = Instant::now();
    while t.elapsed() < Duration::from_secs(secs) {
        if f() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

/// Sends `cmd`, waits for the agent's `done`, and returns (done event, the progress stages in the order they arrived).
fn run_cmd(hub: &luminos_core::agent::Hub, cmd: serde_json::Value, secs: u64) -> (Option<serde_json::Value>, Vec<String>) {
    let op = hub.send(cmd).expect("send");
    let got = wait_for(secs, || hub.events_since(0).0.iter().any(|e| e["t"] == "done" && e["op"] == op));
    let ev = hub.events_since(0).0;
    let stages = ev.iter().filter(|e| e["t"] == "progress" && e["op"] == op).filter_map(|e| e["stage"].as_str().map(String::from)).collect();
    (got.then(|| ev.into_iter().find(|e| e["t"] == "done" && e["op"] == op)).flatten(), stages)
}

fn flag(hub: &luminos_core::agent::Hub, list: &str, id: &str) -> Option<bool> {
    let (done, _) = run_cmd(hub, serde_json::json!({"t": "snapshot"}), 20);
    done?;
    hub.hello()?[list].as_array()?.iter().find(|m| m["id"] == id)?["enabled"].as_bool()
}

fn agent_checks(hub: &luminos_core::agent::Hub) -> serde_json::Value {
    use serde_json::json;
    if !wait_for(60, || hub.connected() && hub.hello().is_some()) {
        return json!({"pass": false, "error": "the agent never connected"});
    }
    let hello = hub.hello().unwrap_or_default();
    let before = flag(hub, "modules", "fps");
    let (off, off_stages) = run_cmd(hub, json!({"t": "toggle_module", "id": "fps", "on": false}), 30);
    let after_off = flag(hub, "modules", "fps");
    let (on, _) = run_cmd(hub, json!({"t": "toggle_module", "id": "fps", "on": true}), 30);
    let after_on = flag(hub, "modules", "fps");
    let (bad, _) = run_cmd(hub, json!({"t": "toggle_module", "id": "no-such-module", "on": true}), 30);
    let pack_before = flag(hub, "packs", "file/agent-test.zip");
    let (pack_on, pack_stages) = run_cmd(hub, json!({"t": "set_pack", "id": "file/agent-test.zip", "on": true}), 120);
    let pack_after_on = flag(hub, "packs", "file/agent-test.zip");
    let (pack_off, _) = run_cmd(hub, json!({"t": "set_pack", "id": "file/agent-test.zip", "on": false}), 120);
    let pack_after_off = flag(hub, "packs", "file/agent-test.zip");
    let (pause, _) = run_cmd(hub, json!({"t": "pause", "on": true}), 30);
    let ok = |d: &Option<serde_json::Value>| d.as_ref().is_some_and(|d| d["ok"] == true);
    let checks = json!({
        "module_off_applied": ok(&off) && before == Some(true) && after_off == Some(false),
        "module_on_restored": ok(&on) && after_on == Some(true),
        "unknown_module_refused": bad.as_ref().is_some_and(|d| d["ok"] == false),
        "module_stages_in_order": off_stages == ["received", "applying", "applied"],
        "pack_enabled_via_reload": ok(&pack_on) && pack_before == Some(false) && pack_after_on == Some(true),
        "pack_stages_include_real_reload": pack_stages == ["received", "applying", "reloading", "applied"],
        "pack_disabled_via_reload": ok(&pack_off) && pack_after_off == Some(false),
        "pause_refused_without_a_world": pause.as_ref().is_some_and(|d| d["ok"] == false && d["detail"].as_str().unwrap_or("").contains("no world")),
    });
    let pass = checks.as_object().is_some_and(|c| c.values().all(|v| v == true));
    json!({"pass": pass, "checks": checks, "minecraft": hello["mc"], "mods_seen": hello["mods"].as_array().map(|m| m.len()), "module_stages": off_stages, "pack_stages": pack_stages,
           "NOT_TESTED_HERE": "pause with a world open (needs a loaded singleplayer world)"})
}
