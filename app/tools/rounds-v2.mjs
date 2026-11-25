// Renders the 8 design screens with Playwright at the real window size (1280x800).  node tools/rounds-v2.mjs <round> [outDir]
// Needs the app on :4173 (npm run build && npx vite preview --port 4173) and the marketing site on :4174 (cd ../site && npm run build && npx vite preview --port 4174).
// Every call really re-renders; nothing is copied between rounds. scripts/verify-client-sanity.mjs rejects identical SHA-256 hashes across rounds.
import { chromium } from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";
const round = process.argv[2] || "1";
const out = process.argv[3] || "../docs/design/rounds";
const app = process.env.BASE || "http://localhost:4173", site = process.env.SITE || "http://localhost:4174/";
fs.mkdirSync(out, { recursive: true });
const S = [
  ["home", app + "/#/home"], ["mods", app + "/#/mods"], ["keybinds", app + "/#/keybinds"], ["preferences", app + "/#/preferences"],
  ["cosmetics", app + "/#/cosmetics"], ["hud-studio", app + "/#/hud"], ["themes", app + "/#/themes"], ["site", site],
];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const p = await ctx.newPage(); const errors = [];
p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const only = process.env.ONLY;
for (const [n, u] of S.filter(([n]) => !only || only.split(",").includes(n))) {
  await p.goto(u); await p.reload(); await p.waitForTimeout(n === "cosmetics" ? 3200 : 1200);
  const f = `${out}/${n}-${round}.png`; await p.screenshot({ path: f });
  console.log(n.padEnd(12), crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16), fs.statSync(f).size);
}
if (!only) for (const [t, id] of [["themes-minecraft", "minecraft"], ["themes-light", "light"]]) { // extra captures used by the site, not part of the 8-screen hash check
  await p.goto(app + "/#/themes"); await p.evaluate((id) => { const k = "luminos.settings.v2"; localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) || "{}"), theme: id })); }, id);
  await p.reload(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${t}-${round}.png` });
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 8));
await b.close();
