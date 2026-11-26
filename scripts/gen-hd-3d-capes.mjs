#!/usr/bin/env node
// Luminos v2.3.0: ten HD capes at 512x256 (8x the vanilla 64x32 layout).
//
// Vanilla cape UV (64x32): top (1,0) 10x1, bottom (11,0) 10x1, right edge (0,1) 1x16, OUTER face (1,1) 10x16,
// left edge (11,1) 1x16, inner face (12,1) 10x16. At 8x every texel of the outer face is a 1:1 pixel of an
// 80x128 canvas, which is what the designs below are drawn on. Edges carry colours copied from the face edge
// so the cloth reads as having thickness, and every cape gets a bevelled frame plus vertical drape shading.
//
// Output: app/public/capes/<id>.png and client/src/main/resources/assets/luminos_client/textures/capes/<id>.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Img, hex, shade, mix, bayer, text, textCentered, textWidth, rng } from "./lib/raster.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = [path.join(ROOT, "app/public/capes"), path.join(ROOT, "client/src/main/resources/assets/luminos_client/textures/capes")];
const W = 80, H = 128, K = 8;

/** Vertical gradient with ordered dither between the given stops, quantised to `steps` colours. */
function dithered(F, x0, y0, w, h, stops, steps = 6, horizontal = false) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = (horizontal ? x / (w - 1) : y / (h - 1)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
    const q = f * (steps - 1), lo = Math.floor(q), up = q - lo > bayer(x0 + x, y0 + y) ? 1 : 0;
    F.set(x0 + x, y0 + y, mix(stops[i], stops[i + 1], Math.min(1, (lo + up) / (steps - 1))));
  }
}
/** Raised frame, `t` px thick: lit top/left, shaded bottom/right, mitred corners. */
function bevelFrame(F, col, t = 4, x0 = 0, y0 = 0, w = W, h = H) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dl = x, dr = w - 1 - x, dt = y, db = h - 1 - y, d = Math.min(dl, dr, dt, db);
    if (d >= t) continue;
    let f;
    if (d === dt && dt <= dl && dt < dr) f = 1.22; else if (d === dl) f = 1.1; else if (d === db) f = 0.62; else if (d === dr) f = 0.74; else f = 1;
    const ring = d === 0 ? 0.78 : d === t - 1 ? 0.88 : 1; // dark outer line, soft inner line
    F.set(x0 + x, y0 + y, shade(col, f * ring));
  }
}
/** Cloth drape: soft vertical folds, shoulder shadow, hem darkening. Skips pixels listed as hardware later. */
function drape(F, strength = 1) {
  F.map((p, x, y) => {
    const fold = 1 + 0.09 * strength * Math.sin((x / W) * Math.PI * 2 * 3.5 + 0.8) + 0.04 * strength * Math.sin((x / W) * Math.PI * 2 * 7.5);
    const top = y < 18 ? 1 - 0.22 * strength * (1 - y / 18) : 1, hem = y > H - 14 ? 1 - 0.2 * strength * ((y - (H - 14)) / 14) : 1;
    return shade([p[0], p[1], p[2]], fold * top * hem);
  });
}
const metal = (F, x, y, w, h, c) => { F.rect(x, y, w, h, c); F.rect(x, y, w, 1, shade(c, 1.35)); F.rect(x, y, 1, h, shade(c, 1.2)); F.rect(x, y + h - 1, w, 1, shade(c, 0.55)); F.rect(x + w - 1, y, 1, h, shade(c, 0.7)); };
const rivet = (F, x, y, c = hex("#e8edf6")) => { F.set(x, y, c); F.set(x + 1, y, shade(c, 0.75)); F.set(x, y + 1, shade(c, 0.75)); F.set(x + 1, y + 1, shade(c, 0.5)); };

const CAPES = [];
const cape = (id, name, tag, desc, base, draw, post, opts = {}) => CAPES.push({ id, name, tag, desc, base: hex(base), draw, post, opts });

