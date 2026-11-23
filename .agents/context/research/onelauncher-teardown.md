# OneLauncher teardown (behaviour only; GPL-3.0, so nothing here is copied code)

Method (`rea` skill): read only public artefacts (repo tree, README, `lang/en_us.json` UI strings, product page), record *what the product does*, then design our own. No decompiling, no code paste.
Sources read 2026-11-23: GitHub API tree of Polyfrost/OneLauncher (238 stars, Rust, GPL-3.0, pushed daily), `packages/oneclient_app/lang/en_us.json` (2,695 strings), https://polyfrost.org/projects/oneclient.

## Architecture (from the tree)
Cargo monorepo `packages/`: `oneclient_app` (UI), `_auth`, `_cluster` (instance = "cluster"), `_content`, `_core`, `_db` (SQL migrations), `_discord`, `_events`, `_java`, `_mc`, `_net`, `_polyplus` (their paid/online services), `polyio`. Distribution for Windows installer, macOS DMG/app, Linux AppImage/deb/rpm/AUR/Flatpak/COPR. **Every channel except deb/rpm/flatpak has built-in auto-update.**
Take-away for Luminos: our 3-crate split is fine; we lack a DB (fine: JSON), we lacked auto-update (added in 0.5.0), crash dialog, bisect, storage cleaner (storage added in 0.5.0).

## UI string census (what areas exist; count of strings)
cluster/instance 235 · **mod bisect 121** · cluster settings 110 · package manager 80 · lobby/host-world 79 · export/share 78 · modpack import confirm 65 · modpack actions 63 · share 52 · launcher settings 35 · browser 32+28 · external-launcher import 31 · release migration 31 · logs 30 · appearance 27 · cloud sync 26 · minecraft settings 25 · **storage 25** · accounts 23 · date-range picker (analytics) · file-drop · blocked downloads · datapacks · control center · invite join · chat (friends/groups/threads) · crash dialog · wardrobe (skins/capes/cart/history) · analytics (playtime/servers/weekday/month/session length) · update check.

## Features worth matching (our design noted)
| Their feature | What it does | Luminos plan |
|---|---|---|
| Bundles at onboarding ("bundle choices", "optional mods popup") | pick curated mod packages per Minecraft version; content downloaded on first launch of each version | Onboarding step "Choose your pack": Performance / Performance+Visuals / Vanilla+. Optional mods (Resourcify, Iris, Zoomify) as checkboxes |
| One-click install, shared package cache copied into the game folder only while playing | disk saving + clean rollback | Add a shared mod cache (content-addressed by Modrinth SHA-512) |
| Disable-dependents popup | disabling a mod warns which mods depend on it | Dependency check in content manager |
| Incompatible / flagged / blocked-download popups | warns before installing wrong-version or flagged files | Already partly: hash lookup (A4). Add the UI |
| **Mod bisect** (find the crashing mod by half-splitting, with undo/restart/restore) | guided diagnostics | Crash assistant v2: "Find the problem mod" wizard. High value, build in session 3 |
| Crash dialog with markup, mods list, upload to mclogs | plain-language crash analysis | We have `crash.rs`; add UI + mclogs share (new host, user-confirmed) |
| Storage page (usage by cluster, unreferenced cache, leftover natives, "can be freed") | disk management | **Built in 0.5.0** (Settings > Storage) |
| Launcher folder move + leftovers | move data dir between drives | Session 3 |
| Settings per game: memory, GPU choice, resolution, force fullscreen, JVM args, game args, wrapper command, pre-launch, post-exit command | power-user settings | Session 2 (we have memory/jvm/fullscreen/res) |
| Launcher: run in background, tray icon, start maximized, open game log on launch, Discord RPC | | Session 3 |
| Cloud sync of instance (mods+settings) with Microsoft account, conflict resolution | | Session 5 (needs a backend; not before) |
| External launcher import + release migration | import from other launchers | G3 in ledger (Prism/TLauncher/official) |
| Wardrobe: skins, capes, history, cart; cosmetics categories aura/back/boots/cape/emotes/glasses/glove/hat/pet/shoulder/wings | | D-series. **Free original set** in session 4 |
| Lobby / invite join / friends chat / groups | host a world via relay; invite links | C5 (relay) session 5 |
| Update prompt + auto update | | **Built in 0.5.0** (Settings > Updates, banner) |
| Analytics tab: playtime per day/week/month/server, session length, date range picker | | We have Stats; extend session 2 |
| Screenshot viewer, worlds, datapacks, logs viewer per cluster | | Instance page tabs exist; add screenshot viewer + datapacks session 2 |
| Settings profiles; terms/privacy consent; Poly+ and crash reporting off until accepted | | Our rule is stricter: no accounts, no telemetry at all |

## OneClient bundled mods (product page) and how we map them
Chatting, CrashPatch, EvergreenHUD, OverflowParticles, PolyBlur, PolyNametag, PolySprint, PolyTime, PolyWeather, Redaction, VanillaHUD, **Sodium, Lithium, Entity Culling, ImmediatelyFast, FerriteCore**, Controlify, Simple Voice Chat, Skyblocker, **Zoomify**, 3D Skin Layers, SkyCubed, SkyOcean, Wavey Capes, Catharsis, Animatica Refabricated, Legacy SkinLayers, **ModernFix**, Auto Text, **Iris**, Dropped Item Tweaks, Numerical Enchantments, Noxesium, StackDeobfuscator, Language Reload, Smooth Scrolling Refurbished, FOVChanger, PolyHitbox, Legacy Skyblock, Gnetum, Packed Packs, MixinTrace, Status Effect Bars, Not Enough Crashes, OverflowAnimations, Log Cleaner, Cull Fewer Leaves, **Resourcify**, SkyBlock Item List.
Observation: **most of it is third-party Modrinth mods** plus the Polyfrost HUD/QoL set under OneConfig. We already install Sodium, Lithium, Entity Culling, FerriteCore, ModernFix, ImmediatelyFast, MoreCulling, Dynamic FPS, Krypton, Sodium Extra. Missing and legally installable from Modrinth (no code copying): Zoomify, 3D Skin Layers, Wavey Capes, Controlify, Simple Voice Chat, Iris, Smooth Scrolling Refurbished, Status Effect Bars, Not Enough Crashes, Cull Fewer Leaves, Language Reload, Resourcify, Animatica. Polyfrost's own mods (GPL) are **not** installed and not ported; our client implements original equivalents (see parity doc).

## Performance claims
Their page shows self-reported FPS tables (e.g. 910 vs ~0, 800 vs 530 on Ryzen 7 2700X) from community benchmarks, Sept 2026. Their lever is the Sodium/Lithium/etc. stack, not magic. Luminos gets the same lever; we must publish **our own measured** FPS in `docs/PERF.md` via a CI benchmark (llvmpipe numbers are not comparable to real GPUs; say so).
