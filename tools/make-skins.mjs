// Authors the 12 built-in Luminos skins as real pixel art (64x64, modern layout).   node tools/make-skins.mjs
// Not flat fills: every material is a 7-step hue-shifted ramp (shadows lean violet, lights lean warm), lit per face
// (top > left > front > right > back > bottom), with a vertical gradient, fabric noise and 4x4 Bayer dithering between steps.
// Every skin also paints the 2nd layer: hair / hood / helm, coat, pauldrons, cuffs, boot cuffs and a back cape with a motif.
// These are original works (CC0). Nothing is copied from xyrios.com or any other site; those skins belong to their authors.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "app/public/skins");

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; }
function hsl2rgb([h, s, l]) { h = (((h % 360) + 360) % 360) / 360; const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (!s) return [l, l, l].map((v) => Math.round(v * 255)); const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => Math.round(v * 255)); }
const arc = (a, b, t) => a + ((((b - a + 540) % 360) - 180) * t);
/** 7-step ramp, dark -> light; base colour is step 3. Hue drifts to violet in shadow and warm yellow in light. */
function ramp(hex, n = 7) {
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  return Array.from({ length: n }, (_, i) => {
    const k = (i / (n - 1) - .5) * 2, room = k < 0 ? l - .06 : .95 - l;
    const L = l + k * Math.min(k < 0 ? .27 : .25, Math.max(.1, room));
    return hsl2rgb([k < 0 ? arc(h, 262, -k * .26) : arc(h, 52, k * .2), Math.min(1, s * (1 + (k < 0 ? -k * .15 : -k * .3))), Math.min(.96, Math.max(.04, L))]);
  });
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const pick = (r, l, x, y) => { const idx = Math.max(0, Math.min(1, l)) * (r.length - 1) + .5 + (BAYER[y & 3][x & 3] / 16 - .47) * .7; return r[Math.max(0, Math.min(r.length - 1, Math.floor(idx)))]; };
const hash = (x, y, s = 1) => { let h = (x * 374761393 + y * 668265263 + s * 2147483) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4); d.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + d.length)), 8 + d.length); return o; };
function png(buf) { const H = buf.length / 256, raw = Buffer.alloc(H * 257); for (let y = 0; y < H; y++) Buffer.from(buf.buffer, y * 256, 256).copy(raw, y * 257 + 1); const ih = Buffer.alloc(13); ih.writeUInt32BE(64, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]); }

