// v2.1 screenshots: node tools/shots-v21.mjs <round> <outDir> <siteDir>. Needs `npm run build && npx vite preview --port 4173`.
// The plain-browser build has no disk access, so `home` shows the real empty state; `home-demo` uses the ?demo=1 sample data (labelled in the UI).
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "3", out = process.argv[3] || "../docs/design/rounds", site = process.argv[4] || "../site/public/screenshots";
const base = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(site, { recursive: true });
const S = [["home", "/#/home"], ["home-demo", "/?demo=1#/home"], ["mods", "/#/mods"], ["keybinds", "/#/keybinds"], ["preferences", "/#/preferences"], ["cosmetics", "/#/cosmetics"], ["hud-studio", "/#/hud"], ["themes", "/#/themes"], ["themes-minecraft", "/#/themes", "minecraft"], ["themes-light", "/#/themes", "light"]];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
for (const [n, u, theme] of S) {
  await p.goto(base + u); await p.reload();
  await p.waitForTimeout(n === "cosmetics" ? 2600 : 1400);
  if (theme) { await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme); await p.waitForTimeout(300); }
  const f = `${n}-${round}.png`;
  await p.screenshot({ path: `${out}/${f}` }); fs.copyFileSync(`${out}/${f}`, `${site}/${f}`); console.log("shot", f);
}
console.log(errors.length ? "page errors: " + [...new Set(errors)].slice(0, 5).join(" | ") : "no page errors");
await b.close();
