//! Login-mode probe against a REAL Minecraft server process. Ignored by default; run by
//! `tools/ci/server-login-test.sh` which boots vanilla with `online-mode=false` and `=true`.
//!
//!   LUMINOS_TEST_SERVER=127.0.0.1:25599 LUMINOS_TEST_EXPECT=offline cargo test -p luminos-core --test live_server -- --ignored
use luminos_core::{
    loginprobe::{self, LoginMode},
    servers,
};

#[test]
#[ignore]
fn real_server_login_mode_matches_expectation() {
    let addr = std::env::var("LUMINOS_TEST_SERVER").expect("LUMINOS_TEST_SERVER");
    let expect = std::env::var("LUMINOS_TEST_EXPECT").expect("LUMINOS_TEST_EXPECT");
    let st = servers::ping(&addr).expect("status ping");
    println!(
        "server: {} protocol {} motd {:?} latency {} ms",
        st.version, st.protocol, st.motd, st.latency_ms
    );
    let mode = loginprobe::probe(&addr, st.protocol, "LuminosTest").expect("login probe");
    println!("login mode: {mode:?}");
    match expect.as_str() {
        "offline" => assert_eq!(mode, LoginMode::OfflineOk),
        "online" => assert_eq!(mode, LoginMode::OnlineRequired),
        other => panic!("bad LUMINOS_TEST_EXPECT {other}"),
    }
}
