## Luminos 0.5.0

Windows launcher. **Unsigned**: Windows SmartScreen will warn ("More info" > "Run anyway"). Check the download against `SHA256SUMS.txt`.

### New
- **Auto-update.** Luminos checks GitHub for a newer release on start (one request, switchable in Settings and Network activity), downloads `Luminos-Setup.exe`, verifies its SHA-256 against the release's `SHA256SUMS.txt`, then installs silently. Unit-tested; the silent install itself has not been run on a real PC yet.
- **Storage and your data.** See what uses disk, free the download cache / Minecraft files / Java runtimes, reset launcher data (worlds kept), or delete everything (type DELETE).
- **Honest username check.** Specific format errors, plus whether a premium account already uses the name. Offline names are not reserved by anyone, and the app says so.
- **Your skin in game, offline.** Offline accounts now start a tiny skin server on 127.0.0.1 and load your skin and cape through authlib-injector (the way other open-source launchers do it). Tested over real TCP. **Not yet observed in a running game.** Other players see your skin only on servers that support it.
- **Original skins and cape.** Four new Luminos skins (new default: Luminos Pilot) and the Moon Cape, drawn from scratch.
- **Client page.** The launcher edits the same `luminos-client.json` as the in-game menu. Optional mods: Resourcify (in-game pack browser), Iris, Zoomify, Controlify, Status Effect Bars.

### Fixed
- The About card claimed "open source"; Luminos is proprietary and source-available.

### Known gaps
Minecraft Client works on 1.21.4 only. Microsoft sign-in needs an Azure app id. Windows cards still use Mojang patch-note art, not our own captures. See `docs/PLAN_SESSIONS.md`.
