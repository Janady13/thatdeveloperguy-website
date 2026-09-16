#!/usr/bin/env bash
# Release the inquiry service to Bubbles: /home/user/sites/tdg-api/releases/<ts> → current, systemd unit tdg-api on 127.0.0.1:3010.
#   npm run build:api && npm run publish:api
# The runtime.env is created ONCE on the host from the existing authorized SMTP configuration (values never pass through here)
# and is left alone on later releases. Reads BUBBLES_SUDO_PW from private/deploy.env. Never prints secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-user@192.168.1.132}"
PUBLIC_ORIGIN="${TDG_API_PUBLIC_ORIGIN:-https://tdg.thatwebhostingguy.com}"
[ -f dist/api/server.mjs ] || { echo "no bundle — run npm run build:api"; exit 1; }
[ -f private/deploy.env ] && source private/deploy.env
: "${BUBBLES_SUDO_PW:?set BUBBLES_SUDO_PW in private/deploy.env}"
TS="$(date +%Y%m%d-%H%M%S)"
scp -q dist/api/server.mjs dist/api/build-manifest.json deploy/systemd/tdg-api.service "$HOST:/tmp/"
ssh "$HOST" "BUBBLES_SUDO_PW='$BUBBLES_SUDO_PW' bash -s -- '$TS' '$PUBLIC_ORIGIN'" <<'REMOTE'
set -euo pipefail
TS="$1"; ORIGIN="$2"; ROOT="/home/user/sites/tdg-api"
S() { echo "$BUBBLES_SUDO_PW" | sudo -S -p '' "$@"; }
mkdir -p "$ROOT/releases/$TS"
mv /tmp/server.mjs /tmp/build-manifest.json "$ROOT/releases/$TS/"
if [ ! -f "$ROOT/runtime.env" ]; then
  SRC="$(ls -t /home/user/sites/thatstupidcomputer-runtime/shared/runtime-env/*.env | head -1)"
  { grep -E '^SMTP_(HOST|PORT|SECURE|USER|PASS|FROM|TO)=' "$SRC"; printf 'HOST=127.0.0.1\nPORT=3010\nNODE_ENV=production\nTRUST_PROXY=true\nPUBLIC_ORIGIN=%s\n' "$ORIGIN"; } > "$ROOT/runtime.env"
  chmod 600 "$ROOT/runtime.env"; echo "runtime.env created from the authorized SMTP configuration ($(grep -c . "$ROOT/runtime.env") lines)"
else
  echo "runtime.env kept"
fi
ln -sfn "$ROOT/releases/$TS" "$ROOT/current"
S cp /tmp/tdg-api.service /etc/systemd/system/tdg-api.service
S systemctl daemon-reload
S systemctl enable tdg-api >/dev/null 2>&1 || true
S systemctl restart tdg-api
sleep 2
S systemctl is-active tdg-api && curl -s -o /dev/null -w 'health HTTP %{http_code}\n' http://127.0.0.1:3010/api/health
ls -dt "$ROOT"/releases/* | tail -n +4 | xargs -r rm -rf
echo "release $TS active"
REMOTE
