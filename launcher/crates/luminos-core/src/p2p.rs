//! Local half of P2P hosting (XMCL-style host-star, see `docs/P2P.md`): the WebRTC data channel lives in the webview
//! (`app/src/p2p/`); this module is the local TCP bridge that gives the data channel something to talk to.
//!
//! * Guest: [`Bridge::listen`] opens `127.0.0.1:<port>`; the guest adds `localhost:<port>` in Minecraft. Every accepted
//!   connection gets an id; bytes read from it go to `on_data`, bytes for it arrive through [`Bridge::write`].
//! * Host: [`Bridge::dial`] connects to the host's own LAN world port, one TCP connection per guest connection.
//!
//! The bridge never listens on anything but loopback.
use anyhow::{Context, Result};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Mutex,
    },
};

type DataCb = Arc<dyn Fn(u32, Vec<u8>) + Send + Sync>;
type IdCb = Arc<dyn Fn(u32) + Send + Sync>;

const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

pub fn new_room_code() -> String {
    use std::hash::{BuildHasher, Hasher};
    (0..6)
        .map(|i| {
            let mut h = std::collections::hash_map::RandomState::new().build_hasher();
            h.write_u32(i);
            ALPHABET[(h.finish() % ALPHABET.len() as u64) as usize] as char
        })
        .collect()
}

pub fn valid_room_code(s: &str) -> bool {
    s.len() == 6 && s.bytes().all(|b| ALPHABET.contains(&b))
}

pub struct Bridge {
    conns: Mutex<HashMap<u32, TcpStream>>,
    next: AtomicU32,
    on_data: DataCb,
    on_close: IdCb,
}

impl Bridge {
    pub fn new(on_data: DataCb, on_close: IdCb) -> Arc<Bridge> {
        Arc::new(Bridge { conns: Mutex::default(), next: AtomicU32::new(1), on_data, on_close })
    }

    fn adopt(self: &Arc<Self>, s: TcpStream) -> Result<u32> {
        let _ = s.set_nodelay(true);
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let mut r = s.try_clone()?;
        self.conns.lock().unwrap_or_else(|e| e.into_inner()).insert(id, s);
        let me = self.clone();
        std::thread::spawn(move || {
            let mut buf = vec![0u8; 16 * 1024];
            loop {
                match r.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => (me.on_data)(id, buf[..n].to_vec()),
                }
            }
            if me.conns.lock().unwrap_or_else(|e| e.into_inner()).remove(&id).is_some() {
                (me.on_close)(id);
            }
        });
        Ok(id)
    }

    /// Guest side. Returns the loopback port.
    pub fn listen(self: &Arc<Self>, on_open: IdCb) -> Result<u16> {
        let l = TcpListener::bind(("127.0.0.1", 0)).context("p2p: bind loopback")?;
        let port = l.local_addr()?.port();
        let me = self.clone();
        std::thread::spawn(move || {
            for s in l.incoming().flatten() {
                if let Ok(id) = me.adopt(s) {
                    on_open(id);
                }
            }
        });
        Ok(port)
    }

    /// Host side: connect to the local LAN world.
    pub fn dial(self: &Arc<Self>, port: u16) -> Result<u32> {
        let s = TcpStream::connect(("127.0.0.1", port))
            .with_context(|| format!("p2p: nothing is listening on 127.0.0.1:{port} (open the world to LAN first)"))?;
        self.adopt(s)
    }

    pub fn write(&self, id: u32, bytes: &[u8]) -> Result<()> {
        let mut g = self.conns.lock().unwrap_or_else(|e| e.into_inner());
        let s = g.get_mut(&id).context("connection closed")?;
        s.write_all(bytes).context("write to local socket")
    }

    pub fn close(&self, id: u32) {
        if let Some(s) = self.conns.lock().unwrap_or_else(|e| e.into_inner()).remove(&id) {
            let _ = s.shutdown(Shutdown::Both);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    #[test]
    fn room_codes_are_six_unambiguous_characters() {
        for _ in 0..50 {
            assert!(valid_room_code(&new_room_code()));
        }
        assert!(!valid_room_code("ABC0EF") && !valid_room_code("abcdef") && !valid_room_code("ABCDE"));
    }

    /// guest socket -> guest bridge -> (stands in for the data channel) -> host bridge -> LAN world (an echo server).
    #[test]
    fn bytes_cross_the_bridge_both_ways() {
        let lan = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let lan_port = lan.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for mut s in lan.incoming().flatten() {
                std::thread::spawn(move || {
                    let mut b = [0u8; 1024];
                    while let Ok(n) = s.read(&mut b) {
                        if n == 0 || s.write_all(&b[..n]).is_err() {
                            break;
                        }
                    }
                });
            }
        });
        let (g2h, h_rx) = mpsc::channel::<(u32, Vec<u8>)>();
        let (h2g, g_rx) = mpsc::channel::<(u32, Vec<u8>)>();
        let (g2h, h2g) = (Mutex::new(g2h), Mutex::new(h2g));
        let guest = Bridge::new(Arc::new(move |id, d| { let _ = g2h.lock().unwrap().send((id, d)); }), Arc::new(|_| {}));
        let host = Bridge::new(Arc::new(move |id, d| { let _ = h2g.lock().unwrap().send((id, d)); }), Arc::new(|_| {}));
        let port = guest.listen(Arc::new(|_| {})).unwrap();
        let mut mc = TcpStream::connect(("127.0.0.1", port)).unwrap();
        mc.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
        mc.write_all(b"hello lan").unwrap();
        let (gid, data) = h_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        let hid = host.dial(lan_port).unwrap();
        host.write(hid, &data).unwrap();
        let (_, echoed) = g_rx.recv_timeout(Duration::from_secs(5)).unwrap();
        guest.write(gid, &echoed).unwrap();
        let mut got = [0u8; 9];
        mc.read_exact(&mut got).unwrap();
        assert_eq!(&got, b"hello lan");
        assert!(host.dial(1).is_err(), "no LAN world open: clear error, not a hang");
    }
}
