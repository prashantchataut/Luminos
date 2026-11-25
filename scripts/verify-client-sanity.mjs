#!/usr/bin/env node
// Luminos v2 sanity gates. Prints PASS/FAIL per check and exits non-zero on any FAIL.   node scripts/verify-client-sanity.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (...p) => path.join(root, ...p);
const read = (...p) => fs.readFileSync(R(...p), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
let fails = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); if (!ok) fails++; };

// 1. Window resolution
const conf = JSON.parse(read("app/src-tauri/tauri.conf.json"));
const w = conf.app.windows[0];
check("Window resolution", w.width === 1280 && w.height === 800 && w.minWidth >= 1080 && w.minHeight >= 700 && w.center === true && w.resizable === true && w.fullscreen === false,
  `${w.width}x${w.height} min ${w.minWidth}x${w.minHeight} center=${w.center} resizable=${w.resizable} decorations=${w.decorations}`);

// 2. Forbidden backend mods must not appear in Mods or Keybinds data
const FORBIDDEN = ["Sodium", "Lithium", "FerriteCore", "ModernFix", "EntityCulling", "C2ME", "Indium", "Iris", "Fabric API"];
const modsSrc = stripComments(read("app/src/data/modules.ts")), keysSrc = stripComments(read("app/src/data/keybinds.ts"));
const hits = FORBIDDEN.filter((f) => new RegExp(`\\b${f}\\b`, "i").test(modsSrc) || new RegExp(`\\b${f}\\b`, "i").test(keysSrc));
check("Forbidden backend mods absent from Mods and Keybinds", hits.length === 0, hits.length ? "found: " + hits.join(", ") : "none of " + FORBIDDEN.length);

// 3. Required client modules
const names = [...modsSrc.matchAll(/\bM\("([a-z0-9]+)",\s*"([^"]+)"/g)].map((m) => m[2]);
const REQUIRED = ["Waypoints", "Minimap", "Fullbright", "Freelook", "Zoom", "ToggleSprint", "Keystrokes", "CPS Display", "FPS Display", "Ping Display", "Armor Status", "Potion Effects", "Time Changer", "Weather Changer", "Low Fire", "Clear Fog", "Crosshair", "Block Overlay", "1.7 Animations", "Motion Blur", "Hitbox", "Nametags", "Scoreboard", "Bossbar", "Chatting", "Death Recap", "TNT Timer", "Item Physics", "Coordinates", "Combo Counter", "Reach Display"];
const missing = REQUIRED.filter((r) => !names.includes(r));
check("Required client modules present", missing.length === 0 && names.length >= 30, `${names.length} modules defined${missing.length ? ", missing: " + missing.join(", ") : ""}`);

// 4. Single WebGL context
const screens = fs.readdirSync(R("app/src/screens")).filter((f) => f.endsWith(".tsx"));
const gl = (s) => /skinview3d|from "three"|LockerScene|getContext\(.webgl/i.test(stripComments(s));
const offenders = screens.filter((f) => f !== "Cosmetics.tsx" && gl(read("app/src/screens", f)));
const cos = read("app/src/screens/Cosmetics.tsx");
const news = (cos.match(/new LockerScene\(/g) || []).length;
const cardSrc = cos.slice(cos.indexOf("const Card = memo"), cos.indexOf("export default function Cosmetics"));
const comps = fs.readdirSync(R("app/src/components")).filter((f) => gl(read("app/src/components", f)));
const scene = read("app/src/locker/scene.ts");
check("Single WebGL context (one LockerScene, none in cards or other screens)", offenders.length === 0 && comps.length === 0 && news === 1 && !gl(cardSrc) && /sc\.dispose\(\)/.test(cos) && /forceContextLoss/.test(scene),
  `new LockerScene x${news}; other screens with WebGL: ${offenders.join(",") || "none"}; disposed on unmount + forceContextLoss`);
check("3D loop capped and paused", /fps = 45/.test(scene) && /document\.hidden/.test(scene) && /renderPaused = true/.test(scene), "<=45 fps, paused when hidden or a modal is open");

// 5. Crash-proofing
const direct = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f.name) && !p.endsWith("tauri-bridge.ts") && /@tauri-apps\/api\/core/.test(fs.readFileSync(p, "utf8"))) direct.push(path.relative(root, p)); } })(R("app/src"));
const bridge = read("app/src/lib/tauri-bridge.ts");
check("safeInvoke is the only IPC path", /export async function safeInvoke/.test(bridge) && /4000/.test(bridge) && direct.length === 0, direct.length ? "direct invoke in " + direct.join(", ") : "timeout 4000ms, fallback returned");
check("App wrapped in ErrorBoundary", /<ErrorBoundary/.test(read("app/src/main.tsx")) && /<ErrorBoundary/.test(read("app/src/App.tsx")));
check("Root layout locked", /w-screen h-screen overflow-hidden flex select-none antialiased/.test(read("app/src/App.tsx")));

// 6. Skins
const sk = spawnSync("node", [R("scripts/verify-skins.mjs")], { cwd: root, encoding: "utf8" });
check("Skin shading (verify-skins.mjs: 64x64, >=40 colours, outer layer)", sk.status === 0, (sk.stdout || sk.stderr || "").trim().split("\n").slice(-1)[0]);

// 7. Anti-cheat screenshot rounds
const SCREENS = ["home", "mods", "keybinds", "preferences", "cosmetics", "hud-studio", "themes", "site"];
let roundsOk = true;
console.log("\nScreenshot rounds (SHA-256):");
for (const s of SCREENS) {
  const hs = [1, 2, 3].map((n) => { const f = R("docs/design/rounds", `${s}-${n}.png`); if (!fs.existsSync(f)) return null; const b = fs.readFileSync(f); return { size: b.length, sha: crypto.createHash("sha256").update(b).digest("hex") }; });
  const ok = hs.every((h) => h && h.size > 25 * 1024) && hs[0].sha !== hs[1].sha && hs[1].sha !== hs[2].sha && hs[0].sha !== hs[2].sha;
  if (!ok) roundsOk = false;
  console.log(`  ${s.padEnd(12)} ${hs.map((h, i) => (h ? `r${i + 1}=${h.sha}` : `r${i + 1}=MISSING`)).join("  ")}  ${ok ? "distinct" : "NOT DISTINCT / MISSING / TOO SMALL"}`);
}
console.log("");
check("Rounds 1, 2, 3 exist, >25KB and pairwise-distinct for all 8 screens", roundsOk);

console.log(fails ? `\n${fails} check(s) FAILED` : "\nAll checks passed");
process.exit(fails ? 1 : 0);
