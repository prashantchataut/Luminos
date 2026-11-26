//! Install everything an instance needs, build the JVM command line, spawn and monitor the game.
use crate::{
    accounts::Account,
    config::Settings,
    download::{self, Progress, Task},
    instances::Instance,
    java, mojang, paths, playtime, store,
};
use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};

pub struct Prepared {
    pub version: mojang::VersionJson,
    pub java: PathBuf,
    pub classpath: Vec<PathBuf>,
    pub natives_dir: PathBuf,
    pub java_major: u32,
    /// What the pre-launch mod audit found and fixed (empty/ok when nothing needed doing).
    pub mod_report: crate::resolve::Report,
}

#[derive(Deserialize)]
struct AssetIndex {
    objects: HashMap<String, AssetObject>,
}
#[derive(Deserialize)]
struct AssetObject {
    hash: String,
    size: u64,
}

/// Download the client, libraries, assets and Java; extract natives. Idempotent and fast on re-runs.
pub fn prepare(inst: &Instance, settings: &Settings, p: &Progress) -> Result<Prepared> {
    p.reset_counts();
    p.set_stage(format!("Resolving Minecraft {}…", inst.mc_version));
    let version = mojang::resolve(inst)?;
    let mut tasks: Vec<Task> = vec![];

    // client jar
    let client_jar = paths::versions_dir()
        .join(&inst.mc_version)
        .join(format!("{}.jar", inst.mc_version));
    let client = version
        .downloads
        .as_ref()
        .and_then(|d| d.client.clone())
        .ok_or_else(|| anyhow!("version has no client download"))?;
    tasks.push(Task {
        url: client.url,
        path: client_jar.clone(),
        sha1: client.sha1,
        size: client.size,
    });

    // libraries
    let mut classpath = vec![];
    let mut natives: Vec<PathBuf> = vec![];
    for lib in &version.libraries {
        for f in mojang::lib_files(lib) {
            let path = paths::libraries_dir().join(&f.path);
            tasks.push(Task {
                url: f.url,
                path: path.clone(),
                sha1: f.sha1,
                size: f.size,
            });
            if f.native {
                natives.push(path.clone());
            }
            if !classpath.contains(&path) {
                classpath.push(path);
            }
        }
    }
    classpath.push(client_jar);

    // asset index (needed before we know the object list)
    p.set_stage("Fetching asset index…");
    let ai = version
        .asset_index
        .clone()
        .ok_or_else(|| anyhow!("version has no asset index"))?;
    let index_path = paths::assets_dir()
        .join("indexes")
        .join(format!("{}.json", ai.id));
    download::download_all(
        vec![Task {
            url: ai.url.clone(),
            path: index_path.clone(),
            sha1: ai.sha1.clone(),
            size: ai.size,
        }],
        1,
        p,
    )?;
    let index: AssetIndex =
        serde_json::from_slice(&fs::read(&index_path)?).context("parsing asset index")?;
    for obj in index.objects.values() {
        let prefix = &obj.hash[..2];
        tasks.push(Task {
            url: format!(
                "https://resources.download.minecraft.net/{prefix}/{}",
                obj.hash
            ),
            path: paths::assets_dir()
                .join("objects")
                .join(prefix)
                .join(&obj.hash),
            sha1: Some(obj.hash.clone()),
            size: obj.size,
        });
    }

    p.set_stage(format!("Downloading game files ({})…", tasks.len()));
    download::download_all(tasks, settings.download_threads, p)?;

    // natives
    p.set_stage("Preparing natives…");
    let natives_dir = inst.dir().join("natives");
    let _ = fs::remove_dir_all(&natives_dir);
    fs::create_dir_all(&natives_dir)?;
    for jar in natives {
        if let Ok(f) = fs::File::open(&jar) {
            if let Ok(mut z) = zip::ZipArchive::new(f) {
                for i in 0..z.len() {
                    let Ok(mut entry) = z.by_index(i) else {
                        continue;
                    };
                    let Some(name) = entry.enclosed_name() else {
                        continue;
                    };
                    let ext_ok = name
                        .extension()
                        .map(|e| matches!(e.to_str(), Some("so" | "dll" | "dylib" | "jnilib")))
                        .unwrap_or(false);
                    if entry.is_file() && ext_ok {
                        if let Some(fname) = name.file_name() {
                            let mut out = fs::File::create(natives_dir.join(fname))?;
                            std::io::copy(&mut entry, &mut out)?;
                        }
                    }
                }
            }
        }
    }

    let major = version
        .java_version
        .as_ref()
        .map(|j| j.major_version)
        .filter(|m| *m > 0)
        .unwrap_or(8);
    let preferred = inst.java_path.as_deref().or(settings.java_path.as_deref());
    let java = java::ensure(major, preferred, p)?;
    // Fabric refuses to start when any mod's `fabric.mod.json` is unsatisfied. Check and repair first.
    p.set_stage("Checking mods against this Minecraft version…");
    let mod_report = match crate::resolve::env_for(inst, major) {
        Ok(env) => crate::resolve::prelaunch(
            inst,
            &env,
            crate::resolve::Options {
                allow_beta: settings.allow_beta_mods,
            },
        )
        .unwrap_or_else(|e| crate::resolve::Report {
            minecraft: inst.mc_version.clone(),
            ok: false,
            notes: vec![format!("Could not verify mods (continuing): {e:#}")],
            ..Default::default()
        }),
        Err(e) => crate::resolve::Report {
            minecraft: inst.mc_version.clone(),
            ok: false,
            notes: vec![format!("Could not read loader version (continuing): {e:#}")],
            ..Default::default()
        },
    };
    p.set_stage("Ready");
    Ok(Prepared {
        version,
        java,
        classpath,
        natives_dir,
        java_major: major,
        mod_report,
    })
}

