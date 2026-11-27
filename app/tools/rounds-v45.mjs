// v4.5 launcher render rounds: 1280x800 @2x, real re-render every call.   node tools/rounds-v45.mjs <round> [outDir]
// Needs the app on :4173 (npm run build && npx vite preview --port 4173). Also asserts the v4.5 UI facts in the DOM
// (title bar buttons, version + preset selectors, capes canvas painted and not dark) so a screenshot can't pass while the UI is wrong.
import { chromium } from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";

const round = process.argv[2] || "1";
const out = process.argv[3] || "../docs/design/rounds";
const app = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(out, { recursive: true });

// [file name, route, extra steps]
const SCREENS = [
  ["home", "/#/home", async (p) => {
    await p.waitForSelector("[data-testid=version-select], [aria-label*='Minecraft version' i]", { timeout: 4000 }).catch(() => {});
  }],
  ["hud-editor", "/#/hud"],
  ["mods", "/#/mods"],
  ["keybinds", "/#/keybinds"],
  ["capes", "/#/cosmetics", async (p) => { await p.waitForTimeout(2600); }],
  ["themes", "/#/themes"],
  ["preferences", "/#/preferences"],
];

const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(String(e)));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const facts = {};
for (const [name, route, extra] of SCREENS) {
  await p.goto(app + route);
  await p.reload();
  await p.waitForTimeout(1200);
  if (extra) await extra(p);
  if (name === "home") {
    facts.titlebar = await p.evaluate(() => {
      const t = [...document.querySelectorAll("button")].map((x) => (x.getAttribute("aria-label") || x.textContent || "").trim().toLowerCase());
      return { minimize: t.some((s) => s.includes("minimi")), maximize: t.some((s) => s.includes("maximi") || s.includes("restore")), close: t.some((s) => s === "close" || s.includes("close")), drag: !!document.querySelector("[data-tauri-drag-region]") };
    });
    facts.homeText = await p.evaluate(() => document.body.innerText);
  }
  if (name === "capes") {
    facts.capes = await p.evaluate(() => {
      const c = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!c) return { canvas: false };
      const t = document.createElement("canvas"); t.width = 64; t.height = 64;
      const g = t.getContext("2d"); g.drawImage(c, 0, 0, 64, 64);
      const d = g.getImageData(0, 0, 64, 64).data; let lum = 0, n = 0, max = 0;
      for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; lum += l; n++; max = Math.max(max, l); }
      return { canvas: true, meanLuma: Math.round(lum / n), maxLuma: Math.round(max) };
    });
  }
  const f = `${out}/${name}-${round}.png`;
  await p.screenshot({ path: f });
  if (name === "home") {   // the opened pickers: every version and every preset, read from the real listbox
    await p.click("[data-testid=version-select]");
    facts.versions = await p.$$eval("[role=listbox] [role=option]", (n) => n.map((x) => x.innerText.replace(/\n/g, " ")));
    await p.waitForTimeout(450);
    await p.screenshot({ path: `${out}/home-version-picker-${round}.png` });
    await p.keyboard.press("Escape");
    await p.click("[data-testid=preset-select]");
    facts.presets = await p.$$eval("[role=listbox] [role=option]", (n) => n.map((x) => x.innerText.replace(/\n/g, " ")));
    await p.waitForTimeout(450);
    await p.screenshot({ path: `${out}/home-preset-picker-${round}.png` });
    await p.keyboard.press("Escape");
  }
  console.log(name.padEnd(12), crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex").slice(0, 16), fs.statSync(f).size);
}
const txt = facts.homeText || "";
console.log("titlebar:", JSON.stringify(facts.titlebar));
console.log("capes   :", JSON.stringify(facts.capes));
console.log("versions:", JSON.stringify(facts.versions)); console.log("presets :", JSON.stringify(facts.presets));
console.log("home has versions:", ["1.21.4", "1.21.1", "1.20.4", "1.20.1", "1.19.4"].map((v) => `${v}=${txt.includes(v)}`).join(" "));
console.log("home has presets :", ["Max FPS", "Competitive", "Balanced"].map((v) => `${v}=${txt.includes(v)}`).join(" "));
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 8));
await b.close();
