//! Real worlds and saved servers found on this PC: a small NBT reader/writer, a `saves/` scanner (reads each world's
//! `level.dat` and `icon.png`) and `servers.dat` read/append. Nothing here is invented: an empty disk gives empty lists.
use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};

// ------------------------------------------------------------------ NBT

#[derive(Clone, Debug, PartialEq)]
pub enum Tag {
    Byte(i8),
    Short(i16),
    Int(i32),
    Long(i64),
    Float(f32),
    Double(f64),
    ByteArray(Vec<i8>),
    String(String),
    /// Element type id plus the elements (an empty list carries type 0).
    List(u8, Vec<Tag>),
    Compound(Vec<(String, Tag)>),
    IntArray(Vec<i32>),
    LongArray(Vec<i64>),
}

impl Tag {
    fn id(&self) -> u8 {
        match self {
            Tag::Byte(_) => 1,
            Tag::Short(_) => 2,
            Tag::Int(_) => 3,
            Tag::Long(_) => 4,
            Tag::Float(_) => 5,
            Tag::Double(_) => 6,
            Tag::ByteArray(_) => 7,
            Tag::String(_) => 8,
            Tag::List(..) => 9,
            Tag::Compound(_) => 10,
            Tag::IntArray(_) => 11,
            Tag::LongArray(_) => 12,
        }
    }
    pub fn get(&self, key: &str) -> Option<&Tag> {
        match self {
            Tag::Compound(v) => v.iter().find(|(k, _)| k == key).map(|(_, t)| t),
            _ => None,
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Tag::String(s) => Some(s),
            _ => None,
        }
    }
    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Tag::Byte(v) => Some(*v as i64),
            Tag::Short(v) => Some(*v as i64),
            Tag::Int(v) => Some(*v as i64),
            Tag::Long(v) => Some(*v),
            _ => None,
        }
    }
}

struct Reader<'a> {
    b: &'a [u8],
    i: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        if self.i + n > self.b.len() {
            bail!("NBT ended early");
        }
        let s = &self.b[self.i..self.i + n];
        self.i += n;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn i16(&mut self) -> Result<i16> {
        Ok(i16::from_be_bytes(self.take(2)?.try_into()?))
    }
    fn i32(&mut self) -> Result<i32> {
        Ok(i32::from_be_bytes(self.take(4)?.try_into()?))
    }
    fn i64(&mut self) -> Result<i64> {
        Ok(i64::from_be_bytes(self.take(8)?.try_into()?))
    }
    fn len(&mut self) -> Result<usize> {
        let n = self.i32()?;
        if n < 0 || n as usize > self.b.len() {
            bail!("NBT length out of range");
        }
        Ok(n as usize)
    }
    fn string(&mut self) -> Result<String> {
        let n = self.i16()? as u16 as usize;
        Ok(String::from_utf8_lossy(self.take(n)?).into_owned())
    }
    fn payload(&mut self, id: u8, depth: u32) -> Result<Tag> {
        if depth > 256 {
            bail!("NBT nested too deeply");
        }
        Ok(match id {
            1 => Tag::Byte(self.u8()? as i8),
            2 => Tag::Short(self.i16()?),
            3 => Tag::Int(self.i32()?),
            4 => Tag::Long(self.i64()?),
            5 => Tag::Float(f32::from_bits(self.i32()? as u32)),
            6 => Tag::Double(f64::from_bits(self.i64()? as u64)),
            7 => {
                let n = self.len()?;
                Tag::ByteArray(self.take(n)?.iter().map(|b| *b as i8).collect())
            }
            8 => Tag::String(self.string()?),
            9 => {
                let t = self.u8()?;
                let n = self.len()?;
                let mut v = Vec::with_capacity(n.min(4096));
                for _ in 0..n {
                    v.push(self.payload(t, depth + 1)?);
                }
                Tag::List(if n == 0 { 0 } else { t }, v)
            }
            10 => {
                let mut v = vec![];
                loop {
                    let t = self.u8()?;
                    if t == 0 {
                        break;
                    }
                    let k = self.string()?;
                    v.push((k, self.payload(t, depth + 1)?));
                }
                Tag::Compound(v)
            }
            11 => {
                let n = self.len()?;
                Tag::IntArray((0..n).map(|_| self.i32()).collect::<Result<_>>()?)
            }
            12 => {
                let n = self.len()?;
                Tag::LongArray((0..n).map(|_| self.i64()).collect::<Result<_>>()?)
            }
            other => bail!("unknown NBT tag {other}"),
        })
    }
}

