# Changelog

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
