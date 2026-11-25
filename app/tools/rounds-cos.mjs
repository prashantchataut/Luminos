// Extra cosmetics captures: node tools/rounds-cos.mjs <round>  -> cosmetics-wings-<round>.png, cosmetics-cloaks-<round>.png, cosmetics-emotes-<round>.png
import { chromium } from "playwright";
const round = process.argv[2] || "3", out = "../docs/design/rounds";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
await p.goto("http://localhost:4173/#/cosmetics"); await p.reload(); await p.waitForTimeout(3000);
for (const t of ["Wings", "Cloaks", "Emotes"]) { await p.getByRole("tab", { name: t }).click(); await p.waitForTimeout(7000); await p.screenshot({ path: `${out}/cosmetics-${t.toLowerCase()}-${round}.png` }); console.log("shot", t); }
await b.close();