fn arg_strings(args: &[mojang::Arg]) -> Vec<String> {
    let mut out = vec![];
    for a in args {
        match a {
            mojang::Arg::Plain(s) => out.push(s.clone()),
            mojang::Arg::Ruled { rules, value } => {
                if mojang::rules_allow(&Some(rules.clone())) {
                    match value {
                        mojang::ArgValue::One(s) => out.push(s.clone()),
                        mojang::ArgValue::Many(v) => out.extend(v.iter().cloned()),
                    }
                }
            }
        }
    }
    out
}

fn substitute(s: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = s.to_string();
    for (k, v) in vars {
        out = out.replace(&format!("${{{k}}}"), v);
    }
    out
}

/// Build the full command line for the game.
pub fn build_command(
    inst: &Instance,
    settings: &Settings,
    account: &Account,
    prep: &Prepared,
) -> Command {
    build_command_ext(inst, settings, account, prep, None)
}

/// Minecraft 1.20+ (and the 26.x line) understands `--quickPlayMultiplayer`; older versions use `--server/--port`.
pub fn supports_quick_play(mc: &str) -> bool {
    let mut it = mc.split('.').map(|p| {
        p.split('-')
            .next()
            .unwrap_or("")
            .parse::<u32>()
            .unwrap_or(0)
    });
    let (major, minor) = (it.next().unwrap_or(0), it.next().unwrap_or(0));
    major > 1 || (major == 1 && minor >= 20)
}

