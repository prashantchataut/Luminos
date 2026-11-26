/**
 * Pre-rendered 2D art for the Cosmetics grid. Grid cards NEVER own a WebGL context: skins are composed once on a plain 2D canvas
 * (front view, both skin layers) and cached as a PNG data URL.
 */
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Front view of a 64x64 skin at 8x, outer layer included. */
export function skinFront(src: string, slim: boolean): Promise<string> {
  const k = `${src.slice(0, 80)}:${src.length}:${slim}`;
  const hit = cache.get(k); if (hit) return Promise.resolve(hit);
  const p = pending.get(k); if (p) return p;
  const job = load(src).then((img) => {
    const px = 8, c = document.createElement("canvas"); c.width = 16 * px; c.height = 32 * px;
    const g = c.getContext("2d")!; g.imageSmoothingEnabled = false;
    const aw = slim ? 3 : 4;
    // [sx, sy, w, h, dx, dy]  base layer then overlay layer
    const parts: [number, number, number, number, number, number][] = [
      [8, 8, 8, 8, 4, 0], [20, 20, 8, 12, 4, 8], [4, 20, 4, 12, 4, 20], [20 + 0, 52, 4, 12, 8, 20],
      [44, 20, aw, 12, 4 - aw, 8], [36, 52, aw, 12, 12, 8],
    ];
    const over: typeof parts = [
      [40, 8, 8, 8, 4, 0], [20, 36, 8, 12, 4, 8], [4, 36, 4, 12, 4, 20], [4, 52, 4, 12, 8, 20],
      [44, 36, aw, 12, 4 - aw, 8], [52, 52, aw, 12, 12, 8],
    ];
    parts[3] = [20, 52, 4, 12, 8, 20];
    for (const set of [parts, over]) for (const [sx, sy, w, h, dx, dy] of set) g.drawImage(img, sx, sy, w, h, (dx + (slim ? 0 : 0)) * px, dy * px, w * px, h * px);
    const url = c.toDataURL("image/png"); cache.set(k, url); pending.delete(k); return url;
  });
  pending.set(k, job); return job;
}
