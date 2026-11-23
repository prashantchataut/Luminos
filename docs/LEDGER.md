# LEDGER
Open: `- [ ] ID title`. Done: `- [x] ID title — evidence: <path or URL>`. An item is only ticked when code + tests + UI + evidence exist (see docs/BRIEF.md R4).
Pain-point map: docs/research/USER_PAIN.md (each complaint cites ledger IDs).

## Boot
- [x] BOOT1 docs/BRIEF.md saved — evidence: docs/BRIEF.md
- [x] BOOT2 scripts/gate.sh created — evidence: scripts/gate.sh
- [x] BOOT3 >= 8 skills installed in .agents/skills — evidence: .agents/skills/PROVENANCE.md
- [x] BOOT3b docs/DESIGN_RULES.md distilled per skill — evidence: docs/DESIGN_RULES.md
- [x] BOOT4 docs/LEDGER.md expanded to 120+ lines — evidence: docs/LEDGER.md
- [x] BOOT5 draft PR opened on first push — evidence: https://github.com/prashantchataut/Luminos/pull/6
- [x] BOOT6 docs/research/USER_PAIN.md seeded and extended with sources actually read — evidence: docs/research/USER_PAIN.md
- [x] BOOT7 docs/BLOCKERS.md written — evidence: docs/BLOCKERS.md

## A. Trust
- [x] A1 No ads / bundled software / analytics OFF by default — evidence: launcher/crates/luminos-core/src/netaudit.rs
- [x] A1a Host registry in luminos-core (every outbound host + purpose + category) — evidence: launcher/crates/luminos-core/src/netaudit.rs
- [x] A1b Per-host toggles persisted in settings and ENFORCED by http layer — evidence: launcher/crates/luminos-core/src/http.rs
- [x] A1c Unlisted hosts refused at runtime — evidence: launcher/crates/luminos-core/src/netaudit.rs
- [x] A1d In-app "Network activity" screen (hosts, purpose, toggles, live request counts) — evidence: launcher/crates/luminos-app/src/pages/network.rs
- [x] A1e Screenshot of Network activity screen rendered from real UI — evidence: docs/screenshots/21-network-activity.png
- [x] A1f CI/static test fails on source URLs whose host is not in the registry — evidence: launcher/crates/luminos-core/tests/netaudit_static.rs
- [x] A1g CI test that records real traffic and fails on unlisted hosts — evidence: launcher/crates/luminos-core/tests/network_audit_live.rs
- [ ] A2 Installer + signing + SHA256SUMS + winget
- [ ] A2a Inno Setup installer with version resources
- [ ] A2b No packers/obfuscation (documented + CI check)
- [ ] A2c Code signing wired in release workflow (Azure Trusted Signing / OV cert)
- [ ] A2d docs/SIGNING.md owner steps
- [ ] A2e SHA256SUMS published with releases
- [ ] A2f Microsoft false-positive submission steps documented
- [ ] A2g winget manifest
- [ ] A3 Tokens in OS secure storage
- [ ] A3a Windows DPAPI / Credential Manager backend
- [ ] A3b Linux Secret Service / macOS Keychain backend
- [ ] A3c Android Keystore backend
- [ ] A3d Migration of plaintext accounts.json
- [ ] A3e Tests for storage + migration
- [ ] A4 Mod jars verified against Modrinth hashes
- [ ] A4a Hash lookup via POST /version_files
- [ ] A4b Unknown jars flagged in UI
- [ ] A4c Update checks never auto-install unknown/unsigned files
- [ ] A4d Tests
- [x] A5 Site /privacy page generated from A1's host list — evidence: site/src/lib/hosts.json
- [x] A5a Generator emits JSON from the registry (single source of truth) — evidence: launcher/crates/luminos-core/examples/hosts_json.rs
- [x] A5b Site renders /privacy from generated JSON — evidence: site/src/components/Legal.tsx
- [x] A5c CI step regenerates and fails on drift — evidence: .github/workflows/ci.yml

## B. Minecraft imagery
- [ ] B1 Per-version cover art from real headless client captures
- [ ] B1a Headless capture harness in CI (xvfb + llvmpipe)
- [ ] B1b Day / night / cave / modded variants for 5 versions
- [ ] B1c Attribution in docs/ASSETS.md
- [ ] B1d Home hero, instance cards, library header, site use them
- [ ] B2 Original voxel icon set
- [x] B2a Versions icons — evidence: brand/icons/svg/versions-v1-21-4.svg
- [x] B2b Loader icons — evidence: brand/icons/svg/loaders-fabric.svg
- [x] B2c Game-mode icons — evidence: brand/icons/svg/modes-survival.svg
- [x] B2d Item icons — evidence: brand/icons/svg/items-sword.svg
- [x] B2e Mod-category icons — evidence: brand/icons/svg/categories-performance.svg
- [x] B2f SVG + PNG outputs and a contact sheet — evidence: brand/icons/sheet.png
- [ ] B2g Mojang Brand and Asset Guidelines summary in docs/ASSETS.md
- [x] B2h Generator script is deterministic and tested — evidence: tools/test_icons.py
- [ ] B2i Icons wired into the launcher UI
- [ ] B3 3D skin/bust renders
- [ ] B3a Premium skin via API
- [ ] B3b Offline account from local skin
- [ ] B3c Original Luminos default skin
- [ ] B3d Idle animation and cape
- [ ] B3e Used in profile card, cosmetics, account switcher, server lists, chat
- [ ] B4 Real icons: servers, worlds, mods, screenshots
- [ ] B4a Server favicons from ping
- [ ] B4b World icons from saves
- [ ] B4c Mod icons from Modrinth
- [ ] B4d Screenshot gallery from instance folder
- [ ] B5 Site app shots, populated, framed, captioned
- [ ] B5a Window/phone frames
- [ ] B5b One-sentence captions
- [ ] B5c Footer disclaimer

