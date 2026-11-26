// v4.3 render-critique rounds: every launcher screen at 1280x800 @2x.   node tools/shots-v43.mjs <round>
// Needs `npm run build && npx vite preview --port 4173`. WebGL runs on SwiftShader, so GPU timings are not representative.
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "1";
const base = process.env.BASE || "http://localhost:4173";
const outs = ["../docs/design/rounds", "../site/public/screenshots"];
outs.forEach((o) => fs.mkdirSync(o, { recursive: true }));
const S = [
  ["home", "/#/home", 1500],
  ["home-launching", "/?demo=launching#/home", 1500],
  ["mods", "/#/mods", 1200],
  ["hud-studio", "/#/hud", 1500],
  ["cosmetics", "/#/cosmetics", 3600],
  ["keybinds", "/#/keybinds", 1200],
  ["themes", "/#/themes", 1200],
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
  await p.screenshot({ path: `${outs[0]}/${n}-${round}.png` }); // one frame, then copied, so both folders are byte-identical
  fs.copyFileSync(`${outs[0]}/${n}-${round}.png`, `${outs[1]}/${n}-${round}.png`);
  console.log("shot", n, round);
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 6));
await b.close();
