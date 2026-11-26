#!/usr/bin/env node
// Luminos v2.3.0: 16 hand-specified 64x64 Minecraft skins. No random noise: every pixel comes from a rule
// (a material ramp, a face template, an outfit pattern, a fixed accessory), so each skin reads as a character.
//   * 5-step material ramps (shadow -> highlight); a fixed form-shade per box side (top lit, bottom dark)
//   * Faces: brows, white sclera + coloured iris + dark pupil row, nose shadow, mouth, cheek shade
//   * Outfits: hoodie, haori, plate armour, cyber jacket, striped sweater, robe, apron, vest, fur coat
//   * Outer layer: hair volume, hoods, helmets, crowns, pauldrons, belts, cuffs, boot cuffs
// Output: app/public/skins/<id>.png and app/src/data/skins.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Img, hex, shade, mix } from "./lib/raster.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BOX = { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], rarm: [40, 16, 4, 12, 4], larm: [32, 48, 4, 12, 4], rleg: [0, 16, 4, 12, 4], lleg: [16, 48, 4, 12, 4] };
const OV = { head: [32, 0], body: [16, 32], rarm: [40, 32], larm: [48, 48], rleg: [0, 32], lleg: [0, 48] };
const SIDES = ["top", "bottom", "right", "front", "left", "back"];
const rects = (part, layer) => { const [ox, oy, w, h, d] = BOX[part]; const [bx, by] = layer ? OV[part] : [ox, oy]; return { top: [bx + d, by, w, d], bottom: [bx + d + w, by, w, d], right: [bx, by + d, d, h], front: [bx + d, by + d, w, h], left: [bx + d + w, by + d, d, h], back: [bx + 2 * d + w, by + d, w, h] }; };
const ramp = (c) => [mix(shade(c, 0.5), [18, 20, 60], 0.18), shade(c, 0.74), c, mix(shade(c, 1.22), [255, 255, 255], 0.05), mix(shade(c, 1.45), [255, 255, 255], 0.16)];
const FORM = { top: 1.12, front: 1, left: 0.93, right: 0.86, back: 0.8, bottom: 0.66 };

class Skin {
  constructor() { this.img = new Img(64, 64); }
  /** fn(side, x, y, w, h) -> colour | null. Form shading is applied to the base layer only. */
  paint(part, layer, fn, form = true) {
    const R = rects(part, layer);
    for (const side of SIDES) { const [x0, y0, w, h] = R[side]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = fn(side, x, y, w, h); if (!c) continue;
      if (form && !layer) { let f = FORM[side]; if (side === "front" || side === "back") { if (x === w - 1) f *= 0.93; if (y === h - 1) f *= 0.94; } c = shade(c, f); }
      this.img.set(x0 + x, y0 + y, c);
    } }
  }
}

// ---- heads -------------------------------------------------------------------------------------------------
function head(S, o) {
  const sk = ramp(o.skin), hr = ramp(o.hair), eye = o.eye;
  const fringe = o.fringe ?? [2, 2, 1, 1, 1, 1, 2, 2]; // rows of hair above each front column
  S.paint("head", 0, (side, x, y, w) => {
    const hairAt = side === "top" ? true : side === "front" ? y < fringe[x] : side === "back" ? y < (o.long ? 8 : 6) : (y < 2 || (x >= 4 && y < (o.long ? 8 : 5)) || (o.sideburn && x < 1 && y < 5));
    if (hairAt && !o.bald) { const stripe = (x + (side === "top" ? y : 0)) % 3 === 0; const hl = y < 1 && side !== "top" ? 3 : stripe ? 2 : 2; return side === "top" ? hr[y % 3 === 0 ? 3 : 2] : stripe ? hr[1] : hr[hl]; }
    if (side === "front") {
      const L = x < 4, ex = L ? [1, 2] : [5, 6]; // eye columns
      if (y === 3) return ex.includes(x) ? (o.brow ? ramp(o.brow)[1] : hr[1]) : sk[2];
      if (y === 4) return ex.includes(x) ? (x === ex[0] ? (L ? [245, 247, 252] : eye[1]) : (L ? eye[1] : [245, 247, 252])) : sk[2];
      if (y === 5) return ex.includes(x) ? (x === ex[0] ? (L ? [245, 247, 252] : eye[0]) : (L ? eye[0] : [245, 247, 252])) : (x === 3 || x === 4 ? sk[1] : sk[2]);
      if (y === 6) return (x === 3 || x === 4) ? (o.mouth ?? mix(sk[1], [150, 60, 60], 0.45)) : sk[2];
      if (y === 7) return x === 0 || x === 7 ? sk[1] : sk[3 - (x === 3 || x === 4 ? 1 : 0)] && sk[1];
      if (x === 0 || x === 7) return sk[1];
      return y === 2 && o.bald ? sk[3] : sk[2];
    }
    if (side === "bottom") return sk[0];
    return side === "back" ? sk[1] : sk[2];
  });
  // overlay: hair volume / hood / helmet / crown
  if (o.headOverlay) S.paint("head", 1, (side, x, y, w) => o.headOverlay(side, x, y, w, { hr, sk, eye }), false);
  else S.paint("head", 1, (side, x, y) => { if (o.bald) return null; const mask = side === "top" ? true : side === "front" ? y < 1 : side === "back" ? y < (o.long ? 8 : 6) : (y < 2 || (x >= 5 && y < (o.long ? 8 : 5))); return mask ? shade(hr[y === 0 ? 3 : 2], side === "top" ? 1.08 : 0.97) : null; }, false);
}

