# LUMINOS: ONE-SHOT MARATHON BRIEF (v8)

> Saved from the owner's brief. The line containing the owner's personal access token was **redacted** on purpose: tokens are never committed. The token must be revoked and replaced by `gh auth login` / a fine-grained token.

Repo: github.com/prashantchataut/Luminos. Use the pre-authenticated gh CLI; never print, log or commit tokens.

## 0. THE LOOP (this is the most important section)
You run unattended with unlimited tokens and no human to answer questions. Earlier runs ended early with "partial delivery". Stopping early is the bug being fixed.
R1. Send NO chat message until `scripts/gate.sh` exits 0. Report progress only via commits, docs/LEDGER.md and docs/PROGRESS.md. Ending your turn ends the session, so every turn must end with a tool call until the gate passes.
R2. After every commit run `scripts/gate.sh`, read its output, and start the first failing item immediately. Never stop to summarise, plan aloud, or ask.
R3. "I can't verify it here" is NOT a stop condition. Build it fully, push, let GitHub Actions verify (windows-latest, ubuntu+KVM Android emulator, xvfb + Mesa llvmpipe), read logs (`gh run watch`, `gh run view --log-failed`), fix, repeat. The sandbox is small: `cargo build -j2`, `CARGO_INCREMENTAL=0`, split crates, push heavy work to CI.
R4. NOT DONE = design docs, scaffolds, stubs, todo!(), mock data shown as real, UI without backend, backend without UI, feature flags left off, "evaluated only".
R5. Depth-first, in backlog order. Finish an item (code + tests + UI + evidence) before starting the next.
R6. Re-read docs/BRIEF.md every 10 commits to avoid drift.
R7. External blockers (paid certificate, Azure client ID, physical device): write exact owner steps in docs/BLOCKERS.md, build everything around the blocker, and CONTINUE. A blocker never ends the session.
R8. Every screen must pass the taste-skill anti-slop checklist. Banned: generic marketing copy, placeholder art, empty states as screenshots, text-only cover cards. If it looks like a demo, redo it.
R9. Be truthful: say exactly what was run and what was not. Never invent results.

## 1. BOOT SEQUENCE (strictly in order, before feature work)
1. Save this whole brief verbatim to docs/BRIEF.md; commit.
2. Create scripts/gate.sh from section 2; commit.
3. Install skills into .agents/skills/<name>/ (clone each repo with git --depth 1 or fetch SKILL.md + resources; use `gh search repos` to locate exact repos): taste-skill (leonxlnx), ui-ux-pro-max, UI Hall design skills, Reanimate (github.com/NiazMorshed2007/reanimate), rea / reverse-engineer-anything, agent-reach (internet/community research access; if unavailable use official APIs or public pages), Rust skills, Android/Kotlin/Compose skills, Fabric multi-version/Stonecutter skills. Also browse skills.sh, skill-issue.in, open-design.ai/skills/#catalog for strong extras. Distill each into docs/DESIGN_RULES.md (one page each). Gate requires >= 8 skill directories. Cite the rule names used in every UI commit message.
4. Expand section 4 into docs/LEDGER.md: one line per ID and per sub-bullet (120+ lines). Open: `- [ ] ID title`. Done: `- [x] ID title — evidence: <relative file path or URL>`.
5. Open a draft PR on the first push.

