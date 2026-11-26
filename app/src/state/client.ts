import { useSyncExternalStore } from "react";
import { MODULES, modById, type Setting } from "../data/modules";
import { BINDS } from "../data/keybinds";
import { safeInvoke, safeWrite } from "../lib/tauri-bridge";
import { set as setEngine } from "../store";
import { ITEMS, getLocker, onLocker, setCapeFromGame } from "../locker/catalog";

export type Preset = "Competitive PvP" | "Survival Plus";
export type Prefs = {
  resolution: string; launcherVis: "Keep Open" | "Hide while Playing" | "Minimize to Tray"; engine: "Max FPS" | "Balanced"; preset: Preset;
  gameVersion: string; tab: string; hudPos: Record<string, [number, number]>; hudLock: boolean; hudGui: boolean;
};
type State = { on: Record<string, boolean>; cfg: Record<string, Record<string, unknown>>; favs: string[]; keys: Record<string, { key: string; mode?: "Hold" | "Toggle" }>; prefs: Prefs };

export const PRESETS: Record<Preset, { blurb: string; mods: string[] }> = {
  "Competitive PvP": { blurb: "Combat HUD on, visual noise off.", mods: ["keystrokes", "cps", "fps", "ping", "armor", "potions", "combo", "reach", "togglesprint", "zoom", "lowfire", "crosshair", "blockoverlay", "hurtcam", "clearfog"] },
  "Survival Plus": { blurb: "Navigation and comfort for long sessions.", mods: ["waypoints", "minimap", "coordinates", "fullbright", "zoom", "togglesprint", "deathrecap", "armor", "potions", "freelook", "chatting", "fps"] },
};

const KEY = "luminos.client.v3";
const fresh = (): State => ({
  on: Object.fromEntries(MODULES.map((m) => [m.id, m.on])),
  cfg: {}, favs: ["waypoints", "minimap", "zoom"],
  keys: Object.fromEntries(BINDS.map((b) => [b.id, { key: b.key, mode: b.mode }])),
  prefs: { resolution: "1280 × 800 (Default)", launcherVis: "Keep Open", engine: "Balanced", preset: "Competitive PvP", gameVersion: "1.21.11", tab: "general", hudPos: {}, hudLock: false, hudGui: true },
});
let state: State = fresh();
try {
  const j = JSON.parse(localStorage.getItem(KEY) || "null");
  if (j) state = { ...state, ...j, on: { ...state.on, ...j.on }, keys: { ...state.keys, ...j.keys }, prefs: { ...state.prefs, ...j.prefs } };
} catch { /* first run */ }

