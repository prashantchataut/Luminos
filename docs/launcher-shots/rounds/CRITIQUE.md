# Launcher render rounds (1280x800 @2x, Playwright + SwiftShader; 3 rounds + a final)

Data: seeded demo account "Mira" and instances; real Mojang patch notes, real server status and icons (snapshot 2026-11-24), real Modrinth icons, real 48 skins / 14 capes. WebGL is software.

| Screen | Round 1 critique | Round 2 | Round 3 | Final |
|---|---|---|---|---|
| home | Full-body skin collides with preset chips; bottom third empty | Skin shrunk and moved; playtime + performance row added; reads dense and balanced | Same layout; no regressions | `home-4.png` |
| home-launching | Button morphs to a progress fill with a spinner: readable | unchanged | unchanged | `home-launching-4.png` |
| instances | Cards good; 2 empty grid cells | Search-box layout bug none here | New-instance card fills the grid | `instances-4.png` |
| library | Dense, but nothing says what is a "Pick" | Heading added | Badges re-labelled CI/Ref to match what the smoke test really loads | `library-4.png` |
| cosmetics | **Viewer background solid white** | Transparent; skin and cape render in WebGL; legible | unchanged | `cosmetics-4.png` |
| servers | Real icons/MOTD; nothing wrong | unchanged | unchanged | `servers-4.png` |
| client | Hairline preset clipped; keystroke captions truncated | Fixed (preview scale 3, shorter captions) | Overall balanced; QoL list scrolls | `client-4.png` |
| settings | Group nav stranded at the bottom (search `flex-1`) | Fixed | unchanged | `settings-4.png` |
| settings-performance | Same nav bug; diagnostic honestly says "No GPU" (SwiftShader) | Fixed | unchanged | `settings-performance-4.png` |
| onboarding-welcome / -signin / -import | Clean; sign-in shows a truthful desktop-only message in a browser | unchanged | unchanged | `onboarding-*-4.png` |

Rounds 1 and 2 were inspected image by image for home, cosmetics, client, settings-performance; instances, library, servers and onboarding were inspected on a contact sheet at reduced size. Welcome and import were not re-inspected after round 1 beyond a clean console and a successful render.
