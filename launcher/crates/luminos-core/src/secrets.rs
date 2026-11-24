//! Account tokens live in the operating system's secure store and nowhere else.
//!
//! Windows: Credential Manager. macOS: Keychain. Linux: the kernel keyring. `accounts.json` never contains a token:
//! `AccountStore::save` moves each one here before writing, and `load` brings it back. If the store refuses a write the
//! token stays in memory for this run and is *not* written to disk; the player signs in again next time.
use anyhow::{anyhow, Result};

const SERVICE: &str = "dev.luminos.launcher";

#[cfg(any(windows, target_os = "macos", target_os = "linux"))]
fn entry(key: &str) -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, key).map_err(|e| anyhow!("secure store unavailable: {e}"))
}

/// Write straight to the OS store (never the in-memory test backend). Used by the real round-trip test.
pub fn os_put(key: &str, value: &str) -> Result<()> {
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    {
        entry(key)?
            .set_password(value)
            .map_err(|e| anyhow!("secure store refused the write: {e}"))
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = (key, value);
        Err(anyhow!("no secure store on this platform"))
    }
}
pub fn os_get(key: &str) -> Result<Option<String>> {
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    {
        match entry(key)?.get_password() {
            Ok(v) => Ok(Some(v)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(anyhow!("secure store read failed: {e}")),
        }
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = key;
        Ok(None)
    }
}
pub fn os_delete(key: &str) -> Result<()> {
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    {
        match entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(anyhow!("secure store delete failed: {e}")),
        }
    }
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    {
        let _ = key;
        Ok(())
    }
}

#[cfg(test)]
mod mem {
    use std::collections::HashMap;
    use std::sync::Mutex;
    pub static MAP: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);
}

/// Unit tests of the account store use an in-memory backend so they never touch a developer's real keychain.
pub fn put(key: &str, value: &str) -> Result<()> {
    #[cfg(test)]
    {
        mem::MAP
            .lock()
            .map_err(|_| anyhow!("poisoned"))?
            .get_or_insert_with(Default::default)
            .insert(key.into(), value.into());
        Ok(())
    }
    #[cfg(not(test))]
    os_put(key, value)
}
pub fn get(key: &str) -> Option<String> {
    #[cfg(test)]
    {
        mem::MAP.lock().ok()?.as_ref()?.get(key).cloned()
    }
    #[cfg(not(test))]
    os_get(key).ok().flatten()
}
pub fn delete(key: &str) {
    #[cfg(test)]
    {
        if let Ok(mut g) = mem::MAP.lock() {
            if let Some(m) = g.as_mut() {
                m.remove(key);
            }
        }
    }
    #[cfg(not(test))]
    let _ = os_delete(key);
}

pub fn access_key(uuid: &str) -> String {
    format!("access:{uuid}")
}
pub fn refresh_key(uuid: &str) -> String {
    format!("msrefresh:{uuid}")
}
