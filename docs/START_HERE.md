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
