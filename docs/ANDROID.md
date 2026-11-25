# Luminos for Android: launcher preview

> **Android launcher preview: installs and manages instances; Minecraft does not launch yet.**
> Do not describe this app as "play Java Minecraft on Android". That claim stays off until the title screen loads on a device or emulator.

## Capability matrix
| Capability | State | Evidence |
|---|---|---|
| Install, open, onboarding (offline account, real offline UUID) | **Works, emulator** | `android` job in `android.yml` / `release.yml`, screenshots in `docs/android-shots/` |
| Home, Library, Skins (3D model), Settings screens | **Works, emulator** (driven by `android/ci/emulator_test.sh`, fails on crash or ANR) | `docs/android-shots/` |
| Instances for any release or snapshot | Works, emulator | same |
| Java runtime that matches the game (21 for 1.20.5 to 1.21.x, 25 for 26.x), SHA-256 checked, unpacked, booted | **Works on x86_64 emulator**. arm64-v8a runtimes are packaged the same way, **never run** | `LUMINOS_ENGINE_OK` in the emulator log |
| Minecraft client, libraries, assets from Mojang with SHA-1 checks ("Prepare") | Works, emulator | same |
| Modrinth browsing | Works, emulator. Installing a mod with dependencies: written, **not driven end to end in CI** | |
| Skins: 3D model, PNG import, lookup by username | Works, emulator | |
| **Launching Minecraft** | **Does not work** | see below |
| OpenGL translation layer, window/input (GLFW) layer | **Not built** | see "GL attempt" |
| In-game features | Not applicable | |
| Microsoft sign-in | Not built | offline accounts only |
| A real phone | **Never tested** | emulator only |

## Device support
- Minimum Android: **8.0 (API 26)**. `targetSdk` is 28 on purpose: Android 10+ blocks executing files from app-private storage for apps that target 29 or newer, and the downloaded Java runtime is such a file.
- ABIs: **arm64-v8a and x86_64** (`ndk.abiFilters`). A first CI run showed the APK also carried `libandroidx.graphics.path.so` for armeabi-v7a and x86; the only native code inside is that AndroidX library, and `apk-info.txt` in every release lists the exact `lib/` entries and `native-code`. The Java runtimes the app downloads exist for aarch64 and x86_64 only, which is why the filter exists. x86_64 was exercised on an emulator; arm64-v8a was not run anywhere.
- Signing: **debug key**. There is no release keystore, so Android may warn on install. Verify the file against `SHA256SUMS.txt`. This is not a production-signed build.
- Permissions: `INTERNET` only.

## What the user sees when they try to launch
There is no Play button. The home screen has a **Prepare** button and an "Engine: what works on this phone" list. Captured from the emulator (`docs/android-shots/04-home.png`, text read from the UI tree in `launch-message.txt`):

> 3. **Minecraft reaches its title screen**: *Needs the OpenGL + window layer. Not built yet.*

After Prepare succeeds, the app (per `Home.kt`; **this state was not captured in CI**) shows: "Java runtime and Minecraft `<version>` files are verified on this device. Starting the game itself is engine stage 3 and is not in this build yet." The welcome screen also says "Early preview: installs, mods and skins work today. Starting the game is the next engine stage."

## GL attempt (deferred, not faked)
Reaching the title screen needs three things this repository does not have: an OpenGL ES translation layer for desktop GL (for example gl4es or ANGLE/Zink), a GLFW shim that gives LWJGL a window and input over a `SurfaceView`/EGL, and LWJGL native libraries built for Android on both ABIs. This session wrote no code for them: with CI runners only and no device, a partial layer would have produced something that could not be shown to work. Next step: GLFW shim plus gl4es, tested on the emulator first.

## Distribution
GitHub Releases only (not Google Play, which restricts launchers and executing downloaded code). The release pipeline builds the APK, runs it on an Android 11 x86_64 emulator, names it `Luminos-<version>.apk`, adds its SHA-256 to `SHA256SUMS.txt` and attests it.
