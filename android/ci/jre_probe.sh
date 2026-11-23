#!/usr/bin/env bash
# Engine proof, stage 1b: do Android-native Java 21 and 25 boot on the emulator? Runs inside android-emulator-runner.
set -u
OUT="${1:?dir with jre21/ and jre25/}"; rc=0
adb wait-for-device
echo "== device abi: $(adb shell getprop ro.product.cpu.abi) sdk: $(adb shell getprop ro.build.version.sdk)"
cat > /tmp/Hello.java <<'J'
public class Hello { public static void main(String[] a){ System.out.println("LUMINOS_JVM_OK java=" + System.getProperty("java.version") + " arch=" + System.getProperty("os.arch") + " cpus=" + Runtime.getRuntime().availableProcessors() + " maxHeapMB=" + Runtime.getRuntime().maxMemory()/1048576); } }
J
for v in 21 25; do
  D=/data/local/tmp/jvm$v
  echo "== push java $v ($(du -sm "$OUT/$v" | cut -f1) MiB)"
  adb shell "rm -rf $D"; adb push "$OUT/$v" $D >/dev/null || { echo "PUSH FAILED $v"; rc=1; continue; }
  adb push /tmp/Hello.java $D/Hello.java >/dev/null; adb shell "chmod -R 755 $D"
  ENVV="export JAVA_HOME=$D/jre LD_LIBRARY_PATH=$D/lib:$D/jre/lib:$D/jre/lib/server:$D/jre/lib/jli"
  echo "== java $v -version";        adb shell "$ENVV; $D/jre/bin/java -version 2>&1; echo exit=\$?"
  echo "== java $v run Hello.java";  r=$(adb shell "$ENVV; cd $D; $D/jre/bin/java -Xmx256m Hello.java 2>&1; echo exit=\$?"); echo "$r"
  echo "$r" | grep -q "LUMINOS_JVM_OK java=$v" && echo "JAVA_${v}_OK" || { echo "JAVA_${v}_FAIL"; rc=1; }
done
exit $rc
