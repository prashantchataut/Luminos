//! Accounts. Offline accounts work today; Microsoft sign-in is on the roadmap (see CONTINUITY.md).
use crate::{paths, store};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Offline,
    Microsoft,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Account {
    pub username: String,
    pub uuid: String,
    pub kind: AccountKind,
    /// Optional skin PNG saved in the skin library that belongs to this account.
    pub skin_id: Option<String>,
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
            skin_id: None,
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
    fn username_rules() {
        assert!(valid_username("Steve_01"));
        assert!(!valid_username("ab"));
        assert!(!valid_username("has space"));
    }
}
