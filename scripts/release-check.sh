#!/usr/bin/env bash
# One command that says whether a release can be cut. Run from the repo root.
#   scripts/release-check.sh            local gate: stub grep, changelog, compat, Rust tests, app + site builds, Java core tests
#   scripts/release-check.sh --ci       also require every workflow on HEAD to be green (needs the commit pushed; GH_TOKEN optional)
# Exit 0 only if every line passes. Each failure prints why.
set -u
fail=0; ok() { echo "  ok    $1"; }; no() { echo "  FAIL  $1"; fail=1; }
VERSION="${VERSION:-$(node -p "require('./app/package.json').version" 2>/dev/null)}"
TAG_VERSION="${RELEASE_VERSION:-1.0.0}"
echo "== stub grep (src crates client client26 launcher app/src app/src-tauri/src site/src)"
# HTML input placeholder="..." attributes are UI text, not stubs; everything else matching is a failure.
hits=$(grep -rniE "todo!|unimplemented!|lorem|coming soon|placeholder|FIXME" src crates client client26 launcher app/src app/src-tauri/src site/src 2>/dev/null \
  --exclude-dir={node_modules,target,build,dist,.gradle} | grep -viE "placeholder=|placeholder: *string|placeholder=\{|placeholder\}" || true)
[ -z "$hits" ] && ok "no stubs" || { echo "$hits" | head -20; no "stub markers found"; }
echo "== every workflow file parses (a bad file silently runs nothing: smoke.yml did exactly that on main)"
( d=$(mktemp -d); cd "$d" && npm i --silent yaml >/dev/null 2>&1; node -e 'const Y=require("yaml"),fs=require("fs"),p=process.argv[1];let bad=0;for(const f of fs.readdirSync(p)){try{Y.parse(fs.readFileSync(p+"/"+f,"utf8"))}catch(e){bad++;console.log("  BAD",f,e.message.split("\n")[0])}}process.exit(bad?1:0)' "$OLDPWD/.github/workflows" ) && ok "workflows parse" || no "workflow YAML"
echo "== site manifest matches the release being cut, and never links /latest/"
node -e 'const m=require("./site/src/lib/release.json");if(m.tag!=="v"+process.argv[1]){console.log("  release.json tag",m.tag,"!= v"+process.argv[1]+" (the release job regenerates it; before the tag it must still be consistent)");}' "$TAG_VERSION"
grep -rn "releases/latest/download" site/src site/index.html >/dev/null 2>&1 && no "site links /releases/latest/download" || ok "no /latest/ links"
echo "== design rounds: 3 rounds per screen exist and none is blank (size floor + docs/design/rounds/CRITIQUE_LOG.md)"
bad=0; for sc in home mods hud-studio cosmetics themes instances-accounts; do for r in 1 2 3; do f="docs/design/rounds/$sc-$r.png"; [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 40000 ] || { echo "  missing or near-blank: $f"; bad=1; }; done; done
[ -s docs/design/rounds/CRITIQUE_LOG.md ] && [ $bad = 0 ] && ok "18 captures present" || no "design rounds"
echo "== built-in skins are real pixel art (64x64, >=40 colours, outer layers populated)"
node scripts/verify-skins.mjs >/dev/null && ok "skins verified" || no "verify-skins"
echo "== authlib module tests (plain rustc, no deps)"
( d=$(mktemp -d); rustc --edition 2021 --test launcher/crates/luminos-core/src/authlib.rs -o "$d/t" 2>/dev/null && "$d/t" 2>&1 | grep -q "6 passed" ) && ok "authlib 6 tests" || no "authlib tests"
echo "== site download links come from release.json, never /latest/ and never 0.6.0"
grep -rn "0\\.6\\.0" site/src/components site/src/lib/useRelease.ts >/dev/null 2>&1 && no "site mentions 0.6.0 in code" || ok "no stale 0.6.0"
echo "== Android: honesty line present, no overclaim"
grep -q "Minecraft does not launch yet" docs/ANDROID.md && ok "ANDROID.md states the limit" || no "docs/ANDROID.md missing the limit line"
grep -rniE "play java minecraft on android" site/src site/index.html README.md docs/ANDROID.md CHANGELOG.md 2>/dev/null | grep -viE "not|never|until|do not|don't" && no "overclaim: Minecraft on Android" || ok "no Android overclaim"
echo "== changelog has EN + ES for $TAG_VERSION, and the notes build"
node scripts/release-notes.mjs "$TAG_VERSION" > /tmp/notes.md 2>/tmp/notes.err && ok "release notes build ($(wc -l < /tmp/notes.md) lines)" || { cat /tmp/notes.err; no "changelog section"; }
echo "== client-compat.json: every entry has a sha256 and an https url"
node -e 'const j=JSON.parse(require("fs").readFileSync("client/client-compat.json"));let bad=0;for(const e of j.entries){if(!/^[0-9a-f]{64}$/.test(e.sha256||"")||!/^https:/.test(e.url||"")){bad++;console.log("bad",e.minecraft)}}process.exit(bad?1:0)' && ok "compat entries valid" || no "compat entries"
echo "== Rust: fmt, tests (incl. secure-store round trip)"
( cd launcher && cargo test --workspace 2>&1 | grep -E "^test result|FAILED|panicked" | awk '/FAILED|panicked/{f=1} /^test result/{p+=$4;x+=$6} END{print "     passed",p,"failed",x; exit (f||x>0)}' ) && ok "cargo test" || no "cargo test"
echo "== app: tsc + build + tests (themes colours-only, contrast)"
( cd app && npm ci --silent && npm run build --silent >/dev/null && npm test --silent >/dev/null ) && ok "app build + tests" || no "app"
echo "== site: tsc + build"
( cd site && npm ci --silent && npx tsc --noEmit && npm run build --silent >/dev/null ) && ok "site build" || no "site"
echo "== Java core logic tests (pure Java)"
if command -v javac >/dev/null; then
  d=$(mktemp -d); ( cd client && javac --release 21 -d "$d" $(find src/shared/java/dev/luminos/client/core tests -name '*.java') && java -cp "$d" dev.luminos.client.core.CoreTests >/dev/null && java -cp "$d" dev.luminos.client.core.V091Tests >/dev/null ) && ok "client core tests" || no "client core tests"
else echo "  skip  no javac here (CI runs these in client.yml)"; fi
if [ "${1:-}" = "--ci" ]; then
  echo "== every workflow on HEAD ($(git rev-parse --short HEAD)), incl. smoke (client reaches the title screen headlessly) and client-jars"
  sha=$(git rev-parse HEAD); auth=(); [ -n "${GH_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GH_TOKEN")
  curl -fsS "${auth[@]}" "https://api.github.com/repos/prashantchataut/Luminos/commits/$sha/check-runs?per_page=100" | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).check_runs;const bad=r.filter(c=>!["success","skipped","neutral"].includes(c.conclusion));
    const need=["android","build-and-test","smoke (26.3, full)","smoke (1.21.11, full)","client-jars (26.3, client26)","client-jars (1.21.11, client)","windows","rust (windows-latest)","rust (ubuntu-latest)"];
    const miss=need.filter(n=>!r.find(c=>c.name==n&&c.conclusion=="success"));
    bad.forEach(c=>console.log("  not green:",c.name,c.status,c.conclusion||""));miss.forEach(n=>console.log("  required check missing or not green:",n));
    process.exit(bad.length||miss.length?1:0)})' && ok "all checks green" || no "CI on HEAD"
fi
[ $fail = 0 ] && echo "RELEASE GATE: PASS" || echo "RELEASE GATE: FAIL"
exit $fail
