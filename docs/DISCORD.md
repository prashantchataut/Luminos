# Discord Rich Presence

* Payload: `core/src/presence.rs::build`, mirrored in `app/src/presence.ts` for the Settings preview. `docs/fixtures/presence-golden.json` is asserted by both.
* What is sent: `name` "Luminos", instance name (if shared), "In menus" / "Singleplayer" / "Multiplayer" (server address only if shared), loader icon, elapsed timer. There is no field for a token or an account name, so neither can be sent.
* "Playing Luminos": Discord shows the **application's** name. Create an application named **Luminos** at discord.com/developers, upload Rich Presence art assets with the keys `luminos`, `fabric`, `forge`, `quilt`, `neoforge`, and set `LUMINOS_DISCORD_CLIENT_ID` to its numeric id. Without an id presence stays off.
* UNVERIFIED: a live capture from a second account. Manual test: run Discord, start the launcher with the id set, open Settings > Discord, watch a second account's friend list.

## Session 18/19 status: wired, not live
* The launcher now starts presence itself (`app/src-tauri/src/discord.rs`): the UI sends the instance, loader and sharing choices when a game starts (`app/src/presenceLink.ts`), the runner follows the world and server through the in-game agent, reconnects when Discord starts later, and clears presence when the game exits. Settings shows the real runner status.
* **It sends nothing until an application id exists.** Discord shows the registered application's name, so create an application named **Luminos** in the Discord Developer Portal, upload art assets `luminos`, `fabric`, `forge`, `quilt`, `neoforge`, and make the one-line change: paste its Application ID (a public number) into `APP_ID` in `app/src-tauri/src/discord.rs` (or set `LUMINOS_DISCORD_CLIENT_ID`). Until then the status reads "Not started: no Discord application id is set".
* **UNVERIFIED:** a real Discord client and the "Playing Luminos" capture. IPC framing is tested against a fake socket; the runner is compiled, not run against Discord.