// 1 ------------------------------------------------------------------------------------------------------------
cape("luminos-original-moon", "Luminos Original Moon 3D", "3D", "Midnight cloak, the dithered crescent, a silver shoulder clasp.", "#0c1b4a", (F) => {
  dithered(F, 0, 0, W, H, [hex("#060a1a"), hex("#0c1b4a"), hex("#16296a"), hex("#274a9c")], 8);
  const r = rng(7);
  for (let i = 0; i < 26; i++) { const x = 6 + Math.floor(r() * 68), y = 8 + Math.floor(r() * 76); F.set(x, y, hex(r() > 0.6 ? "#e2eeff" : "#8fb0ff")); if (r() > 0.85) { F.set(x + 1, y, hex("#5c8cff")); F.set(x, y + 1, hex("#5c8cff")); } }
  const cx = 40, cy = 52;
  for (let y = -34; y <= 34; y++) for (let x = -34; x <= 34; x++) { const d = Math.hypot(x, y); if (d > 22 && d < 34 && (1 - (d - 22) / 12) * 0.5 > bayer(cx + x, cy + y)) F.set(cx + x, cy + y, mix(F.get(cx + x, cy + y).slice(0, 3), hex("#5c8cff"), 0.55)); }
  for (let y = -22; y <= 22; y++) for (let x = -22; x <= 22; x++) {
    if (Math.hypot(x, y) > 21.5 || Math.hypot(x - 10, y + 4) < 19) continue;
    const t = (x + y + 30) / 60; F.set(cx + x, cy + y, mix(hex("#e2eeff"), hex("#5c8cff"), Math.min(1, Math.max(0, t + (bayer(x, y) - 0.5) * 0.35))));
  }
  for (const [x, y, rr] of [[-10, -3, 3], [-14, 8, 2], [-6, 12, 2]]) F.disc(cx + x, cy + y, rr, hex("#a9c3ff"));
  // dithered cloud banks along the hem
  for (let y = 92; y < 124; y++) for (let x = 4; x < 76; x++) { const wave = Math.sin(x * 0.22 + y * 0.35) * 3 + (y - 92) / 4; if (wave > 3 && bayer(x, y) < Math.min(1, (wave - 3) / 6)) F.set(x, y, hex(y % 4 < 2 ? "#0a1438" : "#13245c")); }
  text(F, "LUMINOS", 40 - textWidth("LUMINOS") / 2, 112, hex("#cfe0ff"));
  bevelFrame(F, hex("#aab6cc"), 4);
}, (F) => {
  metal(F, 10, 0, 20, 9, hex("#c4cddd")); metal(F, 50, 0, 20, 9, hex("#c4cddd")); rivet(F, 14, 3); rivet(F, 24, 3); rivet(F, 54, 3); rivet(F, 64, 3);
  for (let i = 0; i < 6; i++) { const x = 30 + i * 4; metal(F, x, 3 + (i % 2), 4, 3, hex("#97a3bb")); }
  F.disc(40, 7, 4, hex("#dfe6f3")); F.disc(40, 7, 2, hex("#5c8cff"));
});

