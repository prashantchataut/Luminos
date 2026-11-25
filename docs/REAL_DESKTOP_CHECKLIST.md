# Real-desktop checklist

Things only a real machine can confirm. CI runners have no GPU, no display, no SmartScreen and no Microsoft account.
`- [ ]` = not confirmed on a real machine. Tick it only with a note (who, when, OS, GPU). The release notes' **Known limits** block is generated from the unchecked lines here (`scripts/release-notes.mjs`), so a release cannot claim more than this file proves.

## Confirmed on CI runners (not a substitute for the items below)
- [x] Windows installer builds, installs silently and starts on a clean `windows-latest` runner (release.yml, `perf` artifact).
- [x] Themes are colours only and pass 4.5:1 (`npm test`); layout identical across themes in headless Chromium (themes.yml).
- [x] Client jars build for 26.3 and 1.21.11 and reach the title screen under Xvfb + llvmpipe (smoke.yml).
- [x] Account tokens round-trip through the OS secure store: Windows Credential Manager on `windows-latest`, kernel keyring on Linux; accounts.json never holds one.

## Themes
- [ ] Default, Lunar and Light each switch live from Settings without a restart; no text is hard to read on a laptop screen in daylight (Light) and at night (Lunar).
- [ ] Windows "High contrast" mode and 125% / 150% display scaling do not break any screen in any theme.

## Skins and Locker
- [ ] All five skins (Luminos Default, Ember, Glasshouse, Nightshift, Paper) render in 3D with the idle animation on a real GPU, at 60 fps, no flicker.
- [ ] Skin editor: draw, mirror, undo/redo, import a 64x64 and a 64x32 PNG, export; slim/classic detection is right.
- [ ] Locker: equip a pet and wings together; each shows in the 3D preview and survives a restart.
- [ ] "Where others see this" matches reality: join a server as a Microsoft account after applying a skin and check another player sees it.
- [ ] Username lookup: a real name finds the skin; a made-up name says "no account"; a name without a skin says so; offline (no network) fails with a plain message.
- [ ] .mrpack export opens in another launcher (Modrinth App / Prism).

## Microsoft sign-in (UNVERIFIED: needs the owner's Azure app, docs/MICROSOFT_AUTH.md)
- [ ] Device-code sign-in with a real Java-owning account succeeds and the account appears in the launcher.
- [ ] A "Luminos launcher" entry is visible in Windows Credential Manager, and `%APPDATA%\...\accounts.json` contains no token.
- [ ] After a restart the account is still signed in; "Remove account" deletes the Credential Manager entry.
- [ ] An account that does not own Java Edition gets the plain message, not a crash.

## Install and update
- [ ] SmartScreen: confirm the "unknown publisher" path works as documented in docs/WINDOWS_SECURITY.md.
- [ ] Installer on a clean Windows 10 and a clean Windows 11 machine; uninstall leaves no files.
- [ ] Portable zip runs from a USB stick and keeps its data in `data\`.
- [ ] Updater: install v0.6.0, set `LUMINOS_UPDATE_PRERELEASE=1`, see the rc, update, relaunch.
- [ ] Windows ARM64: not run on ARM hardware at all.

## In-game client (the drawing is not built, see CHANGELOG "Still open")
- [ ] Luminos Client jar loads on 1.21.11 and 26.3 with a real GPU and reaches the title screen.
- [ ] Launcher settings and Locker choices reach the running client.
