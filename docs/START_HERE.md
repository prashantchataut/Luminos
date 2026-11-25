# START HERE (session 17: PR #17 rebased, NOT merged, NO release cut)

Read this first. Everything below says what was actually run.

## State
- PR #17 (`session16/locker-themes-draft`) is rebased onto main (#16) and pushed. **It is not merged. No tag, no release, site not updated.** Reason below.
- Resolution rule used: #17's `app/src` front end (Default/Lunar/Light, locker, skins) + #16's Java client, `docs`, and Rust. #16's duplicate screens/themes JSON were deleted. `package.json` = main's + `three`/`@types/three`.

## BLOCKER 1 (work this first): the 3D skin preview renders wrong
- Fixed one real bug: `applyMove` did `Object.values(rig)` on a three.js Group, which threw every frame (`position`, `uuid`... have no `.rotation`). Now it iterates the six named parts (`PARTS` in `app/src/locker/pets.ts`).
- After the fix there are 0 page errors, but the headless capture is **still visibly wrong** (head detached, torso sheared, legs displaced): `docs/launcher-shots/session17/skin-ember-3d-STILL-WRONG.png`. The capture was byte-identical before and after the fix, so check whether the pose is being applied at all (time source, `reduced` motion flag, camera/yaw/pitch, `player.skin` vs `player` transform in `locker/scene.ts` lines ~125-160). Compare with the flat thumbnails, which are right.
- Until a capture of all five skins looks like a Minecraft character with idle motion, claim "five skins render in 3D with idle animation" is **UNVERIFIED/FALSE**. Add that check to `theme-regression.mjs` (assert the canvas is not blank and take a screenshot per skin).

## What was verified this session (commands were run)
- Rebase + conflict resolution; `cargo test --workspace` 103 passed / 0 failed locally (Linux); the lib suite looped 5x after fixing a `LUMINOS_HOME` race (backup test now takes `paths::test_home_lock()`).
- Secure store: `secrets.rs` (keyring crate: Windows Credential Manager, macOS Keychain, Linux kernel keyring). Tests: token never in accounts.json, round trip, legacy plaintext migrated, remove deletes the entry, real OS store round trip (passed on Linux locally; `LUMINOS_REQUIRE_OS_STORE=1` makes the Windows release job require it; **Windows result not read yet**).
- `app`: `tsc` + `vite build` ok; `npm test` ok incl. new `contrast.test.mjs` (each theme CSS holds only colour tokens, worst text pair 6.59:1).
- CI on an earlier head of #17: theme-regression green (layout identical across Default/Lunar/Light on home, cosmetics, library, settings), `trust`, client jars (26.3, 1.21.11), site build green.
- `.mrpack` export (`mrpack::export`, test), `locker_save` and `export_instance` Tauri commands added (the UI called both; neither existed).
- Updater: `update_check` example ran against the real GitHub API from the sandbox. The updater skips prereleases by design; `LUMINOS_UPDATE_PRERELEASE=1` opts in (unit-tested). The release workflow runs it against the published release (never run yet).

## Not done (in order)
1. Fix BLOCKER 1, re-capture, then merge #17 once CI is green (the Tauri crate is only compiled by `release.yml`'s `windows` job: read its result).
2. Run `scripts/release-check.sh --ci` on merged main. Windows jobs, smoke (title screen under Xvfb + llvmpipe already exists in `smoke.yml`), client jars.
3. Tag `v1.0.0-rc1` from main (prerelease; stable is forbidden until signing + `docs/REAL_DESKTOP_CHECKLIST.md`). `release.yml` does installer, portable zip, jars, `SHA256SUMS.txt`, attestations, EN/ES notes (CHANGELOG `## 1.0.0-rc1`), compat + winget/scoop manifests, updater check. It has never run end to end: expect to fix it.
4. Site: replace screenshots with captures from the rc1 build (`OUT=../site/public/shots node tools/shots-v09.mjs`, needs `vite preview` on :4173), three themes side by side as the headline, five skins, editor, locker, "where others see this"; set `site/src/lib/release.json` (already `v1.0.0-rc1`) and make the download link `releases/download/<tag>/Luminos-Setup.exe` (`/releases/latest` ignores prereleases and would give v0.6.0). `pages.yml` verifies the live URL after deploy.
5. Microsoft sign-in stays UNVERIFIED (`docs/MICROSOFT_AUTH.md`).
6. Not built (from #16, unchanged): in-game rendering hooks, launch hand-off of settings/locker to the client, `ModPolicy` in launch. Jars exist only for 26.3 and 1.21.11.

## Notes for the next session
- No winget/scoop script existed; `scripts/gen-package-manifests.mjs` is new. Manifests stay unsubmitted until signing.
- "Branch not deployed" on #17 is not a failing check: Pages deploys only from main. `pages.yml` now builds on PRs and verifies the live site after a main deploy.
- Local capture setup: `npm i --no-save playwright && npx playwright install chromium`, plus `sudo npx playwright install-deps chromium`. Do not `pkill -f "vite preview"` from a command that contains that text.
- **Security: the owner pasted a GitHub PAT in chat. It was passed per command via `http.extraHeader` only, never written to disk or git config (an early file was deleted in the first minutes). Revoke it and use a fine-grained token.**
