# Changelog

## 4.5.0
- Launcher window: no longer always-on-top and no longer taller than 88% of the monitor, so it cannot cover the Windows taskbar (default 1200x720, minimum 960x580). Own title bar with minimize, maximize/restore and close, drag region and double-click to maximize. Always-on-top is an opt-in switch in Preferences.
- Launcher: Minecraft version (1.21.4 to 1.19.4), engine preset and window mode selectors on Home and in Preferences, saved at once. Launch uses (or creates) the Fabric instance for exactly the selected version.
- In-game client: startup screen redesigned as one left column of seven actions with keyboard navigation and a live engine badge; quick panel tabs renamed (Render, FPS); the open/close rule for Right Ctrl is now a tested pure function.
- Client tests: 9 headless JUnit tests (clicks, tabs, in-place toggles, inline drawer, slider drag, key routing, Mixin registration) plus 2560x1600 renders of the three in-game screens. Composed renders, not captures of a running game.
- Not verified: nothing was launched in a real Minecraft or on a real Windows desktop in this release; the Luminos Client loads on Minecraft 1.21.11 only.

## 4.4.0

### English
- **New standalone startup screen.** `LuminosMainMenuScreen` replaces vanilla's TitleScreen at the root: `Minecraft.setScreen` swaps any `TitleScreen` for it, and `TitleScreen.init` redirects to it as a safety net. It draws its own scene (artwork or midnight-cobalt aurora, 35 drifting motes, vignette, account/engine bar, hero dock) with no vanilla widgets; every button is a rectangle registered in one `HitRegion` list at the moment it is drawn. The engine pill says "Sodium + Native Engine Active" only when Sodium is loaded.
- **Right Ctrl / Right Shift work everywhere.** Two hooks (raw `KeyboardHandler.keyPress`, plus a per-frame GLFW edge detector in `Minecraft.runTick`) feed one debounced `QuickPanelToggle`, so the panel opens and closes over the world, the pause menu, and both title screens, and never over chat or inventories.
- **Quick panel: fixed the click bugs.** Root cause: a card scrolled partly under the header kept a hit rectangle that overlapped the tab and search rows, and `isChrome = y < gy` let it fire. Scrolled hits are now clamped to the grid viewport when registered. Toggling flips the module in place (click sound, config saved, never `setScreen`). The gear or a right click opens an inline 210 px settings drawer (sliders drag live, wheel scrolls it). New Movement and Performance tabs; wheel handling uses the 4-argument `mouseScrolled`. Vanilla blur no longer draws over the panel.
- **Launcher Capes preview is lit.** Studio light rig raised from 0.4/0.9 to 2.2/1.6, a cobalt studio glow behind the canvas, and a brighter high-contrast default skin (original art drawn in code).
- **Engine:** `FastMathLUT` (65,536-entry sine table). Existing culling, particle, fog, lightmap and frame-limit mixins are unchanged; no benchmark was run and no speed claim is made.
- **Tests:** `./gradlew hitTest` renders the real views headlessly and clicks the registered rectangles (tabs, toggles, gear, drawer, sliders, every menu button at 480x270, 640x360, 854x480).
- **Not verified:** no real Minecraft window and no GPU were available. The Mixin targets compile against the 1.21.11 Mojang-mapped jar but were not launched; the previews are Java2D renders at GUI scale 2, not screenshots of the game. The CI smoke run keeps the vanilla title screen (it waits for it) and so does not exercise the new menu. The cape-card thumbnails in the launcher still use their own, dimmer snapshot lighting.

### Español
- **Nueva pantalla de inicio independiente.** `LuminosMainMenuScreen` sustituye a la TitleScreen de vanilla desde la raíz (`Minecraft.setScreen`) y `TitleScreen.init` redirige a ella como red de seguridad. Dibuja su propia escena sin widgets de vanilla; cada botón es un rectángulo registrado en una única lista `HitRegion` en el momento de dibujarse.
- **Right Ctrl / Right Shift funcionan en todas partes.** Dos ganchos (evento de teclado y detector de flanco por fotograma) alimentan un único `QuickPanelToggle` con antirrebote: abre y cierra el panel en el mundo, el menú de pausa y las pantallas de título, nunca sobre el chat o inventarios.
- **Panel rápido: errores de clic corregidos.** Una tarjeta desplazada bajo la cabecera conservaba un rectángulo que solapaba las pestañas y la búsqueda; ahora los rectángulos desplazables se recortan al área visible. Activar un módulo no abre nunca otra pantalla; el engranaje o el clic derecho abre un panel de ajustes integrado de 210 px. Nuevas pestañas Movement y Performance.
- **Vista previa de Capes iluminada.** Luz de estudio de 0,4/0,9 a 2,2/1,6, resplandor cobalto y una skin por defecto más brillante.
- **Motor:** `FastMathLUT`. No se midió el rendimiento y no se afirma ninguna mejora.
- **Sin verificar:** no hubo ventana real de Minecraft ni GPU; los ganchos Mixin compilan pero no se ejecutaron en el juego, y las imágenes son renders de Java2D.