## C. Accounts + multiplayer
- [ ] C1 Offline account joins Paper + Vanilla on 5 versions (CI)
- [ ] C1a Headless client hook
- [ ] C1b World join assertion
- [ ] C1c Chat echo assertion
- [ ] C2 Fabric + client mod + offline account joins on 5 versions (CI)
- [ ] C3 authlib-injector / Ely.by / Microsoft device code
- [ ] C3a luminos-auth path
- [ ] C3b Ely.by flow mocked in CI
- [ ] C3c Microsoft device-code flow
- [ ] C4 "Why can't I join?" UX
- [ ] C4a Detect online-mode servers
- [ ] C4b Plain-language explanation
- [ ] C4c Offer fixes (offline-friendly server, Luminos-auth, host own)
- [ ] C5 LAN discovery + host a world + relay + luminos://join
- [ ] C5a LAN discovery
- [ ] C5b luminos-relay (auth, rate limits, abuse controls, deploy config)
- [ ] C5c luminos:// handler (installer + Android intent filter)
- [ ] C6 Server directory (pinged < 24h, filters, report)
- [ ] C7 Luminos Skins Bridge plugin (Paper + Fabric)

## D. Cosmetics
- [ ] D1 luminos-cosmetics service
- [ ] D1a Validation + phash dedupe
- [ ] D1b Moderation + takedown queue
- [ ] D1c Signed URLs + rate limits
- [ ] D1d OpenAPI + deploy config
- [ ] D2 Launcher cosmetics UI (wardrobe, import, capes, cosmetics)
- [ ] D3 Skin editor
- [ ] D4 Client renders others' cosmetics on 5 versions; persistence across restarts
- [ ] D5 "Where will others see my skin?" matrix

## E. Client x last 5 versions
- [ ] E1 Stonecutter matrix + client-compat.json
- [ ] E2 Feature set per version (or disabled with reason)
- [ ] E3 Utility wheel
- [ ] E4 Modrinth performance stack as default
- [ ] E5 Headless title-screen smoke test per version

## F. Desktop look, motion, weight
- [ ] F1 Shared design tokens with site
- [ ] F2 Motion system (sky, onboarding, transitions, launch button morph, skeletons, charts, 3D spring)
- [ ] F2a GIF recordings
- [ ] F3 Settings that really work
- [ ] F4 Measured weight in docs/PERF.md with CI thresholds

## G. Launcher QoL
- [ ] G1 Auto Java management
- [ ] G2 Crash assistant
- [ ] G3 Importers (TLauncher/SKLauncher/official/Prism/Modrinth App)
- [ ] G4 .mrpack import/export
- [ ] G5 Scheduled backups + restore
- [ ] G6 Mod update-all / pin / unlink / rollback
- [ ] G7 Playtime charts/heatmap/streaks
- [ ] G8 Discord RPC
- [ ] G9 Ctrl+K palette
- [ ] G10 CLI + portable mode
- [ ] G11 Screenshot gallery with share
- [ ] G12 Shader preset manager
- [ ] G13 Family mode with PIN
- [ ] G14 Gamepad / Steam Deck console mode

## H. Android
- [ ] H1 Architecture (Rust core + Kotlin/Compose, separate game process)
- [ ] H2 In-process JVM, runtimes, resumable checksummed downloads
- [ ] H3 GLFW/LWJGL shim + renderers
- [ ] H4 Input (layout editor, keybinds, gamepad, mouse quirks table)
- [ ] H5 Mods (Modrinth, deps, hashes)
- [ ] H6 Accounts + servers on Android; emulator offline+Fabric join test
- [ ] H7 Settings (RAM cap 75%, render scale, thermal, ...)
- [ ] H8 Perf targets measured
- [ ] H9 Safety (permissions, HTTPS-only, signed APK, F-Droid metadata)
- [ ] H10 Android CI (build, lint, unit, emulator UI, JNI smoke)

## I. Site
- [ ] I1 Showcase rebuild per B5
- [ ] I2 Pages: Android, Cosmetics, Server-owner docs, Privacy, Changelog
- [ ] I3 Lighthouse >= 95 in CI

## J. Recommendations
- [ ] J1 Shareable instance/modpack codes
- [ ] J2 JVM auto-tuner + FPS benchmark
- [ ] J3 Replay/clip recorder
- [ ] J4 Encrypted cloud sync
- [ ] J5 i18n
- [ ] J6 Theme packs
- [ ] J7 Achievements
- [ ] J8 Offline mod cache
- [ ] J9 Data-saver mode
- [ ] J10 Accessibility pass (colorblind HUD presets, screen-reader labels)
