# Design rounds: critique log

Renders: `npm run build && npx vite preview --port 4173`, then `PW_DIR=/tmp/pw node app/tools/shots.mjs <round>`
(Playwright, Chromium, 1280x800 at 2x, the real production bundle, seeded data in a browser).
Skills applied: taste-skill 2.5.1 checklist (ids in brackets), ui-ux-pro-max (a11y + motion rules),
vercel-web-design-guidelines (focus, motion, contrast), reanimate (spring/draw-on patterns).
Full skill listing: `docs/design/skills-ls.txt`.

**Honesty note on "3 rounds per screen".** Rounds 1 and 2 were rendered by the previous session (2 only skimmed).
This session reviewed round 2 (contact sheets) and rounds 3 and 4 below. A screen only counts as having three
reviewed rounds when a round changed something and the next render was looked at. Status per screen is at the bottom.

## Round 2 (reviewed this session, from the renders)
- **home** [hero-screen, fold-cut]: hero is 430 px tall, so "Recent worlds" and "Playtime" are cut off at 1280x800. Fail.
- **home** [product-shown]: version tiles are generated gradient scenes, not captures from the game. Fail, needs CI cover art.
- **instances** [photo-set]: same generated scenes on every card. Cards otherwise good: one radius, stats row aligned.
- **mods** [visual-empty, product-shown]: icons are two-letter tiles, not real Modrinth icons; download counts invented. Fail.
- **skins** [product-shown]: real 3D skin and cape, drag to turn. Pass. The licence note is a long paragraph; shorten later.
- **servers**: real-looking rows with ping and slots. No server icons rendered from the game. Partial.
- **client**: live HUD preview is the strongest screen. Pass.
- **settings**: dense but organised; the Animations toggle was not persisted. Fail on [reduced-motion].

## Round 3 (fixes applied, re-rendered, reviewed)
Applied: real Modrinth icons and download counts for 16 seeded mods (fetched from the Modrinth API, `docs/ASSETS.md`);
direction-aware page transition (`--enter-x`, forward slides from the right, back from the left); Animations toggle now
persists (localStorage + `reduce_motion` setting) and `prefers-reduced-motion` is honoured; cover parallax on instance cards.
- **mods** now reads as a store: real icons, real counts, Stable/Beta chips from the solver. Pass on [visual-empty].
  Entity Culling's icon is a screenshot-style image, fine because it is theirs.
- **instances**: parallax works and rests under reduced motion. taste-skill lists `[tilt]` and `[hover-move]` as
  checks ("nothing tilts"). The brief asked for card hover parallax, so it stays: the cover drifts, the card does not tilt.
- **home**: fold still cut. Carried to round 4.
- **onboarding-name**: the disabled Microsoft card is at opacity .6, text-mute on it fails [text-contrast]. Carried.

## Round 4 (home, onboarding, plus a real-app fix)
- **home**: hero 344 px; worlds and playtime now above the fold [fold-cut pass]. New fail: the badge row sits on the moon and
  "31 mods checked" is low contrast [text-contrast]. Open.
- **onboarding-name**: Microsoft card readable now. Pass.
- **Real-app bug found while reviewing (not visible in screenshots):** nothing in the frontend ever called
  `create_instance`, so a fresh install would have landed on Home with zero instances and crashed on `cur.mc`.
  Onboarding step 4 now calls the engine (creates the instance, installs the solver-checked preset, sets `setup_done`),
  and Home shows a first-run screen if the list is empty.

## Status per screen
| screen | reviewed rounds with a change in between | state |
|---|---|---|
| home | 2, 3, 4 | 3 met; one contrast fail open |
| instances | 2, 3 | 2 met. Round 4 would be real in-game cover art |
| mods | 2, 3 | 2 met |
| onboarding (welcome, name) | 2, 3, 4 | 3 met |
| onboarding-import | 3 re-render, not reviewed | not met |
| skins, servers, client, settings | 2 reviewed; 3 re-rendered unchanged (settings fix is behavioural) | **not met** |

Rule notes per screen (one line each):
- onboarding: taste-skill [hero-fill, copy-actions, action-count]; ui-ux-pro-max progress + a11y labels; no slop words.
- home: taste-skill [fold-action, fold-cut, hero-enter]; reanimate button state morph; ui-ux-pro-max loading states.
- instances: taste-skill [card-family, button-styles, hover]; reanimate hover parallax; vercel-web-design-guidelines (reduced motion).
- mods: taste-skill [visual-empty, product-shown, real icons in their own colours]; ui-ux-pro-max (skeleton while loading).
- skins: taste-skill [product-shown]; reanimate spring damping on the viewer (CSS turn only so far; spring not built).
- servers / client / settings: taste-skill [one system, text-contrast, heading-scale]; vercel-web-design-guidelines (focus-visible, toggles named).

# Session 12 (rounds 5-7; renders renamed from s12r1..3)
Skills applied per screen (rule categories, not invented IDs): **fixing-accessibility** 1 names / 2 keyboard / 7 contrast and states;
**fixing-motion-performance** 1 never-patterns / 5 paint (transform+opacity only); **taste-skill** anti-slop (product-shown, card-family,
text-contrast, fold-cut); **hallmark** imagery + interaction-and-states; **ui-design-skill** pre-ship checklist; reanimate (state morph).
`UI Hall` skill: not found, not used.

## home (5, 6, 7)
- r5 (baseline): generated scene covers, recoloured. Badge row on the moon fails contrast. Fail [product-shown], [text-contrast].
- r6: real in-game cover wired in; badges got a solid backdrop (contrast now passes). New fail: the captured frame was the vanilla title
  menu, so Minecraft's own Singleplayer/Multiplayer buttons showed behind my Play button (duplicate UI). Fixed in the client with a bare `CoverScreen`.
- r7: hero is UI-free real art, badges legible. Open: capture is blurred by vanilla's menu blur; only 2 of 5 instances have a real cover.
## instances (5, 6, 7)
- r5: five cards that are the same scene recoloured. r6: first real cover appears. r7: two real covers with the legibility ramp; three generated
  scenes remain, so the grid is visibly mixed. Chips now readable. Open: captures for 26.2, 26.1.2, 1.21.4 (no client build for them yet).
## client (5, 6, 7)
- r5: preview showed the old title menu through the HUD. r6: added Quick panel (real in-game capture) and Sync cards; copy said Right Shift/0.3.0.
  r7: copy now Right Ctrl / 0.4.0; cards sit below the fold at 1280x800 (acceptable: it is a scrolling page).
## In the game itself (CI captures, `docs/design/ingame/`)
- panel r1 (26.3): footer hint overflowed the sidebar into "Esc closes"; titles truncated by a fixed badge reserve. Fixed (dynamic reserve, shorter hints).
- title r1: menu overflowed a 240 px GUI (Quit off-screen, instance line missing). Fixed; r2 shows all six items, instance name and version.
## Not met
servers, skins, mods, settings, onboarding-* were re-rendered (rounds 5-7 exist) **without** a review-and-change loop. They do **not** meet "3 critique rounds".
