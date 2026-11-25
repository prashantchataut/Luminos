// Captures the same screens in all three themes, writes a side-by-side strip, and fails if any layout box differs between themes.
// Needs `vite preview` on :4173. Usage: OUT=dir node tools/theme-regression.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const out = process.env.OUT || "../theme-regression"; mkdirSync(out, { recursive: true });
const THEMES = ["default", "neutral", "minecraft", "light"], SCREENS = ["home", "cosmetics", "library", "settings"];
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1360, height: 820 } })).newPage();
const boxes = {}; let bad = 0;
await p.goto("http://localhost:4173/#/home");
for (const theme of THEMES) for (const s of SCREENS) {
  await p.evaluate((t) => { localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: t })); localStorage.setItem("luminos.setup", "1"); }, theme);
  await p.goto(`http://localhost:4173/#/${s}`); await p.reload(); await p.waitForTimeout(1200);
  const attr = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  if (attr !== theme) { console.log(`FAIL ${s}: html[data-theme]=${attr}, wanted ${theme}`); bad++; }
  boxes[`${theme}/${s}`] = await p.evaluate(() => [...document.querySelectorAll("nav, main, header, aside, section, button, input, h1, h2, h3")].slice(0, 120).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
  await p.screenshot({ path: `${out}/${s}-${theme}.png` });
}
for (const s of SCREENS) {
  const base = boxes[`default/${s}`];
  for (const theme of THEMES.slice(1)) {
    const o = boxes[`${theme}/${s}`]; let diff = base.length !== o.length ? [`element count ${base.length} vs ${o.length}`] : [];
    if (!diff.length) base.forEach((r, i) => { if (r.some((v, k) => k > 0 && Math.abs(v - o[i][k]) > 1)) diff.push(`${r[0]}#${i} ${r.slice(1)} vs ${o[i].slice(1)}`); });
    console.log(`${s.padEnd(10)} default vs ${theme.padEnd(6)} ${diff.length ? "LAYOUT DIFFERS" : "identical layout"} (${base.length} boxes)`);
    diff.slice(0, 5).forEach((d) => console.log("   ", d)); bad += diff.length ? 1 : 0;
  }
}
// side-by-side strip of the home screen
const imgs = await Promise.all(THEMES.map(async (t) => "data:image/png;base64," + (await import("node:fs")).readFileSync(`${out}/home-${t}.png`).toString("base64")));
await p.setViewportSize({ width: 3 * 680 + 40, height: 440 });
await p.setContent(`<body style="margin:0;background:#888;display:flex;gap:10px;padding:10px">${imgs.map((i) => `<img src="${i}" style="width:680px;height:420px;object-fit:cover;object-position:top left">`).join("")}</body>`);
await p.screenshot({ path: `${out}/themes-side-by-side.png` });
await b.close(); console.log(bad ? `THEME REGRESSION: ${bad} problem(s)` : "THEME REGRESSION: layout identical in all three themes"); process.exit(bad ? 1 : 0);
