// v4.2 render-critique rounds: Home, Mods, Capes, Preferences at 1280x800 @2x.   node tools/shots-v42.mjs <round>
// Needs `npm run build && npx vite preview --port 4173`. WebGL runs on SwiftShader, so GPU timings are not representative.
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "1";
const base = process.env.BASE || "http://localhost:4173";
const outs = ["../docs/design/rounds", "../site/public/screenshots"];
outs.forEach((o) => fs.mkdirSync(o, { recursive: true }));
const S = [
  ["home", "/#/home", 1500],
  ["mods", "/#/mods", 1200],
  ["cosmetics", "/#/cosmetics", 3200],
  ["preferences", "/?freeram=9420#/preferences", 1200],
];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const [n, u, wait] of S) {
  await p.goto(base + u);
  await p.reload();
  await p.waitForTimeout(wait);
  await p.mouse.move(640, 790);
  for (const o of outs) await p.screenshot({ path: `${o}/${n}-${round}.png` });
  console.log("shot", n, round);
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 6));
await b.close();
