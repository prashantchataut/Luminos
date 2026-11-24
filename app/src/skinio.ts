import base from "./data/skins.json";
import { call, isTauri } from "./api";

export type SkinEntry = { id: string; name: string; model: "classic" | "slim"; file?: string; data?: string; origin: "luminos" | "mine" | "file" | "mojang"; from?: string; blurb?: string };
export const ORIGINALS: SkinEntry[] = (base as any[]).map((s) => ({ ...s, origin: "luminos" }));
const KEY = "luminos.skins.v1";
type Store = { mine: SkinEntry[]; active: string; favs: string[]; reported: string[] };
export const loadSkins = (): Store => { try { return { mine: [], active: "luminos-default", favs: [], reported: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { mine: [], active: "luminos-default", favs: [], reported: [] }; } };
export const saveSkins = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ } };
export const srcOf = (s: SkinEntry) => s.data || "/" + s.file;

/* ---------- UV layout (same table as tools/make_luminos_skins.py) ---------- */
export type Face = { part: string; layer: 0 | 1; face: string; x: number; y: number; w: number; h: number };
export function layout(slim: boolean): Face[] {
  const aw = slim ? 3 : 4;
  const P: Record<string, [[number, number], [number, number], [number, number, number]]> = { head: [[0, 0], [32, 0], [8, 8, 8]], body: [[16, 16], [16, 32], [8, 12, 4]], rarm: [[40, 16], [40, 32], [aw, 12, 4]], larm: [[32, 48], [48, 48], [aw, 12, 4]], rleg: [[0, 16], [0, 32], [4, 12, 4]], lleg: [[16, 48], [0, 48], [4, 12, 4]] };
  const out: Face[] = [];
  for (const [part, [b, o, [w, h, d]]] of Object.entries(P)) for (const layer of [0, 1] as const) { const [u, v] = layer ? o : b;
    const f: Record<string, [number, number, number, number]> = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
    for (const [face, [x, y, fw, fh]] of Object.entries(f)) out.push({ part, layer, face, x, y, w: fw, h: fh }); }
  return out;
}
/** Layer mask: 1 where the pixel belongs to that layer's faces. */
export function mask(slim: boolean, layer: 0 | 1) { const m = new Uint8Array(4096); for (const f of layout(slim)) if (f.layer === layer) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) m[(f.y + y) * 64 + f.x + x] = 1; return m; }
/** Mirror target for every pixel: left side of the character to right side. -1 where none. */
export function mirrorMap(slim: boolean) {
  const map = new Int16Array(4096).fill(-1); const L = layout(slim); const find = (p: string, l: number, f: string) => L.find((q) => q.part === p && q.layer === l && q.face === f)!;
  const pair: Record<string, string> = { rarm: "larm", larm: "rarm", rleg: "lleg", lleg: "rleg", head: "head", body: "body" };
  const fmap: Record<string, string> = { top: "top", bottom: "bottom", front: "front", back: "back", right: "left", left: "right" };
  for (const f of L) { const t = find(pair[f.part], f.layer, fmap[f.face]); if (t.w !== f.w || t.h !== f.h) continue; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) map[(f.y + y) * 64 + f.x + x] = (t.y + y) * 64 + t.x + (t.w - 1 - x); }
  return map;
}

