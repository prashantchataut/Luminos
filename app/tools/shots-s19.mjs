// Session 19 captures. Every step has its own hard timeout, so one slow screen can no longer hang the run (it did in #18).
// Needs `vite preview` on :4173 and network access (the store talks to the real Modrinth API). OUT=dir node tools/shots-s19.mjs
import { chromium } from "playwright"; import { mkdirSync } from "node:fs";
const out = process.env.OUT || "../docs/launcher-shots/session19"; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ viewport: { width: 1360, height: 820 } })).newPage(); p.setDefaultTimeout(8000);
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
let fails = 0;
const step = async (name, fn) => { let to; try { await Promise.race([fn(), new Promise((_, r) => { to = setTimeout(() => r(new Error("step timed out after 25 s")), 25000); })]); console.log("ok  ", name); } catch (e) { fails++; console.log("FAIL", name, "-", String(e.message).split("\n")[0]); } finally { clearTimeout(to); } };
const theme = (t) => p.evaluate((t) => { localStorage.setItem("luminos.settings.v2", JSON.stringify({ theme: t })); localStorage.setItem("luminos.setup", "1"); localStorage.setItem("luminos.livepanel.pause", "1"); }, t);
const go = async (r) => { await p.goto(`http://localhost:4173/#/${r}`); await p.reload(); await p.waitForTimeout(800); };
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
await p.goto("http://localhost:4173/#/home"); await theme("default");

await step("panel: live vs queued split", async () => { await go("livepanel"); await p.getByRole("list", { name: "Luminos modules" }).waitFor(); await shot("panel-1-split"); });
await step("panel: stage three changes, review shows the live/queued groups", async () => {
  await p.getByRole("switch", { name: /^Fps/ }).click(); await p.getByRole("switch", { name: /^Faithful 32x/ }).click(); await p.getByRole("switch", { name: /^AppleSkin/ }).click(); await p.getByRole("switch", { name: /^Copper Stuff/ }).click();
  await p.getByRole("button", { name: /Review 4 changes/ }).click(); await p.getByText("Waits for the next launch").waitFor(); await p.waitForTimeout(700); await shot("panel-2-review-diff");
});
await step("panel: progress follows the agent's events, then queued toast", async () => {
  await p.getByRole("button", { name: /^Confirm/ }).click(); await p.waitForTimeout(260); await shot("panel-3-progress-real-stages");
  await p.waitForTimeout(1600); await shot("panel-4-done-and-queued");
});
await step("panel: undo reverts live and queued", async () => { await p.getByRole("button", { name: /Undo the last switch/ }).click(); await p.waitForTimeout(700); await shot("panel-5-undo"); });
await step("store: real Modrinth results + categories", async () => {
  await p.getByRole("button", { name: /Store/ }).first().click(); await p.getByLabel("Store results").getByRole("button", { name: /^Download/ }).first().waitFor({ timeout: 15000 });
  await shot("store-1-real-modrinth-mods"); await p.getByRole("button", { name: "optimization", exact: true }).click(); await p.waitForTimeout(1500); await shot("store-2-category-optimization");
});
await step("store: shaders and hide installed", async () => { await p.getByRole("button", { name: "Shaders", exact: true }).click(); await p.waitForTimeout(1800); await p.getByRole("switch", { name: "Hide installed" }).click(); await shot("store-3-shaders"); });
for (const t of ["default", "lunar", "light"]) await step(`themes: live panel in ${t}`, async () => { await theme(t); await go("livepanel"); await p.getByRole("switch", { name: /^Fps/ }).click(); await p.getByRole("switch", { name: /^AppleSkin/ }).click(); await shot(`theme-panel-${t}`); });
await theme("default");
await step("instances: saved-by-sharing number on each card", async () => { await go("instances"); await p.getByText(/Saved .* GB/).first().waitFor(); await shot("instances-saved-number"); });
await step("settings: presence preview + sharing + P2P", async () => { await go("settings"); await p.locator("[data-presence-preview]").scrollIntoViewIfNeeded(); await shot("settings-presence-and-sharing"); });
await step("settings: conflict dialog", async () => { await p.getByRole("switch", { name: "Include worlds" }).click(); await p.getByRole("button", { name: "Check", exact: true }).click(); await p.getByText(/differences? to decide/).waitFor(); await p.getByLabel(/Keep which version of fov/).getByRole("radio").first().check(); await shot("settings-conflict-dialog"); });
await step("cosmetics + home + library", async () => { for (const r of ["cosmetics", "library", "home"]) { await go(r); await p.waitForTimeout(1200); await shot(`screen-${r}`); } });
console.log(errs.length ? `PAGE ERRORS: ${[...new Set(errs)].join(" | ")}` : "no page errors");
await b.close(); process.exit(fails || errs.length ? 1 : 0);
