//! Network audit: the single list of every host Luminos may talk to, why, and whether the user
//! has switched it off.
//!
//! * `http.rs` calls [`check`] before **every hop** (redirects included), so a host that is not in
//!   [`REGISTRY`] is refused at runtime, and a host the user disabled is refused too.
//! * The UI ("Network activity") renders the registry, the toggles and the live [`activity`] log.
//! * The website's /privacy page is generated from [`registry_json`] (see `examples/hosts_json.rs`),
//!   so the page cannot drift from what the code does.
//! * There is deliberately **no** analytics, advertising or telemetry host. A test enforces that
//!   the registry never contains one.
use anyhow::{bail, Result};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashSet},
    sync::{Mutex, OnceLock, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Category {
    /// Needed to download and start Minecraft.
    Game,
    /// Mod and modpack search / downloads.
    Content,
    /// Signing in.
    Accounts,
    /// Skin lookups the user asks for.
    Skins,
    /// News and Luminos' own update / directory files.
    Luminos,
}

impl Category {
    pub fn label(self) -> &'static str {
        match self {
            Category::Game => "Game files",
            Category::Content => "Mods & packs",
            Category::Accounts => "Sign-in",
            Category::Skins => "Skins",
            Category::Luminos => "News & updates",
        }
    }
}

#[derive(Serialize, Clone, Copy, Debug)]
pub struct HostRule {
    /// Exact host (`api.modrinth.com`) or suffix wildcard (`*.modrinth.com`).
    pub host: &'static str,
    /// Plain-language reason, shown in the app and on the website.
    pub purpose: &'static str,
    pub category: Category,
    /// Turning this off means Minecraft cannot be downloaded or started.
    pub required_to_play: bool,
    /// What Luminos sends to this host, stated exactly.
    pub sends: &'static str,
}

const PLAIN: &str = "A normal HTTPS request: your IP address and Luminos' user-agent. No account, hardware or usage data.";

const fn rule(
    host: &'static str,
    purpose: &'static str,
    category: Category,
    required_to_play: bool,
    sends: &'static str,
) -> HostRule {
    HostRule {
        host,
        purpose,
        category,
        required_to_play,
        sends,
    }
}

/// Every host Luminos may contact. Add a host here *and* justify it, or the request is refused.
pub const REGISTRY: &[HostRule] = &[
    rule("piston-meta.mojang.com", "Minecraft version list and per-version metadata", Category::Game, true, PLAIN),
    rule("piston-data.mojang.com", "Minecraft client and server jars", Category::Game, true, PLAIN),
    rule("launchermeta.mojang.com", "Legacy Minecraft version metadata", Category::Game, true, PLAIN),
    rule("launcher.mojang.com", "Legacy Minecraft jar downloads", Category::Game, true, PLAIN),
    rule("libraries.minecraft.net", "Minecraft libraries (LWJGL, Netty, ...)", Category::Game, true, PLAIN),
    rule("resources.download.minecraft.net", "Minecraft sounds, language files and other assets", Category::Game, true, PLAIN),
    rule("launchercontent.mojang.com", "Patch notes shown on the Home page", Category::Luminos, false, PLAIN),
    rule("meta.fabricmc.net", "Fabric loader versions", Category::Game, false, PLAIN),
    rule("maven.fabricmc.net", "Fabric loader libraries", Category::Game, false, PLAIN),
    rule("meta.quiltmc.org", "Quilt loader versions", Category::Game, false, PLAIN),
    rule("maven.quiltmc.org", "Quilt loader libraries", Category::Game, false, PLAIN),
    rule("api.adoptium.net", "Finds the right Java runtime when none is installed (redirects to GitHub)", Category::Game, false, PLAIN),
    rule("api.github.com", "Checks whether a newer Luminos release exists (one request on start; switch it off here or in Settings)", Category::Luminos, false, PLAIN),
    rule("github.com", "Java runtime download, authlib-injector, Luminos Client releases", Category::Game, false, PLAIN),
    rule("objects.githubusercontent.com", "GitHub's file CDN for the downloads above", Category::Game, false, PLAIN),
    rule("release-assets.githubusercontent.com", "GitHub's release-asset CDN for the downloads above", Category::Game, false, PLAIN),
    rule("raw.githubusercontent.com", "Luminos' own server directory and client compatibility list", Category::Luminos, false, PLAIN),
    rule("*.modrinth.com", "Mod search, project pages, hash lookups, mod downloads and icons (api / cdn)", Category::Content, false, "Search text you type, project ids, and SHA-1/SHA-512 hashes of mod files you have installed (to find updates)."),
    rule("login.microsoftonline.com", "Microsoft device-code sign-in", Category::Accounts, false, "Only when you add a Microsoft account: the sign-in handshake. Luminos never sees your password."),
    rule("user.auth.xboxlive.com", "Xbox Live token step of Microsoft sign-in", Category::Accounts, false, "Sign-in tokens for the account you add."),
    rule("xsts.auth.xboxlive.com", "XSTS token step of Microsoft sign-in", Category::Accounts, false, "Sign-in tokens for the account you add."),
    rule("api.minecraftservices.com", "Minecraft profile for Microsoft accounts, and the \"is this name premium?\" check when you type a username", Category::Accounts, false, "Your Minecraft access token (Microsoft accounts only), or the username you typed."),
    rule("api.mojang.com", "Look up a player's UUID when you copy their skin by name", Category::Skins, false, "The username you typed."),
    rule("sessionserver.mojang.com", "Read that player's current skin address", Category::Skins, false, "The UUID of the player you looked up."),
    rule("textures.minecraft.net", "Download the skin PNG you chose to copy", Category::Skins, false, "Nothing about you."),
    rule("authserver.ely.by", "Ely.by sign-in (authlib-injector)", Category::Accounts, false, "Only when you add an Ely.by account: the username and password you type, sent over HTTPS to Ely.by."),
    rule("minotar.net", "Fetch a skin by username when you import one", Category::Skins, false, "The username you typed."),
    rule("mc-heads.net", "Fallback skin lookup by username", Category::Skins, false, "The username you typed."),
];

