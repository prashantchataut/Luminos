//! Luminos Auth: a small Yggdrasil-compatible auth + session server.
//!
//! Implements the subset of the Yggdrasil API that Minecraft clients, Minecraft servers and
//! [authlib-injector](https://github.com/yushijinhun/authlib-injector) use (technical spec:
//! <https://github.com/yushijinhun/authlib-injector/wiki/Yggdrasil-server-technical-specification>).
//!
//! HONEST LIMITS
//! * This is *our own* identity system. It does not, and cannot, authenticate against Mojang/Microsoft.
//! * A Minecraft server only trusts it if the server operator opts in by running authlib-injector
//!   pointed at this API (see `docs/LUMINOS_AUTH_SERVER.md`).
//! * Player profile UUIDs are derived as `OfflinePlayer:<name>` so a player's inventory and world data
//!   are identical whether the server runs offline-mode or luminos-auth.
//! * Persistence is a JSON file (users + profiles). Access/session tokens live in memory only, so a restart
//!   signs everyone out. Swap `Store` for SQLite/Postgres before running at scale.

pub use axum::Router;
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rsa::{
    pkcs1v15::SigningKey,
    pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey, LineEnding},
    signature::{RandomizedSigner, SignatureEncoding},
    RsaPrivateKey, RsaPublicKey,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

// ───────────────────────────── config & state ─────────────────────────────

