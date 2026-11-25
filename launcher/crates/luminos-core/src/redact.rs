//! Log redaction. Always on: there is no setting to turn it off (`docs/PRIVACY.md`).
//!
//! Every line that comes out of the game process goes through [`scrub`] before it is stored, shown or copied. Two layers:
//! 1. **Exact secrets**: the account's access and refresh tokens are registered with [`register_secret`] and removed
//!    wherever they appear, in any format.
//! 2. **Shapes**: bearer tokens, JWTs, the legacy `token:<access>:<uuid>` session id, `--accessToken`/`--session` arguments,
//!    `key=value` and `"key":"value"` pairs for token-like keys, and Microsoft refresh tokens (`M.C…`/`M.R3_…`).
//!
//! No regex crate: the scanner is hand written so the binary stays small (AGENTS.md rule 2).
use std::sync::Mutex;

pub const MASK: &str = "[REDACTED]";
static SECRETS: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Remember a secret so it is removed verbatim from every later line. Short values (< 8 chars) are ignored: they would
/// mangle ordinary text and cannot be a real token.
pub fn register_secret(s: &str) {
    if s.len() < 8 {
        return;
    }
    if let Ok(mut v) = SECRETS.lock() {
        if !v.iter().any(|x| x == s) {
            v.push(s.to_string());
        }
    }
}
pub fn clear_secrets() {
    if let Ok(mut v) = SECRETS.lock() {
        v.clear();
    }
}

const KEYS: &[&str] = &[
    "access_token",
    "accesstoken",
    "refresh_token",
    "refreshtoken",
    "id_token",
    "sessionid",
    "session_id",
    "sessiontoken",
    "clienttoken",
    "client_token",
    "client_secret",
    "authorization",
    "x-api-key",
    "password",
];
const FLAGS: &[&str] = &[
    "--accessToken",
    "--session",
    "--clientId",
    "--xuid",
    "--clientToken",
];

fn is_tok(c: char) -> bool {
    c.is_ascii_alphanumeric()
        || matches!(c, '-' | '_' | '.' | '~' | '+' | '/' | '=' | '!' | '*' | '$')
}

/// Scrub one line (or a whole text). Idempotent: scrubbing twice gives the same result.
pub fn scrub(input: &str) -> String {
    let mut s = input.to_string();
    if let Ok(v) = SECRETS.lock() {
        for secret in v.iter() {
            if s.contains(secret.as_str()) {
                s = s.replace(secret.as_str(), MASK);
            }
        }
    }
    s = flags(&s);
    s = pairs(&s);
    s = bearer(&s);
    s = legacy_session(&s);
    s = shapes(&s);
    s
}

/// `--accessToken abc`, `--session=abc`
fn flags(s: &str) -> String {
    let mut out = s.to_string();
    for f in FLAGS {
        let mut from = 0;
        while let Some(i) = out[from..].find(f) {
            let start = from + i + f.len();
            let rest = &out[start..];
            let skip = rest.len() - rest.trim_start_matches([' ', '=']).len();
            if skip == 0 {
                from = start;
                continue;
            }
            let vs = start + skip;
            let ve = vs
                + out[vs..]
                    .find(|c: char| c.is_whitespace() || c == '"' || c == '\'')
                    .unwrap_or(out.len() - vs);
            if ve > vs && &out[vs..ve] != MASK {
                out.replace_range(vs..ve, MASK);
            }
            from = vs + MASK.len();
        }
    }
    out
}

