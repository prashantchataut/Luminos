# DESIGN_RULES: one page per installed skill, distilled
Source files: `.agents/skills/*` (provenance in `.agents/skills/PROVENANCE.md`). Commit messages for UI work cite the rule names below, e.g. `rules: UX-2 touch targets, TASTE-6 never-list`.
Luminos is an egui desktop app plus a Vite/React site, so web-only rules are applied by analogy and say so.

## taste-skill (design-taste-frontend 2.5)  — site first, app by analogy
- TASTE-1 One section per screen; equal left/right content edges.
- TASTE-2 Every visual must actually render at 1440/1024/768/390; never an empty ground.
- TASTE-3 Hover micro-animation: linked card lifts 2px, photo zooms 1.02-1.03 inside its frame.
- TASTE-4 Real photographs / real product UI over drawn placeholders. For Luminos: real in-game captures + real app screenshots, never mock cards.
- TASTE-5 Plain copy in a voice of its own; no invented reviews, quotes, customers or figures.
- TASTE-6 Never: fade-in-on-scroll for every card, parallax on text, scroll-jacking, violet/lavender accents, drawn look-alikes of real logos.
- TASTE-7 Do not copy a reference's code/copy/pictures.
- Conflict note: TASTE-1 ("no caption under any image") conflicts with brief B5 (one-sentence caption per app shot). Brief wins; captions stay specific, one sentence.

## ui-ux-pro-max  — priority order
- UX-1 Accessibility (contrast 4.5:1, keyboard nav, labels on icon-only buttons).
- UX-2 Touch/interaction: >=44px targets on mobile (>=32px desktop in egui per AGENTS.md), loading feedback, never instant 0ms state change.
- UX-3 Performance: reserve space, no layout shift.
- UX-4 Style consistency; SVG icons, no emoji as icons.
- UX-5 Responsive layout; no horizontal scroll.
- UX-6 Type & colour via semantic tokens, no raw hex in components.
- UX-7 Animation conveys meaning, varied durations, honours reduced motion.
- UX-8 Forms: visible labels, errors next to the field.
- UX-9 Navigation: predictable back, <=5 bottom-nav items.
- UX-10 Charts: legends + non-colour encoding.

## reanimate
- MOTION-1 Pick a fidelity level, capture the reference, write a motion spec, build, then verify frame by frame; do not judge from first+last frame.
- MOTION-2 Easing lives in the middle frames; tune springs by overshoot and settle time.
- MOTION-3 Same fonts/viewport/clock when comparing. Canvas/WebGL: compare with a virtual clock and fixed seed.
- Applied to: docs/MOTION.md (F2). Not yet exercised this session (no motion work done).

## rust-best-practices (massimodeluisa) + apollo-rust-skills
- RUST-1 Official API Guidelines first (naming C-*, rustdoc sections); skill adds allocation contracts and bounds.
- RUST-2 Result for expected failure, panic only for bugs; `debug_assert!` for invariants. (Luminos: no `unwrap()` outside tests, anyhow + context.)
- RUST-3 Prefer borrowing over cloning; measure before optimising.
- RUST-4 Clippy clean (`-D warnings`), tests per public fn.
- RUST-5 Deterministic output where artifacts are generated (used for the icon generator and the hosts JSON).

## rea / reverse-engineer-anything (subset kept: anti-slop, design-taste, codebase-understanding, mobile, network, api, auth, cicd, browser-automation)
- REA-1 Study public behaviour and docs only; never decompile proprietary launcher binaries (also AGENTS.md).
- REA-2 Network traffic analysis is for *our own* binaries: basis of the A1 traffic-recording test.
- REA-3 Offensive-security payload skills were deliberately NOT kept.

## agent-reach
- REACH-1 Read-only platform access (search/read, no posting/login on the user's behalf).
- REACH-2 Public content: prefer the agent's own web tools; use Reach to fill gaps.
- Status: installed but its CLI was not run this session; research used the built-in web search/fetch (docs/research/USER_PAIN.md lists exactly which pages).

## kotlin-android (almasumdev; no licence declared; reference only)
- ANDROID-1 StateFlow/SharedFlow over LiveData; lifecycle-aware collection.
- ANDROID-2 Compose-first UI with the same tokens as desktop (H1).
- Status: not exercised this session (no Android work).

## fabric-stonecutter (CC0 template)
- FABRIC-1 One source tree, per-version `versions/<mc>/` with `//? if` comments for version-specific code.
- FABRIC-2 One jar per Minecraft version; generate client-compat.json with sha256 (E1).
- Status: not exercised this session.
