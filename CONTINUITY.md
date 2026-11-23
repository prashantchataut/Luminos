# CONTINUITY.md — Luminos Launcher progress log

> **Read this first, update it last.** Every session starts by reading this file and ends by updating it.
> Rules for agents live in [`AGENTS.md`](AGENTS.md). Research and ideas live in [`docs/RESEARCH.md`](docs/RESEARCH.md).

## Vision
Luminos is a light, fast, **all-Rust** Minecraft Java launcher with a dithered-blue identity, built-in mod library
(Modrinth), auto-updating content, per-instance isolation, playtime tracking, a skin studio, and a one-click optimised
"Luminos Client" bundle (Fabric + Sodium, Lithium, Entity Culling, Armor HUD, Mod Menu, …).

## Repository map
| Path | What |
|---|---|
| `launcher/crates/luminos-core` | Headless engine (no UI): instances, Mojang/Fabric/Quilt metadata, downloader, Java, launch, Modrinth, content manager, `.mrpack` import, playtime, skins, preset, news |
| `launcher/crates/luminos-app` | egui desktop UI (`luminos` binary) + headless screenshot renderer (`luminos-shots`) |
| `docs/screenshots/` | PNG renders of every screen, produced by `luminos-shots` from the *real* UI |
| `site/` (Vite + React + Tailwind) | GitHub Pages website; screenshots are copied in from `docs/screenshots` by the Pages workflow |
| `client/` | Luminos Client Fabric HUD mod |
| `installer/` | Inno Setup script for `Luminos-Setup.exe` |
| `brand/`, `tools/make_brand.py` | Logo (SVG/PNG/ICO) + installer art, generated from one pixel grid |
| `.github/workflows/` | `ci.yml` (fmt/clippy/test, 3 OSes), `pages.yml` (site deploy), `release.yml` (tag `v*` → Windows installer + Linux tarball), `client.yml` (HUD mod jar) |

## Status legend
✅ done & verified · 🟡 written, not yet verified end-to-end · ⬜ planned

## Session 6: multiplayer core, auth service, compat manifest (branch `feat/session-6-multiplayer-compat-tests`)
The sandbox now had Rust (rustup works) and a JRE, so core and UI could be built and run. Still no GPU, display, Windows, Android SDK, 1 GB RAM.
Full table: [`docs/AUDIT.md`](docs/AUDIT.md). Test evidence: [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md).

### Done and verified (ran it)
- ✅ `luminos-auth` (axum Yggdrasil, authlib-injector compatible): 9 conformance tests incl. RSA-SHA1 signature check.
- ✅ Launcher Yggdrasil client ↔ live `luminos-auth` over TCP (`yggdrasil_e2e`).
- ✅ Login-mode probe against a **real vanilla 1.21.4 server**: `online-mode=false` → OfflineOk, `true` → OnlineRequired (`tools/ci/server-login-test.sh`).
- ✅ Compat manifest resolver + hash-verified install; `preset::install_first_party` no longer installs a jar for the wrong Minecraft version.
- ✅ Servers page: favourites, login-mode badges, version fit, direct connect, invite-link copy, human online-mode message. Rendered and checked.
- ✅ Motion tokens (`motion.rs`, 4 tests) + staggered rows on Servers, honouring Reduce motion.
- ✅ 54 workspace tests pass. Java 25 / no-mappings for all 26.x confirmed from Mojang's version JSONs. Modrinth + Fabric availability confirmed for all candidate versions.

### Written but NOT run (🟡)
- Quick-join (`--quickPlayMultiplayer` / `--server`), authlib-injector `-javaagent` in a real game, Ely.by sign-in with real credentials, session refresh before launch.
- `tests.yml` matrix for 1.21.4/1.21.11/26.1.2/26.2/26.3 (never observed in CI).

### NOT done
- ❌ P0-B skins/capes/cosmetics service (design only: `docs/COSMETICS_SERVICE.md`); ❌ multi-version client build (Stonecutter); ❌ client features per version; utility wheel; ❌ headless smoke per version; ❌ Windows installer tests; ❌ code signing (owner action); ❌ LAN/host-a-world relay (evaluation in `docs/MULTIPLAYER.md`); ❌ directory UI page; ❌ `luminos://` URL handler; ❌ Microsoft sign-in wiring (needs Azure app id); ❌ motion beyond tokens + list stagger; ❌ Android (design only); ❌ recommendations list; ❌ cargo-deny run; ❌ teardown research; ❌ named skills not installed/used (see AUDIT).

