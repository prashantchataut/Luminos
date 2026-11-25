// Session 18 captures: live mod panel states, themes, Discord presence preview. Needs `vite preview` on :4173. OUT=dir node tools/shots-s18.mjs
import { chromium } from "playwright"; import { mkdirSync } from "node:fs";
const out = process.env.OUT || "../docs/launcher-shots/session18"; mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1360, height: 820 } })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const theme = (t) => p.evaluate((t) => { localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: t })); localStorage.setItem("luminos.setup", "1"); }, t);
const go = async (r) => { await p.goto(`http://localhost:4173/#/${r}`); await p.reload(); await p.waitForTimeout(700); };
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
await p.goto("http://localhost:4173/#/home"); await theme("default");
await go("livepanel"); await shot("panel-1-mods");
await p.getByRole("switch", { name: /Xaero's Minimap/ }).click(); await p.getByRole("switch", { name: /^Jade/ }).click(); await p.getByRole("switch", { name: /^Roughly Enough Items/ }).click();
await shot("panel-2-staged");
await p.getByRole("button", { name: /Review 3 changes/ }).click(); await p.waitForTimeout(300); await shot("panel-3-review-diff");
await p.getByRole("button", { name: /^Confirm/ }).click(); await p.waitForTimeout(260); await shot("panel-4-switching-progress");
await p.waitForTimeout(2200); await shot("panel-5-queued-toasts");
await p.getByRole("button", { name: /Undo the last switch/ }).click(); await p.waitForTimeout(400); await shot("panel-6-undo");
// blocked: Sodium cannot be switched, Iris off would be allowed; show the keep-on row
console.log("always-on rows:", await p.getByText("Always on").count());
await p.getByRole("button", { name: /Store/ }).first().click(); await p.waitForTimeout(500); await shot("panel-7-store");
await p.getByRole("switch", { name: "Hide installed" }).click(); await p.waitForTimeout(200); await shot("panel-8-store-hide-installed");
await p.getByRole("button", { name: "Download FerriteCore" }).click(); await p.waitForTimeout(350); await shot("panel-9-store-downloading");
await p.waitForTimeout(2500);
await go("livepanel?tab=store"); await p.waitForTimeout(600); await shot("panel-10-store-from-cache");
console.log("cache line:", await p.getByText(/Opened from cache|First open/).first().innerText());
await p.getByRole("button", { name: "Shaders" }).click(); await p.waitForTimeout(300); await shot("panel-11-store-shaders");
for (const t of ["lunar", "light"]) { await theme(t); await go("livepanel"); await p.getByRole("switch", { name: /Xaero's Minimap/ }).click(); await shot(`panel-theme-${t}`); }
await theme("default"); await go("settings");
await p.locator("[data-presence-preview]").scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await shot("presence-1-singleplayer");
await p.getByRole("button", { name: "Server", exact: true }).click(); await p.waitForTimeout(200); await shot("presence-2-server-hidden");
await p.getByRole("switch", { name: "Share the server address" }).click(); await p.waitForTimeout(200); await shot("presence-3-server-shared");
await p.getByRole("switch", { name: "Show Luminos on Discord" }).click(); await p.waitForTimeout(200); await shot("presence-4-off");
await b.close(); console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "no page errors"); process.exit(errs.length ? 1 : 0);
