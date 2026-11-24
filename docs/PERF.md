# Performance (measured on a GitHub `windows-latest` runner, clean machine, CI run for PR #11)

Method: `scripts/perf-windows.ps1` installs `Luminos-Setup.exe` silently (`/S`), launches the installed exe three times
with `LUMINOS_PERF_FILE` set, and waits for the frontend's first painted frame (`app_ready`, called after two
`requestAnimationFrame`s). Idle RAM is sampled 12 s after the third launch across the whole process tree
(Luminos + every `msedgewebview2` child). Raw output: `docs/perf/perf-run-1.json`; screenshot of the installed app: `docs/perf/windows-installed-app.png`.

| metric | target | measured | verdict |
|---|---|---|---|
| Installer size | < 15 MB | **2.25 MB** (2,360,717 bytes); installed exe 5.87 MB | met |
| Cold start, first launch ever on the machine | < 1 s | **6.7 s** to first paint | **missed** |
| Cold start, 2nd and 3rd launch | < 1 s | **0.53 s** and **0.41 s** to first paint | met |
| Idle RAM (7 processes: shell + WebView2) | recorded | **333 MB working set, 110 MB private** | recorded, not optimised |
| Silent install time | - | 0.94 s | - |

Reading it honestly:
- The first-launch 6.7 s is WebView2 creating its profile (and Defender scanning new files) on a fresh runner. I have not
  isolated how much of it is ours. A fresh install on a real PC will pay this once.
  Next step: show a native splash via `visible: false` + a Rust-side window show on `app_ready`, and set the WebView2 data
  folder explicitly so first-run cost is measurable on its own.
- Working set double-counts shared WebView2 pages; the private figure (110 MB) is the better "what does it cost me" number.
- One run per launch index, on a shared runner: treat as +/- 30 %. Not a lab benchmark.
- Not measured: the old egui build (not rebuilt this session), so there is no before/after comparison.

## Game gate (Fabric must accept the default preset)
`smoke.yml`, run 45203535259, offline account, software GL/Vulkan on Xvfb:
| Minecraft | title screen | incompatibilities | seconds | result |
|---|---|---|---|---|
| 26.3 | reached | none | 27 | pass |
| 1.21.11 | reached | none | 40 | pass |
Results: `docs/perf/smoke-*-result.json`; solver reports: `docs/perf/smoke-*-mod-report.json`.

---

## Client benchmark (session 13): what exists, and what has NOT been measured

**No before/after FPS numbers exist yet. The three-hardware table below is empty on purpose.** Nothing in this section
was measured, and no figure was estimated or carried over from another client's marketing.

### What was built and tested
| Piece | Path | Proof |
|---|---|---|
| Frame-time window: average FPS, 1% low (mean FPS of the slowest 1% of frames), p99 frame time; no allocation per sample | `client/src/shared/java/dev/luminos/client/core/FrameStats.java` | 7 assertions in `client/tests/CoreTests.java`, run in CI (`client.yml`, step "Core logic tests") |
| Before/after row writer for this file; can only print VERIFIED when told the numbers came from the named hardware | `core/BenchReport.java` | 4 assertions, same runner |
| Toggleable in-game overlay (frame time, avg, 1% low, p99, memory). Off by default; samples only while drawn; sorts at most twice a second | `ToolModules.PerfOverlay` | Compiles on 1.21.11 and 26.3 (CI). **Not seen running in a world.** Chunk-update and entity counts are not shown: they need per-version renderer accessors and were not attempted |

### What is missing (not built)
- The **fixed-scene benchmark runner** (load a seeded world, fly a fixed path, record, apply the profile, record again) in the
  client and a Benchmark button in the launcher. Without it, `BenchReport` has no producer.