### Next steps, in order
1. Run `tests.yml` on the PR; fix whatever the 26.x server jobs show.
2. Stonecutter multi-version client + `title_screen_reached.json` hook, then headless smoke matrix.
3. Wire Microsoft sign-in (Azure id), register `luminos://` handler, directory page.
4. Cosmetics service from `docs/COSMETICS_SERVICE.md`, then the skins tab rebuild.
5. Motion: launch-button morph, page transitions, animated sky with moon/clouds, pause on blur.

### Security note
The owner pasted a GitHub PAT in chat again. It was used only through one-off HTTP headers (never written to git config or files). **Revoke it** and use a fine-grained token.

## Session 5: website rebuilt (branch `feat/session-5-site-rebuild`)
Brief was the full rebuild (Rust app, client matrix, signing, cosmetics service, onboarding...). **This sandbox had no Rust,
Java, display or Windows**, so only the website could be built and checked. Nothing in `launcher/` or `client/` changed.

### Done and verified
- ✅ **Site rebuilt from scratch** in `site/` (Vite + React + Tailwind v4). Instrument Serif + Inter, bundled (no Google Fonts request).
  - Real **ordered-dither sky** (`site/src/lib/skyCore.ts`, 8x8 Bayer into a 9-colour blue palette): stars, a moon rising behind
    moonlit clouds in the hero, bright cloud bank in the closing section. Pauses off-screen, still frame under reduced motion.
  - Sections: hero, product frame, scroll-driven tour (5 real launcher renders), "what's in it" with Verified/Built status,
    Luminos Client, Modrinth gallery (credited), "what doesn't work yet", changelog, FAQ (incl. SmartScreen), download, footer;
    `#/privacy` and `#/license` pages.
  - **Download button reads the latest GitHub release** (`Luminos-Setup*.exe` asset + SHA256 asset). Loading, ready, none and
    error states are all designed. Verified live: it found v0.3.0, 4.8 MB.
- ✅ Verified in **headless Chromium** at 1440x900 and 390x844: no console errors, no horizontal overflow. Screenshots in `docs/screenshots/site/`.
- ✅ `tsc --noEmit` and `npm run build` pass. JS 73 KB gzipped, whole `dist` 1.3 MB.
- ✅ Perf work that mattered: first Lighthouse run scored **60** (TBT 1.6 s) because the sky recomputed noise per pixel per frame. Now the layers are built once in 8 ms slices, only when near the viewport, and animation is a slide of a precomputed cloud layer (about 2 ms/frame, 10 fps). Fonts are self-hosted Latin-only and preloaded. Test server must gzip, or Lighthouse overstates JS by 3x.
- ✅ Docs: `docs/research/` (Lunar features mapped, Prism notes), `docs/SKILLS.md` (what was really applied).
- ✅ Privacy page claims checked against code: grep for telemetry/analytics/sentry/posthog in `launcher/` = nothing;
  host list taken from every URL literal in `launcher/crates`.

### NOT done (so the owner isn't misled)
- ⬜ **P0 A** client version matrix + compatibility manifest + Java-per-version + headless CI: not started. The "requires >=1.21.4 <1.22 but 26.3 present" crash can still happen.
  Note: v0.3.0 release notes/site say the client is 1.21.4 only.
- ⬜ **P0 B** already fixed in session 4 (CREATE_NO_WINDOW, single instance). Not re-tested on Windows.
- ⬜ **P0 C** signing: needs owner action (see `docs/WINDOWS_SECURITY.md`). Nothing new this session. No winget manifest.
- ⬜ Cinematic onboarding, Microsoft sign-in wiring, cosmetics service + in-game skin switcher, utility wheel, instances/library rework,
  Discord RPC, Ctrl+K palette: not started. The site does not advertise any of them.
