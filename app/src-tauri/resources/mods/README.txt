The release workflow copies the compiled luminos-client-<version>-mc<minecraft>.jar files here before `tauri build`,
so the installer carries the in-game client. Luminos copies the jar for the selected Minecraft version into <game dir>/mods before launch.
