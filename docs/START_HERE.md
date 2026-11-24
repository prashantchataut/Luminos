# START HERE (session 15: launcher finish, cosmetics library, perf tooling; PR on `feat/v0.9-client-launcher-finish`)

Read `docs/PR15_v09_launcher.md` for the full table. Short version:

| Thing | Status |
|---|---|
| Launcher redesign (Home, Instances, Library, Cosmetics, Servers, Client page, Settings, Onboarding), liquid glass + intensity slider + Solid switch, 4 render rounds each | **VERIFIED** (render, 2x, `docs/launcher-shots/rounds/`) |
| 48 original skins + 14 original capes (6 animated), CC0, generated; skinview3d viewer, outfits, import | **VERIFIED** (render) |
| Renderer picker logic, FPS diagnostic, Click test model | **VERIFIED** (`cd app && npm test`, 13 assertions) |
| `ms_device_begin` / `ms_device_finish` Tauri commands | **Compiles** (CI `windows` job green); never run with a real account; needs `LUMINOS_MS_CLIENT_ID` |
| In-game: title screen, death markers, fonts, crosshair/keystroke/QoL **in the client**, glass panels | **NOT BUILT** (no JDK in the session) |
| Community skins (MC-Skins.net / NameMC) | **0**: Cloudflare challenge / rights reserved. Link-outs only |
| FPS and startup numbers, three profiles | **NOT MEASURED** (`docs/PERF.md`) |
| `v0.9.0` tag and release assets | **NOT DONE** |

Next: get a JDK, build the `luminos-client.json` reader so the launcher's Client page takes effect, then the crosshair renderer, keystroke layouts and the title screen.
Security: a PAT was pasted into chat again; revoke it.

# START HERE (session 14: client UI overhaul + input path, PR #13)

Read this block first. It supersedes the status lines below for the *client UI only*.

| Thing | Status |
|---|---|
| Liquid-glass quick panel (blur + 0.08-0.18 tint + hairline + highlight, spring motion), solid fallback, glass-intensity slider, OS reduced-transparency probe | **VERIFIED in the real client** (45 captures); OS probe UNVERIFIED on Windows/macOS |
| Search-first, grouped collapsible sections with counts, 24 px icon rows, right-click popover with sliders and switches, favourites | **VERIFIED** (render); right-click by a real mouse, slider drag and favourites reorder not exercised |
| HUD: icon potions, neutral glass keystrokes, health/hunger/absorption, armor with durability, target HUD, ping (server + measured), debug lite, inventory HUD, Minimal/Competitive/Full presets | **VERIFIED** (editor render with sample data); in-world values COMPILED only |
| Fullbright (gamma, capped at vanilla 1.0), shulker/bundle/ender tooltip, compliance reasons | COMPILED on 1.21.11 and 26.3; not seen in a world |
| Render-loop input sampling, tap latching, frame-queue guard, Click test | COMPILED + core logic tested (136 assertions); **behaviour in a world UNVERIFIED** |
| FPS doctor, renderer picker | **VERIFIED** (logic tests + render) |
| Freecam, freelook, chat tabs, replay browser, outfits/animated capes, F3 *replacement* (a compact Debug lite exists), launcher-side startup/mixin caching, conflicting-mod dropping | **NOT BUILT** (see docs/PERF.md) |
| Startup < 60% of Sodium-only; FPS vs Sodium/VulkanMod/Nvidium | **UNVERIFIED, no data** |
| 26.3 screenshots | NOT in this PR (CI tour updated, output not collected) |
| GIF | slideshow of stills only, not a recording |

Next: run `scripts/capture-client.sh 4` and confirm the caption fix; collect 26.3 from `smoke.yml`; measure startup and FPS on three real machines; build freecam only with an input-freeze mixin.
**Security:** a GitHub PAT was pasted into chat again. It was used only for a one-off `http.extraHeader` push and PR edit and is not stored anywhere. **Revoke it** and use a fine-grained token scoped to this repository.

# START HERE (session 13 handover: client foundation, PR #13)

**Read this before trusting any other doc.** The session-13 brief asked for the whole in-game client (about 60 features), a v0.8.0 release,
benchmark numbers on three machines, 2x screenshots of 11 screens, and a GIF. **That is not done.** This session built a verified foundation
and left everything else explicitly unbuilt. There is **no v0.8.0 tag**, `client/client-compat.json` still pins `client-v0.3.0` jars, and CI
covers two Minecraft lines (26.3, 1.21.11), not five.

