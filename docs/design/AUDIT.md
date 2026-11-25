# Design audit (improve-ui, ibelick, fetched with `npx ui-skills get ibelick/improve-ui`)

**Honest scope.** `improve-ui` is read-only and has a three-proof gate (contract, runtime, correction). I applied it to source plus my own rendered captures of the **live panel, Instances and Settings** (contact sheets viewed this session). **Home, Library and Cosmetics were captured but not inspected in detail, so they are not audited**; I am not writing "no findings" for surfaces I did not look at.

## Design language
- Audited surface: launcher (Tauri app, `app/src`): Live panel, Instances, Settings (partial: Home, Library, Cosmetics not audited).
- Design sources: `AGENTS.md` ("Design language" session-4 rules: flat ink panels, 1px hairlines, no gradient buttons, no pill chips, no emoji; "Design system": blue accent family), `docs/MOTION.md`, `app/src/index.css` tokens.
- Governing owners and consumers: `index.css` (`.panel`, `.panel-2`, `.btn`, `.badge`, `.pbar/.pfill`), `kit.tsx` (`LRow`, `Chip`, `Badge`, `Switch`, `Modal`).
- Explicit exceptions: None documented.

## Findings (survived the gate; each was then fixed and re-captured)
| # | Problem | Evidence | Proposed change | Scope | Confidence |
|---|---|---|---|---|---|
| 1 | Progress fill used `linear-gradient(90deg,#8b5cf6,#ec4899)`: purple/pink, outside the stated blue accent family, and a gradient in a "flat ink" system | `index.css` line 76 (`.pfill`), reached by `LivePanel.Progress`; capture `panel-3` before the fix | Use the accent token (`var(--color-accent)`); done | `.pfill` (one rule) | High |
| 2 | Switch progress rendered below the fold under a long list, so the rows the user is waiting on were cut off and covered by the toast | Capture `panel-3/4` before the fix (rows "Turning on Copper Stuff" clipped at the viewport edge) | Render the progress panel above the sections; done | LivePanel | High (rendered evidence) |
| 3 | "Pause game while open" wrapped to three 10px lines in the header | Capture before the fix | `whitespace-nowrap` on the label; done | LivePanel header | High (rendered evidence) |

## Candidates rejected by the gate
* Radii: `AGENTS.md` says both "generous 14-18px radii" (design system) and "2-6 px radii" (session 4). Two governing statements contradict, so the evidence cannot determine one correction. **Needs an owner decision**; the launcher currently mixes `rounded-md` and `rounded-[14px]`.
* Instances cover scrim `linear-gradient(180deg, transparent 40%, ...)`: a legibility scrim, not decoration; valid.
* Accessibility and behaviour findings are out of `improve-ui` scope by its own rules; they are covered in `docs/SKILLS_SESSION19.md`.

## Improve first
Decide the radius contract (the only unresolved contradiction), then apply it once through `.panel`.
