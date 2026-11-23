//! Community server directory.
//!
//! Entries are community-submitted through pull requests to `site/public/server-directory.json`
//! (see docs/SERVER_DIRECTORY.md). Rules enforced here, not just documented:
//! * an entry is only **shown** after the launcher has pinged it successfully (`verify_alive`);
//! * entries are never trusted for `offline_friendly`: the launcher re-checks with `loginprobe` when you click join;
//! * a report link is built for every entry.
use crate::servers;
use anyhow::Result;
use serde::{Deserialize, Serialize};

pub const DIRECTORY_URL: &str =
    "https://raw.githubusercontent.com/prashantchataut/Luminos/main/site/public/server-directory.json";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Entry {
    pub name: String,
    pub address: String,
    #[serde(default)]
    pub description: String,
    /// e.g. ["1.21.4","1.21.11"]. Empty = any version.
    #[serde(default)]
    pub versions: Vec<String>,
    #[serde(default)]
    pub gamemodes: Vec<String>,
    /// What the submitter claims. Re-verified on join.
    #[serde(default)]
    pub offline_friendly: bool,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Directory {
    #[serde(default)]
    pub servers: Vec<Entry>,
}

#[derive(Default, Clone, Debug)]
pub struct Filter {
    pub version: Option<String>,
    pub offline_friendly: bool,
    pub gamemode: Option<String>,
    pub text: String,
}

pub fn parse(json: &str) -> Result<Directory> {
    Ok(serde_json::from_str(json)?)
}

pub fn fetch() -> Result<Directory> {
    parse(&String::from_utf8(crate::http::get_bytes(DIRECTORY_URL)?)?)
}

pub fn matches(e: &Entry, f: &Filter) -> bool {
    if f.offline_friendly && !e.offline_friendly {
        return false;
    }
    if let Some(v) = &f.version {
        if !e.versions.is_empty() && !e.versions.iter().any(|x| x == v) {
            return false;
        }
    }
    if let Some(g) = &f.gamemode {
        if !e.gamemodes.iter().any(|x| x.eq_ignore_ascii_case(g)) {
            return false;
        }
    }
    let t = f.text.trim().to_lowercase();
    t.is_empty() || e.name.to_lowercase().contains(&t) || e.description.to_lowercase().contains(&t)
}

pub fn filter<'a>(d: &'a [Entry], f: &Filter) -> Vec<&'a Entry> {
    d.iter().filter(|e| matches(e, f)).collect()
}

/// Ping every entry in parallel; keep only those that answered.
pub fn verify_alive(entries: Vec<Entry>) -> Vec<(Entry, servers::Status)> {
    let handles: Vec<_> = entries
        .into_iter()
        .map(|e| {
            std::thread::spawn(move || {
                let st = servers::ping(&e.address).ok();
                st.map(|s| (e, s))
            })
        })
        .collect();
    handles
        .into_iter()
        .filter_map(|h| h.join().ok().flatten())
        .collect()
}

pub fn report_url(e: &Entry) -> String {
    format!(
        "https://github.com/prashantchataut/Luminos/issues/new?labels=directory-report&title={}",
        e.name
            .bytes()
            .map(|b| if b.is_ascii_alphanumeric() {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            })
            .collect::<String>()
            .replacen("", "Report%3A%20", 1)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d() -> Vec<Entry> {
        parse(r#"{"servers":[
          {"name":"Alpha","address":"a.example","versions":["1.21.4"],"gamemodes":["survival"],"offline_friendly":true},
          {"name":"Beta","address":"b.example","versions":["26.2"],"gamemodes":["Creative"]},
          {"name":"Gamma","address":"c.example","description":"any version smp"}]}"#)
        .unwrap()
        .servers
    }

    #[test]
    fn filters_by_version_offline_and_mode() {
        let all = d();
        let f = Filter {
            version: Some("1.21.4".into()),
            ..Default::default()
        };
        let names: Vec<_> = filter(&all, &f).iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, ["Alpha", "Gamma"]); // Gamma: no version list = any
        let f = Filter {
            offline_friendly: true,
            ..Default::default()
        };
        assert_eq!(filter(&all, &f).len(), 1);
        let f = Filter {
            gamemode: Some("creative".into()),
            ..Default::default()
        };
        assert_eq!(filter(&all, &f)[0].name, "Beta");
        let f = Filter {
            text: "smp".into(),
            ..Default::default()
        };
        assert_eq!(filter(&all, &f)[0].name, "Gamma");
    }

    #[test]
    fn dead_servers_are_never_listed() {
        let dead = Entry {
            name: "Dead".into(),
            address: "127.0.0.1:1".into(),
            description: String::new(),
            versions: vec![],
            gamemodes: vec![],
            offline_friendly: true,
        };
        assert!(verify_alive(vec![dead]).is_empty());
    }

    #[test]
    fn report_url_is_encoded() {
        let e = Entry {
            name: "A&B x".into(),
            address: "x".into(),
            description: String::new(),
            versions: vec![],
            gamemodes: vec![],
            offline_friendly: false,
        };
        let u = report_url(&e);
        assert!(!u.contains(' ') && !u.contains("A&B"));
    }
}