- ⬜ `cargo-deny`/`cargo-about` licence audit: no cargo here. Run it in CI before release.
- 🟡 **Lighthouse (mobile profile, local gzip server, 2 runs): performance 90 and 97, accessibility 100, best practices 100, SEO 100, CLS 0, TBT ~10 ms.** Target was 95+: met on one run, not the other (run-to-run spread). Not measured on the real GitHub Pages deploy. Desktop profile not run.
- ⬜ In-game screenshots of the client (HUD, mod menu): none exist, so the site shows none.
- ⬜ Brand redesign: the site still uses the session-4 "lumen orb". Not redesigned.
- ⬜ Teardowns of OneLauncher/OneClient, Feather, SK, TLauncher, OpenLauncher: not done.
- ⬜ History still contains `client/.gradle`/`client/build` (needs owner OK for `git filter-repo`).

### Next steps, in order
1. Client build matrix + `compat.json` read by the launcher; launch vanilla/loader-only with a clear message when no match (fixes P0 A).
2. Run `release.yml` on a tag, install on a clean Windows VM, record the result here.
3. Code signing (Azure Trusted Signing) + false-positive submission.
4. Wire Microsoft sign-in (needs Azure client id).
5. Onboarding rebuild in egui using `skyCore.ts` as the reference for the dither look (port the 40 lines to Rust).
6. Teardown research, then cosmetics service design doc (hosting cost, moderation) before any code.

### Recommendations (effort / impact)
| Idea | Effort | Impact |
|---|---|---|
| Compatibility manifest + vanilla fallback | M | Very high: removes the crash class |
| Performance-profile toggle (installs/removes the Modrinth set) | S | High |
| Public `nightly` update channel with an unstable label (Prism pattern) | S | Medium |
| Crash doctor "copy report" + "open folder" buttons | S | Medium |
| Weblate translations after a real language picker exists | M | Medium |

### Security note
The owner pasted a GitHub PAT in chat **again**. It was used only through a one-off HTTP header and never written to disk,
git config or any file. **Revoke it now** and use a fine-grained token limited to this repo.

