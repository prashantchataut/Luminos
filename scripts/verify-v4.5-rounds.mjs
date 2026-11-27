// Fails unless round 1, 2 and 3 of every v4.5 screen are different files (sha256), and the published site renders equal round 3.
import fs from "node:fs"; import crypto from "node:crypto";
const dir = "docs/design/rounds";
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const screens = ["home", "hud-editor", "mods", "keybinds", "capes", "themes", "preferences", "mc-startup-screen", "mc-quick-panel", "mc-hud-studio"];
let bad = 0;
for (const s of screens) {
  const h = [1, 2, 3].map((n) => sha(`${dir}/${s}-${n}.png`));
  const ok = new Set(h).size === 3; if (!ok) bad++;
  console.log((ok ? "OK  " : "FAIL"), s.padEnd(18), h.map((x) => x.slice(0, 12)).join("  "));
}
const pub = { "mc-startup-screen": "mc-startup-screen", "mc-quick-panel": "mc-quick-panel", "mc-hud-studio": "mc-hud-studio", "launcher-home": "home-version-picker", "launcher-mods": "mods", "launcher-capes": "capes" };
for (const [site, src] of Object.entries(pub)) {
  const ok = sha(`site/public/renders/${site}.png`) === sha(`${dir}/${src}-3.png`); if (!ok) bad++;
  console.log(ok ? "OK  " : "FAIL", `site/public/renders/${site}.png == ${src}-3.png`);
}
process.exit(bad ? 1 : 0);