PR: https://github.com/prashantchataut/Luminos/pull/13 (branch `feat/client-v0.8-foundation`). Session 12's PR #12 is merged.

## VERIFIED
| Thing | Evidence |
|---|---|
| 106 assertions of pure client logic pass, in CI, before the Gradle build | `client/tests/CoreTests.java`, `client.yml` step "Core logic tests" |
| Client compiles on 26.3 and 1.21.11 with all new code | `client.yml` `build (26.3, client26)` and `build (1.21.11, client)` green |
| Headless launch to the title screen, both versions, no Fabric incompatibility, then a scripted tour of nine panel screens | `smoke.yml` PR #13, `pass: true` |
| New panel features render in the real client: 9-tab rail, right-click menu, HUD share rows, Waypoints, Support (crash assistant + real log lines), ranked search | `docs/client-shots/` (1x, 1280x720, sample data declared in its README) |
| Real bugs the screenshots exposed and that were fixed | INFO line shown as ERROR (`LogTail`), text overlap on cards, my own subtitle truncation, a lavender waypoint colour |
| Client teardown | `docs/research/CLIENT_TEARDOWN.md` (public sources only; says what could not be verified) |
| Skills | `docs/design/skills-ls.txt`; UiHall found and installed (session 12 wrongly said it did not exist) |
| Stub grep on `client/` and `client26/` | no matches. Matches elsewhere (HTML `placeholder=` attributes, a test fixture host named "placeholder") are not stubs and were not touched |

## COMPILED, NOT SEEN RUNNING (manual scripts in `docs/client-shots/README.md`)
Right-click from a real mouse, favourites reordering, clipboard share-code round trip, performance overlay and waypoints HUD in a world, adding a
waypoint, Right Ctrl from a world (still the session-12 gap).

## NOT DONE (do not assume any of it exists)
The full list is the table in `docs/client-shots/README.md`. The big blocks: replay recorder; cosmetics live swap, outfits, animated capes;
chat tabs, AutoGG, voice chat, Discord presence; world sharing relay, LAN discovery, `luminos://`; F3 replacement; inventory HUD; saturation, combo,
reach, scoreboard; freelook, hit colour, block overlay, motion blur, 1.7 animations; per-server layouts and in-client config sync; the performance bundle
(GPU detection, VulkanMod/Nvidium advice, dependency graph over `fabric.mod.json`, HUD caching, JVM presets, malware check); i18n; gamepad mode;
screenshot gallery; Benchmark runner; 1.21.4 / 26.1.2 / 26.2 builds; Stonecutter; tag and `client-compat.json` regeneration.
**No benchmark numbers exist.** `docs/PERF.md` has an empty table and says why.
Also not done: 2x captures, any GIF/MP4, the keybinding-sync/replay/HUD-editor/F3/inventory/cosmetics/chat/overlay screenshots.

## Honest notes on this session
- `rea` was **not** run against any binary and the closed-source clients were never decompiled or run. The teardown is from public pages and says so.
- Yuki/LuneX/CherryMC could not be studied as UI: LuneX is a cheat client (UI pattern only), Yuki had no UI information, CherryMC matched nothing.
- The crash-assistant fix is written to `luminos-fix-request.json` but **the launcher does not read it**; the in-game text says so.
- The 12 crash-report samples in the tests are hand-written in the shape of real messages, not captured from live crashes.

## Exact next steps (in order)
1. In `smoke.yml`, raise the Xvfb screen and GUI scale so captures are 2x; add a `--quickPlaySingleplayer` world step, press Right Ctrl with `xdotool`, capture the in-world panel, the perf overlay and the waypoints HUD (kills most of "compiled, not seen running").
2. Launcher: read `luminos-fix-request.json` after a crash and run `raise_ram`, `use_java:N`, `disable_mod:ID`, `install_mod:ID`.
3. Build the Benchmark runner on top of `FrameStats`/`BenchReport`; run it on three real machines (or a self-hosted runner) and fill `docs/PERF.md`.
4. Add Stonecutter and the three missing versions, then regenerate `client-compat.json` and tag.
5. Then the NOT DONE blocks, smallest first: F3 replacement, inventory HUD, combo/reach/saturation, freelook and hit colour (need a mixin per version).

## Security
A GitHub PAT was pasted into chat again (scopes included `repo`, `workflow`, `admin:repo_hook`, `delete:packages`, `write:packages`). It was used only to push
`feat/client-v0.8-foundation`, open PR #13, read CI logs and download artifacts; it was held in a `chmod 600` file outside the repo and deleted at the end.
**Revoke it** and use a fine-grained token limited to this repository.
