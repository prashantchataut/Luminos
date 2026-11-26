# Luminos 2.2.0: what is verified and what is not

Legend: **RAN** = executed here and passed · **COMPILED** = built, never run · **NOT RUN** = written, not executed · **NO** = not done.

| Area | State | Evidence / limit |
|---|---|---|
| Original logo restored (app, icons, site) | RAN | files restored from `74483cf^`; `scripts/verify-v2.2.mjs` |
| Artwork audit + wiring | RAN (static) | `docs/design/USER_ART_AUDIT.md`; images inspected at thumbnail size only |
| React app (`tsc` + `vite build`) | RAN | `npm run build` succeeds |
| New UI viewed in a browser | **NO** | headless Chromium would not start here (missing system libraries), so **no 2.2.0 screenshots exist**. `app/tools/shots-v22.mjs` is ready for a machine that can run it. The 3D stage, Bento cards and wizard have never been looked at. |
| Skins / capes generator | RAN | 16 skins (>= 911 unique colours, 0 flat 4x4), 10 capes; previews of 4 skins and 8 capes were viewed |
| Fabric client mod (1.21.11) | COMPILED | Gradle build succeeded on JDK 25. **Never launched**: window icon/title, title-screen buttons and the background have not been seen in a running game |
| `client26` (Minecraft 26.x) | NOT RUN | still uses the older `TitleView`; only the shared `WindowBrand` applies |
| `luminos-core` updater / MS auth | COMPILED | `cargo check`; unit tests in `update.rs` |
| `app/src-tauri` commands (`check_app_update`, `install_app_update`, `start_microsoft_device_login`, `open_external`) | NOT RUN | cannot be compiled on this machine (no webkit2gtk); first compile is CI's |
| Silent self-update on Windows | NOT RUN | `/S /UPDATE` relaunch behaviour assumed from Tauri's NSIS template |
| Microsoft sign-in | NOT RUN | needs an Azure app id (`LUMINOS_MS_CLIENT_ID`, runtime or CI secret). None is configured, so sign-in shows the setup error |
| "OpenJDK Platform binary" in the taskbar *hover group label* | NOT SOLVED | the title and icon are set; the group label on some Windows versions comes from the JVM exe's file description |
| 3D player preview, Quickplay bar, skin head on the in-game title | NO | no player entity exists on the title screen; omitted rather than faked |
| Capes rendered in game | NO | launcher preview only; no cosmetics service or renderer mixin |
| FPS benchmark table | NO | none measured |
| 8 new modules (Snaplook, AutoGG, Nick Hider, ...) | launcher settings only | flagged "Client build pending" in the UI |
