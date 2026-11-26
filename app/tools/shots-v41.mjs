// Screenshots of the built app (app/dist) in a plain browser at 1280x800 @1x. Browser only: no Tauri window, so launch events are the ?demo=launching sample.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { extname, join } from "node:path";
const dist = new URL("../dist/", import.meta.url).pathname, out = new URL("../../docs/design/rounds/", import.meta.url).pathname, site = new URL("../../site/public/screenshots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true }); mkdirSync(site, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json" };
const srv = createServer((q, r) => { let p = join(dist, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p) || p.endsWith("/")) p = join(dist, "index.html"); r.setHeader("content-type", types[extname(p)] || "application/octet-stream"); r.end(readFileSync(p)); }).listen(4173);
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const shots = [["home-3", "/#/home"], ["home-launching-3", "/?demo=launching#/home"], ["cosmetics-3", "/#/cosmetics"], ["mods-3", "/#/mods"], ["preferences-3", "/#/preferences"]];
for (const [name, url] of shots) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await pg.addInitScript(() => { try { localStorage.setItem("luminos.setup", "1"); } catch {} });
  await pg.goto("http://localhost:4173" + url); await pg.waitForTimeout(name.startsWith("cosmetics") ? 6000 : 1800);
  await pg.screenshot({ path: out + name + ".png" }); copyFileSync(out + name + ".png", site + name + ".png"); await pg.close(); console.log("shot", name);
}
for (const n of ["ingame-titlescreen-3", "ingame-quickpanel-3"]) copyFileSync(out + n + ".png", site + n + ".png");
await b.close(); srv.close();