- GPU detection, VulkanMod/Nvidium recommendation, and the dependency-graph solve from each jar's `fabric.mod.json` for
  the performance bundle. (The launcher's existing solver covers the default preset; extending it to the full bundle was not done.)
- HUD caching, per-hardware JVM presets, per-version bundles beyond the two built lines (26.3, 1.21.11).

### Hardware table (to be filled by `BenchReport.row(...)`)
| Hardware | Avg FPS before | Avg FPS after | Change | 1% low before | 1% low after | Status |
|---|---|---|---|---|---|---|
| Low-end integrated | - | - | - | - | - | NOT RUN: no such machine in this session or in CI |
| Mid-range | - | - | - | - | - | NOT RUN |
| High-end | - | - | - | - | - | NOT RUN |
| GitHub `ubuntu-latest`, llvmpipe (software GL) | - | - | - | - | - | NOT RUN: would measure the CPU rasteriser, not any real GPU, so it must not be quoted as client performance |

Why CI cannot fill this in: GitHub-hosted runners have no GPU. llvmpipe numbers say nothing about Sodium or the other mods,
whose gains come from GPU draw-call and memory behaviour. The honest route is a self-hosted runner or a volunteer with
three machines running the benchmark once it exists (manual script: `docs/client-shots/README.md`, "Manual tests").


## Session 14: what was built, and what is NOT measured

**No performance number in this section was measured on real hardware.** CI and this sandbox only have software GL (llvmpipe) and 2 CPU cores, which says nothing about Sodium, VulkanMod or Nvidium. Every number row below is therefore UNVERIFIED, and none is claimed.

| Claim in the brief | Status | What exists |
|---|---|---|
| Client reaches the title screen in under 60% of a Sodium-only Fabric instance | **UNVERIFIED** | `StartupProbe` logs `jvm->init`, `init->title`, `total` in one line (`[luminos] startup ...`) and the Performance tab shows it with Developer tools on. No baseline instance was timed, so no ratio exists. The Luminos mod itself does one config read and registers events in `onInitializeClient`; the 60% target depends on the launcher's mixin and metadata caching, which was **not built** |
| Parallel mod discovery, mixin cache, skipped resource reloads | **NOT BUILT** | These live in the launcher/engine, which this session was told not to touch |
| FPS: Sodium vs Luminos profile vs VulkanMod/Nvidium on integrated / mid-range / high-end | **UNVERIFIED, no data** | Renderer picker states the *community* figure (about 1.8x Sodium at 16 chunks, 1538 vs 861 FPS on 1.21.11); that is quoted, not measured here |
| Render-loop input sampling | **BUILT, behaviour in a world UNVERIFIED** | `InputSampler`: drains attack/use press counts every frame and runs `Minecraft.startAttack/startUseItem` (access widener, no mixin). Compiles on 1.21.11 and 26.3 and launches; **never exercised with a real mouse in a world** |
| Input latency before/after | **UNVERIFIED** | `core/ClickStats` measures, from real timestamps, how long a press waits for the next tick vs the next frame. The Click test card shows it live. By construction vanilla waits 0-50 ms (25 ms mean) and sampling waits at most one frame; no real-device capture is recorded |
| Frame-queue guard (Reflex-style) | **BUILT, off by default, UNVERIFIED** | A GL fence is dropped after each frame; the next frame waits for it for at most `frame_guard.max` ms only if the GPU has not finished. Costs nothing when CPU-bound. OpenGL only; never measured |
| InputBooster-class tap latching | **BUILT, UNVERIFIED** | A sprint or jump tap shorter than a tick is held for exactly one tick |
| Exordium-style HUD at a lower rate | **PARTIAL** | `HudModule.cached` recomputes HUD *data* at a fixed rate (default 30 Hz). It does not cache pixels (that needs a render-target mixin) |
| Renderer picker | **BUILT, VERIFIED (logic + render)** | `core/RendererAdvisor`, 14 assertions; Performance tab. Never installs anything |
| Drop mods that conflict with the chosen renderer | **NOT BUILT** | Needs the launcher's dependency solver |
| "Why is my FPS low?" | **BUILT, VERIFIED** | `core/FpsDoctor` (8 assertions). In the real client it read the 1000 MB heap used for the capture and said to raise RAM (`docs/client-shots/rounds/panel-performance-*.png`) |

Reproduce a startup number: launch twice (Luminos jar alone, then the same jar plus Sodium) and compare the `[luminos] startup ... total` lines in `logs/latest.log`.