## Session 4 — fixes, redesign, licence (branch `feat/session-4-redesign-and-fixes`, release v0.3.0)
Owner feedback: Minecraft doesn't open · terminal flickers 8-10× and app opens several times · Defender flags it · UI/site/logo/setup look vibe-coded · client has no logo · no GNU licence.
- ✅ **Root cause of "Minecraft doesn't open"** found by running the real game in the sandbox (JRE 21): Fabric profile + vanilla gave **two ASM versions** → Fabric Loader aborts ("duplicate ASM classes"). Fixed with `mojang::dedupe_libraries` (+unit test). Verified end-to-end: vanilla 1.21.4 and Fabric 1.21.4 + full 28-mod Luminos Client preset boot to graphics init (stop only because sandbox has no display). Test: `crates/luminos-core/tests/launch_smoke.rs`.
- ✅ Incompatible manual Java (e.g. 8 for 1.21) no longer accepted (`java::compatible`). More Java search paths incl. the official launcher's runtimes.
- ✅ **Console flicker**: `java -version` probes opened a console each. `sys::quiet` (CREATE_NO_WINDOW) on every child. Single-instance lock (`sys::SingleInstance`). Panic log in data dir.
- ✅ JVM flags: G1 everywhere, no AlwaysPreTouch, ZGC removed from defaults.
- 🟡 **Defender / SmartScreen**: mitigations done (manifest, static CRT, no console, provenance attestation) — **real fix is code signing**, see `docs/WINDOWS_SECURITY.md`. Owner action needed.
- ✅ **Redesign**: new identity (flat ink, hairlines, mono labels, segmented pixel progress, dithered horizon), new shell (labelled sidebar, flush title bar), new onboarding (live orb, boot log of real facts, rail stepper).
- ✅ **New logo**: the lumen orb (`brand.rs`, one source → in-app painter, exe icon, SVG, ICO, installer BMPs, favicon, `Logo.java`). **Client logo**: orb inside HUD brackets; in Mod Menu (icon) and HUD-editor header.
- ✅ **Site rebuilt** again in the new identity (live orb canvas, spec-sheet sections, real renders, Modrinth art, honest Trust section).
- ✅ **Licence**: GPL removed → proprietary all-rights-reserved (`LICENSE`, `client/LICENSE`, Cargo/fabric metadata, `THIRD_PARTY_NOTICES.md`).
- ✅ Repo hygiene: untracked `client/build` + `client/.gradle` (they were committed; the loom-cache holds Mojang's merged jar).
- ⬜ **History still contains those files** — run `git filter-repo --path client/.gradle --path client/build --invert-paths` and force-push (needs owner OK; destructive).
- ⬜ Not verified: running the new Windows installer on real Windows; the Java client edit (`Logo.java`, HUD header) compiles only in CI (`client-v0.2.0` tag).
- ⬜ Next top 3: (1) owner runs v0.3.0 on Windows and reports; (2) code signing; (3) Microsoft sign-in + launcher self-update.

### Security note
A GitHub PAT was pasted in chat again. Used only via one-off headers. **Revoke it now** (Settings → Developer settings) and use a fine-grained token.

## Session 3 — brand, installer, website, Home hero
Branch `feat/session-3-brand-installer-site`.
Owner feedback: "app and site look AI slop", release only showed a `.jar`, wants a real `Setup.exe`, a redesigned logo, real Minecraft imagery, README/continuity updated.
- ✅ **New logo**: pixel-built "L" whose foot dissolves into ordered dither + a spark pixel on a deep-blue tile. Single source grid in `tools/make_brand.py` (SVG, PNG, multi-size ICO, installer bitmaps) mirrored in `widgets::logo_mark` (Rust painter). Old isometric cube removed.
- ✅ **Home hero**: greeting + one-click *Continue* (last-played instance) + real Modrinth art that dissolves into the panel via a Bayer dither edge (`pages/home.rs::hero`).
- ✅ Window/taskbar icon (`main.rs`) and `.exe` icon + version info (`build.rs` via `winresource`, Windows only).
- ✅ `luminos-shots` now pulls **live Modrinth content** (icons + gallery art) when online, so screenshots show what users see; falls back to the offline demo data.
- 🟡 **Windows installer**: `installer/luminos.iss` (Inno Setup, per-user, no admin, dithered wizard art) built by `.github/workflows/release.yml` on `windows-latest` → `Luminos-Setup.exe`, `Luminos-Portable.exe`, `SHA256SUMS.txt` (+ Linux tarball). **Compiled on Linux only locally; the Windows build is verified by CI** (see status below).
- ✅ **Website rebuilt** (`site/`, Vite+React+Tailwind, replaces Next.js): animated dither hero, real Minecraft gallery (Modrinth galleries, credited, resized to ~100 KB JPEGs), bento features, client section, tabbed real screenshots, honest roadmap, live "latest release" lookup. Could not be viewed in a browser in the sandbox (Chromium missing libs) — **eyeball it after deploy**.
- ✅ README, `docs/RELEASE_NOTES.md`, `docs/RESEARCH.md` (naming + 12 recommendations) rewritten.
- ⬜ Not done this session: Microsoft sign-in wiring, in-game test of HUD mod, Forge/NeoForge, launcher self-update, custom cosmetics.
- ⬜ Next-session top 3: (1) run the installer on a real Windows machine and fix anything that breaks; (2) launch vanilla + Fabric + Luminos Client for real; (3) wire Microsoft sign-in.

## Session 2 — client mod, power features, repo hygiene
Branch `feat/session-2-client-and-core` → PR. Owner's source zip imported, **renamed Cobalt → Luminos**, zip deleted.
- ✅ Workspace builds on rustc 1.100 (fonts were missing from the zip → re-fetched Inter/JetBrains Mono, both OFL). 21 core unit tests pass. Release binary 11.6 MB.
- ✅ **Server hub** (`servers.rs` + Servers page): from-scratch Server List Ping; **verified live** against mc.hypixel.net.
- ✅ **World backups** (`backup.rs` + Worlds tab): zip/list/prune/restore, traversal-safe, unit-tested round trip.
- ✅ **Crash doctor** (`crash.rs` + Logs tab): OOM, wrong Java, missing dependency, mixin owner, GPU driver; 5 unit tests. One-click "Give 6 GB".
- ✅ **Smart JVM flags** (`jvmflags.rs`): ZGC on Java 21+, Aikar G1 on ≤17; empty setting = auto; legacy default auto-upgrades.
- 🟡 **Microsoft sign-in** (`msauth.rs`): device-code → XBL → XSTS → Minecraft services written; pure parts unit-tested. **Not wired into UI/launch, never run with a real account.** Needs an Azure client id (`LUMINOS_MS_CLIENT_ID`).
- ✅(compiled) 🟡(not run in-game) **Luminos Client mod** (`client/`, Fabric, MC 1.21.4, Mojang mappings, Loom): Armor HUD, Keystrokes, CPS (GLFW callback chaining, no mixins), FPS, coordinates, potion HUD, toggle sprint, zoom, drag-and-drop **HUD editor** (Right Shift or Mod Menu → Configure). `./gradlew build` succeeds; **never launched in a real game** — first thing to verify.
- ✅ (verified live against release `client-v0.1.0`) Launcher installs the first-party jar from GitHub Releases (`client-v*` tags) and skips third-party Armor HUD / Status Effect Bars when it works (`preset::install_first_party`).
- ✅ CI: `client.yml` builds the mod and publishes the jar on `client-v*` tags.
- ✅ Site updated (new screens, features, roadmap); GitHub Pages enabled (workflow build). Repo description/topics/homepage set.
- ✅ `docs/SKILLS.md`: skills directory + how agents must use them. `AGENTS.md` extended.
- ⬜ In-game screenshot/GIF of the HUD editor (no GPU in sandbox) — capture on desktop and add to `docs/`.

### Security note
The owner pasted a GitHub PAT into chat. It was used only via a one-off HTTP header (never stored in git config or files). **Revoke it** and use a fine-grained token / `gh auth login` next time.

## Session 1 — foundation
### Engine (`luminos-core`)
- ✅ Settings, accounts (offline UUID matches vanilla `OfflinePlayer:` algorithm — unit-tested)
- ✅ Instances: create / list / duplicate / delete / worlds
- ✅ Mojang version manifest (cached, offline fallback), version JSON parsing, library rules, natives, maven paths (unit-tested)
- ✅ Fabric + Quilt profile merge (`resolve()` verified live against meta.fabricmc.net for the latest MC)
- ✅ Parallel downloader with size/SHA-1 skip + verify + retry
- ✅ Modrinth: search, project, versions, hash identify, bulk update check (`version_files/update`)
- ✅ All 30 slugs of the Luminos Client bundle verified to exist on Modrinth (live test)
- ✅ News feed (Mojang patch notes) parsed live
- 🟡 Launch pipeline (`prepare` → `build_command` → `spawn` → playtime record): written carefully, compiles, **never run against a real JVM/display in the sandbox**. First thing to verify on a desktop.
- 🟡 Java auto-detect + Temurin runtime download (Adoptium API) — compiles, untested
- 🟡 Content manager: install + required dependencies, toggle (`.disabled`), remove, **unlink**, **identify untracked jars by hash**, **update all** — compiles, hash-update endpoint verified in API shape only
- 🟡 `.mrpack` modpack import (index parse, overrides, loader detection)
- 🟡 Auto-update-on-launch (setting `auto_update_content`)
- 🟡 Skin → CustomSkinLoader hand-off (copies chosen skin into `CustomSkinLoader/LocalSkin/skins/<name>.png` at launch)
### UI (`luminos-app`)
- ✅ Theme (Inter + JetBrains Mono, 6 blue accents), animated **Bayer-dither backdrop**, vector icon set, widget kit
- ✅ **Animated setup wizard**: welcome (logo reveal, letter stagger, typewriter), profile, performance (Java scan + RAM), client choice, install progress
- ✅ Home (quick play, featured packs, recent, weekly playtime chart, news panel, tips)
- ✅ Library, Create-instance dialog, Instance page (content list with toggles / update / unlink / delete, worlds, logs, settings)
- ✅ Discover (Modrinth, filters, install into chosen instance, modpack install)
- ✅ Skins (library, fetch by username from Minotar / MC-Heads, **64×64 pixel studio** with pencil/eraser/fill/picker/undo, front+back 3D-style preview, slim arms)
- ✅ Playtime page, Settings, account switcher, toasts, launch progress panel, custom title bar + resize edges
- ✅ `luminos-shots`: software-rasterises the real egui output to PNG → 15 screens in `docs/screenshots/`
### Site / infra
- ✅ Next.js marketing site with canvas dither background, gallery, roadmap (static-export ready for GitHub Pages)
- ✅ CI + Pages workflows
- ⬜ Git remote: **no repo URL was provided**, so nothing has been pushed. Commit is local only.

### Known limitations (be honest in release notes)
- Forge / NeoForge cannot launch yet (chips show "soon"); Fabric, Quilt, Vanilla do.
- No Microsoft login yet → offline accounts only. Skins reach other players only via server-side skin plugins; locally via CustomSkinLoader.
- Pre-1.6 "virtual/legacy" asset layouts are not mapped (modern versions fine).
- The **Luminos Client** is currently a *bundle of existing open-source Fabric mods*. A custom in-house client mod (own HUD modules + customisable mod menu) is not written yet — see Next Steps.
- Release binary ≈ 11 MB (≈ 0.8 MB of that is embedded fonts). Idle CPU is near zero when "Reduce motion" is on.
- Window is custom-decorated (`with_decorations(false)`); verify drag/resize/maximise on Windows, macOS and Wayland.

## Next steps (priority order, as of session 2)
> Done in session 2: items about the client mod skeleton, world backups, server hub, crash analyser (see above). Remaining list below is still valid.

1. **Run on real desktops** (Win/macOS/Linux): launch vanilla + Fabric, fix whatever breaks. Add `cargo test` for `build_command` against a recorded 1.21 version JSON fixture.
2. **Microsoft / Xbox auth** (device-code flow → XBL → XSTS → Minecraft services), token refresh in OS keychain; skin upload through Minecraft services.
3. **Forge & NeoForge** installers (run installer headless / process `install_profile.json`).
4. **Luminos Client mod** (Java/Kotlin Fabric mod, separate repo or `client/` dir): armour HUD, keystrokes, CPS, potion HUD, coordinates, zoom, toggle sprint, freelook, FPS/ping; YACL-based **customisable HUD editor** (drag modules) opened via Mod Menu. Ship through the launcher like any other mod.
5. Auto-update **the launcher itself** (GitHub releases + signature check), installers via `cargo-packager`.
6. CurseForge source (needs API key from the user), Modrinth collections, modpack **export** (.mrpack).
7. Worlds: backup / restore, per-world launch (`--quickPlayMultiplayer`), server list with ping + one-click join.
8. Gallery tab (screenshots) and Files tab per instance, crash-log analyser (parse `hs_err`/`crash-reports`).
9. Discord Rich Presence, system-tray, controller-friendly mode, i18n (fluent), accessibility pass (contrast, scale).
10. Replace per-frame `Painter` icon drawing with cached meshes if profiling shows cost.

## Decisions log
- **egui/eframe 0.37 (glow)** over Tauri/Iced: smallest dependency surface, pure Rust, trivially renders headless for screenshots.
- **ureq (blocking) + threads** over reqwest/tokio: less code, smaller binary; the UI talks to workers through an mpsc channel (`Bg`).
- **Rect-splitting layout** instead of egui panels → insulated from panel API churn.
- Brand = blue family only. Accent choices are all blue-ish by design.
- Not copying code from GPL launchers (OneLauncher, SKLauncher, Legacy Launcher); only studying their feature sets and UX.

## How to build / run / render
```bash
cd launcher
cargo run -p luminos-app --release                         # the launcher
# client mod: cd client && ./gradlew build   (needs JDK 21)
cargo test -p luminos-core                                 # unit tests
cargo test -p luminos-core --test live -- --ignored --test-threads=1   # live API smoke tests
cargo run -p luminos-app --release --bin luminos-shots -- ../docs/screenshots   # re-render screenshots
```
Linux build deps for the windowing stack are loaded dynamically (X11/Wayland); no `-dev` packages are required to compile.
