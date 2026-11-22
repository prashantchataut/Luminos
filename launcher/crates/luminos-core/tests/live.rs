//! Live-network smoke tests. Run with: `cargo test -p luminos-core -- --ignored --test-threads=1`
use luminos_core::{
    instances::{Instance, Loader},
    modrinth, mojang, news, preset,
};

fn sandbox() {
    let dir = std::env::temp_dir().join("luminos-live-test");
    std::env::set_var("LUMINOS_HOME", dir);
}

#[test]
#[ignore]
fn manifest_has_a_latest_release() {
    sandbox();
    let m = mojang::fetch_manifest().expect("manifest");
    assert!(!m.latest.release.is_empty());
    assert!(m.versions.len() > 100);
}

#[test]
#[ignore]
fn fabric_profile_resolves_and_has_libraries() {
    sandbox();
    let m = mojang::fetch_manifest().unwrap();
    let inst = Instance { id: "t".into(), name: "t".into(), mc_version: m.latest.release.clone(), loader: Loader::Fabric, ..Default::default() };
    let v = mojang::resolve(&inst).expect("resolve fabric");
    assert!(v.main_class.contains("knot") || v.main_class.contains("Knot"), "main class was {}", v.main_class);
    assert!(v.libraries.iter().any(|l| l.name.contains("fabric-loader")));
    assert!(v.libraries.iter().any(|l| l.name.contains("lwjgl")));
    assert!(v.asset_index.is_some());
    let files: usize = v.libraries.iter().map(|l| mojang::lib_files(l).len()).sum();
    assert!(files > 20, "only {files} library files");
}

#[test]
#[ignore]
fn modrinth_search_and_versions() {
    let r = modrinth::search(&modrinth::SearchQuery { text: "sodium".into(), project_type: "mod".into(), sort: "downloads".into(), limit: 5, ..Default::default() }).unwrap();
    assert!(!r.hits.is_empty());
    let v = modrinth::versions("sodium", Some("fabric"), None).unwrap();
    assert!(modrinth::best_version(v).is_some());
}

#[test]
#[ignore]
fn every_luminos_client_slug_exists() {
    let slugs: Vec<String> = preset::LUMINOS_CLIENT.iter().map(|m| m.slug.to_string()).collect();
    let found = modrinth::projects(&slugs).unwrap();
    let have: Vec<String> = found.iter().map(|p| p.slug.clone()).collect();
    let missing: Vec<&String> = slugs.iter().filter(|s| !have.contains(s)).collect();
    assert!(missing.is_empty(), "missing from Modrinth: {missing:?}");
}

#[test]
#[ignore]
fn news_feed_parses() {
    let n = news::fetch(5).unwrap();
    assert!(!n.is_empty());
    assert!(n[0].image_url.is_some());
}
