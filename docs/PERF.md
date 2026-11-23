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