// 2 ------------------------------------------------------------------------------------------------------------
cape("job-application", "Job Application 3D", "Meme", "A wooden clipboard, a steel spring clip and a very serious form.", "#8a5a2b", (F) => {
  dithered(F, 0, 0, W, H, [hex("#a06a34"), hex("#8a5a2b"), hex("#734a23")], 6); // wood
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((Math.sin(y * 0.9 + x * 0.12) + Math.sin(y * 0.31 + 2)) > 1.45) F.set(x, y, hex("#6a4320")); // grain
  F.rect(8, 14, 64, 108, hex("#7a7466")); // paper drop shadow
  F.rect(7, 13, 64, 108, hex("#f6f4ec")); F.rect(7, 13, 64, 1, hex("#ffffff")); F.rect(70, 13, 1, 108, hex("#d8d4c6"));
  const ink = hex("#1c2230"), faint = hex("#a8a89a"), blue = hex("#2b4bff");
  text(F, "EMPLOYMENT", 12, 22, ink); text(F, "EMPLOYMENT", 13, 22, ink); text(F, "APPLICATION", 12, 29, ink); text(F, "APPLICATION", 13, 29, ink);
  F.rect(11, 36, 56, 1, ink);
  text(F, "NAME:", 11, 41, faint); F.rect(33, 46, 34, 1, ink); text(F, "STEVE", 35, 41, blue);
  text(F, "EXPERIENCE:", 11, 52, faint); F.rect(11, 58, 56, 1, faint); text(F, "0 HRS TOUCHING", 11, 61, ink); text(F, "GRASS", 11, 68, ink); F.rect(11, 74, 56, 1, faint);
  text(F, "SKILLS:", 11, 79, faint); text(F, "LEFT CLICK", 11, 86, ink);
  for (let i = 0; i < 2; i++) { F.rect(11, 93 + i * 0, 4, 4, ink); F.rect(12, 94, 2, 2, hex("#f6f4ec")); }
  F.rect(12, 94, 2, 2, ink); text(F, "CAN START", 17, 93, ink);
  // red URGENT stamp
  const red = hex("#d1242f"); F.rect(40, 99, 28, 9, red); F.rect(41, 100, 26, 7, hex("#f6f4ec")); textCentered(F, "URGENT", 54, 101, red);
  F.rect(11, 110, 56, 9, hex("#ecebe0")); text(F, "SIGN: X_____", 13, 113, ink);
  bevelFrame(F, hex("#8a5a2b"), 4);
}, (F) => {
  metal(F, 22, 0, 36, 16, hex("#aeb7c6"));
  metal(F, 27, 5, 26, 8, hex("#8b95a8")); F.rect(36, 7, 8, 4, hex("#2a2f3a")); F.rect(36, 7, 8, 1, hex("#11141a"));
  rivet(F, 25, 2); rivet(F, 53, 2);
  F.rect(24, 15, 32, 2, hex("#4a5262"));
});

// 3 ------------------------------------------------------------------------------------------------------------
cape("ball-knowledge-tactician", "Ball Knowledge Tactician 3D", "Meme", "A brushed-aluminium coaching board. You either know ball or you don't.", "#2f8f3a", (F) => {
  const g1 = hex("#2f8f3a"), g2 = hex("#37a043"), line = hex("#f1f5f0");
  for (let y = 4; y < H - 4; y++) F.rect(4, y, W - 8, 1, Math.floor((y - 4) / 10) % 2 ? g1 : g2);
  F.rect(8, 8, W - 16, 1, line); F.rect(8, H - 9, W - 16, 1, line); F.rect(8, 8, 1, H - 16, line); F.rect(W - 9, 8, 1, H - 16, line);
  F.rect(8, 64, W - 16, 1, line); F.ring(40, 64, 9, 10, line); F.disc(40, 64, 1, line);
  F.rect(22, 8, 36, 1, line); F.rect(22, 8, 1, 16, line); F.rect(57, 8, 1, 16, line); F.rect(22, 24, 36, 1, line); F.rect(32, 8, 16, 7, line); F.rect(33, 9, 14, 5, g2);
  F.rect(22, H - 25, 36, 1, line); F.rect(22, H - 25, 1, 16, line); F.rect(57, H - 25, 1, 16, line); F.rect(32, H - 15, 16, 7, line); F.rect(33, H - 14, 14, 5, g1);
  const me = hex("#2b4bff"), ring = hex("#ffffff");
  const P = [[40, 108], [16, 96], [30, 98], [50, 98], [64, 96], [24, 82], [40, 84], [56, 82], [20, 50], [40, 38], [60, 50]];
  P.forEach(([x, y], i) => { F.disc(x, y, 4, ring); F.disc(x, y, 3, i < 8 || i === 8 ? me : hex("#e5484d")); });
  // attacking run: curved arrow (quadratic bezier) from the 8 to the box
  const yel = hex("#ffd447"); let px = 24, py = 80;
  for (let t = 0; t <= 1.001; t += 0.02) { const x = (1 - t) ** 2 * 24 + 2 * (1 - t) * t * 8 + t * t * 40, y = (1 - t) ** 2 * 80 + 2 * (1 - t) * t * 50 + t * t * 18; F.rect(x, y, 2, 2, yel); px = x; py = y; }
  F.line(px, py, px - 5, py + 5, yel, 2); F.line(px, py, px + 5, py + 4, yel, 2);
  for (let i = 0; i < 8; i++) F.rect(18 + i * 2, 70 - i, 1, 1, yel);
  // trophy crest
  F.rect(36, 46, 8, 2, hex("#c9962b")); F.rect(37, 41, 6, 5, hex("#f2c14e")); F.rect(35, 40, 2, 3, hex("#c9962b")); F.rect(43, 40, 2, 3, hex("#c9962b")); F.rect(39, 48, 2, 3, hex("#c9962b"));
  text(F, "4-3-3", 10, 12, line, 1);
  // brushed aluminium frame
  bevelFrame(F, hex("#c9d1dc"), 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.min(x, W - 1 - x, y, H - 1 - y) < 4 && (x * 7 + y * 3) % 5 === 0) F.set(x, y, shade(F.get(x, y), 0.93));
}, (F) => { metal(F, 8, 0, 64, 5, hex("#aeb7c6")); rivet(F, 12, 1); rivet(F, 66, 1); });

