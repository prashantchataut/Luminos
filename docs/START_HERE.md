# START HERE (session 16, v0.9.1: solid themes, skins, locker, client logic)

Branch `feat/v0.9-client-launcher-finish` (PR #15 is already merged, so these commits are on a closed PR; open the next PR from this branch). Full status table: `docs/PR15_v091_update.md`.

## Read this first
- **Nothing in this session has been compiled by CI.** The workflows only run on pull requests and on `main`; `ci.yml` and `client.yml` now also run on `feat/**`. Check the Actions tab for the latest commit before trusting the Rust (`mojang.rs`, `lib.rs`) or the Gradle client (`Glass.java`, `Config.java`, `Features.java`, `Panel.java`).
- **Verified here:** launcher front end (`npm run build`, `npm test`, screenshots in `docs/launcher-shots/v091/`), 51 new + 141 old Java core assertions (JDK 21 in the sandbox).
- **No tag.** `v0.9.0` was not pushed: the in-game rendering is not built (below) and `client-compat.json` still points at `client-v0.3.0` jars.

## Done
Glass and dither removed everywhere (`grep -ri "glass\|dither\|backdrop" app/src` finds only the skin name Glasshouse). Three token-file themes (`app/src/themes/*.json`: Clean loads first, Lunar, Light; contrast tested by `app/tools/contrast.test.mjs`) with JSON import/export in the theme store (`themes.ts`; Settings UI for import/export is **not built**). Five original skins (`tools/make_luminos_skins.py`), the 48 old skins and 4 old built-in skins deleted. Skins screen: 3D preview in Studio and Sunset scene, editor (brush, eraser, fill, picker, mirror, layer, undo/redo, reference image), file import (64x64, 64x32, slim detect, plain errors), username lookup (Mojang only), report button, "Where others see this", server-owner page. Locker: 8 categories, 4 pets, 3 wings, 3 hats, 2 masks, 2 bandanas, 2 back items, 3 emotes, 14 cloaks, equip animation, persistence (localStorage plus `write_cosmetics`), classic-client toggle, pet behaviour spec. Java core: `ClientFile` reader, `Theme`, `DeathRecap` + death marker, `NavMath` (compass, chat coordinates), `FontPairs`, `Keystrokes`, `Crosshair`, `ModPolicy` (conflict drop, metadata cache, parallel discovery, HUD cache), `Cosmetics` + `EmoteSync`. In-game panels are solid and theme-driven.

## NOT BUILT (work these first)
1. **Rendering hooks in the Java client**, each needs a Mixin or Gfx call per Minecraft version and a run in the smoke job: custom title screen, death-screen box, compass/waypoint HUD, clickable chat coordinates (needs a chat mixin), font picker and TTF loading, crosshair and keystroke drawing from `Crosshair`/`Keystrokes`, low fire, per-dimension fog, overlays, pets/wings/hats/emotes drawing, in-game Locker panel. The pure logic and its tests exist.
2. Launch hand-off: the launcher writes `luminos-client-settings.json` and `luminos-cosmetics.json` next to `accounts.json`; the client reads `config/luminos-client-settings.json` or `-Dluminos.settings=<path>`. Nothing yet copies or points one at the other when an instance starts.
3. `ModPolicy` is not called by the launcher's launch path yet.
4. Client jars for every version, checksums, `client-compat.json`, tag `v0.9.0`.
5. Screenshots under `docs/client-shots/rounds/` and the title-screen screenshot: need the client rendering above.
6. Theme import/export buttons in Settings; the Locker's in-game quick panel; the Back camera orientation was judged by eye only.
7. Microsoft sign-in: UNVERIFIED (`docs/MICROSOFT_AUTH.md`). Mock HTTP server for the token exchange not built.

## Security
A GitHub PAT was pasted into chat again. It was used only through an `http.extraHeader` for pushes and one API comment, never written to a file or remote URL. **Revoke it.**