#[derive(Clone, Debug)]
pub struct Config {
    pub server_name: String,
    /// Public base URL (no trailing slash), advertised in metadata links.
    pub public_url: String,
    /// Hosts that may serve textures. authlib-injector refuses textures from other hosts.
    pub skin_domains: Vec<String>,
    pub data_dir: Option<PathBuf>,
    pub allow_registration: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server_name: "Luminos Auth".into(),
            public_url: "http://127.0.0.1:8787".into(),
            skin_domains: vec!["127.0.0.1".into(), "localhost".into()],
            data_dir: None,
            allow_registration: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Profile {
    /// Undashed lowercase UUID.
    pub id: String,
    pub name: String,
    pub skin_url: Option<String>,
    /// "default" (classic) or "slim"
    pub skin_model: String,
    pub cape_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct User {
    login: String,
    pass_hash: String,
    profile: Profile,
}

#[derive(Serialize, Deserialize, Default)]
struct Persisted {
    users: Vec<User>,
}

struct Token {
    client: String,
    login: String,
}

struct Join {
    profile_id: String,
    at: Instant,
}

#[derive(Default)]
struct Store {
    users: HashMap<String, User>, // key = lowercase login
    tokens: HashMap<String, Token>,
    joins: HashMap<String, Join>, // key = serverId
    fails: HashMap<String, (u32, Instant)>,
}

pub struct Inner {
    cfg: Config,
    key: RsaPrivateKey,
    public_pem: String,
    store: Mutex<Store>,
}

pub type AppState = Arc<Inner>;

/// Serve `app` on `listener` (used by tests and embedders so they don't need their own axum dependency).
pub async fn serve(listener: tokio::net::TcpListener, app: Router) {
    let _ = axum::serve(listener, app).await;
}

const MAX_FAILS: u32 = 5;
const LOCKOUT: Duration = Duration::from_secs(60);
const JOIN_TTL: Duration = Duration::from_secs(30);

pub fn new_state(cfg: Config) -> anyhow::Result<AppState> {
    let key = load_or_create_key(&cfg)?;
    let public_pem = RsaPublicKey::from(&key).to_public_key_pem(LineEnding::LF)?;
    let mut store = Store::default();
    if let Some(dir) = &cfg.data_dir {
        if let Ok(txt) = std::fs::read_to_string(dir.join("users.json")) {
            if let Ok(p) = serde_json::from_str::<Persisted>(&txt) {
                for u in p.users {
                    store.users.insert(u.login.to_lowercase(), u);
                }
            }
        }
    }
    Ok(Arc::new(Inner {
        cfg,
        key,
        public_pem,
        store: Mutex::new(store),
    }))
}

fn load_or_create_key(cfg: &Config) -> anyhow::Result<RsaPrivateKey> {
    if let Some(dir) = &cfg.data_dir {
        std::fs::create_dir_all(dir)?;
        let f = dir.join("signing-key.pem");
        if let Ok(pem) = std::fs::read_to_string(&f) {
            return Ok(RsaPrivateKey::from_pkcs8_pem(&pem)?);
        }
        let key = RsaPrivateKey::new(&mut rand::thread_rng(), 2048)?;
        std::fs::write(&f, key.to_pkcs8_pem(LineEnding::LF)?.as_bytes())?;
        return Ok(key);
    }
    Ok(RsaPrivateKey::new(&mut rand::thread_rng(), 2048)?)
}

impl Inner {
    fn persist(&self, s: &Store) {
        if let Some(dir) = &self.cfg.data_dir {
            let p = Persisted {
                users: s.users.values().cloned().collect(),
            };
            if let Ok(txt) = serde_json::to_string_pretty(&p) {
                let _ = std::fs::write(dir.join("users.json"), txt);
            }
        }
    }
}

// ───────────────────────────── helpers ─────────────────────────────

/// UUID a vanilla server derives for an offline-mode player, **undashed**.
pub fn offline_uuid_undashed(name: &str) -> String {
    let mut h = md5::compute(format!("OfflinePlayer:{name}").as_bytes()).0;
    h[6] = (h[6] & 0x0f) | 0x30;
    h[8] = (h[8] & 0x3f) | 0x80;
    h.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn valid_name(name: &str) -> bool {
    let n = name.chars().count();
    (3..=16).contains(&n) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

fn random_token() -> String {
    use rand::RngCore;
    let mut b = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut b);
    b.iter().map(|x| format!("{x:02x}")).collect()
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn hash_password(pw: &str) -> String {
    use argon2::{
        password_hash::{PasswordHasher, SaltString},
        Argon2,
    };
    use rand::RngCore;
    let mut salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    let salt = SaltString::encode_b64(&salt).expect("salt");
    Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .expect("hash")
        .to_string()
}

fn verify_password(pw: &str, hash: &str) -> bool {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };
    PasswordHash::new(hash)
        .map(|h| Argon2::default().verify_password(pw.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

// ───────────────────────────── errors ─────────────────────────────

pub struct ApiError(StatusCode, &'static str, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.0,
            Json(json!({"error": self.1, "errorMessage": self.2})),
        )
            .into_response()
    }
}

fn forbidden(msg: &str) -> ApiError {
    ApiError(
        StatusCode::FORBIDDEN,
        "ForbiddenOperationException",
        msg.into(),
    )
}
fn illegal(msg: &str) -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        "IllegalArgumentException",
        msg.into(),
    )
}

type R<T> = Result<T, ApiError>;

// ───────────────────────────── profile JSON ─────────────────────────────

fn profile_brief(p: &Profile) -> Value {
    json!({"id": p.id, "name": p.name})
}

fn textures_value(p: &Profile) -> String {
    let mut tex = serde_json::Map::new();
    if let Some(u) = &p.skin_url {
        let meta = if p.skin_model == "slim" {
            json!({"model": "slim"})
        } else {
            json!({})
        };
        tex.insert("SKIN".into(), json!({"url": u, "metadata": meta}));
    }
    if let Some(u) = &p.cape_url {
        tex.insert("CAPE".into(), json!({"url": u}));
    }
    let v = json!({
        "timestamp": now_ms(),
        "profileId": p.id,
        "profileName": p.name,
        "textures": tex,
    });
    B64.encode(v.to_string())
}

fn sign(st: &Inner, data: &str) -> String {
    use sha1::Sha1;
    let sk = SigningKey::<Sha1>::new(st.key.clone());
    let sig = sk.sign_with_rng(&mut rand::thread_rng(), data.as_bytes());
    B64.encode(sig.to_bytes())
}

fn profile_full(st: &Inner, p: &Profile, signed: bool) -> Value {
    let value = textures_value(p);
    let mut prop = json!({"name": "textures", "value": value});
    if signed {
        prop["signature"] = json!(sign(st, &value));
    }
    json!({"id": p.id, "name": p.name, "properties": [prop]})
}

// ───────────────────────────── router ─────────────────────────────

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/", get(metadata))
        .route("/authserver/authenticate", post(authenticate))
        .route("/authserver/refresh", post(refresh))
        .route("/authserver/validate", post(validate))
        .route("/authserver/invalidate", post(invalidate))
        .route("/authserver/signout", post(signout))
        .route("/sessionserver/session/minecraft/join", post(join))
        .route(
            "/sessionserver/session/minecraft/hasJoined",
            get(has_joined),
        )
        .route(
            "/sessionserver/session/minecraft/profile/{uuid}",
            get(profile_by_uuid),
        )
        .route("/api/profiles/minecraft", post(profiles_by_names))
        .route("/luminos/register", post(register))
        .route("/luminos/profile/textures", put(set_textures))
        .with_state(state)
}

async fn metadata(State(st): State<AppState>) -> Json<Value> {
    Json(json!({
        "meta": {
            "serverName": st.cfg.server_name,
            "implementationName": "luminos-auth",
            "implementationVersion": env!("CARGO_PKG_VERSION"),
            "links": {"homepage": st.cfg.public_url},
            "feature.non_email_login": true,
            "feature.no_mojang_namespace": true,
            "feature.legacy_skin_api": false,
        },
        "skinDomains": st.cfg.skin_domains,
        "signaturePublickey": st.public_pem,
    }))
}

#[derive(Deserialize)]
struct RegisterReq {
    login: String,
    password: String,
    #[serde(rename = "playerName")]
    player_name: String,
}

async fn register(
    State(st): State<AppState>,
    Json(r): Json<RegisterReq>,
) -> R<(StatusCode, Json<Value>)> {
    if !st.cfg.allow_registration {
        return Err(forbidden("Registration is closed."));
    }
    if !valid_name(&r.player_name) {
        return Err(illegal(
            "Player name must be 3-16 letters, digits or underscores.",
        ));
    }
    if r.login.trim().len() < 3 || r.password.chars().count() < 8 {
        return Err(illegal("Login needs 3+ characters and the password 8+."));
    }
    let hash = hash_password(&r.password);
    let mut s = st.store.lock().unwrap();
    let taken = s.users.values().any(|u| {
        u.login.eq_ignore_ascii_case(&r.login)
            || u.profile.name.eq_ignore_ascii_case(&r.player_name)
    });
    if taken {
        return Err(forbidden("That login or player name is already taken."));
    }
    let profile = Profile {
        id: offline_uuid_undashed(&r.player_name),
        name: r.player_name.clone(),
        skin_url: None,
        skin_model: "default".into(),
        cape_url: None,
    };
    s.users.insert(
        r.login.to_lowercase(),
        User {
            login: r.login.clone(),
            pass_hash: hash,
            profile: profile.clone(),
        },
    );
    st.persist(&s);
    Ok((StatusCode::CREATED, Json(profile_brief(&profile))))
}

#[derive(Deserialize)]
struct AuthReq {
    username: String,
    password: String,
    #[serde(rename = "clientToken")]
    client_token: Option<String>,
    #[serde(rename = "requestUser", default)]
    request_user: bool,
}

fn user_json(u: &User) -> Value {
    json!({"id": u.profile.id, "properties": []})
}

fn find_user(s: &Store, who: &str) -> Option<User> {
    s.users
        .values()
        .find(|u| u.login.eq_ignore_ascii_case(who) || u.profile.name.eq_ignore_ascii_case(who))
        .cloned()
}

async fn authenticate(State(st): State<AppState>, Json(r): Json<AuthReq>) -> R<Json<Value>> {
    let key = r.username.to_lowercase();
    let mut s = st.store.lock().unwrap();
    if let Some((n, at)) = s.fails.get(&key) {
        if *n >= MAX_FAILS && at.elapsed() < LOCKOUT {
            return Err(forbidden(
                "Too many failed attempts. Wait a minute and try again.",
            ));
        }
    }
    let user = find_user(&s, &r.username);
    let ok = user
        .as_ref()
        .map(|u| verify_password(&r.password, &u.pass_hash))
        .unwrap_or(false);
    if !ok {
        let e = s.fails.entry(key).or_insert((0, Instant::now()));
        if e.1.elapsed() >= LOCKOUT {
            *e = (0, Instant::now());
        }
        e.0 += 1;
        e.1 = Instant::now();
        return Err(forbidden(
            "Invalid credentials. Invalid username or password.",
        ));
    }
    s.fails.remove(&key);
    let u = user.unwrap();
    let access = random_token();
    let client = r.client_token.unwrap_or_else(random_token);
    s.tokens.insert(
        access.clone(),
        Token {
            client: client.clone(),
            login: u.login.to_lowercase(),
        },
    );
    let mut out = json!({
        "accessToken": access,
        "clientToken": client,
        "availableProfiles": [profile_brief(&u.profile)],
        "selectedProfile": profile_brief(&u.profile),
    });
    if r.request_user {
        out["user"] = user_json(&u);
    }
    Ok(Json(out))
}

#[derive(Deserialize)]
struct TokenReq {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "clientToken")]
    client_token: Option<String>,
    #[serde(rename = "requestUser", default)]
    request_user: bool,
}

