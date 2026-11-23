## Luminos 0.4.0 — trust layer, accounts and multiplayer groundwork

Windows x64 installer (`Luminos-Setup.exe`), a portable exe and `SHA256SUMS.txt`. **Not code-signed yet**, so Windows SmartScreen will show an "unknown publisher" warning (see `docs/WINDOWS_SECURITY.md`). Verify your download against `SHA256SUMS.txt`; the build also carries a GitHub provenance attestation.

**New**
- **Network activity screen** (Settings > Privacy): every host the launcher may contact, why, and a per-host switch. Requests to unlisted hosts, and plain HTTP, are refused (each redirect hop is checked). No ads, no telemetry.
- **Website /privacy** is generated from that same host list, so it cannot drift from the code.
- **Servers page**: favourites, login-mode badges (offline-OK / online-mode required), version fit, direct connect, invite-link copy, and a plain-language message when a server needs a paid account.
- **Alternative auth servers**: Ely.by / Luminos accounts via authlib-injector (the standard way to get skins on non-Mojang auth).
- **Client compatibility manifest**: the Luminos Client jar is only installed when it matches your Minecraft version (fixes the "requires 1.21.4 but you have 26.x" crash).
- 29 original voxel icons.

**Verified before release** (ran in CI/sandbox): launcher unit and integration tests (54+), the auth-server conformance suite, a login-mode probe against a real vanilla 1.21.4 server, and live reachability of every registered host.

**Not verified / known limits**
- Offline accounts only for play; Microsoft sign-in is not wired yet (needs an Azure app id).
- Authlib-injector in a real game session and quick-join are written but not yet exercised on a live server.
- Luminos Client currently ships for Minecraft 1.21.4 only; Forge/NeoForge cannot launch yet.
- Skins you pick offline are visible to you only on online-mode servers; this is how Minecraft works, and the cosmetics system that addresses it is still in progress.
- No Android build yet.