pub fn build_command_ext(
    inst: &Instance,
    settings: &Settings,
    account: &Account,
    prep: &Prepared,
    quick_join: Option<&str>,
) -> Command {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let classpath = prep
        .classpath
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(sep);
    let game_dir = inst.game_dir();
    let ai = prep.version.asset_index.clone().unwrap_or_default();
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", account.username.clone());
    vars.insert("version_name", inst.mc_version.clone());
    vars.insert("game_directory", game_dir.to_string_lossy().to_string());
    vars.insert(
        "assets_root",
        paths::assets_dir().to_string_lossy().to_string(),
    );
    vars.insert("assets_index_name", ai.id.clone());
    vars.insert("auth_uuid", account.uuid.replace('-', ""));
    let token = account.access_token.clone().unwrap_or_else(|| "0".into());
    vars.insert("auth_access_token", token.clone());
    vars.insert("auth_session", token);
    vars.insert("clientid", "luminos".into());
    vars.insert("auth_xuid", "0".into());
    vars.insert(
        "user_type",
        match account.kind {
            crate::accounts::AccountKind::Microsoft => "msa",
            crate::accounts::AccountKind::Offline => "legacy",
            _ => "mojang",
        }
        .into(),
    );
    vars.insert("user_properties", "{}".into());
    vars.insert("version_type", "Luminos".into());
    vars.insert(
        "natives_directory",
        prep.natives_dir.to_string_lossy().to_string(),
    );
    vars.insert("launcher_name", "Luminos".into());
    vars.insert("launcher_version", env!("CARGO_PKG_VERSION").into());
    vars.insert("classpath", classpath);
    vars.insert(
        "game_assets",
        paths::assets_dir()
            .join("virtual")
            .join("legacy")
            .to_string_lossy()
            .to_string(),
    );

    let mem = inst.memory_mb.unwrap_or(settings.memory_mb).max(512);
    let _ = fs::create_dir_all(&game_dir);
    // pre-tuned Sodium / ImmediatelyFast / ModernFix configs; only written when the player has none yet
    let _ = crate::perfconfig::write_defaults(&game_dir);
    let mut cmd = Command::new(branded_java(&prep.java));
    crate::sys::quiet(&mut cmd);
    cmd.current_dir(&game_dir);
    // The Luminos Client title screen shows which instance this is.
    cmd.env("LUMINOS_INSTANCE", &inst.name);
    cmd.arg(format!("-Xmx{mem}M"))
        .arg(format!("-Xms{}M", (mem / 4).max(256)));
    let base_flags = crate::jvmflags::effective(&settings.jvm_args, prep.java_major);
    for a in base_flags
        .split_whitespace()
        .chain(inst.jvm_args.split_whitespace())
    {
        cmd.arg(a);
    }

    if std::env::var_os("LUMINOS_NO_AGENT").is_none() {
        if let Some(h) = crate::agent::global() {
            cmd.args(h.jvm_args()); // the in-game agent connects back over loopback (docs/LIVE_SWAP.md)
        }
    }

    if account.kind.uses_injector() {
        // authlib-injector must come before -cp/-jar so it can instrument authlib.
        if let Some(a) =
            crate::yggdrasil::javaagent_arg(account, &crate::yggdrasil::injector_path())
        {
            cmd.arg(a);
        }
    }

    let (jvm, game) = match &prep.version.arguments {
        Some(a) => (arg_strings(&a.jvm), arg_strings(&a.game)),
        None => {
            let mut jvm = vec![
                "-Djava.library.path=${natives_directory}".to_string(),
                "-cp".into(),
                "${classpath}".into(),
            ];
            if cfg!(target_os = "macos") {
                jvm.insert(0, "-XstartOnFirstThread".into());
            }
            let game = prep
                .version
                .minecraft_arguments
                .clone()
                .unwrap_or_default()
                .split_whitespace()
                .map(String::from)
                .collect();
            (jvm, game)
        }
    };
    for a in jvm {
        cmd.arg(substitute(&a, &vars));
    }
    cmd.arg(&prep.version.main_class);
    for a in game {
        cmd.arg(substitute(&a, &vars));
    }
    if settings.fullscreen {
        cmd.arg("--fullscreen");
    } else if settings.game_width > 0 && settings.game_height > 0 {
        cmd.arg("--width").arg(settings.game_width.to_string());
        cmd.arg("--height").arg(settings.game_height.to_string());
    }
    if let Some(world) = quick_join.and_then(|q| q.strip_prefix("world:")) {
        // Singleplayer Quick Play exists from 1.20; older versions have no way to open a world from the command line.
        if supports_quick_play(&inst.mc_version) {
            cmd.arg("--quickPlaySingleplayer").arg(world);
        }
    } else if let Some(addr) = quick_join {
        if supports_quick_play(&inst.mc_version) {
            cmd.arg("--quickPlayMultiplayer").arg(addr);
        } else {
            let (h, p) = crate::servers::split_address(addr);
            cmd.arg("--server").arg(h).arg("--port").arg(p.to_string());
        }
    }
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());
    cmd
}