## 4.3.0

### English
- **One shared config, live in both directions.** The launcher (`load_client_config` / `save_client_config` in `src-tauri`, typed `LuminosClientConfig`) and the in-game client (`LauncherSync.java`) read and write the same `<minecraft dir>/config/luminos/config.json`: module toggles, hotkeys, HUD positions (`hud.<id>.nx/ny` as fractions of a 640x360 canvas) and the equipped cape. Writes are atomic (temp file + rename) and merged, so a launcher save no longer wipes what the game wrote. The game re-reads the file about once a second when its `lastModified` changes, so toggles, key changes, HUD moves and capes set in the launcher apply without a restart. The launcher loads the file on start, on window focus and every 2 s, and a read that races a local edit never undoes it.
- **Launcher UI:** sidebar is 224 px with Play / Client / Personalization groups and a bottom dock (account type, live status Ready / Launching N% / In-Game, Quit when running, update check). Home hero now runs its dark gradient from the left with the engine-ready badge and "Luminos Client 4.3". Mods shows a "Built-in Performance Stack: Active" banner. Edit HUD no longer leaves an empty block under the canvas and gains an element picker. Keybinds, Themes and Preferences rows span the full content width. The "Emote Wheel" keybind (no feature behind it) is gone. The 10th cape (404 Skill Not Found) is back in the grid. Launch progress is shown once, not three times.
- **Fixed the release pipeline:** the 4.2.0 release failed because its CHANGELOG entry lacked the English / Español sections the notes script requires. 4.2.0 never reached GitHub Releases; 4.3.0 is the first release since 4.1.0.
- **Not verified:** no real Minecraft window and no GPU were available. The in-game title screen and quick panel PNGs in `docs/design/rounds/` are still the 4.1.0 offscreen render (no JDK 25 here to regenerate them). The 3D character in Capes renders very dark in the headless software-GL screenshots; it was not checked on a GPU.

### Español
- **Una sola configuración compartida, en vivo en ambos sentidos.** El lanzador (`load_client_config` / `save_client_config`) y el cliente del juego (`LauncherSync.java`) leen y escriben el mismo `config/luminos/config.json`: módulos, atajos, posiciones del HUD y la capa equipada. Las escrituras son atómicas y se fusionan. El juego vuelve a leer el archivo cada segundo si cambia, así que los cambios del lanzador se aplican sin reiniciar; el lanzador lo carga al iniciar, al enfocar la ventana y cada 2 s.
- **Interfaz del lanzador:** barra lateral de 224 px con grupos Jugar / Cliente / Personalización y un panel inferior (tipo de cuenta, estado en vivo, actualización). Banner de rendimiento integrado en Mods, selector de elementos en Editar HUD, filas de ancho completo y progreso de inicio mostrado una sola vez.
- **Corregida la publicación:** 4.2.0 falló porque su entrada del CHANGELOG no tenía las secciones English / Español. 4.3.0 es la primera versión publicada desde 4.1.0.
- **Sin verificar:** no hubo ventana real de Minecraft ni GPU. Las imágenes del juego en `docs/design/rounds/` siguen siendo las de 4.1.0.

## 4.2.0

### English
- **Fixed the `hs_err_pid` JVM crash.** `AlwaysPreTouch` is gone from every JVM preset. `-Xms` is a fixed 512 MB, and `-Xmx` is the requested value capped at 55% of the RAM that is free at launch and clamped to 1-3 GB (`memguard.rs`; Windows `GlobalMemoryStatusEx`, Linux `MemAvailable`). Default RAM is 2048 MB. ModernFix `dynamic_resources=true` is the new default (an untouched 4.0/4.1 file is upgraded; your edits are never overwritten).
- **Old client jar can no longer boot.** Every `*luminos*.jar` in `mods/` and the Luminos cache folders is deleted before the fresh jar is copied, including when the client has to be downloaded.
- **Title screen buttons are real.** `TitleScreenMixin` now edits Minecraft's own TitleScreen in place (clear vanilla widgets, add five `Button`s with `addRenderableWidget`); it never replaces the screen or touches `render()`/`mouseClicked()`. The custom 26.x click handler (`TitleView`) is removed.
- **Launcher UI:** flat 7-item sidebar, 4-column module cards with a full-width switch bar, single-column 62px Preferences rows with a Free System RAM readout, Home hero trimmed (no stat pill).
- Not verified: nothing here was run inside a real Minecraft window, and the OneClient reference screenshots were not available to compare against. See `docs/design/V4.2_SKILL_AUDIT.md`.

