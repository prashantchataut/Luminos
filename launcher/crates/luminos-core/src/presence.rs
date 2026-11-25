//! Discord Rich Presence: show **Luminos** as the game.
//!
//! * [`build`] turns what the launcher knows into the exact activity JSON Discord receives. The settings page renders the same
//!   function's output (mirrored in `app/src/presence.ts`, locked together by `docs/fixtures/presence-golden.json`).
//! * Privacy is structural: [`PresenceInput`] has no field for a token or an account name, so neither can be sent. A server
//!   address is only used when `share_server` is true; an instance name only when `share_instance_name` is true.
//! * "Playing Luminos": Discord shows the *Discord application's* name. The activity carries `name: "Luminos"` too, but the
//!   application itself must be named Luminos in the Discord Developer Portal, and its Art Assets need the keys `luminos`,
//!   `fabric`, `forge`, `quilt`, `neoforge`. Registering that application needs the owner's Discord account (**UNVERIFIED**,
//!   `docs/DISCORD.md`). The client id comes from `LUMINOS_DISCORD_CLIENT_ID`; with none set, presence stays off.
//! * Transport is Discord's local IPC (named pipe on Windows, unix socket elsewhere). Framing is unit-tested against a fake
//!   Discord socket; **talking to the real Discord client is UNVERIFIED**.
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{Read, Write};

#[derive(Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PresenceInput {
    pub enabled: bool,
    pub instance_name: Option<String>,
    pub loader: Option<String>,
    pub mc_version: Option<String>,
    /// "menus" | "singleplayer" | "multiplayer"
    pub state: String,
    pub server_address: Option<String>,
    pub share_server: bool,
    pub share_instance_name: bool,
    pub started_unix: i64,
}

fn clip(s: &str) -> Option<String> {
    let t: String = s
        .trim()
        .chars()
        .filter(|c| !c.is_control())
        .take(128)
        .collect();
    (t.chars().count() >= 2).then_some(t)
}

fn loader_label(l: &str) -> Option<(&'static str, &'static str)> {
    match l.to_ascii_lowercase().as_str() {
        "fabric" => Some(("fabric", "Fabric")),
        "forge" => Some(("forge", "Forge")),
        "quilt" => Some(("quilt", "Quilt")),
        "neoforge" => Some(("neoforge", "NeoForge")),
        _ => None,
    }
}

/// `None` when presence is switched off (the caller then clears any activity).
pub fn build(i: &PresenceInput) -> Option<Value> {
    if !i.enabled {
        return None;
    }
    let details = i
        .share_instance_name
        .then(|| i.instance_name.as_deref().and_then(clip))
        .flatten()
        .unwrap_or_else(|| "Playing with Luminos".into());
    let state = match i.state.as_str() {
        "singleplayer" => "Singleplayer".to_string(),
        "multiplayer" => i
            .share_server
            .then(|| i.server_address.as_deref().and_then(clip))
            .flatten()
            .unwrap_or_else(|| "Multiplayer".into()),
        _ => "In menus".to_string(),
    };
    let mut assets = json!({ "large_image": "luminos", "large_text": "Luminos" });
    if let Some((key, label)) = i.loader.as_deref().and_then(loader_label) {
        assets["small_image"] = json!(key);
        assets["small_text"] = json!(match i.mc_version.as_deref().and_then(clip) {
            Some(v) => format!("{label} {v}"),
            None => label.to_string(),
        });
    }
    Some(
        json!({ "name": "Luminos", "type": 0, "details": details, "state": state, "timestamps": { "start": i.started_unix }, "assets": assets }),
    )
}

// ---- IPC ---------------------------------------------------------------------------------------------------------------

pub fn encode_frame(op: u32, v: &Value) -> Vec<u8> {
    let body = v.to_string().into_bytes();
    let mut out = Vec::with_capacity(8 + body.len());
    out.extend_from_slice(&op.to_le_bytes());
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
    out.extend_from_slice(&body);
    out
}

