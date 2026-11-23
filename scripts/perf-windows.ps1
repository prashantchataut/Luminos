# Installs the NSIS installer silently, launches the installed app and measures it. CI only.
# Output: perf/perf.json and perf/window.png
param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force perf | Out-Null
$size = (Get-Item $Installer).Length
$sw = [Diagnostics.Stopwatch]::StartNew()
Start-Process $Installer -ArgumentList "/S" -Wait
$installMs = $sw.ElapsedMilliseconds
$exe = Get-ChildItem "$env:LOCALAPPDATA\Luminos","$env:LOCALAPPDATA\Programs\Luminos" -Filter *.exe -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch "uninst" } | Select-Object -First 1
if (-not $exe) { throw "installed exe not found" }
$home_ = Join-Path $env:RUNNER_TEMP "luminos-perf-home"; New-Item -ItemType Directory -Force $home_ | Out-Null
$env:LUMINOS_HOME = $home_
$results = @()
foreach ($run in 1..3) {
  $f = Join-Path $env:RUNNER_TEMP "ready-$run.txt"; Remove-Item $f -ErrorAction SilentlyContinue
  $env:LUMINOS_PERF_FILE = $f
  $t = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process $exe.FullName -PassThru
  while (-not (Test-Path $f) -and $t.Elapsed.TotalSeconds -lt 30) { Start-Sleep -Milliseconds 10 }
  $wall = $t.ElapsedMilliseconds
  $inproc = if (Test-Path $f) { [int](Get-Content $f) } else { -1 }
  if ($run -eq 3) {
    Start-Sleep -Seconds 12   # idle
    $all = Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq $p.Id -or $_.ParentProcessId -eq $p.Id }
    # include grandchildren (WebView2 spawns a tree)
    $ids = @($p.Id); $grow = $true
    while ($grow) { $kids = Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ParentProcessId -and $ids -notcontains $_.ProcessId }; if ($kids) { $ids += $kids.ProcessId } else { $grow = $false } }
    $procs = $ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }
    $ws = [math]::Round((($procs | Measure-Object WorkingSet64 -Sum).Sum) / 1MB, 1)
    $priv = [math]::Round((($procs | Measure-Object PrivateMemorySize64 -Sum).Sum) / 1MB, 1)
    $count = ($procs | Measure-Object).Count
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $b = New-Object Drawing.Bitmap 1280, 800
    $g = [Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save("perf\window.png")
  }
  $results += [pscustomobject]@{ run = $run; wall_ms = $wall; in_process_ms = $inproc }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Get-Process msedgewebview2 -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
$out = [ordered]@{
  installer_bytes = $size; installer_mb = [math]::Round($size / 1MB, 2); silent_install_ms = $installMs
  exe = $exe.FullName; exe_mb = [math]::Round($exe.Length / 1MB, 2)
  cold_start_runs = $results
  idle_ws_mb = $ws; idle_private_mb = $priv; idle_process_count = $count
}
$out | ConvertTo-Json -Depth 4 | Set-Content perf\perf.json
Get-Content perf\perf.json
