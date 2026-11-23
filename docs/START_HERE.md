# START HERE (session 12 handover)
Branch `feat/session-12-premium-app-and-client`, PR #12 (open, **not merged, no v0.7.0 tag**: the release criteria below are not all true).
Previous release: v0.6.0. Client jars `client-v0.3.0` are still the pinned ones in `client/client-compat.json` (0.4.0 jars are built by CI but not published or pinned).

## VERIFIED (I saw it run, or CI proved it)
| Thing | Evidence |
|---|---|
| Skills installed, listing committed | `docs/design/skills-ls.txt` (`ls -R .agents/skills`), `.agents/skills/PROVENANCE.md`. New: hallmark, emil-kowalski-skills, ibelick-ui-skills, ui-design-skill. **UI Hall: no public repo found, not installed.** |
| OneClient teardown | `docs/research/ONECLIENT_TEARDOWN.md`. Finding: `apps/oneclient` no longer exists; OneClient 2.12 is a native Freya app, the Tauri/Solid UI is on `archive/main`. Bundle contents are remote; several named mods could not be confirmed (stated in the doc). |
| Client 0.4.0 compiles on 1.21.11 and 26.3 | `client.yml` green on the final client commits |
| Quick panel renders in real Minecraft on both lines | smoke run 45218709862: `docs/design/ingame/panel-*.png`, `panel-keys-*.png` |
| Luminos title screen renders in real Minecraft (26.3 and 1.21.11) | `docs/design/ingame/title-*.png`: all six items, instance name, version |
| Headless launch to title screen, default preset, no Fabric incompatibilities, 26.3 and 1.21.11 | smoke run 45218709862, `pass:true` on both |
| CI screenshot capture (was broken in session 11) | root cause: `xvfb-run` hides the display behind an Xauthority cookie. Fix: manual `Xvfb -ac`, ack handshake, 8 s frame wait |
| Real per-version cover art, from CI | `app/public/covers/26.3.jpg`, `1.21.11.jpg` (blurred by vanilla's menu blur, UI-free) |
| Launcher-level sync (code) | `luminos-core/src/sync.rs`, 4 unit tests. Passed on Ubuntu except one test I had written wrong; fixed twice (policy and OS-dependent `read_dir` order). **Check PR #12's latest `tests` run before trusting this line.** |

## UNVERIFIED (written, compiled, not proven)
- Right Ctrl actually opening the panel from the in-world view. CI opens it through the API from the title screen; the key path (`mc.player != null`, no screen) was never exercised. Needs a world: use `--quickPlaySingleplayer` in a smoke job.
- HUD editor snapping/guides (compiled only; no screenshot), profiles, compliance mode, toggle sprint, zoom, the 8 new modules in a world (preview data only).
- Sync inside the real launch path (`spawn_ext` + Tauri `launch_instance`) and the Tauri commands `sync_run/export/import`; the app build job result for these was not inspected.
- Release signing step (`release.yml`): never run with credentials; YAML only validated by CI parsing.

## NOT DONE (do not assume)
- **v0.7.0, clean-machine test extension** (single-instance, no console windows, uninstall leftovers) , the Windows runner still only installs, launches and measures.
- **5 supported versions, Stonecutter, auto-generated `client-compat.json`**: only 26.3 and 1.21.11 are built. No 1.21.4/26.1.2/26.2 jars, no covers for them.
- **Forge/NeoForge launching and smoke tests. Microsoft device-code login in the UI. Skins Bridge plugin and the two-client offline-server test. `luminos://` handler, LAN discovery.**
- In-game: live skin/cape swap (panel lists skins, selection persists, applies on next join), freelook and hit colour (shown disabled with a reason), cosmetics rendering of other players, benchmark button, per-hardware JVM presets.
- UI: only home, instances, client have reviewed rounds. Reanimate spring damping on the viewer, chart draw-ons, dithered sky pause-on-blur: not built. Old egui UI **not deleted** (parity unproven).
- Screenshots/GIFs for: keybind sync across two instances, Microsoft account connected, skin between two clients.

## Exact next steps
1. Read PR #12 checks. Fix anything red (sync tests, Windows build with the new Tauri commands).
2. Smoke job: add a world step (`--quickPlaySingleplayer`), press Right Ctrl with `xdotool`, capture; same for the HUD editor.
3. Cover blur: draw the panorama without the menu blur (per-version call), then add 26.2/26.1.2/1.21.4 builds.
4. Wire MS device-code into the Tauri app; Forge/NeoForge from installer metadata.
5. Review-and-change loops for servers, skins, mods, settings, onboarding. Then delete `launcher/crates/luminos-app`.

## Security
The GitHub PAT pasted into chat (scopes included `repo`, `workflow`, `admin:repo_hook`, `delete:packages`, `write:packages`) **must be revoked**; this is the sixth time. It was kept in a `chmod 600` file in the sandbox and removed at the end. Use a fine-grained token limited to this repo.
