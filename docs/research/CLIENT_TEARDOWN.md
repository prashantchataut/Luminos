# Client teardown (session 13)

**Method, stated plainly.** Every client below was studied from *public* material only: vendor pages, patch notes,
changelogs, Modrinth/GitHub listings and third-party reviews, fetched with web search in session 13. No closed-source
client was decompiled, run, or downloaded, and no binaries were inspected. The `rea` workflow (map, trace, note) was
only applied to open-source code, and that was done in session 12 for OneClient (see
[ONECLIENT_TEARDOWN.md](ONECLIENT_TEARDOWN.md)); it was **not** re-run this session. Where a claim comes from a search
snippet rather than a full page, the row says so. Nothing here is copied code, art or strings.

Figures are quoted *as the vendor states them*, not measured by us.

| Legend | |
|---|---|
| **learn** | a pattern worth matching |
| **beat** | where Luminos can be better, with the concrete mechanism |
| **don't copy** | cheat behaviour, dark patterns, or things we cannot honestly claim |

## 1. Lunar Client (closed source)

Sources: Lunar patch notes #7 (module launch list), "Getting Started with Lunar Client", Lunar Monthly Recap Jan 2026
(F3 Display Mod, Outfits), a community mod-list guide on hypixel.net.

| Observed | Detail |
|---|---|
| Mod count | "75+ mods" in their own guide. The 2020 patch notes list the launch set: Crosshair, Waypoints, Freelook, Ping, Scrollable Tooltips, Chat, Particle Multiplier, UHC Overlay, Clock, WorldEdit CUI, AutoText Hotkey, Memory Usage, Stopwatch, Shiny Pots, Combo Counter, Reach Display, Time Changer, Server Address, Saturation, Item Tracker |
| Menu | Right Shift mod menu. Mods have icons, a description each, a tooltip per setting. Cosmetic and emote menus are reachable from it. A bug-report button sits bottom-left. Settings and Controls (Lunar-specific keybinds) are tabs above the mod list |
| F3 Display Mod (Jan 2026) | Add/remove F3 components, move components onto the HUD, and show them *with F3 closed* |
| Outfits (Jan 2026) | "Fits" section in the Cosmetic Locker. Saves skin, badge and equipped cosmetics as one unit |
| CPS | Right-click CPS and an option to hide the "CPS" text were added after launch |
| Categories | Survival (Waypoints, Zoom, Lighting, Toggle Sneak/Sprint), PvP (PvP Info, Combo Counter, Reach Display, Armor Status), Hypixel-specific |

| learn | beat | don't copy |
|---|---|---|
| Per-setting tooltips and a one-line description per module; a bug-report button inside the menu; Outfits as a single saved unit; F3 lines promotable to the HUD | The Support tab shows the *plain-language cause and fix* of the last crash plus a filtered log tail, so a report is already half-written. Favourites and ranked search across every tab | Lunar+ paywalled cosmetics and friends-list tiering; their trademark names and icon style |

## 2. Badlion Client (closed source)

Sources: client.badlion.net feature page, an independent explainer that counted 76 mods in four categories, Badlion's
FAQ snippet on Betterframes.

| Observed | Detail |
|---|---|
| Betterframes / BLC options | FPS Boost, World Optimization, Tile Entity VBOs, Adv. FPS Boost, Optimized Entity Movement, Smooth Lighting, Occlusion Culling (quality levels), Lazy Chunk Loading, Minimal Portal Textures, Limit Unfocussed FPS (30), Max Main Menu FPS (120), entity/tile-entity toggles |
| Mod set | Animations (about 16 sub-options: hitbox, item hold, block hit, sneaking, eating, sword swing, old enchant glint ...), ArmorStatus, Block Overlay, BossBar, Combo Counter, Coordinates, CPS, Crosshair, FOV Changer, FPS, Hit Color, Item Counter, Keystrokes, MLG Cobweb, Particles, Perspective, Ping, PotionStatus, Reach Display, Saturation, ToggleSprint, Waypoints, Zoom |
| Structure | Mods grouped Popular / PvP / Hypixel / Visual; each "mod" is a bundle of sub-features |
| Marketing numbers | Their page shows FPS figures for a Minecraft 1.8 test. **Theirs, 1.8, not comparable to a modern Fabric stack.** We do not quote them as a target |

| learn | beat | don't copy |
|---|---|---|
| "Limit unfocussed FPS" and "max menu FPS" are cheap honest wins; settings read as plain on/off lines with quality tiers | On 1.21+/26.x the real wins exist as maintained open mods (Sodium, Lithium, ImmediatelyFast, FerriteCore). Luminos bundles those, hash-verifies them against Modrinth, and shows what is loaded in the panel instead of one opaque "FPS Boost" switch | Their 1.8 benchmark graphics; proprietary Betterframes naming; any "1600+ FPS" claim |

## 3. LabyMod 4 (closed source)

Sources: laby.net client page, labymod.net services page, release-note excerpts (4.4.x World Sharing, 4.6.x widgets).

