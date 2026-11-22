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
    let client_jar = paths::versions_dir().join(&inst.mc_version).join(format!("{}.jar", inst.mc_version));
    let client = version
        .downloads
        .as_ref()
        .and_then(|d| d.client.clone())
        .ok_or_else(|| anyhow!("version has no client download"))?;
    tasks.push(Task { url: client.url, path: client_jar.clone(), sha1: client.sha1, size: client.size });

    // libraries
    let mut classpath = vec![];
    let mut natives: Vec<PathBuf> = vec![];
    for lib in &version.libraries {
        for f in mojang::lib_files(lib) {
            let path = paths::libraries_dir().join(&f.path);
            tasks.push(Task { url: f.url, path: path.clone(), sha1: f.sha1, size: f.size });
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
    let ai = version.asset_index.clone().ok_or_else(|| anyhow!("version has no asset index"))?;
    let index_path = paths::assets_dir().join("indexes").join(format!("{}.json", ai.id));
    download::download_all(
        vec![Task { url: ai.url.clone(), path: index_path.clone(), sha1: ai.sha1.clone(), size: ai.size }],
        1,
        p,
    )?;
    let index: AssetIndex = serde_json::from_slice(&fs::read(&index_path)?).context("parsing asset index")?;
    for obj in index.objects.values() {
        let prefix = &obj.hash[..2];
        tasks.push(Task {
            url: format!("https://resources.download.minecraft.net/{prefix}/{}", obj.hash),
            path: paths::assets_dir().join("objects").join(prefix).join(&obj.hash),
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
                    let Ok(mut entry) = z.by_index(i) else { continue };
                    let Some(name) = entry.enclosed_name() else { continue };
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

    let major = version.java_version.as_ref().map(|j| j.major_version).filter(|m| *m > 0).unwrap_or(8);
    let preferred = inst.java_path.as_deref().or(settings.java_path.as_deref());
    let java = java::ensure(major, preferred, p)?;
    p.set_stage("Ready");
    Ok(Prepared { version, java, classpath, natives_dir })
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
pub fn build_command(inst: &Instance, settings: &Settings, account: &Account, prep: &Prepared) -> Command {
    let sep = if cfg!(windows) { ";" } else { ":" };
    let classpath = prep.classpath.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>().join(sep);
    let game_dir = inst.game_dir();
    let ai = prep.version.asset_index.clone().unwrap_or_default();
    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", account.username.clone());
    vars.insert("version_name", inst.mc_version.clone());
    vars.insert("game_directory", game_dir.to_string_lossy().to_string());
    vars.insert("assets_root", paths::assets_dir().to_string_lossy().to_string());
    vars.insert("assets_index_name", ai.id.clone());
    vars.insert("auth_uuid", account.uuid.replace('-', ""));
    vars.insert("auth_access_token", "0".into());
    vars.insert("auth_session", "0".into());
    vars.insert("clientid", "luminos".into());
    vars.insert("auth_xuid", "0".into());
    vars.insert("user_type", "legacy".into());
    vars.insert("user_properties", "{}".into());
    vars.insert("version_type", "Luminos".into());
    vars.insert("natives_directory", prep.natives_dir.to_string_lossy().to_string());
    vars.insert("launcher_name", "Luminos".into());
    vars.insert("launcher_version", env!("CARGO_PKG_VERSION").into());
    vars.insert("classpath", classpath);
    vars.insert("game_assets", paths::assets_dir().join("virtual").join("legacy").to_string_lossy().to_string());

    let mem = inst.memory_mb.unwrap_or(settings.memory_mb).max(512);
    let mut cmd = Command::new(&prep.java);
    cmd.current_dir(&game_dir);
    cmd.arg(format!("-Xmx{mem}M")).arg(format!("-Xms{}M", (mem / 4).max(256)));
    for a in settings.jvm_args.split_whitespace().chain(inst.jvm_args.split_whitespace()) {
        cmd.arg(a);
    }

    let (jvm, game) = match &prep.version.arguments {
        Some(a) => (arg_strings(&a.jvm), arg_strings(&a.game)),
        None => {
            let mut jvm = vec!["-Djava.library.path=${natives_directory}".to_string(), "-cp".into(), "${classpath}".into()];
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
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null());
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

pub fn spawn(inst: &Instance, settings: &Settings, account: &Account, prep: &Prepared) -> Result<GameHandle> {
    // Offline accounts: drop the chosen skin where CustomSkinLoader (part of the Luminos Client bundle) looks for it.
    if let Some(id) = &account.skin_id {
        let src = crate::skins::png_path(id);
        if src.exists() {
            let dst = inst.game_dir().join("CustomSkinLoader").join("LocalSkin").join("skins");
            let _ = fs::create_dir_all(&dst);
            let _ = fs::copy(&src, dst.join(format!("{}.png", account.username)));
        }
    }
    let mut cmd = build_command(inst, settings, account, prep);
    let mut child = cmd.spawn().with_context(|| format!("starting {}", prep.java.display()))?;
    let log = Arc::new(Mutex::new(Vec::<String>::new()));
    if let Some(out) = child.stdout.take() {
        let log = log.clone();
        thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                let mut l = log.lock().unwrap();
                l.push(line);
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
                log.lock().unwrap().push(format!("[stderr] {line}"));
            }
        });
    }
    Ok(GameHandle {
        instance_id: inst.id.clone(),
        child: Arc::new(Mutex::new(child)),
        log,
        started: store::now_unix(),
    })
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
    let f = paths::instances_dir().join(&h.instance_id).join("instance.json");
    let mut inst: Instance = store::read_json(&f);
    if !inst.id.is_empty() {
        inst.playtime_secs += secs;
        inst.last_played = Some(h.started);
        let _ = inst.save();
    }
    code
}