### Español
- **Corregido el fallo `hs_err_pid` de la JVM.** `AlwaysPreTouch` ya no está en ningún perfil; `-Xms` es 512 MB fijo y `-Xmx` se limita al 55% de la RAM libre al iniciar (entre 1 y 3 GB). RAM por defecto: 2048 MB.
- **El jar antiguo del cliente ya no puede arrancar:** se borra todo `*luminos*.jar` de `mods/` antes de copiar el nuevo.
- **Los botones de la pantalla de título son reales** (`TitleScreenMixin` edita la pantalla de Minecraft sin tocar `render()` ni `mouseClicked()`).
- **Sin verificar:** nada se ejecutó dentro de una ventana real de Minecraft.

## 4.1.0

### English
- **Launcher, game opening:** Launch now shows real progress across six stages (Java runtime, client injection, assets and libraries, performance stack, JVM spawn, waiting for the Minecraft window) with a percentage bar, the current stage, a one-line live log and Cancel. "Running" appears only after Minecraft prints its window lines (`Backend library: LWJGL`, `OpenAL initialized`, `Sound engine started`, `...-atlas`); if the JVM dies first, a diagnostic dialog shows the last 30 log lines with Copy Log.
- **Stale client jars:** before every launch every `luminos-client*` / `luminos_client*` / `luminos-*.jar` in `<game dir>/mods` is deleted, then the bundled jar for this version is copied unconditionally, and a last check just before the JVM starts keeps exactly one. The release builds the client with `gradlew clean build` and empties `resources/mods` before bundling.
- **Cosmetics:** removed the preset skin gallery and Skin Showdown. The screen is now your own character (sync from a Mojang or Ely.by username, or upload a 64x64 PNG; Classic or Slim arms) beside a 3D capes grid.
- **In-game client:** new title screen (cover-fit artwork, floating centred buttons, account pill, footer) and a new Right Ctrl panel (category tabs, search, 3-column module cards with switch and settings popover). Both are drawn by code shared with `scripts/render-ingame-preview.mjs`, which renders the PNGs in `docs/design/rounds/`.
- **Not verified:** nothing here has run inside a real Tauri window or a real Minecraft window on a GPU. The in-game PNGs are an offscreen render of the same layout code, not screenshots of the game.

### Español
- **Lanzador, apertura del juego:** Jugar muestra el progreso real en seis etapas (Java, inyección del cliente, recursos y bibliotecas, pila de rendimiento, arranque de la JVM, espera de la ventana de Minecraft) con barra de porcentaje, etapa actual, una línea de registro en vivo y Cancelar. "En ejecución" aparece solo cuando Minecraft imprime sus líneas de ventana; si la JVM termina antes, un diálogo muestra las últimas 30 líneas con Copiar registro.
- **Jars antiguos del cliente:** antes de cada inicio se borran todos los `luminos-client*` / `luminos_client*` / `luminos-*.jar` de `mods`, se copia el jar incluido de esta versión y una última comprobación deja exactamente uno. La versión compila el cliente con `gradlew clean build`.
- **Cosméticos:** se eliminaron la galería de skins predefinidas y Skin Showdown. Ahora ves tu propio personaje (sincroniza desde un usuario de Mojang o Ely.by, o sube un PNG de 64x64) junto a una cuadrícula de capas 3D.
- **Cliente en el juego:** nueva pantalla de título y nuevo panel Ctrl derecho (pestañas, búsqueda, tarjetas de módulos con interruptor y ajustes). Las imágenes de `docs/design/rounds/` son un render fuera de pantalla del mismo código de diseño, no capturas del juego.
- **Sin verificar:** nada se ha ejecutado dentro de una ventana real de Tauri ni de Minecraft con GPU.

## 4.0.0

### English
- **CI:** removed the tracked file `docs/<0x1A>` that broke checkout on every Windows job. The 26.x client no longer crashes at startup: Minecraft 26.x opens its window with SDL and has no GLFW, so every GLFW call in `WindowBrand` now lives in a class that is only loaded when GLFW exists (the 26.x line compiles with compile-only LWJGL).
- **Client engine (1.21.11):** `Engine` plus 14 Mixins (`WorldRenderer`, `EntityRenderDispatcher`, `BlockEntityRenderDispatcher`, `ParticleManager`, `BackgroundRenderer`, `LightmapTextureManager`, `Camera`, `GameRenderer`, `Mouse`, `FramerateLimitTracker`, `HeldItemRenderer`, `InGameOverlayRenderer`, `ClientWorld`, `LevelWeather`). `MinecraftTitleMixin` became `MinecraftClientMixin` (title "Luminos Client 4.0"). The new panel rows appear only on the 1.21 line.
- **Launcher core:** `perfconfig.rs` writes Sodium, ImmediatelyFast and ModernFix configs at every launch if you have none (never overwrites yours). New JVM preset with `MaxGCPauseMillis=30` and `AlwaysPreTouch`. User-Agent `Luminos-Launcher/4.0.0`.
- **Docs and checks:** `docs/architecture/V4_ENGINE_AND_SKILLS_AUDIT.md` and `scripts/verify-v4.0.mjs`.
- **Not done:** UI redesign, in-game HUD rewrite, 3D waypoints and minimap, voxel cape mesh. In-game visual effects were not looked at on a real GPU.

