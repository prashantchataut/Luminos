# Cracked/offline launchers: how multiplayer and skins really work (researched 2026-11-23)

Sources: HMCL docs "离线模式下更换皮肤" (docs.hmcl.net/launcher/offline-skin.html); PCL-CE PR #3518 "offline custom skin support" (embedded Yggdrasil skin server + authlib-injector javaagent); Zalith Launcher docs on offline skins; unmojang/FjordLauncher issue #18 (authlib-injector skins invisible on offline servers); SkinsRestorer docs ("How a skin reaches a player", MineSkin signed properties); authlib-injector README.

## Multiplayer
- Offline account = a name + UUID `nameUUIDFromBytes("OfflinePlayer:"+name)`. Servers with `online-mode=false` don't ask Mojang to verify, so any name joins. Servers with `online-mode=true` require a real Microsoft session and **cannot** be joined with an offline account. Luminos does not bypass that (and says so in plain language: servers page, login-mode probe).
- Name "taken" checks: there is no such thing for offline names. Nothing stops two people using the same name; on a server, the second one is rejected as "already logged in". What Luminos *can* truthfully show is whether the name belongs to a premium Minecraft account (Mojang profile lookup), because premium servers will demand that account and a skin lookup returns that player's skin. Implemented in setup ("Premium name / free name").

## Why "my skin vanished in multiplayer"
1. **Your own client** needs a skin source: a vanilla offline game shows Steve/Alex-by-UUID. Every launcher that offers offline skins runs a tiny **local Yggdrasil skin server on 127.0.0.1** and starts the game with `-javaagent:authlib-injector.jar=http://127.0.0.1:<port>` so the game asks *it* for the profile and texture (PCL-CE, Zalith, HMCL all do this). Result: you see your own skin everywhere you play, singleplayer or any server. **Luminos 0.5.0 does this** (`luminos-core::offlineskin`).
2. **Other players** only see it if the server hands them a skin property for your UUID. An offline server doesn't, unless it runs SkinsRestorer (looks the skin up by name/URL, stores a MineSkin-*signed* property, applies on join) or players share a CustomSkinLoader-style setup or the server uses authlib-injector with a matching Yggdrasil API (Ely.by, LittleSkin, Drasl, luminos-auth). HMCL's own docs say plainly: with a local file "other players may not see your skin"; with LittleSkin/Blessing Skin "players using the same method see you, others don't".
3. authlib-injector + Ely.by on an offline server has its own bug (FjordLauncher #18): the server asks for the *offline UUID*, which the auth server doesn't know. Drasl resolves offline UUIDs; Ely.by doesn't. Luminos-auth should resolve offline UUIDs the way Drasl does (task C3 follow-up).

## What Luminos will do (ordered)
- [x] Embedded local skin server for offline accounts (own skin + cape visible in game). Built, unit-tested over real TCP, **not yet observed in a running game**.
- [ ] D4: Luminos Client mod that renders other *Luminos* players' skin/cape/cosmetics (needs the cosmetics service) so two Luminos users see each other on any offline server.
- [ ] C7: "Luminos Skins Bridge" Paper/Fabric server plugin (original code, not SkinsRestorer's) that looks up the player's Luminos skin and applies a property, so non-Luminos players see it too. On offline servers the server may set any property.
- [ ] D5: UI matrix "Where will others see my skin?" (plain-text version on the Skins page now; full matrix with live detection later).