// 4 ------------------------------------------------------------------------------------------------------------
cape("touch-grass-3d", "Touch Grass 3D", "3D", "A grass block, worn. Diamond ore at the hem.", "#7a5230", (F) => {
  const dirt = [hex("#8a5f3a"), hex("#79502f"), hex("#6a4527"), hex("#5a3a20")], gr = [hex("#6fbf3c"), hex("#5aa62f"), hex("#488a26"), hex("#3a7220")];
  const r = rng(11);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 2) { // dirt in 2x2 clusters
    const c = dirt[Math.floor(r() * 4)]; F.rect(x, y - (y % 2), 2, 2, c);
  }
  // stone strata and diamond ore at the hem
  const st = [hex("#8b8b8b"), hex("#7a7a7a"), hex("#6a6a6a")];
  for (let y = 98; y < H; y++) for (let x = 0; x < W; x += 2) F.rect(x, y - (y % 2), 2, 2, st[Math.floor(r() * 3)]);
  for (const [x, y] of [[14, 106], [42, 112], [60, 104], [26, 118], [52, 120]]) { F.rect(x, y, 6, 6, hex("#5fe6e0")); F.rect(x + 1, y + 1, 4, 4, hex("#9ff4ef")); F.rect(x, y, 6, 1, hex("#2db5b0")); F.rect(x + 5, y, 1, 6, hex("#2db5b0")); F.rect(x, y + 5, 6, 1, hex("#2db5b0")); }
  // grass cap with an uneven overhang
  for (let x = 0; x < W; x += 2) { const len = 20 + Math.floor(r() * 10) + ((x >> 2) % 3) * 2; for (let y = 0; y < len; y++) { const c = y < len - 6 ? gr[(Math.floor(r() * 2))] : gr[2 + (y > len - 3 ? 1 : 0) - (y > len - 3 ? 1 : 0)]; F.rect(x, y, 2, 1, y < 3 ? hex("#86d24a") : c); } F.rect(x, len - 1, 2, 1, gr[3]); }
  bevelFrame(F, hex("#5a3a20"), 4);
}, (F) => { F.rect(8, 0, 64, 6, hex("#5aa62f")); for (let x = 8; x < 72; x += 4) F.rect(x, 5, 2, 3, hex("#488a26")); });

// 5 ------------------------------------------------------------------------------------------------------------
cape("404-skill-not-found", "404 Skill Not Found", "Meme", "Your opponent ran into a problem. It was you. CPS_TOO_LOW.", "#0050ef", (F) => {
  F.rect(0, 0, W, H, hex("#1a1c22"));
  F.rect(4, 4, W - 8, H - 18, hex("#0050ef")); // screen
  for (let y = 4; y < H - 14; y += 2) F.rect(4, y, W - 8, 1, hex("#0a56f0")); // scanlines
  const wht = hex("#ffffff");
  text(F, ":(", 10, 12, wht, 5, 1);
  text(F, "YOUR PC RAN", 9, 42, wht); text(F, "INTO A PROBLEM", 9, 49, wht);
  text(F, "404 SKILL", 9, 59, hex("#bcd3ff")); text(F, "NOT FOUND", 9, 66, hex("#bcd3ff"));
  // QR block
  const qx = 7, qy = 78, r = rng(404); F.rect(qx - 1, qy - 1, 22, 22, wht);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const fx = (x < 7 && y < 7) || (x > 12 && y < 7) || (x < 7 && y > 12); if (!fx && r() > 0.5) F.rect(qx + x, qy + y, 1, 1, hex("#0050ef")); }
  for (const [ox, oy] of [[0, 0], [13, 0], [0, 13]]) { F.rect(qx + ox, qy + oy, 7, 7, hex("#0050ef")); F.rect(qx + ox + 1, qy + oy + 1, 5, 5, wht); F.rect(qx + ox + 2, qy + oy + 2, 3, 3, hex("#0050ef")); }
  text(F, "STOP CODE:", 30, 82, wht); text(F, "CPS_TOO_LOW", 30, 89, hex("#ffd447"));
  text(F, "0% COMPLETE", 30, 98, wht);
  text(F, "CPS: 2", 9, 106, hex("#bcd3ff"));
  // monitor chin: power LED + buttons
  F.rect(34, H - 10, 12, 3, hex("#2c2f38")); F.set(60, H - 9, hex("#3ddc84")); F.set(61, H - 9, hex("#3ddc84"));
  bevelFrame(F, hex("#2a2d36"), 4);
}, (F) => { metal(F, 30, 0, 20, 4, hex("#3a3e4a")); }, { drape: 0.4 });