### Español
- **CI:** se eliminó el archivo `docs/<0x1A>` que rompía la descarga en todos los trabajos de Windows. El cliente 26.x ya no se cierra al iniciar: Minecraft 26.x usa SDL y no tiene GLFW, así que las llamadas a GLFW de `WindowBrand` ahora están en una clase que solo se carga si GLFW existe.
- **Motor del cliente (1.21.11):** `Engine` y 14 Mixins: descarte de entidades y bloques lejanos, límite de partículas, niebla clara por dimensión, brillo máximo nativo, cámara libre de 360 grados, zoom suave, animación de espada 1.7, fuego bajo, bloqueo de hora y clima en el cliente y límite de 15 FPS sin foco.
- **Núcleo del lanzador:** configuraciones previas de Sodium, ImmediatelyFast y ModernFix (nunca sobrescribe las tuyas) y nuevos parámetros de JVM.
- **Pendiente:** rediseño de la interfaz, nuevo HUD, minimapa y waypoints 3D, y malla 3D de capas. Los efectos visuales no se han probado en una GPU real.

## 2.3.0
- **Website:** the approved dithered-moon hero is first on the page again (v2.2.0 had put a Capes section above it; `Hero.tsx`/`Sky.tsx` are byte-identical to pre-v2.1.0). Capes moved below the tour.
- **Capes:** ten HD 512x256 capes (`scripts/gen-hd-3d-capes.mjs`). Cards are real skinview3d renders of the cape worn from a 3/4 back view with an extruded voxel relief layer; the Showdown stage shows the same relief live. In-game: `CapeSkin` + `PlayerSkinMixin` swap the local player's cape texture (compiled, not yet run in a real game; no extra relief mesh in-game).
- **Skins:** 16 rule-built 64x64 skins (`scripts/gen-authentic-skins.mjs`), shown as skinview3d portraits.
- **Updater:** `check_app_update` always returns the latest release (so "Test / Re-run Auto-Updater" works while current); `install_app_update` streams with live progress, checks size / MZ / SHA-256, then a detached `.cmd` runs the NSIS installer with /S and restarts Luminos. Unit-tested script generation; never run against a real Windows install.
- **Window identity:** the JVM is started as `LuminosClient.exe` (copy of java.exe in the same bin folder); `MinecraftTitleMixin` returns "Luminos Client <version>". The exe's file description is still the JDK's.
- **In-game title screen:** seven buttons incl. Cosmetics & 3D Capes; new `LuminosCosmeticsScreen`.
- Fix: the release source gate no longer hard-codes a version and accepts the 128 px icon layer.

## 2.1.0

### English
Fixes the problems found on a real desktop with 2.0.0. The Rust and Fabric code compiles and its unit tests pass; none of it has been run on a real Windows desktop by the author yet (see docs/REAL_DESKTOP_CHECKLIST.md).

- **Luminos logo and installer:** a new Luminos mark (crescent and cobalt prism) in the sidebar, the website and every icon. The Windows icon is a real multi-size .ico (256 to 16 px), and the installer has its own sidebar and header artwork.
- **Real worlds and servers on Home:** Quickplay now lists the worlds in your `.minecraft/saves` (name, last played, icon) and the servers in your `servers.dat`. If you have none, Home says so and offers Launch Minecraft, Add Server and Browse .minecraft Folder. Add Server writes to `servers.dat`. No sample worlds or servers are shown in the app.
- **Stop Game, and no more "Playing" forever:** Home now follows the real game process. The button returns to Launch Game as soon as Minecraft closes, and a red Stop Game button (also in the sidebar) ends the game. Quit Luminos closes the launcher.
- **In-game client:** the installer carries the Luminos Client jars; Launch Game copies the one for your Minecraft version into `mods/` (and installs Fabric API if missing), and refuses to start plain Minecraft if Fabric did not resolve. The client replaces the title screen with the Luminos one (a mixin) and Right Ctrl or Right Shift opens the quick panel from the title screen, the pause menu and in game. Module toggles, hotkeys and HUD positions are exchanged through `config/luminos/config.json`.
- **Names:** themes are now Luminos Cobalt (Default), Luminos Obsidian, Luminos Slate and Luminos Light; other products' names were removed from the app, client and website.

