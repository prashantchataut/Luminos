//! Username checks that tell the truth about offline play.
//!
//! Offline names are not reserved by anyone: there is no registry that can say "taken". What *can* be
//! checked is (a) the format Minecraft accepts and (b) whether the name belongs to a premium account,
//! because online-mode servers will demand that account and the name's skin lookup returns that player's skin.
use anyhow::Result;
use serde::Deserialize;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NameStatus {
    /// Not a valid Minecraft name; the reason is user-facing.
    Invalid(&'static str),
    /// Belongs to a premium account (the Mojang profile id).
    Premium(String),
    /// No premium account uses it.
    Free,
}

/// Format rules with a specific reason (Minecraft: 3-16 of `[A-Za-z0-9_]`).
pub fn check_format(name: &str) -> Result<(), &'static str> {
    let n = name.chars().count();
    if n < 3 {
        return Err("Too short. Minecraft names need at least 3 characters.");
    }
    if n > 16 {
        return Err("Too long. Minecraft names are 16 characters at most.");
    }
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Only letters, numbers and underscores are allowed.");
    }
    Ok(())
}

#[derive(Deserialize)]
struct Profile {
    id: String,
}

fn is_status(e: &anyhow::Error, code: u16) -> bool {
    e.chain().any(|c| matches!(c.downcast_ref::<ureq::Error>(), Some(ureq::Error::StatusCode(s)) if *s == code))
}

/// Ask Mojang whether a premium account uses this name. 404 means no.
pub fn lookup(name: &str) -> Result<NameStatus> {
    if let Err(why) = check_format(name) {
        return Ok(NameStatus::Invalid(why));
    }
    let url = format!("https://api.minecraftservices.com/minecraft/profile/lookup/name/{name}");
    match crate::http::get_json::<Profile>(&url) {
        Ok(p) => Ok(NameStatus::Premium(p.id)),
        Err(e) if is_status(&e, 404) => Ok(NameStatus::Free),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_reasons_are_specific() {
        assert!(check_format("Steve_01").is_ok());
        assert!(check_format("ab").unwrap_err().contains("Too short"));
        assert!(check_format("a".repeat(17).as_str())
            .unwrap_err()
            .contains("Too long"));
        assert!(check_format("bad name")
            .unwrap_err()
            .contains("Only letters"));
        assert!(check_format("zoë_x").unwrap_err().contains("Only letters"));
        assert_eq!(
            lookup("x!").unwrap(),
            NameStatus::Invalid("Too short. Minecraft names need at least 3 characters.")
        );
    }
}
