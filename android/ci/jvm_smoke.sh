#!/usr/bin/env bash
# Engine proof, stage 1: does an OpenJDK built for Android boot on the emulator?
# Runs inside reactivecircus/android-emulator-runner. Everything is printed so the CI log is the evidence.
set -u
JRE_TAR="${1:?jre tarball}"
W=/tmp/jre; rm -rf "$W"; mkdir -p "$W"
tar -xJf "$JRE_TAR" -C "$W"
echo "== host layout"; (cd "$W" && ls && ls bin | head -20 && find . -name 'libjvm.so' -o -name 'libjli.so' | head)
adb wait-for-device
echo "== device abi: $(adb shell getprop ro.product.cpu.abi) sdk: $(adb shell getprop ro.build.version.sdk)"
adb shell 'rm -rf /data/local/tmp/jre'
adb push "$W" /data/local/tmp/jre >/dev/null
adb shell 'chmod -R 755 /data/local/tmp/jre'
LIBS='/data/local/tmp/jre/lib:/data/local/tmp/jre/lib/jli:/data/local/tmp/jre/lib/server'
run() { echo "== $*"; adb shell "cd /data/local/tmp/jre && export JAVA_HOME=/data/local/tmp/jre LD_LIBRARY_PATH=$LIBS && $*"; echo "exit=$?"; }
run './bin/java -version'
run './bin/java -Xshare:off -Xint -version'
run './bin/java -XshowSettings:vm -Xmx256m -version'
echo "== heap + hello"
adb shell 'mkdir -p /data/local/tmp/h'
cat > /tmp/Hello.java <<'J'
public class Hello { public static void main(String[] a){ System.out.println("LUMINOS_JVM_OK " + System.getProperty("java.version") + " " + System.getProperty("os.arch") + " procs=" + Runtime.getRuntime().availableProcessors()); } }
J
run 'ls bin; ls lib | head -40'
