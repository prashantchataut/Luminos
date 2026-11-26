# Luminos 4.0 — engine and skills audit

What was read, what was learned, what was built, and what was **not** built. Sources were cloned for real into `/tmp/rea-audit/`
(`sodium`, `fabulously-optimized`, `onelauncher`, `oneconfig`, `rea`) and read; nothing below is from memory alone.

## 0. CI root causes found first

| Failing job | Log line | Cause | Fix |
|---|---|---|---|
| every `rust (windows-latest)` job, 3 workflows | `error: invalid path 'docs/?'` at *Checkout* | a tracked file literally named `docs/<0x1A>` (Ctrl-Z). Windows cannot check it out, so the job died before any code ran. The earlier fix removed a different file. | `git rm` the file; verified `git ls-files` has zero non-printable or Windows-reserved names |
| `client-jars (26.3, client26)` | `package org.lwjgl.glfw does not exist` in `WindowBrand.java` | the 26.x Loom line does not put Minecraft's LWJGL on the compile classpath, unlike the 1.21 remap line | `compileOnly` lwjgl, lwjgl-glfw, lwjgl-stb in `client26/build.gradle` (game supplies the real ones at runtime); reproduced and fixed locally |

## 1. Sodium (`CaffeineMC/sodium`)

* **Entity culling** is `EntityRendererMixin` using MixinExtras `@WrapMethod` on `EntityRenderer.shouldRender`; it asks
  `SodiumWorldRenderer.isEntityVisible(...)` (render-section visibility) and then the vanilla frustum test. Luminos' own culling
  injects at `EntityRenderDispatcher.shouldRender` HEAD, a different layer, so the two stack without conflicting.
* **Options schema** (`SodiumOptions.java`, serialised snake_case by Gson): `quality.{hidden_fluid_culling, improved_fluid_shaping,
  use_closest_point_entity_sort, pixel_filtering_mode}`, `performance.{chunk_builder_threads, chunk_build_defer_mode,
  animate_only_visible_textures, use_entity_culling, use_fog_occlusion, use_spherical_render_fog, use_block_face_culling,
  use_no_error_g_l_context, quad_splitting_mode}`.
* **Correction to the brief:** `cpu_render_ahead_limit` does not exist in current Sodium (grep across the repo: zero hits). It was
  removed upstream, so Luminos does not write it.
* **Render loop:** chunk meshing is async (`render/chunk/async`, `compile`), geometry goes through shared quad index buffers
  (`SharedQuadIndexBuffer`) and a uniform buffer manager, and visibility is decided per `RenderSection` with `RenderSectionFlags`.
  Luminos does not replace any of this; it ships Sodium and layers on top.

## 2. Fabulously Optimized (`Fabulously-Optimized/fabulously-optimized`)

* `Packwiz/26.1.1/mods/` contains `sodium`, `lithium`, `ferritecore`, `immediatelyfast`, `entityculling`, `moreculling`, `modernfix`
  (plus `sodium-extra`, `dynamic_fps`, `iris`, `zoomify`, `fastquit`, `rrls`, ...). All seven performance mods from the brief are present.
* **Its shipped defaults are minimal and conflict-free:** `sodium-options.json` = `{"quality":{"weather_quality":"FAST"}}` and
  `modernfix-mixins.properties` = `mixin.perf.dynamic_resources=false`.
* **Deviation from the brief, on purpose:** the brief asked for `mixin.perf.dynamic_resources=true`. Fabulously Optimized, the stated
  reference for "conflict-free defaults", ships it **off** (it is opt-in because it breaks some resource packs and mods). Luminos
  follows Fabulously Optimized. The brief's `faster_item_rendering` is not a ModernFix key that appears in FO's defaults and is not written.
* **Not verified:** ImmediatelyFast's config key names (`hud_batching`, `font_atlas_resizing`, `fast_buffer_upload`). The upstream
  source was not reachable from the sandbox. They are written as documented, and an unknown key is ignored by a JSON loader.
* FO's `yosbr` pattern (write defaults only if the player has no file) is what `perfconfig.rs` copies: a player's file is never overwritten.

## 3. OneLauncher and OneConfig (`Polyfrost/*`)

