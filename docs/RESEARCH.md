# Research notes & recommendations

_Session 1. Sources actually consulted: Polyfrost/OneLauncher README (live fetch), skills.sh / skill-directory listings (live search), Modrinth + Mojang + Fabric APIs (live calls), and the SKLauncher screenshots supplied by the owner. Competitor notes below that were **not** fetched this session are from general knowledge and are marked "(recall)". The Legacy Launcher source link was behind a Cloudflare challenge and the OpenLauncher / open-design catalog pages were not reviewed in depth — revisit them next session._

## What the best launchers do
| Launcher | Worth learning from |
|---|---|
| **SKLauncher** (screenshots) | Left icon rail, quick-play strip of instances, explore hub with big banner cards, right news panel, tabbed instance page (Content / Worlds / Gallery / Files), per-item toggle + swap/update + delete, Modrinth **and** CurseForge in one browser, filters panel |
| **OneLauncher / OneClient** (Rust + Tauri) | One-click pre-configured client bundles, auto-updating, cargo-packager installers, SignPath code signing, Knope changesets for release notes, Flatpak/AUR/COPR distribution |
| Modrinth App (recall) | Instance import from other launchers, content updates in one click, Discord RPC, server pings on home |
| Prism Launcher (recall) | Instance groups, per-instance Java/args, mod-loader metadata, console + crash analysis, offline-friendly accounts |
| ATLauncher / CurseForge app (recall) | Modpack browsing, server packs, backup/restore |
| TLauncher / Legacy Launcher (recall) | Easy offline skins, very low-friction first run, old-version support — also a cautionary tale on bundled ads/adware: **Luminos must stay clean** |

## What Luminos does differently (shipped in session 1)
- Real **ordered-dither** identity + a setup experience worth showing off
- **Auto-update on launch** limited to Modrinth-linked files; **Unlink** to pin a version; **Identify** to link unknown jars by SHA-1
- **Luminos Client** bundle with 30 vetted mods, every slug verified against the live API
- Playtime tracking with 14-day chart, streaks, per-instance bars — all local
- Skin studio with open-library fetch and a real pixel editor
- Screenshots rendered from the real UI headlessly (so PRs show true progress)

## Recommendations (my picks, ordered by value ÷ effort)
1. **Microsoft sign-in** — unlocks skin upload, realms, secure servers. Biggest trust win.
2. **Instance import** from Prism / MultiMC / CurseForge / Modrinth App folders (read their `instance.cfg`/`manifest.json`).
3. **Smart RAM**: pick `-Xmx` from pack size + mod count, warn on over-allocation (G1/ZGC flags profile per Java version).
4. **Crash doctor**: parse crash reports, name the guilty mod, offer "disable it" / "update it" buttons.
5. **Profiles for "performance / balanced / quality"** that toggle Sodium/Iris/shader presets together.
6. **Server hub**: favourites with live ping, MOTD, player count; one-click join (`--quickPlayMultiplayer`).
7. **World backups** (zip on exit, keep last N) and a "restore" button.
8. **Mod compatibility check** before install (loader, MC version, known conflicts from Modrinth `incompatible` deps).
9. **Launcher self-update** with signature verification; reproducible builds; SignPath/Authenticode signing.
10. **Luminos Client mod**: armour HUD, keystrokes/CPS, potion + durability HUD, coordinates, toggle sprint, freelook, zoom, FPS/ping widget, **drag-and-drop HUD editor** exposed through Mod Menu (YACL screens). Ship under a permissive licence so server owners can recommend it.
11. **Cosmetics without ads**: capes via open services (OptiFine/MinecraftCapes style) only with explicit opt-in; never ship telemetry by default.
12. **Portable mode** (`LUMINOS_HOME` already supported) and a USB-stick friendly build.
13. **Accessibility**: UI scale, high-contrast theme, reduce motion (done), keyboard navigation, screen-reader labels (needs AccessKit — egui supports it).
14. **Offline-first**: cache manifest/news/featured; gracefully degrade (partly done).
15. **Plugin API** (WASM) for community themes and tools — later.

## Skills discovered (see AGENTS.md)
- Taste Skill (Leonxlnx/taste-skill) — metric-driven layout/typography/motion rules
- UI/UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill) — searchable style/palette/UX rules
- Rust Best Practices (massimodeluisa/rust-best-practices-skill; Apollo GraphQL's handbook as `rust-best-practices`)
- Directories: skills.sh, skills.lc, open-design.ai catalog

## Risks
- Offline-mode is lawful for a launcher, but marketing must not encourage piracy; the site says "bring your own account / offline play".
- Mojang EULA/brand: keep the "not affiliated" disclaimer; never ship game files.
- Modrinth API terms: keep a descriptive User-Agent (done), cache aggressively, don't hammer endpoints.
- Fonts: Inter and JetBrains Mono are SIL OFL — ship their licence text in release bundles.

---
# Session 2 additions

## Name
Working name **Luminos** (Latin *lumen*, "light" — fits a featherweight launcher with a glowing-blue identity and it is already your repo name). Not trademark-searched; do that before a 1.0 release. Alternatives if you want to switch: **Azurite** (blue mineral, very Minecraft-y), **Nimbus** (light/airy), **Ditherlight** (leans into the dither identity), **Halcyon**, **Pixelume**. My recommendation: keep Luminos — rename later is a `sed` away (`LUMINOS_HOME`, crate names, strings).

## Extra references reviewed
- **OpenLauncher (CesarGarza55)** — read live. Ideas adopted: version-aware GC presets (ZGC on 21+, Aikar G1 on ≤17 — now in `jvmflags.rs`), crash auto-fixer concept (our *Crash doctor*). Ideas queued: **instance migration wizard from `.minecraft`**, **"close launcher while playing" zero-overhead mode** (we are Rust, so even "hide" mode costs little), Fabric incompatibility auto-fix by harmonising versions, per-language UI. Note it's Electron (GPL-2.0) — we stay Rust and write original code.
- **OneLauncher / OneClient (Polyfrost)** — one-click curated client bundles, signed installers (done conceptually via our bundle + first-party mod).
- Legacy Launcher source link sits behind a Cloudflare challenge and the open-design.ai catalog is a design-skill index — not reviewed in depth.

## New recommendations (beyond session 1's list)
1. **Instance import/migration** from `.minecraft`, Prism/MultiMC, CurseForge, Modrinth App (high value, low risk).
2. **Auto-backup before launch / on exit** using `backup.rs` (+ restore points before *Update all*).
3. **Per-server profiles** — join a saved server with its own instance & HUD layout (`--quickPlayMultiplayer`).
4. **Shareable HUD layouts** — export/import `luminos-client.json` as a code; community layout gallery.
5. **Mod conflict checker** before install using Modrinth `incompatible` dependencies.
6. **Launcher self-update** with signature verification; reproducible release builds.
7. **Skin hub**: Mojang skin upload once MS auth is wired; open libraries (NameMC-style) via official APIs only.
8. **Telemetry-free crash sharing**: one-click redacted upload to mclo.gs.
9. **Discord Rich Presence** (opt-in) showing instance + server.
10. **Replay/clip hooks**: detect server join, save last-30-s clip via OS recorder (later).

## Competitive snapshot — where Luminos wins
Size (≈11 MB vs. Electron 100 MB+), zero ads/adware, honest status labels, first-party HUD + optimisation bundle, local-only playtime, crash doctor + backups + server hub in the same app.
