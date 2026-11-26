#!/usr/bin/env node
// Generates Luminos' 16 original 64x64 skins and 10 capes (128x64, 2x the vanilla cape layout) as real pixel art.
//   node scripts/gen-textured-skins.mjs        -> app/public/skins/*.png, app/public/library/capes/*.png,
//                                                  app/src/data/skins.json, app/src/data/library.json (capes)
// Every surface gets: a per-face shade, a vertical gradient, a 2x2 ordered-dither step, hue-shifted ramps
// (highlights drift warm, shadows drift cool) and +-6% per-pixel luminance noise, so no 4x4 area is a flat block.
// Deterministic (seeded). No dependencies: the PNG encoder is below.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SK = join(root, "app/public/skins"), CP = join(root, "app/public/library/capes");
mkdirSync(SK, { recursive: true }); mkdirSync(CP, { recursive: true });

// ---------- tiny PNG writer ----------
const T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- colour + noise ----------
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const WARM = [255, 228, 170], COOL = [34, 28, 92];
/** k > 0 lightens toward warm, k < 0 darkens toward cool: hue-shifted ramps, never plain black/white mixing. */
const ramp = (c, k) => { const t = Math.min(1, Math.abs(k)) * 0.42, g = k > 0 ? WARM : COOL; return c.map((v, i) => v + (g[i] - v) * t); };
function rngFor(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

class Canvas {
  constructor(w, h, seed) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); this.r = rngFor(seed); }
  set(x, y, c, a = 255) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; this.d[i] = clamp(c[0]); this.d[i + 1] = clamp(c[1]); this.d[i + 2] = clamp(c[2]); this.d[i + 3] = a; }
  get(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  /** Shaded, dithered, noisy fill. face: front|side|back|top|bottom controls the base light. */
  fill(x, y, w, h, c, face = "front", a = 255, grain = 0.06) {
    const base = { front: 0, side: -0.16, back: -0.1, top: 0.22, bottom: -0.34 }[face];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const g = h > 1 ? 0.1 - (j / (h - 1)) * 0.22 : 0;
      const dith = ((i + j) & 1 ? 0.025 : -0.025) * (j % 3 === 0 ? 1.6 : 1);
      const n = (this.r() - 0.5) * 2 * grain;
      const k = base + g + dith;
      const col = ramp(c, k).map((v) => v * (1 + n));
      this.set(x + i, y + j, col, a);
    }
  }
  px(x, y, c, a = 255) { this.set(x, y, c, a); }
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  png() { return png(this.w, this.h, this.d); }
  unique() { const s = new Set(); for (let i = 0; i < this.d.length; i += 4) if (this.d[i + 3]) s.add((this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]); return s.size; }
  /** Largest count of 4x4 windows that are one flat colour (opaque only). */
  flat4() { let n = 0; for (let y = 0; y + 4 <= this.h; y++) for (let x = 0; x + 4 <= this.w; x++) { let first = null, same = true, opaque = true; for (let j = 0; j < 4 && same; j++) for (let i = 0; i < 4; i++) { const p = this.get(x + i, y + j); if (!p[3]) { opaque = false; same = false; break; } if (!first) first = p; else if (p[0] !== first[0] || p[1] !== first[1] || p[2] !== first[2]) { same = false; break; } } if (same && opaque) n++; } return n; }
}

