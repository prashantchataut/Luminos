//! Yggdrasil endpoint conformance tests. These drive the real axum router in-process.
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use http_body_util::BodyExt;
use luminos_auth::{new_state, offline_uuid_undashed, router, Config};
use rsa::{
    pkcs1v15::{Signature, VerifyingKey},
    pkcs8::DecodePublicKey,
    signature::Verifier,
    RsaPublicKey,
};
use serde_json::{json, Value};
use tower::ServiceExt;

fn app() -> Router {
    router(
        new_state(Config {
            skin_domains: vec!["cdn.luminos.test".into()],
            ..Config::default()
        })
        .unwrap(),
    )
}

async fn call(
    app: &Router,
    method: Method,
    uri: &str,
    body: Option<Value>,
    bearer: Option<&str>,
) -> (StatusCode, Value) {
    let mut rb = Request::builder().method(method).uri(uri);
    if body.is_some() {
        rb = rb.header("content-type", "application/json");
    }
    if let Some(b) = bearer {
        rb = rb.header("authorization", format!("Bearer {b}"));
    }
    let req = rb
        .body(
            body.map(|b| Body::from(b.to_string()))
                .unwrap_or_else(Body::empty),
        )
        .unwrap();
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let v = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, v)
}

async fn post(app: &Router, uri: &str, b: Value) -> (StatusCode, Value) {
    call(app, Method::POST, uri, Some(b), None).await
}

async fn register(app: &Router, login: &str, name: &str) {
    let (s, _) = post(
        app,
        "/luminos/register",
        json!({"login": login, "password": "hunter2hunter2", "playerName": name}),
    )
    .await;
    assert_eq!(s, StatusCode::CREATED);
}

