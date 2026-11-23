# START HERE (handover written at the end of session 8)

You will not remember anything. Read this, then `.agents/context/OWNER_CONTEXT.md` (owner directives + references + OneClient feature checklist), then `docs/BRIEF.md`, `docs/LEDGER.md`, `CONTINUITY.md`, `AGENTS.md`.

## Shipped (releases)
| What | Release | Verified how |
|---|---|---|
| Windows launcher 0.4.0 (installer, portable exe, SHA256SUMS; unsigned) | https://github.com/prashantchataut/Luminos/releases/tag/v0.4.0 | Downloaded `Luminos-Setup.exe`; SHA-256 equals `SHA256SUMS.txt`. Built by `release.yml`; earlier sessions ran core tests. **Nobody has installed it on a real Windows PC in this project's record.** |
| Android 0.1.0 (APK) | https://github.com/prashantchataut/Luminos/releases/tag/android-v0.1.0 | CI built it, installed it on an Android 11 x86_64 emulator, drove the UI, screenshots. APK SHA-256 re-checked against `SHA256SUMS-android.txt`. |
| Android 0.2.0 (APK; Java matched to game) | https://github.com/prashantchataut/Luminos/releases/tag/android-v0.2.0 | Same emulator job; the home screenshot shows OpenJDK 25.0.5.1 booted for Minecraft 26.3. (Check the release exists before trusting this row; see "Verified / not verified".) |
| Android runtimes (Java 21/25, x86_64 + aarch64) | https://github.com/prashantchataut/Luminos/releases/tag/android-runtimes-v1 | x86_64 booted in CI. aarch64 packaged identically, never run. |
| Client mod | `client-v0.2.0` | 1.21.4 only. |
Screenshots of onboarding, home, library, skins, settings: `docs/screenshots/android/`.

## What works
- Windows: Rust/egui launcher with instances, Mojang/Fabric/Quilt, Modrinth, skins studio, servers page (login-mode probe), network-activity audit (no telemetry), authlib-injector accounts, luminos-auth server crate.
- Android: install/open, onboarding with real offline UUID, real skin + cape lookup rendered as a rotating 3D model, instances with Mojang artwork, Modrinth mod browser/installer (SHA-512), Mojang file download with SHA-1, version-matched Java 21/25 download + boot, network allow-list screen, haptics, dither sky.

## What does NOT work (do not claim otherwise)
- **Minecraft does not start on Android.** No OpenGL layer, no window/input layer. The home screen says so.
- Windows build is unsigned (SmartScreen warning). Microsoft sign-in not wired (needs an Azure app id). No `luminos://` handler, no relay/host-a-world, no cosmetics service, no multi-version client, no real in-game cover-art capture (the Android cards use Mojang's official patch-note art), Windows cards still not real captures.
- Android: arm64 untested on any device; debug-signed APK; no touch/gamepad controls; no servers screen.

## Exact next steps (in order)
1. **Verify `android-v0.2.0`** exists with APK + checksum (curl the release API, compare SHA-256). If the tag build failed, read the log, fix, retag `android-v0.2.1`.
2. **Android engine stage 2.5 (cheap, high value):** run the *vanilla dedicated server* jar on the emulator with the Java 21/25 runtimes and assert "Done (" in the log. Add as a CI job. This proves Minecraft code runs on Android before the GL work.
3. **Engine stage 3:** GL + window. Candidates: GLFW shim + ANGLE (Apache-2.0) or gl4es (MIT) + LWJGL natives rebuilt for bionic (LWJGL is BSD-3). PojavLauncher is LGPL-3.0: study it, do not link or copy it into a proprietary app without a legal decision from the owner (record in `docs/BLOCKERS.md`). Milestone: title screen screenshot in CI.
4. Windows: B1 real cover art. CI job with xvfb + Mesa llvmpipe launches the client per version and captures panoramas; store in `docs/ASSETS.md` with credit; use on cards and site. Then A2 signing wiring, A3 token storage, A4 hash verification.
5. Create `docs/ONECLIENT_PARITY.md` from the checklist in OWNER_CONTEXT, then work it down. Resourcify-style built-in pack browser (toggleable) belongs in the client mod. Original free cosmetics set with Luminos branding (D2).
6. C-items: offline account join tests on 5 versions in CI (C1/C2), Skins Bridge plugin (C7), relay (C5).
7. Keep going down `docs/LEDGER.md`. The gate (`bash scripts/gate.sh`) exits non-zero until every item is truly done and CI is green on HEAD; a non-zero gate is correct today.

## How to work in this environment
- The sandbox given to the agent is a tiny Next.js scaffold, not the repo. Clone the repo into /tmp and push with a one-off header: `git -c http.extraHeader="Authorization: Basic $(printf 'x-access-token:%s' "$TOKEN" | base64 -w0)" push ...`. Never write the token to disk or a remote URL.
- No Rust/Android SDK locally: push, then poll `https://api.github.com/repos/prashantchataut/Luminos/actions/runs?head_sha=<sha>` and read job logs. A Kotlin change costs one ~7 min CI round trip.
- Release tags: `vX.Y.Z` Windows, `android-vX.Y.Z` APK, `android-runtimes-vN` Java runtimes, `client-vX.Y.Z` mod.

## Owner actions needed
- **Revoke the GitHub PAT that was pasted in chat** (again) and use a fine-grained token or `gh auth login`.
- Windows signing (see `docs/WINDOWS_SECURITY.md`), Azure app id for Microsoft sign-in, an Android release keystore.
- This repo is public. `.agents/context/` is only unobtrusive, not private. Make the repo private if the reference list should be hidden.

## Licence stance
Reference projects (OneLauncher, OneClient, Polyfrost mods) are GPL-3.0 and Luminos is proprietary: study behaviour, write original code, never copy source. The Java runtimes are OpenJDK (GPLv2 + Classpath Exception) redistributed unmodified from Termux builds; sources linked in the runtimes release notes.
