//! Accounts: offline, Microsoft, Ely.by and Luminos. Session tokens are kept in the OS secure store, not in the JSON file.
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
    /// Session token. Held in memory; on disk it lives only in the OS secure store (see `secrets`), never in accounts.json.
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
    /// Reads accounts.json and brings each real session token back from the OS secure store.
    /// A token found in the file (written by an older build) is moved into the store and the file is rewritten without it.
    pub fn load() -> Self {
        let mut s: AccountStore = store::read_json(&paths::accounts_file());
        let mut migrated = false;
        for a in &mut s.accounts {
            if a.kind == AccountKind::Offline {
                continue;
            }
            let key = crate::secrets::access_key(&a.uuid);
            if a.access_token.is_some() {
                migrated = true; // legacy plaintext: save() below moves it
            } else {
                a.access_token = crate::secrets::get(&key);
            }
        }
        if migrated {
            s.save();
        }
        s
    }
    /// Writes accounts.json with every token removed; the tokens go to the OS secure store.
    /// If the store refuses, the file is still written without the token (never plaintext), so the player re-signs in.
    pub fn save(&self) {
        let mut on_disk = self.clone();
        for a in &mut on_disk.accounts {
            if a.kind == AccountKind::Offline {
                a.access_token = None;
                continue;
            }
            let key = crate::secrets::access_key(&a.uuid);
            match a.access_token.take() {
                Some(t) => {
                    let _ = crate::secrets::put(&key, &t);
                }
                None => crate::secrets::delete(&key),
            }
        }
        let _ = store::write_json(&paths::accounts_file(), &on_disk);
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
            let gone = self.accounts.remove(idx);
            crate::secrets::delete(&crate::secrets::access_key(&gone.uuid));
            crate::secrets::delete(&crate::secrets::refresh_key(&gone.uuid));
            if self.active >= self.accounts.len() {
                self.active = self.accounts.len().saturating_sub(1);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox() -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!(
            "luminos-acc-{}-{}",
            std::process::id(),
            store::now_unix()
        ));
        let _ = std::fs::create_dir_all(&d);
        d
    }

    #[test]
    fn microsoft_token_round_trips_and_never_touches_the_json_file() {
        let _g = crate::paths::test_home_lock();
        let home = sandbox();
        std::env::set_var("LUMINOS_HOME", &home);
        let mut st = AccountStore::default();
        let mut a = Account::offline("Notch");
        a.uuid = "069a79f444e94726a5befca90e38aaf5".into();
        a.kind = AccountKind::Microsoft;
        a.access_token = Some("SECRET-MC-TOKEN-123".into());
        st.add(a);
        st.save();
        let raw = std::fs::read_to_string(paths::accounts_file()).unwrap();
        assert!(
            !raw.contains("SECRET-MC-TOKEN-123"),
            "token leaked into accounts.json: {raw}"
        );
        let back = AccountStore::load();
        assert_eq!(
            back.accounts[0].access_token.as_deref(),
            Some("SECRET-MC-TOKEN-123")
        );
        let mut st = back;
        st.remove(0);
        st.save();
        assert!(
            crate::secrets::get(&crate::secrets::access_key(
                "069a79f444e94726a5befca90e38aaf5"
            ))
            .is_none(),
            "removed account left a token behind"
        );
    }

    #[test]
    fn legacy_plaintext_token_is_migrated_out_of_the_file() {
        let _g = crate::paths::test_home_lock();
        let home = sandbox();
        std::env::set_var("LUMINOS_HOME", &home);
        let legacy = r#"{"accounts":[{"username":"Old","uuid":"aaaa1111aaaa1111aaaa1111aaaa1111","kind":"microsoft","access_token":"LEGACY-PLAIN"}],"active":0}"#;
        std::fs::write(paths::accounts_file(), legacy).unwrap();
        let s = AccountStore::load();
        assert_eq!(s.accounts[0].access_token.as_deref(), Some("LEGACY-PLAIN"));
        assert!(!std::fs::read_to_string(paths::accounts_file())
            .unwrap()
            .contains("LEGACY-PLAIN"));
    }

    #[test]
    fn offline_accounts_never_use_the_secure_store() {
        let _g = crate::paths::test_home_lock();
        let home = sandbox();
        std::env::set_var("LUMINOS_HOME", &home);
        let mut st = AccountStore::default();
        st.add(Account::offline("Steve"));
        st.save();
        assert!(AccountStore::load().accounts[0].access_token.is_none());
    }

    /// Real OS store. On the Windows runner this is Credential Manager. LUMINOS_REQUIRE_OS_STORE=1 turns "unavailable" into a failure.
    #[test]
    fn real_os_store_round_trip() {
        let key = format!("test:{}", std::process::id());
        match crate::secrets::os_put(&key, "hello-os-store") {
            Ok(()) => {
                assert_eq!(
                    crate::secrets::os_get(&key).unwrap().as_deref(),
                    Some("hello-os-store")
                );
                crate::secrets::os_delete(&key).unwrap();
                assert_eq!(crate::secrets::os_get(&key).unwrap(), None);
                eprintln!("OS-STORE-ROUNDTRIP: PASSED on {}", std::env::consts::OS);
            }
            Err(e) => {
                assert!(
                    std::env::var("LUMINOS_REQUIRE_OS_STORE").is_err(),
                    "OS store required but unavailable: {e}"
                );
                eprintln!("OS-STORE-ROUNDTRIP: SKIPPED ({e})");
            }
        }
    }

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
