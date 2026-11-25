import { useSyncExternalStore } from "react";
import { call } from "../api";
import { library } from "../data/launcher";
import SKINS from "../data/skins.json";
import { BACK_GROUP } from "./pets";

export type Cat = "pets" | "wings" | "hats" | "masks" | "bandanas" | "cloaks" | "back" | "emotes";
export const CATS: { id: Cat | "skins"; label: string; icon: string }[] = [
  { id: "skins", label: "Skins", icon: "shirt" }, { id: "pets", label: "Pets", icon: "paw" }, { id: "wings", label: "Wings", icon: "wings" },
  { id: "hats", label: "Hats", icon: "crown" }, { id: "masks", label: "Masks", icon: "mask" }, { id: "bandanas", label: "Bandanas", icon: "band" },
  { id: "cloaks", label: "Cloaks", icon: "cloak" }, { id: "back", label: "Back items", icon: "pack" }, { id: "emotes", label: "Emotes", icon: "emote" },
];
export type Item = { id: string; cat: Cat; name: string; blurb: string; visible: string; capeFile?: string; animated?: boolean };

const LUMI = "Luminos users, once the cosmetics service is running. Nobody else sees it.";
const ITEMS_BASE: Item[] = [
  { id: "pet-cube", cat: "pets", name: "Cube", blurb: "Floats behind you and seals itself in glass underwater.", visible: LUMI },
  { id: "pet-dragon", cat: "pets", name: "Wyrmling", blurb: "Perches on your shoulder. Folds its wings to swim.", visible: LUMI },
  { id: "pet-wisp", cat: "pets", name: "Wisp", blurb: "Orbits your head and leaves a trail.", visible: LUMI },
  { id: "pet-minime", cat: "pets", name: "Mini-Me", blurb: "A small copy of you in your skin. Copies every move.", visible: LUMI },
  { id: "wing-feather", cat: "wings", name: "Feather", blurb: "Five-feather fan, off-white.", visible: LUMI },
  { id: "wing-shard", cat: "wings", name: "Shard", blurb: "Three flat crystal blades.", visible: LUMI },
  { id: "wing-cape", cat: "wings", name: "Cape wing", blurb: "A scalloped cape that lifts like a wing.", visible: LUMI },
  { id: "hat-cap", cat: "hats", name: "Field cap", blurb: "Navy cap with a short brim.", visible: LUMI },
  { id: "hat-crown", cat: "hats", name: "Crown", blurb: "Gold band with five points.", visible: LUMI },
  { id: "hat-wizard", cat: "hats", name: "Wizard hat", blurb: "Tall cone, wide brim.", visible: LUMI },
  { id: "mask-visor", cat: "masks", name: "Visor", blurb: "Dark band with a blue lens.", visible: LUMI },
  { id: "mask-fox", cat: "masks", name: "Fox mask", blurb: "White half mask, rust ears.", visible: LUMI },
  { id: "band-neck", cat: "bandanas", name: "Neck bandana", blurb: "Rust cloth tied at the neck.", visible: LUMI },
  { id: "band-head", cat: "bandanas", name: "Headband", blurb: "Ink band with a knot at the back.", visible: LUMI },
  { id: "back-pack", cat: "back", name: "Backpack", blurb: "Satchel with a flap and a pocket.", visible: LUMI },
  { id: "back-quiver", cat: "back", name: "Quiver", blurb: "Slanted quiver with three arrows.", visible: LUMI },
  { id: "emote-wave", cat: "emotes", name: "Wave", blurb: "Raise a hand and wave.", visible: "Luminos users nearby, once the cosmetics service is running." },
  { id: "emote-hug", cat: "emotes", name: "Hug", blurb: "Plays alone, or syncs with another Luminos player standing next to you.", visible: "Two Luminos players within 4 blocks of each other. The other player must also have it equipped." },
  { id: "emote-spin", cat: "emotes", name: "Spin", blurb: "A quick turn with arms out.", visible: "Luminos users nearby, once the cosmetics service is running." },
];
const CLOAKS: Item[] = library.capes.map((c) => ({ id: "cloak-" + c.id, cat: "cloaks" as const, name: c.name.replace(/ Cape$/, ""), blurb: c.description, visible: "Luminos users. Vanilla clients only show the cape your Mojang account owns.", capeFile: c.file, animated: c.animated }));
export const ITEMS: Item[] = [...ITEMS_BASE, ...CLOAKS];

export type SkinRec = { id: string; name: string; model: "classic" | "slim"; description: string; file?: string; data?: string; builtin?: boolean; custom?: boolean; source?: "file" | "mojang" | "duplicate" | "editor"; from?: string; reported?: boolean };
export const BUILTIN_SKINS: SkinRec[] = (SKINS as any[]).map((s) => ({ ...s, file: "/" + s.file }));

export type Equipped = Record<Cat, string | null>;
export type LockerState = { skin: string; equipped: Equipped; favs: string[]; mine: SkinRec[]; classic: boolean; reported: string[] };
const EMPTY: Equipped = { pets: null, wings: null, hats: null, masks: null, bandanas: null, cloaks: null, back: null, emotes: null };
const KEY = "luminos.locker.v1";
let state: LockerState = { skin: "luminos-default", equipped: { ...EMPTY, pets: "pet-cube" }, favs: [], mine: [], classic: false, reported: [] };
try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j) state = { ...state, ...j, equipped: { ...EMPTY, ...j.equipped } }; } catch { /* first run */ }
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
export const skinById = (id: string) => allSkins().find((x) => x.id === id) || BUILTIN_SKINS[0];
export const skinSrc = (s: SkinRec) => s.data || s.file || "";

export function toggleEquip(item: Item) {
  const eq = { ...state.equipped }, on = eq[item.cat] === item.id;
  eq[item.cat] = on ? null : item.id;
  // wings, cloaks and back items share the back; pets and wings never conflict
  if (!on && (BACK_GROUP as readonly string[]).includes(item.cat)) for (const c of BACK_GROUP) if (c !== item.cat) eq[c] = null;
  commit({ ...state, equipped: eq });
}
export const isEquipped = (item: Item, s: LockerState = state) => s.equipped[item.cat] === item.id;
export function toggleFav(id: string) { commit({ ...state, favs: state.favs.includes(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id] }); }
export function setSkin(id: string) { commit({ ...state, skin: id }); }
export function setClassic(v: boolean) { commit({ ...state, classic: v }); }
export function addSkin(rec: SkinRec, select = true) { commit({ ...state, mine: [...state.mine, rec], skin: select ? rec.id : state.skin }); }
export function updateSkin(rec: SkinRec) { commit({ ...state, mine: state.mine.map((m) => (m.id === rec.id ? rec : m)) }); }
export function removeSkin(id: string) { commit({ ...state, mine: state.mine.filter((m) => m.id !== id), skin: state.skin === id ? "luminos-default" : state.skin }); }
export function reportSkin(id: string) { commit({ ...state, reported: [...state.reported, id], mine: state.mine.map((m) => (m.id === id ? { ...m, reported: true } : m)) }); }
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