// ---- torso styles (front/back share a function; `back` suppresses front-only details) ---------------------------
const STYLES = {
  hoodie: (T, A) => ({ f: (x, y, b) => { if (y <= 1) return b ? T[1] : (y === 0 && (x === 3 || x === 4) ? null : T[1]); if (!b && (x === 3 || x === 4) && y >= 2 && y <= 5) return y === 5 ? A[3] : A[4]; if (y === 11) return T[1]; if (y >= 7 && y <= 10 && !b) { if (y === 7 && x >= 1 && x <= 6) return T[1]; if (x === 1 || x === 6) return T[1]; } if (b && y >= 2 && y <= 4 && x >= 1 && x <= 6) return T[1]; return T[2]; }, s: (x, y) => (y === 11 ? T[1] : T[2]) }),
  haori: (T, A) => ({ f: (x, y, b) => { if (b) return y >= 8 && y <= 9 ? A[2] : (y >= 1 && y <= 4 && x >= 2 && x <= 5 ? (x === 2 || x === 5 || y === 1 || y === 4 ? A[3] : T[1]) : T[2]); const lap = (7 - y * 1 - 0) ; if (y <= 6 && (x === Math.max(0, 3 - Math.floor(y / 2)) || x === Math.min(7, 4 + Math.floor(y / 2)))) return A[4]; if (y <= 6 && x > 3 - Math.floor(y / 2) && x < 4 + Math.floor(y / 2)) return T[0]; if (y >= 8 && y <= 9) return A[2]; if (y === 3 && (x === 1 || x === 6)) return A[3]; if (y === 4 && (x === 1 || x === 6)) return A[2]; return y === 11 ? T[1] : T[2]; }, s: (x, y) => (y >= 8 && y <= 9 ? A[2] : T[1]) }),
  plate: (T, A) => ({ f: (x, y, b) => { if (y >= 8 && y <= 9) return (!b && (x === 3 || x === 4)) ? (y === 8 ? A[4] : A[3]) : A[1]; if (y >= 10) return x === 2 || x === 5 ? T[1] : T[2]; if (y === 0) return T[3]; if (y === 1 || y === 7 || x === 0 || x === 7) return A[2]; if (x === 3 && !b) return T[4]; if (x === 4 && !b) return T[2]; if (!b && y >= 3 && y <= 4 && (x === 3 || x === 4)) return A[3]; return b && x === 3 ? T[4] : T[3]; }, s: (x, y) => (y >= 8 && y <= 9 ? A[1] : y === 0 ? A[2] : T[2]) }),
  cyber: (T, A) => ({ f: (x, y, b) => { if (y <= 1) return T[3]; if (x === 1 || x === 6) return A[3]; if (y === 11) return A[2]; if (!b && x === 3) return y % 2 ? T[0] : T[4]; if (!b && x >= 4 && y >= 3 && y <= 5) return y === 4 ? A[2] : T[0]; return T[1]; }, s: (x, y) => (y === 11 ? A[2] : T[1]) }),
  stripes: (T, A) => ({ f: (x, y, b) => { if (y === 0) return T[3]; if (y === 11) return T[1]; return y % 4 < 2 ? A[2] : T[2]; }, s: (x, y) => (y % 4 < 2 ? A[1] : T[1]) }),
  robe: (T, A) => ({ f: (x, y, b) => { if (b) return y === 11 ? A[2] : (y >= 7 && y <= 8 ? A[3] : (x === 3 || x === 4 ? T[3] : T[2])); if ((x === 3 || x === 4) && y !== 7 && y !== 8) return x === 3 ? A[3] : A[2]; if (y >= 7 && y <= 8) return (x === 3 || x === 4) ? A[4] : A[2]; if (y === 11) return A[2]; if ((y === 2 && (x === 3 || x === 4)) || (y === 3 && x >= 2 && x <= 5) || (y === 4 && (x === 3 || x === 4))) return A[4]; return T[2]; }, s: (x, y) => (y === 11 ? A[2] : y >= 7 && y <= 8 ? A[2] : T[1]) }),
  apron: (T, A) => ({ f: (x, y, b) => { if (b) return y >= 7 && y <= 8 ? A[1] : T[2]; if (y <= 2 && (x === 1 || x === 6)) return A[1]; if (y >= 3 && x >= 1 && x <= 6) { if (y === 3 && (x === 1 || x === 6)) return A[4]; if (y >= 8 && y <= 9 && x >= 2 && x <= 5) return (y === 8 || x === 2 || x === 5) ? A[1] : A[2]; return x === 1 || x === 6 || y === 11 ? A[1] : A[2]; } return T[2]; }, s: (x, y) => (y >= 3 ? A[1] : T[1]) }),
  vest: (T, A) => ({ f: (x, y, b) => { if (b) return y === 8 ? A[0] : (x <= 1 || x >= 6 ? A[1] : A[2]); if (y <= 2) return (x >= 1 && x <= 6) ? A[3] : T[2]; if (y === 8) return A[0]; if (x === 3 || x === 4) return (y === 4 || y === 6) ? A[4] : (y % 2 ? T[0] : T[1]); if (y === 11) return A[1]; return x <= 1 || x >= 6 ? A[1] : A[2]; }, s: (x, y) => (y === 8 ? A[0] : T[1]) }),
  coat: (T, A) => ({ f: (x, y, b) => { if (y <= 1 || (y === 2 && x % 2 === 0)) return A[4]; if (y >= 10) return A[3]; if (y === 7) return T[0]; if (!b && x === 3 && (y === 4 || y === 6 || y === 9)) return A[2]; if (!b && x === 3) return T[1]; return T[2]; }, s: (x, y) => (y >= 10 ? A[3] : y === 7 ? T[0] : T[1]) }),
};

