// Pure logic for the Performance screen. No DOM access here so it can be unit-tested with node (app/tools/perf.test.mjs).

export type Gpu = { vendor: "nvidia" | "amd" | "intel" | "apple" | "software" | "other"; name: string; nvidiaGen?: "turing+" | "older"; vulkan12?: boolean; integrated: boolean };
export type Facts = { gpu: Gpu; ramGb: number; cores: number; mods: number; frameMs: number; renderer: "sodium" | "vulkanmod" | "nvidium"; shaders: boolean; allocatedMb: number; hudThrottle: boolean; inputSampling: boolean };

export function parseGpu(raw: string): Gpu {
  const s = raw.toLowerCase();
  const software = /swiftshader|llvmpipe|software|basic render/.test(s);
  const vendor: Gpu["vendor"] = software ? "software" : /nvidia|geforce|rtx|gtx|quadro/.test(s) ? "nvidia" : /amd|radeon/.test(s) ? "amd" : /intel/.test(s) ? "intel" : /apple/.test(s) ? "apple" : "other";
  const m = s.match(/(?:rtx|gtx)\s*(\d{3,4})/);
  const num = m ? parseInt(m[1], 10) : 0;
  // Turing = RTX 20xx / GTX 16xx and everything newer (RTX 30/40/50).
  const turing = /rtx/.test(s) || /gtx\s*16\d\d/.test(s);
  const integrated = vendor === "intel" ? !/arc\s*[ab]\d/.test(s) : vendor === "apple" || (vendor === "amd" && /graphics$|vega\s*\d+\b|radeon\(tm\) graphics/.test(s));
  return { vendor, name: raw, nvidiaGen: vendor === "nvidia" ? (turing || num >= 1600 ? "turing+" : "older") : undefined, vulkan12: vendor === "nvidia" || vendor === "amd" || (vendor === "intel" && !/hd graphics [2-5]\d\d\b/.test(s)), integrated };
}

export type Rec = { renderer: "sodium" | "vulkanmod" | "nvidium"; allowed: boolean; why: string };
/** One sentence per renderer. Never silently installs anything: the UI only shows this and asks. */
export function recommend(f: Facts): Rec[] {
  const g = f.gpu;
  const vk = !!g.vulkan12 && !f.shaders && g.vendor !== "software";
  const nv = g.vendor === "nvidia" && g.nvidiaGen === "turing+" && f.renderer !== "vulkanmod";
  return [
    { renderer: "sodium", allowed: true, why: "Baseline: works on every GPU and with shaders through Iris, at the cost of leaving the Vulkan and mesh-shader gains on the table." },
    { renderer: "vulkanmod", allowed: vk, why: vk ? "Replaces OpenGL with a Vulkan voxel renderer, typically the biggest win on CPU-bound machines, but it cannot run shader packs." : g.vendor === "software" ? "Needs a real Vulkan 1.2 GPU; this machine only reports a software renderer." : f.shaders ? "Disabled because a shader pack is active and VulkanMod cannot run shaders." : "Disabled because this GPU does not report Vulkan 1.2." },
    { renderer: "nvidium", allowed: nv, why: nv ? "Uses mesh shaders on top of Sodium for faster chunk culling and drawing on your Turing-or-newer NVIDIA GPU, but it conflicts with some shader setups." : g.vendor === "nvidia" ? "Needs a Turing-or-newer GPU (RTX 20-series, GTX 16-series or later) and Sodium as the active renderer." : "Nvidium only works on Turing-or-newer NVIDIA GPUs." },
  ];
}

