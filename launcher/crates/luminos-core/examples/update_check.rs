//! Runs the launcher's real update check against GitHub and prints one JSON line. Used by the release workflow.
//! Usage: update_check <current-version> [--verify-download]   (set LUMINOS_UPDATE_PRERELEASE=1 to include release candidates)
use luminos_core::update;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let current = a.get(1).cloned().unwrap_or_else(|| "0.0.0".into());
    let verify = a.iter().any(|x| x == "--verify-download");
    match update::check(&current) {
        Ok(Some(r)) => {
            let mut out = serde_json::json!({"offered": true, "tag": r.tag, "version": r.version, "setup_url": r.setup_url, "has_sums": r.sums_url.is_some()});
            if verify {
                match update::download_verified(&r) {
                    Ok(p) => out["download_verified"] = serde_json::json!(p.to_string_lossy()),
                    Err(e) => {
                        out["download_error"] = format!("{e:#}").into();
                        println!("{out}");
                        std::process::exit(2);
                    }
                }
            }
            println!("{out}");
        }
        Ok(None) => println!("{}", serde_json::json!({"offered": false})),
        Err(e) => {
            println!("{}", serde_json::json!({"error": format!("{e:#}")}));
            std::process::exit(1);
        }
    }
}
