#!/usr/bin/env bash
# Installs the APK on the emulator, drives the REAL app (same code paths a user takes) and captures screenshots.
# Fails when the app crashes, does not open, or the in-app JVM boot check does not pass.
set -u
APK="${1:?apk path}"; OUT="${2:-android/ci/shots}"; PKG=app.luminos.mobile
mkdir -p "$OUT"
shot() { sleep "${2:-2}"; adb exec-out screencap -p > "$OUT/$1.png"; echo "shot $1 $(stat -c%s "$OUT/$1.png") bytes"; }
start() { adb shell am start -n "$PKG/.MainActivity" "$@" >/dev/null; }
adb wait-for-device
echo "== device abi=$(adb shell getprop ro.product.cpu.abi) sdk=$(adb shell getprop ro.build.version.sdk)"
adb shell settings put global window_animation_scale 0; adb shell settings put global transition_animation_scale 0
adb install -r "$APK" || { echo "INSTALL FAILED"; exit 1; }
adb logcat -c
start; shot 01-onboarding-welcome 9
start --ei lx_step 1; shot 02-onboarding-account 2
start --ei lx_step 2; shot 03-onboarding-device 3
echo "== real onboarding + real engine install (JRE download, SHA-256, unpack, boot java)"
start --es lx_autotest jeb_ --ez lx_engine true
status=timeout
for i in $(seq 1 90); do
  sleep 4
  if adb logcat -d -s Luminos:I | grep -q LUMINOS_ENGINE_OK; then status=ok; break; fi
  if adb logcat -d -s Luminos:I Luminos:E | grep -q LUMINOS_ENGINE_FAIL; then status=fail; break; fi
done
echo "== engine status: $status"; adb logcat -d -s Luminos:I Luminos:W Luminos:E | tail -40
start --es lx_tab home;     shot 04-home 4
start --es lx_tab library;  shot 05-library 3
start --es lx_tab skins;    shot 06-skins 5
start --es lx_tab skins;    shot 06b-skins-turned 3
start --es lx_tab settings; shot 07-settings 3
echo "== crash check"
if adb logcat -d | grep -q "FATAL EXCEPTION"; then echo "APP CRASHED"; adb logcat -d | grep -A25 "FATAL EXCEPTION" | head -60; exit 1; fi
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -2
[ "$status" = ok ] || { echo "ENGINE CHECK DID NOT PASS ($status)"; exit 1; }
echo "ANDROID_E2E_OK"