## 2. scripts/gate.sh (create exactly this, make executable)
See `scripts/gate.sh` (identical to the owner's text).

## 3. RESEARCH GROUND TRUTH (seed docs/research/USER_PAIN.md with this, then extend with agent-reach/official APIs across Reddit, X, Pinterest, forums, GitHub issues. Respect each platform's ToS and rate limits; store links + paraphrased notes, never bulk personal data; do not embed third-party images in the product)
Verified user complaints, each MUST map to a ledger item:
- Trust: ads, bundled software, hardware telemetry, spyware accusations, PUP flags, "unknown publisher" warnings, mainstream guides telling people to avoid cracked launchers.
- Skins: offline skins are local-only and invisible on online-mode servers; offline servers need a skin plugin; skins reset after restart; users blame the launcher for server-mode behaviour.
- Defaults: outdated OptiFine auto-install; heavy launchers; users prefer Prism-style lightness.
- Demand: Prism-quality launcher with offline accounts and alternative auth servers (several Prism forks exist; none is polished).
- Mod safety (Fractureiser class).
- Android/Pojav: crash joining worlds with Fabric/Forge + offline accounts; Java download errors; Minecraft download failures; mouse lock failures; OTG mouse axis inversion; virtual-mouse acceleration/jumping; confusing RAM allocation (>75% of device RAM crashes); shaders unsupported under GL4ES; input and controller mods broken; big modpacks corrupting textures.
Also produce: top open-source mods/clients table (licence | learned | do differently | reusable?), inspiration refs with palette/layout notes, and a "what users hate in launchers" list from Reddit threads you actually read.

## 4. BACKLOG (strict order; every item needs tests or captured evidence)
### A. TRUST (the #1 reason people leave cracked launchers)
A1 No ads, no bundled software, analytics OFF by default. In-app "Network activity" screen lists every outbound host + purpose with toggles. CI test records traffic and fails on unlisted hosts.
A2 Installer (Inno/WiX), proper version resources, no packers/obfuscation, code signing wired in CI (Azure Trusted Signing if eligible, else OV cert; docs/SIGNING.md owner steps), SHA256SUMS, Microsoft false-positive submission steps, winget manifest.
A3 Tokens in OS secure storage (DPAPI/Credential Manager; Android Keystore), migrating old plaintext accounts.json. Tested.
A4 Mod jars verified against Modrinth hashes; unknown jars flagged; update checks never auto-install unsigned/unknown files.
A5 Site /privacy page generated from A1's host list.
### B. MINECRAFT IMAGERY (cover art, skins, icons: NOT just text)
B1 Per-version cover art: headless client runs in CI capture real in-game panoramas/screenshots for each of the 5 supported versions (day/night/cave/modded variants). Stored with attribution in docs/ASSETS.md. Home hero, instance cards, library header and site all use them. No more text-only "Luminos Client" cards.
B2 Original voxel-style icon set drawn by us (SVG/PNG): versions, loaders, game modes, items, mod categories. Do not extract Mojang's texture atlas into the UI. Check Mojang's Brand and Asset Guidelines, summarise in docs/ASSETS.md.
B3 Profile card, cosmetics page, account switcher, server player lists and chat show a real 3D skin/bust render of the selected account's actual skin (premium via API, offline from local skin, default = an ORIGINAL Luminos default skin we draw). With idle animation and cape.
B4 Server icons from ping favicons, world icons from saves, mod icons from Modrinth, screenshot gallery from the instance's screenshots folder.
B5 Site app shots: real, populated (real instances, mods with icons, playtime history, skin renders), shown in window/phone frames; no empty states; each paired with a specific one-sentence caption. Footer disclaimer: "Luminos is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft."
### C. ACCOUNTS + MULTIPLAYER (offline/cracked-first, premium supported)
C1 Offline account joins local Paper and Vanilla (online-mode=false) on all 5 versions in CI via headless client hook; assert world join + chat echo.
C2 Fabric + client mod + OFFLINE account joins a world on all 5 versions (known Pojav crash class). CI test.
C3 authlib-injector path with luminos-auth; Ely.by flow (mocked in CI, manual notes for live); Microsoft device-code flow.
C4 "Why can't I join?" UX: detect online-mode servers, explain in plain language, offer fixes (pick offline-friendly server, set up Luminos-auth, host own). No auth bypass.
C5 LAN discovery + "Host a world" with a working relay (luminos-relay in Rust: auth, rate limits, abuse controls, deploy config) + `luminos://join` handler (installer + Android intent filter).
C6 Server directory: real pings, filters, report button, lists only servers pinged in the last 24h.
C7 "Luminos Skins Bridge" server plugin (Paper + Fabric) so non-Luminos players see skins on offline servers.
### D. COSMETICS (complete system)
D1 luminos-cosmetics service (axum, SQLite/Postgres, S3-compatible storage): validation, perceptual-hash dedupe, moderation + takedown queue, signed URLs, rate limits, OpenAPI docs, deploy config.
D2 Launcher UI (desktop + Android): wardrobe (folders/favorites/tags), import by file/username/URL/drag-drop, slim/classic auto-detect, capes tab (Mojang capes for premium, Luminos capes, animated capes in-client), cosmetics tab (hats/back items/wings/emotes, first real original set).
D3 Skin editor: brush/eraser/fill/picker/mirror/symmetry/overlay layer/layers/undo-redo/palette.
D4 Client renders other Luminos players' skins/capes/cosmetics on all 5 versions; in-game switcher applies live without restart; selection PERSISTS across restarts (known complaint).
D5 "Where will others see my skin?" matrix in the UI (Luminos players / authlib-injector servers / offline servers with the bridge / premium via Mojang).
### E. LUMINOS CLIENT x LAST 5 VERSIONS
E1 Stonecutter/Architectury matrix: one jar per version of the 5 latest stable releases (read the Mojang manifest; list them in docs/SUPPORTED_VERSIONS.md; 26.x is unobfuscated). Auto-generated client-compat.json with sha256.
E2 Features working on all 5 or cleanly disabled with a reason: armor HUD, keystrokes, CPS, FPS, ping, coords, potions, toggle sprint, zoom, freelook, mod menu (Right Shift), HUD editor, logo/splash/title screen.
E3 Utility wheel on right-click (hold/threshold so normal right-click use is unaffected): quick settings, perspective, zoom, skin/cape switch, screenshot, mod toggles.
E4 Modrinth performance stack per version (Sodium, Lithium, Entity Culling, FerriteCore, ImmediatelyFast, Iris option) as the DEFAULT instead of OptiFine.
E5 Headless title-screen smoke test for all 5 versions (xvfb + llvmpipe) as a required CI check.
### F. DESKTOP APP: LOOK, MOTION, WEIGHT
F1 Design tokens shared with the approved site (dithered night-sky blue, serif display + clean sans, hairline borders).
F2 Animated dithered sky (pauses when unfocused), onboarding choreography, direction-aware page transitions, launch-button state morph (Ready -> Preparing -> Launching -> Running with live playtime), card hover/parallax, skeleton loaders, chart draw-ons, 3D viewer spring physics. Use Reanimate. Implement docs/MOTION.md fully. Record GIFs.
F3 Settings that really work (Java, downloads, proxy, appearance, reduced motion, storage, privacy, update channel, import/export). No dead toggles.
F4 Measured weight: installer size, idle RAM, cold start, frame times; recorded in docs/PERF.md with CI regression thresholds (launcher must beat SKLauncher on weight).
### G. LAUNCHER QoL
G1 Auto Java management per version. G2 Crash assistant (plain-language diagnosis, copy logs). G3 Import from TLauncher/SKLauncher/official/Prism/Modrinth App. G4 .mrpack import/export. G5 Scheduled world backups + restore. G6 Mod update-all / pin / unlink / rollback per instance. G7 Playtime tracking with charts/heatmap/streaks. G8 Discord RPC. G9 Ctrl+K command palette. G10 CLI + portable mode. G11 Screenshot gallery with share. G12 Shader preset manager. G13 Family mode with PIN. G14 Gamepad/Steam Deck console mode.
### H. ANDROID: "Luminos Mobile" (real Java Edition play with offline/cracked + Microsoft accounts)
H1 Architecture: shared `luminos-core` (Rust, UniFFI/JNI), Kotlin + Jetpack Compose UI with the same tokens/motion, game in a separate process/Activity, foreground service for downloads, minSdk 26, arm64-v8a (+ x86_64 emulator).
H2 JVM in-process via JNI; Java 8/17/21/25 runtimes built from OpenJDK in CI (document provenance + checksums) or redistributable builds with verified licences; resumable, mirrored, checksum-verified downloads (fixes Pojav's Java/MC download errors). Never copy LGPL/GPL launcher code; document component licences in docs/android/LICENSES.md.
H3 GLFW/LWJGL3 shim; renderers: gl4es, ANGLE, Zink; auto-recommend by GPU; in-UI mod-renderer compatibility matrix (shader/Sodium warnings).
H4 Input: touch layout editor (drag/resize/opacity/groups), presets (survival/PvP/building/tablet), per-instance layouts, shareable layout codes, full keybind editor, gamepad mapping + profiles (built in, so controller mods aren't needed), external keyboard/mouse with raw pointer capture and a per-device quirk table (fixes mouse lock, OTG axis inversion, virtual-mouse jumping), gyro aim, haptics, left-handed mode, edge-gesture safe zones.
H5 Mods: Modrinth browser, dependency resolution, install/update/pin/rollback, .mrpack import, Fabric required (Quilt/NeoForge/Forge only if each is verified), hash verification.
H6 Accounts + servers: same as C (offline, Microsoft device-code, Ely.by, Luminos-auth), server list/ping/favorites/direct/quick-join/LAN/invite links. Offline + Fabric join test on the emulator.
H7 Settings: safe RAM auto-allocation (cap at 75% of device RAM, explain it), render scale, FPS cap, view-distance auto-tuner, GC/JVM presets for ARM, thermal throttling, sustained-performance mode, battery saver, storage manager, log viewer, crash assistant.
H8 Perf targets (measured): launcher cold start < 1.5 s, idle RAM < 150 MB, APK < 25 MB without runtimes, 60 fps UI, no ANRs, onTrimMemory handling.
H9 Safety: minimal permissions, no ads/trackers, signed release APK, checksums, network security config (HTTPS only), mod hash checks. Distribute via GitHub Releases + F-Droid metadata.
H10 CI: build, lint, unit tests; emulator UI tests (onboarding, account, instance, mod install, layout editor); JNI JVM-boot smoke test; best-effort title-screen boot under SwiftShader/ANGLE; upload APK/logs/screens.
### I. SITE (design approved; fix imagery)
I1 Rebuild the app-showcase sections per B5. I2 Pages: Android, Cosmetics, Docs for server owners (authlib-injector + Skins Bridge setup), Privacy, Changelog. I3 Lighthouse >= 95 perf/a11y in CI. Keep the dithered-moon hero.
### J. RECOMMENDATIONS (do all that fit; list skipped)
Shareable instance/modpack codes; JVM auto-tuner + per-instance FPS benchmark; replay/clip recorder; encrypted cloud sync; i18n with community files; theme packs; achievements; offline mod cache; data-saver mode; accessibility pass (colorblind HUD presets, screen-reader labels).

## 5. DEFINITION OF DONE
Gate exits 0. PR contains: ledger with evidence per item, screenshots/GIFs from real builds (desktop + Android + site), CI links, signed Setup.exe + APK as release assets with checksums, updated README/CONTINUITY/CHANGELOG, docs/research/*, docs/ASSETS.md, docs/BLOCKERS.md, a VERIFIED vs UNVERIFIED section.
Only THEN send ONE final message. If you are about to write a message and the gate has not passed, do not: run the gate and work the first failing item.
