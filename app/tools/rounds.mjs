// node tools/rounds.mjs <round> [outDir] [screens,comma]  -> <outDir>/<screen>-<round>.png at 1280x800 @2x. Needs `vite preview --port 4173`.
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "1", out = process.argv[3] || "../docs/design/rounds";
const only = (process.argv[4] || "").split(",").filter(Boolean);
const base = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(out, { recursive: true });
const S = { home: "/#/home", mods: "/#/mods", "hud-studio": "/#/hud", cosmetics: "/#/cosmetics", settings: "/#/settings", themes: "/#/themes", accounts: "/?tab=accounts#/settings" };
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
const errors = []; p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const [n, u] of Object.entries(S)) {
  if (only.length && !only.includes(n)) continue;
  await p.goto(base + u); await p.reload(); await p.waitForTimeout(n === "cosmetics" ? 16000 : 1800);
  await p.screenshot({ path: `${out}/${n}-${round}.png` }); console.log("shot", n);
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 6));
await b.close();
