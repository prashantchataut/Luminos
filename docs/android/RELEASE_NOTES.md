## Luminos Mobile 0.1.0 (early preview)

Native Android app (Kotlin + Jetpack Compose) for the Luminos launcher. `arm64-v8a` phones and `x86_64` emulators, Android 8.0+. The only permission is `INTERNET`. No ads, no analytics. **Signed with a debug key** until a release keystore exists, so Android may warn on install; verify the download against `SHA256SUMS-android.txt`.

**What works today (verified in CI on an Android 11 x86_64 emulator, see the workflow log and screenshots)**
- Installs and opens; onboarding with an offline account (the real offline UUID) and optional real skin/cape lookup from Mojang.
- **Engine stage 1:** downloads an OpenJDK 17 build for Android, verifies its SHA-256, unpacks it and boots the JVM from inside the app.
- **Engine stage 2:** downloads Minecraft's client, libraries and assets from Mojang with SHA-1 checks (Prepare button).
- Instances for any release or snapshot, with Mojang's official artwork for the version.
- Modrinth mod browser and installer (Fabric), with required-dependency resolution and SHA-512 verification.
- Skins: your actual skin and cape as a draggable, rotating 3D model; import a PNG, load by username, classic/slim.
- Network activity screen listing every host the app can contact; anything else is refused.

**What does not work yet**
- **Minecraft does not start.** It needs an OpenGL translation layer and a window/input layer (GLFW shim). That is engine stage 3; the app says so on the home screen instead of pretending.
- Microsoft sign-in, servers list, touch/gamepad controls, cosmetics service uploads: not built.
- The bundled Java runtime is the PojavLauncher team's public OpenJDK 17 build from 2021 (GPLv2 + Classpath Exception). Minecraft 1.20.5+ needs Java 21 and 26.x needs Java 25: those runtimes still have to be built.
- Verified on an emulator only; no physical device has run it.
