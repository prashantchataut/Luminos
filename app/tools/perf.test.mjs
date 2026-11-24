// Unit tests for src/perf.ts. Run: npm test   (bundles the TS with esbuild, then asserts with node:assert)
import { build } from "esbuild";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const out = path.resolve("node_modules/.cache/perf.test.bundle.mjs");
await build({ entryPoints: ["src/perf.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const P = await import(pathToFileURL(out).href);
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
const gpu = (s) => P.parseGpu(s);
const base = (g, o = {}) => ({ gpu: gpu(g), ramGb: 16, cores: 8, mods: 31, frameMs: 6, renderer: "sodium", shaders: false, allocatedMb: 4096, hudThrottle: true, inputSampling: true, ...o });
t("parse RTX 4070 is nvidia turing+", () => { const g = gpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)"); assert.equal(g.vendor, "nvidia"); assert.equal(g.nvidiaGen, "turing+"); });
t("parse GTX 1060 is older", () => assert.equal(gpu("NVIDIA GeForce GTX 1060").nvidiaGen, "older"));
t("parse GTX 1660 is turing+", () => assert.equal(gpu("NVIDIA GeForce GTX 1660 Ti").nvidiaGen, "turing+"));
t("parse swiftshader is software", () => assert.equal(gpu("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))").vendor, "software"));
t("parse Intel UHD is integrated", () => assert.equal(gpu("Intel(R) UHD Graphics 770").integrated, true));
t("nvidium only on turing+ nvidia with sodium", () => {
  assert.equal(P.recommend(base("NVIDIA GeForce RTX 3060"))[2].allowed, true);
  assert.equal(P.recommend(base("NVIDIA GeForce GTX 1060"))[2].allowed, false);
  assert.equal(P.recommend(base("AMD Radeon RX 6600"))[2].allowed, false);
  assert.equal(P.recommend(base("NVIDIA GeForce RTX 3060", { renderer: "vulkanmod" }))[2].allowed, false);
});
t("vulkanmod blocked by shaders and by software renderer", () => {
  assert.equal(P.recommend(base("AMD Radeon RX 6600"))[1].allowed, true);
  assert.equal(P.recommend(base("AMD Radeon RX 6600", { shaders: true }))[1].allowed, false);
  assert.equal(P.recommend(base("SwiftShader"))[1].allowed, false);
});
t("every recommendation is exactly one sentence", () => { for (const g of ["NVIDIA GeForce RTX 4070", "NVIDIA GeForce GTX 1060", "Intel(R) UHD Graphics 770", "SwiftShader"]) for (const r of P.recommend(base(g))) assert.equal(r.why.split(/\.\s/).filter(Boolean).length, 1, r.why); });
t("whyLow: software renderer wins over everything", () => assert.equal(P.whyLow(base("SwiftShader", { frameMs: 40, hudThrottle: false })).id, "software"));
t("whyLow: over-allocated RAM", () => assert.equal(P.whyLow(base("NVIDIA GeForce RTX 3060", { ramGb: 8, allocatedMb: 7000 })).id, "ram-high"));
t("whyLow: integrated + sodium suggests vulkan", () => assert.equal(P.whyLow(base("Intel(R) UHD Graphics 770", { frameMs: 14 })).id, "vk"));
t("whyLow: returns exactly one tip and a healthy machine gets 'ok'", () => { const x = P.whyLow(base("NVIDIA GeForce RTX 4070", { frameMs: 4 })); assert.equal(x.id, "ok"); assert.ok(x.change); });
t("click probe: sampling on has lower latency than off", () => {
  const run = (sampling) => { const p = new P.ClickProbe(); const t0 = performance.now(); for (let i = 0; i < 20; i++) { p.down(); const end = performance.now() + 4; while (performance.now() < end); p.frame(sampling, i % 12 === 11); } return p; };
  const on = run(true), off = run(false);
  assert.ok(on.avgLatencyMs < off.avgLatencyMs, `${on.avgLatencyMs} !< ${off.avgLatencyMs}`);
  assert.equal(on.rawCps, 20);
});
console.log(`${n} tests passed`);