* **OneLauncher is a Rust workspace**, not React: `packages/oneclient_{app,auth,cluster,common,content,core,db,discord,events,java,mc,net,
  polyplus}` plus `polyio`; `oneclient_app` holds assets, icons, lang and distribution. The "Tauri + React" description in the brief
  does not match what is in the repo at `main`. The takeaway used: strict engine/UI separation by crate, which Luminos already has
  (`luminos-core` has no UI types).
* **OneConfig** is Kotlin/Gradle (`minecraft/`, `modules/`, `mappings/`). Its HUD system lives in `api/hud/v1/LegacyHud.kt`,
  `internal/ui/hud/LegacyHudRenderer.kt`, `HudFrameHooks.kt`, and the editor is `HudEditorUIScreen.kt` (Compose). Takeaway used:
  the HUD is rendered from one frame hook, and the editor is a separate screen over the same module state. Luminos already works
  this way (`HudElementRegistry` plus `HudEditorScreen`).
* No code was copied (AGENTS.md rule 7: no GPL/AGPL code).

## 4. Skills actually read (`.agents/skills/*/SKILL.md`)

`improve-ui`, `impeccable`, `taste-skill`, `ui-ux-pro-max`, `better-ui`, `better-layout`, `better-motion`, `improve-animations`,
`audit-ai-design-slop` were opened and read; `npx -y ui-skills@latest list` was run (it lists the public registry).

Rules that bind this work, quoted:

* `improve-ui`: "**Strictly read-only on product source.** Never modify product source. Create or edit files only under `design-plans/`."
  and "prefer no finding to an unsupported one". `improve-animations`: "Never modify source code." Both skills produce *plans*, so they
  cannot be "applied" by editing the launcher; they were used as audit method only.
* `better-ui`: "Outer radius equals inner radius plus padding." and "The values below are exact, not ranges to approximate."
* `better-motion`: "Less motion, exact values", "Ease out, and spring what has weight", "Springs take a duration and no bounce",
  "Stagger infrequent entrances by 100ms".
* `audit-ai-design-slop`: "Do not assign a numeric slop score." and "Do not reject a visual technique in isolation. A gradient,
  serif, dark theme, glass effect, card, animation, or single-font system can be intentional."
* `anthropic-frontend-design`: avoid "a tracked-out ALL-CAPS eyebrow label above every heading" and "the SaaS-card kit".

**Changes applied to `app/` from these skills in this release: none.** The launcher UI was not redesigned in 4.0.0 (see section 6).

## 5. What the native engine is (`client/`, Minecraft 1.21.11, Mojang mappings)

Mojang names are used because the project uses `loom.officialMojangMappings()`. The brief's Yarn names map as below. Every target was
checked with `javap` against the mapped 1.21.11 jar, and the mod was then **launched for real** (Xvfb + software GL, `LUMINOS_SMOKE=1`);
`Engine` calls `MixinEnvironment.audit()`, which force-loads and applies every Mixin, and logged `[luminos] mixin audit passed`.

