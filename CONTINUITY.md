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
| `src/` (Next.js) | GitHub Pages marketing site (`GITHUB_PAGES=true` → static export) |
| `.github/workflows/` | `ci.yml` (fmt/clippy/test, 3 OSes), `pages.yml` (site deploy) |

## Status legend
✅ done & verified · 🟡 written, not yet verified end-to-end · ⬜ planned

## Session 2 — client mod, power features, repo hygiene
Branch `feat/session-2-client-and-core` → PR. Owner's source zip imported, **renamed Cobalt → Luminos**, zip deleted.
- ✅ Workspace builds on rustc 1.100 (fonts were missing from the zip → re-fetched Inter/JetBrains Mono, both OFL). 21 core unit tests pass. Release binary 11.6 MB.
- ✅ **Server hub** (`servers.rs` + Servers page): from-scratch Server List Ping; **verified live** against mc.hypixel.net.
- ✅ **World backups** (`backup.rs` + Worlds tab): zip/list/prune/restore, traversal-safe, unit-tested round trip.
- ✅ **Crash doctor** (`crash.rs` + Logs tab): OOM, wrong Java, missing dependency, mixin owner, GPU driver; 5 unit tests. One-click "Give 6 GB".
- ✅ **Smart JVM flags** (`jvmflags.rs`): ZGC on Java 21+, Aikar G1 on ≤17; empty setting = auto; legacy default auto-upgrades.
- 🟡 **Microsoft sign-in** (`msauth.rs`): device-code → XBL → XSTS → Minecraft services written; pure parts unit-tested. **Not wired into UI/launch, never run with a real account.** Needs an Azure client id (`LUMINOS_MS_CLIENT_ID`).
- ✅(compiled) 🟡(not run in-game) **Luminos Client mod** (`client/`, Fabric, MC 1.21.4, Mojang mappings, Loom): Armor HUD, Keystrokes, CPS (GLFW callback chaining, no mixins), FPS, coordinates, potion HUD, toggle sprint, zoom, drag-and-drop **HUD editor** (Right Shift or Mod Menu → Configure). `./gradlew build` succeeds; **never launched in a real game** — first thing to verify.
- ✅ Launcher installs the first-party jar from GitHub Releases (`client-v*` tags) and skips third-party Armor HUD / Status Effect Bars when it works (`preset::install_first_party`).
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
