# Changelog

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