pub fn read_frame(r: &mut impl Read) -> Result<(u32, Value)> {
    let mut h = [0u8; 8];
    r.read_exact(&mut h)
        .context("discord closed the connection")?;
    let (op, len) = (
        u32::from_le_bytes([h[0], h[1], h[2], h[3]]),
        u32::from_le_bytes([h[4], h[5], h[6], h[7]]) as usize,
    );
    if len > 1 << 20 {
        bail!("discord sent an oversized frame");
    }
    let mut b = vec![0u8; len];
    r.read_exact(&mut b)?;
    Ok((op, serde_json::from_slice(&b).unwrap_or(Value::Null)))
}

pub struct Client<S: Read + Write> {
    s: S,
    nonce: u64,
}
impl<S: Read + Write> Client<S> {
    pub fn handshake(mut s: S, client_id: &str) -> Result<Self> {
        if client_id.is_empty() || !client_id.chars().all(|c| c.is_ascii_digit()) {
            bail!("no valid Discord application id configured");
        }
        s.write_all(&encode_frame(0, &json!({ "v": 1, "client_id": client_id })))?;
        let (op, v) = read_frame(&mut s)?;
        if op == 2 || v["evt"] == "ERROR" {
            bail!(
                "discord refused the handshake: {}",
                v["data"]["message"].as_str().unwrap_or("unknown")
            );
        }
        Ok(Client { s, nonce: 0 })
    }
    /// `None` clears the activity.
    pub fn set_activity(&mut self, activity: Option<&Value>) -> Result<()> {
        self.nonce += 1;
        let msg = json!({ "cmd": "SET_ACTIVITY", "args": { "pid": std::process::id(), "activity": activity }, "nonce": self.nonce.to_string() });
        self.s.write_all(&encode_frame(1, &msg))?;
        let (_, reply) = read_frame(&mut self.s)?;
        if reply["evt"] == "ERROR" {
            bail!(
                "discord rejected the activity: {}",
                reply["data"]["message"].as_str().unwrap_or("unknown")
            );
        }
        Ok(())
    }
}

