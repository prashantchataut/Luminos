# improve-ui audit + audit-ai-design-slop (read before the rebuild)
Surface: launcher shell + Cosmetics (the screen in Image 1), traced through `App.tsx`, `index.css`, `themes/*.css`, `Cosmetics.tsx`.
Design sources: `docs/design/AUDIT.md` (session 19), the task's token list. Explicit exceptions: none documented.

| # | Finding | Class | Proof | Fix applied |
|---|---|---|---|---|
| 1 | Two nav columns on Cosmetics (60px rail + 176px category list) | Quality defect (layout) | `App.tsx` rail + `Cosmetics.tsx` `gridTemplateColumns: 176px … 372px` | One 220px sidebar; categories became a pill bar |
| 2 | 1px border on `.panel`, `.btn`, `.chip`, `.badge`, `.field`, `.lrow:hover` | Slop pattern (decorative stacking) | `index.css` pre-change | Borders removed except `.field`; hierarchy from surface tone |
| 3 | Mod/module cards had no status bar; state shown as a tiny dot | Quality defect | `Library.tsx` | `.mod` card with 36px solid bar, accent when on |
| 4 | Accent text on surface fails contrast at the requested `#2B4BFF` (about 2.5:1) | Quality defect | contrast test | Accent is only a fill behind white text (7:1); accent-coloured text uses `--accent-text` |
| 5 | Section label colour `#6E7787` is 4.3:1 on `#0B0D12` | Quality defect | computed | Labels use `--mute` `#8892A5` (5.1:1). Deviation from the brief, on purpose |
| 6 | Banned copy and icons | Slop pattern | grep | None present in new screens (no "supercharge/seamless/elevate/unleash", no emoji bullets, no letters-in-circles) |

Not findings: the product has no glass and no dither in launcher UI (kept). Dither stays only in the website hero moon, as the brief asks.
Slop re-run after round 3: no gradient text, no glow stacks, the only gradient is the hero scrim that keeps white text readable (solid-to-transparent, no blur). Rule IDs applied per screen are in CRITIQUE_LOG.md.
