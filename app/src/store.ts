import { useSyncExternalStore } from "react";
import { call } from "./api";
import { applyTheme, parseTheme, ThemeFile, ThemeId } from "./theme";

/** Every key here is read by something real: either the UI itself (applied in `apply`) or the engine through `set_setting`. */
export type Settings = {
  theme: ThemeId; reduceMotion: boolean; compact: boolean;
  profile: "luminos-performance" | "sodium-baseline" | "vanilla";
  renderer: "sodium" | "vulkanmod" | "nvidium";
  inputSampling: boolean; hudFps: number; hudThrottle: boolean; startupCache: boolean; devProfiler: boolean;
  memoryMb: number; allowBeta: boolean; offlineSkins: boolean; checkUpdates: boolean; closeOnLaunch: boolean; compliance: boolean;
  keystrokes: "A" | "B"; crosshair: string; fogOverworld: boolean; fogNether: boolean; fogEnd: boolean; lowFire: boolean; lowShield: boolean;
  presenceOn: boolean; presenceName: boolean; presenceServer: boolean;
};
export const DEFAULTS: Settings = {
  theme: "default", reduceMotion: false, compact: true,
  profile: "luminos-performance", renderer: "sodium", inputSampling: true, hudFps: 30, hudThrottle: true, startupCache: true, devProfiler: false,
  memoryMb: 2048, allowBeta: false, offlineSkins: true, checkUpdates: true, closeOnLaunch: false, compliance: false,
  keystrokes: "A", crosshair: "dot-ring", fogOverworld: false, fogNether: true, fogEnd: false, lowFire: true, lowShield: true,
  presenceOn: true, presenceName: true, presenceServer: false,
};
const KEY = "luminos.settings.v2";
let state: Settings = { ...DEFAULTS };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* first run */ }
const subs = new Set<() => void>();

const CUSTOM_KEY = "luminos.theme.custom";
export function loadCustomTheme(): ThemeFile | null {
  try { const r = parseTheme(localStorage.getItem(CUSTOM_KEY) || ""); return r.ok ? r.theme : null; } catch { return null; }
}
export function saveCustomTheme(t: ThemeFile) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(t)); } catch { /* quota */ } }
export function apply(s: Settings) {
  const r = document.documentElement;
  applyTheme(s.theme, loadCustomTheme());
  r.classList.toggle("reduce", s.reduceMotion);
  r.classList.toggle("loose", !s.compact);
}
apply(state);

export function set<K extends keyof Settings>(k: K, v: Settings[K]) {
  state = { ...state, [k]: v };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  apply(state);
  // Engine-side keys are forwarded; UI-only keys stay local.
  if (["memoryMb", "allowBeta", "offlineSkins", "checkUpdates", "closeOnLaunch", "profile", "renderer", "inputSampling", "hudFps", "startupCache", "compliance"].includes(k)) {
    call("set_setting", { key: k, value: v }).catch(() => { /* engine unavailable in a plain browser */ });
  }
  subs.forEach((f) => f());
}
export const useSettings = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
export const getSettings = () => state;