#[cfg(unix)]
pub fn connect() -> Result<std::os::unix::net::UnixStream> {
    let base = ["XDG_RUNTIME_DIR", "TMPDIR", "TMP", "TEMP"]
        .iter()
        .find_map(|k| std::env::var(k).ok())
        .unwrap_or_else(|| "/tmp".into());
    for n in 0..10 {
        if let Ok(s) = std::os::unix::net::UnixStream::connect(format!("{base}/discord-ipc-{n}")) {
            return Ok(s);
        }
    }
    bail!("Discord is not running")
}
#[cfg(windows)]
pub fn connect() -> Result<std::fs::File> {
    for n in 0..10 {
        if let Ok(f) = std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(format!(r"\\.\pipe\discord-ipc-{n}"))
        {
            return Ok(f);
        }
    }
    bail!("Discord is not running")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn golden_cases_match() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../../docs/fixtures/presence-golden.json"
        );
        let g: Value =
            serde_json::from_str(&fs::read_to_string(path).expect("golden fixture")).unwrap();
        let cases = g["cases"].as_array().unwrap();
        assert!(cases.len() >= 5);
        for c in cases {
            let input: PresenceInput = serde_json::from_value(c["input"].clone()).unwrap();
            let got = build(&input).unwrap_or(Value::Null);
            assert_eq!(got, c["expected"], "case: {}", c["name"]);
        }
    }

    #[test]
    fn nothing_secret_can_be_in_the_payload() {
        let i = PresenceInput {
            enabled: true,
            instance_name: Some("x1".into()),
            loader: Some("fabric".into()),
            mc_version: Some("1.21".into()),
            state: "multiplayer".into(),
            server_address: Some("203.0.113.9:25565".into()),
            share_server: false,
            share_instance_name: true,
            started_unix: 1,
        };
        let s = build(&i).unwrap().to_string();
        assert!(!s.contains("203.0.113.9"), "server ip leaked: {s}");
        for bad in ["token", "Bearer", "access", "uuid", "username"] {
            assert!(
                !s.to_lowercase().contains(&bad.to_lowercase()),
                "{bad} in {s}"
            );
        }
    }

    #[test]
    fn long_and_control_text_is_clipped_to_discords_limit() {
        let i = PresenceInput {
            enabled: true,
            instance_name: Some(format!("a\nb{}", "x".repeat(300))),
            state: "menus".into(),
            share_instance_name: true,
            ..Default::default()
        };
        let d = build(&i).unwrap()["details"].as_str().unwrap().to_string();
        assert_eq!(d.chars().count(), 128);
        assert!(!d.contains('\n'));
    }

    #[test]
    fn frame_round_trip() {
        let f = encode_frame(1, &json!({"a": 1}));
        assert_eq!(&f[..4], &1u32.to_le_bytes());
        let (op, v) = read_frame(&mut &f[..]).unwrap();
        assert_eq!((op, v["a"].as_i64()), (1, Some(1)));
    }

    #[cfg(unix)]
    #[test]
    fn talks_the_discord_ipc_protocol_to_a_fake_discord() {
        use std::os::unix::net::{UnixListener, UnixStream};
        let dir = std::env::temp_dir().join(format!("luminos-ipc-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let sock = dir.join("discord-ipc-0");
        let l = UnixListener::bind(&sock).unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        let t = std::thread::spawn(move || {
            let (mut c, _) = l.accept().unwrap();
            let (op0, hello) = read_frame(&mut c).unwrap();
            c.write_all(&encode_frame(
                1,
                &json!({"cmd":"DISPATCH","evt":"READY","data":{"v":1}}),
            ))
            .unwrap();
            let (op1, act) = read_frame(&mut c).unwrap();
            c.write_all(&encode_frame(
                1,
                &json!({"cmd":"SET_ACTIVITY","evt":null,"nonce":"1"}),
            ))
            .unwrap();
            let (_, clear) = read_frame(&mut c).unwrap();
            c.write_all(&encode_frame(
                1,
                &json!({"cmd":"SET_ACTIVITY","evt":null,"nonce":"2"}),
            ))
            .unwrap();
            tx.send((op0, hello, op1, act, clear)).unwrap();
        });
        let mut cl = Client::handshake(UnixStream::connect(&sock).unwrap(), "1234567890").unwrap();
        let input = PresenceInput {
            enabled: true,
            instance_name: Some("Main".into()),
            loader: Some("fabric".into()),
            state: "menus".into(),
            share_instance_name: true,
            started_unix: 42,
            ..Default::default()
        };
        cl.set_activity(build(&input).as_ref()).unwrap();
        cl.set_activity(None).unwrap();
        t.join().unwrap();
        let (op0, hello, op1, act, clear) = rx.recv().unwrap();
        assert_eq!(
            (op0, hello["client_id"].as_str(), hello["v"].as_i64()),
            (0, Some("1234567890"), Some(1))
        );
        assert_eq!(op1, 1);
        assert_eq!(act["cmd"], "SET_ACTIVITY");
        assert_eq!(act["args"]["activity"]["name"], "Luminos");
        assert_eq!(act["args"]["activity"]["details"], "Main");
        assert!(act["args"]["pid"].as_u64().unwrap() > 0);
        assert!(clear["args"]["activity"].is_null());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn bad_client_id_is_refused_before_anything_is_written() {
        let mut sink: Vec<u8> = vec![];
        struct W<'a>(&'a mut Vec<u8>);
        impl Read for W<'_> {
            fn read(&mut self, _: &mut [u8]) -> std::io::Result<usize> {
                Ok(0)
            }
        }
        impl Write for W<'_> {
            fn write(&mut self, b: &[u8]) -> std::io::Result<usize> {
                self.0.extend_from_slice(b);
                Ok(b.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        assert!(Client::handshake(W(&mut sink), "").is_err());
        assert!(Client::handshake(W(&mut sink), "12ab").is_err());
        assert!(sink.is_empty());
    }
}
