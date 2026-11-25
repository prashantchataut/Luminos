# STATUS (session 19b, PR #19 on top of merged #18)

**VERIFIED** = a command ran and its output was read. **UNVERIFIED** = built, not exercised where it matters. **NOT BUILT** = does not exist. **DEFERRED** = left out on purpose, reason given.

| Area | State | Evidence / reason |
|---|---|---|
| PR #18 | **VERIFIED merged** (`ce4f6da`, before this session started) | It was already merged when this session began; its body described an earlier state. Not redone. |
| Tauri crate compiles on Windows and Linux (and macOS) | **VERIFIED** in CI (`tauri.yml`, jobs `rust (windows-latest)`, `rust (ubuntu-latest)`, `rust (macos-latest)`) | green on main after #18 and on this PR |
| Engine wired through Tauri commands (dedup, deps, redact, quickplay, discord) + typed TS bindings | **VERIFIED compiles; command names checked by `app/tools/bindings.test.mjs`**. **Never run inside a Tauri window.** Quick Play has **no UI button (NOT BUILT)** | `app/src-tauri/src/engine.rs` |
| "This branch has not been deployed" check | **EXPLAINED**: the `github-pages` environment only accepts `main`, so a PR branch can never deploy. `pages.yml` builds the site on PRs and deploys + verifies on main (comment at the top of the file). | `.github/workflows/pages.yml` |
| `smoke.yml` | **FIXED**: it was invalid YAML (unquoted `: ` in a step name), produced zero jobs and had never run on main, so #18's "agent e2e in CI" had not executed there. It now parses and runs; `scripts/release-check.sh` lints every workflow file. | commit on this PR |
| Live apply (Luminos modules, resource packs) | **VERIFIED on 1.21.11 at the title screen**; **third-party mods queue by design (DEFERRED: unloading them)**; 26.3 jar compiles, **not run**; pause with a world open **UNVERIFIED** | `docs/LIVE_SWAP.md`, `docs/research/agent-e2e/` |
| P2P, reflinks, cross-instance saves UI, live apply of third-party mods | **DEFERRED** by decision (they did not block the release; each needs a second machine, a filesystem we do not have, or a research-licence decision). Engine parts keep their tests. | `docs/P2P.md`, `docs/LIVE_SWAP.md` |
| Discord presence | Compiled; **sends nothing until the owner registers an application** | `docs/DISCORD.md` |
| Microsoft sign-in | **UNVERIFIED** (needs the owner's Azure app) | `docs/MICROSOFT_AUTH.md` |
| Sandbox | **NOT BUILT, by decision** | `docs/SECURITY.md` |
| Android APK | **VERIFIED built by CI** (`android` job in `release.yml` and `android.yml`), debug-signed, ABIs arm64-v8a + x86_64, min Android 8.0. **VERIFIED installs, opens and drives onboarding, home, library, skins, settings on an Android 11 x86_64 emulator, job fails on crash/ANR**. Screenshots in `docs/android-shots/`. **Never run on a real device. arm64 never run.** | `docs/ANDROID.md` |
| Minecraft on Android | **NOT BUILT**: no GL layer, no window/input layer. Labelled everywhere as a launcher preview. No GL code was written this session (reason in ANDROID.md). | `docs/ANDROID.md` |
| Skills (ui-skills.com CLI) | **VERIFIED run**: categories, four category lists, full catalog; 15 skills fetched; 12 opened (rules read), `12-principles-of-animation` unavailable from the CLI. Reference files linked from SKILL.md files were not fetched. | `docs/SKILLS_SESSION19.md` |
| improve-ui audits | Launcher: **no supported findings** by the skill's proof gate, two low-confidence candidates, `app/src` not traced. Site: 2 findings fixed. | `docs/design/AUDIT.md`, `docs/design/SITE_AUDIT.md` |
| Site rebuild | Built from the release manifest, new captures, themes, Android section with matrix, metadata, a11y fixes. **Live URL screenshot and Lighthouse: recorded in `docs/live-site/` only if the post-deploy job ran (see START_HERE).** | `site/` |
| Captures | Session-19 launcher captures: Home, Library, Cosmetics, Live panel (two states), three themes were **looked at this session**. Android: five screens looked at. | `docs/launcher-shots/session19/`, `docs/android-shots/` |
| Release pipeline `release.yml` | The PR run (no tag) built Windows installer, Android, both client jars. **The tagged run, publish, attestation, update-check: see START_HERE for the result (updated after the tag).** | |
| Windows real desktop / ARM64 | **Not run** (runner only) | `docs/REAL_DESKTOP_CHECKLIST.md` |
| Code signing | **NOT DONE**: Windows build unsigned, APK debug-signed | `docs/SIGNING.md` |
| Stub grep | clean (`scripts/release-check.sh`) | |