/// `key=value`, `key: value`, `"key":"value"` for token-like keys (case-insensitive).
fn pairs(s: &str) -> String {
    let lower = s.to_ascii_lowercase();
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    let b = s.as_bytes();
    'outer: while i < s.len() {
        for k in KEYS {
            if lower[i..].starts_with(k) {
                let prev_ok = i == 0 || !(b[i - 1].is_ascii_alphanumeric());
                let mut j = i + k.len();
                if !prev_ok {
                    continue;
                }
                // optional closing quote, spaces, then : or =
                while j < s.len() && matches!(b[j], b'"' | b'\'' | b' ') {
                    j += 1;
                }
                if j < s.len() && matches!(b[j], b':' | b'=') {
                    j += 1;
                    while j < s.len() && matches!(b[j], b' ' | b'"' | b'\'') {
                        j += 1;
                    }
                    // `Authorization: Bearer xyz` keeps the word Bearer and masks the token after it.
                    if lower[j..].starts_with("bearer ") {
                        j += 7;
                    }
                    let ve = j + s[j..].find(|c: char| !is_tok(c)).unwrap_or(s.len() - j);
                    if ve > j {
                        out.push_str(&s[i..j]);
                        out.push_str(MASK);
                        i = ve;
                        continue 'outer;
                    }
                }
            }
        }
        let ch = s[i..].chars().next().unwrap_or(' ');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

fn bearer(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let lower = s.to_ascii_lowercase();
    let mut i = 0;
    while i < s.len() {
        if lower[i..].starts_with("bearer ")
            && (i == 0 || !s.as_bytes()[i - 1].is_ascii_alphanumeric())
        {
            let j = i + 7;
            let e = j + s[j..].find(|c: char| !is_tok(c)).unwrap_or(s.len() - j);
            if e > j {
                out.push_str(&s[i..j]);
                out.push_str(MASK);
                i = e;
                continue;
            }
        }
        let ch = s[i..].chars().next().unwrap_or(' ');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// Old Minecraft session id: `token:<accessToken>:<uuid>`.
fn legacy_session(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        if s[i..].starts_with("token:") && (i == 0 || !s.as_bytes()[i - 1].is_ascii_alphanumeric())
        {
            let j = i + 6;
            let e = j + s[j..]
                .find(|c: char| !(is_tok(c) || c == ':'))
                .unwrap_or(s.len() - j);
            if e - j >= 16 {
                out.push_str("token:");
                out.push_str(MASK);
                i = e;
                continue;
            }
        }
        let ch = s[i..].chars().next().unwrap_or(' ');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// JWTs (`eyJ…​.…​.…`) and Microsoft refresh tokens (`M.C5…`, `M.R3_BAY…`, ≥ 40 chars).
fn shapes(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut i = 0;
    while i < s.len() {
        let at_boundary = i == 0 || !is_tok(s[..i].chars().next_back().unwrap_or(' '));
        if at_boundary {
            let rest = &s[i..];
            let e = rest.find(|c: char| !is_tok(c)).unwrap_or(rest.len());
            let word = &rest[..e];
            let jwt = word.starts_with("eyJ") && word.matches('.').count() >= 2 && word.len() >= 30;
            let msa = word.len() >= 40
                && word.starts_with("M.")
                && word[2..]
                    .chars()
                    .take(4)
                    .all(|c| c.is_ascii_alphanumeric() || c == '_');
            if jwt || msa {
                out.push_str(MASK);
                i += e;
                continue;
            }
        }
        let ch = s[i..].chars().next().unwrap_or(' ');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    const JWT: &str = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    #[test]
    fn jwt_bearer_and_flags_are_masked() {
        let l = format!(
            "Setting user: Authorization: Bearer {JWT} and --accessToken {JWT} --username Mira"
        );
        let o = scrub(&l);
        assert!(!o.contains("eyJ"), "{o}");
        assert!(o.contains("--username Mira"), "ordinary args survive: {o}");
        assert!(o.contains("Bearer [REDACTED]"), "{o}");
    }
    #[test]
    fn legacy_session_id() {
        let o = scrub("Session ID is token:abcdef0123456789abcdef.0123456789:069a79f444e94726a5befca90e38aaf5");
        assert_eq!(o, "Session ID is token:[REDACTED]");
    }
    #[test]
    fn json_and_query_pairs() {
        let o = scrub(
            r#"{"access_token":"AAAA1111BBBB2222","refresh_token":"M.C511_BAY.0.U.-Cabc","name":"x"} ?client_secret=hunter2hunter2&a=b"#,
        );
        assert!(
            !o.contains("AAAA1111") && !o.contains("M.C511") && !o.contains("hunter2"),
            "{o}"
        );
        assert!(o.contains("\"name\":\"x\"") && o.contains("&a=b"), "{o}");
    }
    #[test]
    fn microsoft_refresh_token_by_shape() {
        let t = "M.C509_BAY.0.U.-CrQeabcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
        assert_eq!(scrub(&format!("got {t} ok")), "got [REDACTED] ok");
    }
    #[test]
    fn registered_secret_is_removed_in_any_format() {
        register_secret("plain-secret-value-123");
        let o = scrub("weird format <<plain-secret-value-123>> end");
        assert_eq!(o, "weird format <<[REDACTED]>> end");
        clear_secrets();
    }
    #[test]
    fn normal_text_is_untouched_and_idempotent() {
        for l in [
            "[Render thread/INFO]: Loaded 312 recipes",
            "Modern.Fix at 1.21.1 Mira joined the game",
            "tokens per second 40",
            "M.2 board",
        ] {
            assert_eq!(scrub(l), l);
        }
        let once = scrub("--session abc12345 Bearer zzzzzzzz1");
        assert_eq!(scrub(&once), once);
    }
    #[test]
    fn unicode_does_not_panic() {
        assert_eq!(scrub("héllo → wörld ✓"), "héllo → wörld ✓");
    }
}
