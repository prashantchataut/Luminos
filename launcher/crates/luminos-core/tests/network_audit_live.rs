//! A1g: exercise the real endpoints Luminos uses through the audited HTTP layer, then assert that
//! every host actually contacted (redirect hops included) is in the registry and nothing was blocked.
//! Run with: `cargo test -p luminos-core --test network_audit_live -- --ignored --nocapture`
//! (needs internet; run in CI on every PR).
use luminos_core::{http, netaudit};

#[test]
#[ignore = "needs internet"]
fn every_contacted_host_is_registered() {
    netaudit::clear_activity();

    let urls: &[(&str, bool)] = &[
        ("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json", true),
        ("https://launchercontent.mojang.com/v2/javaPatchNotes.json", true),
        ("https://meta.fabricmc.net/v2/versions/loader/1.21.4", true),
        ("https://meta.quiltmc.org/v3/versions/loader/1.21.4", true),
        ("https://api.modrinth.com/v2/tag/game_version", true),
        ("https://api.adoptium.net/v3/info/available_releases", true),
        ("https://raw.githubusercontent.com/prashantchataut/Luminos/main/client/client-compat.json", true),
        // Redirect chain: Adoptium -> GitHub -> release CDN. Headers only; the body is dropped.
        ("https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jre/hotspot/normal/eclipse", false),
    ];
    for (u, read_body) in urls {
        let r = http::send_get(u, &[]);
        match r {
            Ok(mut resp) => {
                if *read_body {
                    let _ = resp.body_mut().read_to_vec();
                }
            }
            Err(e) => panic!("request to {u} failed: {e:#}"),
        }
    }

    let act = netaudit::activity();
    eprintln!("contacted hosts:");
    for a in &act {
        eprintln!("  {:<42} requests={} blocked={}", a.host, a.requests, a.blocked);
    }
    assert!(act.len() >= 6, "expected several hosts, got {act:?}");
    for a in &act {
        assert!(
            netaudit::lookup(&a.host).is_some(),
            "UNLISTED HOST CONTACTED: {}",
            a.host
        );
        assert_eq!(a.blocked, 0, "{} was blocked", a.host);
    }
    assert!(
        act.iter().any(|a| a.host == "github.com"),
        "redirect chain should have passed through github.com: {act:?}"
    );
}

#[test]
#[ignore = "needs internet"]
fn unlisted_host_is_blocked_before_any_traffic() {
    netaudit::clear_activity();
    let e = http::get_bytes("https://example.com/").unwrap_err();
    assert!(format!("{e:#}").contains("not on Luminos' network list"));
    let act = netaudit::activity();
    assert_eq!(act.len(), 1);
    assert_eq!((act[0].requests, act[0].blocked), (0, 1));
}
