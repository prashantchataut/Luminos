// Renders the marketing site's "Inside Luminos v4.5" section and fails on any broken image.  node tools/site-showcase-v45.mjs [outDir]
import { chromium } from "playwright"; import fs from "node:fs";
const out = process.argv[2] || "../docs/design/rounds", url = process.env.SITE || "http://localhost:4174/";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("requestfailed", (r) => errs.push("requestfailed " + r.url()));
await p.goto(url); await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/site-showcase-1.png` });   // round 1: the hero, which must stay untouched at the top
const heroH1 = await p.evaluate(() => document.querySelector("h1")?.innerText);
await p.locator("#inside").scrollIntoViewIfNeeded();
const tabs = p.locator("#inside [role=tab]"); const n = await tabs.count(); const report = [];
for (let i = 0; i < n; i++) {
  await tabs.nth(i).click(); await p.waitForTimeout(500);
  await p.waitForFunction(() => [...document.querySelectorAll("#inside img")].every((x) => x.complete), null, { timeout: 8000 }).catch(() => {});
  const r = await p.evaluate(() => { const im = document.querySelector("#inside img"); return { alt: im.alt, w: im.naturalWidth, h: im.naturalHeight }; });
  report.push(r); console.log(String(i + 1), r.alt.padEnd(36), r.w + "x" + r.h);
  if (i === 0) { await p.locator("#inside").scrollIntoViewIfNeeded(); await p.screenshot({ path: `${out}/site-showcase-2.png` }); }
  if (i === 3) { await p.locator("#inside").scrollIntoViewIfNeeded(); await p.screenshot({ path: `${out}/site-showcase-3.png` }); }
}
// zoom dialog opens and closes
await p.locator("#inside button[aria-label^=Zoom]").click(); const zoom = await p.locator("[role=dialog]").count(); await p.keyboard.press("Escape"); await p.locator("[role=dialog]").click({ force: true }).catch(() => {});
const all = await p.evaluate(() => [...document.images].map((x) => ({ src: x.currentSrc.split("/").slice(-2).join("/"), w: x.naturalWidth, lazy: x.loading })));
const broken = all.filter((x) => x.w === 0 && x.lazy !== "lazy");
console.log("hero h1:", JSON.stringify(heroH1), "| tabs:", n, "| tab images ok:", report.every((r) => r.w > 0), "| zoom dialog:", zoom, "| broken non-lazy imgs:", broken.length, "| errors:", errs.length);
if (errs.length) console.log(errs.slice(0, 5));
await b.close(); process.exit(report.every((r) => r.w > 0) && n >= 6 && broken.length === 0 ? 0 : 1);
