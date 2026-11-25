// Render-critique-fix rounds. node tools/rounds.mjs <round> [outDir]   (needs `npx vite preview --port 4173`)
// 1280x800 @2x. Every capture goes through a no-blank gate: a flat or near-flat image fails the run.
import { chromium } from "playwright";
import fs from "node:fs";
const round = process.argv[2] || "1", out = process.argv[3] || "../docs/design/rounds", base = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage(), errors = [];
p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const gate = async (buf, name) => {
  const pg = await ctx.newPage();
  const r = await pg.evaluate(async (b64) => { const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode(); const c = document.createElement("canvas"); c.width = 320; c.height = 200; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 320, 200); const d = g.getImageData(0, 0, 320, 200).data; let s = 0, s2 = 0; const set = new Set(); for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; set.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3); } const n = d.length / 4, m = s / n; return { sd: Math.sqrt(s2 / n - m * m), colours: set.size }; }, buf.toString("base64"));
  await pg.close(); if (r.sd < 6 || r.colours < 24) { console.error(`BLANK CAPTURE ${name}: sd=${r.sd.toFixed(2)} colours=${r.colours}`); process.exit(3); } return r;
};
const S = [
  ["home", "/#/home", async () => {}, 1500],
  ["home-host", "/#/home", async () => { await p.getByRole("button", { name: "Host World" }).click(); }, 900],
  ["mods", "/#/mods", async () => {}, 1200],
  ["mods-drawer", "/#/mods", async () => { await p.getByRole("button", { name: "Keystrokes settings" }).click(); }, 900],
  ["hud-studio", "/#/hud", async () => { await p.mouse.click(1, 1); }, 1500],
  ["cosmetics", "/#/cosmetics", async () => {}, 3200],
  ["themes", "/#/themes", async () => {}, 1000],
  ["instances-accounts", "/#/instances", async () => { await p.getByRole("button", { name: /Switch account/ }).click(); await p.getByRole("tab", { name: "Ely.by" }).click(); }, 900],
];
for (const [name, url, act, wait] of S) {
  await p.goto(base + url); await p.evaluate(() => localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: "default" }))); await p.reload(); await p.waitForTimeout(wait);
  if (name === "hud-studio") await p.locator('[aria-label^="Keystrokes widget"]').first().click({ position: { x: 40, y: 40 } }).catch(() => {});
  await act(); await p.waitForTimeout(500);
  const buf = await p.screenshot({ path: `${out}/${name}-${round}.png` }); const r = await gate(buf, name); console.log("shot", name, `sd=${r.sd.toFixed(1)} colours=${r.colours}`);
}
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 6));
await b.close();
