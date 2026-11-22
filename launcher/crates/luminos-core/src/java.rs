//! Java discovery and automatic Temurin runtime download.
use crate::{download::Progress, http, paths};
use anyhow::{anyhow, Result};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Debug)]
pub struct JavaInstall {
    pub path: PathBuf,
    pub major: u32,
}

fn exe() -> &'static str {
    if cfg!(windows) { "java.exe" } else { "java" }
}

/// Run `java -version` and parse the major version.
pub fn probe(path: &Path) -> Option<u32> {
    let out = Command::new(path).arg("-version").output().ok()?;
    let text = String::from_utf8_lossy(&out.stderr).to_string() + &String::from_utf8_lossy(&out.stdout);
    let q = text.split('"').nth(1)?;
    let mut parts = q.split(['.', '_', '-', '+']);
    let first: u32 = parts.next()?.parse().ok()?;
    if first == 1 {
        parts.next()?.parse().ok()
    } else {
        Some(first)
    }
}

fn push_children(list: &mut Vec<PathBuf>, dir: &str, suffix: &str) {
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            list.push(e.path().join(suffix).join("bin").join(exe()));
        }
    }
}

pub fn detect() -> Vec<JavaInstall> {
    let mut cands: Vec<PathBuf> = vec![];
    if let Ok(h) = std::env::var("JAVA_HOME") {
        cands.push(Path::new(&h).join("bin").join(exe()));
    }
    cands.push(PathBuf::from(exe()));
    push_children(&mut cands, "/usr/lib/jvm", "");
    push_children(&mut cands, "/Library/Java/JavaVirtualMachines", "Contents/Home");
    for base in [r"C:\Program Files\Java", r"C:\Program Files\Eclipse Adoptium", r"C:\Program Files\Microsoft", r"C:\Program Files\Zulu"] {
        push_children(&mut cands, base, "");
    }
    if let Ok(rd) = fs::read_dir(paths::runtimes_dir()) {
        for e in rd.flatten() {
            if let Some(p) = find_java_bin(&e.path()) {
                cands.push(p);
            }
        }
    }
    let mut out: Vec<JavaInstall> = vec![];
    for c in cands {
        if c.components().count() > 1 && !c.exists() {
            continue;
        }
        if let Some(major) = probe(&c) {
            if !out.iter().any(|j| j.path == c) {
                out.push(JavaInstall { path: c, major });
            }
        }
    }
    out
}

fn find_java_bin(dir: &Path) -> Option<PathBuf> {
    for e in fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        if p.is_dir() {
            if p.file_name().map(|n| n == "bin").unwrap_or(false) {
                let j = p.join(exe());
                if j.exists() {
                    return Some(j);
                }
            }
            if let Some(f) = find_java_bin(&p) {
                return Some(f);
            }
        }
    }
    None
}

/// Pick the best Java for `major`, downloading a managed Temurin JRE if none fits.
pub fn ensure(major: u32, preferred: Option<&str>, p: &Progress) -> Result<PathBuf> {
    if let Some(path) = preferred.filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(path);
        if probe(&pb).is_some() {
            return Ok(pb);
        }
    }
    let managed = paths::runtimes_dir().join(format!("java-{major}"));
    if let Some(j) = find_java_bin(&managed) {
        return Ok(j);
    }
    let installs = detect();
    let fits = |j: &&JavaInstall| if major <= 8 { j.major == 8 } else { j.major >= major };
    if let Some(j) = installs.iter().filter(fits).min_by_key(|j| j.major) {
        return Ok(j.path.clone());
    }
    p.set_stage(format!("Downloading Java {major} runtime…"));
    let os = if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "mac" } else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
    let url = format!("https://api.adoptium.net/v3/binary/latest/{major}/ga/{os}/{arch}/jre/hotspot/normal/eclipse");
    fs::create_dir_all(&managed)?;
    let archive = paths::cache_dir().join(format!("java-{major}.archive"));
    http::download_to(&url, &archive)?;
    p.set_stage("Unpacking Java runtime…");
    if cfg!(windows) {
        let f = fs::File::open(&archive)?;
        let mut z = zip::ZipArchive::new(f)?;
        z.extract(&managed)?;
    } else {
        let f = fs::File::open(&archive)?;
        let gz = flate2::read::GzDecoder::new(f);
        tar::Archive::new(gz).unpack(&managed)?;
    }
    let _ = fs::remove_file(&archive);
    let java = find_java_bin(&managed).ok_or_else(|| anyhow!("Downloaded runtime has no java executable"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(m) = fs::metadata(&java) {
            let mut perm = m.permissions();
            perm.set_mode(0o755);
            let _ = fs::set_permissions(&java, perm);
        }
    }
    Ok(java)
}
