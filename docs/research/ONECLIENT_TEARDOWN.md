# OneClient / OneLauncher teardown (session 12)

Source studied: `github.com/Polyfrost/OneLauncher` @ `main` (commit `aa91833`, "oneclient: update to 2.12.0") and the
`archive/main` branch (the previous Tauri + SolidJS app, `apps/frontend`). Method: read the public source with the `rea`
skill workflow (map, trace, note). No decompiling, and none of their binaries were run.
**Licence:** OneLauncher is GPL-3.0-only. This document records *patterns and numbers*. No code, assets, strings or
icons were copied; Luminos code is written fresh (AGENTS.md rule 7).

## 0. Correction to the brief

The brief says `apps/oneclient`. That path does not exist on `main` any more:

| Era | Where | Stack |
|---|---|---|
| Current (2.12.0) | `packages/oneclient_*` (15 crates, workspace `resolver = 3`, edition 2024) | **Native Rust UI on Freya**, no webview at all. `oneclient_app` alone is ~111k lines of Rust |
| Archived | `archive/main:apps/frontend`, `apps/desktop` | Tauri + **SolidJS** + UnoCSS/SCSS |

So "what OneClient's web UI does" is only observable in the archive; the shipping app is native. Luminos stays on
Tauri 2 + React, a deliberate difference (small team, web design tooling, Playwright-verifiable renders).

## 1. Route structure and navigation model

Current app (`oneclient_app/src/routes.rs`, a typed `Routable` enum with four nested layouts):

```
RootLayout
 |- /                       Startup (decides: onboarding / app / relocating)
 |- /moving                 Relocating (data directory migration)
 |- OnboardingShell
 |    /onboarding  welcome > location > terms > migration > language > account
 |                 > preferences > bundle-picker > bundles > summary              (10 steps)
 |- AppShell
 |    /app                  Home            /app/clusters   Clusters (instances)   Stats, Wardrobe, Debug
 |    /app/browser          Browser, BrowserPackage
 |    ClusterShell  /app/clusters/:id  overview | logs | process | screenshots | mods | shaders
 |                                     | textures | worlds | datapacks | settings
 |    SettingsShell /app/settings/*    accounts, apis, appearance, changelog, developer, java, language,
 |                                     launcher, minecraft, storage, theme-editor
```

The archived React-era app was flatter: `/`, `/updates`, `/clusters/*`, `/browser/*`, `/settings/*`, `/onboarding/*`
with cluster tabs `overview, mods, game, logs, screenshots, worlds, settings`.

**Navigation model.** A persistent left rail inside `AppShell`. Per-instance ("cluster") pages get a second, inner tab
strip (`ClusterShell`). Settings has a 224 px (`w-56`) section sidebar with small uppercase section labels. The
instance is the unit of navigation, and **Launch is reachable from the rail, from Home and from the instance card**
(icon-only on cards, labelled on detail).

### What we match / beat
- Match: instance-centred nav, inner tab strip on instance detail, bundle picker in onboarding.
- Beat: their onboarding is 10 routes; Luminos is 4 (welcome, name/account, import, instance) and skippable.
- Beat: the skins page states where each skin is visible (Luminos players / authlib servers / bridge / Mojang).

## 2. Layout primitives and component inventory

