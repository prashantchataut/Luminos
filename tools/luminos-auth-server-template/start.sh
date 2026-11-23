#!/usr/bin/env bash
# Start a Paper/Vanilla server that trusts a luminos-auth instance.
# Usage: AUTH_URL=https://auth.example.org ./start.sh
set -euo pipefail
: "${AUTH_URL:?set AUTH_URL to your luminos-auth public URL}"
INJ=authlib-injector-1.2.8.jar
SUM=9c7f4343e6c82034958ffb48c14a2cb0c85928be7283103ce17da00c6d5a7b10
if [ ! -f "$INJ" ]; then
  curl -fsSL -o "$INJ" "https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.8/$INJ"
fi
echo "$SUM  $INJ" | sha256sum -c -
grep -q '^online-mode=true' server.properties 2>/dev/null || echo "NOTE: keep online-mode=true; authlib-injector redirects the check to $AUTH_URL"
exec java -Xmx2G -javaagent:"$INJ"="$AUTH_URL" -jar "${SERVER_JAR:-server.jar}" nogui
