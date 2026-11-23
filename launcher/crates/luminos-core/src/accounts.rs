//! Accounts. Offline accounts work today; Microsoft sign-in is on the roadmap (see CONTINUITY.md).
use crate::{paths, store};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Offline,
    Microsoft,
    /// Ely.by (Yggdrasil via authlib-injector).
    Elyby,
    /// A luminos-auth server (Yggdrasil via authlib-injector).
    Luminos,
}

impl AccountKind {
    /// Kinds whose game session is handled by authlib-injector.
    pub fn uses_injector(&self) -> bool {
        matches!(self, AccountKind::Elyby | AccountKind::Luminos)
    }
    pub fn label(&self) -> &'static str {
        match self {
            AccountKind::Offline => "OFFLINE",
            AccountKind::Microsoft => "MICROSOFT",
            AccountKind::Elyby => "ELY.BY",
            AccountKind::Luminos => "LUMINOS",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Account {
    pub username: String,
    pub uuid: String,
    pub kind: AccountKind,
    /// Optional skin PNG saved in the skin library that belongs to this account.
    pub skin_id: Option<String>,
    /// Yggdrasil API root for Ely.by / Luminos accounts.
    #[serde(default)]
    pub auth_server: Option<String>,
    /// Session tokens. Stored in accounts.json (plain text, user-only file). TODO: OS keyring.
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub client_token: Option<String>,
    /// Built-in cape id (see `cosmetics::CAPES`) worn by an offline account.
    #[serde(default)]
    pub cape_id: Option<String>,
}

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct AccountStore {
    pub accounts: Vec<Account>,
    pub active: usize,
}

/// Minecraft usernames: 3-16 chars of `[A-Za-z0-9_]`.
pub fn valid_username(name: &str) -> bool {
    let n = name.chars().count();
    (3..=16).contains(&n) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// The UUID a vanilla server derives for an offline-mode player:
/// `UUID.nameUUIDFromBytes("OfflinePlayer:<name>")` (MD5, version 3).
pub fn offline_uuid(name: &str) -> String {
    let mut h = md5::compute(format!("OfflinePlayer:{name}").as_bytes()).0;
    h[6] = (h[6] & 0x0f) | 0x30;
    h[8] = (h[8] & 0x3f) | 0x80;
    let s = store::hex(&h);
    format!(
        "{}-{}-{}-{}-{}",
        &s[0..8],
        &s[8..12],
        &s[12..16],
        &s[16..20],
        &s[20..32]
    )
}

impl Account {
    pub fn offline(name: &str) -> Self {
        Self {
            username: name.to_string(),
            uuid: offline_uuid(name),
            kind: AccountKind::Offline,
            // New offline accounts wear the original Luminos Pilot skin, not Steve.
            skin_id: Some(crate::cosmetics::DEFAULT_SKIN_ID.to_string()),
            auth_server: None,
            access_token: None,
            client_token: None,
            cape_id: None,
        }
    }
}

impl AccountStore {
    pub fn load() -> Self {
        store::read_json(&paths::accounts_file())
    }
    pub fn save(&self) {
        let _ = store::write_json(&paths::accounts_file(), self);
    }
    pub fn active(&self) -> Option<&Account> {
        self.accounts.get(self.active)
    }
    pub fn add(&mut self, acc: Account) {
        if let Some(i) = self
            .accounts
            .iter()
            .position(|a| a.username == acc.username)
        {
            self.active = i;
        } else {
            self.accounts.push(acc);
            self.active = self.accounts.len() - 1;
        }
    }
    pub fn remove(&mut self, idx: usize) {
        if idx < self.accounts.len() {
            self.accounts.remove(idx);
            if self.active >= self.accounts.len() {
                self.active = self.accounts.len().saturating_sub(1);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_uuid_matches_vanilla() {
        // Known value produced by Java's UUID.nameUUIDFromBytes("OfflinePlayer:Notch")
        assert_eq!(
            offline_uuid("Notch"),
            "b50ad385-829d-3141-a216-7e7d7539ba7f"
        );
    }

    #[test]
    fn offline_uuid_known_vanilla_values() {
        // Computed with java.util.UUID.nameUUIDFromBytes(("OfflinePlayer:" + n).getBytes(UTF_8))
        assert_eq!(
            offline_uuid("Notch"),
            "b50ad385-829d-3141-a216-7e7d7539ba7f"
        );
        // version nibble 3, variant 10xx
        let u = offline_uuid("Steve");
        assert_eq!(&u[14..15], "3");
        assert!(matches!(&u[19..20], "8" | "9" | "a" | "b"));
        // case matters: vanilla hashes the exact string
        assert_ne!(offline_uuid("steve"), offline_uuid("Steve"));
    }

    #[test]
    fn old_accounts_json_still_loads() {
        let a: Account = serde_json::from_str(
            r#"{"username":"A_b","uuid":"x","kind":"offline","skin_id":null}"#,
        )
        .unwrap();
        assert!(a.access_token.is_none() && !a.kind.uses_injector());
    }

    #[test]
    fn username_rules() {
        assert!(valid_username("Steve_01"));
        assert!(!valid_username("ab"));
        assert!(!valid_username("has space"));
    }
}
