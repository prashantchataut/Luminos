# STATUS (session 19, continuing PR #18)

**VERIFIED** = a command was run and its output read. **UNVERIFIED** = built, not exercised where it matters. **NOT BUILT** = does not exist.

| Area | State | Evidence / reason |
|---|---|---|
| Skills from ui-skills.com | **VERIFIED** (CLI run) | `docs/design/skills-proof/*`, 13 skills in `.agents/skills/ui-skills-registry/`. **Only improve-ui was read in full**; the rest are fetched, not studied (`docs/SKILLS_SESSION19.md`). |
| improve-ui audit | **Partial** | `docs/design/AUDIT.md`: live panel, Instances, Settings. Home, Library, Cosmetics **not audited**. |
| Teardown with rea | **VERIFIED** for XMCL (rea run, evidence gz); Pandora/Prism read with `rg`; **Hotwire: source deliberately not read** (licence forbids clients) | `docs/research/REFERENCES_TEARDOWN.md` (undo correction recorded). |
| Live apply | **VERIFIED on 1.21.11 at the title screen** for Luminos modules and resource packs, real stages; **third-party mods queue by design (NOT BUILT: unloading them)**; 26.3 jar compiles, **not run**; pause with a world open **UNVERIFIED** | `docs/LIVE_SWAP.md`, `docs/research/agent-e2e/`. The brief's "HUD/QoL mods toggle live" is **not met for third-party mods**. |
| Pending queue + Undo | **VERIFIED** (Rust tests; UI planner tests); UI undo seen in browser demo only | `pending.rs`, `livepanel.test.mjs` |
| Tauri commands | **VERIFIED compiles on Linux** (`cargo check`), 25 UI-used commands checked by `tools/bindings.test.mjs`; **never run inside a Tauri window**; Windows compile: CI job `rust (windows-latest)` (see PR checks) | `app/src-tauri/src/engine.rs` |
| Store (real Modrinth) | **VERIFIED in browser** (real results, categories, hide installed, captured); the Rust path is compiled, not run | `store-*.png` |
| Dedup reflink + saved number | Fallback (hard link) **VERIFIED** by tests on ext4; **reflink success UNVERIFIED** (no ReFS); number shown on cards (browser capture uses demo figures) | `dedup.rs` |
| Cross-instance sharing + conflicts | Engine **VERIFIED** (3 tests); dialog captured with demo data; Tauri path compiled | `shares.rs`, `settings-conflict-dialog.png` |
| P2P client, bridge, Worker | Bridge **VERIFIED** (loopback test); client compiled; **Worker and two-machine run UNVERIFIED** | `docs/P2P.md` has the manual test |
| Discord presence | Runner wired to launch events, **compiled, not run against Discord; no application registered (owner) so it sends nothing** | `docs/DISCORD.md` one-line change |
| Quick Play | Parser (#18) + `quickplay_shortcut` command; **no UI button: NOT BUILT** | |
| Sandbox | **NOT BUILT, by decision** | `docs/SECURITY.md` |
| Microsoft sign-in | **UNVERIFIED** (needs the owner's Azure app) | `docs/MICROSOFT_AUTH.md` |
| Captures | 15 in `docs/launcher-shots/session19/`; contact sheets viewed: panel states, review, progress, store, three themes, instances, settings, dialog. Home/Library/Cosmetics shots were taken but **not looked at** | `tools/shots-s19.mjs` (per-step timeouts) |
| Release v1.0.0-rc1, release pipeline run, client jars, site deploy | **NOT DONE** | see START_HERE |
| Windows / real desktop / ARM | Not run | |