const subs = new Set<() => void>();
/** `persist=false` is for state that just came FROM the game file: it must not be written straight back. */
function commit(next: State, persist = true) {
  state = next;
  if (persist) localStamp = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  // The game reads this file. Failures (plain browser, missing command) fall back silently in safeWrite.
  if (persist) safeWrite("write_client_settings", { json: JSON.stringify({ modules: state.on, moduleSettings: state.cfg, keybinds: state.keys, profile: state.prefs.preset, engine: state.prefs.engine }) });
  if (persist) pushGameConfig();
  subs.forEach((f) => f());
}
/** HUD positions are shared as fractions of this canvas (HudStudio draws on it; the game maps it back to GUI pixels). */
export const REF_W = 640, REF_H = 360;
let localStamp = 0, lastCape = "";
const gameCapeId = (): string => (getLocker().equipped.cloaks ?? "").replace(/^cloak-/, "");
/** The shared schema, identical to LuminosClientConfig in src-tauri and LauncherSync.java: <game dir>/config/luminos/config.json */
function clientConfig() {
  const hotkeys: Record<string, string> = { open_mod_menu: state.keys.menu?.key ?? "RCTRL", open_search: "RSHIFT" };
  for (const [id, k] of Object.entries(state.keys)) hotkeys[id] = k.key;
  const hud: Record<string, { nx: number; ny: number; enabled: boolean }> = {};
  for (const [id, [x, y]] of Object.entries(state.prefs.hudPos)) hud[id] = { nx: x / REF_W, ny: y / REF_H, enabled: state.on[id] ?? true };
  lastCape = gameCapeId();
  return { version: 3, writtenBy: "launcher", modules: state.on, moduleSettings: state.cfg, hotkeys, hud, cape: lastCape, preset: state.prefs.preset };
}
function pushGameConfig() { safeWrite("save_client_config", { config: clientConfig() }); }
/** Write it right now (Launch Game does this first, so the game starts with exactly what the launcher shows). */
export async function writeGameConfigNow() { await safeInvoke("save_client_config", { config: clientConfig() }, null); }
type GameFile = { modules?: Record<string, unknown>; hotkeys?: Record<string, unknown>; hud?: Record<string, { nx?: number; ny?: number }>; cape?: string };
/** Take whatever the game (or an earlier launcher run) left in the shared file into the launcher: toggles, keys, HUD positions, cape. */
export async function pullGameConfig() {
  const t0 = localStamp;
  const j = await safeInvoke<GameFile | null>("load_client_config", {}, null);
  if (!j || localStamp !== t0 || Date.now() - localStamp < 1500) return; // a local edit is in flight: it wins
  const on = { ...state.on }, keys = { ...state.keys }, hudPos = { ...state.prefs.hudPos };
  let changed = false;
  for (const m of MODULES) { const v = j.modules?.[m.id]; if (typeof v === "boolean" && on[m.id] !== v) { on[m.id] = v; changed = true; } }
  for (const id of Object.keys(keys)) { const v = j.hotkeys?.[id]; if (typeof v === "string" && v && keys[id].key !== v) { keys[id] = { ...keys[id], key: v }; changed = true; } }
  for (const [id, o] of Object.entries(j.hud ?? {})) {
    if (typeof o?.nx !== "number" || typeof o?.ny !== "number") continue;
    const p: [number, number] = [Math.round(o.nx * REF_W), Math.round(o.ny * REF_H)], cur = hudPos[id];
    if (!cur || cur[0] !== p[0] || cur[1] !== p[1]) { hudPos[id] = p; changed = true; }
  }
  if (typeof j.cape === "string" && j.cape !== gameCapeId()) {
    const id = j.cape ? "cloak-" + j.cape : null;
    if (id === null || ITEMS.some((i) => i.id === id)) { lastCape = j.cape; setCapeFromGame(id); }
  }
  if (changed) commit({ ...state, on, keys, prefs: { ...state.prefs, hudPos } }, false);
}
/** Keep the launcher in step with the game while both are open: on start, on window focus, every 2 s while visible. Returns the cleanup. */
export function startGameConfigSync() {
  const pull = () => { if (!document.hidden) void pullGameConfig(); };
  void pullGameConfig();
  addEventListener("focus", pull);
  const t = window.setInterval(pull, 2000);
  // Equipping a cape in the Capes screen writes the shared file too.
  const off = onLocker(() => { if (gameCapeId() !== lastCape) { localStamp = Date.now(); pushGameConfig(); } });
  return () => { removeEventListener("focus", pull); clearInterval(t); off(); };
}
export const useClient = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const getClient = () => state;

export const toggleMod = (id: string, v?: boolean) => commit({ ...state, on: { ...state.on, [id]: v ?? !state.on[id] } });
export const toggleFav = (id: string) => commit({ ...state, favs: state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id] });
export const cfgOf = (s: State, id: string, st: Setting) => (s.cfg[id]?.[st.k] ?? st.def) as never;
export const setCfg = (id: string, k: string, v: unknown) => commit({ ...state, cfg: { ...state.cfg, [id]: { ...state.cfg[id], [k]: v } } });
export const resetModule = (id: string) => { const cfg = { ...state.cfg }; delete cfg[id]; commit({ ...state, cfg, on: { ...state.on, [id]: modById(id).on } }); };

export function setKey(id: string, key: string) {
  const keys = { ...state.keys };
  if (key !== "None") for (const [o, v] of Object.entries(keys)) if (o !== id && v.key === key) keys[o] = { ...v, key: "None" }; // one key, one action
  keys[id] = { ...keys[id], key };
  commit({ ...state, keys });
}
export const setMode = (id: string, mode: "Hold" | "Toggle") => commit({ ...state, keys: { ...state.keys, [id]: { ...state.keys[id], mode } } });
export const resetKeys = () => commit({ ...state, keys: fresh().keys });

export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  commit({ ...state, prefs: { ...state.prefs, [k]: v } });
  if (k === "launcherVis") setEngine("closeOnLaunch", v === "Hide while Playing");
}
export function applyPreset(p: Preset) {
  const on = { ...state.on };
  for (const m of MODULES) on[m.id] = PRESETS[p].mods.includes(m.id);
  commit({ ...state, on, prefs: { ...state.prefs, preset: p } });
}
export function setHudPos(id: string, pos: [number, number]) { commit({ ...state, prefs: { ...state.prefs, hudPos: { ...state.prefs.hudPos, [id]: pos } } }); }
