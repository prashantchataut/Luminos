//! Server hub: a saved server list plus a from-scratch Minecraft "Server List Ping" (no extra crates).
//!
//! Protocol (stable since 1.7): Handshake(next=1) → StatusRequest → StatusResponse(JSON) → Ping/Pong.
use crate::{paths, store};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    time::{Duration, Instant},
};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct SavedServer {
    pub name: String,
    /// `host` or `host:port`
    pub address: String,
}

#[derive(Serialize, Deserialize, Default)]
struct ServerFile {
    servers: Vec<SavedServer>,
}

#[derive(Clone, Debug, Default)]
pub struct Status {
    pub motd: String,
    pub online: u32,
    pub max: u32,
    pub version: String,
    pub protocol: i64,
    pub latency_ms: u64,
}

fn file() -> std::path::PathBuf {
    paths::root().join("servers.json")
}

pub fn load() -> Vec<SavedServer> {
    store::read_json::<ServerFile>(&file()).servers
}

pub fn save(list: &[SavedServer]) -> Result<()> {
    store::write_json(
        &file(),
        &ServerFile {
            servers: list.to_vec(),
        },
    )
}

/// Split `host[:port]` (default 25565). IPv6 literals in `[::1]:25565` form are supported.
pub fn split_address(addr: &str) -> (String, u16) {
    let addr = addr.trim();
    if let Some(rest) = addr.strip_prefix('[') {
        if let Some((host, tail)) = rest.split_once(']') {
            let port = tail
                .strip_prefix(':')
                .and_then(|p| p.parse().ok())
                .unwrap_or(25565);
            return (host.to_string(), port);
        }
    }
    match addr.rsplit_once(':') {
        Some((h, p)) if !h.contains(':') => (h.to_string(), p.parse().unwrap_or(25565)),
        _ => (addr.to_string(), 25565),
    }
}

fn write_varint(out: &mut Vec<u8>, mut v: u32) {
    loop {
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            out.push(b);
            break;
        }
        out.push(b | 0x80);
    }
}

fn read_varint<R: Read>(r: &mut R) -> Result<u32> {
    let (mut val, mut shift) = (0u32, 0);
    loop {
        let mut b = [0u8; 1];
        r.read_exact(&mut b)?;
        val |= u32::from(b[0] & 0x7f) << shift;
        if b[0] & 0x80 == 0 {
            return Ok(val);
        }
        shift += 7;
        if shift > 35 {
            bail!("VarInt too long");
        }
    }
}

fn packet(id: u8, body: &[u8]) -> Vec<u8> {
    let mut inner = vec![id];
    inner.extend_from_slice(body);
    let mut out = vec![];
    write_varint(&mut out, inner.len() as u32);
    out.extend(inner);
    out
}

/// Flatten a Minecraft chat component (string, or object with `text` + `extra`) into plain text.
pub fn flatten_chat(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Object(o) => {
            let mut s = o.get("text").map(flatten_chat).unwrap_or_default();
            if let Some(serde_json::Value::Array(extra)) = o.get("extra") {
                for e in extra {
                    s.push_str(&flatten_chat(e));
                }
            }
            s
        }
        serde_json::Value::Array(a) => a.iter().map(flatten_chat).collect(),
        _ => String::new(),
    }
}

/// Strip legacy `§x` formatting codes.
pub fn strip_formatting(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut it = s.chars();
    while let Some(c) = it.next() {
        if c == '§' {
            it.next();
        } else {
            out.push(c);
        }
    }
    out
}

pub fn parse_status(json: &str) -> Result<Status> {
    let v: serde_json::Value = serde_json::from_str(json).context("status JSON")?;
    Ok(Status {
        motd: strip_formatting(&v.get("description").map(flatten_chat).unwrap_or_default())
            .trim()
            .to_string(),
        online: v
            .pointer("/players/online")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        max: v
            .pointer("/players/max")
            .and_then(|x| x.as_u64())
            .unwrap_or(0) as u32,
        version: v
            .pointer("/version/name")
            .and_then(|x| x.as_str())
            .unwrap_or("?")
            .to_string(),
        protocol: v
            .pointer("/version/protocol")
            .and_then(|x| x.as_i64())
            .unwrap_or(0),
        latency_ms: 0,
    })
}

/// Ping a server. Blocking; run it on a worker thread. SRV records are not resolved (yet).
pub fn ping(address: &str) -> Result<Status> {
    let (host, port) = split_address(address);
    let sock = (host.as_str(), port)
        .to_socket_addrs()
        .with_context(|| format!("resolving {host}"))?
        .next()
        .context("no address found")?;
    let mut s = TcpStream::connect_timeout(&sock, Duration::from_secs(5)).context("connecting")?;
    s.set_read_timeout(Some(Duration::from_secs(6)))?;
    s.set_write_timeout(Some(Duration::from_secs(6)))?;

    let mut hs = vec![];
    write_varint(&mut hs, 767); // protocol number only matters for the version check; status works with any
    write_varint(&mut hs, host.len() as u32);
    hs.extend_from_slice(host.as_bytes());
    hs.extend_from_slice(&port.to_be_bytes());
    write_varint(&mut hs, 1);
    s.write_all(&packet(0x00, &hs))?;
    s.write_all(&packet(0x00, &[]))?;

    let _len = read_varint(&mut s)?;
    let id = read_varint(&mut s)?;
    if id != 0 {
        bail!("unexpected packet id {id}");
    }
    let jlen = read_varint(&mut s)? as usize;
    if jlen > 4 * 1024 * 1024 {
        bail!("status response too large");
    }
    let mut buf = vec![0u8; jlen];
    s.read_exact(&mut buf)?;
    let mut status = parse_status(&String::from_utf8_lossy(&buf))?;

    // latency: Ping(0x01, i64) → Pong
    let t = Instant::now();
    s.write_all(&packet(0x01, &0x4c75_6d69_6e6f_7321_i64.to_be_bytes()))?;
    if read_varint(&mut s).is_ok() {
        status.latency_ms = t.elapsed().as_millis() as u64;
    }
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addresses() {
        assert_eq!(
            split_address("mc.example.com"),
            ("mc.example.com".into(), 25565)
        );
        assert_eq!(
            split_address("mc.example.com:25570"),
            ("mc.example.com".into(), 25570)
        );
        assert_eq!(split_address("[::1]:1234"), ("::1".into(), 1234));
    }

    #[test]
    fn varints_roundtrip() {
        for n in [0u32, 1, 127, 128, 255, 25565, 2_097_151, u32::MAX >> 4] {
            let mut b = vec![];
            write_varint(&mut b, n);
            assert_eq!(read_varint(&mut &b[..]).unwrap(), n);
        }
    }

    #[test]
    fn status_json_parses_both_motd_styles() {
        let a = parse_status(r#"{"version":{"name":"1.21.4","protocol":769},"players":{"max":20,"online":3},"description":"§aHello §lWorld"}"#).unwrap();
        assert_eq!((a.motd.as_str(), a.online, a.max), ("Hello World", 3, 20));
        let b = parse_status(r#"{"description":{"text":"A","extra":[{"text":"B"},"C"]},"players":{"max":1,"online":0},"version":{"name":"x","protocol":1}}"#).unwrap();
        assert_eq!(b.motd, "ABC");
    }
}
