# START HERE (handover written at the end of session 9)

You will not remember anything. Read in this order: this file, `.agents/context/OWNER_CONTEXT.md`, `.agents/context/REFERENCES.md` (owner's reference list, kept low-key on purpose), `docs/PLAN_SESSIONS.md` (sessions 10-14 are already planned), `docs/ONECLIENT_PARITY.md`, `docs/LEDGER.md`, `CONTINUITY.md`, `AGENTS.md`, `docs/BRIEF.md`.

## Shipped (releases)
| What | Release | Verified how |
|---|---|---|
| **Windows launcher 0.5.0** (installer, portable exe, linux tarball, SHA256SUMS; unsigned) | https://github.com/prashantchataut/Luminos/releases/tag/v0.5.0 | Built by `release.yml`. Downloaded `Luminos-Setup.exe` (5,127,856 bytes): SHA-256 `81cd4f61...c6645` equals `SHA256SUMS.txt`. Ran the app's own updater code against the live API as "0.4.0": it offered 0.5.0, downloaded and verified it, and did not offer 0.5.0 to 0.5.0. **The installer has still never been run on a real Windows PC in this project's record.** |
| Windows 0.4.0 | https://github.com/prashantchataut/Luminos/releases/tag/v0.4.0 | Checksum re-verified in session 9. |
| Android 0.2.0 (APK) | https://github.com/prashantchataut/Luminos/releases/tag/android-v0.2.0 | Checksum re-verified in session 9 (APK SHA-256 matches). Built and booted on the CI emulator in session 8. **Not touched in session 9.** Minecraft does not start on Android yet. |
| Android runtimes (Java 21/25) | https://github.com/prashantchataut/Luminos/releases/tag/android-runtimes-v1 | x86_64 booted in CI; aarch64 never run. |
| Client mod | `client-v0.2.0` | 1.21.4 only. |

## What session 9 did
Research (all written down): `.agents/context/research/onelauncher-teardown.md` (OneLauncher architecture + 2,695 UI strings mapped to features + OneClient mod list), `docs/research/offline-skins-and-multiplayer.md` (how HMCL / PCL-CE / Zalith / SkinsRestorer / authlib-injector really work, with sources), Resourcify licence (LGPL-3.0) and Modrinth availability, Polyfrost licences (GPL/AGPL: behaviour only).
Built in 0.5.0 (see `docs/RELEASE_NOTES.md`): auto-update, storage + data reset, honest username check, offline skin + cape server, 4 original skins + Moon cape (new default skin), Client page (launcher and client edit one config), optional mods (Resourcify, Iris, Zoomify, Controlify, Status Effect Bars; slugs checked live), real About text, spacing fix in setting rows. 10 new unit tests; 59 core tests pass; CI (3 OSes) green.

## Owner complaints -> honest status
| Complaint | Status |
|---|---|
| UI/UX "AI slop", onboarding bad, home looks like a demo | **Not solved.** Only incremental fixes (skin art, spacing, Client page, username step, storage/update sections). The shell redesign (top nav, real cover-art carousel, state-morph launch button, 4-step onboarding) is session 10. |
| Ugly default skin | **Done**: original skins, new default. Not downloaded from skin libraries on purpose (third-party skins have no clear licence). |
| Skins not shown in multiplayer | **Partly.** Your own view: offline skin server (unit-tested, **not seen in a running game**). Others' view needs D4/C7 (plan session 12). |
| Username "is it real?" | **Done honestly**: format reasons + premium-name lookup; offline names are never "taken". |
| Game doesn't start | **Not proven fixed.** Needs a Windows CI job that launches to the title screen (session 10 first task). The skin server falls back to a plain offline launch on any error. |
| No auto update / clear data / update tracker | **Done** (update tracker = Updates card + Home banner). |
| Launcher and client should be one | **v1**: shared config + Client page + optional mods. In-game menu parity is session 11. |
| Resourcify-class built-in pack browser | **Interim**: Resourcify installable/toggleable from the Client page. Own optimised browser = session 11. |
| Store-style cosmetics, free + original | Cape + 4 skins now; full categories = session 12. |
| FPS faster than OneClient | **Unmeasured.** Same lever (Sodium stack) is default. `docs/PERF.md` with CI numbers is session 10. |
| Cover art from real in-game captures | Not done (session 10). |
| Android (engine, UI, controls) | Not advanced this session. |
| Use every skill | Honest: skills were read (taste-skill, reanimate, rea, ui-ux-pro-max headers; kotlin/fabric not needed yet). They target web stacks (Bun/Playwright), so rules were applied by hand to egui; the reanimate spec-table method is planned for the launch-button morph in session 10. No design skill was run as a tool. |

## What works / what does not
Works: everything in 0.4.0 plus the 0.5.0 list above. Does not: see the table. Unsigned installer (SmartScreen). No Microsoft sign-in (needs an Azure app id). No `luminos://` handler, relay, cosmetics service, multi-version client, motion beyond tokens.

## Exact next steps (session 10, in order)
1. Windows CI job: install `Luminos-Setup.exe` silently on windows-latest, launch vanilla 1.21.4 with an offline account **with the skin server on** to the title screen under software GL, assert the log. Fix every failure. (Closes K8, answers "game doesn't start".)
2. `docs/PERF.md`: cold start, idle RAM, installer size measured in CI.
3. Shell redesign per `docs/PLAN_SESSIONS.md` session 10, rendering with `luminos-shots` and looking at every PNG.
4. Cover-art capture job, then use it on cards.
5. Tag `v0.6.0`, verify checksum, update this file.

## How to work here
- The agent sandbox is a tiny React scaffold. Clone the repo to `/home/user/luminos` and push with a one-off header: `git -c http.extraheader="Authorization: Basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)" push ...`. Never write the token anywhere.
- The file tools only reach the sandbox root: `ln -s /home/user/luminos /home/user/sandbox/lum`, edit via `lum/...`, remove the link at the end (and view images by copying PNGs into the root).
- Rust: install with rustup (works), `cargo build -j2` with `CARGO_INCREMENTAL=0`; first build ~7 min, then ~10 s. `luminos-shots <dir>` renders every screen. Workflows run on PRs and main, not on feature branches: open a PR to get CI, merge by API, tag by API (`POST /git/refs`) to trigger `release.yml`.
- rustfmt is not installed in the sandbox (`rustup component add rustfmt` if needed; CI fmt is non-blocking).

## Owner actions needed
- **Revoke the GitHub PAT pasted in chat** (third time). It has very broad scopes (repo, workflow, write:packages, delete:packages, ...). Use a fine-grained token limited to this repo.
- Windows signing (`docs/WINDOWS_SECURITY.md`), Azure app id for Microsoft sign-in, an Android release keystore.
- The repo is public: `.agents/context/` is obscure, not private. Make the repo private if the reference list must be hidden.