// ---------- skin layout (modern 64x64) ----------
const R = {
  head: { front: [8, 8], right: [0, 8], left: [16, 8], back: [24, 8], top: [8, 0], bottom: [16, 0], d: [8, 8, 8] },
  body: { front: [20, 20], right: [16, 20], left: [28, 20], back: [32, 20], top: [20, 16], bottom: [28, 16], d: [8, 12, 4] },
  rarm: { front: [44, 20], right: [40, 20], left: [48, 20], back: [52, 20], top: [44, 16], bottom: [48, 16], d: [4, 12, 4] },
  larm: { front: [36, 52], right: [32, 52], left: [40, 52], back: [44, 52], top: [36, 48], bottom: [40, 48], d: [4, 12, 4] },
  rleg: { front: [4, 20], right: [0, 20], left: [8, 20], back: [12, 20], top: [4, 16], bottom: [8, 16], d: [4, 12, 4] },
  lleg: { front: [20, 52], right: [16, 52], left: [24, 52], back: [28, 52], top: [20, 48], bottom: [24, 48], d: [4, 12, 4] },
};
// outer-layer offsets for each part
const OVER = { head: [32, 0], body: [0, 16], rarm: [0, 16], larm: [16, 0], rleg: [0, 16], lleg: [-16, 0] };
function faces(part, armW) {
  const p = R[part]; let [w, h, d] = p.d; if ((part === "rarm" || part === "larm") && armW) { w = armW; }
  return [["front", w, h], ["back", w, h], ["right", d, h], ["left", d, h], ["top", w, d], ["bottom", w, d]].map(([f, fw, fh]) => ({ f, fw, fh, at: p[f] }));
}
/** Paint every face of `part` with `col(face, localX, localY)` -> [colour, alpha?] or null to skip. */
function paintPart(cv, part, over, armW, fn) {
  for (const { f, fw, fh, at } of faces(part, armW)) {
    const ox = over ? OVER[part][0] : 0, oy = over ? OVER[part][1] : 0;
    for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
      const r = fn(f, i, j, fw, fh); if (!r) continue;
      const [c, a = 255, gr = 0.06] = r;
      const x = at[0] + ox + i, y = at[1] + oy + j;
      const face = f === "front" ? "front" : f === "back" ? "back" : f === "top" ? "top" : f === "bottom" ? "bottom" : "side";
      cv.fill(x, y, 1, 1, c, face, a, gr);
      // vertical gradient needs the whole face height: nudge brightness by row afterwards
      const px = cv.get(x, y); const k = fh > 1 ? 0.08 - (j / (fh - 1)) * 0.2 : 0; const rc = ramp(px, k);
      cv.set(x, y, rc, a);
    }
  }
}