/* ---------- import ---------- */
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = src; });
export const toData = (c: HTMLCanvasElement) => c.toDataURL("image/png");
export function detectSlim(g: CanvasRenderingContext2D): boolean { const a = g.getImageData(47, 20, 1, 12).data, b = g.getImageData(55, 20, 1, 12).data; for (let i = 3; i < 48; i += 4) if (a[i] || b[i]) return false; return true; }
/** Old 64x32 skins have one arm and one leg; the other side is the mirror image. */
function upgradeLegacy(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0);
  const m = mirrorMap(false); const d = g.getImageData(0, 0, 64, 64); const o = new Uint8ClampedArray(d.data);
  for (const f of layout(false)) if (f.layer === 0 && (f.part === "lleg" || f.part === "larm")) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const i = (f.y + y) * 64 + f.x + x, j = m[i]; if (j >= 0) for (let k = 0; k < 4; k++) o[i * 4 + k] = d.data[j * 4 + k]; }
  g.putImageData(new ImageData(o, 64, 64), 0, 0); return c;
}
export type Imported = { ok: true; data: string; model: "classic" | "slim"; legacy: boolean } | { ok: false; why: string };
export async function importSkinFile(f: File): Promise<Imported> {
  if (f.size > 1_000_000) return { ok: false, why: "That file is larger than 1 MB. A skin PNG is a few kilobytes." };
  const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
  if (![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b)) return { ok: false, why: "That file is not a PNG. Export your skin as a .png and try again." };
  let img: HTMLImageElement; const url = URL.createObjectURL(f);
  try { img = await loadImg(url); } catch { return { ok: false, why: "That PNG is damaged and could not be read." }; } finally { URL.revokeObjectURL(url); }
  if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) return { ok: false, why: `Skins are 64×64, or 64×32 for old skins. This image is ${img.width}×${img.height}.` };
  const legacy = img.height === 32; let c: HTMLCanvasElement;
  if (legacy) c = upgradeLegacy(img); else { c = document.createElement("canvas"); c.width = c.height = 64; c.getContext("2d")!.drawImage(img, 0, 0); }
  const g = c.getContext("2d")!; const px = g.getImageData(0, 0, 64, 64).data; let seen = 0; for (let i = 3; i < px.length; i += 4) if (px[i]) seen++;
  if (seen < 200) return { ok: false, why: "That skin is almost entirely transparent, so it would be invisible in game." };
  return { ok: true, data: toData(c), model: !legacy && detectSlim(g) ? "slim" : "classic", legacy };
}
export async function sha256(data: string) { const b = await (await fetch(data)).arrayBuffer(); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join(""); }

/* ---------- username lookup: Mojang API only ---------- */
export type Lookup = { status: "found"; name: string; id: string; data: string; model: "classic" | "slim" } | { status: "nouser" | "noskin" | "error"; why: string };
async function pngToData(bytes: Uint8Array) { let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b))); return "data:image/png;base64," + btoa(s); }
export async function lookupUsername(name: string): Promise<Lookup> {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return { status: "error", why: "Names are 3 to 16 letters, numbers or underscores." };
  try {
    if (isTauri) return await call<Lookup>("mojang_lookup", { name });
    const p = await fetch(`https://api.mojang.com/users/profiles/minecraft/${name}`);
    if (p.status === 404 || p.status === 204) return { status: "nouser", why: `No Minecraft account is named “${name}”.` };
    if (!p.ok) return { status: "error", why: `Mojang answered ${p.status}. Try again in a minute.` };
    const { id, name: exact } = await p.json();
    const prof = await (await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`)).json();
    const tex = JSON.parse(atob(prof.properties.find((x: any) => x.name === "textures").value)).textures?.SKIN;
    if (!tex) return { status: "noskin", why: `${exact} has no custom skin. They use the default Steve or Alex.` };
    const png = new Uint8Array(await (await fetch(tex.url)).arrayBuffer());
    return { status: "found", name: exact, id, data: await pngToData(png), model: tex.metadata?.model === "slim" ? "slim" : "classic" };
  } catch { return { status: "error", why: "Could not reach Mojang. In a browser this lookup can be blocked; the desktop app does it for you." }; }
}

/* ---------- where others see it ---------- */
export type Row = { who: string; sees: "yes" | "needs" | "no"; line: string };
export const VISIBILITY: Row[] = [
  { who: "Luminos users", sees: "yes", line: "They see this skin. Both players need the Luminos client." },
  { who: "Online-mode servers", sees: "needs", line: "Everyone sees it once it is applied to your Mojang account. Needs Microsoft sign-in. Nobody has to install anything." },
  { who: "SkinsRestorer servers", sees: "needs", line: "Everyone sees it after you run the command below. The server needs the SkinsRestorer plugin." },
  { who: "Everyone else", sees: "no", line: "Other players will see your default skin. The server needs SkinsRestorer or skin-overrides." },
];
export const skinsRestorerCommand = (url: string) => `/skin url "${url || "https://example.com/your-skin.png"}"`;
