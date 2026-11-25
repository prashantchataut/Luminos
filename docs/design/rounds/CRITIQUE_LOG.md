# Critique log: 3 Playwright rounds at 1280x800 @2x

References (docs/design/references/): store.polyfrost.org, xyrios.com/minecraft/skins, polyfrost.org/projects/oneclient, OneConfig, Th0rgal/shard, ElyPrismLauncher, and the previous live site. Captured with Playwright (`app/tools/refs.mjs`). Skins on xyrios belong to their uploaders, so they were used as a quality bar only; Luminos' skins are original.

Baseline (before round 1): flat 5-colour skins on a 55/45 stage with a second toolbar and a cramped inspector; Home had a right-hand player panel, "Ready" pill in every top bar and an OFFLINE badge; Preferences was a wall of cards, a JSON dump and a click-test pad.

## Round 1 (first rebuild)
- Home: matches the brief (300px hero, one launch bar, 3 Quickplay cards). Large empty area under the cards is acceptable (breathing room).
- Cosmetics: **fail**. Card rows collapsed to ~25px (grid stretch ignores aspect-ratio); stage model cropped; pill bar clipped at 360px.
- Settings: clean. Rows are uniform. Themes: old 56px rows.
- HUD: backdrop small, floating in a dark void.
## Round 2
- Fixed stage camera and pill bar. Cosmetics still collapsed: grid needed fixed row height.
- HUD backdrop now spans the stage width with a blurred fill above and below; Themes rows moved to the 62px row style.
## Round 3 (final, copied to site/public/screenshots)
- Cosmetics: Polyfrost-style cards (badge, star, centred 3D preview on a radial glow, 52px footer, blue when equipped). Skin previews enlarged; the Wings tab shows four articulated wings. Open critique: card previews are stills; wings are shown 3/4 from behind, so one side is foreshortened; the pet cube on the stage is large next to the skin.
- Settings / Themes / Mods / HUD: consistent surface palette, no 1px card borders. Open critique: Mods icons are still line glyphs, not voxel art.

## Site (round 1 = the old live site, round 2 = first rebuild with the new screenshots, round 3 = same build)
Round 3 is identical to round 2: no further site changes were made after the first render. `live-site-v1.0.0.png` is the capture of the deployed site.

## Audit correction (post-release review)
An independent re-check of v1.0.0 found the earlier claims overstated. Corrected here:
- **Rounds were not all real.** For home, mods, settings and site, `-1`, `-2` and `-3` were byte-identical (no change between rounds). Only cosmetics, hud-studio (1 to 2) and themes (2 to 3) actually changed between rounds.
- **`site-2/3.png` were blank white captures** (a capture bug), so the site had no valid render-critique record. `site-3.png` and `live-site-v1.0.0.png` are now a real 1280x800@2x Playwright capture of the deployed site (checked: Download links resolve to v1.0.0 assets; served home-3.png hash equals the repo copy). Pages deploys hit a GitHub-side 500 (githubstatus: Pages partial outage) several times; the deploy succeeded on a later workflow_dispatch.
- **Home round 3 (real change):** the Quickplay banners for the two worlds were the same blurred per-version cover, so the cards read as duplicates. They now use three distinct, sharp in-game crops. `home-3.png` and `site/public/screenshots/home-3.png` are re-rendered from this build.
- `site/public/release.json` still pointed at the `v1.0.0-rc2` prerelease. It is regenerated from the published v1.0.0 `SHA256SUMS.txt`.
- Still open: Mods icons are line glyphs, not voxel art; cosmetic card previews are stills (no flapping animation in the grid); wings are viewed 3/4 from behind. The Windows installer is unsigned and the Android build is a launcher preview (Minecraft does not launch).