async fn login(app: &Router, who: &str) -> Value {
    let (s, v) = post(
        app,
        "/authserver/authenticate",
        json!({"username": who, "password": "hunter2hunter2", "requestUser": true, "agent": {"name": "Minecraft", "version": 1}}),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{v}");
    v
}

#[test]
fn offline_uuid_matches_java_name_uuid_from_bytes() {
    // Value produced by java.util.UUID.nameUUIDFromBytes("OfflinePlayer:Notch".getBytes(UTF_8))
    assert_eq!(
        offline_uuid_undashed("Notch"),
        "b50ad385829d3141a2167e7d7539ba7f"
    );
}

#[tokio::test]
async fn metadata_has_required_fields() {
    let a = app();
    let (s, v) = call(&a, Method::GET, "/", None, None).await;
    assert_eq!(s, StatusCode::OK);
    assert!(v["meta"]["serverName"].is_string());
    assert_eq!(v["skinDomains"][0], "cdn.luminos.test");
    assert!(v["signaturePublickey"]
        .as_str()
        .unwrap()
        .contains("BEGIN PUBLIC KEY"));
}

#[tokio::test]
async fn register_authenticate_profile_uses_offline_uuid() {
    let a = app();
    register(&a, "notch@example.com", "Notch").await;
    let v = login(&a, "notch@example.com").await;
    assert_eq!(
        v["selectedProfile"]["id"],
        "b50ad385829d3141a2167e7d7539ba7f"
    );
    assert_eq!(v["selectedProfile"]["name"], "Notch");
    assert_eq!(v["availableProfiles"].as_array().unwrap().len(), 1);
    assert!(v["accessToken"].as_str().unwrap().len() >= 32);
    assert_eq!(v["user"]["id"], v["selectedProfile"]["id"]);
    // player-name login also works (feature.non_email_login)
    login(&a, "Notch").await;
}

#[tokio::test]
async fn duplicate_and_invalid_registration_rejected() {
    let a = app();
    register(&a, "a@x.io", "Alex").await;
    let (s, v) = post(
        &a,
        "/luminos/register",
        json!({"login":"b@x.io","password":"longenough1","playerName":"alex"}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN, "{v}");
    let (s, _) = post(
        &a,
        "/luminos/register",
        json!({"login":"c@x.io","password":"short","playerName":"Bob"}),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = post(
        &a,
        "/luminos/register",
        json!({"login":"c@x.io","password":"longenough1","playerName":"bad name!"}),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn wrong_password_is_403_then_locked_out() {
    let a = app();
    register(&a, "s@x.io", "Steve").await;
    for _ in 0..5 {
        let (s, v) = post(
            &a,
            "/authserver/authenticate",
            json!({"username":"s@x.io","password":"nope"}),
        )
        .await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        assert_eq!(v["error"], "ForbiddenOperationException");
    }
    let (s, v) = post(
        &a,
        "/authserver/authenticate",
        json!({"username":"s@x.io","password":"hunter2hunter2"}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
    assert!(v["errorMessage"].as_str().unwrap().contains("Too many"));
}

#[tokio::test]
async fn validate_refresh_invalidate_signout() {
    let a = app();
    register(&a, "s@x.io", "Steve").await;
    let v = login(&a, "s@x.io").await;
    let (at, ct) = (
        v["accessToken"].as_str().unwrap(),
        v["clientToken"].as_str().unwrap(),
    );

    let (s, _) = post(&a, "/authserver/validate", json!({"accessToken": at})).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = post(
        &a,
        "/authserver/validate",
        json!({"accessToken": at, "clientToken": "other"}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    let (s, r) = post(
        &a,
        "/authserver/refresh",
        json!({"accessToken": at, "clientToken": ct}),
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let at2 = r["accessToken"].as_str().unwrap().to_string();
    assert_ne!(at2, at);
    assert_eq!(r["clientToken"], ct);
    let (s, _) = post(&a, "/authserver/validate", json!({"accessToken": at})).await;
    assert_eq!(
        s,
        StatusCode::FORBIDDEN,
        "old token must be dead after refresh"
    );

    let (s, _) = post(&a, "/authserver/invalidate", json!({"accessToken": at2})).await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = post(&a, "/authserver/validate", json!({"accessToken": at2})).await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    let v = login(&a, "s@x.io").await;
    let (s, _) = post(
        &a,
        "/authserver/signout",
        json!({"username":"s@x.io","password":"hunter2hunter2"}),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = post(
        &a,
        "/authserver/validate",
        json!({"accessToken": v["accessToken"]}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn join_then_has_joined_with_verifiable_signature() {
    let a = app();
    register(&a, "s@x.io", "Steve").await;
    let v = login(&a, "s@x.io").await;
    let pid = v["selectedProfile"]["id"].as_str().unwrap();

    let (s, _) = post(
        &a,
        "/sessionserver/session/minecraft/join",
        json!({"accessToken": v["accessToken"], "selectedProfile": pid, "serverId": "abc123"}),
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);

    let (s, _) = call(
        &a,
        Method::GET,
        "/sessionserver/session/minecraft/hasJoined?username=Steve&serverId=zzz",
        None,
        None,
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call(
        &a,
        Method::GET,
        "/sessionserver/session/minecraft/hasJoined?username=Alex&serverId=abc123",
        None,
        None,
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);

    let (s, p) = call(
        &a,
        Method::GET,
        "/sessionserver/session/minecraft/hasJoined?username=Steve&serverId=abc123&ip=127.0.0.1",
        None,
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(p["id"], pid);
    let prop = &p["properties"][0];
    assert_eq!(prop["name"], "textures");

    // The signature must verify against the public key published at "/".
    let (_, meta) = call(&a, Method::GET, "/", None, None).await;
    let pk =
        RsaPublicKey::from_public_key_pem(meta["signaturePublickey"].as_str().unwrap()).unwrap();
    let vk = VerifyingKey::<sha1::Sha1>::new(pk);
    let sig = Signature::try_from(
        B64.decode(prop["signature"].as_str().unwrap())
            .unwrap()
            .as_slice(),
    )
    .unwrap();
    vk.verify(prop["value"].as_str().unwrap().as_bytes(), &sig)
        .expect("signature verifies");
    let decoded: Value =
        serde_json::from_slice(&B64.decode(prop["value"].as_str().unwrap()).unwrap()).unwrap();
    assert_eq!(decoded["profileName"], "Steve");

    let (s, _) = post(
        &a,
        "/sessionserver/session/minecraft/join",
        json!({"accessToken": v["accessToken"], "selectedProfile": "00000000000000000000000000000000", "serverId": "q"}),
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn profile_endpoint_signing_and_bulk_lookup() {
    let a = app();
    register(&a, "s@x.io", "Steve").await;
    let v = login(&a, "s@x.io").await;
    let pid = v["selectedProfile"]["id"].as_str().unwrap();

    let (s, p) = call(
        &a,
        Method::GET,
        &format!("/sessionserver/session/minecraft/profile/{pid}"),
        None,
        None,
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert!(
        p["properties"][0]["signature"].is_null(),
        "unsigned by default"
    );
    let (_, p) = call(
        &a,
        Method::GET,
        &format!("/sessionserver/session/minecraft/profile/{pid}?unsigned=false"),
        None,
        None,
    )
    .await;
    assert!(p["properties"][0]["signature"].is_string());
    let (s, _) = call(
        &a,
        Method::GET,
        "/sessionserver/session/minecraft/profile/ffffffffffffffffffffffffffffffff",
        None,
        None,
    )
    .await;
    assert_eq!(s, StatusCode::NO_CONTENT);

    let (s, r) = post(&a, "/api/profiles/minecraft", json!(["steve", "Nobody"])).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(r.as_array().unwrap().len(), 1);
    assert_eq!(r[0]["id"], pid);
}

#[tokio::test]
async fn textures_flow_through_the_standard_profile_endpoint() {
    let a = app();
    register(&a, "s@x.io", "Steve").await;
    let v = login(&a, "s@x.io").await;
    let at = v["accessToken"].as_str().unwrap();
    let pid = v["selectedProfile"]["id"].as_str().unwrap();

    let (s, _) = call(
        &a,
        Method::PUT,
        "/luminos/profile/textures",
        Some(json!({"skin_url":"https://evil.example/s.png"})),
        Some(at),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call(
        &a,
        Method::PUT,
        "/luminos/profile/textures",
        Some(json!({})),
        None,
    )
    .await;
    assert_eq!(s, StatusCode::FORBIDDEN);

    let (s, _) = call(
        &a,
        Method::PUT,
        "/luminos/profile/textures",
        Some(json!({"skin_url":"https://cdn.luminos.test/skins/a.png","skin_model":"slim","cape_url":"https://cdn.luminos.test/capes/c.png"})),
        Some(at),
    )
    .await;
    assert_eq!(s, StatusCode::OK);

    let (_, p) = call(
        &a,
        Method::GET,
        &format!("/sessionserver/session/minecraft/profile/{pid}"),
        None,
        None,
    )
    .await;
    let val: Value = serde_json::from_slice(
        &B64.decode(p["properties"][0]["value"].as_str().unwrap())
            .unwrap(),
    )
    .unwrap();
    assert_eq!(
        val["textures"]["SKIN"]["url"],
        "https://cdn.luminos.test/skins/a.png"
    );
    assert_eq!(val["textures"]["SKIN"]["metadata"]["model"], "slim");
    assert_eq!(
        val["textures"]["CAPE"]["url"],
        "https://cdn.luminos.test/capes/c.png"
    );
}
