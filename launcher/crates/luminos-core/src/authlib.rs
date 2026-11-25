//! Launch arguments for authlib-injector (Ely.by and custom Yggdrasil servers).
//! Only builds a validated `-javaagent` argument. It never touches tokens and never bypasses Mojang auth:
//! an Ely.by or custom-server account talks to its own auth server, and online-mode Mojang servers still refuse it.
pub const ELY_API: &str = "https://authserver.ely.by/api/authlib-injector";

#[derive(Debug, PartialEq, Eq)]
pub enum AuthlibError { NotHttps, NoHost, Invalid }

/// Accepts only an https URL with a dotted host; returns it without a trailing slash.
pub fn validate_server(url: &str) -> Result<String, AuthlibError> {
    let u = url.trim();
    if u.chars().any(|c| c.is_whitespace() || c.is_control()) { return Err(AuthlibError::Invalid); }
    let rest = match u.strip_prefix("https://") { Some(r) => r, None => return Err(if u.starts_with("http://") { AuthlibError::NotHttps } else { AuthlibError::Invalid }) };
    let host = rest.split(|c| c == '/' || c == '?' || c == '#').next().unwrap_or("");
    if host.is_empty() || !host.contains('.') { return Err(AuthlibError::NoHost); }
    Ok(u.trim_end_matches('/').to_string())
}

pub fn javaagent_arg(jar: &str, server: &str) -> Result<String, AuthlibError> {
    Ok(format!("-javaagent:{}={}", jar, validate_server(server)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn ely_default_is_valid() { assert_eq!(validate_server(ELY_API).unwrap(), ELY_API); }
    #[test] fn trailing_slash_is_dropped() { assert_eq!(validate_server(" https://auth.example.org/api/ ").unwrap(), "https://auth.example.org/api"); }
    #[test] fn plain_http_is_refused() { assert_eq!(validate_server("http://auth.example.org"), Err(AuthlibError::NotHttps)); }
    #[test] fn hostless_is_refused() { let p = "https:"; assert_eq!(validate_server(&format!("{p}//localhost/x")), Err(AuthlibError::NoHost)); assert_eq!(validate_server(&format!("{p}///x")), Err(AuthlibError::NoHost)); }
    #[test] fn junk_is_refused() { assert_eq!(validate_server("ftp://auth.example.org"), Err(AuthlibError::Invalid)); let p = "https:"; assert_eq!(validate_server(&format!("{p}//auth.example.org/x y")), Err(AuthlibError::Invalid)); }
    #[test] fn arg_matches_the_ui_mirror() { assert_eq!(javaagent_arg("authlib-injector.jar", ELY_API).unwrap(), "-javaagent:authlib-injector.jar=https://authserver.ely.by/api/authlib-injector"); }
}
