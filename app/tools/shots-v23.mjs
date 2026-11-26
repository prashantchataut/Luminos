// v2.3.0 screenshots (1280x800 @2x) of the REAL built UI in headless Chromium (software WebGL).
// The auto-updater shot uses a MOCKED Tauri IPC: version data is fetched live from the GitHub releases API,
// download progress is simulated. It shows the UI, not a real download.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
const out = "../docs/design/rounds", siteArt = "../site/public/art/capes", shots = "../site/public/screenshots";
fs.mkdirSync(siteArt, { recursive: true });
const app = spawn("npx", ["vite", "preview", "--port", "4177", "--strictPort"], { cwd: process.cwd(), stdio: "ignore" });
const site = spawn("npx", ["vite", "preview", "--port", "4178", "--strictPort", "--base", "/Luminos/"], { cwd: "../site", stdio: "ignore" });
await new Promise((r) => setTimeout(r, 4000));
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
const save = async (name, copy = true) => { await p.screenshot({ path: `${out}/${name}.png` }); if (copy && /-3$/.test(name)) fs.copyFileSync(`${out}/${name}.png`, `${shots}/${name}.png`); };
const go = async (h, wait = 900) => { await p.goto(`http://localhost:4177/#/${h}${h === "home" ? "?demo=1" : ""}`); await p.waitForTimeout(wait); };

await go("home", 1800); await save("home-3");
await go("mods"); await save("mods-3");
await go("preferences"); await save("preferences-3");

// skins: 16 portraits (3D) + Showdown stage
await go("cosmetics", 1500);
await p.waitForFunction(() => document.querySelectorAll('img[data-3d="skin"]').length >= 16, null, { timeout: 90000 }).catch(() => errs.push("skin portraits did not all render"));
await p.waitForTimeout(800); await save("cosmetics-skins-3");
// capes: 10 cards, 3D back view
await p.getByText(/Capes & Cloaks/).first().click();
await p.waitForFunction(() => document.querySelectorAll('img[data-3d="cape"]').length >= 10, null, { timeout: 90000 }).catch(() => errs.push("cape renders did not all render"));
await p.waitForTimeout(1500); await save("cosmetics-capes-3");
const caps = JSON.parse(fs.readFileSync("src/data/capes.json", "utf8"));
const srcs = await p.$$eval('img[data-3d="cape"]', (els) => els.map((e) => e.src));
srcs.forEach((s, i) => { if (caps[i]) fs.writeFileSync(`${siteArt}/${caps[i].id}.png`, Buffer.from(s.split(",")[1], "base64")); });
console.log("cape 3D renders exported:", srcs.length);
await p.evaluate(() => dispatchEvent(new Event("luminos:wizard"))); await p.waitForTimeout(800); await save("onboarding-3");


// auto-updater: mocked IPC + live GitHub data
const gh = await (await fetch("https://api.github.com/repos/prashantchataut/Luminos/releases/latest", { headers: { "User-Agent": "Luminos-Launcher/2.3.0" } })).json();
const asset = (gh.assets || []).find((a) => a.name === "Luminos-Setup.exe") || { browser_download_url: "https://github.com/prashantchataut/Luminos/releases/download/v2.1.0/Luminos-Setup.exe", size: 9e6 };
const latest = String(gh.tag_name || "v2.1.0").replace(/^v/, "");
const info = { updateAvailable: false, currentVersion: "2.3.0", latestVersion: latest, downloadUrl: asset.browser_download_url, assetName: "Luminos-Setup.exe", assetSize: asset.size, sizeBytes: asset.size, releaseNotes: String(gh.body || "").slice(0, 900), publishedAt: gh.published_at, page: gh.html_url };
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const q = await ctx2.newPage();
await q.addInitScript((info) => {
  const w = window; w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} }; const cbs = {}, ls = {};
  w.__TAURI_INTERNALS__ = {
    transformCallback(cb) { const id = Math.floor(Math.random() * 1e9); cbs[id] = cb; return id; },
    async invoke(cmd, args) {
      if (cmd === "plugin:event|listen") { ls[args.event] = args.handler; return 1; }
      if (cmd === "check_app_update") return info;
      if (cmd === "install_app_update") {
        const total = info.assetSize; let done = 0;
        await new Promise((res) => { const t = setInterval(() => { done = Math.min(total * 0.62, done + total * 0.045); const h = ls["update-progress"]; if (h && cbs[h]) cbs[h]({ event: "update-progress", id: 1, payload: { phase: "downloading", percent: Math.floor((done / total) * 100), done: Math.floor(done), total, bytesPerSec: 7.4 * 1048576 } }); if (done >= total * 0.62) { clearInterval(t); res(); } }, 60); });
        return new Promise(() => {});
      }
      return null;
    },
  };
}, info);
await q.goto("http://localhost:4177/#/preferences"); await q.waitForTimeout(1200);
await q.getByRole("button", { name: /Check for Updates \/ Auto-Update/ }).first().click(); await q.waitForTimeout(1500);
await q.getByRole("button", { name: /Test \/ Re-run Auto-Updater/ }).click(); await q.waitForTimeout(2200);
await q.screenshot({ path: `${out}/auto-updater-3.png` }); fs.copyFileSync(`${out}/auto-updater-3.png`, `${shots}/auto-updater-3.png`);

// site hero
const s = await ctx.newPage(); await s.goto("http://localhost:4178/Luminos/"); await s.waitForTimeout(3500);
await s.screenshot({ path: `${out}/site-hero-restored.png` });
await b.close(); app.kill(); site.kill();
console.log("errors:", errs.length ? errs : "none");
