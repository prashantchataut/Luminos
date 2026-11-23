// Renders every screen with Playwright at 1280x800 @2x: node tools/shots.mjs <round> [PW_DIR]
import { createRequire } from "node:module";
import fs from "node:fs";
const req = createRequire((process.env.PW_DIR || process.argv[3] || process.cwd()) + "/");
const { chromium } = req("playwright");
const round = process.argv[2] || "1";
const base = process.env.BASE || "http://localhost:4173";
const out = process.env.OUT || "../docs/design/rounds";
fs.mkdirSync(out, { recursive: true });
const S = [["onboarding-welcome", "/#/onboarding/1"], ["onboarding-name", "/?name=Dream#/onboarding/2"], ["onboarding-import", "/#/onboarding/3"], ["home", "/#/home"], ["home-launch", "/?demo=preparing#/home"], ["instances", "/#/instances"], ["mods", "/#/mods"], ["skins", "/#/skins"], ["servers", "/#/servers"], ["client", "/#/client"], ["settings", "/#/settings"]];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
for (const [n, u] of S) { await p.goto(base + u); await p.reload(); await p.waitForTimeout(n.startsWith("onboarding") ? 1600 : 1300); await p.screenshot({ path: `${out}/${n}-${round}.png` }); console.log("shot", n); }
await b.close();
