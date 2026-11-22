<p align="center">
  <img src="brand/luminos-256.png" width="120" alt="Luminos logo" />
</p>

<h1 align="center">Luminos</h1>
<p align="center"><b>The light, fast Minecraft launcher with a built-in client.</b><br/>
Free · open source · written in Rust · blue, dithered, and quick.</p>

<p align="center">
  <a href="https://github.com/prashantchataut/Luminos/releases/latest/download/Luminos-Setup.exe"><b>⬇ Download Luminos-Setup.exe</b></a> ·
  <a href="https://prashantchataut.github.io/Luminos/">Website</a> ·
  <a href="CONTINUITY.md">Progress log</a> ·
  <a href="docs/RESEARCH.md">Research &amp; ideas</a>
</p>

![Luminos home](docs/screenshots/06-home.png)

Luminos is a **standalone launcher** (like the Minecraft Launcher, SKLauncher or TLauncher) with an **integrated performance client** (in the spirit of Lunar / Feather) — not a mod you drop into a folder. Install it, pick a profile, play.

## Install
| Platform | Download |
|---|---|
| Windows 10/11 | **`Luminos-Setup.exe`** (per-user, no admin) or `Luminos-Portable.exe` from [Releases](https://github.com/prashantchataut/Luminos/releases/latest) |
| Linux x86-64 | `Luminos-linux-x86_64.tar.gz` from Releases |

Your instances and worlds live in your user data folder (`%APPDATA%\Luminos` on Windows); uninstalling never deletes them.

## What's inside
- **Mod library** – search Modrinth for mods, modpacks, shaders, resource packs and data packs; one-click install with required dependencies.
- **Auto-update & unlink** – update one mod or a whole instance via hash lookups; unlink a mod to pin it.
- **Isolated instances** – own mods/saves/config/Java per instance; duplicate, import `.mrpack`.
- **Luminos Client** – Fabric preset with an optimisation stack (Sodium, Lithium, Entity Culling, FerriteCore, ImmediatelyFast, Mod Menu …) plus a first-party HUD mod: Armor HUD, Keystrokes, CPS, FPS, coordinates, potion HUD, toggle sprint, zoom and a drag-and-drop HUD editor.
- **Skin studio** – 64×64 pixel editor, front/back preview, slim arms, username import.
- **Playtime** – per instance, per day, weekly chart.
- **Quality of life** – world backups (zip/restore/prune), crash doctor, server hub with live ping, smart JVM flags (ZGC / Aikar G1), Java auto-detect + one-click Temurin download, Minecraft news.
- **Tiny** – single native binary, no Electron, near-zero idle CPU.

All screenshots in this repo are **real renders of the UI** produced by `luminos-shots` (no mock-ups).

## Honest status
Works: Fabric / Quilt / Vanilla launching, Modrinth, skins, playtime, backups, crash doctor, servers.
In progress: Microsoft sign-in (engine written, not wired), in-game verification of the client HUD mod, Forge / NeoForge, launcher self-update.
See [CONTINUITY.md](CONTINUITY.md) for the exact, per-feature verification state.

## Build from source
```bash
cd launcher
cargo run -p luminos-app --release                 # launcher
cargo test -p luminos-core                         # engine tests
cargo run -p luminos-app --release --bin luminos-shots -- ../docs/screenshots   # re-render screenshots
python tools/make_brand.py                         # regenerate logo / icon / installer art (needs pillow)
cd ../client && ./gradlew build                    # client HUD mod (JDK 21)
cd ../site && npm ci && npm run build              # website
```
Windows installer: `iscc /DAppVersion=0.2.0 installer/luminos.iss` (Inno Setup 6). Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed.

## Repository map
`launcher/crates/luminos-core` engine · `launcher/crates/luminos-app` egui UI · `client/` Fabric HUD mod · `site/` website (Vite + React + Tailwind) · `installer/` Inno Setup · `brand/` logo & icons · `docs/` research, skills, screenshots.

## Legal
Luminos is an independent project, **not affiliated with Mojang or Microsoft**. It ships no Mojang assets; game files are downloaded from Mojang's servers, and mods/packs come from [Modrinth](https://modrinth.com)'s public API. Please support the game: buy Minecraft if you can. Gallery images on the website belong to their authors. Licensed GPL-3.0-or-later.