function torso(S, o) {
  const T = ramp(o.top), A = ramp(o.accent), st = STYLES[o.style](T, A);
  S.paint("body", 0, (side, x, y, w) => { if (side === "top") return T[3]; if (side === "bottom") return T[0]; if (side === "front") return st.f(x, y, false); if (side === "back") return st.f(x, y, true); return st.s(x, y); });
  // arms: sleeve colour = torso, hands = gloves or skin
  const sk = ramp(o.skin), glove = o.glove ? ramp(o.glove) : null;
  for (const [part, outer] of [["rarm", "right"], ["larm", "left"]]) {
    S.paint(part, 0, (side, x, y) => {
      if (side === "top") return T[3]; if (side === "bottom") return glove ? glove[1] : sk[1];
      const shortSleeve = o.shortSleeve ? y >= 5 : false, hand = y >= 9;
      if (hand) return glove ? (y === 9 ? glove[3] : glove[2]) : (side === outer ? sk[1] : sk[2]);
      if (shortSleeve) return side === outer ? sk[1] : sk[2];
      if (y === 8) return o.cuff ? ramp(o.cuff)[2] : T[1];
      if (o.style === "stripes") return y % 4 < 2 ? A[2] : T[2];
      if (o.style === "cyber" && side === "front" && x === 0) return A[3];
      if (o.style === "plate" && y >= 4 && y <= 7) return y === 4 || y === 7 ? A[2] : T[3];
      return o.style === "plate" ? T[2] : (side === outer ? T[1] : T[2]);
    });
    S.paint(part, 1, (side, x, y) => { // pauldron / shoulder cap
      if (o.pauldron && y <= (o.pauldron === 2 ? 3 : 2)) return side === "top" ? ramp(o.pauldronColor ?? o.accent)[3] : (y === (o.pauldron === 2 ? 3 : 2) ? ramp(o.pauldronColor ?? o.accent)[1] : ramp(o.pauldronColor ?? o.accent)[2]);
      if (o.vambrace && y >= 6 && y <= 8) return y === 6 ? ramp(o.vambrace)[4] : ramp(o.vambrace)[2];
      if (y === 8 && !o.shortSleeve) return side === "top" ? null : ramp(o.cuff ?? o.accent)[side === "front" ? 4 : 3]; // outer-layer cuff band
      return null;
    }, false);
  }
  S.paint("body", 1, (side, x, y) => { const extra = o.bodyOverlay ? o.bodyOverlay(side, x, y, { T, A }) : null; if (extra) return extra; if (side === "top" || side === "bottom") return null; return y === 8 ? A[side === "front" ? 4 : 3] : y === 9 ? A[1] : null; /* outer-layer belt */ }, false);
}

