# Site audit (session 19b)

Order followed: improve-ui (read-only, first), then frontend-design, better-ui, impeccable, taste-skill, accessibility, fixing-metadata, improve-animations / accessible-animation. See `docs/SKILLS_SESSION19.md` for what was and was not read.

## 1. improve-ui (read-only, before any edit)
- Audited surface: `site/` landing page, traced `index.html` -> `main.tsx` -> `App.tsx` -> `Hero`, `Tour`, `Sections`, `Closing`, `ui.tsx`, `index.css`.
- Design sources: none documented for the site (`AGENTS.md` design rules are for the egui app). Explicit exceptions: None documented.

| # | Problem | Evidence | Proposed change | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | The tour and hero show screenshots of the retired egui interface while captioned "renders of the real interface". | `Tour.tsx` imports `01-setup-welcome.webp`...; `AGENTS.md` rule 1: the egui UI "is no longer shipped". Direct contradiction within the page. | Replace with the session-19 Tauri captures. | Hero, Tour | High |
| 2 | Limits and Features copy contradicts the rest of the repo: "Client built for 1.21.4 only", "Microsoft sign-in not connected to the interface". | `Sections.tsx` `limits`, `rows`; `CHANGELOG.md` 1.0.0-rc1 (jars for 1.21.11 and 26.3). | Rewrite from `STATUS.md`. | Features, Limits, Client | High |

Not findings by the skill's rules (reported separately, not as design): the download link came from a runtime API query instead of the release manifest; no Android surface existed; metadata thin.

## 2. frontend-design + impeccable + taste-skill (anti-slop)
Tells named by frontend-design that the page had: one accented word in every headline, all-caps eyebrow labels, `01 / 05` numbered step markers. All three removed (neutral `.accent-word`, sentence-case eyebrows, no numbers). Kept: serif display + sans body, real product imagery leading the hero, honesty section. Mode per impeccable: Persuade for the landing page, Read for the Android matrix and changelog.

## 3. better-ui
Hover rules wrapped in `@media (hover: hover)`; content images get `outline 1px inset white/10` instead of a tinted border. Not changed: shadows on frames (a deliberate site convention).

## 4. Accessibility (fixing-accessibility, addyosmani/accessibility; WCAG 2.2)
New Android matrix is a real table with caption and scoped headers; status is text. Skip link, focus ring (2px accent) and `lang` already present. Reduced motion: `.reveal/.rise` static; Tour crossfade tiered (opacity kept, travel removed). Machine check: Lighthouse accessibility in CI (`audit-live`), result in `docs/live-site/`. Manual screen-reader testing: **not done**.

## 5. fixing-metadata
Title, one 150-character description, canonical, `og:url`, OG image (1200x630, absolute URL) and twitter card agree; favicon svg + 32 px png + apple-touch icon; `SoftwareApplication` JSON-LD with the pre-release truth in `description`. Social card rendering on a real platform: **not verified**.

## 6. improve-animations / accessible-animation
Motion inventory: hero rise (one orchestrated sequence), sky canvas (still frame under reduced motion), Tour crossfade, Reveal on scroll, spinner removed from CTA. No `transition: all`; easing tokens `--ease-out-expo`, `--ease-soft`. Plan items not done: the sky canvas keeps animating when the tab is hidden (not measured).
