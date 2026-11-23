# Third-party notices

Luminos is proprietary (see `LICENSE`), but it stands on open-source work. These keep their own licences.

| Component | Use | Licence |
|---|---|---|
| [egui / eframe](https://github.com/emilk/egui) | UI toolkit | MIT OR Apache-2.0 |
| [Inter](https://rsms.me/inter/) | UI typeface | SIL Open Font License 1.1 |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | monospace typeface | SIL Open Font License 1.1 |
| ureq, serde, zip, flate2, tar, sha1, md5, dirs, chrono, image, open | engine crates | MIT / Apache-2.0 |
| [Fabric Loader & API](https://fabricmc.net) | mod loader the Luminos Client builds on | Apache-2.0 / CC0 |
| Sodium, Lithium, Entity Culling, Mod Menu, … | downloaded at install time from Modrinth, never redistributed by Luminos | each mod's own licence |

Mod files are fetched directly from Modrinth's public API at the user's request, so each author's licence
and Modrinth's terms apply to them. Minecraft game files come straight from Mojang's servers.

## Added in session 6
- **authlib-injector** v1.2.8 (AGPL-3.0, https://github.com/yushijinhun/authlib-injector). Downloaded at runtime as a separate jar with a pinned SHA-256 and attached with `-javaagent`. Not linked into or redistributed with Luminos.
- **axum, tokio, rsa, sha1, sha2, argon2, rand, base64, md5** (MIT/Apache-2.0) in `luminos-auth` / `luminos-core`. Run `cargo deny check` in CI before a release; it has not been run here.
