/** Starts Discord presence from real launcher events: when a game is running, hand the launcher (Rust) the instance, loader and the player's sharing choices.
 *  The launcher's runner owns the Discord connection and follows the game's world/server through the in-game agent. */
import { bootstrap, isTauri, onLaunch } from "./api";
import { engine } from "./engine";
import { getSettings } from "./store";

export function startPresenceLink() {
  if (!isTauri) return;
  onLaunch(async (e) => {
    if (e?.phase !== "running" && e?.phase !== "exited") return;
    const s = getSettings();
    if (e.phase === "exited") { engine.presenceUpdate({ enabled: false, state: "menus", shareServer: false, shareInstanceName: false, startedUnix: 0 }).catch(() => {}); return; }
    const inst = (await bootstrap()).instances.find((i) => i.id === e.id);
    engine.presenceUpdate({ enabled: s.presenceOn, instanceName: inst?.name ?? null, loader: inst?.loader.toLowerCase() ?? null, mcVersion: inst?.mc ?? null, state: "menus", shareServer: s.presenceServer, shareInstanceName: s.presenceName, startedUnix: Math.floor(Date.now() / 1000) }).catch(() => {});
  });
}
