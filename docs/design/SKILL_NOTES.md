# Skill rule notes, session 15 (launcher)

The installed skills have **no numeric rule IDs**, so these IDs are ours, each mapped to a real section of the skill file under `.agents/skills/`. Before each screen the line "Rules applied" was written; after each screen the three checks below were run on the *render* (`docs/launcher-shots/rounds/`).

| ID | Skill and section |
|---|---|
| T2, T3 | taste-skill `## 2. The page plan by kind`, `## 3. What serves which page` |
| T5 | taste-skill `## 5. Checklist` (anti-slop) |
| T6 | taste-skill `## 6. Never` (no emoji icons, no pill-chip soup, no generic stock) |
| LG1-LG5 | liquid-glass `Core Principles` 1-5 (translucency, depth, ambient response, minimal chrome, spring motion) |
| LG-A | liquid-glass `## Accessibility`: contrast >= 4.5:1, reduced-motion, `prefers-contrast` solid overrides |
| MC-READ | minecraft-ui-design `Design Goal`: readable at gameplay speed |
| MC-NOOVERLAP | minecraft-ui-design `Non-Overlap Rules` |
| MC-STATES | minecraft-ui-design `Functional Rules`: every action has accepted / denied / pending feedback |
| MC-NOSAAS | minecraft-ui-design `Review Checklist`: not a generic SaaS dashboard |
| DASH | react-vite-dashboard (summary first, detail second) |
| ICON | better-icons / icon-system (one family, one stroke) |

Checks: **AS** = T5 anti-slop on the render. **LG** = glass 0.08-0.18 tint, blur+saturate+brightness, hairline, inset top highlight, Solid fallback, contrast table in `CONTRAST.md`. **MC** = readable-at-gameplay-speed; it only applies to screens that preview in-game HUD (Client). For other launcher screens it is marked n/a rather than claimed.

| Screen | Rules applied (written before) | AS | LG | MC |
|---|---|---|---|---|
| Shell, design system | T5, LG1-LG5, LG-A, ICON | pass: one accent, hover = lift + border brighten, no gradient buttons | pass; first contrast run **failed** (muted 4.2:1 at 100%) and was fixed (`CONTRAST.md`) | n/a |
| Home | T2, T3, DASH, MC-STATES | pass after round 1 (skin overlapped chips; empty bottom third, both fixed) | pass | n/a |
| Instances | T3, MC-STATES, ICON | pass after round 2 (grid hole filled with a New instance card). Clone works in-browser; Export has no engine command and says so | pass | n/a |
| Library | T3, MC-STATES, MC-NOSAAS | pass (real Modrinth icons; dependency warnings; install morph) | pass | n/a |
| Cosmetics | T3, LG2, MC-STATES | pass after round 1 (viewer had a white background: removed) | pass | n/a |
| Servers | T3, MC-STATES | pass (real icons, MOTD, counts). **No ping value is shown in a browser**; the app fills it from `servers_list` (UNVERIFIED) | pass | n/a |
| Client (presets, crosshair, keystrokes, QoL) | MC-READ, MC-NOOVERLAP, MC-NOSAAS | pass after round 1 (hairline preset clipped, captions truncated) | pass | pass for previews on a real in-game capture; the in-game screens themselves were **not** built |
| Settings | MC-STATES, T6 | pass after round 1 (group nav stranded at the bottom) | pass | n/a |
| Onboarding | T2, LG1, MC-STATES | pass; Microsoft sign-in shows a truthful "desktop app only" state in a browser | pass | n/a |