const faces = ([ox, oy], w, h, d) => ({ top: [ox + d, oy, w, d], bottom: [ox + d + w, oy, w, d], right: [ox, oy + d, d, h], front: [ox + d, oy + d, w, h], left: [ox + d + w, oy + d, d, h], back: [ox + 2 * d + w, oy + d, w, h] });
const LIGHT = { top: .84, left: .68, front: .6, right: .5, back: .44, bottom: .2 };
const SIDES = ["front", "back", "left", "right"], ALL5 = ["top", "front", "back", "left", "right"];
class Cv {
  constructor(h = 64) { this.b = new Uint8Array(64 * h * 4); }
  set(x, y, c) { const i = (y * 64 + x) * 4; this.b[i] = c[0]; this.b[i + 1] = c[1]; this.b[i + 2] = c[2]; this.b[i + 3] = 255; }
  paint(rect, face, fn) { const [x, y, w, h] = rect; for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) { const c = fn(u, v, w, h, face, x + u, y + v); if (c) this.set(x + u, y + v, c); } }
  all(fc, fn, only) { for (const k of only || Object.keys(fc)) this.paint(fc[k], k, fn); }
}
const mat = (r, o = {}) => (u, v, w, h, f, ax, ay) => {
  let l = LIGHT[f] + (.5 - v / Math.max(1, h - 1)) * (o.grad ?? .24) + (hash(ax, ay, o.s || 1) - .5) * (o.noise ?? .09);
  if (u === 0 || u === w - 1) l -= .05; if (f !== "top" && f !== "bottom" && v === h - 1) l -= .06; if (o.weave && (ax + ay) % 2 === 0) l -= .035;
  return pick(r, l + (o.lift || 0), ax, ay);
};
const bmp = (cv, rect, ox, oy, rows, r) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch >= "0" && ch <= "9") cv.set(rect[0] + ox + i, rect[1] + oy + j, r[Math.min(6, 1 + +ch)]); }));
const EMBLEM = {
  diamond: ["..2..", ".232.", "23432", ".232.", "..2.."], crest: ["22222", "23432", "23332", ".232.", "..2.."], star: ["..3..", "..4..", "34443", ".343.", "3...3"],
  moon: [".333.", "34...", "34...", "34..3", ".333."], flower: [".2.2.", "23432", ".343.", "23432", ".2.2."], leaf: ["...23", "..343", ".3432", "343..", "2...."],
  wing: ["3...3", "23.32", "2343.".replace("2343.", ".343."), "..3..", "....."], circuit: ["3.3.3", "3343.", ".343.", "..3.3", "3.3.."], sun: ["3.3.3", ".343.", "34443", ".343.", "3.3.3"],
};
const CAPE = {
  moon: [".222222.", "2344....", "234.....", "234.....", "2344....", ".233332.", "..2222.."], crest: ["..2332..", ".234432.", ".234432.", "..2342..", "...22..."], eclipse: ["..2222..", ".234432.", "23400432", "23400432", ".234432.", "..2222.."],
  shard: ["...23...", "..234...", ".2343...", "..234.3.", "...2343.", "....234."], wing: ["3......3", "23....32", "234..432", ".234432.", "..2332.."], sakura: ["..3.....", ".343..3.", "..3..343", ".....3..", ".3......", "343..3.."],
};
const HS = { short: [6, 3, 2], long: [8, 8, 3], bob: [6, 6, 3], spike: [5, 3, 2], mohawk: [5, 0, 1], hood: [5, 3, 2], helm: [5, 3, 1], horns: [5, 3, 2], bun: [6, 4, 3], wild: [8, 6, 3] };

