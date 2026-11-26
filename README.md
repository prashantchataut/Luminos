<p align="center"><img src="brand/luminos-256.png" width="96" alt="Luminos: the dithered blue moon"></p>
<h1 align="center">Luminos</h1>
<p align="center">A light Minecraft launcher with a built-in performance stack and a first-party client.<br>
<a href="https://prashantchataut.github.io/Luminos/">Website</a> · <a href="https://github.com/prashantchataut/Luminos/releases/latest">Download <code>Luminos-Setup.exe</code></a></p>

![Luminos](site/public/art/site-readme-banner-1280x640.webp)

## What is in 2.3.0
- **Original logo restored.** The dithered blue moon is back in the app, installer, window icon and site (v2.1.0's crescent-and-crystal mark is gone).
- **Your artwork, wired.** Home hero, version cover cards, onboarding, the Showdown stage, the in-game title screen and the site use the images from commit `be42463`. Audit: [`docs/design/USER_ART_AUDIT.md`](docs/design/USER_ART_AUDIT.md).
- **Game window.** The Fabric client sets the window title to `Luminos Client <version>` and the native window icon (16/32/256 px) through GLFW, so the title bar, taskbar and Alt+Tab no longer show the JVM's identity.
- **In-game title screen rebuilt** on real Minecraft widgets (`addRenderableWidget`): Singleplayer, Multiplayer, Luminos Mods, HUD Studio & Cosmetics, Options, Quit.
- **Skin Showdown Studio.** 3D stage, four lighting rigs (Moonlit Arena, Nether Glow, Daylight Shader, Studio Rim Light), five poses, side-by-side compare, import by Mojang or Ely.by username, pixel editor. 16 generated, textured skins. Wings and pets are removed.
- **Ten capes**, including **Job Application**, Ball Knowledge Tactician (2 frames), Touch Grass 3D, 404 Skill Not Found, and 3D-relief cloaks (`scripts/gen-textured-skins.mjs` regenerates everything).
- **Mods screen** as Tactical Bento cards (42 modules; 8 are launcher-side settings whose in-game module is pending, and are labelled so).
- **Microsoft sign-in** (device code → Xbox Live → XSTS → Minecraft services, tokens in the OS keyring), a **4-step setup wizard**, and an **in-app updater** (GitHub `releases/latest`, SHA-256 check, silent NSIS install).

## Capes
![Capes](site/public/art/capes/job-application.png) ![](site/public/art/capes/touch-grass-3d.png) ![](site/public/art/capes/404-skill-not-found.png) ![](site/public/art/capes/luminos-original-moon.png)

## Performance
Sodium, Lithium, FerriteCore, ImmediatelyFast, Entity Culling and ModernFix are installed from Modrinth with the Luminos profile, with G1GC pause tuning. **No FPS benchmark has been run for 2.3.0, so none is claimed here.**

## Honest status
See [`docs/STATUS_v2.2.md`](docs/STATUS_v2.2.md): what ran, what was only compiled, what was not run on real hardware. `node scripts/verify-v2.2.mjs` is a static repo check, not a test of the running app.

## Build
`cd app && npm ci && npm run build` · `cd client && ./gradlew build` (JDK 25 for Loom) · `npx tauri build --bundles nsis` · tag `vX.Y.Z` runs the release workflow. © Luminos, proprietary (see `LICENSE`).
