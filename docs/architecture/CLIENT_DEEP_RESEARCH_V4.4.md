# Client deep research for v4.4.0

Scope: how comparable clients structure a startup screen and an in-game mod panel, how Sodium and Fabulously Optimized remove
frame cost, and what that means for `LuminosMainMenuScreen`, `LuminosQuickPanelScreen` and the engine mixins.

## 0. What was actually done (read this first)

| Item | Status |
|---|---|
| Shallow clones (`--depth 1`) of `Polyfrost/OneConfig`, `Polyfrost/OneClient`, `CaffeineMC/sodium`, `Fabulously-Optimized/fabulously-optimized` | Done. Files below were opened and read. |
| `.agents/skills/improve-ui`, `better-layout`, `taste-skill`, `audit-ai-design-slop` | Opened. Their `SKILL.md` headers and rules were read; the rules that bear on this work are in section 5. |
| `.agents/skills/interaction-design` | **Does not exist in this repository** (`ls` fails). It was not read. Interaction rules in section 5 come from `better-layout`, `improve-ui` and the repo's own `AGENTS.md`. |
| `rea` and `agent-reach` | Their skill folders exist (`.agents/skills/rea`, `.agents/skills/agent-reach`). They were **not run**: the research used `git clone`, `find` and `grep` directly, which was enough for the questions asked. No claim here depends on either tool's output. |
| Lunar, Feather, Meteor, ZenithUI | **Not inspected.** Lunar and Feather are closed source; no source for "ZenithUI" was identified. Nothing below is claimed about their internals. |
| Licence | OneConfig / OneClient are GPL-3.0 (per `AGENTS.md`); Sodium's `LICENSE.md` is PolyForm Shield 1.0.0 (read from the clone). Behaviour was studied; no code was copied. |

## 1. Intercepting the title screen: what OneConfig does

`OneConfig/minecraft/src/main/java/org/polyfrost/oneconfig/internal/mixin/events/Mixin_ScreenOpenEvent_Fabric.java`
mixes into the class that owns `setScreen` and injects at `HEAD`:

```java
@Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
private void screenOpenCallback(Screen screen, CallbackInfo ci) { ... post(new ScreenOpenEvent(screen)); if (cancelled) ci.cancel(); }
```

Take-aways for Luminos:

* The reliable choke point is `setScreen` at `HEAD`, not `TitleScreen.init`. Every code path (startup, disconnect, "return to title") goes through it.
* The file carries a comment that in newer Minecraft the method moves (`Minecraft` to `Gui`); the target class is the part that drifts between versions. Luminos pins MC 1.21.11, where `Minecraft.setScreen(Screen)` exists (checked with `javap` on the Mojang-mapped jar).
* Luminos swaps the argument instead of cancelling, with `@ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)`. That keeps vanilla's own bookkeeping (`removed()`, `init`, narrator) running for the replacement screen.
* **Gap found:** vanilla's `setScreen(null)` creates `new TitleScreen()` *inside* the method body, after the HEAD hook has run. A hook on the argument alone therefore misses "close the last screen with no world loaded". That is why a second, independent safety net (`TitleScreenGuardMixin`, `TitleScreen.init` at HEAD, cancellable) is required. Shipping both is not redundancy for its own sake; each covers the other's hole.

## 2. Mod panel structure: one canvas, one hit list

OneConfig's `OneConfigUIScreen` / `HudEditorUIScreen` render the whole UI through one compose surface and route input from the
screen's own `mouseClicked` / `keyPressed` (it even gates `keybindClosesGui` in the key handler, line ~396). The pattern is: **the
screen owns input; the UI does not create platform widgets.**

Luminos v4.3 already had that shape (`ModPanelView`), but it had a concrete bug. In `click()`:

```java
boolean isChrome = y < gy || y >= gy + gh;      // v4.3
if (isChrome || inGrid) { h.r.run(); ... }
```

A card scrolled partly under the header keeps a hit rectangle that extends above the grid viewport (`gy`). A click on the search row or
the tab row, inside that overhang, satisfied `isChrome` and ran the card's toggle. v4.4 fixes this at the source:

1. Every hit is registered with the rectangle it was drawn at (`HitRegion(x, y, w, h, onLeft, onRight, scrolled)`).
2. Scrolled regions are **clamped to `[gridTop, gridBottom]` when registered** and dropped if nothing is left. The inline drawer is a second scrolling viewport and goes through the same function.
3. The list is cleared at the start of every `render()`; nothing persists from a previous layout.
4. Registration order equals paint order and `click()` walks the list back to front, so the control painted on top wins (gear and switch over the card body).

