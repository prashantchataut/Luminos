import { useSyncExternalStore } from "react";
import { MODULES, modById, type Setting } from "../data/modules";
import { BINDS } from "../data/keybinds";
import { safeWrite } from "../lib/tauri-bridge";
import { set as setEngine } from "../store";

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
  prefs: { resolution: "1280 × 800 (Default)", launcherVis: "Keep Open", engine: "Balanced", preset: "Competitive PvP", gameVersion: "1.21.4", tab: "general", hudPos: {}, hudLock: false, hudGui: true },
});
let state: State = fresh();
try {
  const j = JSON.parse(localStorage.getItem(KEY) || "null");
  if (j) state = { ...state, ...j, on: { ...state.on, ...j.on }, keys: { ...state.keys, ...j.keys }, prefs: { ...state.prefs, ...j.prefs } };
} catch { /* first run */ }

const subs = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
  // The game reads this file. Failures (plain browser, missing command) fall back silently in safeWrite.
  safeWrite("write_client_settings", { json: JSON.stringify({ modules: state.on, moduleSettings: state.cfg, keybinds: state.keys, profile: state.prefs.preset, engine: state.prefs.engine }) });
  subs.forEach((f) => f());
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