// 6 ------------------------------------------------------------------------------------------------------------
cape("crimson-ronin-3d", "Crimson Ronin 3D", "3D", "Blood-red haori, gold clouds, lacquer shoulder plates, a strapped katana.", "#7a1019", (F) => {
  dithered(F, 0, 0, W, H, [hex("#4a0a10"), hex("#7a1019"), hex("#a21a26")], 6);
  const gold = hex("#d9a52b"), gd = hex("#a97a18");
  for (let row = 0; row < 7; row++) for (let col = -1; col < 6; col++) { // seigaiha waves
    const cx = col * 16 + (row % 2) * 8, cy = 70 + row * 8; for (let a = 0; a < 3; a++) F.ring(cx, cy, 6 - a * 2.2, 6.7 - a * 2.2, a % 2 ? gd : gold);
  }
  for (let y = 62; y < 72; y++) for (let x = 4; x < 76; x++) if (bayer(x, y) < (72 - y) / 10) F.set(x, y, shade(F.get(x, y).slice(0, 3), 1.05)); // soften seam
  // katana strapped diagonally (hilt top-right to tip bottom-left)
  const x0 = 70, y0 = 12, x1 = 12, y1 = 112;
  F.line(x0 - 1, y0 + 1, x1 - 1, y1 + 1, hex("#2a0508"), 5);
  F.line(x0, y0, x1, y1, hex("#d7dde8"), 3); F.line(x0 - 1, y0, x1 - 1, y1, hex("#ffffff"), 1);
  F.line(x0 + 3, y0 - 3, x0 + 8, y0 - 10, hex("#14080a"), 4); // wrapped handle
  for (let i = 0; i < 4; i++) F.rect(x0 + 3 + i * 1.3, y0 - 3 - i * 2, 2, 1, hex("#e7e0cc"));
  F.line(x0 - 5, y0 + 3, x0 + 5, y0 - 3, gold, 3); // tsuba
  // strap across the chest, other diagonal, with gold buckle
  F.line(6, 14, 74, 74, hex("#16080a"), 6); F.line(6, 13, 74, 73, hex("#2d1013"), 1); F.rect(36, 40, 8, 8, gold); F.rect(38, 42, 4, 4, hex("#16080a")); F.rect(36, 40, 8, 1, hex("#ffe08a")); F.rect(36, 47, 8, 1, gd);
  // lacquer shoulder plates (kozane rows, gold edged)
  for (const px of [4, 42]) { for (let i = 0; i < 4; i++) { metal(F, px + i, 4 + i * 6, 34 - i * 2, 6, hex("#1a0b0e")); F.rect(px + i, 9 + i * 6, 34 - i * 2, 1, gold); } }
  bevelFrame(F, hex("#140709"), 4);
  F.rect(4, 4, W - 8, 1, gold); F.rect(4, H - 5, W - 8, 1, gd); F.rect(4, 4, 1, H - 8, gold); F.rect(W - 5, 4, 1, H - 8, gd);
}, (F) => { metal(F, 6, 0, 28, 6, hex("#1c0d10")); metal(F, 46, 0, 28, 6, hex("#1c0d10")); F.rect(34, 1, 12, 3, hex("#d9a52b")); rivet(F, 10, 2, hex("#d9a52b")); rivet(F, 66, 2, hex("#d9a52b")); });

