//! Launcher side of the in-game agent link (the Luminos client's `agent` package, see `docs/LIVE_SWAP.md`).
//!
//! Loopback only: the hub listens on `127.0.0.1:<random>`; the launcher hands the port and a one-time token to the game as
//! `-Dluminos.agent=127.0.0.1:PORT -Dluminos.agent.token=TOKEN`. The agent connects out, authenticates with the token, and
//! then both sides exchange one JSON object per line. Everything the UI shows as progress is an event the agent sent after
//! the real step happened (nothing is timer-driven).
//!
//! Agent -> launcher: `auth`, `hello`, `progress {op, stage, pct, detail}`, `done {op, ok, detail}`, `state`.
//! Launcher -> agent: `toggle_module {op,id,on}`, `set_pack {op,id,on}`, `pause {op,on}`, `snapshot {op}`.
use anyhow::{bail, Context, Result};
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Write},
    net::{Shutdown, TcpListener, TcpStream},
    sync::{Arc, Mutex},
    time::Duration,
};

pub const PROTOCOL: u32 = 1;
const MAX_EVENTS: usize = 1000;
const MAX_LINE: usize = 256 * 1024;

#[derive(Default)]
struct State {
    writer: Option<TcpStream>,
    hello: Option<Value>,
    events: Vec<Value>,
    seq: u64,
    next_op: u64,
}

#[derive(Clone)]
pub struct Hub {
    port: u16,
    token: String,
    st: Arc<Mutex<State>>,
}

static GLOBAL: std::sync::OnceLock<Option<Hub>> = std::sync::OnceLock::new();

/// The launcher-wide hub, started on first use. Its token is registered with the log redactor, so it never reaches a log.
pub fn global() -> Option<&'static Hub> {
    GLOBAL
        .get_or_init(|| {
            let h = Hub::start().ok()?;
            crate::redact::register_secret(&h.token);
            Some(h)
        })
        .as_ref()
}

fn lock(m: &Mutex<State>) -> std::sync::MutexGuard<'_, State> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn random_token() -> String {
    use std::hash::{BuildHasher, Hasher};
    let mut out = String::new();
    for i in 0..4u64 {
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u64(
            i ^ std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos() as u64)
                .unwrap_or(0),
        );
        out.push_str(&format!("{:016x}", h.finish()));
    }
    out
}

impl Hub {
    pub fn start() -> Result<Hub> {
        let l = TcpListener::bind(("127.0.0.1", 0)).context("agent hub: bind loopback")?;
        let hub = Hub {
            port: l.local_addr()?.port(),
            token: random_token(),
            st: Arc::default(),
        };
        let h2 = hub.clone();
        std::thread::spawn(move || {
            for s in l.incoming().flatten() {
                let h3 = h2.clone();
                std::thread::spawn(move || h3.serve(s));
            }
        });
        Ok(hub)
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// JVM arguments that point a game at this hub.
    pub fn jvm_args(&self) -> Vec<String> {
        vec![
            format!("-Dluminos.agent=127.0.0.1:{}", self.port),
            format!("-Dluminos.agent.token={}", self.token),
        ]
    }

    pub fn connected(&self) -> bool {
        lock(&self.st).writer.is_some()
    }

    pub fn hello(&self) -> Option<Value> {
        lock(&self.st).hello.clone()
    }

    fn push_event(&self, mut v: Value) {
        let mut s = lock(&self.st);
        s.seq += 1;
        v["seq"] = json!(s.seq);
        s.events.push(v);
        if s.events.len() > MAX_EVENTS {
            s.events.remove(0);
        }
    }

    fn serve(&self, stream: TcpStream) {
        let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
        let Ok(w) = stream.try_clone() else { return };
        let mut r = BufReader::new(stream);
        let mut line = String::new();
        // Authenticate within 5 s, on the first line, or drop the connection.
        let ok = r
            .read_line(&mut line)
            .ok()
            .and_then(|_| serde_json::from_str::<Value>(&line).ok())
            .is_some_and(|v| {
                v["t"] == "auth"
                    && v["token"].as_str() == Some(self.token.as_str())
                    && v["protocol"].as_u64() == Some(PROTOCOL as u64)
            });
        if !ok {
            let _ = w.shutdown(Shutdown::Both);
            return;
        }
        let _ = r.get_ref().set_read_timeout(None);
        {
            let mut s = lock(&self.st);
            if let Some(old) = s.writer.replace(w) {
                let _ = old.shutdown(Shutdown::Both);
            }
            s.hello = None;
        }
        self.push_event(json!({"t":"connected"}));
        loop {
            line.clear();
            match r.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(n) if n > MAX_LINE => break,
                Ok(_) => {}
            }
            let Ok(v) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            if v["t"] == "hello" {
                lock(&self.st).hello = Some(v.clone());
            }
            self.push_event(v);
        }
        let mut s = lock(&self.st);
        s.writer = None;
        drop(s);
        self.push_event(json!({"t":"disconnected"}));
    }

