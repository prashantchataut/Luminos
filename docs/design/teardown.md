# OneClient teardown (measured from source, 2026-11-23)

Method: `rea` (observe public behaviour, document, clean-room). Sources: `Polyfrost/OneLauncher` @ HEAD (sparse checkout of `packages/oneclient_app`), polyfrost.org/projects/oneclient, store.polyfrost.org. GPL-3.0: nothing copied, only numbers and behaviour recorded.

**Correction to the brief.** `apps/oneclient` does not exist any more. The current OneClient UI is `packages/oneclient_app`, a **Rust app on Freya (Skia)**, not Tauri + React. So their polish is design discipline, not stack. We still chose Tauri + React, because the design and motion tooling (CSS, Playwright, web fonts) applies directly.

## Routes / layout
`/onboarding/{location,terms,migration,language,account,preferences,bundle-picker,bundles,summary}` (10 steps) then `AppShell`: `/app` (home), `/app/clusters/:id/{logs,process,screenshots,mods,shaders,textures,worlds,datapacks,settings}`, `/app/browser/...`, `/app/wardrobe`, `/app/stats`, `/app/settings/{appearance,minecraft,accounts,launcher,java,storage,apis,language,developer,changelog}`.
Shell: **top navbar, 80 px**, side padding 40, link spacing 36, logo 32, 36 px-high pill nav items (radius 10), avatar 28. Home padding 48.

## Tokens
- Colour (dark "PolyGlass"): page `#11171C`, elevated `#151C22`, card/component `#1A2229`, border `#FFFFFF1A`, text `#D5DBFF`, secondary `#757883`, accent `#2B4BFF`. Themes are JSON: page/elevated/card/component/border/text/text_secondary/accent + `radius_scale`.
- Type: Poppins + JetBrains Mono. Sizes by frequency: 12 (254 uses), 11 (126), 13 (112), 14 (82), 16 (49), 10, 12.5, 18, 15, 17, then 32/24/20 for headings. Body is small and dense; one big display size.
- Radii by frequency: 8, 12, 10, 6, 14, 16 (cards), 5, 4, 999 (pills).
- Version card: 150 px high, radius 16, clipped art, art opacity 0.6 idle / 0.85 hover / 1.0 selected, border 1px idle, 2px brand when selected.
- Motion: navbar intro 460 ms slide + fade; stagger 85 ms; card enter 460 ms; splash curtain fade 460 ms; common durations 110/160/180/200/260/300/320/400/800 ms. Animations can be turned off globally.
## What makes it feel good
1. Art is the interface: real cover art per version, dimmed until chosen (opacity as state).
2. One accent, one weight of chrome; everything else is quiet.
3. Entrances are staggered and short; nothing animates for its own sake.
4. Dense rows with generous radii; clear selected state (2px ring).
5. Store: themed collections with a named creator, price on card, categories Capes/Wings/Gloves/Hats/Boots/Backs/Shoulders/Auras/Emotes.

## What we took and what we did differently
| Measured | Luminos |
|---|---|
| top navbar, art-led home, version carousel with opacity-as-state | same pattern, our own code |
| 16 px card radius, 2 px selected ring | same values (convention, not code) |
| Poppins, accent #2B4BFF | **Instrument Serif + Inter, accent #8fb4ff / #3b6cf0 from our site** |
| flat dark panels | dithered-blue sky, glass panels, serif display type with italic glow word |
| 10 onboarding steps | 4 steps, real name check |
| cosmetics sold | cosmetics free and original; unfinished ones labelled "In the workshop" |
Luminos tokens: `app/src/index.css` (`@theme`), durations 160/260/460 ms, ease-out-expo `cubic-bezier(.16,1,.3,1)`, stagger 60 ms, nav 64 px, card radius 16, control radius 12, pills 999.