function build(s) {
  const cv = new Cv(), R = {};
  for (const k of ["skin", "hair", "top", "top2", "pants", "boots", "accent", "metal", "gloves", "coat", "cape"]) if (s[k]) R[k] = ramp(s[k]);
  R.top2 ||= R.top; R.metal ||= ramp("#98a2b8"); R.gloves ||= R.skin; R.accent ||= R.metal;
  const sw = s.slim ? 3 : 4, st = s.hairStyle, [hBack, hSide, hBang] = HS[st], mo = st === "mohawk";
  const head = faces([0, 0], 8, 8, 8), headO = faces([32, 0], 8, 8, 8), body = faces([16, 16], 8, 12, 4), bodyO = faces([16, 32], 8, 12, 4);
  const rarm = faces([40, 16], sw, 12, 4), rarmO = faces([40, 32], sw, 12, 4), larm = faces([32, 48], sw, 12, 4), larmO = faces([48, 48], sw, 12, 4);
  const rleg = faces([0, 16], 4, 12, 4), rlegO = faces([0, 32], 4, 12, 4), lleg = faces([16, 48], 4, 12, 4), llegO = faces([0, 48], 4, 12, 4);

  // head: skin, hair, face
  cv.all(head, mat(R.skin, { noise: .08, grad: .14 }));
  const strand = (r, face, v, ax, ay, top) => pick(r, LIGHT[face] + (.5 - v / 7) * .34 + (hash(ax, 3, 9) - .5) * .26 + (top && v === 1 ? .14 : 0), ax, ay);
  cv.all(head, (u, v, w, h, f, ax, ay) => {
    let on = false;
    if (f === "top") on = !mo || (u >= 3 && u <= 4);
    else if (f === "back") on = v < hBack && (!mo || (u >= 3 && u <= 4));
    else if (f === "front") on = mo ? v === 0 && u >= 3 && u <= 4 : v === 0 || (v === 1 && u < (s.sweep ? 6 : 4)) || (v === 2 && u < 2 && hBang >= 3) || (st === "long" && (u === 0 || u === 7) && v < 6);
    else on = !mo && v < hSide && !(v >= 2 && hSide <= 4 && (f === "right" ? u >= 5 : u <= 2));
    return on ? strand(R.hair, f, v, ax, ay, f === "top") : null;
  }, ALL5);
  const er = ramp(s.eyes || "#1c2340"), F = head.front, setF = (u, v, c) => cv.set(F[0] + u, F[1] + v, c);
  for (const [u, white] of [[1, true], [2, false], [5, false], [6, true]]) { setF(u, 4, s.glow ? er[6] : white ? [236, 238, 246] : er[2]); setF(u, 5, s.glow ? er[4] : white ? [208, 212, 228] : er[1]); }
  if (!s.glow) for (const u of [1, 2, 5, 6]) setF(u, 3, hash(u, 1) > .3 ? R.hair[1] : R.skin[1]);
  const lip = s.lips ? ramp(s.lips)[3] : R.skin[1]; setF(3, 5, R.skin[2]); setF(4, 5, R.skin[2]); setF(3, 6, lip); setF(4, 6, lip);
  if (s.blush) { const b = ramp(s.blush); setF(0, 5, b[4]); setF(7, 5, b[4]); setF(1, 6, b[3]); setF(6, 6, b[3]); }

  // torso
  cv.all(body, mat(R.top, { weave: true }));
  if (EMBLEM[s.emblem]) bmp(cv, body.front, 1, 1, EMBLEM[s.emblem].map((r) => r.padEnd(5, ".")), R.accent);
  for (const k of SIDES) { const r = body[k]; cv.paint([r[0], r[1] + 10, r[2], 2], k, (u, v, w, h, f, ax, ay) => (v === 0 ? pick(R.accent, .6, ax, ay) : pick(R.boots, .28 + hash(ax, ay) * .12, ax, ay))); }
  for (const [u, v, i] of [[3, 10, 6], [4, 10, 5], [3, 11, 3], [4, 11, 2]]) cv.set(body.front[0] + u, body.front[1] + v, R.metal[i]);
  // arms
  for (const a of [rarm, larm]) {
    const short = s.sleeve === "short";
    cv.all(a, (u, v, w, h, f, ax, ay) => v >= (short ? 4 : 9) ? (v >= 9 && s.gloves ? mat(R.gloves, { noise: .1 })(u, v, w, h, f, ax, ay) : mat(R.skin, { noise: .08 })(u, v, w, h, f, ax, ay)) : mat(f === "top" ? R.top : R.top2, { weave: true })(u, v, w, h, f, ax, ay));
    if (!short) cv.all(a, (u, v, w, h, f, ax, ay) => (v === 8 ? pick(R.accent, .58 + hash(ax, ay) * .1, ax, ay) : null), SIDES);
  }
  // legs
  for (const l of [rleg, lleg]) {
    cv.all(l, (u, v, w, h, f, ax, ay) => f === "bottom" ? pick(R.boots, .12, ax, ay) : v >= 9 ? (v === 9 ? pick(R.accent, .66, ax, ay) : mat(R.boots, { grad: .3, noise: .16, s: 4 })(u, v, w, h, f, ax, ay)) : mat(R.pants, { weave: true, s: 3 })(u, v, w, h, f, ax, ay));
    cv.paint([l.front[0], l.front[1] + 10, 4, 2], "front", (u, v, w, h, f, ax, ay) => (u > 0 && u < 3 && v === 0 ? pick(R.boots, .86, ax, ay) : null));
  }

  // ===== 2nd layer =====
  const H = headO;
  if (st === "hood" || st === "helm") {
    const r = st === "hood" ? (R.coat || R.top) : R.metal, vis = ramp(s.visorColor || s.accent2 || "#46c8ff");
    cv.all(H, (u, v, w, h, f, ax, ay) => {
      if (f === "front") { if (st === "hood" && u >= 1 && u <= 6 && v >= 2) return null; if (st === "helm") { if (v === 3 || v === 4) return u >= 1 && u <= 6 ? pick(vis, (v === 3 ? .8 : .55) + (u % 3) * .06, ax, ay) : mat(r)(u, v, w, h, f, ax, ay); if (v > 4 && u >= 2 && u <= 5) return null; } }
      if (st === "helm" && f === "top" && (u === 3 || u === 4)) return pick(R.accent, .8, ax, ay);
      return mat(r, { weave: st === "hood", noise: .12, lift: .03 })(u, v, w, h, f, ax, ay);
    }, ALL5);
  } else cv.all(H, (u, v, w, h, f, ax, ay) => {
    let on = false;
    if (f === "top") on = !mo || (u >= 3 && u <= 4) || (st === "spike" && hash(u, v, 5) > .4);
    else if (f === "back") on = v < hBack + 1 && (!mo || (u >= 3 && u <= 4)) && (v < hBack - 1 || hash(u, v, 2) > .35);
    else if (f === "front") on = mo ? v === 0 && u >= 3 && u <= 4 : (v === 0 && (st !== "spike" || u % 2 === 0)) || (v === 1 && ["long", "bob", "wild"].includes(st) && (u < 2 || u > 5 || hash(u, 1, 4) > .6)) || (v === 2 && ["long", "bob"].includes(st) && (u < 1 || u > 6));
    else on = !mo && v < hSide + 1 && (v < 2 || hSide > 5 || (f === "right" ? u < 4 : u > 3)) && hash(u, v, 6) > .12;
    return on ? pick(R.hair, LIGHT[f] + .06 + (.5 - v / 8) * .3 + (hash(ax, 5, 3) - .5) * .34 + (v === 0 ? .08 : 0), ax, ay) : null;
  }, ALL5);
  if (st === "horns") for (const [f, u, v] of [["right", 3, 0], ["right", 4, 0], ["left", 3, 0], ["left", 4, 0], ["right", 4, 1], ["left", 3, 1], ["top", 0, 3], ["top", 7, 3], ["top", 0, 4], ["top", 7, 4]]) cv.set(H[f][0] + u, H[f][1] + v, R.accent[(u + v) % 2 ? 5 : 6]);
  if (st === "bun") for (let v = 0; v < 3; v++) for (let u = 2; u < 6; u++) cv.set(H.back[0] + u, H.back[1] + v, pick(R.hair, .5 + hash(u, v, 1) * .35, u, v));
  if (s.crown) { const cr = ramp(s.crown); for (const f of SIDES) for (let u = 0; u < 8; u++) { cv.set(H[f][0] + u, H[f][1], cr[u % 2 ? 5 : 3]); if (f === "front") cv.set(H[f][0] + u, H[f][1] + 1, u % 4 === 2 ? [190, 28, 60] : cr[u % 2 ? 2 : 4]); } }
  if (s.visor) { const vr = ramp(s.visor); cv.paint(H.front, "front", (u, v, w, h, f, ax, ay) => (v === 3 || v === 4 ? pick(vr, (v === 3 ? .8 : .52) + (u % 4 === 1 ? .1 : 0), ax, ay) : null)); for (const f of ["right", "left"]) cv.paint(H[f], f, (u, v, w, h, fa, ax, ay) => (v === 3 ? pick(vr, .5, ax, ay) : null)); }
  if (s.scarf) { const sr = ramp(s.scarf); for (const k of SIDES) cv.paint(bodyO[k], k, (u, v, w, h, f, ax, ay) => (v < 2 ? pick(sr, .6 + hash(ax, ay) * .2 - v * .12, ax, ay) : null)); }

  if (s.coat) {
    const cm = mat(R.coat, { weave: true, noise: .12, s: 11 }), open = s.open !== false, tail = Math.max(0, Math.min(10, (s.coatLen || 8) - 2));
    cv.all(bodyO, (u, v, w, h, f, ax, ay) => {
      if (f === "bottom") return null;
      if (f === "top") return null;
      if (f === "front" && open && u >= 3 && u <= 4 && v > 1) return null;
      if (f === "front" && open && (u === 2 || u === 5) && v > 1) return pick(R.accent, .56 + (v % 2) * .14, ax, ay);
      return cm(u, v, w, h, f, ax, ay);
    });
    for (const [l, inner] of [[rlegO, 3], [llegO, 0]]) for (const k of SIDES) cv.paint(l[k], k, (u, v, w, h, f, ax, ay) => v >= tail ? null : (v === tail - 1 ? pick(R.accent, .6, ax, ay) : open && f === "front" && u === inner && v > 2 ? null : cm(u, v, w, h, f, ax, ay)));
  }
  if (s.cape) {
    const mot = CAPE[s.motif];
    cv.paint(bodyO.back, "back", (u, v, w, h, f, ax, ay) => pick(R.cape, .5 + Math.sin(u * 1.1 + v * .25) * .17 + (.5 - v / 11) * .22 + (hash(ax, ay, 8) - .5) * .1, ax, ay));
    if (mot) bmp(cv, bodyO.back, 0, 3, mot.map((r) => r.padEnd(8, ".")), R.accent);
    cv.paint([bodyO.back[0], bodyO.back[1], 8, 1], "back", (u, v, w, h, f, ax, ay) => pick(R.metal, .55 + (u % 2) * .1, ax, ay));
  }
  for (const a of [rarmO, larmO]) {
    const pm = s.pauldron ? (s.pauldron === "metal" ? R.metal : R.accent) : null;
    cv.all(a, (u, v, w, h, f, ax, ay) => {
      if (pm && v < 3 && f !== "bottom") return mat(pm, { noise: .1, grad: .3, lift: .08 })(u, v, w, h, f, ax, ay);
      if (s.coat && v < 9 && f !== "bottom" && f !== "top") return mat(R.coat, { weave: true, s: 13 })(u, v, w, h, f, ax, ay);
      if (v >= 7 && v <= 9 && f !== "top" && f !== "bottom") return v === 8 ? pick(R.accent, .72, ax, ay) : mat(R.metal, { grad: .2, lift: -.05 })(u, v, w, h, f, ax, ay);
      return null;
    });
  }
  for (const l of [rlegO, llegO]) cv.all(l, (u, v, w, h, f, ax, ay) => {
    if (f === "top" || f === "bottom") return null;
    if (v >= 8 && v <= 10) return v === 8 ? pick(R.accent, .74, ax, ay) : mat(R.boots, { lift: .1 })(u, v, w, h, f, ax, ay);
    if (s.greaves && v >= 4 && v <= 6) return mat(R.metal, { grad: .3 })(u, v, w, h, f, ax, ay);
    return null;
  });
  return cv;
}