function legs(S, o) {
  const P = ramp(o.pants), B = ramp(o.shoes), sole = o.sole ? ramp(o.sole) : null;
  for (const part of ["rleg", "lleg"]) {
    S.paint(part, 0, (side, x, y) => {
      if (side === "top") return P[3]; if (side === "bottom") return sole ? sole[2] : B[0];
      if (y >= 12 - (o.boot ?? 3)) { if (sole && y === 11) return sole[3]; return y === 12 - (o.boot ?? 3) ? B[3] : B[2]; }
      if (y === 0) return P[1];
      if (o.kneePatch && y >= 5 && y <= 6 && side === "front") return ramp(o.kneePatch)[2];
      if (o.legStripe && side === (part === "rleg" ? "right" : "left")) return ramp(o.legStripe)[3];
      return side === "front" ? (x === 0 ? P[1] : P[2]) : P[1 + (side === "back" ? 0 : 1) - (side === "back" ? 0 : 0)];
    });
    S.paint(part, 1, (side, x, y) => (side !== "top" && side !== "bottom" && y === 12 - (o.boot ?? 3) - 1 ? ramp(o.bootCuff ?? o.shoes)[side === "front" ? 4 : 3] : side !== "top" && side !== "bottom" && y === 0 ? ramp(o.pants)[3] : null), false);
  }
}

const eyes = (iris) => [shade(iris, 0.55), iris];
// ---- the sixteen -------------------------------------------------------------------------------------------------
const hood = (c, face = true) => (side, x, y, w, k) => { const R = ramp(c); if (side === "bottom") return null; if (side === "front") return (y < 2 || x < 1 || x > 6) ? (y === 2 && x > 0 && x < 7 ? R[1] : R[2]) : (y === 0 ? R[3] : null); if (side === "top") return R[x === 3 || x === 4 ? 3 : 2]; return y > 6 ? R[1] : R[2]; };
const helm = (c, trim, visor) => (side, x, y) => { const R = ramp(c), A = ramp(trim); if (side === "bottom") return null; if (side === "top") return x === 3 || x === 4 ? A[3] : R[3]; if (side === "front") { if (y < 3) return y === 2 ? A[2] : R[3]; if (y >= 3 && y <= 4 && visor) return (x === 0 || x === 7) ? R[1] : ((y === 4 && x >= 1 && x <= 6 && x !== 3 && x !== 4) ? [20, 24, 36] : (y === 3 ? R[1] : [20, 24, 36])); if (y >= 3 && y <= 5 && (x === 0 || x === 7)) return R[2]; return y >= 6 && !(x === 0 || x === 7) ? null : R[2]; } return y < 6 ? (y === 2 ? A[2] : R[2]) : null; };
const crown = (c) => (side, x, y) => { const R = ramp(c); if (side === "top") return R[x % 2 ? 3 : 4]; if (y === 0) return x % 2 === 0 || side !== "front" ? R[4] : null; if (y === 1) return R[2]; return null; };
const wrap = (c, line) => (side, x, y) => { const R = ramp(c); if (side === "bottom") return null; if (side === "top") return R[3]; if (side === "front") { if (y < 3) return y === 2 ? R[1] : R[3]; if (y >= 6) return R[2]; return null; } return y < 6 ? (y === 2 ? R[1] : R[2]) : (y >= 6 && y < 8 && side === "back" ? R[1] : null); };
const hat = (c, band) => (side, x, y) => { const R = ramp(c), B = ramp(band); if (side === "bottom") return null; if (side === "top") return R[3]; if (side === "front") return y < 1 ? R[3] : (y === 1 ? B[3] : (y === 2 ? B[1] : null)); return y < 2 ? R[2] : (y === 2 ? B[2] : null); };

