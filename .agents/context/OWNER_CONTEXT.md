# Owner context (read at the start of every session)

Kept here, not in docs/, so it is not front and centre for visitors. **This repo is public, so this is obscurity, not privacy.**
For real privacy make the repo private. Nothing in this file is secret: it is a list of public projects and the owner's asks.
Never put tokens in this file.

## Working agreement (owner, session 8)
1. Research -> plan -> execute -> verify -> review -> only then stop. Research and planning are the main part.
2. Never start a task without loading the matching skill from `.agents/skills/` (design: taste-skill, ui-ux-pro-max; motion: reanimate; Rust: rust-best-practices; Android: kotlin-android; client: fabric-stonecutter; reverse engineering: rea). Say which skill you used in the commit message.
3. No stubs, no fake data, no buttons that do nothing. If it looks like a demo, redo it.
4. Ship at every milestone (tag a release) and keep `main` working. GitHub Actions is the real machine (Windows, ubuntu + KVM emulator). "Needs Windows / Android / a GPU" is never a reason to skip.
5. Real sources only (Mojang, Modrinth, Fabric). No ads, no telemetry. Proprietary licence stays.
6. Use Minecraft imagery for cover art: owner says every client and streamer does. Our rule: our own in-game captures (CI) or Mojang's official patch-note art, credited in `docs/ASSETS.md`, never extracted texture atlases.
7. The owner cannot answer questions. Decide, record the decision, continue.

## Licence stance on the reference projects (checked via the GitHub API on 2026-11-23)
OneLauncher, OneClient, and almost every Polyfrost mod are **GPL-3.0** (OneConfig: NOASSERTION; plus-backend/infra/AutoText/PolySprint: AGPL-3.0; DamageTint: LGPL-3.0).
Luminos is proprietary. So: **study behaviour, UX, architecture and data formats; write original code; never paste or port their source.**
"Reverse engineer" here means: read the public code and the running app to document what features exist and how they behave, then reimplement clean-room. Use the `rea` skill (morluto/rea, MIT) for method.

## References to study (each one: what to take away)
| Reference | URL | Take away |
|---|---|---|
| Skill catalog | https://open-design.ai/skills/#catalog | extra design/motion skills; install the strong ones into `.agents/skills/` |
| OneLauncher (the OneClient launcher) | https://github.com/Polyfrost/OneLauncher | feature list, instance model, mod/profile handling, home screen with per-version cover art carousel, stats, Host World/relay. Rust + web UI. **GPL-3.0: clean-room only.** |
| OneClient product page | https://polyfrost.org/projects/oneclient | every feature the owner wants in Luminos; site layout/inspiration |
| Polyfrost store | https://store.polyfrost.org/ | cosmetics categories; make **new free original** cosmetics with Luminos branding (never copy their art) |
| Polyfrost org (mods) | https://github.com/Polyfrost | Chatting, CrashPatch, DamageTint, OverflowAnimations, PolyBlur, PolyTime, PolyWeather, PolyHitbox, PolyNametag, PolyZoom, PolySprint, EvergreenHUD, VanillaHUD, ParticleGlow-style mods: read each for settings and behaviour. All GPL/AGPL except as noted above. |
| rea | https://github.com/morluto/rea | reverse-engineering skill/method |
| Resourcify (Modrinth) | https://modrinth.com/mod/resourcify | in-game resource-pack/shader/datapack browser. Owner wants an **optimised, built-in, toggleable, better** version in Luminos Client. Check its licence before reading code. |
| Modrinth + other client/launcher pages | modrinth.com, Lunar, Badlion, Feather, Prism, Fabulously Optimized | what cover art / profile imagery they use and how mod pages are laid out |
| Legacy-style cracked launchers | open-source ones (SKLauncher is closed; look at open ones such as PrismLauncher forks, HMCL, PCL) | how offline accounts, Ely.by/authlib-injector and skins are handled |

## OneClient feature checklist (from the owner's screenshots; target = parity, then better)
Launcher shell: home hero with big version title + Launch button + settings sliders icon; version carousel cards with real cover art and selected outline; top nav Home / Versions / Browse / Stats; bell, settings, avatar, window controls; rounded window with soft shadow; blurred in-game backdrop.
In-game config UI ("OneConfig"-style): sidebar (Edit HUD, Global Search / Ctrl-K, Mods, Profiles, Keybinds, Themes, Cosmetics, Preferences, Changelog, Credits, Feedback), account chip at the bottom with game version, notifications bell.
Mods page: category chips (All, Favorites, Hypixel, Performance, Visuals, HUD, Utility, Quality of Life, Combat, Other), search, grid of mod cards with icon and blue name bar when enabled, enable dot, per-mod settings page with sub-tabs (e.g. PolyHitbox: General/Player/Self/Mob/Monster/Projectile...), toggles with descriptions, segmented controls (Always/Toggled/Hovered/Never), dropdowns, colour pickers, sliders.
Themes: dark/light variants, accent colour picker, animations toggle. Profiles: named config sets. Keybinds page.
HUD Design Studio: drag/resize widgets on the live game view, size badge, lock/hide/delete, GUI scale, background, text colour/shadow, visibility per context (F3, tab list, GUIs, chat), widget modes (e.g. keystrokes Normal/Custom).
Main menu extras: Quickplay dropdown with server cards, Host World wizard (visibility: friends, game mode, difficulty, cheats, private relay, share resource pack), Social, Cosmetics, 3D skin preview on the main menu.
Mod list seen: Chatting, CrashPatch, OverflowAnimations, DamageTint, PolyBlur, PolyTime, PolyWeather, PolyHitbox, PolyNametag, OverflowParticles, ParticleGlow, Overlay Tweaks, Simple Block Overlay, Better Screens, Spoty Widget, LambdaBetterGrass.
Luminos must implement each as an original feature (client mod or launcher feature) and tick it in `docs/ONECLIENT_PARITY.md` when it works in a real game.

## Imagery the owner liked (attached images, session 8)
- Pixel-art flower beside serif headline (dithered, warm, calm): the dithered-blue site look.
- Castplay-style server landing page: skins as full 3D renders flanking the hero, podium ranking with head avatars, green dithered footer.
- OneClient launcher home: full-bleed official art hero, big weight-700 title, carousel of art cards.
- OneConfig dark glass panels, blue accent #2B4BFF, 12-px radii, dense settings rows.

## How cracked-launcher multiplayer and skins work (summary; primary sources to re-read: authlib-injector docs, SkinsRestorer docs, wiki.vg/Protocol)
- Offline account: UUID = UUIDv3("OfflinePlayer:" + name). Server with `online-mode=false` skips Mojang session verification, so any name joins. Servers with `online-mode=true` demand Mojang session auth: offline accounts cannot join and Luminos will not bypass that.
- Skins in offline mode: the client has no signed skin property to send, so other players see Steve/Alex unless the server runs a plugin (SkinsRestorer/SkinsBridge style) that looks up a skin by name and injects a signed texture property. Your own client may show a local skin; others do not see it. This is the "my skin disappears in multiplayer" complaint.
- Alternative: authlib-injector (Yggdrasil API replacement). The launcher starts the game with `-javaagent:authlib-injector.jar=<server>`; the server also runs authlib-injector so both ends verify against Ely.by or luminos-auth. Skins are then real and visible to everyone on that network. Already built in `luminos-auth`.
- Luminos plan: C7 "Skins Bridge" server plugin + D4 client mod so Luminos players see each other's skin/cape/cosmetics everywhere; D5 matrix in the UI tells users honestly where their skin is visible.
