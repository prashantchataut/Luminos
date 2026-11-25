/** Mirror of `core/src/presence.rs::build`. The Settings preview renders this function's output; the launcher sends the Rust one.
 *  `docs/fixtures/presence-golden.json` is asserted by both (`tools/presence.test.mjs` and `cargo test presence`). */
export type PresenceInput = { enabled: boolean; instanceName: string | null; loader: string | null; mcVersion: string | null; state: "menus" | "singleplayer" | "multiplayer"; serverAddress: string | null; shareServer: boolean; shareInstanceName: boolean; startedUnix: number };
export type Activity = { name: string; type: 0; details: string; state: string; timestamps: { start: number }; assets: { large_image: string; large_text: string; small_image?: string; small_text?: string } };
const clip = (s?: string | null) => { const t = [...(s ?? "").trim()].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127).slice(0, 128).join(""); return [...t].length >= 2 ? t : null; };
const LOADERS: Record<string, [string, string]> = { fabric: ["fabric", "Fabric"], forge: ["forge", "Forge"], quilt: ["quilt", "Quilt"], neoforge: ["neoforge", "NeoForge"] };
export function buildPresence(i: PresenceInput): Activity | null {
  if (!i.enabled) return null;
  const details = (i.shareInstanceName ? clip(i.instanceName) : null) ?? "Playing with Luminos";
  const state = i.state === "singleplayer" ? "Singleplayer" : i.state === "multiplayer" ? (i.shareServer ? clip(i.serverAddress) : null) ?? "Multiplayer" : "In menus";
  const assets: Activity["assets"] = { large_image: "luminos", large_text: "Luminos" };
  const l = LOADERS[(i.loader ?? "").toLowerCase()];
  if (l) { assets.small_image = l[0]; const v = clip(i.mcVersion); assets.small_text = v ? `${l[1]} ${v}` : l[1]; }
  return { name: "Luminos", type: 0, details, state, timestamps: { start: i.startedUnix }, assets };
}