| Observed | Detail |
|---|---|
| Widgets | Every HUD element is a widget; a GUI editor positions them. 4.6.3 changelog: "clicking empty space highlights [Edit Widgets] with a hint" |
| Addons | Marketplace (Key Strokes, Custom Crosshair "share your design", Waypoints, Minimap, Voice Chat, Better Perspective as a freelook alternative) |
| Voice | 3D proximity voice, push-to-talk or voice activation, channels, "no server plugins needed"; later note: interoperates with servers running Simple Voice Chat |
| World Sharing | Replaced older LAN sharing; friends join a singleplayer world without port forwarding; "your IP stays protected" |
| Chat | Tabs, movable chat window, 3D screenshots |

| learn | beat | don't copy |
|---|---|---|
| Crosshair designs are shareable; friends see which world/server you are on | HUD layouts export as a share code (`LUM1-...`, CRC-checked, tested in `ShareCodeTest`). It works offline with no account | Hard dependency on an account service; "300+ mods" style counting |

*Status:* world sharing, proximity voice and chat tabs are **not built** in Luminos yet (see START_HERE).

## 4. Dawn (formerly Feather) (closed source)

Sources: dawn.gg pvp-client page and two 2026 roundups (Dawn took over Feather's in-game technology in May 2026).

| Observed | Detail |
|---|---|
| Modules | "100 modules"; voice chat between Dawn players, waypoints, screenshots, zoom |
| Performance claim | Vendor says testers saw about 27% more FPS in singleplayer and 30% on servers on 1.21.5-26.1.1; on Fabric it adds Sodium, Lithium and four more version-matched mods. **Vendor claim, unverified by us** |
| Launcher | Modrinth browser for your own Fabric/Forge mods; free Aternos server created from the launcher |

| learn | beat | don't copy |
|---|---|---|
| Their Fabric bundle *is* Sodium + Lithium + others, version-matched, which confirms the Luminos approach | We publish how the bundle was chosen and put before/after numbers in `docs/PERF.md`, with unverified numbers labelled | Ad-supported launcher; a currency ("Gems") for cosmetics |

## 5. OneClient / OneLauncher (GPL-3.0; patterns only)

Full notes in [ONECLIENT_TEARDOWN.md](ONECLIENT_TEARDOWN.md) (session 12, `rea` workflow on public source).

| learn | beat | don't copy |
|---|---|---|
| One unified config UX; instance-first navigation; bundle picker before launch | HUD, sprint and crash help are one jar with one config, so no cross-mod settings drift | Any code, strings or assets (GPL, AGENTS.md rule 7). Several named mods (PolyTime, PolyWeather, PolyNametag, Entity Culling in their bundle) could not be confirmed from source, and still can't |

## 6. Wurst and Meteor (open source; UI only)

**Not re-read this session.** What the brief states and what is generally known: category-organised module lists, a
searchable catalogue, per-module settings in place. Both are cheat clients. Nothing below is verified by a fresh read.

| learn | beat | don't copy |
|---|---|---|
| In-place per-module settings (now a right-click menu in the panel); search that ranks instead of filtering | Compliance mode is on by default (`auto`) and locks zoom on listed servers | Every combat, movement and ESP module. Luminos ships none |

## 7. Yuki, LuneX, Pupper, CherryMC

What a search could actually confirm:

| Client | Found | Verdict |
|---|---|---|
| Pupper Client | Modrinth listing: "modern Material UI design philosophy", custom HUD, built-in ViaFabricPlus, in-game account switching, MC 1.21.4; needs IAS, ViaFabricPlus, Fabric API, ModMenu | Real open Fabric client. No screenshots read, so no UI claims beyond the listing text |
| LuneX | Third-party listings: Right Shift menu, categorised modules, right-click for a module's settings, translucent blurred background, HUD and radar. The same listings advertise aim assist, triggerbot, auto crystal, ESP | **Cheat client.** UI pattern only. Everything else: don't copy |
| Yuki | GitHub releases only: skin/cape fixes, a 1.7.10 launcher, "name spoofs". No UI information found | Nothing usable on UI |
| CherryMC | The only match is an unrelated 1.12.2 Forge repo | **Could not identify a 2026 client by this name.** Nothing learned |

The brief calls these "the current design bar" for glassmorphism UI. I could not verify that from text alone, and
I have no screenshots of them, so Luminos' panel was **not** compared pixel-for-pixel against them.

| learn | beat | don't copy |
|---|---|---|
| Right-click on a module for quick settings is common (LuneX, Lunar tooltips) | Luminos' panel is a card grid with chamfered pixel corners matching the voxel brand, with favourites, ranked search and a Support tab | LuneX's combat/ESP list; Yuki's name spoofing |

## 8. What this changed in the build

| Finding | Built (path under `client/src/shared/java/dev/luminos/client/`) |
|---|---|
| Right-click quick settings (LuneX, Lunar tooltips) | `Panel.java` context menu |
| Search should rank; favourites float up | `core/ModuleSearch.java` |
| Shareable designs (Laby crosshair sharing) | `core/ShareCode.java` |
| Lunar bug-report button; crash reports are unreadable | `core/CrashAssistant.java`, `core/LogTail.java`, Support tab |
| Waypoints with dimension filter (Lunar, Badlion) | `core/Waypoint.java` |
| Accessibility: none of the studied clients document it | `core/ColorblindPalette.java`, WCAG contrast test |
| Unverifiable perf claims (Dawn, Badlion) | `core/FrameStats.java`, `core/BenchReport.java` |