#[derive(Clone, Debug, Serialize)]
pub struct Activity {
    pub host: String,
    pub requests: u64,
    pub blocked: u64,
    pub last_unix: i64,
    /// A server the user typed in themselves (custom auth server).
    pub user_configured: bool,
}

fn policy() -> &'static RwLock<HashSet<String>> {
    static P: OnceLock<RwLock<HashSet<String>>> = OnceLock::new();
    P.get_or_init(|| RwLock::new(HashSet::new()))
}

fn log() -> &'static Mutex<BTreeMap<String, Activity>> {
    static L: OnceLock<Mutex<BTreeMap<String, Activity>>> = OnceLock::new();
    L.get_or_init(|| Mutex::new(BTreeMap::new()))
}

/// Replace the set of hosts the user switched off (registry `host` strings, e.g. `*.modrinth.com`).
pub fn set_disabled(hosts: &[String]) {
    if let Ok(mut p) = policy().write() {
        *p = hosts.iter().cloned().collect();
    }
}

pub fn is_disabled(rule_host: &str) -> bool {
    policy()
        .read()
        .map(|p| p.contains(rule_host))
        .unwrap_or(false)
}

/// Extract the lower-cased host of an http(s) URL without pulling in a URL crate.
pub fn host_of(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let authority = rest.split(['/', '?', '#']).next()?;
    let authority = authority.rsplit('@').next()?;
    let host = if let Some(stripped) = authority.strip_prefix('[') {
        stripped.split(']').next()?
    } else {
        authority.split(':').next()?
    };
    if host.is_empty() {
        None
    } else {
        Some(host.to_ascii_lowercase())
    }
}

pub fn is_loopback(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

/// Registry entry covering `host`, if any.
pub fn lookup(host: &str) -> Option<&'static HostRule> {
    REGISTRY.iter().find(|r| match r.host.strip_prefix("*.") {
        Some(suffix) => host.len() > suffix.len() + 1 && host.ends_with(&format!(".{suffix}")),
        None => r.host == host,
    })
}

fn touch(key: &str, blocked: bool, user: bool) {
    if let Ok(mut l) = log().lock() {
        let e = l.entry(key.to_string()).or_insert_with(|| Activity {
            host: key.to_string(),
            requests: 0,
            blocked: 0,
            last_unix: 0,
            user_configured: user,
        });
        if blocked {
            e.blocked += 1;
        } else {
            e.requests += 1;
        }
        e.last_unix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
    }
}

/// Gate for every outbound request. `Ok` means the request may be sent.
pub fn check(url: &str) -> Result<()> {
    let Some(host) = host_of(url) else {
        bail!("refusing request: `{url}` is not an http(s) URL");
    };
    if is_loopback(&host) {
        return Ok(()); // never leaves the machine
    }
    if url.starts_with("http://") {
        touch(&host, true, false);
        bail!("refusing plain-HTTP request to {host}: Luminos only talks HTTPS");
    }
    let Some(rule) = lookup(&host) else {
        touch(&host, true, false);
        bail!("blocked: {host} is not on Luminos' network list (Settings > Network activity)");
    };
    if is_disabled(rule.host) {
        touch(&host, true, false);
        bail!(
            "blocked: you turned off {} ({}) in Network activity",
            rule.host,
            rule.purpose
        );
    }
    touch(&host, false, false);
    Ok(())
}

/// Gate for an endpoint the user typed in (custom auth server). Any HTTPS host is allowed, but it
/// is recorded and labelled as user-configured. Plain HTTP is allowed only on private/LAN hosts.
pub fn check_user_configured(url: &str) -> Result<()> {
    let Some(host) = host_of(url) else {
        bail!("`{url}` is not an http(s) URL");
    };
    if is_loopback(&host) {
        return Ok(());
    }
    if url.starts_with("http://") && !is_private_host(&host) {
        touch(&host, true, true);
        bail!(
            "refusing plain-HTTP to {host}: use https:// (plain HTTP is only allowed on your LAN)"
        );
    }
    touch(&host, false, true);
    Ok(())
}

