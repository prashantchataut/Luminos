//! "Will this server let me in?" — a real Minecraft login handshake, used before joining.
//!
//! We send Handshake(next=login) + Login Start and look only at the **first** server reply:
//! * `Encryption Request` → the server runs `online-mode=true`: it needs a Mojang/Microsoft session
//!   (or an authlib-injector-enabled server that trusts Luminos/Ely.by, which looks identical here).
//! * `Login Success` / `Set Compression` → the server accepts offline accounts.
//! * `Disconnect` → we flatten the reason and classify (whitelist, ban, version, ...).
//!
//! Honest limit: we can *detect* online-mode; we never bypass it.
use anyhow::{bail, Context, Result};
use flate2::read::ZlibDecoder;
use std::{
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    time::Duration,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LoginMode {
    /// Accepted us without Mojang session verification.
    OfflineOk,
    /// Sent an encryption request: requires an authenticated session.
    OnlineRequired,
    Whitelisted,
    Banned,
    /// Client/server version mismatch (carries the server's message).
    VersionMismatch(String),
    /// Server refused for another stated reason.
    Rejected(String),
    /// A proxy asked something we can't answer (e.g. Velocity modern forwarding).
    ProxyForwarding,
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

fn varint_len(mut v: u32) -> usize {
    let mut n = 1;
    while v >= 0x80 {
        v >>= 7;
        n += 1;
    }
    n
}

fn frame(id: u32, body: &[u8]) -> Vec<u8> {
    let mut inner = vec![];
    write_varint(&mut inner, id);
    inner.extend_from_slice(body);
    let mut out = vec![];
    write_varint(&mut out, inner.len() as u32);
    out.extend(inner);
    out
}

fn put_string(out: &mut Vec<u8>, s: &str) {
    write_varint(out, s.len() as u32);
    out.extend_from_slice(s.as_bytes());
}

/// Login Start body for a given protocol number (the layout changed several times).
pub fn login_start_body(protocol: i64, name: &str, uuid: &[u8; 16]) -> Vec<u8> {
    let mut b = vec![];
    put_string(&mut b, name);
    match protocol {
        764.. => b.extend_from_slice(uuid),        // 1.20.2+: name + UUID
        761..=763 => b.push(0),                    // 1.19.3-1.20.1: name + hasUUID(false)
        759..=760 => b.extend_from_slice(&[0, 0]), // 1.19-1.19.2: hasSigData(false) + hasUUID(false)
        _ => {}                                    // <=1.18.2: name only
    }
    b
}

fn read_packet<R: Read>(r: &mut R, compressed: bool) -> Result<(u32, Vec<u8>)> {
    let len = read_varint(r)? as usize;
    if len == 0 || len > 2 * 1024 * 1024 {
        bail!("bad packet length {len}");
    }
    let mut body = vec![0u8; len];
    r.read_exact(&mut body)?;
    let mut cur = &body[..];
    if compressed {
        let data_len = read_varint(&mut cur)? as usize;
        if data_len != 0 {
            if data_len > 8 * 1024 * 1024 {
                bail!("compressed packet too large");
            }
            let mut dec = Vec::with_capacity(data_len);
            ZlibDecoder::new(cur).read_to_end(&mut dec)?;
            let mut c2 = &dec[..];
            let id = read_varint(&mut c2)?;
            return Ok((id, c2.to_vec()));
        }
    }
    let id = read_varint(&mut cur)?;
    Ok((id, cur.to_vec()))
}

/// Turn a server's disconnect reason into a category. Pure, unit-tested.
pub fn classify_disconnect(reason: &str) -> LoginMode {
    let l = reason.to_lowercase();
    if l.contains("whitelist") || l.contains("white-list") || l.contains("not white") {
        LoginMode::Whitelisted
    } else if l.contains("banned") {
        LoginMode::Banned
    } else if l.contains("outdated") || l.contains("incompatible") || l.contains("unsupported") || l.contains("protocol") {
        LoginMode::VersionMismatch(reason.to_string())
    } else if l.contains("failed to verify username") || l.contains("authenticat") || l.contains("invalid session") {
        LoginMode::OnlineRequired
    } else {
        LoginMode::Rejected(reason.to_string())
    }
}

/// Probe `address` (host[:port]) with a throw-away name. `protocol` should come from the server's status ping.
pub fn probe(address: &str, protocol: i64, name: &str) -> Result<LoginMode> {
    let (host, port) = crate::servers::split_address(address);
    let sock = (host.as_str(), port)
        .to_socket_addrs()
        .with_context(|| format!("resolving {host}"))?
        .next()
        .context("no address found")?;
    let mut s = TcpStream::connect_timeout(&sock, Duration::from_secs(5)).context("connecting")?;
    s.set_read_timeout(Some(Duration::from_secs(8)))?;
    s.set_write_timeout(Some(Duration::from_secs(8)))?;

    let mut hs = vec![];
    write_varint(&mut hs, protocol.max(0) as u32);
    put_string(&mut hs, &host);
    hs.extend_from_slice(&port.to_be_bytes());
    write_varint(&mut hs, 2); // next state: login
    s.write_all(&frame(0, &hs))?;
    // A fixed, obviously synthetic UUID: the probe must not impersonate anybody.
    let uuid = *b"LuminosProbe\0\0\0\0";
    s.write_all(&frame(0, &login_start_body(protocol, name, &uuid)))?;

    let mut compressed = false;
    for _ in 0..3 {
        let (id, body) = read_packet(&mut s, compressed)?;
        match id {
            0x00 => {
                // Disconnect(login): JSON chat component as string
                let mut c = &body[..];
                let n = read_varint(&mut c)? as usize;
                let txt = String::from_utf8_lossy(&c[..n.min(c.len())]).to_string();
                let v: serde_json::Value = serde_json::from_str(&txt).unwrap_or(serde_json::Value::String(txt));
                let flat = crate::servers::strip_formatting(&crate::servers::flatten_chat(&v));
                return Ok(classify_disconnect(&flat));
            }
            0x01 => return Ok(LoginMode::OnlineRequired),
            0x02 => return Ok(LoginMode::OfflineOk),
            0x03 => compressed = true, // Set Compression, then expect Login Success
            0x04 => return Ok(LoginMode::ProxyForwarding),
            other => bail!("unexpected login packet {other:#x}"),
        }
    }
    bail!("server never answered the login")
}

/// Plain-language message for the UI. `can_play_online` = the active account has a real session the server could verify.
pub fn explain(mode: &LoginMode, account_is_offline: bool) -> String {
    match mode {
        LoginMode::OfflineOk => "This server accepts offline accounts. You can join.".into(),
        LoginMode::OnlineRequired if account_is_offline => "This server runs in online-mode: it checks every player with Mojang. An offline account can't join it, and Luminos will not try to get around that. Sign in with a Microsoft account, or pick a server that allows offline players.".into(),
        LoginMode::OnlineRequired => "This server verifies players online. Your signed-in account will be checked when you join.".into(),
        LoginMode::Whitelisted => "You're not on this server's whitelist. Ask the owner to add your username.".into(),
        LoginMode::Banned => "This account or IP is banned on this server.".into(),
        LoginMode::VersionMismatch(m) => format!("Version mismatch: {m}. Pick an instance on the server's Minecraft version."),
        LoginMode::Rejected(m) => format!("The server refused the login: {m}"),
        LoginMode::ProxyForwarding => "This server sits behind a proxy that needs forwarded player info, so we can't pre-check it. You can still try to join.".into(),
    }
}

#[allow(dead_code)]
fn _len_helpers_used() -> usize {
    varint_len(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;

    /// Spin a one-shot fake server that reads the handshake+login start, then writes `reply`.
    fn fake(reply: Vec<u8>) -> String {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = l.local_addr().unwrap();
        thread::spawn(move || {
            let (mut c, _) = l.accept().unwrap();
            let mut buf = [0u8; 256];
            let _ = c.read(&mut buf);
            std::thread::sleep(Duration::from_millis(50));
            let _ = c.write_all(&reply);
            std::thread::sleep(Duration::from_millis(100));
        });
        format!("127.0.0.1:{}", addr.port())
    }

    #[test]
    fn online_mode_server_is_detected_from_encryption_request() {
        let mut body = vec![];
        put_string(&mut body, ""); // server id
        write_varint(&mut body, 3);
        body.extend_from_slice(&[1, 2, 3]);
        let addr = fake(frame(0x01, &body));
        assert_eq!(probe(&addr, 769, "Probe").unwrap(), LoginMode::OnlineRequired);
    }

    #[test]
    fn offline_mode_server_with_compression_is_detected() {
        // Set Compression(threshold=256) then Login Success framed with Data Length = 0 (below threshold)
        let mut reply = frame(0x03, &{
            let mut b = vec![];
            write_varint(&mut b, 256);
            b
        });
        let mut ok_inner = vec![];
        write_varint(&mut ok_inner, 0); // data length 0 = uncompressed
        write_varint(&mut ok_inner, 0x02);
        ok_inner.extend_from_slice(&[0u8; 20]);
        let mut pkt = vec![];
        write_varint(&mut pkt, ok_inner.len() as u32);
        pkt.extend(ok_inner);
        reply.extend(pkt);
        let addr = fake(reply);
        assert_eq!(probe(&addr, 769, "Probe").unwrap(), LoginMode::OfflineOk);
    }

    #[test]
    fn whitelist_disconnect_is_classified() {
        let mut body = vec![];
        put_string(&mut body, r#"{"text":"You are not white-listed on this server!"}"#);
        let addr = fake(frame(0x00, &body));
        assert_eq!(probe(&addr, 769, "Probe").unwrap(), LoginMode::Whitelisted);
    }

    #[test]
    fn classify_known_messages() {
        assert_eq!(classify_disconnect("Failed to verify username!"), LoginMode::OnlineRequired);
        assert_eq!(classify_disconnect("You are banned from this server"), LoginMode::Banned);
        assert!(matches!(classify_disconnect("Outdated client! Please use 1.21.4"), LoginMode::VersionMismatch(_)));
        assert!(matches!(classify_disconnect("Maintenance"), LoginMode::Rejected(_)));
    }

    #[test]
    fn login_start_layout_per_protocol() {
        let u = [7u8; 16];
        assert_eq!(login_start_body(769, "ab", &u).len(), 1 + 2 + 16);
        assert_eq!(login_start_body(762, "ab", &u), vec![2, b'a', b'b', 0]);
        assert_eq!(login_start_body(760, "ab", &u), vec![2, b'a', b'b', 0, 0]);
        assert_eq!(login_start_body(758, "ab", &u), vec![2, b'a', b'b']);
    }

    #[test]
    fn explain_never_suggests_bypass() {
        let m = explain(&LoginMode::OnlineRequired, true);
        assert!(m.contains("will not try to get around"));
        assert!(!m.to_lowercase().contains("crack"));
    }
}
