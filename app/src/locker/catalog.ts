import { useSyncExternalStore } from "react";
import { call } from "../api";
import { library } from "../data/launcher";

/** The locker holds the player's own skin and 3D capes. There are no preset skins: the skin is the player's (Mojang / Ely.by / an uploaded PNG). */
export type Cat = "cloaks";
export type Item = {
  id: string; cat: Cat; name: string; blurb: string; tag: string;
  capeFile: string; frameFiles: string[]; frameMs: number; animated: boolean; relief: boolean;
};
/** Display names: the asset names without the "3D" suffix; one long name shortened. */
const niceName = (n: string) => n.replace(/\s+3D$/, "").replace("Ball Knowledge Tactician", "Ball Knowledge");
const CAPE_ORDER = ["luminos-original-moon", "eclipse-monarch-3d", "cobalt-prism-3d", "crimson-ronin-3d", "sakura-nightfall-3d", "void-dragon-3d", "job-application", "touch-grass-3d", "ball-knowledge-tactician", "404-skill-not-found"];
export const ITEMS: Item[] = CAPE_ORDER.map((id) => (library.capes as any[]).find((c) => c.id === id)).filter(Boolean).map((c: any) => ({
  id: "cloak-" + c.id, cat: "cloaks" as const, name: niceName(c.name), blurb: c.description, tag: c.tag ?? "2D",
  capeFile: c.file, frameFiles: c.frameFiles ?? [c.file], frameMs: c.frameMs ?? 0, animated: !!c.animated, relief: !!c.relief,
}));

export type SkinRec = { id: string; name: string; model: "classic" | "slim"; description: string; data?: string; custom?: boolean; source?: "file" | "mojang" | "ely" | "default" };

/** A plain, neutral character drawn in code (no art assets): what the preview wears until the player syncs or uploads their own skin. */
function makeDefaultSkin(): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d"); if (!g) return "";
  const box = (col: string, x: number, y: number, w: number, h: number) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  box("#B98A67", 0, 0, 32, 16);            // head (all faces) in a skin tone
  box("#3A2A22", 8, 0, 8, 2);              // hair on top
  box("#3A2A22", 8, 8, 8, 2); box("#3A2A22", 0, 8, 8, 3); box("#3A2A22", 16, 8, 8, 3); box("#3A2A22", 24, 8, 8, 8);
  box("#F4F1EA", 9, 12, 2, 1); box("#F4F1EA", 13, 12, 2, 1); box("#2B3B6B", 10, 12, 1, 1); box("#2B3B6B", 14, 12, 1, 1); // eyes
  box("#8F5E48", 11, 14, 2, 1);            // mouth
  box("#334155", 16, 16, 24, 16);          // torso
  box("#475569", 40, 16, 16, 16);          // right arm
  box("#475569", 32, 48, 16, 16);          // left arm
  box("#1E293B", 0, 16, 16, 16);           // right leg
  box("#1E293B", 16, 48, 16, 16);          // left leg
  box("#B98A67", 44, 28, 8, 4); box("#B98A67", 36, 60, 8, 4);  // hands
  return c.toDataURL("image/png");
}
let defaultData = "";
export const DEFAULT_SKIN = "default";
function defaultRec(): SkinRec { return { id: DEFAULT_SKIN, name: "Default", model: state.defaultSlim ? "slim" : "classic", description: "Neutral placeholder", data: (defaultData ||= makeDefaultSkin()), source: "default" }; }

export type Equipped = Record<Cat, string | null>;
export type LockerState = { skin: string; equipped: Equipped; favs: string[]; mine: SkinRec[]; classic: boolean; reported: string[]; defaultSlim: boolean };
const KEY = "luminos.locker.v2";
let state: LockerState = { skin: DEFAULT_SKIN, equipped: { cloaks: "cloak-luminos-original-moon" }, favs: [], mine: [], classic: false, reported: [], defaultSlim: false };
try {
  const j = JSON.parse(localStorage.getItem(KEY) || "null");
  if (j) {
    // Older versions stored preset skins by id; those no longer exist, so only the player's own skins survive.
    const mine: SkinRec[] = (j.mine ?? []).filter((m: SkinRec) => m && m.data).map((m: any) => ({ id: m.id, name: m.name, model: m.model, description: m.description ?? "", data: m.data, custom: true, source: m.source === "mojang" || m.source === "ely" || m.source === "file" ? m.source : "file" }));
    const cape = j.equipped?.cloaks ?? null;
    state = { ...state, favs: j.favs ?? [], classic: !!j.classic, defaultSlim: !!j.defaultSlim, mine, skin: mine.some((m) => m.id === j.skin) ? j.skin : DEFAULT_SKIN, equipped: { cloaks: ITEMS.some((i) => i.id === cape) ? cape : null } };
  }
} catch { /* first run */ }
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
export const onLocker = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** The game changed the equipped cape: take it over. The launcher's own file write is skipped by the caller (ids already match). */
export function setCapeFromGame(id: string | null) { commit({ ...state, equipped: { cloaks: id } }); }
export const useLocker = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);

export const allSkins = (s: LockerState = state): SkinRec[] => [defaultRec(), ...s.mine];
export const skinById = (id: string): SkinRec => state.mine.find((x) => x.id === id) || defaultRec();
export const skinSrc = (s: SkinRec) => s.data || "";

export function toggleEquip(item: Item) { commit({ ...state, equipped: { cloaks: state.equipped.cloaks === item.id ? null : item.id } }); }
export const isEquipped = (item: Item, s: LockerState = state) => s.equipped[item.cat] === item.id;
export function toggleFav(id: string) { commit({ ...state, favs: state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id] }); }
export function setSkin(id: string) { commit({ ...state, skin: id }); }
export function setClassic(v: boolean) { commit({ ...state, classic: v }); }
export function addSkin(rec: SkinRec, select = true) { commit({ ...state, mine: [...state.mine, rec], skin: select ? rec.id : state.skin }); }
export function updateSkin(rec: SkinRec) { commit({ ...state, mine: state.mine.map((m) => (m.id === rec.id ? rec : m)) }); }
export function removeSkin(id: string) { commit({ ...state, mine: state.mine.filter((m) => m.id !== id), skin: state.skin === id ? DEFAULT_SKIN : state.skin }); }
/** Arm model of whichever skin is on the character: Classic (4 px arms) or Slim (3 px arms). */
export function setArmModel(slim: boolean) {
  if (state.skin === DEFAULT_SKIN) commit({ ...state, defaultSlim: slim });
  else commit({ ...state, mine: state.mine.map((m) => (m.id === state.skin ? { ...m, model: slim ? "slim" : "classic" } : m)) });
}
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
