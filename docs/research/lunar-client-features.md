# Lunar Client: features page, mapped to Luminos

Source: <https://www.lunarclient.com/features> (fetched session 5). The page makes four claims.

| Lunar claim | Luminos today | Gap |
|---|---|---|
| **Single install.** One modpack that installs and updates its mods. Supports 1.7, 1.8, 1.12, 1.16 to 1.21. | The launcher installs a Fabric preset (28 mods) and updates content on launch. | Client jar is 1.21.4 only. No 1.7/1.8 (legacy) support, no multi-version build matrix. This is the P0 blocker for "all versions". |
| **Countless mods.** 65+ mods, hundreds of settings. Keystrokes, Coordinates, Freelook, Toggle Sprint named. | Luminos Client has Armor HUD, Keystrokes, CPS, FPS, Coordinates, Potion HUD, Toggle sprint, Zoom, HUD editor. | Freelook, ping, clock, item counter, saturation, crosshair, hit colour, per-server compliance mode, profiles synced with the launcher. About 8 of 65 done. |
| **Boosted frames.** Own optimisations, optional Sodium/OptiFine-based modules, Full Bright, optimised chunk loading, entity rendering. | Preset installs Sodium, Lithium, Entity Culling. | No "Performance profile" toggle in the launcher UI yet. No Full Bright option (and it needs a per-server rule note). |
| **Multi-OS.** Windows, Linux AppImage, macOS Intel + Apple Silicon. | Windows installer; Linux tarball from CI. | No macOS build. Linux is untested by us as a desktop app. |

## What Lunar does that this page does not say (prior knowledge, unverified here)
- Cosmetics shop and shared cosmetics visible to other Lunar users through a server. Luminos would need its own service
  (cost and moderation notes belong in a separate doc before building).
- An in-game mod menu with per-module settings and profiles.
- Accounts sign in with Microsoft only. Luminos' offline profiles are a deliberate difference.

## Order I would build the gaps in
1. Version matrix for the client mod, plus a compatibility manifest the launcher reads. Without it nothing else matters.
2. Performance profile toggle in the launcher.
3. Missing HUD modules that don't affect fairness: ping, clock, item counter, saturation, crosshair.
4. Freelook and Full Bright only behind a compliance mode.
