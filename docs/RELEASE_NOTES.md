## Luminos 0.6.0

- **New desktop app** (Tauri 2 + React, `luminos-core` still the engine). Installer is 2.25 MB.
- **Launch fix.** Before every launch the launcher reads each jar's `fabric.mod.json`, solves the dependency graph for the
  selected Minecraft version, uses stable builds only (betas are opt-in) and drops optional mods that cannot load, telling you why.
  This is what stops Sodium 0.9.4-beta.1 from sitting next to Sodium Extra, which needs 0.9.3.
- **Luminos Client 0.3.0** for Minecraft 26.3 and 1.21.11 (`client-v0.3.0`), pinned by SHA-256 in the compat manifest.
- **CI gate.** The default preset must reach the title screen on 26.3 and 1.21.11 or the build fails.
- Real Modrinth icons, direction-aware page transitions, an Animations switch that sticks, reduced-motion respected.

Verify the download against `SHA256SUMS.txt`. Known gaps are listed in `docs/START_HERE.md`.
