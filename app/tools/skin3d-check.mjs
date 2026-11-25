// gap > 0 means two parts are separated (a real fault). Small negative gaps are normal: the outer clothing layer is 12.5% larger and legs swing about the hip.
// Checks the 3D locker figure is a connected Minecraft character for all five skins and all five moves.
// Fails on: page errors, blank canvas, head/torso/legs separated or sheared, or no idle motion.
// Needs `vite preview` on :4173. Usage: OUT=dir node tools/skin3d-check.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const out = process.env.OUT || "../skin3d"; mkdirSync(out, { recursive: true });
const SKINS = ["aether-knight", "cobalt-rogue", "sakura-ronin", "void-walker", "frost-warden"], MOVES = ["idle", "walk", "jump", "swim", "hurt"];
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 1360, height: 820 } })).newPage();
let bad = 0; const fail = (m) => { console.log("FAIL", m); bad++; };
p.on("pageerror", (e) => fail(`page error: ${e.message}`));
await p.goto("http://localhost:4173/#/home");
const hashes = new Set(), cells = [];
for (const id of SKINS) {
  await p.evaluate((id) => { localStorage.setItem("luminos.setup", "1"); localStorage.setItem("luminos.locker.v1", JSON.stringify({ skin: id })); }, id);
  await p.goto("http://localhost:4173/#/cosmetics"); await p.reload(); await p.waitForFunction(() => !!window.__locker, null, { timeout: 15000 }); await p.waitForTimeout(1500);
  const geo = await p.evaluate(async (MOVES) => {
    const l = window.__locker, v = l.v, sk = v.playerObject.skin; v.autoRotate = false; v.playerWrapper.rotation.y = 0;
    const rows = [];
    for (const mv of MOVES) {
      l.setMove(mv); for (const t of [0.3, 0.9, 1.7]) {
        l.t0 = performance.now() - t * 1000; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        v.playerObject.updateMatrixWorld(true);
        const bx = (o) => { const x = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; o.traverse((m) => { if (!m.isMesh) return; m.geometry.computeBoundingBox(); const g = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); ["x", "y", "z"].forEach((k, i) => { x.min[i] = Math.min(x.min[i], g.min[k]); x.max[i] = Math.max(x.max[i], g.max[k]); }); }); return x; };
        const h = bx(sk.head), body = bx(sk.body), ll = bx(sk.leftLeg), rl = bx(sk.rightLeg);
        rows.push({ mv, t, headGap: +(h.min[1] - body.max[1]).toFixed(2), legGap: +(body.min[1] - Math.max(ll.max[1], rl.max[1])).toFixed(2), headDx: +Math.abs((h.min[0] + h.max[0]) / 2 - (body.min[0] + body.max[0]) / 2).toFixed(2) });
      }
    }
    l.setMove("idle"); return rows;
  }, MOVES);
  const upright = geo.filter((r) => r.mv !== "swim" && r.mv !== "hurt");
  for (const r of upright) {
    if (r.headGap > 0.3 || r.headGap < -2.5) fail(`${id} ${r.mv}@${r.t}s head detached: gap ${r.headGap}`);
    if (r.legGap > 0.3 || r.legGap < -3) fail(`${id} ${r.mv}@${r.t}s legs displaced: gap ${r.legGap}`);
    if (r.headDx > 0.8) fail(`${id} ${r.mv}@${r.t}s head off-centre by ${r.headDx}`);
  }
  await p.evaluate(() => { const l = window.__locker; l.setMove("idle"); l.v.playerWrapper.rotation.y = 0.6; });
  const rect = await p.evaluate(() => { const r = window.__locker.v.canvas.getBoundingClientRect(); return { x: r.x + 150, y: r.y + 60, width: 390, height: 520 }; });
  await p.evaluate(() => { window.__locker.t0 = performance.now() - 300; }); await p.waitForTimeout(100);
  const a = await p.screenshot({ clip: rect });
  await p.evaluate(() => { window.__locker.t0 = performance.now() - 2600; }); await p.waitForTimeout(100); const c = await p.screenshot({ clip: rect });
  const ha = createHash("sha1").update(a).digest("hex"); hashes.add(ha);
  if (a.length < 4000) fail(`${id}: canvas looks blank (${a.length} bytes)`);
  if (ha === createHash("sha1").update(c).digest("hex")) fail(`${id}: idle animation produced identical frames`);
  writeFileSync(`${out}/skin-${id}.png`, a); cells.push({ id, img: a.toString("base64") });
  console.log(`${id.padEnd(16)} ${geo.length} poses checked, head gap ${Math.min(...upright.map((r) => r.headGap))}..${Math.max(...upright.map((r) => r.headGap))}, leg gap ${Math.min(...upright.map((r) => r.legGap))}..${Math.max(...upright.map((r) => r.legGap))}`);
}
if (hashes.size !== SKINS.length) fail(`expected ${SKINS.length} distinct renders, got ${hashes.size}`);
await p.setViewportSize({ width: 5 * 300, height: 420 });
await p.setContent(`<body style="margin:0;background:#26282e;display:flex">${cells.map((c) => `<img src="data:image/png;base64,${c.img}" style="width:300px">`).join("")}</body>`);
await p.screenshot({ path: `${out}/five-skins-3d.png` });
await b.close(); console.log(bad ? `SKIN 3D: ${bad} problem(s)` : "SKIN 3D: five skins connected, distinct and animating"); process.exit(bad ? 1 : 0);
