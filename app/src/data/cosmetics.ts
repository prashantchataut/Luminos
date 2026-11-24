import lib from "./library.json";

export type CatId = "pets" | "wings" | "hats" | "masks" | "bandanas" | "cloaks" | "back" | "emotes";
export type Item = { id: string; cat: CatId; name: string; note: string; sync?: boolean };
export const CATS: { id: CatId; label: string; icon: string; slot: string }[] = [
  { id: "pets", label: "Pets", icon: "box", slot: "pet" }, { id: "wings", label: "Wings", icon: "wings", slot: "wings" },
  { id: "hats", label: "Hats", icon: "crown", slot: "hat" }, { id: "masks", label: "Masks", icon: "eye", slot: "mask" },
  { id: "bandanas", label: "Bandanas", icon: "link", slot: "bandana" }, { id: "cloaks", label: "Cloaks", icon: "shirt", slot: "cloak" },
  { id: "back", label: "Back items", icon: "layers", slot: "back" }, { id: "emotes", label: "Emotes", icon: "play", slot: "emote" },
];
/** Original art, drawn from boxes in code. Each category has its own slot, so pets and wings are worn together. */
export const ITEMS: Item[] = [
  { id: "pet-cube", cat: "pets", name: "Cube", note: "Floats beside you and turns slowly." },
  { id: "pet-wyrmling", cat: "pets", name: "Wyrmling", note: "Perches on your shoulder." },
  { id: "pet-wisp", cat: "pets", name: "Wisp", note: "Orbits you and leaves a trail." },
  { id: "pet-minime", cat: "pets", name: "Mini-Me", note: "A small copy of you. Copies your skin and your moves." },
  { id: "wing-feather", cat: "wings", name: "Feather", note: "Ten feathers per side." },
  { id: "wing-shard", cat: "wings", name: "Shard", note: "Angular crystal wings." },
  { id: "wing-mantle", cat: "wings", name: "Mantle", note: "A cape cut as a wing." },
  { id: "hat-beanie", cat: "hats", name: "Beanie", note: "Knit cap with a cuff." },
  { id: "hat-top", cat: "hats", name: "Top hat", note: "Tall, with a band." },
  { id: "hat-halo", cat: "hats", name: "Halo", note: "A gold ring that bobs." },
  { id: "mask-half", cat: "masks", name: "Half mask", note: "Covers the eyes and nose." },
  { id: "mask-visor", cat: "masks", name: "Visor", note: "A tinted strip across the eyes." },
  { id: "band-neck", cat: "bandanas", name: "Neck bandana", note: "Tied at the back." },
  { id: "band-face", cat: "bandanas", name: "Face bandana", note: "Covers mouth and nose." },
  { id: "back-pack", cat: "back", name: "Backpack", note: "Flap, straps and a bedroll." },
  { id: "back-quiver", cat: "back", name: "Quiver", note: "Worn on a strap, four arrows." },
  { id: "emote-wave", cat: "emotes", name: "Wave", note: "A short wave." },
  { id: "emote-hug", cat: "emotes", name: "Hug", note: "Syncs with a nearby Luminos player.", sync: true },
  { id: "emote-spin", cat: "emotes", name: "Spin", note: "A full turn with both arms out." },
  ...(lib.capes as any[]).map((c): Item => ({ id: "cape-" + c.id, cat: "cloaks", name: c.name, note: c.animated ? "Animated cloak." : "Cloak." })),
];
export const capeFile = (id: string) => (lib.capes as any[]).find((c) => "cape-" + c.id === id);

/** Who sees what. Cosmetics are drawn by the Luminos client, so only Luminos users see them. */
export const VISIBLE_TO = "Visible to: Luminos users only. Everyone else sees no pets, wings, hats, masks, bandanas, back items or emotes.";
export const VISIBLE_TO_CAPE = "Visible to: Luminos users. Mojang capes are the only cloaks other players see without a mod.";

/** Pet behaviour, written before the models. Every pet answers the same five situations. Read by the 3D preview and by the client. */
export type PetState = "idle" | "walk" | "jump" | "swim" | "hurt";
export const PET_STATES: PetState[] = ["idle", "walk", "jump", "swim", "hurt"];
export const PET_SPEC: Record<string, Record<PetState, string>> = {
  "pet-cube": { idle: "Hovers at your right, 14 px out and 8 px up; bobs 1.5 px every 2 s and turns once per 8 s.", walk: "Trails 6 px behind; the bob speeds up to once per second and the turn follows your heading.", jump: "Squashes for 0.1 s, then rises 6 px above you and settles after you land.", swim: "A clear shell appears around it so it stays dry; it drifts at your shoulder height.", hurt: "Flashes red for 0.3 s and shakes sideways; the glow dims until you heal." },
  "pet-wyrmling": { idle: "Perches on your right shoulder; folds wings, tail sways every 1.2 s, blinks every 4 s.", walk: "Bobs with your stride and leans into the turn; wings stay folded.", jump: "Flares both wings for the airtime, folds on landing.", swim: "A snorkel slides out of its snout; it grips your collar and keeps its head up.", hurt: "Squeaks, flattens its wings and hunches for 0.4 s." },
  "pet-wisp": { idle: "Circles you at 12 px radius once per 6 s, rising and falling 3 px; a 6-point trail fades over 0.5 s.", walk: "Orbit tightens to 9 px and speeds up; the trail stretches behind you.", jump: "Spirals upward with you and drops back as you fall.", swim: "Wraps itself in a bubble and leaves rising bubbles instead of a trail.", hurt: "Flares bright for 0.2 s, then dims to half for 2 s." },
  "pet-minime": { idle: "Stands at your left, 9 px out, 0.28 scale; copies your skin and your head turn.", walk: "Copies your stride a half step late, keeping pace beside you.", jump: "Jumps when you jump, with a 0.1 s delay.", swim: "A tiny diving helmet appears on its head and it floats with its arms out.", hurt: "Staggers back 2 px and rocks for 0.3 s." },
};

/* ---------- persistence ---------- */
export type Locker = { equipped: Partial<Record<CatId, string>>; favs: string[] };
const KEY = "luminos.locker.v1";
export function loadLocker(): Locker { try { return { equipped: { pets: "pet-minime", wings: "wing-feather", cloaks: "cape-luminos-moon" }, favs: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { equipped: {}, favs: [] }; } }
export async function saveLocker(l: Locker) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* quota */ }
  // The desktop app also writes luminos-cosmetics.json next to the instance config so the client can read it after a restart.
  try { const { call, isTauri } = await import("../api"); if (isTauri) await call("write_cosmetics", { json: JSON.stringify({ version: 1, ...l }) }); } catch { /* browser */ }
}