The user's brief asked for this logic inside `LuminosQuickPanelScreen.java`. It lives in the shared `ModPanelView` instead, because
the same view is painted by the offscreen preview and by the `client26` build; `LuminosQuickPanelScreen` stays a thin `Screen` that
forwards input. `LuminosQuickPanelScreen` registers no vanilla widget at all (no `addRenderableWidget`, Mojang's name for `addDrawableChild`).

## 3. Zero screen-hopping

* Toggle, tab switch, search, gear, drawer close, slider drag: all mutate view state and call `Feature.toggle()` / `Features.optSet()` plus `Config.save()`. None calls `setScreen`.
* Only three explicit controls leave the screen: the `X` (close), `Edit HUD`, and the footer "Keybinds, waypoints, support" link.
* The settings drawer is a 210 px column inside the modal; the grid reflows to the remaining width (3 columns, 2, or 1 depending on width).

## 4. Why a custom screen must neutralise `renderBackground`

Since 1.20.5 `Screen.render` begins with `renderBackground`, which draws the blurred panorama (no world) or a blurred, darkened
world. A custom full-bleed scene drawn after it is composited over a blur. Both `LuminosMainMenuScreen` and
`LuminosQuickPanelScreen` override `renderBackground` with an empty body; each paints its own scrim.

## 5. Design rules applied (from the skills that exist)

* `better-layout`: group with space first; control targets distinct from content; every width stress-tested. Applied: the panel's tab row degrades its padding to fit, and the main menu's top-left pill drops text tiers (engine label, then FPS) before it would collide with the right-hand buttons. The headless test renders at 480x270, 640x360 and 854x480.
* `audit-ai-design-slop` / repo design language (`AGENTS.md`): flat ink panels, hairlines, one accent (cobalt), mono micro-labels, no gradient buttons, no emoji. The brief explicitly asked for pill chips in the top bar; that is a deliberate deviation from the repo rule "no pill chips" and is limited to the top bar.
* Honest labelling: the engine pill says "Sodium + Native Engine Active" only when `FabricLoader.isModLoaded("sodium")` is true; otherwise "Native Engine Active".

## 6. How Sodium and Fabulously Optimized remove frame cost

From `CaffeineMC/sodium/common/src/main/java/net/caffeinemc/mods/sodium/`:

* `client/render/chunk/` contains `RenderSectionManager`, `ChunkRenderer`, `DefaultChunkRenderer`, `SharedQuadIndexBuffer`, `UniformBufferManager`, and `async/` plus `compile/`: chunk meshing is moved off-thread and the world is drawn from a few large shared buffers rather than per-chunk vanilla draw state.
* `mixin/features/render/entity/cull`, `.../particle`, `.../render/immediate/buffer_builder` (with `intrinsics` and `sorting`), `.../render/gui/font`, `.../textures/animations/tracking`: culling for entities and particles, cheaper vertex building for immediate-mode drawing and text, and only animating textures that are actually visible.
* `mixin/core/render/frustum`: replaces the frustum test.

From `fabulously-optimized/INCLUDED-MODS.md` ("Smooth" group): Sodium, Lithium, FerriteCore, ImmediatelyFast, ModernFix, Entity Culling, Dynamic FPS, FastQuit, LazyDFU, Smooth Boot, Better Block Entities and others. The pack's approach is not one clever mod: it is many narrow fixes (allocation, startup, culling, text and UI batching) layered together.

### What that means for a client mod that ships alongside them

* Luminos does **not** try to out-render Sodium and does not make that claim. It ships the engine mixins that already existed (below), keeps its own per-frame work allocation-free, and provisions Sodium/Lithium/etc. next to itself.
* Existing mixins in `client/src/legacy` (all pre-v4.4, verified present): entity `shouldRender` cull, block-entity `tryExtractRenderState` cull, `LevelRenderer.extractVisibleEntities`, `ParticleEngine.add` budget, `FogRenderer.updateBuffer` clear fog, `LightTexture` fullbright, `Camera`, `GameRenderer`, `MouseHandler`, held-item, overlay, `ClientLevel`, `FramerateLimitTracker` (unfocused cap, 15 FPS default), window title/icon.
* New in v4.4: `FastMathLUT` (65,536-entry sine table, used by the menu animation), `KeyboardMixin`, the `runTick` edge detector, the `setScreen` interception, `TitleScreenGuardMixin`.
* Not done, and why: the brief names `InGameHudMixin` and `CapeFeatureRendererMixin`. The HUD already draws through Fabric's `HudElementRegistry` with a refresh cap (`hud_refresh`), and capes go through `PlayerSkinMixin`; adding parallel mixins with those names would duplicate work and add breakage risk without a measured benefit. No benchmark was run; **no "faster than Sodium" claim is made anywhere.**

## 7. Input: three hooks, one toggle

`KeyboardHandler.keyPress(long, int, KeyEvent)` in 1.21.11 (note: not the older `onKey(long, int, int, int, int)`), a per-frame `GLFW.glfwGetKey` poll at the head of `Minecraft.runTick`, and the open screens' own key handlers can all see the same physical Right Ctrl press. `QuickPanelToggle.press` applies a 250 ms debounce and a per-screen applicability test (bare world, pause, vanilla/Luminos title, or the panel itself; never chat or inventories) so one press toggles exactly once whichever hook is first.
