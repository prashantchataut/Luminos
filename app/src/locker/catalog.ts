import { useSyncExternalStore } from "react";
import { call } from "../api";
import { library } from "../data/launcher";
import SKINS from "../data/skins.json";

/** The locker holds skins and capes (flat and 3D relief). Nothing else lives here. */
export type Cat = "cloaks";
export type Item = {
  id: string; cat: Cat; name: string; blurb: string; tag: string;
  capeFile: string; frameFiles: string[]; frameMs: number; animated: boolean; relief: boolean;
};
export const ITEMS: Item[] = (library.capes as any[]).map((c) => ({
  id: "cloak-" + c.id, cat: "cloaks" as const, name: c.name, blurb: c.description, tag: c.tag ?? "2D",
  capeFile: c.file, frameFiles: c.frameFiles ?? [c.file], frameMs: c.frameMs ?? 0, animated: !!c.animated, relief: !!c.relief,
}));

export type SkinRec = { id: string; name: string; model: "classic" | "slim"; description: string; file?: string; data?: string; builtin?: boolean; custom?: boolean; source?: "file" | "mojang" | "ely" | "duplicate" | "editor"; from?: string; reported?: boolean };
export const BUILTIN_SKINS: SkinRec[] = (SKINS as any[]).map((s) => ({ ...s, file: "/" + s.file }));

export type Equipped = Record<Cat, string | null>;
export type LockerState = { skin: string; equipped: Equipped; favs: string[]; mine: SkinRec[]; classic: boolean; reported: string[] };
const DEFAULT_SKIN = "luminos-moon-knight";
const KEY = "luminos.locker.v2";
let state: LockerState = { skin: DEFAULT_SKIN, equipped: { cloaks: "cloak-luminos-original-moon" }, favs: [], mine: [], classic: false, reported: [] };
try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j) state = { ...state, ...j, equipped: { cloaks: j.equipped?.cloaks ?? null } }; } catch { /* first run */ }
const subs = new Set<() => void>();
let writeTimer = 0;

/** Every change is written at once: to the webview store, and to locker.json next to the account file so the game can read it. */
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => { call("locker_save", { json: JSON.stringify({ skin: state.skin, equipped: state.equipped, classic: state.classic, favs: state.favs }) }).catch(() => { /* plain browser */ }); }, 150);
}
function commit(next: LockerState) { state = next; persist(); subs.forEach((f) => f()); }
export const getLocker = () => state;
export const useLocker = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

export const allSkins = (s: LockerState = state): SkinRec[] => [...BUILTIN_SKINS, ...s.mine];
export const skinById = (id: string) => allSkins().find((x) => x.id === id) || BUILTIN_SKINS.find((x) => x.id === DEFAULT_SKIN) || BUILTIN_SKINS[0];
export const skinSrc = (s: SkinRec) => s.data || s.file || "";

export function toggleEquip(item: Item) { commit({ ...state, equipped: { cloaks: state.equipped.cloaks === item.id ? null : item.id } }); }
export const isEquipped = (item: Item, s: LockerState = state) => s.equipped[item.cat] === item.id;
export function toggleFav(id: string) { commit({ ...state, favs: state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id] }); }
export function setSkin(id: string) { commit({ ...state, skin: id }); }
export function setClassic(v: boolean) { commit({ ...state, classic: v }); }
export function addSkin(rec: SkinRec, select = true) { commit({ ...state, mine: [...state.mine, rec], skin: select ? rec.id : state.skin }); }
export function updateSkin(rec: SkinRec) { commit({ ...state, mine: state.mine.map((m) => (m.id === rec.id ? rec : m)) }); }
export function removeSkin(id: string) { commit({ ...state, mine: state.mine.filter((m) => m.id !== id), skin: state.skin === id ? DEFAULT_SKIN : state.skin }); }
export function reportSkin(id: string) { commit({ ...state, reported: [...state.reported, id], mine: state.mine.map((m) => (m.id === id ? { ...m, reported: true } : m)) }); }
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
