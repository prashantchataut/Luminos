# START HERE (session 11 handover)

Branch `feat/session-11-ship-0.6.0`, PR #11. Release: https://github.com/prashantchataut/Luminos/releases/tag/v0.6.0 ·
client jars: https://github.com/prashantchataut/Luminos/releases/tag/client-v0.3.0

## What shipped (and how I know)
| Item | State | Evidence |
|---|---|---|
| The title-screen CI gate was fake | Fixed | The old job piped the harness through `tee` without `pipefail`, so it was green while `result.json` said `pass:false, title_screen:false`. Now `set -o pipefail`; a bounded screenshot loop; a 420 s cap. |
| Why the game never reached the title screen | Found, fixed | Thread dumps showed the render thread alive (not a deadlock). A fresh profile shows the accessibility onboarding screen first; nobody clicks it in CI. The harness now writes `options.txt` (`onboardAccessibility:false`, no vsync). |
| Default preset on 26.3 and 1.21.11 | **Pass** | Run 45203535259: both `pass:true`, no incompatibilities (27 s, 40 s). `docs/perf/smoke-*-result.json`. The job fails the build if either fails. |
| Fabric/jar fixes | Done | Dependency solver (11 unit tests, session 10) is used on install and before launch. Removed the dangling `modmenu` entrypoint from both jars. |
| Client jars | Published | `client-v0.3.0`: `~26.3` and `~1.21.11`. Pinned (URL + SHA-256) in `client/client-compat.json`. |
| Windows build | **Works** | `release.yml`: Tauri NSIS build, silent install, launch, screenshot (`docs/perf/windows-installed-app.png`). The Rust backend had never been compiled; it built first time on Linux and Windows. |
| Perf | Measured | `docs/PERF.md`. Installer 2.25 MB (met). Warm start 0.4-0.5 s (met). **First launch ever 6.7 s (missed).** Idle 333 MB working set / 110 MB private. |
| Real-app bug | Fixed | Nothing called `create_instance`; a fresh install would have crashed Home. Onboarding step 4 now runs the engine; Home has a first-run screen. |
| UI | Improved | Real Modrinth icons + counts, direction-aware transitions, persisted Animations switch, cover parallax, Home fold fixed. `docs/design/rounds/`, `CRITIQUE.md`. |
| Skills | Installed | `docs/design/skills-ls.txt` (`ls -R .agents/skills`). Added morluto/rea, anthropics frontend-design/webapp-testing/theme-factory, vercel web-design-guidelines/react-best-practices/composition-patterns. |

## What did NOT get done (read this)
- **Three reviewed rounds per screen: met only for home and onboarding (welcome, name).** Instances and Mods have two. Skins, servers, client, settings and onboarding-import were re-rendered unchanged in round 3 and not meaningfully reviewed. `CRITIQUE.md` has the table.
- **Real in-game cover art: not delivered.** The smoke job's `import -window root` produced no PNG on either version (cause not found; errors were silenced). Covers are still generated dithered scenes. Fix: capture with `xdotool`/`scrot` or Minecraft's own screenshot key, and log stderr.
- **UI Hall skill: not found** (no public repo located). The skills.sh / skill-issue.in / open-design.ai catalogues were not browsed.
- Reanimate spring damping on the 3D viewer and chart draw-ons: not built (CSS turn only). Launch button morph exists in the UI against seeded data; its live playtime was not tested against a real game process.
- **The old egui UI is not deleted.** The new app was installed, launched and painted on Windows, but I did not drive it (no Play-to-game test from the Tauri app, no instance install through the UI). Parity is not proven, so the brief's "delete only after parity" is not satisfied yet. `release.yml` no longer builds it.
- Home badge row over the moon fails text contrast. Microsoft sign-in, launcher import detection, licence enforcement for skin import: still UI-only.
- 3D skin/cape server and cosmetics render as before; cosmetic categories beyond four skins and the Moon cape are placeholders.

## Exact next steps
1. Fix the cover capture, commit `app/public/covers/*`, wire `Cover` to use them (day/night/cave later).
2. Add a Windows CI step that drives the installed app (WebView2 `--remote-debugging-port` + Playwright `connectOverCDP`): create instance, press Play, wait for the title screen. When that is green, delete `launcher/crates/luminos-app`.
3. First-launch cost: native splash and explicit WebView2 data dir; re-measure.
4. Finish rounds 3+ for skins, servers, client, settings, onboarding-import; fix the badge contrast.
5. Spring-damped viewer and draw-on charts with Reanimate; then browse the three skill catalogues.

## Security
**Revoke the GitHub PAT pasted in chat (fifth time).** It was used through one-off HTTP headers and a `chmod 600` temp file outside the repo, deleted at the end. Use a fine-grained token or `gh auth login`.
