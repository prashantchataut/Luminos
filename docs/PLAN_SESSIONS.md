# Plan: sessions 10-14 (written in session 9)

Owner direction (session 9): make launcher and client feel like **one product**; redesign UI/UX so it stops looking like a demo; real features not demos; beat OneClient on weight and cold start; use all skills; research before building; ship every session.
Each session = research -> plan -> execute -> verify -> review. Each ends with a tagged release, an updated `docs/START_HERE.md`, `CONTINUITY.md` and a screenshot set viewed by the agent.

## Principles for all sessions
1. **One product.** The launcher is the home of the client: one "Luminos" instance, one settings surface. The in-game menu (right shift) and the launcher "Client" page edit the *same* `luminos-client.json`. No separate "client" vs "launcher" mental model.
2. **Every screen shows real data.** Demo data lives only in `demo.rs` for screenshots and never ships in the binary path.
3. **Beat OneClient on weight.** Targets in `docs/PERF.md` (to create in session 10): installer < 6 MB (now 5.1), idle RAM < 90 MB, cold start to interactive < 400 ms, first frame < 150 ms. Measured in CI, regressions fail the build.
4. **Skills loaded and named in each commit.** Design: taste-skill + ui-ux-pro-max (rules applied by hand to egui). Motion: reanimate (method: spec table of trigger/duration/easing per element, verify with frame captures). Rust: rust-best-practices. Android: kotlin-android. Client: fabric-stonecutter. Reverse engineering: rea.
5. **Honesty.** Verified = a command was run and its output saved. Everything else is labelled unverified.

## Session 10: Windows shell redesign + "it must start" (Windows 0.6)
- Research: Lunar/Badlion/Feather/Modrinth App/Prism screenshots for layout; OneClient home (hero art + version carousel).
- Redesign nav: top bar (Home, Library, Browse, Servers, Skins, Stats) + account chip; drop left rail clutter; instance carousel with real cover art; one big launch button that morphs Ready -> Preparing -> Launching -> Running (reanimate spec first).
- Onboarding v3: 4 steps max (name -> pack choice -> performance -> go), real validation, offline vs Microsoft clearly explained, "play now" within 60 s on a clean machine.
- **Launch reliability**: run `launch_smoke` on windows-latest for vanilla + Fabric + preset; add a Windows job that launches to the title screen under software GL and asserts the log line; fix every failure found. This is the "game doesn't start" fix and has to be proven in CI, not claimed.
- Cover art: CI job renders panoramas for the supported versions (xvfb + llvmpipe) into `assets/covers/`, credited in `docs/ASSETS.md`.
- Release 0.6.0; verify installer on windows-latest (silent install, start, exit code).

## Session 11: One client (launcher <-> client merge) + Resourcify-grade pack browser
- Client page in the launcher: module toggles, HUD positions, zoom FOV, toggle-sprint (reads/writes `config/luminos-client.json`; done in 0.5.0 as v1), profiles (named configs), keybinds.
- Client mod: Stonecutter matrix for the last 5 versions (1.21.4, 1.21.11, 26.1.2, 26.2, 26.3) with `client-compat.json`; features per version or cleanly disabled.
- **Built-in pack browser** (own, optimised, toggleable): Modrinth search for resource packs / shaders / datapacks inside the game, one-click install with hash verification, update-all. Interim (0.5.0): Resourcify installed as an optional toggle in the pack choice. Own implementation uses Fabric screen API + Modrinth v2; async, cached, no main-thread I/O.
- OneClient-parity HUD set (original code): see `docs/ONECLIENT_PARITY.md`.
- Release 0.7.0 + `client-v0.3.0`.

## Session 12: Skins, capes and cosmetics, for real
- Cosmetics service (axum + SQLite) per `docs/COSMETICS_SERVICE.md`; moderation queue; signed URLs.
- Original free cosmetics set, Luminos-branded (moon cape, dither wings, pixel halo, lantern, scarf, glasses...), categories matching the store taxonomy (cape/wings/hat/back/glasses/glove/boots/shoulder/pet/aura/emotes). Authored as voxel models in a small Rust/Python generator so they are reproducible.
- Client renders other Luminos players' skin/cape/cosmetics on offline servers (D4); Skins Bridge plugin (C7).
- Skin editor v2 (layers, mirror, undo) and a 3D rotating preview with cape in the launcher (egui mesh, no GPU needed).
- Release 0.8.0.

## Session 13: Multiplayer that works
- C1/C2 CI: offline account joins vanilla + Paper + Fabric on all 5 versions with a headless client hook; chat echo asserted.
- "Why can't I join?" UX complete; server directory with real pings < 24 h; LAN discovery; `luminos://join` handler (installer + registry).
- Host-a-world with relay (`luminos-relay`) - needs a hosting decision from the owner (see `docs/BLOCKERS.md`).
- luminos-auth resolves offline UUIDs (Drasl behaviour).
- Release 0.9.0.

## Session 14: Android engine + polish + 1.0
- Android: server-jar-on-emulator proof, then GL layer (ANGLE/gl4es + GLFW shim), title screen, then touch/gamepad controls and layout editor. Ship whatever stage works, labelled.
- Perf pass with `docs/PERF.md` numbers; signing wired if the owner provides a certificate; winget manifest; website refresh with real captures.
- Release 1.0.0 only if the gate is honestly green.

## Always-on backlog (any session)
Mod bisect wizard, storage mover, tray icon/run in background, Discord RPC, import from Prism/TLauncher/official, screenshot viewer, datapacks tab, settings profiles, i18n, accessibility pass.
