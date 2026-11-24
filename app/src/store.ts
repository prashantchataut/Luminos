import { useSyncExternalStore } from "react";
import { call } from "./api";

/** Every key here is read by something real: either the UI itself (applied in `apply`) or the engine through `set_setting`. */
export type Settings = {
  glass: number; solid: boolean; reduceMotion: boolean; animatedSky: boolean; compact: boolean;
  profile: "luminos-performance" | "sodium-baseline" | "vanilla";
  renderer: "sodium" | "vulkanmod" | "nvidium";
  inputSampling: boolean; hudFps: number; hudThrottle: boolean; startupCache: boolean; devProfiler: boolean;
  memoryMb: number; allowBeta: boolean; offlineSkins: boolean; checkUpdates: boolean; closeOnLaunch: boolean; compliance: boolean;
  keystrokes: "A" | "B"; crosshair: string; fogOverworld: boolean; fogNether: boolean; fogEnd: boolean; lowFire: boolean; lowShield: boolean;
};
export const DEFAULTS: Settings = {
  glass: 60, solid: false, reduceMotion: false, animatedSky: true, compact: true,
  profile: "luminos-performance", renderer: "sodium", inputSampling: true, hudFps: 30, hudThrottle: true, startupCache: true, devProfiler: false,
  memoryMb: 4096, allowBeta: false, offlineSkins: true, checkUpdates: true, closeOnLaunch: false, compliance: false,
  keystrokes: "A", crosshair: "dot-ring", fogOverworld: false, fogNether: true, fogEnd: false, lowFire: true, lowShield: true,
};
const KEY = "luminos.settings.v2";
let state: Settings = { ...DEFAULTS };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* first run */ }
const subs = new Set<() => void>();

export function apply(s: Settings) {
  const r = document.documentElement;
  r.style.setProperty("--gi", String(s.glass / 100));
  r.classList.toggle("solid", s.solid);
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
