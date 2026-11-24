#!/usr/bin/env bash
# Runs the real Luminos Client (Loom runClient, software OpenGL, Xvfb) through the smoke tour and saves one 1920x1080 PNG per step.
# 1920x1080 at GUI scale 2 is the 960x540 layout drawn at 2x density. Usage: scripts/capture-client.sh <round> [client|client26]
# Needs: JAVA_HOME (JDK 25), xvfb, imagemagick. Output: docs/client-shots/rounds/<screen>-<round>.png and out/capture.log
set -u
ROUND="${1:-1}"; DIR="${2:-client}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/out-capture"; RUN="$ROOT/$DIR/run"
rm -rf "$OUT"; mkdir -p "$OUT" "$RUN" "$ROOT/docs/client-shots/rounds"
cat > "$RUN/options.txt" <<OPT
onboardAccessibility:false
enableVsync:false
maxFps:30
guiScale:2
overrideWidth:1920
overrideHeight:1080
fullscreen:false
skipMultiplayerWarning:true
tutorialStep:none
joinedFirstServer:true
narrator:0
OPT
pkill Xvfb 2>/dev/null; sleep 1
Xvfb :99 -ac -screen 0 1920x1080x24 +extension GLX +render -noreset > "$OUT/xvfb.log" 2>&1 &
sleep 2
export DISPLAY=:99 LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe MESA_GL_VERSION_OVERRIDE=4.6 MESA_GLSL_VERSION_OVERRIDE=460 vblank_mode=0
export LUMINOS_SMOKE=1 LUMINOS_SMOKE_ACK_DIR="$OUT" JAVA_TOOL_OPTIONS="-Xmx1000m"
: > "$OUT/run.log"; : > "$OUT/capture.log"
( for shot in $(cat "$ROOT/scripts/client-shots.txt"); do
    if timeout 1500 bash -c "until grep -q '\[luminos\] shot $shot\$' '$OUT/run.log'; do sleep 0.5; done"; then
      sleep 7
      import -display :99 -window root "$ROOT/docs/client-shots/rounds/$shot-$ROUND.png" 2>> "$OUT/capture.log" && echo "captured $shot" >> "$OUT/capture.log" || echo "capture $shot FAILED" >> "$OUT/capture.log"
      touch "$OUT/ack-$shot"
    else echo "marker $shot never appeared" >> "$OUT/capture.log"; fi
  done ) &
cd "$ROOT/$DIR" && ./gradlew runClient --no-daemon -Dorg.gradle.jvmargs=-Xmx400m > "$OUT/run.log" 2>&1
sleep 3; cat "$OUT/capture.log"; echo "DONE round $ROUND" >> "$OUT/capture.log"
