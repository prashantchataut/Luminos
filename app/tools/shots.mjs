// Renders every launcher screen with Playwright at 1280x800 @2x.   node tools/shots.mjs <round> [outDir]
// Needs `npm run build && npx vite preview --port 4173` running. WebGL runs on SwiftShader (software), so GPU timings here are NOT representative.
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "1";
const out = process.argv[3] || "../docs/launcher-shots/rounds";
const base = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(out, { recursive: true });
const S = [
  ["onboarding-welcome", "/#/onboarding/1"], ["onboarding-signin", "/?name=Mira#/onboarding/2"], ["onboarding-import", "/#/onboarding/3"],
  ["home", "/#/home"], ["home-launching", "/?demo=prepare#/home"], ["instances", "/#/instances"], ["library", "/#/library"],
  ["cosmetics", "/#/cosmetics"], ["servers", "/#/servers"], ["client", "/#/client"], ["settings", "/#/settings"], ["settings-performance", "/?g=Performance#/settings"],
];
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const [n, u] of S) {
  await p.goto(base + u); await p.reload();
  await p.waitForTimeout(n === "cosmetics" ? 2600 : n === "settings-performance" ? 2200 : 1400);
  if (n === "settings-performance") { await p.mouse.move(200, 600); }
  await p.screenshot({ path: `${out}/${n}-${round}.png` }); console.log("shot", n);
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 6));
await b.close();
