# STATUS (session 18). What runs, what was only compiled, what does not exist

Legend: **VERIFIED** = a command was run and its output read. **UNVERIFIED** = built but not exercised where it matters. **NOT BUILT** = does not exist.

| Area | State | Evidence / reason |
|---|---|---|
| 3D skin preview, five skins, idle animation | VERIFIED (headless Chromium, SwiftShader) | `app/tools/skin3d-check.mjs`: no page errors, canvas not blank, five distinct renders, idle frames differ, head/torso/legs stay connected for idle/walk/jump. I could **not reproduce** the malformed figure from #17; its "STILL-WRONG" capture looks like a frame caught near side-on. Root cause not proven. Not a real GPU. |
| Log redaction | VERIFIED (unit tests) + wired into `launch.rs` for stdout and stderr | 7 tests. Always on, no setting. No end-to-end game launch was run. |
| Dependency graph + "can't disable what's needed" | Engine VERIFIED (`deps.rs`, 4 tests); panel logic VERIFIED (`plan.ts`, tests) | The panel runs on **sample data**. Not yet fed from a real instance through a Tauri command. |
| Mod/resource dedup | Engine VERIFIED (3 tests, hard links + ledger) | No UI yet: **no "saved N" number on instance cards**. **Reflinks / ReFS: NOT BUILT** (untestable here); hard links already give the saving on NTFS. |
| Cross-instance sharing | Pre-existing `sync.rs` (options, keybinds, configs, servers, 3-way + conflicts folder) | **Saves are not synced; no conflict dialog.** Not touched this session. |
| Mod sandbox | **NOT BUILT, by decision** | Pandora's is Linux-only (bwrap). A Windows Job Object does not restrict file or network access; an AppContainer breaks most mods. See `docs/research/REFERENCES_TEARDOWN.md`. The UI does not claim a sandbox. |
| Quick Play | `luminos://play` parser, `world:` launch arg (`--quickPlaySingleplayer`, MC 1.20+), `.url` shortcut text: VERIFIED (4 tests) | **No UI button creates a shortcut. `luminos://` is not registered with Windows (UNVERIFIED, needs a desktop).** Server quick play pre-existed. |
| Auto re-authentication | Decision function VERIFIED (`quickplay::auth_action`) | **Not wired into the launch path or a prompt.** Microsoft network chain still UNVERIFIED (`docs/MICROSOFT_AUTH.md`). |
| Live mod panel | UI VERIFIED in a browser on sample data: staging, diff before confirm, progress rows, stacked toasts, undo, keep-on list with tooltips, hide installed, categories, per-instance gzip cache, pause toggle (stored, **does nothing yet**) | **Live apply is NOT BUILT**: it needs an in-game agent and the in-game hooks that #16/#17 never built. Every switch says "Applies on next launch". The store searches sample data, not Modrinth. The keybind / client quick-panel entry points do not exist. |
| Discord Rich Presence | Payload builder + IPC framing VERIFIED (golden file shared with TypeScript; fake-Discord socket test) | **UNVERIFIED: real Discord, "Playing Luminos", second-account capture.** Needs a Discord application named Luminos and its asset keys (`docs/DISCORD.md`); that is the owner's account. Presence is **not yet started from the launcher process**. Settings toggles are UI-only until it is. |
| P2P hosting / join | **NOT BUILT** | No WebRTC client, no signalling Worker, no tunnel. `docs/P2P.md` records the design and the limits. |
| In-game rendering hooks | **NOT BUILT** (unchanged since #16) | Out of scope this session. |
| Client jars beyond 26.3 / 1.21.11 | **NOT DONE** | No JDK in this session; CI builds them. |
| v1.0.0-rc1 tag, installers, SHA256SUMS, release pipeline run | **NOT DONE** | A tag must come from merged main; this PR is not merged. The publish / update-check / manifest jobs have still never run. |
| Site update (screenshots, tour, deploy, live screenshot) | **NOT DONE** | Needs rc1 captures and a deploy; neither exists. |
| Tauri crate | Not compiled here | Only the Windows CI job compiles it. No Tauri file was changed. |
| Microsoft sign-in | UNVERIFIED | Needs the owner's Azure app. |
| Windows / real desktop / ARM64 | Not run | Linux sandbox only. |
