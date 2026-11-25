//! `luminos://join?...` invite links.
//!
//! Format: `luminos://join?server=<host[:port]>&version=<mc>&name=<label>`.
//! Links come from strangers, so parsing is strict: only a hostname/IP + port, a version string and a short
//! label are accepted; nothing is ever passed to a shell or used as a path.
use anyhow::{bail, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JoinLink {
    pub server: String,
    pub version: Option<String>,
    pub name: Option<String>,
}

fn pct_decode(s: &str) -> Result<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'%' => {
                let h = s
                    .get(i + 1..i + 3)
                    .ok_or_else(|| anyhow::anyhow!("bad escape"))?;
                out.push(u8::from_str_radix(h, 16)?);
                i += 3;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    Ok(String::from_utf8(out)?)
}

fn pct_encode(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.:".contains(&b) {
            o.push(b as char);
        } else {
            o.push_str(&format!("%{b:02X}"));
        }
    }
    o
}

pub(crate) fn valid_host(addr: &str) -> bool {
    let (host, port) = crate::servers::split_address(addr);
    !host.is_empty()
        && host.len() <= 253
        && port > 0
        && host
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':')
        && !host.starts_with('-')
        && !host.starts_with('.')
}

fn valid_version(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 24
        && v.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_')
}

pub fn parse(link: &str) -> Result<JoinLink> {
    let rest = link
        .trim()
        .strip_prefix("luminos://join?")
        .ok_or_else(|| anyhow::anyhow!("not a luminos://join link"))?;
    let (mut server, mut version, mut name) = (None, None, None);
    for kv in rest.split('&') {
        let Some((k, v)) = kv.split_once('=') else {
            continue;
        };
        let v = pct_decode(v)?;
        match k {
            "server" => server = Some(v),
            "version" => version = Some(v),
            "name" => name = Some(v),
            _ => {}
        }
    }
    let server = server.ok_or_else(|| anyhow::anyhow!("link has no server"))?;
    if !valid_host(&server) {
        bail!("link has an invalid server address");
    }
    if let Some(v) = &version {
        if !valid_version(v) {
            bail!("link has an invalid version");
        }
    }
    if let Some(n) = &name {
        if n.chars().count() > 40 || n.chars().any(|c| c.is_control()) {
            bail!("link has an invalid label");
        }
    }
    Ok(JoinLink {
        server,
        version,
        name,
    })
}

pub fn build(l: &JoinLink) -> String {
    let mut s = format!("luminos://join?server={}", pct_encode(&l.server));
    if let Some(v) = &l.version {
        s.push_str(&format!("&version={}", pct_encode(v)));
    }
    if let Some(n) = &l.name {
        s.push_str(&format!("&name={}", pct_encode(n)));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let l = JoinLink {
            server: "play.example.com:25570".into(),
            version: Some("1.21.4".into()),
            name: Some("Our SMP & friends".into()),
        };
        assert_eq!(parse(&build(&l)).unwrap(), l);
    }

    #[test]
    fn hostile_links_are_rejected() {
        for bad in [
            "luminos://join?server=a b",
            "luminos://join?server=%3B%20rm%20-rf%20%2F",
            "luminos://join?server=../../etc/passwd",
            "luminos://join?server=ok.example.com&version=1.21%3B%20calc",
            "luminos://join?server=ok.example.com&name=%0Aevil",
            "http://join?server=ok.example.com",
            "luminos://join?version=1.21.4",
            "luminos://join?server=-bad.example.com",
        ] {
            assert!(parse(bad).is_err(), "should reject {bad}");
        }
    }

    #[test]
    fn default_port_and_ipv4() {
        assert_eq!(
            parse("luminos://join?server=127.0.0.1").unwrap().server,
            "127.0.0.1"
        );
    }
}
