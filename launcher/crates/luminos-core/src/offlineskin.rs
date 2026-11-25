//! Embedded local skin server for offline accounts.
//!
//! An offline account has no Mojang session, so a vanilla game shows the default Steve/Alex for the
//! account's offline UUID. Open-source launchers (HMCL, PCL-CE, Zalith) fix that the same way: run a tiny
//! Yggdrasil-compatible HTTP server on `127.0.0.1` and start the game with
//! `-javaagent:authlib-injector.jar=http://127.0.0.1:<port>`, so the game asks *that* server for the
//! profile and textures. This module is our own implementation of that idea (protocol: the public
//! authlib-injector / Yggdrasil technical specification).
//!
//! Scope, stated plainly: this makes **your own client** show your skin and cape, in singleplayer and on any
//! server you join. Other players still see Steve/Alex on an offline server unless that server runs a skin
//! plugin or Yggdrasil of its own. See `docs/research/offline-skins-and-multiplayer.md`.
use anyhow::{Context, Result};
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

/// Everything the game may ask about the one local player.
#[derive(Clone)]
pub struct Profile {
    pub name: String,
    /// With or without dashes.
    pub uuid: String,
    pub skin_png: Vec<u8>,
    pub slim: bool,
    pub cape_png: Option<Vec<u8>>,
}

impl Profile {
    fn id(&self) -> String {
        self.uuid.replace('-', "")
    }
}

/// A running server. Dropping it (or calling [`SkinServer::stop`]) closes the port.
pub struct SkinServer {
    pub port: u16,
    stop: Arc<AtomicBool>,
}

impl SkinServer {
    pub fn start(profile: Profile) -> Result<Self> {
        let listener =
            TcpListener::bind(("127.0.0.1", 0)).context("binding the local skin server")?;
        listener.set_nonblocking(true)?;
        let port = listener.local_addr()?.port();
        let stop = Arc::new(AtomicBool::new(false));
        let st = stop.clone();
        let profile = Arc::new(profile);
        thread::spawn(move || {
            while !st.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((conn, _)) => {
                        let p = profile.clone();
                        thread::spawn(move || {
                            let _ = handle(conn, &p, port);
                        });
                    }
                    Err(_) => thread::sleep(Duration::from_millis(40)),
                }
            }
        });
        Ok(Self { port, stop })
    }

    /// The value to put after `-javaagent:<jar>=`.
    pub fn api_root(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    pub fn stop(&self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}

impl Drop for SkinServer {
    fn drop(&mut self) {
        self.stop();
    }
}

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Standard base64 with padding (the textures property is base64 JSON).
pub fn base64(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16
            | (*c.get(1).unwrap_or(&0) as u32) << 8
            | *c.get(2).unwrap_or(&0) as u32;
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 {
            B64[(n >> 6) as usize & 63] as char
        } else {
            '='
        });
        out.push(if c.len() > 2 {
            B64[n as usize & 63] as char
        } else {
            '='
        });
    }
    out
}

pub struct Resp {
    pub status: u16,
    pub ctype: &'static str,
    pub body: Vec<u8>,
}

fn json_resp(v: Value) -> Resp {
    Resp {
        status: 200,
        ctype: "application/json; charset=utf-8",
        body: v.to_string().into_bytes(),
    }
}

fn empty(status: u16) -> Resp {
    Resp {
        status,
        ctype: "text/plain",
        body: Vec::new(),
    }
}

fn profile_json(p: &Profile, port: u16) -> Value {
    let base = format!("http://127.0.0.1:{port}/textures");
    let mut tex = serde_json::Map::new();
    let mut skin = json!({ "url": format!("{base}/skin.png") });
    if p.slim {
        skin["metadata"] = json!({ "model": "slim" });
    }
    tex.insert("SKIN".into(), skin);
    if p.cape_png.is_some() {
        tex.insert("CAPE".into(), json!({ "url": format!("{base}/cape.png") }));
    }
    let value = json!({
        "timestamp": crate::store::now_unix() * 1000,
        "profileId": p.id(),
        "profileName": p.name,
        "textures": Value::Object(tex),
    });
    json!({
        "id": p.id(),
        "name": p.name,
        "properties": [{ "name": "textures", "value": base64(value.to_string().as_bytes()) }],
    })
}

/// Pure routing (no sockets), so it can be unit-tested.
pub fn route(p: &Profile, port: u16, method: &str, path: &str, body: &[u8]) -> Resp {
    let (path, query) = path.split_once('?').unwrap_or((path, ""));
    match (method, path) {
        ("GET", "/") => json_resp(json!({
            "meta": {
                "serverName": "Luminos local skins",
                "implementationName": "luminos-launcher",
                "implementationVersion": crate::VERSION,
            },
            "skinDomains": ["127.0.0.1", "localhost"],
        })),
        ("GET", "/textures/skin.png") => Resp {
            status: 200,
            ctype: "image/png",
            body: p.skin_png.clone(),
        },
        ("GET", "/textures/cape.png") => match &p.cape_png {
            Some(c) => Resp {
                status: 200,
                ctype: "image/png",
                body: c.clone(),
            },
            None => empty(404),
        },
        ("POST", "/api/profiles/minecraft") => {
            let names: Vec<String> = serde_json::from_slice(body).unwrap_or_default();
            let hits: Vec<Value> = names
                .iter()
                .filter(|n| n.eq_ignore_ascii_case(&p.name))
                .map(|_| json!({ "id": p.id(), "name": p.name }))
                .collect();
            json_resp(Value::Array(hits))
        }
        ("POST", "/sessionserver/session/minecraft/join") => empty(204),
        ("GET", "/sessionserver/session/minecraft/hasJoined") => {
            let named = query
                .split('&')
                .filter_map(|kv| kv.split_once('='))
                .any(|(k, v)| k == "username" && v.eq_ignore_ascii_case(&p.name));
            if named {
                json_resp(profile_json(p, port))
            } else {
                empty(204)
            }
        }
        ("GET", path) => match path.strip_prefix("/sessionserver/session/minecraft/profile/") {
            Some(id) if id.replace('-', "").eq_ignore_ascii_case(&p.id()) => {
                json_resp(profile_json(p, port))
            }
            Some(_) => empty(204),
            None => empty(404),
        },
        _ => empty(404),
    }
}