const SKINS = [
  { id: "aether-knight", name: "Aether Knight", model: "classic", d: "Sky-silver plate under a white surcoat, gold hair, a wing crest on the cape.", skin: "#f1cfb2", hair: "#e6b94f", eyes: "#2a62d8", top: "#c9d4e8", top2: "#dfe7f4", pants: "#2f4a86", boots: "#9fb0cf", accent: "#4a86ff", metal: "#b8c4dc", coat: "#eef2fa", coatLen: 9, pauldron: "metal", emblem: "wing", cape: "#3469d6", motif: "wing", hairStyle: "short", sweep: true, gloves: "#7f8fb2", greaves: true },
  { id: "cobalt-rogue", name: "Cobalt Rogue", model: "slim", slim: true, d: "Hooded cobalt coat, dark gloves and a blue lining that catches the light.", skin: "#8a5a3d", hair: "#14182c", eyes: "#6fd3ff", top: "#18214a", top2: "#1d2a5c", pants: "#10162e", boots: "#0b0f20", accent: "#2b4bff", coat: "#2540c8", coatLen: 7, hairStyle: "hood", scarf: "#0f1530", emblem: "diamond", cape: "#1a2e8a", motif: "crest", gloves: "#0f1530" },
  { id: "sakura-ronin", name: "Sakura Ronin", model: "slim", slim: true, d: "Plum haori over a pale kimono, long ink hair and petals on the back.", skin: "#f4d9c6", hair: "#241a30", eyes: "#7a2f4f", top: "#f0e4ea", top2: "#eadbe2", pants: "#3c2d4c", boots: "#1f1727", accent: "#f06b9a", coat: "#5a3a66", coatLen: 11, hairStyle: "long", blush: "#f08aa8", emblem: "flower", cape: "#7b4a86", motif: "sakura", lips: "#c8506f", gloves: "#e6d4dc" },
  { id: "void-walker", name: "Void Walker", model: "classic", d: "Horned, violet-skinned wanderer with glowing eyes and an eclipse on the back.", skin: "#6c5b88", hair: "#120d20", eyes: "#f0b8ff", glow: true, top: "#1b1233", top2: "#241845", pants: "#0f0a1d", boots: "#08050f", accent: "#b04dff", coat: "#150e2a", coatLen: 8, open: false, hairStyle: "horns", emblem: "diamond", cape: "#1b1138", motif: "eclipse", pauldron: "accent", gloves: "#0f0a1d" },
  { id: "frost-warden", name: "Frost Warden", model: "classic", d: "Ice-blue guard with a silver mane, glacier pauldrons and a shard cape.", skin: "#e9cdb6", hair: "#e4eeff", eyes: "#3b8fd8", top: "#5f9ccc", top2: "#7db4dc", pants: "#2b5686", boots: "#d4e4f2", accent: "#9be2ff", metal: "#cfe3f2", coat: "#bcdcf2", coatLen: 8, pauldron: "metal", emblem: "star", cape: "#35709f", motif: "shard", hairStyle: "long", gloves: "#a9cde6", greaves: true },
  { id: "solaris-mage", name: "Solaris Mage", model: "classic", d: "Ember-red robes with a gold sun, wild flame hair and a sunburst cape.", skin: "#c88c5c", hair: "#c4491c", eyes: "#ffd24a", top: "#e8a82e", top2: "#f0bb43", pants: "#7a2418", boots: "#4a2314", accent: "#ffe08a", coat: "#c23a2a", coatLen: 11, hairStyle: "wild", emblem: "sun", cape: "#d9532f", motif: "moon", gloves: "#f0bb43", lips: "#a8503a" },
  { id: "cyber-drift", name: "Cyber Drift", model: "slim", slim: true, d: "Cyan mohawk, neon visor and a black jacket with circuit traces.", skin: "#d9a98c", hair: "#19d6f0", eyes: "#101828", top: "#171a24", top2: "#1c2030", pants: "#0d0f16", boots: "#e0287a", accent: "#18e0f5", coat: "#2a2f42", coatLen: 4, hairStyle: "mohawk", visor: "#22e6ff", emblem: "circuit", cape: "#1b1f2e", motif: "shard", gloves: "#0d0f16" },
  { id: "obsidian-monarch", name: "Obsidian Monarch", model: "classic", d: "Black regalia trimmed in gold, a jewelled crown and a crest on the cape.", skin: "#b88b69", hair: "#0e0d12", eyes: "#d6a02a", top: "#1a1720", top2: "#221d2b", pants: "#14111a", boots: "#0b090e", accent: "#e6b53c", metal: "#d9ad3a", coat: "#2c1f3c", coatLen: 12, open: false, pauldron: "accent", hairStyle: "short", crown: "#e6b53c", emblem: "crest", cape: "#3a1f4c", motif: "crest", gloves: "#14111a" },
  { id: "crimson-valkyrie", name: "Crimson Valkyrie", model: "slim", slim: true, d: "Gold-haired shield-maiden in crimson with winged pauldrons.", skin: "#f2cdb0", hair: "#f0cf72", eyes: "#b4202e", top: "#92192c", top2: "#a8263a", pants: "#4c1022", boots: "#c8a24a", accent: "#f2c75c", metal: "#e0b850", coat: "#e9e0cf", coatLen: 5, pauldron: "metal", hairStyle: "long", emblem: "wing", cape: "#b52a3d", motif: "wing", greaves: true, gloves: "#c8a24a" },
  { id: "moss-spirit", name: "Moss Spirit", model: "classic", d: "A forest spirit in layered leaf cloth with firefly-lit moss hair.", skin: "#9ab97a", hair: "#3f7a3a", eyes: "#f1f59a", glow: true, top: "#527f46", top2: "#5f9150", pants: "#2e482a", boots: "#59432c", accent: "#d8f07c", coat: "#36592f", coatLen: 7, hairStyle: "wild", emblem: "leaf", cape: "#406c37", motif: "sakura", gloves: "#59432c" },
  { id: "astral-traveler", name: "Astral Traveler", model: "classic", d: "Indigo coat dusted with stars, a hair bun and a nebula cape.", skin: "#f1d1ba", hair: "#44339a", eyes: "#8fd3ff", top: "#1d1654", top2: "#261c6a", pants: "#120e3a", boots: "#7cc8f5", accent: "#8fd9ff", coat: "#2e2480", coatLen: 10, hairStyle: "bun", emblem: "star", cape: "#2a2078", motif: "sakura", blush: "#e79ac0", gloves: "#7cc8f5" },
  { id: "amethyst-duelist", name: "Amethyst Duelist", model: "classic", d: "Violet fencer's coat with silver cuffs and a swept dark fringe.", skin: "#ebc9ab", hair: "#2a1a40", eyes: "#b46ef0", top: "#7b3fb8", top2: "#8d52c9", pants: "#25143a", boots: "#150c20", accent: "#e2b8ff", metal: "#cfc9e0", coat: "#44226a", coatLen: 10, pauldron: "metal", hairStyle: "short", sweep: true, emblem: "diamond", cape: "#552d86", motif: "crest", gloves: "#cfc9e0" },
];
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
const meta = [];
for (const s of SKINS) {
  const cv = build(s); fs.writeFileSync(path.join(OUT, s.id + ".png"), png(cv.b));
  let outer = 0, total = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if ((y < 16 && x >= 32) || (y >= 32 && !(x >= 56 && y < 48))) { total++; if (cv.b[(y * 64 + x) * 4 + 3]) outer++; }
  meta.push({ id: s.id, name: s.name, model: s.model, description: s.d, file: `skins/${s.id}.png`, author: "Luminos", licence: "CC0-1.0", builtin: true, outerFill: +(outer / total).toFixed(2) });
}
fs.writeFileSync(path.join(ROOT, "app/src/data/skins.json"), JSON.stringify(meta, null, 1) + "\n");
console.log("wrote", meta.length, "skins");

