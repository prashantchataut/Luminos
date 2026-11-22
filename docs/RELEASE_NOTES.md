## Luminos 0.3.0 — redesign + launch fixes

**Fixed**
- **Minecraft not opening on Fabric / Luminos Client.** Fabric profiles shipped a second ASM version and Fabric Loader refuses to start with duplicates. Libraries are now de-duplicated (highest version wins). Verified: Minecraft 1.21.4 + Fabric 0.20 + the full 28-mod client reaches the renderer.
- A manually chosen Java that is too old for the game version (e.g. Java 8 for 1.21) is now ignored instead of crashing instantly.
- **Terminal windows flickering 8–10 times** on start: every `java -version` probe opened a console. All child processes are now silent.
- Launcher opening multiple times: single-instance lock.
- JVM defaults: safe G1 preset on every Java (no `AlwaysPreTouch`, no experimental ZGC flags).

**New**
- Complete visual redesign: flat ink + hairline UI, labelled sidebar, mono micro-labels, segmented pixel progress, dithered horizon.
- New onboarding: live dithered orb, boot log with your real machine facts, left-rail stepper.
- New logo — the **lumen orb** — plus a distinct **Luminos Client** mark (orb inside HUD brackets), used in the mod icon (Mod Menu) and the in-game HUD editor header.
- New website. New licence (proprietary, all rights reserved).
- Static-CRT Windows build + provenance attestation; see `docs/WINDOWS_SECURITY.md`.

**Known limits:** not code-signed yet (SmartScreen warning), offline accounts only, Forge/NeoForge can't launch yet.
