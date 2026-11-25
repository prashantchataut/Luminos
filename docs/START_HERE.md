# START HERE (session 19b)
Read `STATUS.md` (per-item VERIFIED / UNVERIFIED / NOT BUILT), then `docs/SESSIONS.md` (one line per merged PR), then `docs/ANDROID.md` for the Android truth.

State: #18 is merged; PR #19 adds the Android job and APK to the release pipeline, the site rebuild and the fixes above. The release is a **pre-release candidate**: `v1.0.0-rc1`, Windows unsigned, APK debug-signed and emulator-only.

Run `scripts/release-check.sh --ci` before any release; it is the single gate (workflow lint, stub grep, changelog EN+ES, site manifest, Android honesty line, tests, every required CI check).

Site links come only from `site/src/lib/release.json`, which the release job regenerates from the real `SHA256SUMS.txt` and then dispatches the Pages workflow.

Next, in order: (1) owner: **revoke the GitHub PAT that was pasted into chat (again) and use a fine-grained token**, register the Discord app, decide on code signing; (2) run the manual real-desktop checklist; (3) Android: GLFW shim + gl4es on the emulator; (4) Quick Play button; (5) two-machine P2P test.
