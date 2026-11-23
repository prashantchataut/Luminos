//! A1f: no URL literal in the launcher sources may point at a host that is not in the registry.
//! Adding a new endpoint without registering (and explaining) it fails this test.
use luminos_core::netaudit;
use std::{fs, path::Path};

/// Literals that are *not* requests made by Luminos. Keep this list short and justified.
const NOT_A_REQUEST: &[(&str, &str)] = &[
    ("www.w3.org", "SVG xml namespace string"),
    (
        "auth.xboxlive.com",
        "Xbox relying-party identifier inside a JSON body, not a request target",
    ),
    (
        "microsoft.com",
        "verification URL the user opens in their browser (shown in a unit test / UI)",
    ),
    ("www.minecraft.net", "link opened in the user's browser"),
    ("x", "placeholder host in unit-test fixtures"),
    ("join", "luminos://join parser test fixture"),
    ("your-luminos-auth.example", "UI hint text"),
    (
        "auth.luminos.invalid",
        "placeholder API root; `.invalid` never resolves",
    ),
];

/// RFC 2606 names reserved for documentation/tests; they can never be a real tracker.
fn is_reserved_fixture(host: &str) -> bool {
    host.ends_with(".example")
        || host.ends_with(".invalid")
        || ["example.com", "example.net", "example.org"]
            .iter()
            .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

fn walk(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
    for e in fs::read_dir(dir).unwrap().flatten() {
        let p = e.path();
        if p.is_dir() {
            walk(&p, out);
        } else if p.extension().is_some_and(|x| x == "rs") {
            out.push(p);
        }
    }
}

#[test]
fn every_url_literal_host_is_registered() {
    let crates = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    let mut files = vec![];
    for c in ["luminos-core", "luminos-app", "luminos-auth"] {
        walk(&crates.join(c).join("src"), &mut files);
    }
    assert!(
        files.len() > 20,
        "scan found too few files: {}",
        files.len()
    );

    let mut offenders = vec![];
    let mut seen = 0;
    for f in files {
        // The registry itself and this test describe hosts without requesting them.
        if f.ends_with("netaudit.rs") {
            continue;
        }
        let text = fs::read_to_string(&f).unwrap();
        for (ln, line) in text.lines().enumerate() {
            let mut rest = line;
            while let Some(i) = rest.find("http") {
                let cand = &rest[i..];
                rest = &rest[i + 4..];
                if !(cand.starts_with("https://") || cand.starts_with("http://")) {
                    continue;
                }
                let end = cand
                    .find(|c: char| {
                        c.is_whitespace() || matches!(c, '"' | '\'' | '\\' | ')' | '>' | '<' | '`')
                    })
                    .unwrap_or(cand.len());
                let url = &cand[..end];
                let Some(host) = netaudit::host_of(url) else {
                    continue;
                };
                if host.contains('{') || netaudit::is_loopback(&host) {
                    continue; // templated host or loopback
                }
                seen += 1;
                let ok = netaudit::lookup(&host).is_some()
                    || is_reserved_fixture(&host)
                    || NOT_A_REQUEST.iter().any(|(h, _)| *h == host);
                if !ok {
                    offenders.push(format!("{}:{}: {url}", f.display(), ln + 1));
                }
            }
        }
    }
    assert!(
        seen > 15,
        "scan saw only {seen} URLs; the scanner is broken"
    );
    assert!(
        offenders.is_empty(),
        "unregistered hosts in source:\n{}",
        offenders.join("\n")
    );
}

#[test]
fn github_issue_link_host_is_registered() {
    // directory.rs builds a github.com issue link that the user opens in a browser.
    assert!(netaudit::lookup("github.com").is_some());
}
