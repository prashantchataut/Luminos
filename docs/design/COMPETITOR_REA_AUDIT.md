# Competitor audit (session 20)
Method: `curl` + GitHub REST API + repo tree listings, run from the build sandbox. `rea` and `agent-reach` were not installed as programs, so this is **not** a rea decompilation. Source repos: README, description, language, licence and file tree only. No source code was copied.

| Source | What was read | What Luminos took |
|---|---|---|
| polyfrost.org/projects/oneclient (HTML, 275 KB) | Feature list: UI, Themes, HUD options, Mod settings, World hosting. Performance stack named on the page: Sodium, Lithium, Entity Culling, ImmediatelyFast, FerriteCore. | Single sidebar with grouped sections, 4-column mod cards with solid status bar, theme cards, HUD studio drawer, host-world dialog. The same performance stack is in Luminos's default profile (`PICKS` in `app/src/data/launcher.ts`) plus More Culling, Krypton, ScalableLux. |
| Polyfrost/OneLauncher (Rust, GPL-3.0, 245 stars) | Tree: `packages/oneclient_app`, `_auth`, `_cluster`, `_content`, `_core`, `_db`, `_discord` | Layout and information architecture only (GPL: no code reuse). |
| Polyfrost/OneConfig (Kotlin, licence NOASSERTION, 335 stars) | README and description | Card grid, category pills, per-mod settings drawer, keybind recorder, "Edit HUD" entry. |
| Th0rgal/shard (Rust + Tauri, MIT, 86 stars) | README: global deduplicated library, declarative profiles in plain JSON, CLI | Profile page: plain JSON, id = SHA-256 of canonical JSON, one "Verify and link" action that runs the existing dedup engine and shows bytes saved. |
| ElyPrismLauncher/Launcher (C++, GPL-3.0, 1151 stars) | README: OAuth2 login (credentials never reach the launcher), authlib-injector, Ely.by official authlib patches for skins on servers | Account switcher with Offline / Ely.by / Microsoft, custom Yggdrasil URL validation, `luminos-core::authlib` (6 tests). **Not built:** the OAuth2 browser flow (needs an Ely.by client id), skin sync via Ely.by patches. |

Limits: Ankama Launcher was judged from the attached reference image, not scraped. Pixel measurements come from the supplied screenshots, not from the apps.