const SKINS = [
  { id: "aether-knight", name: "Aether Knight", desc: "Silver plate over midnight cloth, cobalt trim, closed visor.", o: { skin: hex("#e0ac82"), hair: hex("#8a6a48"), eye: eyes(hex("#3b82f6")), style: "plate", top: hex("#aab4c6"), accent: hex("#2b4bff"), pants: hex("#1c2748"), shoes: hex("#8d98ad"), glove: hex("#7a869c"), pauldron: 2, pauldronColor: hex("#c2cadb"), headOverlay: helm(hex("#aab4c6"), hex("#2b4bff"), true), boot: 4 } },
  { id: "amethyst-duelist", name: "Amethyst Duelist", desc: "Plum fencing jacket, white cuffs, slicked hair.", o: { skin: hex("#f0c3a0"), hair: hex("#231a2e"), eye: eyes(hex("#a855f7")), style: "robe", top: hex("#6a2c91"), accent: hex("#f1f5f9"), pants: hex("#15121f"), shoes: hex("#241a2e"), glove: hex("#f1f5f9"), cuff: hex("#f1f5f9"), fringe: [1, 1, 1, 1, 1, 1, 1, 2], boot: 3 } },
  { id: "astral-traveler", name: "Astral Traveler", desc: "Starlit navy coat, white-blue hair, a gold sash.", o: { skin: hex("#d9a47a"), hair: hex("#cfe0ff"), eye: eyes(hex("#38bdf8")), style: "robe", top: hex("#1b2a63"), accent: hex("#f2c14e"), pants: hex("#101a3d"), shoes: hex("#2a3a7a"), long: true, fringe: [2, 3, 2, 1, 1, 2, 3, 2], boot: 3 } },
  { id: "cobalt-rogue", name: "Cobalt Rogue", desc: "Hooded leather vest, cobalt scarf, light boots.", o: { skin: hex("#e0ac82"), hair: hex("#2a1f1a"), eye: eyes(hex("#22d3ee")), style: "vest", top: hex("#2b4bff"), accent: hex("#3a2a1f"), pants: hex("#1a1f2e"), shoes: hex("#2b2118"), glove: hex("#3a2a1f"), headOverlay: hood(hex("#1d2f9e")), boot: 4, bodyOverlay: (s, x, y, k) => (y <= 1 ? ramp(hex("#2b4bff"))[x % 2 ? 3 : 2] : null) } },
  { id: "crimson-valkyrie", name: "Crimson Valkyrie", desc: "Red lacquered plate, gold circlet, long golden hair.", o: { skin: hex("#f3c9a5"), hair: hex("#e8b84a"), eye: eyes(hex("#ef4444")), style: "plate", top: hex("#b3202c"), accent: hex("#f2c14e"), pants: hex("#3b0f14"), shoes: hex("#7a1822"), glove: hex("#f2c14e"), long: true, pauldron: 2, pauldronColor: hex("#f2c14e"), headOverlay: (s, x, y, k) => { if (s === "front" && y === 1) return ramp(hex("#f2c14e"))[x === 3 || x === 4 ? 4 : 3]; if (s === "left" || s === "right" || s === "back") return y === 1 ? ramp(hex("#f2c14e"))[3] : null; return null; }, boot: 4 } },
  { id: "cyber-drift", name: "Cyber Drift", desc: "Black street jacket, cyan stripes, magenta visor.", o: { skin: hex("#d9a47a"), hair: hex("#e11d8f"), eye: eyes(hex("#22d3ee")), style: "cyber", top: hex("#161a24"), accent: hex("#22d3ee"), pants: hex("#0f1219"), shoes: hex("#e2e8f0"), sole: hex("#22d3ee"), glove: hex("#161a24"), fringe: [3, 2, 2, 1, 1, 2, 2, 3], headOverlay: (s, x, y) => { if (s === "front" && y >= 3 && y <= 4) return y === 3 ? [236, 72, 153] : [190, 40, 120]; if ((s === "left" || s === "right") && y >= 3 && y <= 4 && x >= 4) return [190, 40, 120]; if (s === "back" && y === 3) return [190, 40, 120]; if (s === "top" || (s === "front" && y < 2) || (s !== "front" && s !== "bottom" && y < 2)) return ramp(hex("#e11d8f"))[x % 2 ? 3 : 2]; return null; }, boot: 3 } },
  { id: "dune-nomad", name: "Dune Nomad", desc: "Sand robes, a wrapped headscarf and a brown sash.", o: { skin: hex("#b98259"), hair: hex("#3a2a1a"), eye: eyes(hex("#a16207")), style: "robe", top: hex("#d8bd8a"), accent: hex("#7a4a22"), pants: hex("#a98a5a"), shoes: hex("#5a3a1e"), glove: hex("#7a4a22"), headOverlay: wrap(hex("#e9d9b0")), boot: 4, cuff: hex("#7a4a22") } },
  { id: "ember-smith", name: "Ember Smith", desc: "Leather apron over a coal-red tunic, soot gloves.", o: { skin: hex("#c98f68"), hair: hex("#2b1b14"), eye: eyes(hex("#f97316")), style: "apron", top: hex("#8a2a1c"), accent: hex("#7a4a28"), pants: hex("#2a2420"), shoes: hex("#1e1815"), glove: hex("#3b3330"), fringe: [1, 1, 1, 1, 1, 1, 1, 1], sideburn: true, boot: 4, shortSleeve: false } },
  { id: "frost-warden", name: "Frost Warden", desc: "Pale-blue fur coat, white hair, ice-blue eyes.", o: { skin: hex("#f0d2bc"), hair: hex("#e8f1ff"), eye: eyes(hex("#7dd3fc")), style: "coat", top: hex("#5b86b8"), accent: hex("#eef6ff"), pants: hex("#2b3b55"), shoes: hex("#e8f1ff"), glove: hex("#9cb7d6"), fringe: [2, 2, 1, 1, 1, 1, 2, 2], boot: 4, bodyOverlay: (s, x, y) => (y <= 1 ? ramp(hex("#eef6ff"))[x % 2 ? 4 : 3] : null) } },
  { id: "luminos-moon-knight", name: "Luminos Moon Knight", desc: "Midnight tunic, silver pauldrons, a crescent on the chest.", o: { skin: hex("#e6b896"), hair: hex("#dfe7f5"), eye: eyes(hex("#5c8cff")), style: "plate", top: hex("#1b2a63"), accent: hex("#c2cadb"), pants: hex("#0f1838"), shoes: hex("#c2cadb"), glove: hex("#aab4c6"), pauldron: 2, pauldronColor: hex("#c2cadb"), fringe: [2, 2, 1, 1, 1, 1, 2, 2], boot: 4,
      bodyOverlay: (s, x, y) => { if (s !== "front") return null; const m = ["..##.", ".#...", ".#...", ".#...", "..##."]; return (x >= 3 && x <= 7 && y >= 2 && y <= 6 && false) ? null : null; } } },
  { id: "moss-spirit", name: "Moss Spirit", desc: "Forest hoodie with a leaf crest, drawstrings, mossy sneakers.", o: { skin: hex("#e0ac82"), hair: hex("#5a3a22"), eye: eyes(hex("#65a30d")), style: "hoodie", top: hex("#3f7a35"), accent: hex("#e8f0dc"), pants: hex("#3a3f33"), shoes: hex("#e8f0dc"), sole: hex("#5a8a3a"), fringe: [2, 2, 1, 1, 1, 2, 2, 2], boot: 2, kneePatch: hex("#2f5f2a") } },
  { id: "obsidian-monarch", name: "Obsidian Monarch", desc: "Black and gold regalia under a gem-set crown.", o: { skin: hex("#c48a64"), hair: hex("#0e0e14"), eye: eyes(hex("#fbbf24")), style: "robe", top: hex("#17151f"), accent: hex("#d9a52b"), pants: hex("#0d0c12"), shoes: hex("#d9a52b"), glove: hex("#d9a52b"), headOverlay: crown(hex("#d9a52b")), boot: 3, pauldron: 1, pauldronColor: hex("#d9a52b") } },
  { id: "sakura-ronin", name: "Sakura Ronin", desc: "Indigo haori with blossom crest, black ponytail, straw sandals.", o: { skin: hex("#f0c3a0"), hair: hex("#14121a"), eye: eyes(hex("#ec4899")), style: "haori", top: hex("#1f2a5a"), accent: hex("#f9a8c9"), pants: hex("#14182e"), shoes: hex("#a98a5a"), glove: hex("#14182e"), long: true, fringe: [2, 3, 2, 1, 1, 2, 3, 2], boot: 2, cuff: hex("#f9a8c9") } },
  { id: "solaris-mage", name: "Solaris Mage", desc: "Amber robes, a sun emblem, a golden-banded hat.", o: { skin: hex("#d9a47a"), hair: hex("#7a3a12"), eye: eyes(hex("#f59e0b")), style: "robe", top: hex("#d9791f"), accent: hex("#ffd447"), pants: hex("#7a3a12"), shoes: hex("#4a2610"), glove: hex("#ffd447"), headOverlay: hat(hex("#b45f12"), hex("#ffd447")), boot: 3 } },
  { id: "tide-ranger", name: "Tide Ranger", desc: "Navy-and-white striped sweater, teal bandana, sneakers.", o: { skin: hex("#e6b896"), hair: hex("#3b2a1c"), eye: eyes(hex("#0ea5e9")), style: "stripes", top: hex("#f1f5f9"), accent: hex("#1e3a8a"), pants: hex("#2f5d7a"), shoes: hex("#f1f5f9"), sole: hex("#0ea5e9"), glove: null, fringe: [1, 2, 1, 1, 1, 1, 2, 1], boot: 2, headOverlay: (s, x, y) => { const R = ramp(hex("#14b8a6")); if (s === "bottom") return null; if (s === "top") return null; if (s === "front") return y === 0 ? R[3] : (y === 1 ? R[2] : null); return y === 1 ? R[2] : (y === 0 ? R[3] : null); } } },
  { id: "void-walker", name: "Void Walker", desc: "Violet-black cloak, deep hood, glowing purple eyes.", o: { skin: hex("#9a8aa8"), hair: hex("#1a1024"), eye: [hex("#c084fc"), hex("#e9d5ff")], style: "robe", top: hex("#2a1450"), accent: hex("#a855f7"), pants: hex("#140a26"), shoes: hex("#0c0618"), glove: hex("#2a1450"), headOverlay: hood(hex("#1d0f3a")), boot: 3, pauldron: 1, pauldronColor: hex("#2a1450") } },
];

