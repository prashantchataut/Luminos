# Client screenshots (session 13)

Every PNG here was captured **from the real running client** (Fabric Loader + Minecraft under Xvfb with software OpenGL,
`smoke.yml` on GitHub Actions, PR #13), not drawn or mocked. File name: `<screen>-<minecraft version>.png`, so each screen has a
`26.3` and a `1.21.11` capture.

**Limits you should know about, up front**
- **Not 2x.** The CI display is 1280x720 and Minecraft renders at 854x480 inside it (letterboxed). That is 1x. A 2x capture
  needs a larger Xvfb screen plus a GUI scale change in the smoke job; not done.
- **Sample data.** The Waypoints tab shows three waypoints the smoke tour inserts (`LuminosClient.smokeSeedWaypoints`), and the
  Support tab analyses a *synthetic* crash report the tour writes (`smokeSeedCrash`, an ordinary `OutOfMemoryError` shape). The log rows
  under it are the real `latest.log` of that CI launch. The panel has no world loaded in these shots (title screen), so distances are not shown.
- **Screens in the brief that have no capture, because they do not exist yet:** HUD editor (the previous session's editor exists but this
  tour does not open it), F3 replacement, inventory HUD, cosmetics/outfits, chat tabs, replay browser, keybind-sync UI, performance
  overlay *in a world*. No empty or mocked stand-ins were added.
- **No GIF/MP4** was produced.

## Screens

| Screen | 26.3 | 1.21.11 | What it proves | Skill rules applied (by hand; taste-skill's scripts only parse HTML) |
|---|---|---|---|---|
| Quick panel, Modules (existing, new 9-tab rail) | [png](panel-26.3.png) | [png](panel-1.21.11.png) | Nine tabs fit; favourites-first ordering is active | taste-skill 5 "One system": one card style, one radius scale. "Equal edges": cards on the same two columns |
| Context menu (right-click module) | [png](panel-menu-26.3.png) | [png](panel-menu-1.21.11.png) | The menu draws over cards in real Minecraft. *Position is fixed by the tour (`smokeContext`), not by a real right-click* | taste-skill 5 "Motion: every control answers the pointer" (hover fill on items); [text-contrast] |
| HUD tab with share-code rows | [png](panel-hud-26.3.png) | [png](panel-hud-1.21.11.png) | Copy/Import layout code rows render. *Clipboard round trip not exercised in CI* | [copy-buttons]: a verb and an object ("Copy layout code") |
| Waypoints tab | [png](panel-waypoints-26.3.png) | [png](panel-waypoints-1.21.11.png) | Colour swatches, dimension labels (Overworld/Nether), disabled "Add" with its reason | taste-skill 6 Never: no violet (the palette had lavender; removed). "No placeholder, sample note": sample data is declared above |
| Support tab (crash assistant + log viewer) | [png](panel-support-26.3.png) | [png](panel-support-1.21.11.png) | Plain-language cause and fix from a crash report; real warning/error lines from `latest.log` | ui-ux-pro-max pre-delivery checklist: status never by colour alone (every row has a word badge: CRASH / FIX / ERROR) |
| Ranked search ("key") | [png](panel-search-26.3.png) | [png](panel-search-1.21.11.png) | Search across every tab, best match first | [a11y-name]-style: the search field has visible text, not only a placeholder |
| Keybinds, Title, Cover | [keys](panel-keys-26.3.png) / [title](title-26.3.png) / [cover](cover-26.3.png) | same names, `-1.21.11` | Session 12 screens, re-captured on this commit | - |

### Anti-slop checklist result (taste-skill section 5, applied by eye to the panel)
| Item | Result |
|---|---|
| text-contrast | **Pass.** Measured: text 12.4-16.8:1, dim text 4.9-6.6:1, OK 8.8-12.0:1, WARN 9.3-12.6:1 on every panel surface. Accent is 4.46:1 on a hovered card but is used only for borders and the active-tab stripe, never text |
| Never: violet/lavender | **Fixed.** Waypoint palette had `C792FF`; replaced with a coral |
| Card text overlap | **Fixed.** First capture showed subtitles colliding with titles (and my own "right-click" suffix truncating every module subtitle). Both corrected before the final capture |
| Log false positive | **Fixed.** First capture showed an `[INFO]` line rendered as ERROR. `LogTail.level` now trusts explicit level tags; regression test added |
| reduced-motion | **Open (FAIL).** The panel's 180 ms open ease does not read any reduced-motion setting; Minecraft has none, and Luminos has no config flag for it yet |
| Keyboard / screen-reader labels | **Open (FAIL).** The context menu is mouse-only; Minecraft's narrator is not wired to the panel. Move up/down in the menu is the non-drag way to reorder, but drag-to-reorder itself is not built |
| Scripted checks (consistency/check/perf.mjs) | **Not run.** They parse a web page; the panel is a canvas |

## Feature status (brief section 1)

Legend: **VERIFIED** = screenshot or CI test in this PR. **COMPILED** = built on 26.3 and 1.21.11 in CI, never seen running in a world.
**EXISTING** = shipped in session 12, not re-verified. **NOT BUILT** = nothing exists. There is no row marked both "built" and "unverified without a script"
unless a manual script is given below.

| Feature | Source client | Status | Proof / path |
|---|---|---|---|
| Panel search with ranking | Wurst/Meteor catalogue, LuneX | VERIFIED | `core/ModuleSearch.java`, tested in CoreTests; `panel-search-*.png` |
| Favourites | Lunar/Meteor | COMPILED + logic VERIFIED | `ModuleSearch.toggle`, `Config.favourites`; no capture with a favourite set |
| Right-click quick settings | LuneX, Lunar tooltips | VERIFIED (render) | `panel-menu-*.png`; real right-click path: manual test 2 |
| Per-module enable/disable | all | EXISTING + context menu | `Panel.java` |
| Drag-to-reorder | Brief | **NOT BUILT** (Move up / Move down in the menu instead; order logic tested) | `ModuleSearch.move` |
| HUD share code import/export | LabyMod crosshair sharing | Logic VERIFIED, UI COMPILED | `core/ShareCode.java`, tested in CoreTests incl. tamper + decompression bomb; manual test 3 |
| Waypoints, labels, colours, distance, dimension filter | Lunar, Badlion | Logic VERIFIED, tab VERIFIED (sample data), HUD module COMPILED | `core/Waypoint.java`, `WaypointStore.java`, `ToolModules.WaypointsHud`; in-world rendering not built (HUD list only, no world-space markers) |
| Crash assistant (plain cause + fix) | Lunar bug-report button | VERIFIED for 12 crash shapes (hand-written samples, not captured live) | `core/CrashAssistant.java`; `panel-support-*.png`. The fix is written to `luminos-fix-request.json`; **the launcher does not read it yet** |
| Session log viewer | Lunar bug-report | VERIFIED | `core/LogTail.java`; `panel-support-*.png` |
| Performance overlay | Brief | COMPILED | `ToolModules.PerfOverlay`, `core/FrameStats.java` (tested); manual test 4 |
| Colour-blind presets | none of the studied clients | Palettes VERIFIED (contrast + lightness tests); applied to the panel only, not HUD modules | `core/ColorblindPalette.java`, Performance tab row |
| Benchmark before/after | Badlion/Dawn claims | Formatter VERIFIED; **runner NOT BUILT; no numbers** | `docs/PERF.md` |
| Keystrokes, CPS, FPS, ping, coordinates, direction, armour, potions, clock, memory, server IP, playtime, item counter, crosshair | Lunar, Badlion | EXISTING (preview data only in CI) | `Modules.java`, `ExtraModules.java` |
| Toggle sprint, zoom, HUD editor with snapping, profiles, compliance mode, custom title screen | Lunar, Badlion | EXISTING | session 12 |
| Saturation, combo counter, reach display, scoreboard, F3 replacement, inventory HUD | Lunar | **NOT BUILT** | - |
| Freelook, hit colour, block overlay, motion blur, 1.7 animations | Lunar, Badlion | **NOT BUILT** (freelook/hit colour show a disabled reason in the panel) | - |
| Per-server layouts, config/keybind sync across instances | OneConfig | **NOT BUILT** in the client (launcher-level sync exists from session 12) | - |
| Cosmetics: live swap, outfits, animated capes, 3D layers, other players' skins | Lunar locker, Laby | **NOT BUILT** | - |
| Chat tabs, AutoGG/AutoTip, voice chat, Discord presence | Laby, Badlion, Dawn | **NOT BUILT** | - |
| Replay recorder and browser | Badlion Replay, Lunar Rewind | **NOT BUILT** | - |
| World sharing relay, LAN discovery, `luminos://`, server list in-game | Laby | **NOT BUILT** | - |
| Performance bundle per version, GPU detection, VulkanMod/Nvidium advice, HUD caching, JVM presets, malware check | Dawn, Badlion | **NOT BUILT** in this session | - |
| i18n files, gamepad mode, launcher screenshot gallery | brief | **NOT BUILT** | - |
| 3 more Minecraft versions (1.21.4, 26.1.2, 26.2), Stonecutter | brief | **NOT BUILT** | only 26.3 and 1.21.11 exist |

## Manual test scripts for COMPILED / unproven items
1. **Panel from a world:** `--quickPlaySingleplayer <world>`, press Right Ctrl. Expect the nine-tab panel; Esc closes.
2. **Right-click menu:** Modules tab, right-click a card. Expect the menu next to the pointer; "Add favourite" moves the module to the top and shows `FAV`; "Move down" changes order; click outside closes without acting; Esc closes.
3. **Share code:** HUD tab, "Copy layout code", paste into a text editor (should start `LUM1-`), change the HUD layout, "Import layout code" restores it. Flip one character in the code and import: expect "Share code failed its checksum".
4. **Perf overlay:** Modules tab, enable "Performance overlay", leave the panel. Expect frame ms, avg, 1% low, p99, memory updating; disable and confirm nothing is drawn.
5. **Waypoints:** in a world, Waypoints tab, "Add waypoint here"; go to the Nether and confirm it is hidden until "Other dimensions" is switched to ALL; enable the Waypoints HUD module and confirm distance updates as you move.
6. **Crash assistant:** put a crash report containing `java.lang.OutOfMemoryError: Java heap space` in `crash-reports/`, open Support, Refresh. Expect "Minecraft ran out of memory".
