# Who can see your skin

A client mod cannot make another player's vanilla client draw your skin. The server sends each player's skin to everyone, so one of these has to be in place. Read 2026-11-24.

| Path | Who sees it | What is needed | Source |
|---|---|---|---|
| Mojang account (premium, online-mode server) | Everyone | Microsoft sign-in; the skin is applied through `POST api.minecraftservices.com/minecraft/profile/skins` | Mojang API |
| SkinsRestorer | Everyone on that server | The plugin on the server; the player runs `/skin url "<link to PNG>"` | skinsrestorer.net/docs/configuration/commands-permissions |
| skin-overrides | Everyone on a server that has it | The mod on the server; its networking feature shares the override "even if they don't have the mod" | modrinth.com/mod/skin-overrides (changelog 2.2.0, "networking") |
| authlib-injector | Everyone on that server | Server started with `-javaagent:authlib-injector.jar=<api root>`; textures come from the standard profile endpoint | docs/LUMINOS_AUTH_SERVER.md |
| Luminos client on both sides | Luminos users | Nothing extra | this project |
| Vanilla offline server, no plugin | Nobody | Other players see the default skin. | |

## Correction to the brief
The brief asked for `/skin set <url>`. In SkinsRestorer, **`/skin set` takes a player name; `/skin url <url>` takes a link.** The UI gives `/skin url "<link>"`. SkinsRestorer needs a **public link** to the PNG, so the UI asks for one; a local file cannot be used.

## What the UI says
A "Where others see this" panel with four rows (Luminos users, online-mode servers, SkinsRestorer servers, everyone else). For a vanilla offline server: "Other players will see your default skin. The server needs SkinsRestorer or skin-overrides." A "Server owner setup" page lists all four paths.

## Licence line kept
Skins are copied only from the Mojang API, by name, and the UI says it is a copy, not a link. NameMC and MC-Skins.net are not scraped (docs/research/SKINS_AND_CAPES.md).
