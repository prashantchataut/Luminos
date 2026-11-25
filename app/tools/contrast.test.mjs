// Themes are token files: colours only. This test proves it for the three shipped themes (themes/*.css):
//  1. each theme defines exactly the colour tokens listed in theme.ts (plus color-scheme) - no spacing, size, font or layout property can ride along;
//  2. every value is a hex colour;
//  3. every text pair passes WCAG AA 4.5:1.
import { readFileSync } from "node:fs";
const KEYS = ["bg", "surface", "surface-2", "hover", "line", "line-strong", "fg", "mute", "accent", "accent-fg", "accent-soft", "ok", "warn", "bad"];
const PAIRS = [["fg", "bg"], ["fg", "surface"], ["fg", "surface-2"], ["fg", "hover"], ["mute", "bg"], ["mute", "surface"], ["mute", "surface-2"], ["mute", "hover"], ["accent-fg", "accent"], ["accent", "surface"], ["fg", "accent-soft"], ["ok", "surface"], ["warn", "surface"], ["bad", "surface"]];
const ts = readFileSync(new URL("../src/theme.ts", import.meta.url), "utf8");
const listed = [...ts.match(/TOKEN_KEYS = \[([^\]]+)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
let fails = 0; const fail = (m) => { console.log("   FAIL", m); fails++; };
if (JSON.stringify(listed) !== JSON.stringify(KEYS)) fail(`theme.ts TOKEN_KEYS drifted from this test: ${listed}`);
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { if (h.length === 4) h = "#" + [...h.slice(1)].map((c) => c + c).join(""); const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
for (const id of ["default", "lunar", "light"]) {
  const css = readFileSync(new URL(`../src/themes/${id}.css`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const body = css.match(/\{([\s\S]*)\}/)[1];
  const decl = Object.fromEntries([...body.matchAll(/([a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1].trim(), m[2].trim()]));
  const extra = Object.keys(decl).filter((k) => k !== "color-scheme" && !KEYS.includes(k.replace(/^--/, "")));
  if (extra.length) fail(`${id}: non-colour property ${extra.join(", ")}`);
  const t = {}; for (const k of KEYS) { const v = decl["--" + k]; if (!/^#[0-9a-f]{3,6}$/i.test(v || "")) fail(`${id}: --${k} missing or not a hex colour`); else t[k] = v; }
  const worst = Math.min(...PAIRS.map(([a, b]) => ratio(t[a], t[b])));
  for (const [a, b] of PAIRS) if (ratio(t[a], t[b]) < 4.5) fail(`${id}: ${a} on ${b} is ${ratio(t[a], t[b]).toFixed(2)}:1`);
  console.log(`${id.padEnd(8)} tokens-only ${extra.length ? "NO" : "yes"}  worst text pair ${worst.toFixed(2)}:1`);
}
if (fails) process.exit(1);
