## Luminos Mobile 0.2.0 (early preview)

Native Android app (Kotlin + Jetpack Compose) for the Luminos launcher. `arm64-v8a` phones and `x86_64` emulators, Android 8.0+. The only permission is `INTERNET`. No ads, no analytics. **Signed with a debug key** until a release keystore exists, so Android may warn on install; verify the download against `SHA256SUMS-android.txt`.

**What works today (CI log + screenshots: the `android` workflow on an Android 11 x86_64 emulator)**
- Installs and opens; onboarding with an offline account (the real offline UUID) and optional real skin/cape lookup from Mojang.
- **Java that matches the game.** The app reads Mojang's version JSON and downloads the right runtime: **Java 21** for Minecraft 1.20.5 to 1.21.x, **Java 25** for 26.x (Android-native OpenJDK, SHA-256 verified), unpacks it and boots it from inside the app. Both were also proven in CI to compile and run a Java program on the emulator.
- Minecraft's client, libraries and assets from Mojang with SHA-1 checks (Prepare button).
- Instances for any release or snapshot, with Mojang's official artwork for the version.
- Modrinth mod browser and installer (Fabric), with required-dependency resolution and SHA-512 verification.
- Skins: your actual skin and cape as a draggable, rotating 3D model; import a PNG, load by username, classic/slim.
- Network activity screen listing every host the app can contact; anything else is refused.

**What does not work yet**
- **Minecraft does not start.** It needs an OpenGL translation layer and a window/input layer (GLFW shim): engine stage 3. The app says so on the home screen instead of pretending.
- Microsoft sign-in, servers list, touch/gamepad controls, cosmetics service: not built.
- `arm64-v8a` runtimes are packaged the same way as the tested `x86_64` ones, but no one has run them on a phone yet. Verified on an emulator only.

**Changed since 0.1.0:** Java 17 runtime replaced by version-matched 21/25 runtimes; opaque nav bar and segmented control (no content bleeding through).