/// A running game: share it freely with the UI.
#[derive(Clone)]
pub struct GameHandle {
    pub instance_id: String,
    pub child: Arc<Mutex<Child>>,
    pub log: Arc<Mutex<Vec<String>>>,
    pub started: i64,
}

impl GameHandle {
    pub fn kill(&self) {
        let _ = self.child.lock().unwrap().kill();
    }
    pub fn log_tail(&self, n: usize) -> Vec<String> {
        let l = self.log.lock().unwrap();
        l[l.len().saturating_sub(n)..].to_vec()
    }
}

pub fn spawn(
    inst: &Instance,
    settings: &Settings,
    account: &Account,
    prep: &Prepared,
) -> Result<GameHandle> {
    spawn_ext(inst, settings, account, prep, None)
}

/// Like `spawn`, optionally joining `quick_join` (host[:port]) straight away.
pub fn spawn_ext(
    inst: &Instance,
    settings: &Settings,
    account: &Account,
    prep: &Prepared,
    quick_join: Option<&str>,
) -> Result<GameHandle> {
    // Keybinds, options, HUD layout and the server list follow the player between instances (set LUMINOS_NO_SYNC to skip).
    if std::env::var_os("LUMINOS_NO_SYNC").is_none() {
        if let Err(e) = crate::sync::Syncer::new(crate::sync::Policy::default())
            .reconcile(&inst.id, &inst.game_dir())
        {
            eprintln!("sync before launch failed (continuing): {e:#}");
        }
    }
    // Offline accounts: serve the chosen skin and cape to the game from a local Yggdrasil server.
    let (session_account, skin_server) = if settings.offline_skins {
        offline_skin_session(account)
    } else {
        (account.clone(), None)
    };
    let account = &session_account;
    if account.kind.uses_injector() {
        crate::yggdrasil::ensure_injector()?;
    }
    // Offline accounts: drop the chosen skin where CustomSkinLoader (part of the Luminos Client bundle) looks for it.
    if let Some(id) = &account.skin_id {
        let src = crate::skins::png_path(id);
        if src.exists() {
            let dst = inst
                .game_dir()
                .join("CustomSkinLoader")
                .join("LocalSkin")
                .join("skins");
            let _ = fs::create_dir_all(&dst);
            let _ = fs::copy(&src, dst.join(format!("{}.png", account.username)));
        }
    }
    // Always on: every token this process knows is registered so no line of game output can carry it (see `redact`).
    for t in [&account.access_token, &account.client_token]
        .into_iter()
        .flatten()
    {
        crate::redact::register_secret(t);
    }
    let mut cmd = build_command_ext(inst, settings, account, prep, quick_join);
    let mut child = cmd
        .spawn()
        .with_context(|| format!("starting {}", prep.java.display()))?;
    let log = Arc::new(Mutex::new(Vec::<String>::new()));
    if let Some(out) = child.stdout.take() {
        let log = log.clone();
        thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let mut l = log.lock().unwrap();
                l.push(crate::redact::scrub(&line));
                if l.len() > 5000 {
                    l.drain(0..1000);
                }
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        let log = log.clone();
        thread::spawn(move || {
            for line in BufReader::new(err).lines().map_while(Result::ok) {
                log.lock()
                    .unwrap()
                    .push(format!("[stderr] {}", crate::redact::scrub(&line)));
            }
        });
    }
    let child = Arc::new(Mutex::new(child));
    if let Some(srv) = skin_server {
        // Keep the local skin server alive exactly as long as the game runs.
        let c = child.clone();
        thread::spawn(move || {
            loop {
                thread::sleep(std::time::Duration::from_secs(2));
                if matches!(c.lock().map(|mut c| c.try_wait()), Ok(Ok(Some(_))) | Err(_)) {
                    break;
                }
            }
            drop(srv);
        });
    }
    Ok(GameHandle {
        instance_id: inst.id.clone(),
        child,
        log,
        started: store::now_unix(),
    })
}

