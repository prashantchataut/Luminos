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