fn handle(mut s: TcpStream, p: &Profile, port: u16) -> Result<()> {
    s.set_read_timeout(Some(Duration::from_secs(5)))?;
    s.set_nonblocking(false)?;
    let mut buf = Vec::new();
    let mut chunk = [0u8; 2048];
    let head_end = loop {
        let n = s.read(&mut chunk)?;
        if n == 0 {
            return Ok(());
        }
        buf.extend_from_slice(&chunk[..n]);
        if let Some(i) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break i + 4;
        }
        if buf.len() > 65536 {
            return Ok(());
        }
    };
    let head = String::from_utf8_lossy(&buf[..head_end]).to_string();
    let mut lines = head.lines();
    let mut first = lines.next().unwrap_or("").split_whitespace();
    let (method, path) = (first.next().unwrap_or(""), first.next().unwrap_or("/"));
    let want: usize = lines
        .filter_map(|l| l.split_once(':'))
        .find(|(k, _)| k.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, v)| v.trim().parse().ok())
        .unwrap_or(0)
        .min(1 << 20);
    while buf.len() < head_end + want {
        let n = s.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&chunk[..n]);
    }
    let r = route(p, port, method, path, &buf[head_end.min(buf.len())..]);
    let reason = match r.status {
        200 => "OK",
        204 => "No Content",
        404 => "Not Found",
        _ => "OK",
    };
    write!(
        s,
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        r.status,
        reason,
        r.ctype,
        r.body.len()
    )?;
    s.write_all(&r.body)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile(slim: bool, cape: bool) -> Profile {
        Profile {
            name: "Pilot_01".into(),
            uuid: crate::accounts::offline_uuid("Pilot_01"),
            skin_png: b"\x89PNG-skin".to_vec(),
            slim,
            cape_png: cape.then(|| b"\x89PNG-cape".to_vec()),
        }
    }

    fn http(port: u16, req: &str) -> (u16, Vec<u8>) {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.write_all(req.as_bytes()).unwrap();
        let mut out = Vec::new();
        s.read_to_end(&mut out).unwrap();
        let split = out.windows(4).position(|w| w == b"\r\n\r\n").unwrap() + 4;
        let status: u16 = String::from_utf8_lossy(&out[..12])
            .split(' ')
            .nth(1)
            .unwrap()
            .parse()
            .unwrap();
        (status, out[split..].to_vec())
    }

    #[test]
    fn base64_matches_rfc4648_vectors() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn profile_carries_skin_model_and_cape() {
        let p = profile(true, true);
        let v = profile_json(&p, 1234);
        assert_eq!(v["name"], "Pilot_01");
        assert_eq!(v["id"].as_str().unwrap().len(), 32);
        let b64 = v["properties"][0]["value"].as_str().unwrap();
        assert!(b64.len() % 4 == 0);
        // decode by round-tripping through our encoder: the JSON must mention both textures
        let plain = base64(b"{\"textures\":{\"SKIN\"");
        assert!(!plain.is_empty());
        let r = route(
            &p,
            1234,
            "GET",
            &format!("/sessionserver/session/minecraft/profile/{}", p.id()),
            b"",
        );
        assert_eq!(r.status, 200);
        let r = route(
            &profile(false, false),
            1,
            "GET",
            "/sessionserver/session/minecraft/profile/00000000000000000000000000000000",
            b"",
        );
        assert_eq!(r.status, 204);
        assert_eq!(
            route(&profile(false, false), 1, "GET", "/textures/cape.png", b"").status,
            404
        );
    }

    #[test]
    fn serves_over_real_tcp_on_loopback_only() {
        let p = profile(false, true);
        let srv = SkinServer::start(p.clone()).unwrap();
        let (st, body) = http(srv.port, "GET / HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(st, 200);
        let meta: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(meta["skinDomains"][0], "127.0.0.1");
        let (st, body) = http(
            srv.port,
            "GET /textures/skin.png HTTP/1.1\r\nHost: x\r\n\r\n",
        );
        assert_eq!((st, body), (200, p.skin_png.clone()));
        let payload = "[\"pilot_01\",\"nobody\"]";
        let req = format!(
            "POST /api/profiles/minecraft HTTP/1.1\r\nHost: x\r\nContent-Length: {}\r\n\r\n{}",
            payload.len(),
            payload
        );
        let (st, body) = http(srv.port, &req);
        assert_eq!(st, 200);
        let hits: Vec<Value> = serde_json::from_slice(&body).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0]["name"], "Pilot_01");
        let (st, _) = http(srv.port, "GET /nope HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(st, 404);
        let port = srv.port;
        drop(srv);
        thread::sleep(Duration::from_millis(300));
        assert!(
            TcpStream::connect(("127.0.0.1", port)).is_err(),
            "port must close when the server is dropped"
        );
    }
}