// ---------- the 16 skins ----------
const S = (o) => o;
const SKINS = [
  S({ id: "aether-knight", name: "Aether Knight", desc: "Silver plate over midnight cloth, cobalt trim.", tone: "#E7B997", hair: "#3A2A24", style: "short", eye: "#2F6FDB", top: "#B9C4D6", trim: "#2F6FDB", bottom: "#27324D", boots: "#4B566B", gloves: "#8794AB", over: { jacket: "#8D9BB3", hat: "helm" }, seed: 11 }),
  S({ id: "amethyst-duelist", name: "Amethyst Duelist", desc: "Plum fencing jacket, white cuffs, slicked hair.", tone: "#D9A586", hair: "#1F1626", style: "slick", eye: "#9B5DE5", top: "#6B2FA0", trim: "#E8DFF5", bottom: "#2A1B3D", boots: "#171021", gloves: "#E8DFF5", over: { jacket: "#7B3FB5" }, seed: 12 }),
  S({ id: "astral-traveler", name: "Astral Traveler", desc: "Dusk-blue explorer coat with star stitching.", tone: "#C98F6B", hair: "#D8D2C4", style: "long", eye: "#58C4DD", top: "#2B3A67", trim: "#F1C453", bottom: "#1B2440", boots: "#5B3A29", gloves: "#5B3A29", over: { jacket: "#34467C" }, seed: 13 }),
  S({ id: "cobalt-rogue", name: "Cobalt Rogue", desc: "Hooded cobalt leathers, quiet and quick.", tone: "#E2B08F", hair: "#2A2220", style: "hood", eye: "#4FA3FF", top: "#1F4FBF", trim: "#0F2A66", bottom: "#17223F", boots: "#10131C", gloves: "#0F2A66", over: { jacket: "#2A63E0", hat: "hood" }, seed: 14 }),
  S({ id: "crimson-valkyrie", name: "Crimson Valkyrie", desc: "Red lacquered armour, braided gold-blonde hair.", tone: "#F0C8A8", hair: "#D9A441", style: "long", eye: "#C73E3A", top: "#A8262B", trim: "#E3B04B", bottom: "#4A1417", boots: "#3A2A1E", gloves: "#E3B04B", over: { jacket: "#C13237" }, seed: 15 }),
  S({ id: "cyber-drift", name: "Cyber Drift", desc: "Charcoal street tech with cyan piping.", tone: "#B98562", hair: "#14B8C4", style: "spiky", eye: "#14E0F0", top: "#20242E", trim: "#14C8D8", bottom: "#161922", boots: "#0E1016", gloves: "#14C8D8", over: { jacket: "#2B303C" }, seed: 16 }),
  S({ id: "frost-warden", name: "Frost Warden", desc: "Fur-trimmed ice-blue guard in heavy wool.", tone: "#EBC9B3", hair: "#EDEFF2", style: "short", eye: "#7FC7F0", top: "#6E9CC9", trim: "#F2F6FA", bottom: "#38506E", boots: "#2C3B50", gloves: "#DDE6F0", over: { jacket: "#86B0D8", hat: "fur" }, seed: 17 }),
  S({ id: "moss-spirit", name: "Moss Spirit", desc: "Woven green tunic grown over with moss.", tone: "#B7936A", hair: "#4F7A34", style: "spiky", eye: "#C8F078", top: "#3F6B36", trim: "#7FA34A", bottom: "#5A4630", boots: "#3B2D1E", gloves: "#7FA34A", over: { jacket: "#4F8140" }, seed: 18 }),
  S({ id: "obsidian-monarch", name: "Obsidian Monarch", desc: "Black court robe, violet-lit crown.", tone: "#D1A07C", hair: "#0E0C14", style: "slick", eye: "#A78BFA", top: "#1C1826", trim: "#8B5CF6", bottom: "#100E18", boots: "#08070C", gloves: "#8B5CF6", over: { jacket: "#26213A", hat: "crown" }, seed: 19 }),
  S({ id: "sakura-ronin", name: "Sakura Ronin", desc: "Faded rose kimono, charcoal hakama.", tone: "#F1CDB0", hair: "#1A1416", style: "bun", eye: "#6B2F3F", top: "#D98BA0", trim: "#F6E3E8", bottom: "#2B2530", boots: "#1A1416", gloves: "#F6E3E8", over: { jacket: "#E6A3B5" }, seed: 20 }),
  S({ id: "solaris-mage", name: "Solaris Mage", desc: "Saffron robes, sun-sigil belt, wide sleeves.", tone: "#C48A60", hair: "#6B3F1D", style: "long", eye: "#FFB020", top: "#E09A1F", trim: "#8A4B0F", bottom: "#7A3E12", boots: "#4A2A12", gloves: "#8A4B0F", over: { jacket: "#F0AE30", hat: "hood" }, seed: 21 }),
  S({ id: "void-walker", name: "Void Walker", desc: "Indigo void-cloth, pale face, star-bright eyes.", tone: "#C9C2D8", hair: "#0B0A17", style: "short", eye: "#F5F0FF", top: "#2A2160", trim: "#6D5DE0", bottom: "#161236", boots: "#0B0A17", gloves: "#6D5DE0", over: { jacket: "#352B7A" }, seed: 22 }),
  S({ id: "ember-smith", name: "Ember Smith", desc: "Scorched leather apron over a rust shirt.", tone: "#C98B62", hair: "#2B1C14", style: "short", eye: "#E5803A", top: "#9C4A2A", trim: "#3A2418", bottom: "#3B3A40", boots: "#24201E", gloves: "#3A2418", over: { jacket: "#5A3A26" }, seed: 23 }),
  S({ id: "tide-ranger", name: "Tide Ranger", desc: "Sea-green oilskin, driftwood belt, salt-bleached hair.", tone: "#D6A27C", hair: "#C9B48A", style: "short", eye: "#2AA7A0", top: "#1F7F86", trim: "#E8DCC0", bottom: "#27495A", boots: "#3E4A52", gloves: "#E8DCC0", over: { jacket: "#2A9AA0", hat: "hood" }, seed: 24 }),
  S({ id: "dune-nomad", name: "Dune Nomad", desc: "Sand wraps, copper clasps, dust-stained boots.", tone: "#B07A52", hair: "#3B2A1C", style: "wrap", eye: "#E6C068", top: "#C8A670", trim: "#B8672F", bottom: "#8C6A44", boots: "#5B4128", gloves: "#B8672F", over: { jacket: "#D6B882" }, seed: 25 }),
  S({ id: "luminos-moon-knight", name: "Luminos Moon Knight", desc: "The house skin: midnight mail and a glowing dithered moon.", tone: "#E2B596", hair: "#E6EEFF", style: "short", eye: "#5C8CFF", top: "#101A3A", trim: "#5C8CFF", bottom: "#0B1128", boots: "#060A1A", gloves: "#E2EEFF", over: { jacket: "#18265A", hat: "helm" }, seed: 26 }),
];

