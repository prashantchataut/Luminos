// Captures the public reference sites into docs/design/references (agent-reach style: Playwright + HTTP).
import { chromium } from "playwright";
const R = [
  ["polyfrost-store", "https://store.polyfrost.org/"], ["xyrios-skins", "https://xyrios.com/minecraft/skins"],
  ["oneclient", "https://polyfrost.org/projects/oneclient"], ["oneconfig-gh", "https://github.com/Polyfrost/OneConfig"],
  ["shard-gh", "https://github.com/Th0rgal/shard"], ["elyprism-gh", "https://github.com/ElyPrismLauncher/Launcher"],
  ["luminos-site-before", "https://prashantchataut.github.io/Luminos/"],
];
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
for (const [n, u] of R) {
  try { const r = await p.goto(u, { waitUntil: "networkidle", timeout: 45000 }).catch(() => p.goto(u, { timeout: 45000 })); await p.waitForTimeout(2500);
    await p.screenshot({ path: `../docs/design/references/${n}.png`, fullPage: n.endsWith("gh") ? false : true }); console.log("ok", n, r?.status()); } catch (e) { console.log("FAIL", n, String(e).slice(0, 100)); }
}
await b.close();
