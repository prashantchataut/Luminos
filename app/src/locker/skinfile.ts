/** Skin file handling: validate a PNG, convert 64x32 to 64x64, detect classic vs slim, and the skin atlas layout the editor uses. */
export type Region = { part: string; x: number; y: number; w: number; h: number; d: number; overlay: boolean; twin?: string };

export const PARTS = (slim: boolean): Region[] => {
  const aw = slim ? 3 : 4;
  return [
    { part: "head", x: 0, y: 0, w: 8, h: 8, d: 8, overlay: false }, { part: "hat", x: 32, y: 0, w: 8, h: 8, d: 8, overlay: true },
    { part: "body", x: 16, y: 16, w: 8, h: 12, d: 4, overlay: false }, { part: "jacket", x: 16, y: 32, w: 8, h: 12, d: 4, overlay: true },
    { part: "rarm", x: 40, y: 16, w: aw, h: 12, d: 4, overlay: false, twin: "larm" }, { part: "larm", x: 32, y: 48, w: aw, h: 12, d: 4, overlay: false, twin: "rarm" },
    { part: "rsleeve", x: 40, y: 32, w: aw, h: 12, d: 4, overlay: true, twin: "lsleeve" }, { part: "lsleeve", x: 48, y: 48, w: aw, h: 12, d: 4, overlay: true, twin: "rsleeve" },
    { part: "rleg", x: 0, y: 16, w: 4, h: 12, d: 4, overlay: false, twin: "lleg" }, { part: "lleg", x: 16, y: 48, w: 4, h: 12, d: 4, overlay: false, twin: "rleg" },
    { part: "rpant", x: 0, y: 32, w: 4, h: 12, d: 4, overlay: true, twin: "lpant" }, { part: "lpant", x: 0, y: 48, w: 4, h: 12, d: 4, overlay: true, twin: "rpant" },
  ];
};
type Face = { name: string; x: number; y: number; w: number; h: number };
export const faces = (r: Region): Face[] => [
  { name: "top", x: r.x + r.d, y: r.y, w: r.w, h: r.d }, { name: "bottom", x: r.x + r.d + r.w, y: r.y, w: r.w, h: r.d },
  { name: "right", x: r.x, y: r.y + r.d, w: r.d, h: r.h }, { name: "front", x: r.x + r.d, y: r.y + r.d, w: r.w, h: r.h },
  { name: "left", x: r.x + r.d + r.w, y: r.y + r.d, w: r.d, h: r.h }, { name: "back", x: r.x + 2 * r.d + r.w, y: r.y + r.d, w: r.w, h: r.h },
];
/** Which pixels belong to an outer-layer part: 1 = overlay, 0 = base, 2 = unused. */
export function layerMask(slim: boolean): Uint8Array {
  const m = new Uint8Array(64 * 64).fill(2);
  for (const r of PARTS(slim)) for (const f of faces(r)) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) m[(f.y + y) * 64 + f.x + x] = r.overlay ? 1 : 0;
  return m;
}
/** Mirror a pixel to the other side of the body: limbs map to their twin, other faces flip within themselves (right and left faces swap). */
export function mirrorPoint(px: number, py: number, slim: boolean): [number, number] | null {
  const parts = PARTS(slim);
  for (const r of parts) for (const f of faces(r)) {
    if (px < f.x || px >= f.x + f.w || py < f.y || py >= f.y + f.h) continue;
    const lx = px - f.x, ly = py - f.y;
    const twin = r.twin ? parts.find((p) => p.part === r.twin)! : r;
    const swap = r.twin || ["head", "hat", "body", "jacket"].includes(r.part);
    const name = swap && (f.name === "left" || f.name === "right") ? (f.name === "left" ? "right" : "left") : f.name;
    const tf = faces(twin).find((q) => q.name === name)!;
    if (f.name === "top" || f.name === "bottom") return [tf.x + (tf.w - 1 - lx), tf.y + ly];
    return [tf.x + (tf.w - 1 - lx), tf.y + ly];
  }
  return null;
}

export type Checked = { ok: true; canvas: HTMLCanvasElement; slim: boolean; legacy: boolean } | { ok: false; error: string };

/** Plain-language rejection for anything that is not a usable skin. */
export async function readSkinFile(file: Blob): Promise<Checked> {
  if (file.size > 512 * 1024) return { ok: false, error: "That file is larger than 512 KB. A skin is a tiny image." };
  const buf = new Uint8Array(await file.arrayBuffer());
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || sig.some((b, i) => buf[i] !== b)) return { ok: false, error: "That is not a PNG file." };
  const dv = new DataView(buf.buffer, buf.byteOffset), w = dv.getUint32(16), h = dv.getUint32(20);
  if (String.fromCharCode(...buf.slice(12, 16)) !== "IHDR") return { ok: false, error: "That PNG is damaged: the header is missing." };
  if (!(w === 64 && (h === 64 || h === 32))) return { ok: false, error: `Skins are 64×64, or the old 64×32. This image is ${w}×${h}.` };
  const url = URL.createObjectURL(new Blob([buf], { type: "image/png" }));
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
    return fromImage(img, h === 32);
  } catch { return { ok: false, error: "That PNG is damaged and could not be read." }; } finally { URL.revokeObjectURL(url); }
}
export function fromImage(img: CanvasImageSource, legacy: boolean): Checked {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64; const g = c.getContext("2d", { willReadFrequently: true })!; g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  if (legacy) {
    const flip = (sx: number, sy: number, dx: number, dy: number, w: number, h: number) => { g.save(); g.translate(dx + w, dy); g.scale(-1, 1); g.drawImage(c, sx, sy, w, h, 0, 0, w, h); g.restore(); };
    for (const [sx, sy, dx, dy] of [[4, 16, 20, 48], [8, 16, 24, 48]]) flip(sx, sy, dx, dy, 4, 4);
    for (const [sx, sy, dx, dy] of [[0, 20, 24, 52], [4, 20, 20, 52], [8, 20, 16, 52], [12, 20, 28, 52]]) flip(sx, sy, dx, dy, 4, 12);
    for (const [sx, sy, dx, dy] of [[44, 16, 36, 48], [48, 16, 40, 48]]) flip(sx, sy, dx, dy, 4, 4);
    for (const [sx, sy, dx, dy] of [[40, 20, 40, 52], [44, 20, 36, 52], [48, 20, 32, 52], [52, 20, 44, 52]]) flip(sx, sy, dx, dy, 4, 12);
  }
  return { ok: true, canvas: c, slim: !legacy && detectSlim(c), legacy };
}
/** Slim arms are 3 px wide, so the right arm's last back column (x = 55) is never painted on a slim skin. */
export function detectSlim(c: HTMLCanvasElement): boolean {
  const d = c.getContext("2d")!.getImageData(55, 20, 1, 12).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
  const d2 = c.getContext("2d")!.getImageData(47, 52, 1, 12).data; // left arm, same idea
  for (let i = 3; i < d2.length; i += 4) if (d2[i] !== 0) return false;
  return true;
}
export const toDataUrl = (c: HTMLCanvasElement) => c.toDataURL("image/png");
export async function loadCanvas(src: string): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const r = fromImage(img, img.height === 32); if ("error" in r) throw new Error(r.error); return r.canvas;
}