fn is_private_host(host: &str) -> bool {
    host.starts_with("192.168.")
        || host.starts_with("10.")
        || host.ends_with(".local")
        || host
            .strip_prefix("172.")
            .and_then(|r| r.split('.').next()?.parse::<u8>().ok())
            .is_some_and(|n| (16..=31).contains(&n))
}

/// Snapshot of what this session has contacted (for the UI and the traffic test).
pub fn activity() -> Vec<Activity> {
    log()
        .lock()
        .map(|l| l.values().cloned().collect())
        .unwrap_or_default()
}

pub fn clear_activity() {
    if let Ok(mut l) = log().lock() {
        l.clear();
    }
}

/// The registry as pretty JSON: the single source for the website's /privacy page.
pub fn registry_json() -> String {
    #[derive(Serialize)]
    struct Out<'a> {
        generated_by: &'a str,
        analytics: &'a str,
        ads: &'a str,
        hosts: Vec<Row>,
    }
    #[derive(Serialize)]
    struct Row {
        #[serde(flatten)]
        rule: HostRule,
        category_label: &'static str,
    }
    let out = Out {
        generated_by:
            "luminos-core/src/netaudit.rs (cargo run -p luminos-core --example hosts_json)",
        analytics: "none: Luminos contains no analytics or telemetry code and no host for it",
        ads: "none",
        hosts: REGISTRY
            .iter()
            .map(|r| Row {
                rule: *r,
                category_label: r.category.label(),
            })
            .collect(),
    };
    serde_json::to_string_pretty(&out).unwrap_or_default() + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_parsing() {
        assert_eq!(
            host_of("https://API.Modrinth.com/v2/x?a=b").as_deref(),
            Some("api.modrinth.com")
        );
        assert_eq!(
            host_of("https://user:pw@example.org:8443/p").as_deref(),
            Some("example.org")
        );
        assert_eq!(host_of("http://[::1]:25565/").as_deref(), Some("::1"));
        assert_eq!(host_of("ftp://x/y"), None);
        assert_eq!(host_of("https:///nohost"), None);
    }

    #[test]
    fn wildcard_matches_subdomains_only() {
        assert!(lookup("api.modrinth.com").is_some());
        assert!(lookup("cdn.modrinth.com").is_some());
        assert!(lookup("modrinth.com").is_none());
        assert!(lookup("evilmodrinth.com").is_none());
        assert!(lookup("modrinth.com.evil.example").is_none());
    }

    #[test]
    fn unlisted_and_plain_http_are_refused() {
        assert!(check("https://tracker.example.net/collect").is_err());
        assert!(check("http://api.modrinth.com/v2/search").is_err());
        assert!(check("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json").is_ok());
        assert!(check("http://127.0.0.1:8080/x").is_ok());
        assert!(check("not a url").is_err());
    }

    #[test]
    fn disabled_host_is_blocked_then_restored() {
        // `authserver.ely.by` is not contacted by any other unit test in this crate.
        set_disabled(&["authserver.ely.by".to_string()]);
        let err = check("https://authserver.ely.by/x")
            .unwrap_err()
            .to_string();
        assert!(err.contains("turned off"), "{err}");
        assert!(check("https://minotar.net/skin/Steve").is_ok());
        set_disabled(&[]);
        assert!(check("https://authserver.ely.by/x").is_ok());
    }

    #[test]
    fn user_configured_hosts_are_allowed_but_labelled() {
        assert!(check_user_configured("https://auth.my-own-server.example/api").is_ok());
        assert!(check_user_configured("http://192.168.1.20:8080/api").is_ok());
        assert!(check_user_configured("http://public.example.org/api").is_err());
        assert!(activity()
            .iter()
            .any(|x| x.host == "auth.my-own-server.example" && x.user_configured));
    }

    #[test]
    fn registry_has_no_analytics_ads_or_duplicates_and_every_host_is_explained() {
        let banned = [
            "analytics",
            "telemetry",
            "doubleclick",
            "adservice",
            "sentry",
            "segment",
            "mixpanel",
            "amplitude",
            "bugsnag",
        ];
        let mut seen = HashSet::new();
        for r in REGISTRY {
            assert!(seen.insert(r.host), "duplicate host {}", r.host);
            assert!(
                r.purpose.len() > 12 && r.sends.len() > 12,
                "{} needs a real explanation",
                r.host
            );
            for b in banned {
                assert!(
                    !r.host.contains(b),
                    "{} looks like an analytics host",
                    r.host
                );
            }
        }
    }

    #[test]
    fn registry_json_is_valid_and_complete() {
        let v: serde_json::Value = serde_json::from_str(&registry_json()).unwrap();
        assert_eq!(v["hosts"].as_array().unwrap().len(), REGISTRY.len());
        assert_eq!(v["hosts"][0]["category_label"], "Game files");
    }
}
