//! Tiny persistence + hashing helpers shared by every module.
use anyhow::{Context, Result};
use serde::{de::DeserializeOwned, Serialize};
use sha1::{Digest, Sha1};
use std::{fs, io::Read, path::Path};

/// Read JSON from disk, falling back to `Default` when missing or corrupt.
pub fn read_json<T: DeserializeOwned + Default>(path: &Path) -> T {
    fs::read(path)
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

/// Atomically write pretty JSON (tmp file + rename) so a crash never corrupts state.
pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(value)?)
        .with_context(|| format!("writing {}", path.display()))?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn now_unix() -> i64 {
    chrono::Utc::now().timestamp()
}

pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

pub fn sha1_bytes(data: &[u8]) -> String {
    let mut h = Sha1::new();
    h.update(data);
    let out = h.finalize();
    hex(&out[..])
}

pub fn sha1_file(path: &Path) -> Result<String> {
    let mut f = fs::File::open(path)?;
    let mut h = Sha1::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    let out = h.finalize();
    Ok(hex(&out[..]))
}

/// Human readable duration like `4h 40m`.
pub fn fmt_duration(secs: u64) -> String {
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    if h > 0 {
        format!("{h}h {m:02}m")
    } else if m > 0 {
        format!("{m}m")
    } else {
        format!("{secs}s")
    }
}

/// Human readable large numbers like `19.5M`.
pub fn fmt_count(n: u64) -> String {
    match n {
        0..=999 => n.to_string(),
        1_000..=999_999 => format!("{:.1}K", n as f64 / 1_000.0),
        1_000_000..=999_999_999 => format!("{:.1}M", n as f64 / 1_000_000.0),
        _ => format!("{:.1}B", n as f64 / 1_000_000_000.0),
    }
}