// 7 ------------------------------------------------------------------------------------------------------------
cape("eclipse-monarch-3d", "Eclipse Monarch 3D", "3D", "Obsidian mantle, gold trim, a corona that never sets.", "#14111c", (F) => {
  dithered(F, 0, 0, W, H, [hex("#07070b"), hex("#14111c"), hex("#1e1830")], 6);
  const cx = 40, cy = 56;
  for (let y = -34; y <= 34; y++) for (let x = -34; x <= 34; x++) {
    const d = Math.hypot(x, y); if (d < 17 || d > 33) continue;
    const a = Math.atan2(y, x), ray = 0.5 + 0.5 * Math.cos(a * 12), fall = 1 - (d - 17) / 16;
    if (fall * (0.55 + 0.45 * ray) > bayer(cx + x, cy + y) + 0.12) F.set(cx + x, cy + y, mix(hex("#ffe9a0"), hex("#c9741f"), 1 - fall));
  }
  F.disc(cx, cy, 17, hex("#050507")); F.ring(cx, cy, 16, 17.6, hex("#fff2c4")); F.ring(cx, cy, 17.6, 18.6, hex("#e8a23a"));
  // royal bottom band: gold chevrons
  for (let row = 0; row < 3; row++) for (let x = 4; x < 76; x += 8) { const y = 100 + row * 7; F.line(x, y, x + 4, y + 4, hex(row % 2 ? "#a97a18" : "#d9a52b"), 2); F.line(x + 8, y, x + 4, y + 4, hex(row % 2 ? "#a97a18" : "#d9a52b"), 2); }
  F.rect(4, 96, W - 8, 2, hex("#d9a52b")); F.rect(4, 122, W - 8, 1, hex("#d9a52b"));
  F.rect(8, 8, W - 16, 1, hex("#a97a18")); F.rect(8, 8, 1, 84, hex("#a97a18")); F.rect(W - 9, 8, 1, 84, hex("#a97a18"));
  bevelFrame(F, hex("#d9a52b"), 4);
}, (F) => { // gold chain clasp
  for (let i = 0; i < 6; i++) { const x = 20 + i * 8; F.ring(x + 3, 4, 2, 3.2, hex("#f1c24e")); }
  metal(F, 33, 0, 14, 9, hex("#d9a52b")); F.disc(40, 5, 3, hex("#050507")); F.ring(40, 5, 3, 4, hex("#fff2c4"));
});

// 8 ------------------------------------------------------------------------------------------------------------
cape("cobalt-prism-3d", "Cobalt Prism 3D", "3D", "Carbon cloak, cobalt energy veins, spine armour.", "#0d1017", (F) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) F.set(x, y, ((x >> 1) + (y >> 1)) % 2 ? hex("#151a24") : hex("#0b0e14"));
  const core = hex("#8fa8ff"), vein = hex("#2b4bff"), halo = hex("#1b2f9e");
  const path = [[[40, 8], [40, 120]], [[40, 30], [20, 20], [10, 30]], [[40, 30], [60, 20], [70, 30]], [[40, 56], [18, 48], [8, 60]], [[40, 56], [62, 48], [72, 60]], [[40, 84], [20, 78], [12, 92]], [[40, 84], [60, 78], [68, 92]]];
  for (const p of path) for (let i = 0; i < p.length - 1; i++) { F.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], halo, 5); }
  for (const p of path) for (let i = 0; i < p.length - 1; i++) { F.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], vein, 3); }
  for (const p of path) for (let i = 0; i < p.length - 1; i++) { F.line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], core, 1); }
  // prism crystal at the nape
  for (let y = 0; y < 18; y++) { const half = Math.round((y / 17) * 10); for (let x = -half; x <= half; x++) F.set(40 + x, 10 + y, mix(hex("#9fb4ff"), hex("#2b4bff"), (x + half) / Math.max(1, 2 * half) * 0.8 + y / 40)); }
  F.line(40, 10, 30, 27, hex("#dbe4ff"), 1); F.line(40, 10, 40, 27, hex("#5c7bff"), 1);
  // spine plates
  for (let i = 0; i < 6; i++) { const y = 34 + i * 14; metal(F, 31, y, 18, 8, hex("#3a4254")); F.rect(33, y + 3, 14, 2, hex("#59627a")); F.rect(38, y + 1, 4, 6, hex("#1d2331")); F.rect(39, y + 2, 2, 4, core); }
  bevelFrame(F, hex("#242b3b"), 4); F.rect(4, 4, W - 8, 1, vein); F.rect(4, H - 5, W - 8, 1, shade(vein, 0.6));
}, (F) => { metal(F, 28, 0, 24, 6, hex("#3a4254")); F.rect(36, 2, 8, 2, hex("#8fa8ff")); }, { drape: 0.6 });

