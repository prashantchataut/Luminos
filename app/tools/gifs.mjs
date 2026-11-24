// Records short GIFs of the launcher with Playwright frames + ImageMagick.  node tools/gifs.mjs
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
const base = process.env.BASE || "http://localhost:4173", out = "../docs/launcher-shots/gifs", tmp = "/tmp/gf";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
const gif = (name, delay, w, prefix) => { execSync(`convert -delay ${delay} -loop 0 ${tmp}/${prefix}-*.png -resize ${w}x -layers Optimize ${out}/${name}.gif`); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true }); console.log("gif", name, (fs.statSync(`${out}/${name}.gif`).size / 1024) | 0, "KB"); };
fs.mkdirSync(tmp, { recursive: true });
const pad = (i) => String(i).padStart(2, "0");
// 1. home dashboard loading + launch button state morph
await p.goto(base + "/#/home"); await p.evaluate(() => localStorage.clear());
await p.goto("about:blank"); const t0 = Date.now(); await p.goto(base + "/#/home");
for (let i = 0; i < 14; i++) { await p.screenshot({ path: `${tmp}/home-${pad(i)}.png` }); await p.waitForTimeout(90); }
await p.click("text=Launch >> nth=0"); for (let i = 14; i < 30; i++) { await p.screenshot({ path: `${tmp}/home-${pad(i)}.png` }); await p.waitForTimeout(160); }
gif("home-loading-and-launch", 9, 900, "home");
// 2. cosmetics viewer rotating, then a cape swap
await p.goto(base + "/#/cosmetics"); await p.waitForTimeout(1500);
const clip = { x: 392 + 60, y: 44 + 60, width: 520, height: 600 };
for (let i = 0; i < 30; i++) { await p.screenshot({ path: `${tmp}/cos-${pad(i)}.png`, clip }); await p.waitForTimeout(110); }
gif("cosmetics-viewer-rotating", 8, 520, "cos");
// 3. crosshair presets
await p.goto(base + "/#/client"); await p.waitForTimeout(900);
const cc = { x: 80, y: 180, width: 640, height: 420 };
for (let i = 0; i < 8; i++) { await p.locator('[aria-label^="Crosshair preset"]').nth(i).click(); await p.waitForTimeout(220); await p.screenshot({ path: `${tmp}/cross-${pad(i)}.png`, clip: cc }); }
gif("crosshair-presets", 45, 640, "cross");
// 4. keystrokes preset A -> B -> A
const kc = { x: 728, y: 44, width: 534, height: 240 };
for (const [i, k] of [["A"], ["B"], ["A"], ["B"]].entries()) { await p.getByRole("button", { name: new RegExp(`Preset ${k}`) }).click(); await p.waitForTimeout(350); for (let j = 0; j < 2; j++) await p.screenshot({ path: `${tmp}/keys-${pad(i * 2 + j)}.png`, clip: kc }); }
gif("keystrokes-a-to-b", 60, 534, "keys");
await b.close();