Archived web build (`ui/components`): `WindowFrame`, `Navbar`, `Sidebar`, `ScrollableContainer`, `SettingsRow`,
`AnimatedRoutes`, `LaunchButton`, `Spinner`, `ErrorBoundary`; `base/` = Button, Checkbox, Dropdown, FilePicker, Link,
SelectList, Tag, TextField, Toggle, Tooltip; `game/` = **ClusterCover**, LoaderIcon, PlayerHead, WorldIcon;
`overlay/` = ContextMenu, FullscreenOverlay, Modal, Popup, account/*, cluster-creation wizard (provider, game setup,
import), notification stack.

Current native app adds (from `components/`): `home_stack`, `recents_row`, `active_cluster_panel`, `control_center`,
`splash_curtain`, `dynamic_art`, `version_art_gallery`, `version_card`, `player_model` (3D), `charts`,
`segmented_control`, `pill_switch`, `progress_track`, `status_bar`, `bundle_choices_popup`,
`bundled_install_warning`, `incompatible_install_popup`, `flagged_install_popup`, `disable_dependents_popup`,
`package_update_popup`, `release_migration_popup`, `screenshot_viewer`, `log_viewer`, `upload_mclogs`, `lobby/*`
(party chat), `context_menu`, `date_range_picker`, `color_picker`, `file_drop`.

Takeaways:
1. **Art is a first-class primitive** (`ClusterCover`, `dynamic_art`, `version_art_gallery`). Every instance has a cover,
   with a linear-blur legibility ramp (a `backdrop-filter: blur()` masked by a `linear-gradient`, then a black ramp to
   85 %) so text sits on the picture. We used text cards. Fix: real covers plus the same legibility idea.
2. Safety popups are first-class (incompatible install, flagged install, disable-dependents, bundled-install warning).
   Luminos' dependency solver already has the logic; the UI should surface it as plainly.
3. Theme = RGB triplets in CSS variables (`--clr-fg-primary: 213,219,255`, brand `43,75,255`) so alpha composes
   (`rgb(var(--clr-brand) / .5)`), each colour with `-hover / -pressed / -disabled` siblings: a full state set.

## 3. Motion

Measured from source:

| Thing | Value | Notes |
|---|---|---|
| Page transition (archive) | `translateX(-85px) -> 0` + opacity, **250 ms**, `mode="outin"` | One direction regardless of navigation direction. Linux (WebKitGTK) multiplier **0.36** because it janks |
| Modal / notification enter-leave | opacity **160 ms**, transform **175 ms**, `cubic-bezier(0.16, 1, 0.3, 1)` | an ease-out-expo-like curve |
| Theme change | colour/border/background **400 ms** | only those properties, never `all` |
| Reduced motion | durations forced to `0.00001ms`, plus a `disable_animations` setting | native app: `AnimationClock.disable()` driven by `animations_enabled` |
| Launch button | 300 ms debounce; disabled while a process runs unless parallel launching is on | prevents double launches |
| Native outlet (`animated_outlet.rs`) | `Ease::Out`; enter kinds (`Up`, `None`); chrome opacity separate from content offset | chrome fades, content slides |
| File watch / drop settle | 400 ms quiet, 300 ms settle | debounces so lists do not flicker |

**What makes it feel responsive:** short (150-250 ms) ease-out only, no bounce on utility surfaces; chrome stays put while
only content moves; debounced inputs; process state mirrored onto the button; query hooks (`hooks/queries/*`) so lists
render from cache and refresh behind. I found no stagger in what I read.

### What Luminos does
- Same ease-out family (`cubic-bezier(.16,1,.3,1)`); 160-240 ms utility, 320-560 ms hero.
- **Direction-aware** transitions (theirs are single-direction): slide follows rail order, back reverses.
- **Stagger** 28-40 ms per row, capped at 8 rows.
- Launch button is a 4-state morph (Ready, Preparing, Launching, Running) driven by real process events.
- Spring-damped 3D viewer, chart draw-ons, dither sky that pauses when the window loses focus.
- Reduced motion: OS media query **and** an in-app switch (persisted), both honoured.

## 4. How the client is configured from the launcher

Observed structure (crate `oneclient_content::bundles`, public API surface only):

- A **bundle** is a *remote manifest* (`RemoteBundleManifest`, fetched from Polyfrost's metadata host) listing files with
  kinds/types, per-package *optional* flags, additions/removals/updates between releases, and **overrides** (config files
  dropped into the instance: `bundle_override_paths`, `extract_bundle_overrides_for_cluster`).
- Per instance the user can enable/disable each package, opt in to optional ones, remove one, or pin an override
  (`set_bundle_package_enabled / _opt_in / _override / _removed`). A choices popup resolves *pending optional mods*.
- Updates are diffed (`check_bundle_updates`, `apply_bundle_updates`, with a time budget). Artifacts shared by several
  instances are reference-counted (`clusters_sharing_artifact`, `delete_artifact`).
- Launcher settings live in SQLite (`oneclient_db`) with **settings profiles** (`hooks/queries/settings_profiles.rs`);
  `hooks/queries/wardrobe.rs` + `player_model.rs` handle skins with a 3D preview.
- Known-bad lists (`bad_mods.rs`, `bad_modpacks.rs`, flagged-install popup) block problem files by identity hash.
- Cloud sync of settings (`actions/cloud_sync.rs`) and share codes (`share.polyfrost.org/ABCD-EFGH`) for instances.

**What I could not verify.** The actual per-version bundle contents are remote, and the guessed metadata path returned a
CDN 404 page. Source and test fixtures mention EvergreenHUD, VanillaHUD, PolySprint, Chatting, Redaction, PolyBlur,
CrashPatch, Sodium (+Extra), Lithium, FerriteCore and ImmediatelyFast by name, which matches the brief. I found **no**
mention of Entity Culling, Controlify, Simple Voice Chat, PolyTime, PolyWeather or PolyNametag in the launcher source,
and the "~40 HUD elements" figure comes from the brief, not from anything I read. Treat those as unconfirmed.

### What Luminos matches and beats
| Area | OneClient | Luminos |
|---|---|---|
| Performance mods | Sodium, Lithium, FerriteCore, ImmediatelyFast (+ Sodium Extra) | same family + Entity Culling, resolved per Minecraft version by the Fabric dependency solver, hash-checked against Modrinth |
| HUD | EvergreenHUD as a separate mod | built in: modules in one jar, one config, drag editor with snapping |
| Config path | remote bundle + per-instance overrides | `client-compat.json` (jar pins) + **launcher-owned sync** of keybinds/options/HUD/server list across instances |
| Cosmetics | wardrobe + cloud service | Cosmetics tab in the in-game panel, live swap, explicit visibility matrix |
| Title screen | vanilla | Luminos screen (dithered sky, instance, splash) |
| Compliance | none seen | per-server compliance mode: advantage-capable modules switch off |

## 5. Client-side conventions: Wurst and Meteor

Public documentation conventions (not code):

| Client | Open menu | Secondary |
|---|---|---|
| Wurst | **Right Ctrl** opens the ClickGUI | **Right Shift** opens the Navigator (searchable feature list) |
| Meteor | **Right Shift** opens the GUI | `.` command prefix |

Luminos follows the **Wurst split**, with none of their modules (no cheats):
- **Right Ctrl** = Quick Panel (the ClickGUI analogue). Rebindable in the panel's Keybinds tab.
- **Right Shift** = open the panel focused on search (the Navigator analogue).
- Never opens while chat, a container, a text field or any other screen is open (checked in the key handler, not just
  `currentScreen == null`).
- Modules are grouped in tabs; every module has a toggle, settings and a visible keybind.

## 6. Decisions that follow

1. Keep Tauri 2 + React; port nothing from OneLauncher's UI. Take the ideas: cover art with a legibility ramp, per-state
   colour tokens, chrome-stays/content-moves transitions, debounced launch mirrored to process state.
2. Improve on them: direction-aware transitions, stagger, 4-state launch morph, honest skin-visibility matrix.
3. Client: one jar per Minecraft version, pinned and hashed in `client-compat.json`; panel on Right Ctrl.
4. Do not claim parity on bundle contents until the remote manifest can be read; our own list is audited per version
   from Modrinth (`docs/SUPPORTED_VERSIONS.md`).