// 9 ------------------------------------------------------------------------------------------------------------
cape("sakura-nightfall-3d", "Sakura Nightfall 3D", "3D", "Twilight indigo, falling blossoms and one paper lantern.", "#2b2a6b", (F) => {
  dithered(F, 0, 0, W, H, [hex("#14123a"), hex("#2b2a6b"), hex("#4a3f8f")], 7);
  const r = rng(3), pet = [hex("#ffd3e2"), hex("#ffb7d0"), hex("#ff8fb5")];
  // blossom branch top-right
  F.line(80, 14, 50, 22, hex("#2a1a24"), 3); F.line(66, 18, 60, 8, hex("#2a1a24"), 2); F.line(58, 20, 48, 30, hex("#2a1a24"), 2);
  for (const [x, y] of [[72, 12], [62, 10], [54, 21], [46, 28], [66, 20], [76, 20], [60, 26]]) { for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) F.rect(x + dx, y + dy, 2, 2, pet[1]); F.rect(x, y, 2, 2, hex("#ffe9a0")); }
  // lantern
  const cx = 40, cy = 78;
  for (let y = -26; y <= 26; y++) for (let x = -26; x <= 26; x++) { const d = Math.hypot(x / 1.0, y / 1.2); if (d > 15 && d < 26 && (1 - (d - 15) / 11) * 0.5 > bayer(cx + x, cy + y)) F.set(cx + x, cy + y, mix(F.get(cx + x, cy + y).slice(0, 3), hex("#ff9a7a"), 0.5)); }
  for (let y = -17; y <= 17; y++) for (let x = -12; x <= 12; x++) if ((x * x) / 144 + (y * y) / 289 <= 1) F.set(cx + x, cy + y, mix(hex("#ffe6a8"), hex("#ff7a8a"), Math.min(1, Math.hypot(x / 12, y / 17) * 0.9)));
  for (const y of [-9, -3, 3, 9]) for (let x = -12; x <= 12; x++) if ((x * x) / 144 + (y * y) / 289 <= 1) F.set(cx + x, cy + y, hex("#b4455c"));
  F.line(cx, cy - 17, cx, cy + 17, hex("#b4455c"), 1);
  F.rect(cx - 7, cy - 21, 14, 4, hex("#1d1128")); F.rect(cx - 7, cy + 17, 14, 4, hex("#1d1128")); F.rect(cx - 1, cy + 21, 2, 12, hex("#ff8fb5")); F.rect(cx - 2, cy + 31, 4, 4, hex("#ff8fb5")); F.rect(cx - 1, cy - 26, 2, 5, hex("#1d1128"));
  for (let i = 0; i < 26; i++) { const x = 5 + Math.floor(r() * 70), y = 6 + Math.floor(r() * 116), c = pet[Math.floor(r() * 3)]; if (Math.hypot(x - cx, y - cy) < 20) continue; F.rect(x, y, 2, 2, c); F.set(x + 2, y + 1, shade(c, 0.8)); F.set(x - 1, y - 1, shade(c, 1.05)); }
  bevelFrame(F, hex("#3a3280"), 4); F.rect(4, 4, W - 8, 1, hex("#ffb7d0")); F.rect(4, H - 5, W - 8, 1, hex("#7a4d8a"));
}, (F) => { metal(F, 12, 0, 56, 5, hex("#2a1a24")); for (let x = 16; x < 66; x += 10) F.rect(x, 1, 3, 3, hex("#ffb7d0")); });

