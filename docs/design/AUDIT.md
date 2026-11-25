# improve-ui audit, Tauri launcher (session 19b, read-only)

Skill: `ibelick/improve-ui` (read in full). Product source was not modified by this audit.

## Design language
- Audited surface: Tauri launcher Home, Library, Cosmetics, Live Mods (themes Default, Lunar, Light), from the committed captures in `docs/launcher-shots/session19/` (rendered evidence supplied by the project's own capture tool).
- Design sources: `AGENTS.md` (design system section; written for the retired egui UI, so it does not govern the Tauri UI unless the repo says so), `docs/DESIGN_RULES.md`, theme token files proven by `app/tools/contrast.test.mjs`.
- Documented decisions: themes change colours only; WCAG AA 4.5:1; live vs next-launch split labelled in words.
- Governing owners and consumers: not traced in `app/src` this session (see limits).
- Explicit exceptions: None documented.

## Findings
| # | Problem | Evidence | Proposed change | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | In the Cosmetics capture the last control in the right column, "Apply to Mojang account", is cut off by the viewport edge; its caption "Desktop app only" is clipped. | `screen-cosmetics.png` (rendered). Contract: the same screen's own copy depends on that control being readable. Runtime: **not traced**: it is unknown whether the column scrolls in the real window. | Re-capture at a taller viewport or make the column scroll; nothing to change until the runtime is traced. | Cosmetics | **Low (fails the Runtime proof, kept as a candidate, not a finding)** |

| 2 | Android onboarding: the body paragraph ("Java Edition on your phone. Offline accounts, Modrinth mods...") is set directly over bright cloud pixels and reads at low contrast. | `docs/android-shots/01-onboarding-welcome.png` (rendered). Contract and runtime not traced (Compose sources not read this session). | Place the paragraph on the opaque surface the other screens use. | Android onboarding | **Low (fails Contract and Runtime proofs; candidate)** |

**No supported findings were found** by the skill's proof gate. Candidate 1 is listed so the next session can trace it.

## Improve first
No supported recommendation. Practical next step: trace `app/src` for the Cosmetics column and decide whether to re-capture.

## Limits of this audit
Only rendered captures were read; `app/src` was not traced, so "no findings" means "none proven", not "none exist". Home and Library captures were looked at and showed no internal contradictions (badges carry words; conflicts are labelled). Live Mods captures label demo data on screen ("Demo agent: no game connected"). Nothing was run inside a Tauri window.
The previous audit (live panel, Instances, Settings) is kept as `AUDIT_session18.md`.
