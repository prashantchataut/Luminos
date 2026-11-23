# OneClient parity (target: match every feature, then beat it)

Source of the checklist: owner screenshots + polyfrost.org/projects/oneclient + OneLauncher UI-string census (`.agents/context/research/onelauncher-teardown.md`).
Rule: tick only when it works in a real game or real launcher run. Status: [x] works (evidence given) · [~] partial · [ ] not started. All implementations are original; reference code is GPL.

## Launcher shell
- [~] Home hero + big Launch + settings sliders (hero exists; needs real cover art and the state-morph button) - session 10
- [ ] Version carousel with real cover art and selected outline - session 10
- [x] Instances, Library, Discover (Modrinth), Servers, Skins, Playtime, Settings pages (exist since 0.2-0.4)
- [x] Auto-update in the launcher: check, verify SHA-256, silent install (0.5.0; unit-tested, install path not yet run on a real PC)
- [x] Storage page: usage by area, free up cache/logs, reset launcher data (0.5.0)
- [ ] Notifications bell, account switcher with 3D bust, window controls polish
- [ ] Settings: GPU choice, wrapper command, pre-launch/post-exit commands, game args, resolution presets
- [ ] Tray icon / run in background / start maximized / open game log on launch / Discord RPC
- [ ] Launcher data folder mover
- [ ] Import from other launchers (Prism, TLauncher, official, Modrinth App)
- [ ] Cloud sync (needs backend; session 14+ at earliest)

## Content
- [x] One-click preset install (Sodium, Lithium, Entity Culling, FerriteCore, ModernFix, ImmediatelyFast, MoreCulling, Dynamic FPS, Krypton, Sodium Extra)
- [~] Optional mods checklist at onboarding (Resourcify, Iris, Zoomify, 3D Skin Layers, Wavey Capes...) - Resourcify added 0.5.0
- [ ] Per-version bundle choice at onboarding; content downloaded at first launch
- [ ] Disable-dependents warning; incompatible/flagged install popups
- [ ] Mod bisect wizard
- [ ] Crash dialog with mclogs upload
- [ ] Datapack tab, screenshot viewer, worlds tab polish
- [ ] Shared content cache

## In-game (Luminos Client, Fabric)
- [~] HUD modules: armor, keystrokes, CPS, FPS, coords, potions, sprint status (1.21.4 only)
- [~] HUD editor, mod menu (1.21.4 only)
- [ ] Global search (Ctrl-K) in the in-game menu
- [ ] Profiles, keybinds page, themes, cosmetics tab, changelog/credits
- [ ] Original equivalents of: Chatting (chat tools), CrashPatch, DamageTint, OverflowAnimations (1.8 swing), PolyBlur (motion blur), PolyTime, PolyWeather, PolyHitbox, PolyNametag, PolySprint, Zoom, OverflowParticles/ParticleGlow, Overlay Tweaks, Simple Block Overlay, Better Screens, Spoty-style widget, Better Grass
- [ ] Built-in pack/shader/datapack browser (Resourcify-class), toggleable
- [ ] Quickplay dropdown with server cards; Host World wizard; Social; 3D skin on main menu
- [ ] Last 5 Minecraft versions (Stonecutter)

## Accounts / skins / cosmetics
- [x] Offline accounts with real offline UUID; Microsoft device-code code exists, needs an Azure app id (owner)
- [x] Offline skin + cape visible to yourself in game via embedded skin server (0.5.0; unit-tested; **not yet observed in a running game**)
- [x] Original Luminos skins (4) + original Moon cape (0.5.0)
- [ ] Others see your skin on offline servers (client mod D4 + Skins Bridge C7)
- [ ] Wardrobe categories: aura, back, boots, cape, emotes, glasses, glove, hat, pet, shoulder, wings (original free set)

## Performance
- [~] Sodium-class stack is installed by default; **no Luminos FPS numbers measured yet**. OneClient publishes self-reported numbers (Sept 2026); we publish only CI-measured ones.
