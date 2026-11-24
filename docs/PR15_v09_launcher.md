# v0.9 launcher redesign, cosmetics library, perf tooling. **Partial: the in-game client work and the v0.9.0 release are NOT done.**

Branch `feat/v0.9-client-launcher-finish`, off `main` (PR #14 merged). No Android, no website, no server-side features.

**Read this first.** The brief had six sections. This session finished the **launcher front-end**, the **cosmetics library**, the **research** and the **launcher-side perf tooling**. It did **not** build the Java in-game client features (title screen, death markers, fonts, in-game crosshair editor, in-game keystroke layouts), did **not** tag `v0.9.0`, and measured **no** FPS or startup numbers. The sandbox had no JDK, no Rust toolchain and no GPU; "needs a real device" was not used as an excuse, the missing items are listed below with manual test scripts, but there was no way to compile or run the Java here, and shipping blind-written client code under a green-looking PR would have been worse than shipping nothing.

## Screens (rendered at 2x, 4 rounds each, `docs/launcher-shots/rounds/<screen>-<n>.png`)

Critique per round: `docs/launcher-shots/rounds/CRITIQUE.md`. Skill rule IDs, anti-slop / liquid-glass / readable checks per screen: `docs/design/SKILL_NOTES.md`. Contrast table: `docs/design/CONTRAST.md`.

![built dist: cosmetics](https://raw.githubusercontent.com/prashantchataut/Luminos/feat/v0.9-client-launcher-finish/docs/launcher-shots/built-dist-cosmetics.png)
![built dist: home](https://raw.githubusercontent.com/prashantchataut/Luminos/feat/v0.9-client-launcher-finish/docs/launcher-shots/built-dist-home.png)

(Those two are the actual built `dist/index.html`, served and captured.)

| Screen | Final render | What it is | Learned from / what we did differently | Files | Status |
|---|---|---|---|---|---|
| Home | `rounds/home-4.png`, `home-launching-4.png` | Hero with real per-version cover art, big LAUNCH button that morphs idle > preparing > starting > running, Quick Play (last server / world / modpack), recent instance cards, real Mojang patch notes, playtime, performance card, one-click PvP / Survival presets | OneLauncher and Reality Launcher dashboards; we kept one accent and a 32 px row rule | `app/src/screens/Home.tsx` | **VERIFIED** (render). Launch morph is simulated in a browser; in the app it follows engine `launch` events (UNVERIFIED on Windows) |
| Instances | `instances-4.png` | Card grid, cover art, loader icon, version/loader/mod badges, play / edit / clone / export | OneLauncher | `Instances.tsx` | **VERIFIED** render + clone. **Export has no engine command** and says so on screen |
| Library | `library-4.png` | Search-first, real Modrinth icons, **Luminos Picks** shelf with a one-line reason each, install / update / remove morph, requires / conflicts warnings (VulkanMod vs Sodium and Iris) | Modrinth App; Picks is our own idea | `Library.tsx`, `data/launcher.ts` | **VERIFIED** render and conflict logic. Install is simulated in a browser; the "CI" badge means "in the default preset smoke.yml launches", "Ref" means "recommended from upstream docs, not run by us" |
| Cosmetics | `cosmetics-4.png`, `gifs/cosmetics-viewer-rotating.gif` | **skinview3d** viewer (classic/slim, cape, elytra wings, idle/walk/run/fly, rotate, screenshot), wardrobe with folders, favourites, search, 48 original skins, 14 original capes (6 animated), saved outfits (skin + cape + wings), import by file / username (minotar) / capes.dev lookup, link-outs | Reality Launcher wardrobe | `Cosmetics.tsx`, `tools/make_skin_library.py`, `data/library.json` | **VERIFIED** render + WebGL viewer. Import by username / capes.dev are live calls (CORS checked with curl), not exercised in a browser run. **No community skins** (see research) |
| Servers | `servers-4.png` | Real server icons, MOTD, player counts (snapshot 2026-11-24 from api.mcsrvstat.us, live Refresh button), tags, favourites, add-by-address, quick join | Lunar server list | `Servers.tsx` | **VERIFIED** render. Ping is shown only when the app's `servers_list` returns it (UNVERIFIED) |
| Client page | `client-4.png`, `gifs/crosshair-presets.gif`, `gifs/keystrokes-a-to-b.gif` | One-click PvP / Survival presets, **crosshair editor** (shape, thickness, gap, length, outline, colour, opacity, spread, PNG import, 8 original presets) on a real in-game capture, keystroke layout A / B preview, built-in QoL toggles (low fire + offset, low shield, compact totem, pumpkin, frost, nausea, spyglass, explosion flash, rain ripples, crystal water/lava, particle taming), per-dimension fog + distance, compliance mode | Clearion fog model; Lunar Keystrokes layout; PolyCrosshair presets (designs are ours) | `Client.tsx` | **Editor VERIFIED** (render, GIF). **The in-game client does not read these values yet**: the page says so on screen |
| Settings | `settings-4.png`, `settings-performance-4.png` | Grouped, searchable. Every control writes the store (applied to the UI) or the engine via `set_setting`. Performance: profile, HUD throttle, input sampling, startup cache, renderer picker, "Why is my FPS low?", Click test. Developer: startup profiler | Lunar / Badlion density | `Settings.tsx`, `store.ts`, `perf.ts` | **VERIFIED** render + 13 logic tests |
| Onboarding | `onboarding-*-4.png` | Dithered sky, Microsoft **device-code** sign-in, offline profile with name check, import from other launchers, setup progress | Reality Launcher device-code flow | `Onboarding.tsx`, `app/src-tauri/src/lib.rs` (`ms_device_begin`, `ms_device_finish`) | UI **VERIFIED**. The two new Rust commands were **written without a compiler**: UNVERIFIED until CI builds the Tauri crate. Sign-in needs an Azure client ID (`LUMINOS_MS_CLIENT_ID`) that only the owner can register. In a browser it shows a truthful "desktop app only" message. The import list in a browser is sample data |
| Shell, design system | all | Type scale 11/13/15/20, 32 px rows, one accent, hover = lift + border brighten, liquid glass tint 0.08-0.18 with blur + saturate + brightness, hairline, inset highlight, spring motion, **glass intensity slider** and **Solid panels** switch in the top bar, `prefers-reduced-transparency`, `prefers-contrast`, `@supports not backdrop-filter` fallback | WasterVisual, Kirri's UI, Saturn (separate blur levels not done) | `index.css`, `kit.tsx`, `App.tsx` | **VERIFIED** render; contrast computed (a first run failed and was fixed). OS reduced-transparency probe UNVERIFIED on Windows/macOS |

### GIFs (4 of the 7 requested)
`docs/launcher-shots/gifs/`: `home-loading-and-launch.gif`, `cosmetics-viewer-rotating.gif`, `crosshair-presets.gif`, `keystrokes-a-to-b.gif`.
**Not made, because the feature does not exist yet:** font picker applying a font, death waypoint appearing, title screen animating.

## Research and data
`docs/research/SKINS_AND_CAPES.md` (sources, requests made, what was blocked), `docs/research/LIBRARY_ATTRIBUTION.md` (one licence row per file), `docs/research/library-contact-sheet.png`.
- **48 original skins** (8 each: survival, pvp, builder, cute, spooky, minimal) and **14 original capes** (6 animated), all generated by `tools/make_skin_library.py`, CC0-1.0.
- **MC-Skins.net is behind a Cloudflare challenge; NameMC reserves content rights.** We did not scrape or bypass either, so the "top ~200 community skins with creators" are **0**. Link-outs only.
- capes.dev, minotar, Crafatar and SkinMC patterns verified live (CORS and status codes in the doc). `skinview3d` used instead of minecraft-skin-renderer (the brief allowed it).

## Performance (`docs/PERF.md`, section "Session 15")
Renderer picker with Nvidium / VulkanMod gating, FPS diagnostic reading real WebView facts, Click test, startup profiler: built and tested. **No FPS or startup number was measured.** The three-profile table is present and marked UNVERIFIED. `smoke.yml` already prints a Sodium-only vs Luminos startup ratio on llvmpipe; that figure is software-GL only.

## Skills (`ls -R .agents/skills`, full listing in `docs/design/skills-ls-v09.txt`)
```
.agents/skills: agent-reach anthropic-frontend-design anthropic-theme-factory anthropic-webapp-testing apollo-rust-skills
better-icons* emil-kowalski-skills fabric-stonecutter game-ui-design game-ui-ux hallmark ibelick-ui-skills icon-system
kotlin-android liquid-glass minecraft-ui-design* rea rea-morluto react-vite-dashboard* reanimate rust-best-practices
taste-skill ui-design-skill ui-ux-pro-max uihall vercel-composition-patterns vercel-react-best-practices vercel-web-design-guidelines
(* = added this session; the rest were installed in sessions 11-14)
```
Sources and licences: `.agents/skills/PROVENANCE.md`. skills.sh is client-rendered and was not browsed; nothing was taken from it.

## What was NOT done (work these first next session)
| Brief item | State |
|---|---|
| Custom title screen (ZenithUI-style), death markers / waypoints / death screen box / compass / chat coords / waypoint list, built-in font picker + TTF import, per-HUD font controls, in-game crosshair editor and keystroke layouts, in-game QoL effects (low fire, fog, overlays), in-game glass panels (the PR #14 panel is still the flat one) | **NOT BUILT** (Java). Launcher-side config pages and the file format exist; the reader does not |
| Death recap timeline, font pairing presets | **NOT BUILT** |
| Mixin / metadata caching, parallel discovery, auto-drop of conflicting mods, HUD pixel cache | **NOT BUILT** |
| Client screenshots under `docs/client-shots/rounds/` | **None added** (no in-game build possible here) |
| Tag `v0.9.0`, `Luminos-Setup.exe`, client jars for every version, checksums | **NOT DONE.** Tagging would publish a release that lacks the client work and whose Tauri changes are uncompiled. CI on this PR decides whether they build |
| Community skins (200) | **0**, for the licence reasons above |
| 3-profile FPS and startup benchmark | **NOT RUN** (UNVERIFIED) |

Manual test scripts: `docs/client-shots/README.md` ("Manual tests"). Verify the launcher: `cd app && npm ci && npm test && npm run build && npx vite preview --port 4173 && node tools/shots.mjs 5`.

## Honest limits (as the brief asked)
- Skin visibility on official online-mode servers is Mojang-authoritative; third-party capes render only for players with the matching provider (the Cosmetics viewer carries an "Offline view" badge saying so); the Luminos cape provider server was not built (no server-side features).
- VulkanMod and Nvidium only work on qualifying GPUs and can conflict with shaders; the picker never installs one silently.
- Code signing and SmartScreen reputation are unchanged from PR #14.
- Stub grep (`todo!|unimplemented!|lorem|coming soon|placeholder|FIXME`) over `src crates client launcher app`: only HTML `placeholder=` attributes, two pre-existing test-fixture strings and one old egui comment remain; none is a stub.

## Recommendations (priority order)
1. **Give the next session a JDK and Gradle (or a self-hosted runner)** and build the client in this order: `luminos-client.json` reader (so the Client page does something), PvP / Survival presets applied in game, crosshair renderer, keystroke layouts A / B, then the title screen. The launcher already defines the file format and previews.
2. **Register the Azure app** for `LUMINOS_MS_CLIENT_ID`, then test `ms_device_begin` / `ms_device_finish` with a real account. They are the only uncompiled Rust in this PR.
3. **Death recap timeline natively** (last 10 deaths, hit timeline, damage graph, inventory), then waypoints on top of it.
4. **Grow Luminos Picks** by running each pick through the smoke test and flipping "Ref" to "CI" only when it loads.
5. **Font pairing presets** (Inter + Monocraft, geometric + pixel, serif + Inter) before exposing free font choice.
6. **Startup profiler: make the engine write the five game stages** (JVM, discovery, mixins, resource reload, first frame) so the existing Developer panel can chart them.
7. **Cosmetics provider**: when server work is allowed again, mirror SkinMC Custom Capes so Luminos capes show for other Luminos users.

## Security
A GitHub PAT was pasted into chat again. It was used only for a one-off `http.extraHeader` push and PR creation and was never written to a file, remote URL or git config. **Revoke it** and use a fine-grained token scoped to this repository.
