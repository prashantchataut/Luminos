//! Quick Play links and shortcuts: `luminos://play?instance=<id>&world=<name>` or `&server=<host[:port]>`.
//! Links come from strangers (a shortcut file, a chat message), so parsing is strict and nothing reaches a shell or a path.
//! This module only builds and parses; registering the `luminos://` scheme with Windows is done by the installer and is
//! **UNVERIFIED** until it has been run on a real desktop (`docs/REAL_DESKTOP_CHECKLIST.md`).
use anyhow::{bail, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Target {
    World(String),
    Server(String),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PlayLink {
    pub instance: String,
    pub target: Target,
}

fn pct_decode(s: &str) -> Result<String> {
    let b = s.as_bytes();
    let (mut out, mut i) = (Vec::new(), 0);
    while i < b.len() {
        match b[i] {
            b'%' if i + 2 < b.len() => {
                let h = std::str::from_utf8(&b[i + 1..i + 3])?;
                out.push(u8::from_str_radix(h, 16)?);
                i += 3;
            }
            b'%' => bail!("bad escape"),
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
pub fn pct_encode(s: &str) -> String {
    s.bytes()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.') {
                (c as char).to_string()
            } else {
                format!("%{c:02X}")
            }
        })
        .collect()
}

fn ok_label(s: &str, max: usize) -> bool {
    !s.is_empty()
        && s.chars().count() <= max
        && !s.chars().any(|c| {
            c.is_control() || matches!(c, '/' | '\\' | ':' | '"' | '<' | '>' | '|' | '?' | '*')
        })
}

impl PlayLink {
    pub fn parse(link: &str) -> Result<PlayLink> {
        let Some(q) = link.strip_prefix("luminos://play?") else {
            bail!("not a luminos://play link")
        };
        let (mut instance, mut world, mut server) = (None, None, None);
        for kv in q.split('&') {
            let Some((k, v)) = kv.split_once('=') else {
                bail!("malformed query")
            };
            let v = pct_decode(v)?;
            match k {
                "instance" => instance = Some(v),
                "world" => world = Some(v),
                "server" => server = Some(v),
                _ => bail!("unknown field {k}"),
            }
        }
        let instance = instance
            .filter(|i| ok_label(i, 64))
            .ok_or_else(|| anyhow::anyhow!("missing or invalid instance"))?;
        let target = match (world, server) {
            (Some(w), None) if ok_label(&w, 255) => Target::World(w),
            (None, Some(s)) if crate::joinlink::valid_host(&s) => Target::Server(s),
            _ => bail!("need exactly one valid world or server"),
        };
        Ok(PlayLink { instance, target })
    }
    pub fn to_link(&self) -> String {
        let t = match &self.target {
            Target::World(w) => format!("world={}", pct_encode(w)),
            Target::Server(s) => format!("server={}", pct_encode(s)),
        };
        format!(
            "luminos://play?instance={}&{}",
            pct_encode(&self.instance),
            t
        )
    }
    /// The `quick_join` string `launch::build_command_ext` takes: `host:port` or `world:<name>`.
    pub fn quick_join(&self) -> String {
        match &self.target {
            Target::World(w) => format!("world:{w}"),
            Target::Server(s) => s.clone(),
        }
    }
    /// Windows Internet Shortcut (`.url`) body. Double-clicking it opens the `luminos://` link; needs no extra crate or COM.
    pub fn url_shortcut(&self, icon_path: Option<&str>) -> String {
        let mut s = format!("[InternetShortcut]\r\nURL={}\r\n", self.to_link());
        if let Some(i) = icon_path.filter(|i| !i.contains(['\r', '\n'])) {
            s.push_str(&format!("IconFile={i}\r\nIconIndex=0\r\n"));
        }
        s
    }
    /// Suggested file name, safe on Windows.
    pub fn shortcut_name(&self) -> String {
        let what = match &self.target {
            Target::World(w) => w.clone(),
            Target::Server(s) => s.clone(),
        };
        let clean: String = format!("{} - {}", self.instance, what)
            .chars()
            .map(|c| if ok_label(&c.to_string(), 1) { c } else { '_' })
            .collect();
        format!("{}.url", clean.chars().take(120).collect::<String>())
    }
}

/// What the launcher should do before launching with this account (auto re-authentication).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AuthAction {
    /// Token is good for the whole launch.
    Go,
    /// Token is about to expire: refresh silently with the stored refresh token.
    Refresh,
    /// Nothing to refresh with (or refresh was refused): ask the user to sign in again, instead of failing at launch.
    SignInAgain,
}
/// `expires_at` is a unix timestamp. A 10 minute margin means the token cannot lapse while the game starts.
pub fn auth_action(
    expires_at: i64,
    now: i64,
    has_refresh_token: bool,
    refresh_was_rejected: bool,
) -> AuthAction {
    if refresh_was_rejected {
        return AuthAction::SignInAgain;
    }
    if expires_at - now > 600 {
        return AuthAction::Go;
    }
    if has_refresh_token {
        AuthAction::Refresh
    } else {
        AuthAction::SignInAgain
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn world_link_round_trips_with_awkward_names() {
        let l = PlayLink {
            instance: "Survival 1.21".into(),
            target: Target::World("Mira's Base & Farm".into()),
        };
        let s = l.to_link();
        assert!(!s.contains(' ') && !s.contains("'"), "{s}");
        assert_eq!(PlayLink::parse(&s).unwrap(), l);
        assert_eq!(l.quick_join(), "world:Mira's Base & Farm");
    }
    #[test]
    fn server_link_and_shortcut_file() {
        let l = PlayLink::parse("luminos://play?instance=main&server=play.example.net%3A25566")
            .unwrap();
        assert_eq!(l.target, Target::Server("play.example.net:25566".into()));
        let u = l.url_shortcut(Some("C:\\Luminos\\icon.ico"));
        assert!(u.starts_with("[InternetShortcut]\r\nURL=luminos://play?instance=main&server=play.example.net%3A25566"), "{u}");
        assert_eq!(l.shortcut_name(), "main - play.example.net_25566.url");
    }
    #[test]
    fn hostile_links_are_rejected() {
        for bad in [
            "luminos://play?instance=main",
            "luminos://play?instance=../x&world=a",
            "luminos://play?instance=m&world=a&server=b.c",
            "luminos://play?instance=m&world=a%2F..%2Fb",
            "luminos://play?instance=m&cmd=calc",
            "luminos://play?instance=m&world=%ZZ",
            "luminos2://play?instance=m&world=a",
            "luminos://play?instance=m&world=%0Aevil",
            "luminos://play?instance=m&server=a.b%20--exec",
        ] {
            assert!(PlayLink::parse(bad).is_err(), "should reject {bad}");
        }
    }
    #[test]
    fn reauth_decisions() {
        assert_eq!(auth_action(10_000, 1_000, true, false), AuthAction::Go);
        assert_eq!(auth_action(1_300, 1_000, true, false), AuthAction::Refresh);
        assert_eq!(auth_action(500, 1_000, true, false), AuthAction::Refresh);
        assert_eq!(
            auth_action(500, 1_000, false, false),
            AuthAction::SignInAgain
        );
        assert_eq!(
            auth_action(10_000, 1_000, true, true),
            AuthAction::SignInAgain
        );
    }
}