function paintSkin(sp) {
  const cv = new Canvas(64, 64, sp.seed * 7919);
  const tone = hex(sp.tone), hair = hex(sp.hair), eye = hex(sp.eye), top = hex(sp.top), trim = hex(sp.trim), bottom = hex(sp.bottom), boots = hex(sp.boots), gloves = hex(sp.gloves);
  const slim = sp.slim === true, aw = slim ? 3 : 4;
  const hairOn = (f, i, j) => {
    const st = sp.style;
    if (f === "top") return true;
    if (st === "bald") return false;
    if (f === "back") return st === "long" || st === "wrap" || j < 6 || st === "bun";
    if (f === "left" || f === "right") return j < 3 || ((st === "long" || st === "wrap") && j < 8 && i > 3) || (st === "spiky" && j < 2);
    if (f === "front") return j < 2 || (st === "short" && j < 3 && (i < 2 || i > 5)) || (st === "slick" && j < 2) || (st === "long" && (i < 1 || i > 6) && j < 8) || (st === "spiky" && j < 3 && i % 2 === 0) || (st === "hood" && (i < 1 || i > 6 || j < 3)) || (st === "wrap" && (j < 3));
    return false;
  };
  // head
  paintPart(cv, "head", false, 0, (f, i, j) => {
    if (hairOn(f, i, j)) return [hair, 255, 0.1];
    if (f === "front") {
      if (j === 4 && (i === 1 || i === 2 || i === 5 || i === 6)) return [[255, 255, 255], 255, 0.02];
      if (j === 4 && (i === 2 || i === 5)) return [eye, 255, 0.02];
      if (j === 3 && ((i >= 1 && i <= 2) || (i >= 5 && i <= 6))) return [ramp(hair, -0.2), 255, 0.04];
      if (j === 6 && i >= 3 && i <= 4) return [ramp(tone, -0.45), 255, 0.03];
      if (j === 5 && (i === 3 || i === 4)) return [ramp(tone, -0.15), 255, 0.04];
    }
    return [tone, 255, 0.05];
  });
  // eye iris pass (white sclera + iris on the inner pixel)
  const [fx, fy] = R.head.front; cv.px(fx + 2, fy + 4, eye); cv.px(fx + 5, fy + 4, eye);
  cv.px(fx + 1, fy + 4, [240, 240, 248]); cv.px(fx + 6, fy + 4, [240, 240, 248]);
  // body: shirt with trim collar and belt
  paintPart(cv, "body", false, 0, (f, i, j, fw, fh) => {
    if (j >= fh - 2 && f !== "top" && f !== "bottom") return [trim, 255, 0.07];
    if (j === 0 && f === "front" && i >= 2 && i <= 5) return [ramp(tone, -0.1), 255, 0.05];
    if (f === "front" && (i === 3 || i === 4) && j > 1 && j < fh - 2 && sp.id.length % 2) return [trim, 255, 0.05];
    if (f === "front" && j === 4 && i % 3 === 1) return [ramp(top, 0.18), 255, 0.05];
    return [top, 255, 0.07];
  });
  // arms: sleeve above, glove below, bare skin only at the wrist seam
  for (const part of ["rarm", "larm"]) paintPart(cv, part, false, aw, (f, i, j, fw, fh) => {
    if (f === "top") return [top, 255, 0.05];
    if (f === "bottom") return [gloves, 255, 0.05];
    if (j >= fh - 3) return [gloves, 255, 0.07];
    if (j === fh - 4) return [trim, 255, 0.06];
    return [top, 255, 0.07];
  });
  // legs: trousers, boot cuff, boots
  for (const part of ["rleg", "lleg"]) paintPart(cv, part, false, 0, (f, i, j, fw, fh) => {
    if (f === "top") return [bottom, 255, 0.05];
    if (f === "bottom") return [boots, 255, 0.05];
    if (j >= fh - 3) return [boots, 255, 0.08];
    if (j === fh - 4) return [ramp(boots, 0.3), 255, 0.05];
    if (f === "front" && i === (part === "rleg" ? 3 : 0)) return [ramp(bottom, -0.15), 255, 0.05];
    return [bottom, 255, 0.08];
  });
  // outer layer: hair volume / hat, jacket, sleeves, trouser cuffs
  const jc = hex(sp.over.jacket);
  const hat = sp.over.hat;
  paintPart(cv, "head", true, 0, (f, i, j) => {
    if (hat === "hood") return f === "front" ? ((i < 1 || i > 6 || j < 2) ? [jc, 255, 0.08] : null) : [jc, 255, 0.08];
    if (hat === "helm") return (f === "top" || j < 3 || (f === "back") || ((f === "left" || f === "right") && j < 5)) ? [ramp(top, 0.35), 255, 0.09] : null;
    if (hat === "fur") return (f === "top" || j < 2 || ((f === "left" || f === "right" || f === "back") && j < 4)) ? [[236, 240, 246], 255, 0.1] : null;
    if (hat === "crown") return (f === "top" ? ((i + j) % 2 === 0 ? [trim, 255, 0.05] : null) : j < 1 && i % 2 === 0 ? [trim, 255, 0.05] : null);
    return hairOn(f, i, j) && (f === "top" || j < 2) && (i + j) % 3 !== 0 ? [ramp(hair, 0.12), 255, 0.1] : null;
  });
  paintPart(cv, "body", true, 0, (f, i, j, fw, fh) => {
    if (f === "top" || f === "bottom") return null;
    if (f === "front" && (i === 3 || i === 4) && j < fh - 2) return null; // open coat
    if (j >= fh - 4 || i === 0 || i === fw - 1 || f === "back") return [jc, 255, 0.08];
    return null;
  });
  for (const part of ["rarm", "larm"]) paintPart(cv, part, true, aw, (f, i, j, fw, fh) => (j >= fh - 4 || j < 2 ? [jc, 255, 0.08] : null));
  for (const part of ["rleg", "lleg"]) paintPart(cv, part, true, 0, (f, i, j, fw, fh) => (j >= fh - 5 && j < fh - 3 ? [jc, 255, 0.08] : null));
  return cv;
}

