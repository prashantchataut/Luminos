## Session 14 update: client UI overhaul (same PR, same branch)

**Screens (real client, 1920x1080 at GUI 2 = 2x of 960x540, three rounds):** `docs/client-shots/rounds/` (45 PNGs) with per-round critiques in `docs/client-shots/README.md`. Teardown: `docs/research/CLIENT_UI_TEARDOWN.md`. Perf honesty: `docs/PERF.md`. Skill proof: `docs/design/skills-ls.txt` (`ls -R .agents/skills`) and `docs/design/skills-summary.txt`; installed this session: liquid-glass, game-ui-ux, game-ui-design, icon-system (`icon-designer` could not be cloned and was skipped). Tour GIF (stills slideshow, not a recording): `docs/client-shots/luminos-client-tour.gif`.

| Feature | Learned from | What we did differently | Files | Status |
|---|---|---|---|---|
| Liquid-glass panel | LiquidGlass API/ReGlass (use vanilla blur), liquid-glass skill | vanilla blur + scrim + 0.08-0.18 tint, no shader/mixin; intensity 0-100, solid toggle, OS reduced-transparency probe | `Glass.java`, `Panel.java`, `Adapter.java` x2 | VERIFIED (render); OS probe UNVERIFIED |
| Search-first grouped list, favourites | Wurst/Meteor, Lunar | focused on open; HUD/PvP/Visuals/Utility/Performance with counts; favourites pinned | `Panel.java`, `Features.java` | VERIFIED (render) |
| Right-click popover | Wurst, Lunar per-mod settings | sliders + switches in a popover instead of inline | `Panel.java`, `Feature.java` | VERIFIED (render); real click UNVERIFIED |
| Icon set | icon-system skill | original 8x8 voxel icons from code | `Icons.java` | VERIFIED |
| HUD restyle, Minimal default | Lunar HUD guide | neutral glass, primary/secondary ink, 5 modules on by default, 3 presets | `HudModule.java`, `Modules.java`, `core/HudPresets.java` | VERIFIED (editor) |
| Potion icons, vitals, armor durability, target HUD, ping server+measured | Lunar / Badlion HUDs | effect sprites not text; measured ping via vanilla ping/pong | `Modules.java`, `Probes.java` | COMPILED (1.21.11, 26.3) |
| HUD editor | Badlion pen editor | glass toolbar, dot grid, coordinate chip | `HudEditor.java`, `HudEditorScreen.java` x2 | VERIFIED (render); drag by mouse UNVERIFIED |
| Title screen | PolyPlus (not studied) | glass column, neutral | `TitleView.java` | VERIFIED (render) |
| Render-loop input, tap latching | No-Input-Lag-Tick-Rate idea, InputBooster idea | no mixin: access widener + press counts | `InputSampler.java`, `*.accesswidener` | COMPILED; behaviour UNVERIFIED |
| Frame-queue guard | NVIDIA Reflex idea | GL fence wait, capped, off by default | `InputSampler.java`, `core/FramePacer.java` | COMPILED; UNVERIFIED |
| Click test | brief | raw vs tick vs frame waits from real timestamps | `core/ClickStats.java`, `Panel.java` | logic VERIFIED (tests); live UNVERIFIED |
| FPS doctor, renderer picker | brief | one concrete change; never installs | `core/FpsDoctor.java`, `core/RendererAdvisor.java` | VERIFIED |
| Fullbright, shulker/bundle/ender tooltip | Gamma Utils, Shulker Box Tooltip | gamma only up to vanilla 1.0; text tooltip, no mixin | `LuminosClient.java`, `ShulkerTooltip.java` | COMPILED; UNVERIFIED in world |
| Per-server compliance reasons | brief | one-line reason in the row | `Compliance.java` | COMPILED |
| Startup profiler | brief | log line + dev card | `StartupProbe.java` | COMPILED; no numbers |
| **Not built** | | freecam, freelook, chat tabs, replay browser, outfits, F3 replacement, launcher caches, conflict dropping | | NOT BUILT |

Tests: 136 core assertions pass locally (106 before). Both Minecraft lines build locally (1.21.11 jar; 26.3 compiled before the last cosmetic edits, CI will rebuild). Stub grep over `client`, `client26` is clean; the 3 hits under `launcher/crates` are pre-existing and justified (a doc comment and two test-fixture host names).
Real bugs the real client caught: "Can only blur once per frame" crash, lavender accent, row crowding, popover transparency, text-fit bug (9 sites), overlapping default positions.
