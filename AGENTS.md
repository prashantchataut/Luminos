# AGENTS.md — rules for AI agents working on Luminos Launcher

You are continuing a multi-session project. **Before doing anything: read `CONTINUITY.md`.**
**Before finishing: update `CONTINUITY.md`, regenerate screenshots if the UI changed, commit.**

## Non-negotiables
1. **Everything in the launcher is Rust.** No Electron/webviews. The marketing site is the only TypeScript.
2. **Stay light.** New dependency? Justify it in the PR. Prefer `std`. Check `cargo build --release` size; don't regress past ~12 MB without a reason.
3. **Never block the UI thread.** Network/disk/process work goes in a thread and reports through `Bg::send(Msg::…)`.
4. **Honesty over hype.** Mark anything not run on real hardware as 🟡 in CONTINUITY. Never claim a feature works if it was only compiled.
5. **Commit and push often** (small commits, imperative messages). Never commit tokens or secrets. If a user pastes a token in chat, tell them to revoke it and use a scoped fine-grained token / `gh auth login` instead.
6. **Legal/safety line:** Luminos supports offline accounts (a normal, lawful launcher feature) and will support Microsoft login. It never bundles or redistributes Mojang assets or game jars — everything is downloaded from Mojang's official endpoints at runtime. Don't add anything that bypasses server authentication or license checks.
7. Don't copy GPL code from other launchers. Study features, write original code.

## Architecture rules
- `luminos-core` has **no UI types**. `luminos-app` has **no business logic** beyond glue.
- Errors: `anyhow::Result` with `.context(..)` in the engine; surface `format!("{e:#}")` to the user via toasts. No `unwrap()` outside tests (except mutex locks).
- All paths come from `paths.rs` (respect `LUMINOS_HOME`). All persistence goes through `store::{read_json, write_json}` (atomic writes).
- Every page is `pub fn ui(app: &mut App, ui: &mut Ui)` in `pages/`. Shared widgets live in `widgets.rs`; icons in `icons.rs` (vector, no assets).
- Adding a screen? Add it to `demo.rs` data **and** to `bin/shots.rs`, re-render, view the PNG.
- Every new core function gets a unit test, or a `#[ignore]` live test in `crates/luminos-core/tests/live.rs`.
- Before committing: `cargo fmt`, `cargo clippy --workspace -- -D warnings` (fix or justify), `cargo test --workspace`.

## Design system (Luminos)
- Theme: deep navy surfaces (`theme::BG0..BG3`), **blue accent family**, ordered **Bayer dither** backdrop (`dither.rs`), generous 14–18px radii, 1px `LINE` strokes, Inter (UI) + JetBrains Mono (numbers/paths).
- Motion: 120–220 ms eases (`animate_bool_with_time`), page fade+rise 220 ms, wizard transitions 550 ms. **Always honour `settings.reduce_motion`.**
- Hit targets ≥ 32 px; every icon-only button has a tooltip; hover + pressed + disabled states on every control; never rely on colour alone (pair with icon/text).
- Keep content width readable; cards over walls of text; empty states always explain the next action.
- Reference screenshots (SKLauncher home/instance/discover) informed layout: left icon rail, content column, right info panel, quick-play strip, tabbed instance page. Don't clone their branding.

## Skills to load (from skill directories)
Install with `npx skills add <repo> --skill <name>` when the agent runtime supports it; otherwise read the linked `SKILL.md` and follow it.
| Purpose | Skill | Source |
|---|---|---|
| Visual taste, spacing, motion rules | `design-taste-frontend` (+ `minimalist-ui`, `high-end-visual-design`, `redesign-existing-projects`) | https://github.com/Leonxlnx/taste-skill |
| UI/UX decisions, palettes, a11y, interaction | `ui-ux-pro-max` | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
| Idiomatic production Rust (API guidelines, errors, ownership, clippy, unsafe) | `rust-best-practices` | https://github.com/massimodeluisa/rust-best-practices-skill (also Apollo's handbook variant: https://github.com/apollographql/skills) |
| Directory to discover more skills | skills.sh, skills.lc, https://open-design.ai/skills/#catalog | — |
Use **one** main style engine per task (taste-skill *or* ui-ux-pro-max) for the site; for the egui app, apply their principles by hand (the skills target web stacks).
Reverse-engineering/research tasks: study public behaviour and docs (Mojang launcher meta, Modrinth API docs, Fabric meta) — never decompile proprietary launcher binaries.

## Useful endpoints (verified live in session 1)
- Mojang manifest: `https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`
- Patch notes feed: `https://launchercontent.mojang.com/v2/javaPatchNotes.json`
- Fabric meta: `https://meta.fabricmc.net/v2/versions/loader/{mc}` · Quilt: `https://meta.quiltmc.org/v3/versions/loader/{mc}`
- Modrinth v2: `/search`, `/project/{id}/version`, `POST /version_files`, `POST /version_files/update` (UA header required)
- Adoptium: `https://api.adoptium.net/v3/binary/latest/{major}/ga/{os}/{arch}/jre/hotspot/normal/eclipse`
- Skins: `https://minotar.net/skin/{name}`, `https://mc-heads.net/skin/{name}`

## Session checklist
- [ ] Read CONTINUITY.md  - [ ] Plan ≤ 10 bullet tasks  - [ ] Implement  - [ ] Tests  - [ ] Re-render screenshots
- [ ] Update CONTINUITY.md (status, limitations, next steps)  - [ ] Commit + push  - [ ] PR with screenshots

## Skills to load (see `docs/SKILLS.md` for install commands and when to use each)
- **UI/UX:** `frontend-design` (commit to a direction before markup), `design-taste-frontend` (anti-slop for the marketing site), `ui-ux-pro-max` (palette/type/pattern lookup), `web-design-guidelines` (pre-ship audit of `src/`), `impeccable` (final polish pass).
- **Rust:** a Rust best-practices skill (ownership, errors, API design, async, perf, clippy). Our rules above win on conflict (no `unwrap`, blocking work off the UI thread).
- Use **one creator + one reviewer** skill per task; do not stack overlapping ones.
- Give yourself eyes: render with `luminos-shots` and *look at the PNGs* before claiming a UI change works.

## Client mod rules (`client/`)
- Java 21, Fabric, Mojang mappings, client-only. No mixins unless unavoidable (prefer Fabric API events / GLFW hooks) — fewer breakages across MC versions.
- Every HUD module = one class in `Modules.java` registered in `Modules.ALL`, drawing at (0,0); the host handles position/scale/enable. Add sample data for `preview` mode.
- Never claim "works in game" until someone launched it; note it 🟡 in CONTINUITY.
- Release: push tag `client-vX.Y.Z`; CI attaches the jar; the launcher picks the newest `client-v*` release.
