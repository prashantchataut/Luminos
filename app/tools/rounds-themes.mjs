// Themes page in each theme -> docs/design/rounds/themes-<id>-<round>.png
import { chromium } from "playwright";
const round = process.argv[2] || "3";
const b = await chromium.launch();
for (const id of ["minecraft", "light"]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: t })), id);
  const p = await ctx.newPage(); await p.goto("http://localhost:4173/#/themes"); await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `../docs/design/rounds/themes-${id}-${round}.png` }); console.log("shot", id);
}
await b.close();
