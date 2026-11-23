# Multiplayer in Luminos: how it works, and what it won't do

## Account types
| Type | Works on | Notes |
|---|---|---|
| Offline | Offline-mode servers, LAN | UUID = vanilla `OfflinePlayer:<name>` |
| Microsoft | Everything (engine written, sign-in not wired: needs an Azure app id) | |
| Ely.by | Servers running authlib-injector → Ely.by | Also usable on Ely.by-enabled launcher servers |
| Luminos | Servers running authlib-injector → a luminos-auth instance | see `LUMINOS_AUTH_SERVER.md` |

## What Luminos will not do
It will not bypass Mojang/Microsoft authentication. If a server is `online-mode=true` and trusts Mojang only, an offline account cannot join and the UI says exactly that, before the game starts (the login pre-flight).

## Login pre-flight
Before quick-joining, Luminos sends the same Handshake + Login Start a real client sends and reads the first reply: Encryption Request = online-mode, Login Success/Set Compression = accepts offline, Disconnect = classified (whitelist, ban, version). Verified against a real vanilla 1.21.4 server in both modes (`tools/ci/server-login-test.sh`). Note: on an offline server the probe appears in the server log as your player connecting and disconnecting.

## Server directory
Community entries live in `site/public/server-directory.json` (PR to add one). The launcher shows an entry only after it answers a status ping, and re-probes login mode on join; `offline_friendly` in the file is a claim, not trusted. Each entry has a report link. The launcher UI page is not built yet; the logic is in `directory.rs`.

## LAN and "Host a world": evaluation only (not built)
| Option | Cost | Abuse and limits |
|---|---|---|
| playit.gg-style relay (third party) | free tier exists; terms apply | their ToS and tunnel limits; users depend on a third party |
| Our own TCP relay (a ~US$4–6/month VPS, e.g. frp/rathole) | bandwidth: Minecraft traffic is small (rough guess 50–200 MB per player-hour, unmeasured); a 1 TB/month VPS allowance covers a lot | needs per-account tunnel limits, ephemeral subdomains, a kill switch, and no Mojang-asset hosting |
| Direct (UPnP / port-forward) | free | fails behind CGNAT |
Recommendation: start with a documented playit-style integration that the user opts into, and build our own relay only if usage justifies the ops burden.

## Invite links
`luminos://join?server=host:port&version=1.21.4&name=Label`, strictly parsed (hostname + port, short version, short label; no shell or path use). Copy-link works in the Servers page. The OS handler registration is not done.