### Español
Corrige los problemas encontrados en un escritorio real con 2.0.0: nuevo logotipo e instalador, mundos y servidores reales en Inicio (sin datos de ejemplo), botón Detener juego y detección del cierre de Minecraft, y el cliente dentro del juego (pantalla de título de Luminos y panel rápido con Ctrl derecho o Mayús derecho). El código compila y sus pruebas unitarias pasan; no se ha ejecutado todavía en un Windows real.

## 2.0.0

### English
Complete from-scratch redesign of the launcher UI. Not yet run on a real Windows desktop by the author (see docs/REAL_DESKTOP_CHECKLIST.md).

- **Window:** opens at 1280×800 (minimum 1100×720, centred, native frame) so nothing clips.
- **Speed and stability:** exactly one WebGL context (the Cosmetics pedestal), capped at 45 fps, paused when hidden or a dialog is open, fully released on leaving; grid cards use cached 2D art. Every IPC call goes through `safeInvoke` (4 s timeout, fallback value) and the whole app sits in a recovery error boundary.
- **Mods:** 34 built-in client modules (Waypoints, Minimap, Fullbright, Freelook, Zoom, ToggleSprint, Keystrokes and more) with a settings drawer. The bundled performance stack is no longer listed as mods.
- **Rewritten screens:** Home, Mods, Keybinds (key recorder, Hold/Toggle), Preferences, Cosmetics, HUD Studio (drag, 5 px snap, arrow-key nudge), Themes, Profiles, Accounts.

### Español
Rediseño completo de la interfaz del lanzador, desde cero. El autor aún no lo ha probado en un escritorio Windows real (ver docs/REAL_DESKTOP_CHECKLIST.md).

- **Ventana:** se abre a 1280×800 (mínimo 1100×720, centrada, marco nativo) para que nada se recorte.
- **Rendimiento y estabilidad:** un único contexto WebGL (el pedestal de Cosméticos), limitado a 45 fps, en pausa si la ventana está oculta o hay un diálogo abierto; las tarjetas usan arte 2D en caché. Toda llamada IPC pasa por `safeInvoke` (límite de 4 s, valor de respaldo) y la app está dentro de un límite de errores con recuperación.
- **Mods:** 34 módulos de cliente integrados, con panel de ajustes. La pila de rendimiento incluida ya no aparece como mods.
- **Pantallas reescritas:** Inicio, Mods, Atajos, Preferencias, Cosméticos, Editor de HUD, Temas, Perfiles, Cuentas.

## 1.0.0

### English
First stable release. The Windows installer and APK are unsigned / debug-signed and have not been run on a real desktop or phone by the author (see docs/REAL_DESKTOP_CHECKLIST.md).

**Cosmetics rebuilt (Polyfrost Store layout)**
- 360px pedestal stage (skinview3d, studio key + rim light, 25 degree yaw / -10 degree pitch, idle sway) next to a card showcase: Skins, Cloaks, Wings, Emotes, Pets, Hats & Masks, Bundles. Each card has a rendered 3D preview, a category badge, a favourite star and an Equip bar.
- The five flat placeholder skins are deleted. Twelve new hand-shaded 64x64 skins with populated second layers (Aether Knight, Cobalt Rogue, Sakura Ronin, Void Walker, Frost Warden, Solaris Mage, Cyber Drift, Obsidian Monarch, Crimson Valkyrie, Moss Spirit, Astral Traveler, Amethyst Duelist). They are original (CC0), authored by `tools/make-skins.mjs`, and checked by `node scripts/verify-skins.mjs` (64x64, at least 40 colours, no flat fills, outer layers populated).
- Eight new cloaks with cloth-wave shading and pixel-art motifs; four articulated wings (feathered angel, dragon membrane, crystal, nebula) with per-segment flap lag; seven emotes (Wave, Hug, Victory Backflip, Floating Meditate, Sword Spin, Hype Dance, Facepalm).

**Launcher screens cleaned up**
- Home is a 300px hero with one launch bar plus three Quickplay cards; the status pills and the right-hand panel are gone.
- Preferences are uniform 62px rows with one control each, in five sub-sections (General, Java & Memory, Storage & Shard Dedup, Accounts, Themes).
- Mods cards use a 138px body with a 38px status bar; HUD Design Studio fills the stage.

**Site**: new screenshots from the real UI; download links read from release.json for this exact tag.

**Not done / unverified**: emote and wing previews are rendered in software WebGL in CI-like conditions, never on a GPU. Card previews are rendered stills, not live animation. Authlib/Ely.by sign-in needs an OAuth client id. Not run on a real Windows desktop.

### Español
Primera versión estable. El instalador de Windows y el APK no están firmados (el APK usa clave de depuración) y el autor no los ha ejecutado en un equipo real ni en un teléfono (ver docs/REAL_DESKTOP_CHECKLIST.md).