// ---------- capes (64x32; outer face at 1,1 10x16) ----------
const CAPES = [
  { id: "luminos-celestial-moon", name: "Celestial Moon", d: "Deep navy cloth with a gold crescent and a scatter of stars.", base: "#16224f", acc: "#f2c75c", motif: "moon" },
  { id: "luminos-cobalt-crest", name: "Cobalt Crest", d: "Cobalt banner cloth with a silver crest.", base: "#2548d8", acc: "#dfe7f6", motif: "crest" },
  { id: "luminos-sakura-drift", name: "Sakura Drift", d: "Plum silk with drifting pink petals.", base: "#4c2c5e", acc: "#f58db3", motif: "sakura" },
  { id: "luminos-eclipse", name: "Eclipse", d: "Black cloth, a ring of ember light.", base: "#120f1c", acc: "#ff8a3d", motif: "eclipse" },
  { id: "luminos-shard", name: "Crystal Shard", d: "Teal cloth cut with glassy shards.", base: "#0f5c70", acc: "#7ef0ff", motif: "shard" },
  { id: "luminos-valkyrie", name: "Valkyrie", d: "Crimson with gold wing-work.", base: "#8e1a2c", acc: "#f2c75c", motif: "wing" },
  { id: "luminos-nightfall", name: "Nightfall", d: "Indigo dusk, stars along the hem.", base: "#251b6b", acc: "#a9c8ff", motif: "stars" },
  { id: "luminos-ember-sun", name: "Ember Sun", d: "Burnt orange with a low sun.", base: "#b8431f", acc: "#ffd37a", motif: "sun" },
];
const SUN = ["..3.3.3.", ".3.343.3", "..34443.", ".3.343.3", "..3.3.3."];
const capeDir = path.join(ROOT, "app/public/library/capes"); fs.mkdirSync(capeDir, { recursive: true });
for (const f of fs.readdirSync(capeDir)) if (f.endsWith(".png")) fs.unlinkSync(path.join(capeDir, f));
const capeMeta = [];
for (const c of CAPES) {
  const cv = new Cv(32), r = ramp(c.base), a = ramp(c.acc);
  const cloth = (x, y, inner) => pick(r, .5 + Math.sin(x * .95 + y * .16 + (inner ? 2 : 0)) * .17 + (.5 - y / 17) * .22 + (hash(x, y, 21) - .5) * .09 - (inner ? .12 : 0), x, y);
  for (let y = 0; y < 17; y++) for (let x = 0; x < 22; x++) cv.set(x, y, cloth(x, y, x >= 12));
  for (let x = 1; x < 11; x++) { cv.set(x, 15, pick(a, .55 + (x % 2) * .1, x, 15)); cv.set(x, 16, pick(a, .35, x, 16)); cv.set(x, 1, pick(r, .22, x, 1)); }
  const rows = (c.motif === "sun" ? SUN : CAPE[c.motif] || null)?.map((q) => q.padEnd(8, "."));
  if (rows) bmp(cv, [1, 1], 1, c.motif === "sun" ? 6 : 4, rows, a);
  if (c.motif === "stars" || c.motif === "moon") for (let i = 0; i < 9; i++) { const x = 1 + ((hash(i, 1, 31) * 10) | 0), y = 2 + ((hash(i, 2, 31) * 13) | 0); if (c.motif === "stars" || y > 11 || x > 6) cv.set(x, y, a[hash(i, 3) > .5 ? 5 : 3]); }
  fs.writeFileSync(path.join(capeDir, c.id + ".png"), png(cv.b));
  capeMeta.push({ id: c.id, name: c.name, description: c.d, file: `library/capes/${c.id}.png`, frames: 1, frameMs: 0, animated: false, author: "Luminos", licence: "CC0-1.0", source: "tools/make-skins.mjs" });
}
const libPath = path.join(ROOT, "app/src/data/library.json"), lib = JSON.parse(fs.readFileSync(libPath, "utf8"));
lib.capes = capeMeta; lib.generator = "tools/make-skins.mjs"; fs.writeFileSync(libPath, JSON.stringify(lib, null, 1) + "\n");
const rsCape = path.join(ROOT, "launcher/crates/luminos-core/assets/capes"); fs.mkdirSync(rsCape, { recursive: true });
fs.copyFileSync(path.join(capeDir, "luminos-celestial-moon.png"), path.join(rsCape, "luminos-moon-cape.png"));
console.log("wrote", capeMeta.length, "capes");