// ---------- capes: 128x64 (2x vanilla). back face = (2,2) 20x32; inner (24,2); top (2,0) 20x2; bottom (22,0); right (0,2); left (22,2) 2x32 ----------
const FONT = {
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
  I: "111010010010111", J: "001001001101010", K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010", P: "110101110100100",
  R: "110101110101101", S: "011100010001110", T: "111010010010010", U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
  0: "111101101101111", 1: "010110010010111", 2: "110001010100111", 3: "110001010001110", 4: "101101111001001", 5: "111100110001110", 6: "011100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001110",
  ":": "000010000010000", "(": "001010100010001", ".": "000000000000010", _: "000000000000111", "-": "000000111000000", "?": "110001010000010", " ": "000000000000000",
};
function text(cv, s, x, y, c) { let cx = x; for (const ch of s) { const g = FONT[ch] || FONT[" "]; for (let k = 0; k < 15; k++) if (g[k] === "1") cv.px(cx + (k % 3), y + Math.floor(k / 3), c); cx += 4; } return cx; }

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function capeCanvas(seed, edge, inner) {
  const cv = new Canvas(128, 64, seed);
  cv.fill(24, 2, 20, 32, inner, "back", 255, 0.05);          // inside face
  cv.fill(2, 0, 20, 2, edge, "top"); cv.fill(22, 0, 20, 2, edge, "bottom");
  cv.fill(0, 2, 2, 32, edge, "side"); cv.fill(22, 2, 2, 32, edge, "side");
  return cv;
}
const OUT = { x: 2, y: 2, w: 20, h: 32 };
const o = (cv, x, y, c) => cv.px(OUT.x + x, OUT.y + y, c);
function backFill(cv, fn, gr = 0.05) { for (let j = 0; j < 32; j++) for (let i = 0; i < 20; i++) { const c = fn(i, j); if (c) cv.fill(OUT.x + i, OUT.y + j, 1, 1, c, "back", 255, gr); } }
const paperShade = (cv, i, j, base) => { cv.fill(OUT.x + i, OUT.y + j, 1, 1, base, "front", 255, 0.035); };

