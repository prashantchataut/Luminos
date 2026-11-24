// Renders the v0.9.1 screens from the built app.  node tools/shots-v091.mjs [outDir]   (needs `npx vite preview --port 4173`)
import { chromium } from "playwright";
import fs from "node:fs";
const out = process.argv[2] || "../docs/launcher-shots/v091"; fs.mkdirSync(out, { recursive: true });
const base = process.env.BASE || "http://localhost:4173";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await b.newContext({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage(); const errors = [];
p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (n, sel) => { await p.waitForTimeout(1200); await (sel ? p.locator(sel).first().screenshot({ path: `${out}/${n}.png` }) : p.screenshot({ path: `${out}/${n}.png` })); console.log("shot", n); };
const go = async (h) => { await p.goto(base + "/?name=Mira#/" + h); await p.evaluate(() => localStorage.clear()); await p.goto(base + "/?name=Mira#/" + h); await p.reload(); await p.waitForTimeout(1800); };
const theme = (t) => p.locator('[aria-label="Theme"] button', { hasText: t }).click();
// themes
for (const t of ["Clean", "Lunar", "Light"]) { await go("skins"); await theme(t); await shot(`theme-${t.toLowerCase()}-skins`); }
for (const t of ["Clean", "Lunar", "Light"]) { await go("home"); await theme(t); await shot(`theme-${t.toLowerCase()}-home`); }
// skin library: each skin in 3D, studio and scene
await go("skins"); await shot("skins-library-studio");
await p.getByText("Sunset scene").first().click(); await shot("skins-library-scene");
for (const [id, name] of [["luminos-default", "Luminos Default"], ["ember", "Ember"], ["glasshouse", "Glasshouse"], ["nightshift", "Nightshift"], ["paper", "Paper"]]) {
  await p.getByLabel(`Skin ${name}`).click(); await p.waitForTimeout(500); await shot(`skin-3d-${id}`, 'canvas[aria-label^="3D preview"]');
}
await p.getByLabel("Skin Ember").click(); await shot("where-others-see-this", '[aria-label="Where others see this"]');
await p.getByText("Server owner setup").click(); await shot("server-owner-setup", '[role="dialog"]'); await p.keyboard.press("Escape");
// username lookup failure path (browser blocks Mojang CORS) and file import error
await p.getByLabel("Minecraft username").fill("Notch"); await p.getByText("Look up").click(); await p.waitForTimeout(2500); await shot("username-lookup");
await p.setInputFiles('input[type=file][accept="image/png"]', { name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not a png at all") }); await shot("import-rejects-bad-file");
// editor
await p.getByLabel("Skin Luminos Default").click(); await p.getByText("Edit a copy").click(); await p.waitForTimeout(1500);
const c = p.locator('canvas[aria-label="Skin texture"]'); const bb = await c.boundingBox();
await p.getByLabel("Brush", { exact: true }).click(); await p.getByLabel("Mirror left and right").click();
await p.mouse.move(bb.x + 44 * 8 + 4, bb.y + 20 * 8 + 4); await p.mouse.down(); await p.mouse.move(bb.x + 46 * 8, bb.y + 28 * 8, { steps: 10 }); await p.mouse.up();
await shot("skin-editor", '[role="dialog"]'); await p.getByLabel("Close editor").click();
// locker
await go("locker"); await p.locator('[aria-label="Camera"] button', { hasText: "Front" }).click(); await shot("locker-pets");
for (const s of ["Walk", "Jump", "Swim", "Hurt"]) { await p.locator('[aria-label="Pose"] button', { hasText: s }).click(); await shot(`locker-pets-${s.toLowerCase()}`, 'canvas[aria-label^="3D preview"]'); }
await p.locator('[aria-label="Pose"] button', { hasText: "Idle" }).click();
const cats = [["Wings", null], ["Hats", "Top hat"], ["Masks", "Half mask"], ["Bandanas", "Neck bandana"], ["Cloaks", null], ["Back items", "Backpack"], ["Emotes", "Hug"]];
for (const [cat, pick] of cats) { await p.locator('nav[aria-label="Categories"] button', { hasText: cat }).click(); await p.locator('[aria-label="Camera"] button', { hasText: ["Wings", "Cloaks", "Back items"].includes(cat) ? "Back" : "Front" }).click(); if (pick) await p.getByLabel(`Equip ${pick}`).click(); await shot(`locker-${cat.toLowerCase().replace(" ", "-")}`); }
await p.locator('nav[aria-label="Categories"] button', { hasText: "Pets" }).click();
for (const pet of ["Cube", "Wyrmling", "Wisp", "Mini-Me"]) { const e = p.getByLabel(`Equip ${pet}`); if (await e.count()) await e.click(); await p.waitForTimeout(400); await shot(`pet-${pet.toLowerCase()}`, 'canvas[aria-label^="3D preview"]'); }
await p.locator('[aria-label="Camera"] button', { hasText: "Back" }).click(); await shot("locker-back-view-scene");
await p.getByText("Studio", { exact: true }).first().click(); await shot("locker-studio");
if (errors.length) console.log("console errors:", [...new Set(errors)].slice(0, 8));
await b.close();