// 10 -----------------------------------------------------------------------------------------------------------
cape("void-dragon-3d", "Void Dragon 3D", "3D", "Ender-obsidian scales, glowing spine ridges, a tattered hem.", "#12081f", (F) => {
  dithered(F, 0, 0, W, H, [hex("#07040f"), hex("#12081f"), hex("#1c0d33")], 6);
  const line = hex("#2c1650"), hi = hex("#3b1f6b");
  for (let row = 0; row < 18; row++) for (let col = -1; col < 11; col++) { const cx = col * 8 + (row % 2) * 4, cy = row * 7; F.ring(cx, cy + 6, 4, 4.9, line); F.set(cx - 3, cy + 2, hi); }
  // spine ridges
  const gl = hex("#d28cff"), mid = hex("#a43cff"), dk = hex("#5a14a8");
  for (let i = 0; i < 9; i++) {
    const y = 14 + i * 12, wd = 11 - Math.abs(4 - i) * 1.2;
    for (let q = 0; q < 14; q++) { const half = Math.round(wd * (1 - q / 14)); for (let x = -half; x <= half; x++) F.set(40 + x, y + q - 4, x < 0 ? mid : dk); F.set(40, y + q - 4, gl); }
    F.line(40, y - 4, 40 - Math.round(wd), y + 8, gl, 1);
  }
  F.rect(39, 6, 2, 118, mid);
  F.line(40, 4, 40, 120, shade(gl, 0.9), 1);
  // tattered hem
  const r = rng(99); for (let x = 4; x < W - 4; x += 2) { const len = 4 + Math.floor(r() * 9); for (let y = H - 4 - len; y < H - 4; y++) F.rect(x, y, 2, 1, hex(y > H - 8 ? "#050309" : "#0a0516")); }
  bevelFrame(F, hex("#241046"), 4); F.rect(4, 4, W - 8, 1, mid); 
}, (F) => { metal(F, 20, 0, 40, 5, hex("#2a1450")); for (let x = 22; x < 58; x += 6) { F.rect(x, 1, 2, 3, hex("#d28cff")); } }, { drape: 0.7 });

// ---------------------------------------------------------------------------------------------------------------
function build(c) {
  const F = new Img(W, H); c.draw(F);
  drape(F, c.opts.drape ?? 1); c.post(F);
  const out = new Img(64 * K, 32 * K);
  out.blit(F, 1 * K, 1 * K); // outer face (1,1) 10x16 at 8x = (8,8) 80x128
  // thickness edges and top/bottom copy the face's own border colours so the cloth reads as having depth
  for (let y = 0; y < H; y++) {
    const l = F.get(0, y), r = F.get(W - 1, y);
    for (let x = 0; x < K; x++) { out.set(0 * K + x, K + y, shade(l, 0.45 + 0.4 * (x / (K - 1)))); out.set(11 * K + x, K + y, shade(r, 0.85 - 0.4 * (x / (K - 1)))); }
  }
  for (let x = 0; x < W; x++) {
    const t = F.get(x, 0), b = F.get(x, H - 1);
    for (let y = 0; y < K; y++) { out.set(1 * K + x, y, shade(t, 0.55 + 0.35 * (y / (K - 1)))); out.set(11 * K + x, y, shade(b, 0.8 - 0.4 * (y / (K - 1)))); }
  }
  // inner face (12,1): plain lined cloth in the cape's base colour, folds only
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.set(12 * K + x, K + y, shade(c.base, 0.42 + 0.06 * Math.sin((x / W) * Math.PI * 2 * 3.5 + 0.8) + (y < 14 ? -0.08 * (1 - y / 14) : 0)));
  return out;
}

for (const d of OUT) fs.mkdirSync(d, { recursive: true });
const manifest = [];
for (const c of CAPES) {
  const img = build(c), buf = img.png();
  for (const d of OUT) fs.writeFileSync(path.join(d, `${c.id}.png`), buf);
  manifest.push({ id: c.id, name: c.name, tag: c.tag, description: c.desc, file: `capes/${c.id}.png`, size: `${img.w}x${img.h}` });
  console.log(`cape ${c.id}  ${img.w}x${img.h}  ${buf.length} bytes`);
}
fs.writeFileSync(path.join(ROOT, "app/src/data/capes.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${CAPES.length} capes`);