| Brief (Yarn) | Class in `mixin/` | Target (Mojang) | What it does |
|---|---|---|---|
| EntityRenderDispatcherMixin | `EntityRenderDispatcherMixin` | `EntityRenderDispatcher.shouldRender` | distance and vertical-occlusion culling, cached per entity for 12 frames, never players/bosses/glowing/large |
| WorldRendererMixin | `WorldRendererMixin` | `LevelRenderer.extractVisibleEntities` | once-per-frame cache of camera, frame-time-scaled radii, sky exposure |
| (block entities) | `BlockEntityRenderDispatcherMixin` | `BlockEntityRenderDispatcher.tryExtractRenderState` | far chests, signs, skulls, banners get no render state (both vanilla callers null-check) |
| ParticleManagerMixin | `ParticleManagerMixin` | `ParticleEngine.add` | per-tick particle budget, shrinks at low FPS |
| BackgroundRendererMixin | `BackgroundRendererMixin` | `FogRenderer.updateBuffer` | clear fog per dimension; water/lava fog untouched |
| LightmapTextureManagerMixin | `LightmapTextureManagerMixin` | `LightTexture.updateLightTexture` (redirect `DimensionType.ambientLight`) | native fullbright |
| CameraMixin | `CameraMixin` | `Camera.setup`, `Camera.setRotation` | 360° freelook, player rotation untouched |
| GameRendererMixin | `GameRendererMixin` | `GameRenderer.getFov`, `bobHurt` | smooth exponential zoom (2x-12x), optional no damage tilt |
| MouseMixin | `MouseMixin` | `MouseHandler.turnPlayer` (redirect `LocalPlayer.turn`), `onScroll` | freelook input, 1/zoom sensitivity, scroll changes zoom |
| MinecraftClientMixin | `MinecraftClientMixin` | `Minecraft.createTitle` | "Luminos Client 4.0 — 1.21.11"; icon via `GLFW.glfwSetWindowIcon` in `WindowBrand` |
| (unfocused limiter) | `FramerateLimitTrackerMixin` | `FramerateLimitTracker.getFramerateLimit` | 15 FPS cap while unfocused, recomputed live |
| HeldItemRendererMixin | `HeldItemRendererMixin` | `ItemInHandRenderer.renderArmWithItem` | viewmodel x/y/z/scale, 1.7-style sword block pose, low shield; own push/pop |
| InGameOverlayRendererMixin | `InGameOverlayRendererMixin` | `ScreenEffectRenderer.renderFire` | low fire |
| ClientWorldMixin | `ClientWorldMixin` | `ClientLevel.setTimeFromServer`, `tickTime` | client-side time lock |
| (weather) | `LevelWeatherMixin` | `Level.getRainLevel/getThunderLevel` | client-side weather lock (only `ClientLevel` instances) |
| TitleScreenMixin, PlayerSkinMixin | (existing) | `TitleScreen.init`, `AbstractClientPlayer.getSkin` | custom title, HD cape texture swap |

Registered in `luminos-legacy.mixins.json` (the 1.21 line) rather than the shared `luminos.mixins.json`, because the 26.x line shares
that file and these Mixins target 1.21.11 internals. 26.x keeps its own file and does not show the new modules.

## 6. What was NOT built in 4.0.0 (honest list)

* **`InGameHudMixin` and the 3D waypoint / live minimap radar: not built.** The HUD stays on Fabric's `HudElementRegistry` with the
  existing `hud_refresh` cap; no per-frame allocation audit of it was done.
* **`CapeFeatureRendererMixin` and the voxel-extruded 3D cape mesh: not built.** HD capes still work through the existing
  `PlayerSkinMixin` texture swap.
* **"Fast world disconnect without GC freeze": not built, and the premise is wrong.** `javap -c` on 1.21.11 shows `System.gc()` is only
  called from `Minecraft.run()` and `emergencySave()`, not from disconnect, so there is no GC freeze on disconnect to remove.
* **Particle frustum culling:** vanilla 1.21.11 already frustum-culls particles in `ParticleEngine.extract`; Luminos only adds the budget.
* **LuminosTitleScreen / Quick Panel / HUD Editor rebuild, launcher (`app/`) redesign, 10 capes on 3D torsos, new 16 skins, onboarding:**
  the 2.3.0 implementations are unchanged. They were not redesigned or re-audited in this release.
* **In-game visuals are unverified:** the Mixins apply and the game boots, but there was no GPU, so fullbright, fog, freelook, zoom,
  fire, viewmodel, and the sword block pose have **not been looked at on screen**. The sword pose is an approximation of 1.7.
* **Render-loop click sampling** already existed (`InputSampler`, 2.x) and is unchanged.

## 7. Provisioner (`luminos-core`)

The seven Modrinth mods were already provisioned by `preset.rs` (slugs `sodium`, `lithium`, `entityculling`, `ferrite-core`, `modernfix`,
`immediatelyfast`, `moreculling`), with the SHA verification in `download.rs`. New in 4.0.0: `perfconfig.rs` (write-if-missing
`sodium-options.json`, `immediatelyfast.json`, `modernfix-mixins.properties` at every launch, 4 unit tests) and the JVM preset
`-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=30 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC
-XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20`.
`AlwaysPreTouch` was previously excluded on purpose (slower startup on large heaps); 4.0.0 follows the brief. The `LuminosClient.exe`
taskbar wrapper (`branded_java`) predates this release.