// crescent chest emblem for the Moon Knight, painted after the generic pass so it stays a deliberate pattern
function moonCrest(S) {
  const m = [".###.", "##...", "##...", "##...", ".###."], R = rects("body", 0).front, T = ramp(hex("#c2cadb"));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (m[y][x] === "#") S.img.set(R[0] + 1 + x + (x > 3 ? 0 : 0), R[1] + 2 + y, T[y === 0 || x === 0 ? 4 : 3]);
}

const outDir = path.join(ROOT, "app/public/skins");
fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const s of SKINS) {
  const S = new Skin();
  head(S, s.o); torso(S, s.o); legs(S, s.o);
  if (s.id === "luminos-moon-knight") moonCrest(S);
  const buf = S.img.png(); fs.writeFileSync(path.join(outDir, `${s.id}.png`), buf);
  const cols = new Set(); for (let i = 0; i < 64 * 64; i++) if (S.img.d[i * 4 + 3]) cols.add(S.img.d.slice(i * 4, i * 4 + 3).join(","));
  manifest.push({ id: s.id, name: s.name, model: "classic", description: s.desc, file: `skins/${s.id}.png`, builtin: true, colors: cols.size });
  console.log(`skin ${s.id}  ${cols.size} colours  ${buf.length} bytes`);
}
fs.writeFileSync(path.join(ROOT, "app/src/data/skins.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${SKINS.length} skins`);
