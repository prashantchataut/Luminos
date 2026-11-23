# AUDIT: what exists, what actually works (Session 6)

Method: built `luminos-core`, `luminos-app` and the new `luminos-auth` from source in a Linux sandbox (2 cores, 1 GB RAM, no GPU, no display, no Windows, no Android SDK), ran every test, rendered the real UI headlessly with `luminos-shots`, and ran a real vanilla Minecraft 1.21.4 server (JRE 21).
"Works end-to-end" means I ran it and have output. Where I could only compile or unit-test it, it says so.

Legend: ✅ verified by running · 🟡 code exists, compiled/unit-tested only · ❌ missing

## Baseline before this session (found, not assumed)
- 22 core unit tests passed. The UI built and rendered 18 screens. The servers page showed demo data only: no favourites, no login-mode detection, no direct connect.
- Account types: Offline only (the Microsoft engine existed but was not wired). No Yggdrasil, no authlib-injector.
- The client installer fetched the newest `client-v*` jar for **any** Minecraft version. That is the cause of the "requires ~1.21.4 but 26.3 present" crash.
- Motion: only the dither strip at the top of each page. No tokens, no transitions.

## Table (state at the end of this session)

| Feature | Exists? | Works end-to-end? | Proof | Gap |
|---|---|---|---|---|
| **P0-A Multiplayer** | | | | |
| Offline account, vanilla `OfflinePlayer:<name>` UUID | ✅ | ✅ to protocol level | `accounts::tests`, `luminos-auth` conformance and Yggdrasil E2E assert the same UUID as Java's `nameUUIDFromBytes` for `Notch` | Only one Java-sourced vector. Add more from a JVM in CI. Not joined with the full game client. |
| Microsoft account | 🟡 `msauth.rs` (device code → XBL → XSTS → MC) | ❌ | pure parts unit-tested | Not wired into UI or launch; never run with a real account; needs an Azure app id (owner action). The sign-in panel says so. |
| Ely.by account | 🟡 | 🟡 | Client code + sign-in form compile and render; Ely's authlib-injector root answers HTTP 200 | Never signed in with real Ely.by credentials. Launch with the injector never run in a real game. |
| Luminos account | ✅ client ↔ server | 🟡 | `tests/yggdrasil_e2e.rs`: register, login, wrong-password message, validate, refresh, javaagent arg, over real TCP | Game launch via injector not run. No hosted instance exists (`LUMINOS_API_ROOT` is a placeholder constant). |
| `luminos-auth` (axum Yggdrasil) | ✅ | ✅ | 9 conformance tests: metadata, register, authenticate, refresh kills old token, validate, invalidate, signout, join/hasJoined, RSA-SHA1 signature verified against published key, textures, bulk lookup, lockout after 5 failures | JSON-file persistence; tokens in memory; no per-IP rate limit; no email verification; not load-tested; not deployed. |
| authlib-injector injection | ✅ code | 🟡 | jar pinned (v1.2.8, SHA-256 `9c7f43…7b10`, verified on download); `-javaagent:` placed before `-cp` | Never run inside a real game session. |
| Server list: favourites, ping, MOTD, version badge | ✅ | ✅ render, ✅ ping | `docs/screenshots/16-servers.png` (demo data, fictional hosts); ping verified against a live vanilla server | Pinning an instance per server has a data field but no UI yet. |
| "Needs online-mode" detection + human message | ✅ | ✅ | `server-login-test.sh 1.21.4`: offline server → `OfflineOk`, online server → `OnlineRequired`; plus 6 unit tests incl. whitelist/ban/version | Modern-forwarding proxies can't be pre-checked (reported as such). |
| One-click join for offline servers | 🟡 | 🟡 | pre-flight runs before launch and blocks only when the server clearly refuses the account type | `--quickPlayMultiplayer` never run in a real game. |
| Direct connect | 🟡 | 🟡 | UI renders | Same as above. |
| LAN discovery + "Host a world" relay | ❌ | ❌ | | Not built. Evaluation only: `docs/MULTIPLAYER.md`. |
| `luminos://join` invite links | 🟡 | 🟡 | build/parse round-trip and 8 hostile-input rejections | The OS URL-scheme handler is not registered, so clicking a link does nothing yet. |
| In-launcher server directory | 🟡 core only | ❌ | `directory.rs`: filters, dead servers never listed, report URL | No UI page. `server-directory.json` is empty, so there is nothing to show yet. |
| Headless client vs local offline server | 🟡 | 🟡 | Protocol-level handshake and login against a real vanilla server. The server log shows the player connection | This is **not** the real Minecraft client. A full-game version is blocked on the headless-launch CI in P0-D. |
| **P0-B Skins and capes** | | | | |
| Skin library, username fetch, 64×64 editor (pencil/eraser/fill/picker/undo) | ✅ (session 1) | 🟡 | `docs/screenshots/10,11` | Not re-verified this session. |
| 3D viewer with animations, URL import, drag-drop, folders/tags, mirror/layers, recolor | ❌ | ❌ | | Not started. |
| Capes tab, Mojang capes, animated capes | ❌ | ❌ | | Not started. |
| `luminos-cosmetics` service | ❌ | ❌ | | Design and cost only: `docs/COSMETICS_SERVICE.md`. |
| In-game skin/cape switcher | ❌ | ❌ | | Not started. |
| **P0-C Client for 5 versions** | | | | |
| Client mod | ✅ 1.21.4 only | 🟡 | jar `0.2.0` builds in CI; metadata `minecraft ~1.21.4` | Never launched in a real game by me. |
| Multi-version build (Stonecutter/Loom) | ❌ | ❌ | | Not started. The sandbox has JRE 21 only (26.x needs a newer JDK) and 1 GB RAM. |
| Choice of 5 versions | ✅ doc | ✅ data | `docs/SUPPORTED_VERSIONS.md`; Fabric loader and all 7 performance mods confirmed on Modrinth for every candidate | Decision only, nothing built. |
| `client-compat.json` + resolver + hash verify + vanilla fallback | ✅ | ✅ unit | `compat.rs` (4 tests); `preset::install_first_party` now resolves through it. Verified: 26.3 → "doesn't support Minecraft 26.3 yet (supported: 1.21.4)" | Needs a live end-to-end run with a real instance. Only 1.21.4 is listed. |
| Performance stack from Modrinth | ✅ (session 1/4) | ✅ for 1.21.4 | session-4 notes: 28-mod preset boots to graphics init | Other versions: availability confirmed, install not run. |
| Per-version feature matrix, utility wheel, HUD editor | 🟡 HUD editor + modules on 1.21.4 | ❌ | | Utility wheel does not exist. |
| **P0-D Tests / CI** | | | | |
| Unit tests: resolution, launch args, Java, UUID, compat, Yggdrasil | ✅ partly | ✅ | **54 passed, 0 failed, 9 ignored** (live/network/game) | Mod dependency resolution and Java selection have few tests. |
| Smoke test per version (xvfb + llvmpipe, `title_screen_reached.json`) | ❌ | ❌ | | Needs the client test hook and the multi-version client. Not started. |
| Windows installer test (silent install, no console windows, single instance, uninstall, upgrade) | ❌ | ❌ | | No Windows runner here. Not started. |
| Server login test in CI | ✅ script | ✅ locally | `tools/ci/server-login-test.sh`; `.github/workflows/tests.yml` runs it | CI run not yet observed. |
| Code signing | ❌ | ❌ | `docs/WINDOWS_SECURITY.md` | Needs owner purchase or application. |
| **P0-E Motion** | | | | |
| `docs/MOTION.md` spec | ✅ | n/a | | |
| Tokens (durations, easings, springs, stagger, reduced motion) | ✅ | ✅ | `motion.rs`, 4 unit tests: spec durations, monotonic easings, springs settle at 30/60/144 fps and a 250 ms hitch, reduced motion | |
| Applied in UI | 🟡 | 🟡 | Staggered row fade on the Servers page; honours "Reduce motion" | Everything else in the motion list is not built. No GIFs. No frame profiling. |
| Animated dithered sky inside the app | 🟡 | 🟡 | Existing animated Bayer strip behind page headers (setting + reduce motion exist) | No moon/clouds/stars; no pause on blur. |
| **P1 Android** | ❌ | ❌ | `docs/android/DESIGN.md` | Design only. No code, no APK. |
| **Recommendations** | | | | |
| mrpack import · world backups · crash doctor · JVM flag tuner | ✅ (earlier sessions) | 🟡 | unit tests | |
| Compat-manifest hash verification (malware-safe client install) | ✅ | ✅ unit | `compat::install` deletes the file on mismatch | |
| Everything else (Ctrl+K, RPC, share codes, cloud sync, i18n, …) | ❌ | ❌ | | Skipped. |

## Skills
I did not install or invoke the named external skills (taste-skill, ui-ux-pro-max, Reanimate, rea, platform skills). This environment has no skill runtime, and I did not verify their links. The rules I applied by hand:
- Anti-slop pass on the Servers screen, done on the real render. It found the badge row colliding with the Join button, which I fixed. The state badges are text, not colour alone.
- Motion rules from the brief (tokens, transform/opacity only, reduced-motion respected) are encoded in `motion.rs` and `docs/MOTION.md`.
- No teardown of SKLauncher, TLauncher, Lunar, OneClient, Feather, Pojav or Prism was done this session.