const CAPES = [
  { id: "job-application", name: "Job Application", description: "A very serious employment form. Name, experience, signature. Please apply in person.", tag: "Meme", build() {
    const cv = capeCanvas(101, [214, 218, 226], [190, 196, 208]); const paper = [244, 244, 238], ink = [38, 52, 96], line = [150, 156, 170], red = [190, 50, 50], pen = [24, 40, 150];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 20; i++) paperShade(cv, i, j, paper);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 20; i++) cv.fill(OUT.x + i, OUT.y + j, 1, 1, ink, "front", 255, 0.05);
    text(cv, "JOB", OUT.x + 4, OUT.y + 1, paper); text(cv, "FORM", OUT.x + 2, OUT.y + 7, paper);
    for (let i = 0; i < 20; i++) o(cv, i, 12, red);
    text(cv, "NAME", OUT.x + 2, OUT.y + 14, ink);
    for (let i = 0; i < 16; i++) if (i % 4 !== 3) cv.fill(OUT.x + 2 + i, OUT.y + 19, 1, 1, line, "front", 255, 0.04);
    // YES (ticked) / NO boxes, 4x4 each with a hollow centre
    for (const [bx, tick] of [[2, true], [11, false]]) {
      for (let k = 0; k < 4; k++) { o(cv, bx + k, 21, ink); o(cv, bx + k, 24, ink); o(cv, bx, 21 + k, ink); o(cv, bx + 3, 21 + k, ink); }
      if (tick) { o(cv, bx + 1, 23, [30, 140, 70]); o(cv, bx + 2, 22, [30, 140, 70]); }
      for (let k = 0; k < 3; k++) cv.fill(OUT.x + bx + 5 + k, OUT.y + 22, 1, 1, line, "front", 255, 0.04);
    }
    text(cv, "X", OUT.x + 2, OUT.y + 26, red);
    for (let i = 0; i < 13; i++) cv.fill(OUT.x + 6 + i, OUT.y + 30, 1, 1, ink, "front", 255, 0.04);
    [[7, 29], [8, 28], [9, 29], [10, 27], [11, 29], [12, 28], [13, 29], [14, 28], [15, 29]].forEach(([x, y]) => o(cv, x, y, pen));
    return cv; } },
  { id: "ball-knowledge-tactician", name: "Ball Knowledge Tactician", description: "Chalkboard pitch, X and O arrows, one raised eyebrow. You either know ball or you don't.", tag: "Meme", frames: 2, build(f = 0) {
    const cv = capeCanvas(102, [16, 70, 48], [12, 52, 38]); const g1 = [24, 112, 72], g2 = [30, 126, 82], ch = [236, 244, 238];
    backFill(cv, (i, j) => (Math.floor(j / 4) % 2 ? g1 : g2));
    for (let i = 0; i < 20; i++) { o(cv, i, 0, ch); o(cv, i, 31, ch); } for (let j = 0; j < 32; j++) { o(cv, 0, j, ch); o(cv, 19, j, ch); }
    for (let i = 0; i < 20; i++) o(cv, i, 16, ch); for (let k = 0; k < 5; k++) { o(cv, 7 + k, 12, ch); o(cv, 7 + k, 20, ch); } for (let j = 12; j <= 20; j++) { o(cv, 7, j, ch); o(cv, 11, j, ch); }
    const xs = [[4, 6], [10, 4], [15, 7], [5, 24], [14, 25]]; for (const [x, y] of xs) { o(cv, x, y, ch); o(cv, x + 2, y + 2, ch); o(cv, x + 2, y, ch); o(cv, x, y + 2, ch); o(cv, x + 1, y + 1, ch); }
    const os = [[8, 8], [3, 18], [13, 18]]; for (const [x, y] of os) { o(cv, x + 1, y, ch); o(cv, x, y + 1, ch); o(cv, x + 2, y + 1, ch); o(cv, x + 1, y + 2, ch); }
    // play arrows; frame 1 advances the arrowheads
    const a = f ? 1 : 0; [[5, 8], [6, 9], [7, 10 + a]].forEach(([x, y]) => o(cv, x, y, [255, 214, 90])); [[12, 6], [12, 7], [12, 8 + a]].forEach(([x, y]) => o(cv, x, y, [255, 214, 90]));
    // the eyebrow
    for (let k = 0; k < 5; k++) o(cv, 7 + k, 14 - (k > 2 ? 1 : 0), [18, 24, 20]); o(cv, 9, 15, [18, 24, 20]);
    return cv; } },
  { id: "touch-grass-3d", name: "Touch Grass 3D", description: "A grass block worn as a cloak: overhanging turf, dirt, roots. Doctor's orders.", tag: "3D", relief: true, build() {
    const cv = capeCanvas(103, [92, 62, 38], [70, 48, 30]); const grass = [88, 150, 56], dirt = [128, 88, 56];
    backFill(cv, (i, j) => {
      if (j < 7) return ramp(grass, ((i * 3 + j * 5) % 7 - 3) * 0.05);
      if (j < 9 && (i * 5 + 3) % 6 < 3) return ramp(grass, -0.25);
      return ramp(dirt, ((i * 7 + j * 3) % 9 - 4) * 0.05);
    }, 0.07);
    for (const [x, y] of [[3, 14], [9, 18], [14, 12], [6, 24], [16, 22], [11, 27]]) { o(cv, x, y, [98, 66, 40]); o(cv, x + 1, y, [150, 110, 78]); o(cv, x, y + 1, [84, 56, 34]); }
    for (let i = 0; i < 20; i += 3) { const l = 2 + (i % 5); for (let j = 0; j < l; j++) o(cv, i, 31 - j, [74, 50, 30]); }
    return cv; } },
  { id: "404-skill-not-found", name: "404 Skill Not Found", description: "Your opponent ran into a problem. The problem was you. Blue screen of death, in a cape.", tag: "Meme", build() {
    const cv = capeCanvas(104, [0, 70, 160], [0, 58, 134]); const blue = [0, 94, 200], w = [240, 244, 255];
    backFill(cv, () => blue, 0.02);
    // sad face: two eyes and a frown, drawn by hand so it reads as :(
    for (const x of [5, 13]) for (const y of [2, 3, 4]) { o(cv, x, y, w); o(cv, x + 1, y, w); }
    for (let i = 6; i <= 13; i++) o(cv, i, 6, w); o(cv, 5, 7, w); o(cv, 14, 7, w);
    for (let i = 0; i < 20; i++) o(cv, i, 9, mix(blue, w, 0.35));
    text(cv, "404", OUT.x + 4, OUT.y + 11, w); text(cv, "SKILL", OUT.x, OUT.y + 17, w); text(cv, "NOT", OUT.x + 4, OUT.y + 23, w);
    cv.fill(OUT.x, OUT.y + 29, 1, 1, w, "front", 255, 0.02); text(cv, "FOUND", OUT.x, OUT.y + 27, w);
    return cv; } },
  { id: "luminos-original-moon", name: "Luminos Original Moon", description: "Midnight cloth with the original dithered Luminos moon raised in 3D relief.", tag: "3D", relief: true, build() {
    const cv = capeCanvas(105, [8, 12, 34], [6, 10, 26]); const sky = [8, 14, 42];
    backFill(cv, (i, j) => ramp(sky, ((i * 5 + j * 11) % 13 - 6) * 0.012 + (j / 31) * 0.1), 0.04);
    for (const [x, y] of [[2, 3], [16, 2], [4, 26], [17, 20], [1, 14], [18, 9], [12, 28]]) o(cv, x, y, [200, 220, 255]);
    const cx = 9.5, cy = 15.5, r = 7.6;
    for (let j = 0; j < 32; j++) for (let i = 0; i < 20; i++) { const d = Math.hypot(i - cx, j - cy); if (d > r) { if (d < r + 1.6) o(cv, i, j, mix(sky, [92, 140, 255], 0.28 * (1 - (d - r) / 1.6))); continue; } const light = (cx + 3 - i) * 0.09 + (cy + 3 - j) * 0.09 + 0.45; const bayer = [[0, 8], [12, 4]][j & 1][i & 1] / 16; const t = Math.max(0, Math.min(3.99, light * 3 + bayer - 0.2)); cv.fill(OUT.x + i, OUT.y + j, 1, 1, [[24, 44, 120], [58, 100, 220], [150, 190, 255], [232, 240, 255]][Math.floor(t)], "front", 255, 0.025); }
    return cv; } },
  { id: "eclipse-monarch-3d", name: "Eclipse Monarch 3D", description: "A black sun crowned in violet fire, raised from the cloth.", tag: "3D", relief: true, build() {
    const cv = capeCanvas(106, [18, 12, 34], [14, 10, 28]);
    backFill(cv, (i, j) => ramp([28, 18, 52], (j / 31) * -0.2 + ((i + j * 3) % 5 - 2) * 0.02), 0.05);
    const cx = 9.5, cy = 13.5;
    for (let j = 0; j < 32; j++) for (let i = 0; i < 20; i++) { const d = Math.hypot(i - cx, (j - cy)); if (d < 4.4) o(cv, i, j, [8, 6, 14]); else if (d < 6.4) { const a = Math.atan2(j - cy, i - cx); if ((Math.floor(a * 6) + i + j) % 2 === 0) o(cv, i, j, d < 5.4 ? [196, 160, 255] : [139, 92, 246]); } }
    for (let i = 3; i < 17; i += 2) { o(cv, i, 25, [255, 214, 90]); if (i % 4 === 3) o(cv, i, 24, [255, 214, 90]); }
    for (let i = 3; i < 17; i++) o(cv, i, 26, [180, 140, 40]);
    return cv; } },
  { id: "crimson-ronin-3d", name: "Crimson Ronin 3D", description: "Lacquered red plates stacked like a samurai haori, each ridge extruded.", tag: "3D", relief: true, build() {
    const cv = capeCanvas(107, [90, 14, 20], [70, 10, 16]);
    backFill(cv, (i, j) => { const band = Math.floor(j / 5); const edge = j % 5; const base = [168 - band * 8, 30, 36]; return edge === 0 ? [236, 190, 90] : edge === 4 ? ramp(base, -0.4) : ramp(base, ((i + band * 3) % 4 - 1.5) * 0.04); }, 0.05);
    for (let j = 2; j < 30; j++) { if (j % 5 === 2) { o(cv, 9, j, [12, 10, 14]); o(cv, 10, j, [12, 10, 14]); } }
    return cv; } },
  { id: "void-blossom", name: "Void Blossom", description: "Cherry petals drifting through a violet void.", tag: "2D", build() {
    const cv = capeCanvas(108, [28, 16, 52], [22, 12, 42]);
    backFill(cv, (i, j) => ramp([34, 20, 66], (j / 31) * -0.25 + ((i * 3 + j) % 7 - 3) * 0.015), 0.05);
    const pet = [[3, 4], [13, 7], [7, 12], [16, 17], [4, 21], [11, 25], [8, 29], [1, 12]]; for (const [x, y] of pet) { o(cv, x, y, [244, 170, 196]); o(cv, x + 1, y, [255, 214, 226]); o(cv, x, y + 1, [214, 120, 160]); o(cv, x + 1, y + 1, [244, 170, 196]); }
    for (let j = 0; j < 8; j++) o(cv, 15 - Math.floor(j / 2), 18 + j, [60, 36, 40]);
    return cv; } },
  { id: "cobalt-prism", name: "Cobalt Prism", description: "Faceted cobalt crystal planes catching a hard light.", tag: "2D", build() {
    const cv = capeCanvas(109, [20, 50, 140], [16, 40, 112]);
    backFill(cv, (i, j) => { const f = (Math.floor((i + j) / 5) + Math.floor((i - j + 40) / 6)) % 4; return ramp([44, 92, 230], [-0.3, 0.05, 0.3, -0.1][f] + ((i * 7 + j * 5) % 5 - 2) * 0.012); }, 0.04);
    for (let k = 0; k < 20; k++) if (k % 5 === 0) for (let j = 0; j < 32; j++) { const i = (k + Math.floor(j / 2)) % 20; o(cv, i, j, [200, 224, 255]); }
    return cv; } },
  { id: "golden-veteran", name: "Golden Veteran", description: "Worn gold-and-oxblood service colours with a campaign stripe for every year.", tag: "2D", build() {
    const cv = capeCanvas(110, [110, 78, 18], [88, 62, 14]);
    backFill(cv, (i, j) => (j < 4 || j > 27 ? ramp([208, 160, 40], ((i + j) % 3 - 1) * 0.06) : ramp([112, 22, 30], ((i * 5 + j * 3) % 7 - 3) * 0.03)), 0.05);
    for (let k = 0; k < 4; k++) for (let i = 4; i < 16; i++) o(cv, i, 8 + k * 4, [232, 196, 80]);
    for (let j = 0; j < 32; j++) { o(cv, 0, j, [232, 196, 80]); o(cv, 19, j, [232, 196, 80]); }
    return cv; } },
];

