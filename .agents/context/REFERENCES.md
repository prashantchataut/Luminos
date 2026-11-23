# Reference library (owner-supplied; re-read at the start of every session)

Kept in `.agents/context/` so it is not front-and-centre. **The repo is public, so this is obscurity, not privacy.** No tokens here, ever.
Licence rule for everything below: *study behaviour, write original code*. GPL/AGPL code is never pasted, ported or linked into Luminos (proprietary).

| # | Reference | URL | Licence (checked via GitHub/Modrinth API 2026-11-23) | Use it for |
|---|---|---|---|---|
| 1 | Open Design skill catalog | https://open-design.ai/skills/#catalog | n/a | extra design/motion skills; install the strong ones into `.agents/skills/` |
| 2 | **OneLauncher** (OneClient's launcher) | https://github.com/Polyfrost/OneLauncher | GPL-3.0 | Teardown in `.agents/context/research/onelauncher-teardown.md`. Rust monorepo of ~20 crates + a Rust UI (`oneclient_app`) with 2,695 UI strings = a complete feature list |
| 3 | rea (reverse-engineering method) | https://github.com/morluto/rea , installed copy: `.agents/skills/rea` | MIT | Method: observe public behaviour, document, clean-room re-implement, verify before claiming |
| 4 | OneClient product page | https://polyfrost.org/projects/oneclient | n/a | Feature list + bundled mod list (see teardown). Claims: native app, one-click install, unified config (OneConfig), cosmetics store, "no private repos" |
| 5 | Polyfrost store | https://store.polyfrost.org/ | n/a | Cosmetic categories: cape, wings, hat, back, glasses, glove, boots, shoulder, pet, aura, emotes; sold as themed collections ("Redish x OneClient"). Make **our own free original** ones |
| 6 | Polyfrost org | https://github.com/Polyfrost | mixed, see table below | Settings/behaviour of each mod |
| 7 | Resourcify | https://modrinth.com/mod/resourcify (source github.com/DeDiamondPro/Resourcify) | **LGPL-3.0-only**, fabric/forge/neoforge/quilt, 26.1-26.3 | In-game pack/shader/datapack browser + updater. Luminos plan: ship *Resourcify itself* as an optional bundled Modrinth download (legal, no code copied) now; build our own optimised browser later (LGPL means we may *use* it unmodified as a separate jar) |
| 8 | Modrinth + other clients | modrinth.com, Lunar, Badlion, Feather, Prism, Fabulously Optimized | n/a | Cover art / profile imagery conventions |
| 9 | Cracked-launcher references | HMCL docs (docs.hmcl.net/launcher/offline-skin.html), PCL-CE PR #3518 (offline skin server), Zalith docs, unmojang/FjordLauncher issue #18, SkinsRestorer docs, authlib-injector docs | GPL/LGPL mix | See `docs/research/offline-skins-and-multiplayer.md` |

## Polyfrost repos worth reading (licence in brackets)
Chatting (GPL-3), CrashPatch (GPL-3), DamageTint (LGPL-3), OverflowAnimations (LGPL-3), PolyBlur (GPL-3), PolyTime (GPL-3), PolyWeather (GPL-3), PolyHitbox (GPL-3), PolyNametag (GPL-3), PolySprint (AGPL-3), EvergreenHUD (GPL-3), VanillaHUD (GPL-3), Keystrokes-Reborn (GPL-3), GlintColorizer (GPL-3), BlockOverlay (GPL-3), PolyCrosshair (GPL-3), OneConfig (NOASSERTION, docs in OneConfig-Documentation), Hytils-Reborn (GPL-3), backend (GPL-3, Rust), website (AGPL-3, Astro), BuildFormat (CC0), Branding (NOASSERTION, do not reuse their logos).

## Owner's visual taste (from the attached images, session 8)
Dithered pixel-art flower beside a serif headline; Castplay-style server page with full 3D skin renders flanking the hero and a podium of head avatars; OneClient home = full-bleed official art hero, weight-700 title, carousel of art cards; OneConfig dark glass panels, accent #2B4BFF, 12px radii, dense settings rows.