**Cosméticos rediseñados (estilo Polyfrost Store)**
- Escenario de 360 px con modelo 3D (skinview3d, luz principal y de contorno, giro de 25 grados / inclinación de -10 grados) junto a un escaparate de tarjetas: Skins, Capas, Alas, Emotes, Mascotas, Sombreros y Máscaras, Paquetes.
- Se eliminan las cinco skins planas. Doce skins nuevas de 64x64 con sombreado a mano y segunda capa completa, originales (CC0), generadas por `tools/make-skins.mjs` y comprobadas con `node scripts/verify-skins.mjs`.
- Ocho capas nuevas, cuatro alas articuladas y siete emotes.

**Pantallas limpiadas**: Inicio con un héroe de 300 px y tres tarjetas de Quickplay; Preferencias en filas uniformes de 62 px; Mods con barra de estado de 38 px; Estudio de HUD a pantalla completa.

**Pendiente / sin verificar**: no se ha probado en un escritorio Windows real; las vistas previas de las tarjetas son imágenes renderizadas, no animación en vivo.

## 1.0.0-rc2

### English
Release candidate. Windows build unsigned, APK debug-signed and emulator-only (see STATUS.md).

**Launcher redesign (OneClient / OneConfig / Ankama references)**
- One 220px sidebar with grouped pill rows and a pinned account dock. The second category sidebar and the one-pixel borders around every panel are gone; surfaces carry the hierarchy.
- Four themes that change colours only: OneClient Cobalt (default), Luminos Neutral Dark, Minecraft Dark, Clean Light. Every text pair passes 4.5:1 (`npm test`).
- Mods: 4-column cards with a solid status bar, compact view, settings drawer, keybind recorder, and a "What changed" banner when a dependency flips.
- HUD Design Studio: drag with a 5px snap gap, selection chrome, docked inspector, custom .ttf/.otf fonts.
- Home: morphing launch bar, Resume and Quickplay strip, Host World dialog, skin rail with the space saved by dedup.
- Cosmetics: one pill bar, 55/45 stage and locker, OneConfig-style cards.
- Accounts: offline, Ely.by through authlib-injector (argument builder in luminos-core, 6 tests), Microsoft device-code (not live until an Azure app exists).
- Instances: profiles as plain JSON with a SHA-256 id and a verify-and-link button.

**Site**: new palette, new captures, download links read from release.json for the exact tag.

**Not done**: the FPS comparison with other packs was not measured (no GPU in CI). Ely.by browser sign-in needs an OAuth client id. P2P hosting is not deployed.

### Español
Versión candidata. Compilación de Windows sin firmar, APK con clave de depuración y solo probado en emulador (ver STATUS.md).

**Rediseño del lanzador (referencias OneClient / OneConfig / Ankama)**
- Una sola barra lateral de 220 px con filas agrupadas y la cuenta fijada abajo. Desaparecen la segunda barra de categorías y los bordes de un píxel en cada panel.
- Cuatro temas que solo cambian colores: OneClient Cobalt (por defecto), Luminos Neutral Dark, Minecraft Dark y Clean Light. Todos los pares de texto superan 4,5:1.
- Mods: tarjetas de 4 columnas con barra de estado sólida, vista compacta, panel de ajustes, grabador de teclas y aviso "Qué cambió" cuando cambia una dependencia.
- Estudio de HUD: arrastre con separación de 5 px, inspector acoplado y fuentes .ttf/.otf propias.
- Inicio: barra de lanzamiento animada, Reanudar y Quickplay, diálogo para alojar mundo y espacio ahorrado por deduplicación.
- Cosméticos: una barra de categorías, escenario y casillero 55/45.
- Cuentas: sin conexión, Ely.by con authlib-injector (6 pruebas en luminos-core) y Microsoft por código de dispositivo (no activo hasta que exista una app de Azure).
- Instancias: perfiles en JSON con id SHA-256 y botón de verificar y enlazar.

**Sitio**: paleta nueva, capturas nuevas y descargas desde release.json para la etiqueta exacta.

**Pendiente**: no se midió la comparación de FPS con otros paquetes (sin GPU en CI). El inicio de sesión de Ely.by en el navegador necesita un client id de OAuth. El alojamiento P2P no está desplegado.

## 1.0.0-rc1

### English
Release candidate. Not stable: builds are unsigned and nothing has been run on a real desktop yet (see Known limits).

**Shipped in #16 (v0.9.1 base)**
- Solid theme system: flat surfaces, no glass, no dither. Themes are colour token files with a contrast test.
- Five original skins, a skin editor (brush, eraser, fill, picker, mirror, layers, undo/redo, reference image), PNG import with plain error messages.
- Locker: 8 categories, pets, wings, hats, masks, bandanas, back items, emotes and cloaks, with an equip animation.
- Luminos Client logic in Java with 192 assertions: launcher settings reader, death recap, compass and chat coordinates, font pairs, keystrokes, crosshair, mod conflict policy, cosmetics reader.
- Client jars for Minecraft 26.3 and 1.21.11, built in CI, and the client reaches the title screen headlessly (Xvfb + llvmpipe) on both.