fn token_ok(s: &Store, r: &TokenReq) -> Option<String> {
    let t = s.tokens.get(&r.access_token)?;
    if let Some(c) = &r.client_token {
        if *c != t.client {
            return None;
        }
    }
    Some(t.login.clone())
}

async fn refresh(State(st): State<AppState>, Json(r): Json<TokenReq>) -> R<Json<Value>> {
    let mut s = st.store.lock().unwrap();
    let Some(login) = token_ok(&s, &r) else {
        return Err(forbidden("Invalid token."));
    };
    let Some(u) = s.users.get(&login).cloned() else {
        return Err(forbidden("Invalid token."));
    };
    let old = s.tokens.remove(&r.access_token).unwrap();
    let access = random_token();
    s.tokens.insert(
        access.clone(),
        Token {
            client: old.client.clone(),
            login,
        },
    );
    let mut out = json!({
        "accessToken": access,
        "clientToken": old.client,
        "selectedProfile": profile_brief(&u.profile),
    });
    if r.request_user {
        out["user"] = user_json(&u);
    }
    Ok(Json(out))
}

async fn validate(State(st): State<AppState>, Json(r): Json<TokenReq>) -> R<StatusCode> {
    let s = st.store.lock().unwrap();
    token_ok(&s, &r)
        .map(|_| StatusCode::NO_CONTENT)
        .ok_or_else(|| forbidden("Invalid token."))
}