/// For an offline account with a skin or cape: start the local skin server and return a copy of the
/// account that routes the game's auth through it (authlib-injector). Any failure falls back to the plain
/// offline account, so a skin problem can never stop the game from starting.
fn offline_skin_session(account: &Account) -> (Account, Option<crate::offlineskin::SkinServer>) {
    use crate::{
        accounts::AccountKind,
        offlineskin::{Profile, SkinServer},
    };
    let plain = || (account.clone(), None);
    if account.kind != AccountKind::Offline {
        return plain();
    }
    let lib = crate::skins::load();
    let skin = account.skin_id.as_deref().and_then(|id| {
        let png = crate::skins::read_png(id)
            .or_else(|| crate::cosmetics::skin(id).map(|b| b.png.to_vec()))?;
        let slim = lib
            .skins
            .iter()
            .find(|s| s.id == id)
            .map(|s| s.slim)
            .or_else(|| crate::cosmetics::skin(id).map(|b| b.slim));
        Some((png, slim.unwrap_or(false)))
    });
    let cape = account
        .cape_id
        .as_deref()
        .and_then(crate::cosmetics::cape)
        .map(|c| c.png.to_vec());
    let Some((skin_png, slim)) = skin else {
        return plain();
    };
    if crate::yggdrasil::ensure_injector().is_err() {
        return plain();
    }
    let profile = Profile {
        name: account.username.clone(),
        uuid: account.uuid.clone(),
        skin_png,
        slim,
        cape_png: cape,
    };
    let Ok(srv) = SkinServer::start(profile) else {
        return plain();
    };
    let mut a = account.clone();
    a.kind = AccountKind::Luminos;
    a.auth_server = Some(srv.api_root());
    a.access_token = Some("luminos-local".into());
    (a, Some(srv))
}

/// Blocks until the game exits (poll-based so `kill` never deadlocks), records playtime, returns the exit code.
pub fn wait_and_record(h: &GameHandle) -> i32 {
    let code = loop {
        {
            let mut c = h.child.lock().unwrap();
            if let Ok(Some(status)) = c.try_wait() {
                break status.code().unwrap_or(-1);
            }
        }
        thread::sleep(std::time::Duration::from_millis(400));
    };
    let secs = (store::now_unix() - h.started).max(0) as u64;
    playtime::record(&h.instance_id, h.started, secs);
    let f = paths::instances_dir()
        .join(&h.instance_id)
        .join("instance.json");
    let mut inst: Instance = store::read_json(&f);
    if !inst.id.is_empty() {
        inst.playtime_secs += secs;
        inst.last_played = Some(h.started);
        let _ = inst.save();
    }
    code
}

/// On Windows the game process is named after its executable. Copy the managed runtime's `java.exe` / `javaw.exe` to
/// `LuminosClient.exe` in the SAME `bin` folder (so every DLL path resolves exactly as before) and start that, so Task Manager's
/// Details tab and the taskbar group show `LuminosClient.exe`. Falls back to the original binary if the copy fails.
/// Note: the file description inside the copied exe is still the JDK's; only the process name changes.
pub fn branded_java(java: &std::path::Path) -> std::path::PathBuf {
    if !cfg!(windows) {
        return java.to_path_buf();
    }
    let is_java = java
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|n| n.eq_ignore_ascii_case("java.exe") || n.eq_ignore_ascii_case("javaw.exe"));
    let Some(dir) = java.parent().filter(|_| is_java) else {
        return java.to_path_buf();
    };
    let dst = dir.join("LuminosClient.exe");
    let same = match (fs::metadata(java), fs::metadata(&dst)) {
        (Ok(a), Ok(b)) => a.len() == b.len(),
        _ => false,
    };
    if same || fs::copy(java, &dst).is_ok() {
        dst
    } else {
        java.to_path_buf()
    }
}
