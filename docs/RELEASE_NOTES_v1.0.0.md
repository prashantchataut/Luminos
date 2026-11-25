## Luminos v1.0.0 — Complete OneClient & Polyfrost UI overhaul

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

