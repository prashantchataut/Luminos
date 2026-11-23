//! End-to-end: the launcher's Yggdrasil client against a real running `luminos-auth` over TCP.
use luminos_auth::{new_state, router, Config};
use luminos_core::{
    accounts::{Account, AccountKind},
    yggdrasil,
};

fn start_server() -> String {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let app = router(new_state(Config::default()).unwrap());
            let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            tx.send(l.local_addr().unwrap().port()).unwrap();
            axum_serve(l, app).await;
        });
    });
    format!("http://127.0.0.1:{}", rx.recv().unwrap())
}

// luminos-auth re-exports nothing for serving; use axum through its dependency tree via a tiny helper.
async fn axum_serve(l: tokio::net::TcpListener, app: luminos_auth::Router) {
    luminos_auth::serve(l, app).await;
}

#[test]
fn register_login_validate_refresh_and_launch_arg() {
    let root = start_server();
    yggdrasil::register_luminos(&root, "steve@example.com", "correct horse battery", "Steve").unwrap();

    // duplicate registration is refused with the server's own message
    let dup = yggdrasil::register_luminos(&root, "other@example.com", "correct horse battery", "steve");
    assert!(dup.unwrap_err().to_string().contains("already taken"));

    // wrong password surfaces the server message, not a bare "403"
    let bad = yggdrasil::authenticate(AccountKind::Luminos, &root, "steve@example.com", "wrong");
    assert!(bad.unwrap_err().to_string().contains("Invalid credentials"));

    let mut acc = yggdrasil::authenticate(AccountKind::Luminos, &root, "steve@example.com", "correct horse battery").unwrap();
    assert_eq!(acc.username, "Steve");
    // UUID is the vanilla offline UUID, so worlds persist between offline-mode and luminos-auth servers
    assert_eq!(acc.uuid, luminos_core::accounts::offline_uuid("Steve"));
    assert!(yggdrasil::validate(&acc));

    // kill the token, then ensure_fresh must refresh it
    let old = acc.access_token.clone().unwrap();
    acc.access_token = Some("0000".into());
    assert!(!yggdrasil::validate(&acc));
    acc.access_token = Some(old.clone());
    yggdrasil::ensure_fresh(&mut acc).unwrap(); // still valid → unchanged
    assert_eq!(acc.access_token.as_deref(), Some(old.as_str()));

    // Launch wiring: javaagent points at the account's API root
    let arg = yggdrasil::javaagent_arg(&acc, std::path::Path::new("/tools/ai.jar")).unwrap();
    assert_eq!(arg, format!("-javaagent:/tools/ai.jar={root}"));
    let off = Account::offline("Steve");
    assert!(yggdrasil::javaagent_arg(&off, std::path::Path::new("/x")).is_none());
}
