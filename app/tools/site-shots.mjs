import { chromium } from "playwright";
const [round, url, out] = [process.argv[2], process.argv[3], process.argv[4] || `../docs/design/rounds/site-${process.argv[2]}.png`];
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
await p.goto(url, { waitUntil: "networkidle" }); await p.waitForTimeout(2500); await p.screenshot({ path: out }); await b.close(); console.log("shot", out);
