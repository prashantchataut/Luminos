#!/usr/bin/env bash
# Boots a real vanilla Minecraft server (from Mojang's own manifest) in offline and online mode and checks that
# Luminos' login probe reports the right thing for each. Needs: java on PATH (matching the version), python3, curl, cargo.
# Usage: tools/ci/server-login-test.sh <minecraft-version> [heap-MB]
set -euo pipefail
MC="${1:?minecraft version, e.g. 1.21.4}"
HEAP="${2:-512}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${WORK:-$(mktemp -d)}"
PORT=25599
mkdir -p "$WORK"; cd "$WORK"

if [ ! -f server.jar ]; then
  echo "== resolving server.jar for $MC from Mojang"
  URL=$(python3 - "$MC" <<'EOF'
import json, sys, urllib.request
mc = sys.argv[1]
m = json.load(urllib.request.urlopen("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"))
v = next(x for x in m["versions"] if x["id"] == mc)
j = json.load(urllib.request.urlopen(v["url"]))
print(j["downloads"]["server"]["url"])
EOF
)
  curl -sSL "$URL" -o server.jar
fi
echo "eula=true" > eula.txt

run_mode () {
  local ONLINE="$1" EXPECT="$2"
  cat > server.properties <<EOF
online-mode=$ONLINE
server-port=$PORT
server-ip=127.0.0.1
level-type=minecraft\:flat
generate-structures=false
view-distance=2
simulation-distance=2
spawn-protection=0
enable-rcon=false
motd=Luminos login test
EOF
  rm -rf world
  echo "== starting server (online-mode=$ONLINE)"
  java -Xmx${HEAP}M -jar server.jar nogui > "server-$ONLINE.log" 2>&1 &
  local PID=$!
  for i in $(seq 1 240); do
    if grep -q 'Done (' "server-$ONLINE.log" 2>/dev/null; then break; fi
    if ! kill -0 $PID 2>/dev/null; then echo "server died"; tail -30 "server-$ONLINE.log"; exit 1; fi
    sleep 1
  done
  grep -q 'Done (' "server-$ONLINE.log" || { echo "server never finished starting"; tail -30 "server-$ONLINE.log"; kill $PID; exit 1; }
  (cd "$ROOT/launcher" && LUMINOS_TEST_SERVER=127.0.0.1:$PORT LUMINOS_TEST_EXPECT=$EXPECT \
     cargo test -p luminos-core --test live_server -- --ignored --nocapture) || { kill $PID; exit 1; }
  if [ "$EXPECT" = offline ]; then
    # The offline login must show up in the SERVER's own log: proof the server really accepted the player.
    sleep 1
    grep -E 'LuminosTest \(/127.0.0.1:[0-9]+\) lost connection' "server-$ONLINE.log" | head -1 \
      || { echo "server log has no connection for the probe player"; exit 1; }
  fi
  kill $PID; wait $PID 2>/dev/null || true
}

run_mode false offline
run_mode true online
echo "PASS: $MC offline-mode accepted the probe; online-mode demanded a session"