    /// Send a command; returns its operation id. Errors when no game is connected, so the caller can queue instead.
    pub fn send(&self, mut cmd: Value) -> Result<u64> {
        let mut s = lock(&self.st);
        if s.writer.is_none() {
            bail!("no game is connected");
        }
        let op = s.next_op + 1;
        cmd["op"] = json!(op);
        let mut line = serde_json::to_string(&cmd)?;
        line.push('\n');
        let w = s.writer.as_mut().context("no game is connected")?;
        w.write_all(line.as_bytes()).context("send to game")?;
        s.next_op = op;
        Ok(op)
    }

    /// Events with `seq > since`, and the newest seq.
    pub fn events_since(&self, since: u64) -> (Vec<Value>, u64) {
        let s = lock(&self.st);
        (
            s.events
                .iter()
                .filter(|e| e["seq"].as_u64().unwrap_or(0) > since)
                .cloned()
                .collect(),
            s.seq,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn connect(h: &Hub, token: &str) -> (TcpStream, BufReader<TcpStream>) {
        let mut s = TcpStream::connect(("127.0.0.1", h.port())).unwrap();
        let r = BufReader::new(s.try_clone().unwrap());
        writeln!(
            s,
            "{}",
            json!({"t":"auth","token":token,"protocol":PROTOCOL})
        )
        .unwrap();
        (s, r)
    }
    fn wait(h: &Hub, f: impl Fn(&Hub) -> bool) {
        for _ in 0..200 {
            if f(h) {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("timed out");
    }

    #[test]
    fn rejects_a_wrong_token_and_accepts_the_right_one() {
        let h = Hub::start().unwrap();
        let (_bad, mut r) = connect(&h, "nope");
        let mut l = String::new();
        assert_eq!(r.read_line(&mut l).unwrap_or(0), 0, "connection is dropped");
        assert!(!h.connected());
        assert!(
            h.send(json!({"t":"pause","on":true})).is_err(),
            "no game: caller must queue"
        );
        let tok = h.jvm_args()[1]
            .trim_start_matches("-Dluminos.agent.token=")
            .to_string();
        let (_ok, _r) = connect(&h, &tok);
        wait(&h, |h| h.connected());
    }

    #[test]
    fn commands_go_out_and_real_progress_comes_back() {
        let h = Hub::start().unwrap();
        let tok = h.jvm_args()[1]
            .trim_start_matches("-Dluminos.agent.token=")
            .to_string();
        let (mut s, mut r) = connect(&h, &tok);
        writeln!(
            s,
            "{}",
            json!({"t":"hello","mc":"1.21.11","modules":[{"id":"fps","enabled":true}]})
        )
        .unwrap();
        wait(&h, |h| h.hello().is_some());
        let op = h
            .send(json!({"t":"toggle_module","id":"fps","on":false}))
            .unwrap();
        let mut l = String::new();
        r.read_line(&mut l).unwrap();
        let cmd: Value = serde_json::from_str(&l).unwrap();
        assert_eq!(
            (cmd["t"].as_str(), cmd["op"].as_u64(), cmd["on"].as_bool()),
            (Some("toggle_module"), Some(op), Some(false))
        );
        writeln!(
            s,
            "{}",
            json!({"t":"progress","op":op,"stage":"applying","pct":50})
        )
        .unwrap();
        writeln!(s, "{}", json!({"t":"done","op":op,"ok":true})).unwrap();
        wait(&h, |h| h.events_since(0).0.iter().any(|e| e["t"] == "done"));
        let (ev, newest) = h.events_since(0);
        let stages: Vec<_> = ev.iter().filter_map(|e| e["stage"].as_str()).collect();
        assert_eq!(stages, vec!["applying"]);
        assert!(h.events_since(newest).0.is_empty(), "cursor works");
        drop(s);
        drop(r);
        wait(&h, |h| !h.connected());
    }
}