**Shipped in #17**
- Three solid themes, **Default, Lunar and Light**. A theme changes surfaces, text and accent only; `npm test` proves each theme file holds nothing but colours and passes WCAG AA 4.5:1, and a CI job screenshots the same screens in all three and fails if the layout differs.
- 3D skin previews with idle animation for the five skins; the "Where others see this" panel.
- Skin lookup by username through **Mojang only** (api.mojang.com, sessionserver, textures). Unknown names and players without a skin get a plain message.
- Microsoft account tokens are kept in the **OS secure store** (Windows Credential Manager, macOS Keychain, Linux keyring) and never in accounts.json. Older plaintext tokens are moved out on first load.
- Export an instance as .mrpack.

**Release pipeline:** one workflow builds Luminos-Setup.exe, a portable zip and the client jars, publishes SHA256SUMS.txt with build attestations, and runs the launcher's update check against the published release.

**Still open**
- In-game rendering hooks for the Java client (custom title screen, death-screen box, compass HUD, clickable chat coordinates, font picker, pets and wings drawn in game). The logic and tests exist; the drawing does not.
- Hand-off of launcher settings and Locker choices to the running client, and `ModPolicy` in the launch path.
- Microsoft sign-in is **UNVERIFIED**: it needs an Azure app registration only the owner can create (docs/MICROSOFT_AUTH.md). Token storage is tested; the network chain has not run against a real account.
- Jars for 26.2, 26.1.2 and 1.21.4 are not built for this release (1.21.4 keeps the older client-v0.2.0 jar).
- Code signing, real-desktop run (docs/REAL_DESKTOP_CHECKLIST.md), Windows ARM64 on ARM hardware, winget/scoop submission.
- The updater ignores release candidates unless LUMINOS_UPDATE_PRERELEASE=1.

**Added after #18 (session 19)**
- Live panel on real data with a clear split: Luminos modules and resource packs apply in the running game (**verified on Minecraft 1.21.11 at the title screen**); other mods queue for the next launch. Third-party mods do not live-swap.
- Tauri commands for dependency tracking, dedup, log redaction, Quick Play links and Discord, with typed bindings checked by a test. The crate compiles on Windows, Linux and macOS in CI. Quick Play has no button yet.
- Real Modrinth store, reflink-then-hardlink dedup (reflinks unverified), cross-instance sharing engine, P2P client (signalling Worker never deployed).
- Fixed `smoke.yml`: it was invalid YAML and had never run on main.
- Release manifest `site/src/lib/release.json` generated from SHA256SUMS.txt, so site links name the exact tag.

**Android (launcher preview)**
Android launcher preview: installs and manages instances; Minecraft does not launch yet. `Luminos-<version>.apk`, Android 8.0+, arm64-v8a and x86_64 only (Java runtimes are downloaded on the device), **signed with a debug key**, run only on an Android 11 x86_64 emulator in CI, never on a real device. Works: offline account, instances, Java runtime download and boot, Mojang file download with checks, Modrinth browsing, 3D skins, settings. Does not work: starting Minecraft (no OpenGL or window layer), Microsoft sign-in. Details: docs/ANDROID.md.

**Deferred on purpose:** live apply for third-party mods, P2P two-machine test, reflink verification, cross-instance saves in the UI, Android GL/window layer.

### Español
Versión candidata. No es estable: las compilaciones no están firmadas y nada se ha probado todavía en un escritorio real (ver Límites conocidos).

**Incluido de #16 (base v0.9.1)**
- Sistema de temas sólidos: superficies planas, sin vidrio ni tramado. Los temas son archivos de colores con prueba de contraste.
- Cinco skins originales, editor de skins (pincel, borrador, relleno, cuentagotas, espejo, capas, deshacer/rehacer, imagen de referencia) e importación de PNG con mensajes de error claros.
- Locker: 8 categorías, mascotas, alas, sombreros, máscaras, bandanas, objetos de espalda, emotes y capas, con animación al equipar.
- Lógica del Luminos Client en Java con 192 comprobaciones: lector de ajustes del launcher, resumen de muerte, brújula y coordenadas en el chat, pares de fuentes, teclas, mira, política de conflictos de mods y lector de cosméticos.
- JARs del cliente para Minecraft 26.3 y 1.21.11, compilados en CI; el cliente llega a la pantalla de título sin pantalla física (Xvfb + llvmpipe) en ambas versiones.

