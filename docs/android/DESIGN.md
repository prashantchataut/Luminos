# Luminos Mobile: design (no code yet)

## How Pojav-class launchers work
Minecraft: Java Edition needs a JVM and desktop OpenGL. Android has neither, so the launchers:
1. **Ship a JRE** (OpenJDK built for Android bionic, ARM64) and start it through JNI in a separate process, with `LD_LIBRARY_PATH` pointing at their native libs.
2. **Translate GL.** Minecraft calls desktop OpenGL 3.x; Android offers GLES. A translation layer sits between: gl4es (GL 2.1 → GLES, MIT), ANGLE (GLES → Vulkan, BSD), Mesa Zink (GL → Vulkan, MIT), or MobileGlues. Each trades speed against correctness. Newer Minecraft versions (core profile, 26.x) need the more complete layers.
3. **Fake LWJGL/GLFW:** a GLFW shim turns touch/gamepad into key and mouse events; a layout editor maps screen regions to keys.
4. **Package the rest:** natives for LWJGL, a small launcher UI, an account layer (Microsoft / offline).

## What is slow or unsafe in them
- Bundled multi-hundred-MB runtimes in the APK; slow first launch.
- Broad storage permissions; sideloaded updates with weak integrity checks; plaintext tokens.
- One renderer chosen by the user with no guidance → crashes and thermal throttling.
- No sleeping when the screen is off; battery drain.

## Licensing decision
PojavLauncher is **LGPL-3.0**. Copying its code into a proprietary app would require releasing our combination under LGPL terms. **Decision: option (a), our own implementation from permissive parts only.**
- Renderers: gl4es (MIT), ANGLE (BSD-3), Mesa/Zink (MIT). 
- Java: OpenJDK/Temurin (GPLv2 + Classpath Exception), downloaded at first run as a separate runtime, never linked into the app.
- Nothing from Pojav/Amethyst/Zalith is copied. Their public behaviour is used as reference only, and importing their instance folders is plain file reading.
This is a plan, not a verified result. Verify the licence of every dependency with `cargo deny` / Gradle licence reports before shipping.

## Architecture
- `luminos-core` (Rust, shared with desktop) exposed through UniFFI to Kotlin: manifest, Modrinth, instances, mod resolution, accounts, Yggdrasil, compat manifest.
- UI: Kotlin + Jetpack Compose, Material 3 re-themed to the dithered-blue brand, same motion tokens as `MOTION.md`.
- Game process: separate `:game` process; the launcher UI can be killed without killing the game.
- Runtimes: Java 8 / 17 / 21 / 25 downloaded on demand, SHA-256 verified.
- Per-device profiles: renderer, resolution scale, FPS cap and RAM chosen from SoC/RAM; thermal-aware throttling via `PowerManager.getThermalHeadroom`.
- Safety: only `INTERNET`; no ads, no trackers; scoped storage; tokens in Android Keystore; signed APK + checksums; reproducible-build notes; GitHub Releases and F-Droid metadata. Google Play restricts Minecraft launchers, so distribution is GitHub and F-Droid.

## Status
❌ Not started. No Gradle project, no APK, no emulator run. Blockers in this sandbox: no Android SDK/NDK, 1 GB RAM. Next step: a Compose shell that loads `luminos-core` through UniFFI and lists the version manifest on an ARM64 emulator.