// ---------- run ----------
let bad = 0;
const skinJson = [];
for (const f of readdirSync(SK)) if (f.endsWith(".png")) rmSync(join(SK, f));
for (const sp of SKINS) {
  const cv = paintSkin(sp); writeFileSync(join(SK, sp.id + ".png"), cv.png());
  const u = cv.unique(), flat = cv.flat4();
  if (u < 50) { console.error(`FAIL ${sp.id}: only ${u} unique colours`); bad++; }
  console.log(`skin ${sp.id.padEnd(22)} ${String(u).padStart(4)} colours, ${flat} flat 4x4 windows`);
  skinJson.push({ id: sp.id, name: sp.name, model: "classic", description: sp.desc, file: `skins/${sp.id}.png`, builtin: true, colors: u });
}
writeFileSync(join(root, "app/src/data/skins.json"), JSON.stringify(skinJson, null, 2) + "\n");

for (const f of readdirSync(CP)) rmSync(join(CP, f));
const lib = JSON.parse(readFileSync(join(root, "app/src/data/library.json"), "utf8"));
lib.capes = [];
for (const c of CAPES) {
  const frames = c.frames || 1, files = [];
  for (let f = 0; f < frames; f++) { const cv = c.build(f); const name = frames > 1 ? `${c.id}-f${f}.png` : `${c.id}.png`; writeFileSync(join(CP, name), cv.png()); files.push(`library/capes/${name}`); if (f === 0) console.log(`cape ${c.id.padEnd(26)} ${String(cv.unique()).padStart(4)} colours`); }
  lib.capes.push({ id: c.id, name: c.name, description: c.description, file: files[0], frameFiles: files, frames, frameMs: frames > 1 ? 700 : 0, animated: frames > 1, tag: c.tag, relief: !!c.relief, author: "Luminos", licence: "CC0-1.0", source: "scripts/gen-textured-skins.mjs" });
}
lib.generator = "scripts/gen-textured-skins.mjs";
writeFileSync(join(root, "app/src/data/library.json"), JSON.stringify(lib, null, 2) + "\n");
if (bad) process.exit(1);
console.log(`ok: ${SKINS.length} skins, ${CAPES.length} capes`);