**Incluido de #17**
- Tres temas sólidos: **Default, Lunar y Light**. Un tema cambia solo superficies, texto y acento; `npm test` comprueba que cada archivo solo contiene colores y cumple WCAG AA 4,5:1, y un trabajo de CI captura las mismas pantallas en los tres temas y falla si el diseño cambia.
- Vistas previas 3D de skins con animación en reposo para las cinco skins; el panel «Dónde te ven los demás».
- Búsqueda de skins por nombre de usuario **solo con Mojang**. Un nombre desconocido o un jugador sin skin recibe un mensaje claro.
- Los tokens de la cuenta Microsoft se guardan en el **almacén seguro del sistema** (Administrador de credenciales de Windows, Llavero de macOS, llavero de Linux) y nunca en accounts.json. Los tokens antiguos en texto plano se mueven al primer arranque.
- Exportar una instancia como .mrpack.

**Pipeline de publicación:** un solo flujo genera Luminos-Setup.exe, un zip portable y los JARs del cliente, publica SHA256SUMS.txt con atestaciones de compilación y ejecuta la comprobación de actualizaciones del launcher contra la versión publicada.

**Pendiente**
- Ganchos de renderizado en el juego para el cliente Java (pantalla de título propia, caja en la pantalla de muerte, brújula, coordenadas clicables, selector de fuentes, mascotas y alas dibujadas en el juego). La lógica y las pruebas existen; el dibujo no.
- Traspaso de los ajustes del launcher y del Locker al cliente en ejecución, y `ModPolicy` en el arranque.
- El inicio de sesión de Microsoft está **SIN VERIFICAR**: requiere un registro de aplicación en Azure que solo el propietario puede crear (docs/MICROSOFT_AUTH.md). El almacenamiento de tokens está probado; la cadena de red no se ha ejecutado con una cuenta real.
- No hay JARs de 26.2, 26.1.2 ni 1.21.4 en esta versión (1.21.4 mantiene el JAR antiguo client-v0.2.0).
- Firma de código, prueba en escritorio real (docs/REAL_DESKTOP_CHECKLIST.md), Windows ARM64 en hardware ARM, envío a winget/scoop.
- El actualizador ignora las versiones candidatas salvo con LUMINOS_UPDATE_PRERELEASE=1.

**Añadido tras #18 (sesión 19)**
- Panel en vivo con datos reales y una separación clara: los módulos de Luminos y los paquetes de recursos se aplican en el juego en ejecución (**verificado en Minecraft 1.21.11 en la pantalla de título**); el resto de mods queda en cola para el próximo inicio. Los mods de terceros no se cambian en vivo.
- Comandos de Tauri para dependencias, deduplicación, redacción de registros, enlaces de Quick Play y Discord, con tipos comprobados por una prueba. El crate compila en Windows, Linux y macOS en CI. Quick Play aún no tiene botón.
- Tienda real de Modrinth, deduplicación con reflink y enlace duro (reflink sin verificar), motor para compartir entre instancias, cliente P2P (el Worker de señalización nunca se desplegó).
- Corregido `smoke.yml`: era un YAML inválido y nunca se había ejecutado en main.
- Manifiesto `site/src/lib/release.json` generado desde SHA256SUMS.txt: los enlaces del sitio apuntan a la etiqueta exacta.

**Android (versión previa del launcher)**
Versión previa del launcher para Android: instala y gestiona instancias; Minecraft todavía no se inicia. `Luminos-<versión>.apk`, Android 8.0+, solo arm64-v8a y x86_64 (los runtimes de Java se descargan en el dispositivo), **firmado con una clave de depuración**, probado solo en un emulador Android 11 x86_64 en CI, nunca en un dispositivo real. Funciona: cuenta sin conexión, instancias, descarga y arranque de Java, descarga de archivos de Mojang con verificación, exploración de Modrinth, skins en 3D, ajustes. No funciona: iniciar Minecraft (no hay capa OpenGL ni de ventana) ni el inicio de sesión de Microsoft. Detalles: docs/ANDROID.md.

**Aplazado a propósito:** aplicación en vivo de mods de terceros, prueba P2P entre dos equipos, verificación de reflink, guardados entre instancias en la interfaz, capa GL/ventana de Android.

## 0.5.0
- Auto-update, storage manager, honest username check, offline skin + cape server, original skins and cape, Client page, optional mods (Resourcify and others). See docs/RELEASE_NOTES.md.

# Changelog

## 0.4.0
- Network activity screen (Settings > Privacy): every host Luminos may contact, why, what is sent, per-host switch, live request counts.
- All outbound requests (including each redirect hop) are checked against a built-in host list; unlisted hosts and plain HTTP are refused.
- Website /privacy is generated from that same list.
- 29 original voxel icons (versions, loaders, game modes, items, mod categories) in `brand/icons/`.
- Fixed stale live test for the first-party client install.