/// Parse an NBT file's bytes (gzip is detected and unpacked). Returns the root compound.
pub fn parse_nbt(bytes: &[u8]) -> Result<Tag> {
    let raw;
    let data: &[u8] = if bytes.starts_with(&[0x1f, 0x8b]) {
        let mut out = vec![];
        flate2::read::GzDecoder::new(bytes)
            .take(64 * 1024 * 1024)
            .read_to_end(&mut out)
            .context("unzipping NBT")?;
        raw = out;
        &raw
    } else {
        bytes
    };
    let mut r = Reader { b: data, i: 0 };
    let id = r.u8()?;
    if id != 10 {
        bail!("NBT root is not a compound");
    }
    let _root_name = r.string()?;
    r.payload(10, 0)
}

fn put_str(out: &mut Vec<u8>, s: &str) {
    let b = s.as_bytes();
    let n = b.len().min(u16::MAX as usize);
    out.extend_from_slice(&(n as u16).to_be_bytes());
    out.extend_from_slice(&b[..n]);
}

fn put_payload(out: &mut Vec<u8>, t: &Tag) {
    match t {
        Tag::Byte(v) => out.push(*v as u8),
        Tag::Short(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Int(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Long(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Float(v) => out.extend_from_slice(&v.to_bits().to_be_bytes()),
        Tag::Double(v) => out.extend_from_slice(&v.to_bits().to_be_bytes()),
        Tag::ByteArray(v) => {
            out.extend_from_slice(&(v.len() as i32).to_be_bytes());
            out.extend(v.iter().map(|b| *b as u8));
        }
        Tag::String(s) => put_str(out, s),
        Tag::List(id, v) => {
            out.push(*id);
            out.extend_from_slice(&(v.len() as i32).to_be_bytes());
            for e in v {
                put_payload(out, e);
            }
        }
        Tag::Compound(v) => {
            for (k, e) in v {
                out.push(e.id());
                put_str(out, k);
                put_payload(out, e);
            }
            out.push(0);
        }
        Tag::IntArray(v) => {
            out.extend_from_slice(&(v.len() as i32).to_be_bytes());
            for e in v {
                out.extend_from_slice(&e.to_be_bytes());
            }
        }
        Tag::LongArray(v) => {
            out.extend_from_slice(&(v.len() as i32).to_be_bytes());
            for e in v {
                out.extend_from_slice(&e.to_be_bytes());
            }
        }
    }
}

/// Serialise a root compound (uncompressed, empty root name), the format of `servers.dat`.
pub fn write_nbt(root: &Tag) -> Vec<u8> {
    let mut out = vec![10u8];
    put_str(&mut out, "");
    put_payload(&mut out, root);
    out
}

// ------------------------------------------------------------------ base64

pub fn b64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len() * 4 / 3 + 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 {
            T[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if c.len() > 2 {
            T[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

// ------------------------------------------------------------------ directories

/// The vanilla Minecraft directory: `%APPDATA%\.minecraft`, `~/.minecraft`, or `~/Library/Application Support/minecraft`.
/// `LUMINOS_MC_DIR` overrides it (tests, portable setups).
pub fn default_minecraft_dir() -> Option<PathBuf> {
    if let Some(p) = std::env::var_os("LUMINOS_MC_DIR") {
        return Some(PathBuf::from(p));
    }
    if cfg!(target_os = "windows") {
        dirs::data_dir().map(|d| d.join(".minecraft"))
    } else if cfg!(target_os = "macos") {
        dirs::data_dir().map(|d| d.join("minecraft"))
    } else {
        dirs::home_dir().map(|d| d.join(".minecraft"))
    }
}

// ------------------------------------------------------------------ worlds

#[derive(Clone, Debug, Serialize)]
pub struct World {
    pub name: String,
    pub folder: String,
    pub path: String,
    /// Milliseconds since the epoch.
    pub last_played: i64,
    pub game_mode: String,
    pub hardcore: bool,
    pub version: Option<String>,
    /// `data:image/png;base64,...` when the world has an `icon.png`.
    pub icon: Option<String>,
    /// Human label of the directory it lives in (".minecraft" or an instance name).
    pub source: String,
    pub source_dir: String,
}

fn game_mode_label(n: i64) -> &'static str {
    match n {
        0 => "Survival",
        1 => "Creative",
        2 => "Adventure",
        3 => "Spectator",
        _ => "Unknown",
    }
}

fn read_world(dir: &Path, source: &str, source_dir: &Path) -> Option<World> {
    let level = dir.join("level.dat");
    let bytes = fs::read(&level).ok()?;
    let folder = dir.file_name()?.to_string_lossy().to_string();
    let mtime_ms = fs::metadata(&level)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let data = parse_nbt(&bytes)
        .ok()
        .and_then(|root| root.get("Data").cloned());
    let name = data
        .as_ref()
        .and_then(|d| d.get("LevelName"))
        .and_then(|t| t.as_str())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or(&folder)
        .to_string();
    let last_played = data
        .as_ref()
        .and_then(|d| d.get("LastPlayed"))
        .and_then(|t| t.as_i64())
        .filter(|v| *v > 0)
        .unwrap_or(mtime_ms);
    let mode = data
        .as_ref()
        .and_then(|d| d.get("GameType"))
        .and_then(|t| t.as_i64())
        .unwrap_or(-1);
    let hardcore = data
        .as_ref()
        .and_then(|d| d.get("hardcore"))
        .and_then(|t| t.as_i64())
        .unwrap_or(0)
        == 1;
    let version = data
        .as_ref()
        .and_then(|d| d.get("Version"))
        .and_then(|v| v.get("Name"))
        .and_then(|t| t.as_str())
        .map(String::from);
    let icon = fs::read(dir.join("icon.png"))
        .ok()
        .filter(|b| b.len() < 512 * 1024)
        .map(|b| format!("data:image/png;base64,{}", b64_encode(&b)));
    Some(World {
        name,
        folder,
        path: dir.to_string_lossy().to_string(),
        last_played,
        game_mode: game_mode_label(mode).to_string(),
        hardcore,
        version,
        icon,
        source: source.to_string(),
        source_dir: source_dir.to_string_lossy().to_string(),
    })
}

/// Every directory under `<dir>/saves` that holds a `level.dat`, newest first. `roots` is (label, game directory).
pub fn scan_worlds(roots: &[(String, PathBuf)]) -> Vec<World> {
    let mut out = vec![];
    for (label, root) in roots {
        let Ok(rd) = fs::read_dir(root.join("saves")) else {
            continue;
        };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                if let Some(w) = read_world(&p, label, root) {
                    out.push(w);
                }
            }
        }
    }
    out.sort_by(|a, b| b.last_played.cmp(&a.last_played));
    out
}

/// Make a world that lives in another game directory visible to the instance that is about to launch, without copying it:
/// a directory junction on Windows (no admin rights needed) or a symlink elsewhere. No-op when it is already there.
pub fn link_world(instance_game_dir: &Path, world_dir: &Path) -> Result<()> {
    let folder = world_dir.file_name().context("world has no folder name")?;
    let saves = instance_game_dir.join("saves");
    fs::create_dir_all(&saves)?;
    let dest = saves.join(folder);
    if dest.exists() || world_dir == dest {
        return Ok(());
    }
    #[cfg(windows)]
    {
        let st = std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(&dest)
            .arg(world_dir)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .context("running mklink")?;
        if !st.success() {
            bail!("could not link the world into the instance (mklink failed)");
        }
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(world_dir, &dest).context("linking the world into the instance")?;
    Ok(())
}

// ------------------------------------------------------------------ servers.dat

#[derive(Clone, Debug, Serialize)]
pub struct ServerEntry {
    pub name: String,
    pub ip: String,
    pub icon: Option<String>,
    pub source: String,
}

fn load_servers_root(path: &Path) -> Result<Tag> {
    match fs::read(path) {
        Ok(b) if !b.is_empty() => parse_nbt(&b),
        _ => Ok(Tag::Compound(vec![(
            "servers".into(),
            Tag::List(0, vec![]),
        )])),
    }
}

/// The player's saved multiplayer list (`servers.dat`) from one game directory. Missing file means an empty list.
pub fn read_servers(dir: &Path, source: &str) -> Vec<ServerEntry> {
    let path = dir.join("servers.dat");
    if !path.exists() {
        return vec![];
    }
    let Ok(root) = load_servers_root(&path) else {
        return vec![];
    };
    let Some(Tag::List(_, list)) = root.get("servers") else {
        return vec![];
    };
    list.iter()
        .filter_map(|s| {
            let ip = s.get("ip")?.as_str()?.trim().to_string();
            if ip.is_empty() {
                return None;
            }
            let name = s
                .get("name")
                .and_then(|t| t.as_str())
                .filter(|n| !n.trim().is_empty())
                .unwrap_or(&ip)
                .to_string();
            let icon = s
                .get("icon")
                .and_then(|t| t.as_str())
                .filter(|i| !i.is_empty())
                .map(|i| format!("data:image/png;base64,{i}"));
            Some(ServerEntry {
                name,
                ip,
                icon,
                source: source.to_string(),
            })
        })
        .collect()
}

/// Append a server to `<dir>/servers.dat` (created when missing). Existing entries and their extra fields are kept as they are.
/// Returns false when that address was already saved.
pub fn add_server(dir: &Path, name: &str, ip: &str) -> Result<bool> {
    let (name, ip) = (name.trim(), ip.trim());
    if ip.is_empty() || ip.len() > 255 || ip.chars().any(|c| c.is_whitespace() || c.is_control()) {
        bail!("Enter a server address such as play.example.net or 192.168.1.20:25565.");
    }
    let name = if name.is_empty() { ip } else { name };
    fs::create_dir_all(dir)?;
    let path = dir.join("servers.dat");
    let mut root = load_servers_root(&path)?;
    let Tag::Compound(fields) = &mut root else {
        bail!("servers.dat is not a compound")
    };
    if !fields.iter().any(|(k, _)| k == "servers") {
        fields.push(("servers".into(), Tag::List(0, vec![])));
    }
    for (k, v) in fields.iter_mut() {
        if k == "servers" {
            let Tag::List(id, list) = v else {
                bail!("servers.dat has no server list")
            };
            if list.iter().any(|s| {
                s.get("ip")
                    .and_then(|t| t.as_str())
                    .is_some_and(|x| x.eq_ignore_ascii_case(ip))
            }) {
                return Ok(false);
            }
            *id = 10;
            list.push(Tag::Compound(vec![
                ("ip".into(), Tag::String(ip.into())),
                ("name".into(), Tag::String(name.into())),
            ]));
        }
    }
    if path.exists() {
        let _ = fs::copy(&path, dir.join("servers.dat_old"));
    }
    let tmp = dir.join("servers.dat.luminos-tmp");
    fs::write(&tmp, write_nbt(&root))?;
    fs::rename(&tmp, &path)?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("luminos-worlds-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn gz(b: &[u8]) -> Vec<u8> {
        let mut e = flate2::write::GzEncoder::new(vec![], flate2::Compression::default());
        e.write_all(b).unwrap();
        e.finish().unwrap()
    }

    #[test]
    fn nbt_round_trips() {
        let t = Tag::Compound(vec![
            ("a".into(), Tag::Int(7)),
            ("l".into(), Tag::List(8, vec![Tag::String("x".into())])),
            (
                "c".into(),
                Tag::Compound(vec![
                    ("b".into(), Tag::Byte(1)),
                    ("q".into(), Tag::Long(-5)),
                ]),
            ),
            ("arr".into(), Tag::IntArray(vec![1, 2, 3])),
        ]);
        assert_eq!(parse_nbt(&write_nbt(&t)).unwrap(), t);
        assert_eq!(parse_nbt(&gz(&write_nbt(&t))).unwrap(), t);
    }

    #[test]
    fn garbage_is_an_error_not_a_panic() {
        assert!(parse_nbt(&[]).is_err());
        assert!(parse_nbt(&[10, 0, 0, 9, 0, 1, b'x', 10, 0, 0, 0xff]).is_err());
        assert!(parse_nbt(b"not nbt at all").is_err());
    }

    #[test]
    fn empty_disk_gives_empty_lists() {
        let d = tmp("empty");
        assert!(scan_worlds(&[("mc".into(), d.clone())]).is_empty());
        assert!(read_servers(&d, "mc").is_empty());
        assert!(scan_worlds(&[("mc".into(), d.join("does-not-exist"))]).is_empty());
    }

    #[test]
    fn worlds_are_read_from_level_dat_newest_first() {
        let d = tmp("worlds");
        for (folder, name, played, mode) in [
            ("w1", "Old Base", 1000i64, 0i32),
            ("w2", "New Base", 9000, 1),
        ] {
            let w = d.join("saves").join(folder);
            fs::create_dir_all(&w).unwrap();
            let data = Tag::Compound(vec![(
                "Data".into(),
                Tag::Compound(vec![
                    ("LevelName".into(), Tag::String(name.into())),
                    ("LastPlayed".into(), Tag::Long(played)),
                    ("GameType".into(), Tag::Int(mode)),
                ]),
            )]);
            fs::write(w.join("level.dat"), gz(&write_nbt(&data))).unwrap();
        }
        fs::write(d.join("saves/w2/icon.png"), [0x89, b'P', b'N', b'G']).unwrap();
        fs::create_dir_all(d.join("saves/not-a-world")).unwrap();
        let ws = scan_worlds(&[("mc".into(), d.clone())]);
        assert_eq!(ws.len(), 2);
        assert_eq!(ws[0].name, "New Base");
        assert_eq!(ws[0].game_mode, "Creative");
        assert!(ws[0]
            .icon
            .as_deref()
            .unwrap()
            .starts_with("data:image/png;base64,"));
        assert_eq!(ws[1].folder, "w1");
        assert!(ws[1].icon.is_none());
    }

    #[test]
    fn servers_dat_is_created_appended_and_deduplicated() {
        let d = tmp("servers");
        assert!(add_server(&d, "My Server", "play.example.net").unwrap());
        assert!(add_server(&d, "LAN", "192.168.1.20:25565").unwrap());
        assert!(!add_server(&d, "dupe", "PLAY.example.net").unwrap());
        let s = read_servers(&d, "mc");
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].name, "My Server");
        assert_eq!(s[1].ip, "192.168.1.20:25565");
        assert!(add_server(&d, "x", "bad address").is_err());
    }

    #[test]
    fn existing_server_fields_survive_an_append() {
        let d = tmp("keep");
        let root = Tag::Compound(vec![(
            "servers".into(),
            Tag::List(
                10,
                vec![Tag::Compound(vec![
                    ("ip".into(), Tag::String("a.example".into())),
                    ("name".into(), Tag::String("A".into())),
                    ("acceptTextures".into(), Tag::Byte(1)),
                ])],
            ),
        )]);
        fs::write(d.join("servers.dat"), write_nbt(&root)).unwrap();
        assert!(add_server(&d, "B", "b.example").unwrap());
        let back = parse_nbt(&fs::read(d.join("servers.dat")).unwrap()).unwrap();
        let Some(Tag::List(10, l)) = back.get("servers") else {
            panic!("no list")
        };
        assert_eq!(l.len(), 2);
        assert_eq!(l[0].get("acceptTextures"), Some(&Tag::Byte(1)));
    }

    #[test]
    fn b64_matches_known_vectors() {
        assert_eq!(b64_encode(b"Man"), "TWFu");
        assert_eq!(b64_encode(b"Ma"), "TWE=");
        assert_eq!(b64_encode(b"M"), "TQ==");
    }
}