export type Tip = { id: string; severity: "high" | "med" | "low"; title: string; change: string; because: string };
/** "Why is my FPS low?": returns exactly one concrete change, the one with the largest expected effect. */
export function whyLow(f: Facts, targetMs = 8.3): Tip {
  const over = f.frameMs / targetMs;
  const tips: Tip[] = [];
  if (f.gpu.vendor === "software") tips.push({ id: "software", severity: "high", title: "No GPU is being used", change: "Update your graphics driver, then set Minecraft's Java process to your dedicated GPU in Windows Graphics settings.", because: `The renderer reports "${f.gpu.name}", a software rasteriser.` });
  if (f.ramGb && f.allocatedMb > f.ramGb * 1024 * 0.7) tips.push({ id: "ram-high", severity: "high", title: "Too much RAM allocated", change: `Lower allocated memory from ${f.allocatedMb} MB to ${Math.round((f.ramGb * 1024 * 0.4) / 512) * 512} MB.`, because: `You have ${f.ramGb} GB in total; over 70% allocated starves the OS and causes GC and swap stutter.` });
  if (f.allocatedMb < 3072 && f.mods > 40) tips.push({ id: "ram-low", severity: "med", title: "Not enough RAM for this mod list", change: "Raise allocated memory to 4096 MB.", because: `${f.mods} mods on ${f.allocatedMb} MB triggers frequent garbage collection.` });
  if (f.gpu.integrated && f.renderer === "sodium" && recommend(f)[1].allowed) tips.push({ id: "vk", severity: "med", title: "Try the Vulkan renderer", change: "Switch the renderer to VulkanMod and re-measure.", because: "Integrated GPUs are usually CPU-bound in vanilla's OpenGL path." });
  if (f.mods > 120) tips.push({ id: "mods", severity: "med", title: "Very large mod list", change: "Disable mods you do not use; start with the biggest ones in Instances, then Mods.", because: `${f.mods} mods lengthen every frame's CPU work and the startup time.` });
  if (!f.hudThrottle) tips.push({ id: "hud", severity: "low", title: "HUD renders every frame", change: "Turn on HUD throttling at 30 FPS.", because: "Unthrottled HUD and GUI drawing spends CPU on elements that rarely change." });
  if (!f.inputSampling) tips.push({ id: "input", severity: "low", title: "Input sampled at 20 TPS", change: "Turn on render-loop input sampling.", because: "Clicks between ticks are otherwise delayed up to 50 ms." });
  if (f.gpu.vendor === "nvidia" && f.gpu.nvidiaGen === "turing+" && f.renderer === "sodium" && over > 1.2) tips.push({ id: "nvidium", severity: "low", title: "Nvidium is available", change: "Enable Nvidium alongside Sodium.", because: "Your GPU supports mesh shaders." });
  const rank = { high: 0, med: 1, low: 2 } as const;
  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return tips[0] || { id: "ok", severity: "low", title: "Nothing stands out", change: "No change recommended.", because: `Frame time is ${f.frameMs.toFixed(1)} ms, ${over <= 1 ? "within" : "near"} the ${targetMs} ms target.` };
}

/** Raw input rate vs CPS processed by a frame-rate sampler (the ClickOptimizer / InputBooster pattern). */
export class ClickProbe {
  raw: number[] = []; processed: number[] = []; lat: number[] = []; private pending: number[] = [];
  down() { const t = performance.now(); this.raw.push(t); this.pending.push(t); }
  /** `sampling` true: consume clicks on this frame. false: only on a 20 TPS tick boundary (tick = true). */
  frame(sampling: boolean, tick: boolean) {
    const t = performance.now();
    if (sampling || tick) { for (const ts of this.pending) { this.processed.push(t); this.lat.push(t - ts); } this.pending = []; }
    const cut = t - 1000; this.raw = this.raw.filter((x) => x > cut); this.processed = this.processed.filter((x) => x > cut);
    if (this.lat.length > 64) this.lat = this.lat.slice(-64);
  }
  get rawCps() { return this.raw.length; } get cps() { return this.processed.length; }
  get avgLatencyMs() { return this.lat.length ? this.lat.reduce((a, b) => a + b, 0) / this.lat.length : 0; }
}
export const STAGES = ["JVM start", "Mod discovery", "Mixin apply", "Resource reload", "First frame"] as const;
