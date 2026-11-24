// Renders the v0.9 screens from the built dist (vite preview on :4173). Usage: node tools/shots-v09.mjs [which]
import { chromium } from "playwright";
const out = "../docs/launcher-shots/v09/";
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1360, height: 820 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage(); const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); p.on("pageerror", (e) => errs.push("PAGE " + e.message));
const go = async (hash, wait = 900) => { await p.goto("http://localhost:4173/#/" + hash); await p.reload(); await p.waitForTimeout(wait); };
const seed = (o) => p.evaluate((o) => { const k = "luminos.locker.v1"; const cur = JSON.parse(localStorage.getItem(k) || "{}"); localStorage.setItem(k, JSON.stringify({ ...cur, ...o })); }, o);
const shot = async (n, sel) => { await p.waitForTimeout(700); await (sel ? p.locator(sel) : p).screenshot({ path: `${out}${n}.png` }); console.log("shot", n); };
const tab = (l) => p.locator("nav[aria-label='Locker categories'] button", { hasText: l }).first().click();
const EQ = (e) => ({ pets: null, wings: null, hats: null, masks: null, bandanas: null, cloaks: null, back: null, emotes: null, ...e });
await p.goto("http://localhost:4173/#/home"); await p.evaluate(() => localStorage.clear());
for (const theme of ["default", "lunar", "light"]) {
  await p.evaluate((t) => { const k = "luminos.settings.v2"; localStorage.setItem(k, JSON.stringify({ theme: t })); localStorage.setItem("luminos.setup", "1"); }, theme);
  await go("home"); await shot(`theme-${theme}-home`);
  await go("cosmetics"); await shot(`theme-${theme}-locker`);
  await p.getByRole("button", { name: "Theme", exact: true }).click(); await shot(`theme-${theme}-switcher`);
}
await p.evaluate(() => localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: "default" })));
// the five skins, each in the 3D view
for (const id of ["luminos-default", "ember", "glasshouse", "nightshift", "paper"]) {
  await seed({ skin: id, equipped: EQ({}) }); await go("cosmetics", 1400); await shot(`skin-${id}`);
}
await seed({ skin: "luminos-default", equipped: EQ({ pets: "pet-cube" }) }); await go("cosmetics", 1200); await shot("library");
await p.getByRole("button", { name: /^Edit a copy/ }).click(); await shot("editor");
await p.keyboard.press("Escape");
// each category, studio and sunset scene
const cats = { pets: ["Pets", { pets: "pet-dragon", hats: "hat-crown", cloaks: "cloak-luminos-moon" }], wings: ["Wings", { wings: "wing-feather", pets: "pet-wisp", hats: "hat-cap" }], hats: ["Hats", { hats: "hat-wizard", masks: "mask-fox", bandanas: "band-neck" }], masks: ["Masks", { masks: "mask-visor", hats: "hat-cap" }], bandanas: ["Bandanas", { bandanas: "band-head", masks: "mask-fox" }], cloaks: ["Cloaks", { cloaks: "cloak-luminos-moon", pets: "pet-minime" }], back: ["Back items", { back: "back-pack", pets: "pet-cube" }], emotes: ["Emotes", { emotes: "emote-wave" }] };
for (const [k, [label, eq]] of Object.entries(cats)) {
  await seed({ skin: "ember", equipped: EQ(eq) }); await go("cosmetics", 1200);
  await tab(label); await shot(`locker-${k}`);
}
await seed({ skin: "luminos-default", equipped: EQ({ pets: "pet-dragon", wings: "wing-shard", hats: "hat-crown", cloaks: null }) }); await go("cosmetics", 1200);
await tab("Pets"); await p.getByRole("button", { name: "Sunset scene" }).click(); await shot("scene-sunset");
for (const m of ["Walk", "Jump", "Swim", "Hurt"]) { await p.getByRole("button", { name: m, exact: true }).click(); await p.waitForTimeout(300); await shot(`scene-${m.toLowerCase()}`); }
await p.getByRole("button", { name: "Studio" }).click(); await p.getByRole("button", { name: "Idle", exact: true }).click(); await shot("studio-default");
await tab("Skins"); await p.locator("section[aria-label='Where others see this']").scrollIntoViewIfNeeded(); await shot("visibility", "section[aria-label='Where others see this']");
console.log("console errors:", errs.length, errs.slice(0, 5)); await b.close();
