# Discord Rich Presence

* Payload: `core/src/presence.rs::build`, mirrored in `app/src/presence.ts` for the Settings preview. `docs/fixtures/presence-golden.json` is asserted by both.
* What is sent: `name` "Luminos", instance name (if shared), "In menus" / "Singleplayer" / "Multiplayer" (server address only if shared), loader icon, elapsed timer. There is no field for a token or an account name, so neither can be sent.
* "Playing Luminos": Discord shows the **application's** name. Create an application named **Luminos** at discord.com/developers, upload Rich Presence art assets with the keys `luminos`, `fabric`, `forge`, `quilt`, `neoforge`, and set `LUMINOS_DISCORD_CLIENT_ID` to its numeric id. Without an id presence stays off.
* UNVERIFIED: a live capture from a second account. Manual test: run Discord, start the launcher with the id set, open Settings > Discord, watch a second account's friend list.