async fn invalidate(State(st): State<AppState>, Json(r): Json<TokenReq>) -> StatusCode {
    st.store.lock().unwrap().tokens.remove(&r.access_token);
    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
struct SignoutReq {
    username: String,
    password: String,
}

async fn signout(State(st): State<AppState>, Json(r): Json<SignoutReq>) -> R<StatusCode> {
    let mut s = st.store.lock().unwrap();
    match find_user(&s, &r.username) {
        Some(u) if verify_password(&r.password, &u.pass_hash) => {
            let l = u.login.to_lowercase();
            s.tokens.retain(|_, t| t.login != l);
            Ok(StatusCode::NO_CONTENT)
        }
        _ => Err(forbidden(
            "Invalid credentials. Invalid username or password.",
        )),
    }
}

#[derive(Deserialize)]
struct JoinReq {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "selectedProfile")]
    selected_profile: String,
    #[serde(rename = "serverId")]
    server_id: String,
}

async fn join(State(st): State<AppState>, Json(r): Json<JoinReq>) -> R<StatusCode> {
    let mut s = st.store.lock().unwrap();
    let login = s
        .tokens
        .get(&r.access_token)
        .map(|t| t.login.clone())
        .ok_or_else(|| forbidden("Invalid token."))?;
    let u = s
        .users
        .get(&login)
        .ok_or_else(|| forbidden("Invalid token."))?;
    if u.profile.id != r.selected_profile.replace('-', "").to_lowercase() {
        return Err(forbidden("Invalid token."));
    }
    let pid = u.profile.id.clone();
    s.joins.retain(|_, j| j.at.elapsed() < JOIN_TTL);
    s.joins.insert(
        r.server_id,
        Join {
            profile_id: pid,
            at: Instant::now(),
        },
    );
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct HasJoinedQ {
    username: String,
    #[serde(rename = "serverId")]
    server_id: String,
}

async fn has_joined(State(st): State<AppState>, Query(q): Query<HasJoinedQ>) -> Response {
    let s = st.store.lock().unwrap();
    let Some(j) = s.joins.get(&q.server_id) else {
        return StatusCode::NO_CONTENT.into_response();
    };
    if j.at.elapsed() >= JOIN_TTL {
        return StatusCode::NO_CONTENT.into_response();
    }
    let prof = s
        .users
        .values()
        .map(|u| &u.profile)
        .find(|p| p.id == j.profile_id && p.name.eq_ignore_ascii_case(&q.username));
    match prof {
        Some(p) => Json(profile_full(&st, p, true)).into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    }
}

#[derive(Deserialize)]
struct ProfileQ {
    unsigned: Option<bool>,
}

async fn profile_by_uuid(
    State(st): State<AppState>,
    Path(uuid): Path<String>,
    Query(q): Query<ProfileQ>,
) -> Response {
    let id = uuid.replace('-', "").to_lowercase();
    let s = st.store.lock().unwrap();
    match s.users.values().map(|u| &u.profile).find(|p| p.id == id) {
        Some(p) => Json(profile_full(&st, p, !q.unsigned.unwrap_or(true))).into_response(),
        None => StatusCode::NO_CONTENT.into_response(),
    }
}

async fn profiles_by_names(
    State(st): State<AppState>,
    Json(names): Json<Vec<String>>,
) -> R<Json<Value>> {
    if names.len() > 100 {
        return Err(illegal("Not more than 100 names per request."));
    }
    let s = st.store.lock().unwrap();
    let out: Vec<Value> = names
        .iter()
        .filter_map(|n| {
            s.users
                .values()
                .map(|u| &u.profile)
                .find(|p| p.name.eq_ignore_ascii_case(n))
                .map(profile_brief)
        })
        .collect();
    Ok(Json(Value::Array(out)))
}

#[derive(Deserialize)]
struct TexturesReq {
    skin_url: Option<String>,
    skin_model: Option<String>,
    cape_url: Option<String>,
}

fn host_allowed(cfg: &Config, url: &str) -> bool {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"));
    let Some(rest) = rest else { return false };
    let host = rest.split(['/', ':']).next().unwrap_or("");
    cfg.skin_domains
        .iter()
        .any(|d| host == d || host.ends_with(&format!(".{d}")))
}

/// Luminos extension (not part of Yggdrasil): point your profile at texture URLs hosted by luminos-cosmetics.
async fn set_textures(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(r): Json<TexturesReq>,
) -> R<Json<Value>> {
    let tok = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| forbidden("Missing bearer token."))?
        .to_string();
    for u in [&r.skin_url, &r.cape_url].into_iter().flatten() {
        if !host_allowed(&st.cfg, u) {
            return Err(illegal("Texture host is not in this server's skinDomains."));
        }
    }
    if let Some(m) = &r.skin_model {
        if m != "default" && m != "slim" {
            return Err(illegal("skin_model must be \"default\" or \"slim\"."));
        }
    }
    let mut s = st.store.lock().unwrap();
    let login = s
        .tokens
        .get(&tok)
        .map(|t| t.login.clone())
        .ok_or_else(|| forbidden("Invalid token."))?;
    let u = s
        .users
        .get_mut(&login)
        .ok_or_else(|| forbidden("Invalid token."))?;
    u.profile.skin_url = r.skin_url;
    if let Some(m) = r.skin_model {
        u.profile.skin_model = m;
    }
    u.profile.cape_url = r.cape_url;
    let out = profile_brief(&u.profile);
    st.persist(&s);
    Ok(Json(out))
}
