/**
 * Pre-rendered 2D art for the Cosmetics grid. Grid cards NEVER own a WebGL context: skins are composed once on a plain 2D canvas
 * (front view, both skin layers) and cached as a PNG data URL; wings, pets and emotes are small cached SVG illustrations.
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

const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 120'>${body}</svg>`)}`;

export function cosmeticArt(id: string, cat: string): string {
  const k = `${cat}:${id}`; const hit = cache.get(k); if (hit) return hit;
  const h = hue(id), a = `hsl(${h} 80% 62%)`, b = `hsl(${(h + 40) % 360} 70% 40%)`, d = `hsl(${h} 50% 22%)`;
  const defs = `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient><radialGradient id='r' cx='.5' cy='.5' r='.6'><stop offset='0' stop-color='${a}' stop-opacity='.35'/><stop offset='1' stop-color='${a}' stop-opacity='0'/></radialGradient></defs><ellipse cx='80' cy='62' rx='70' ry='52' fill='url(#r)'/>`;
  let art = "";
  if (cat === "wings") {
    const w = (s: number) => `<g transform='translate(80 62) scale(${s} 1)'><path d='M4 8C20 -22 52 -34 72 -26 66 -12 62 0 54 10 58 12 56 22 46 28 42 34 34 40 24 36 18 40 10 32 4 28Z' fill='url(#g)'/><path d='M8 6C26 -14 46 -22 64 -22M10 16C28 0 46 -8 58 -4M12 26C26 14 40 8 50 12' stroke='${d}' stroke-opacity='.45' stroke-width='1.6' fill='none'/></g>`;
    art = w(1) + w(-1) + `<rect x='76' y='46' width='8' height='34' rx='3' fill='${d}'/>`;
  } else if (cat === "cloaks") {
    art = `<path d='M52 24h56l12 74H40z' fill='url(#g)'/><path d='M52 24h56l2 10H50z' fill='${d}' fill-opacity='.5'/><path d='M80 34v64M64 34l-6 64M96 34l6 64' stroke='${d}' stroke-opacity='.4' stroke-width='1.4' fill='none'/>`;
  } else if (cat === "pets") {
    art = `<ellipse cx='80' cy='100' rx='34' ry='6' fill='#000' fill-opacity='.35'/><rect x='52' y='44' width='56' height='50' rx='10' fill='url(#g)'/><rect x='62' y='58' width='10' height='12' rx='2' fill='#0B0D12'/><rect x='88' y='58' width='10' height='12' rx='2' fill='#0B0D12'/><rect x='66' y='80' width='28' height='4' rx='2' fill='${d}'/><path d='M60 44l-6-14 14 8zM100 44l6-14-14 8z' fill='${a}'/>`;
  } else if (cat === "emotes") {
    art = `<ellipse cx='80' cy='106' rx='26' ry='5' fill='#000' fill-opacity='.35'/><rect x='70' y='20' width='20' height='20' rx='3' fill='url(#g)'/><rect x='68' y='42' width='24' height='32' rx='3' fill='${b}'/><path d='M68 44L46 24l8-8 18 22zM92 44l22-20 8 8-22 20z' fill='${a}'/><rect x='68' y='76' width='11' height='26' rx='2' fill='${d}'/><rect x='81' y='76' width='11' height='26' rx='2' fill='${d}'/><path d='M26 70q10-14 20 0M114 70q10-14 20 0' stroke='${a}' stroke-width='3' fill='none' stroke-linecap='round' stroke-opacity='.7'/>`;
  } else {
    art = `<rect x='56' y='30' width='48' height='60' rx='8' fill='url(#g)'/>`;
  }
  const url = svg(defs + art); cache.set(k, url); return url;
}
