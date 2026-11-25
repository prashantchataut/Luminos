import { useSyncExternalStore } from "react";
import { call } from "./api";
import { MODS, Mod, modById } from "./data/mods";

type State = { on: Record<string, boolean>; fav: string[]; vals: Record<string, Record<string, string | number | boolean>> };
const KEY = "luminos.mods.v1";
const init = (): State => ({ on: Object.fromEntries(MODS.map((m) => [m.id, m.on])), fav: ["fps", "keystrokes", "sodium"], vals: {} });
let state: State = init();
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) state = { ...state, ...s, on: { ...state.on, ...s.on } }; } catch { /* first run */ }
const subs = new Set<() => void>();

function commit(next: State, changed: Record<string, unknown>) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  // Written to disk first, then pushed to the engine so a running game can pick it up. A plain browser has no engine; that is expected.
  for (const [key, value] of Object.entries(changed)) call("set_setting", { key, value }).catch(() => undefined);
  subs.forEach((f) => f());
}
/** Mods that must also change when `id` changes: turning a base off turns its dependants off; turning a dependant on turns its base on. */
export function diffFor(id: string, to: boolean): { off: Mod[]; on: Mod[] } {
  const off: Mod[] = [], on: Mod[] = [];
  if (!to) for (const m of MODS) if (m.needs?.includes(id) && state.on[m.id]) off.push(m);
  if (to) for (const n of modById(id).needs || []) if (!state.on[n]) on.push(modById(n));
  return { off, on };
}
export function toggleMod(id: string, to?: boolean) {
  const v = to ?? !state.on[id], d = diffFor(id, v), on = { ...state.on, [id]: v }, changed: Record<string, unknown> = { [`mod.${id}`]: v };
  d.off.forEach((m) => { on[m.id] = false; changed[`mod.${m.id}`] = false; });
  d.on.forEach((m) => { on[m.id] = true; changed[`mod.${m.id}`] = true; });
  commit({ ...state, on }, changed);
  return d;
}
export const toggleFav = (id: string) => commit({ ...state, fav: state.fav.includes(id) ? state.fav.filter((x) => x !== id) : [...state.fav, id] }, {});
export function setVal(id: string, k: string, v: string | number | boolean) {
  const vals = { ...state.vals, [id]: { ...(state.vals[id] || {}), [k]: v } };
  commit({ ...state, vals }, { [`mod.${id}.${k}`]: v });
}
export const valOf = (s: State, id: string, k: string, def: string | number | boolean) => s.vals[id]?.[k] ?? def;
export const tweaked = (s: State, id: string) => Object.keys(s.vals[id] || {}).length > 0;
export const useMods = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
