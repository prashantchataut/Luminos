# START HERE (session 10 handover, written when the step budget ran out)

**This session did NOT finish the brief.** Branch `feat/tauri-ui-0.6.0`, PR #10. Nothing was tagged: there is no v0.6.0 and no new installer.

## What was done (and how it was checked)
| Item | State | Evidence |
|---|---|---|
| Root cause of "game doesn't start" | Found | Launcher took the newest Modrinth version of each mod (`best_version` fell back to betas): Sodium 0.9.4-beta.1 next to Sodium Extra needing 0.9.3. The Luminos Client jar declared `minecraft: ~1.21.4`, so Fabric refused it on 26.3. |
| Dependency solver `luminos-core/src/resolve.rs` | Done, unit-tested | 11 tests pass locally (`cargo test -p luminos-core --lib resolve`): Fabric SemVer predicates, nested jars, stable-only, repair by older version, optional drop with reason, `breaks`, the exact Sodium and client-jar cases. Wired into `preset::install` and into `launch::prepare` (pre-launch audit, report in `Prepared.mod_report`, setting `allow_beta_mods`). **Not yet run against live Modrinth end to end except by the CI smoke job below.** |
| Client jars | Built | `client26/` (26.3, Java 25, `~26.3`) and `client/` (1.21.11, `~1.21.11`) both build locally and in CI. Shared code in `client/src/shared`. **26.3 moved from GLFW to SDL**, so CPS is sampled per tick, not via a raw mouse hook. HUD modules, editor and config format are unchanged. Not yet run in a real game by me; the smoke job does that. |
| Title-screen CI | Written, **result unconfirmed** | `.github/workflows/smoke.yml` + `luminos-core/examples/smoke.rs`. First run: 26.3 jar job green; 1.21.11 jar job failed on a Maven Central download error (transient), re-run requested. Last status I saw: `client-jars (1.21.11, client) completed success [] | client-jars (26.3, client26) completed success [] | smoke (26.3) in_progress None [] | smoke (1.21.11) in_progress None []`. **Check PR #10 > Actions. If the smoke job is red, read its log first.** |
| Tauri 2 + React UI | Built, not shipped | `app/` (frontend, builds in 1.5 s, ~90 KB gzip JS) and `app/src-tauri` (15 commands over luminos-core). **The Rust side has never been compiled** (no webkit on the sandbox); first Windows CI build may need small fixes. Old egui UI is untouched and still the shipped one. |
| Design teardown | Done | `docs/design/teardown.md`. Finding: OneClient is now Rust/Freya, not Tauri. |
| Screens | 11 renders (round 1 reviewed, round 2 rendered but not reviewed, round 3 not done) | `docs/design/rounds/*.png`, `CRITIQUE.md`. The brief asked for three reviewed rounds per screen: **not met**. |

## Not done (be explicit)
- v0.6.0 tag, Luminos-Setup.exe from the new UI, checksum. No `release-tauri.yml` exists yet.
- Measured cold start, installer size, idle RAM: **no numbers**. Nothing was measured.
- Real in-game cover art: the smoke job uploads `title-<ver>.png`; they are not yet committed to `app/public/covers/`. The UI falls back to dithered generated scenes (honest, not captures).
- Onboarding import from other launchers: UI only; in the real app it shows "none found". No detection code.
- Microsoft sign-in (needs Azure app id). Cosmetic categories beyond Moon cape and 4 skins are labelled "In the workshop". Skin import licence check is UI copy, not enforced code yet.
- Parity: old egui UI must stay until the Tauri UI has run on Windows. Do not delete it yet.

## Exact next steps
1. Open PR #10 Actions. Get `smoke` green on 26.3 and 1.21.11 (download the `smoke-*` artifacts: `result.json`, `mod-report.json`, `game.log`, `title-*.png`). Fix what Fabric reports.
2. After a green run: tag `client-v0.3.0` (client.yml publishes both jars), then add both entries (url + sha256) to `client/client-compat.json`.
3. Add a Windows job: `cd app && npm ci && npx tauri build --bundles nsis`; fix Rust compile errors; upload `Luminos-Setup.exe` + SHA256SUMS; measure cold start (time to first paint), installer size, idle RAM, write `docs/PERF.md`.
4. Review `rounds/*-2.png`, do round 3, fix, then delete the old egui UI only after parity.
5. Tag v0.6.0 and verify the checksum.

## Working notes
- Gradle for both client lines needs **Java 25** (Loom 1.19); the 1.21.x jar still targets Java 21. Plugin ids: `net.fabricmc.fabric-loom` (26.x), `net.fabricmc.fabric-loom-remap` (1.21.x). In 26.3 screens live on `mc.gui`, `Minecraft.setScreenAndShow`, `GuiGraphicsExtractor`, `KeyMappingHelper`, `HudElementRegistry`.
- Sandbox: Playwright needs `sudo npx playwright install-deps chromium`; Pillow via `pip install --break-system-packages`. Shots: `cd app && npm run build && npx vite preview --port 4173 &` then `PW_DIR=/tmp/pw node tools/shots.mjs <round>`.
- **Revoke the GitHub PAT pasted in chat (fourth time).** It was used only through a one-off http header and never written to disk.
