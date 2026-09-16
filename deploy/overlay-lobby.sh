#!/usr/bin/env bash
# The approved lobby (rive/lobby/web) sits at the site root on the demo host, on top of a published release.
# publish-demo.sh replaces the whole root, so run this after every publish:  bash deploy/overlay-lobby.sh
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-user@192.168.1.132}"; ROOT="/var/www/sites/${DEMO_NAME:-tdg}"
[ -f private/deploy.env ] && source private/deploy.env
: "${BUBBLES_SUDO_PW:?set BUBBLES_SUDO_PW in private/deploy.env}"
RT="$(node -p "require('@rive-app/webgl2/package.json').version")"
T="$(mktemp -d)"; mkdir -p "$T/rive"
cp rive/lobby/web/index.html rive/lobby/web/lobby.js rive/lobby/build/lobby-2x.riv rive/lobby/build/lobby-4x.riv "$T/"
cp "node_modules/@rive-app/webgl2/rive.js" "$T/rive/rive-$RT.js"; cp "node_modules/@rive-app/webgl2/rive.wasm" "$T/rive/rive-$RT.wasm"
sed -i '' "s#/rive/rive-[0-9.]*\.js#/rive/rive-$RT.js#; s#/rive/rive-[0-9.]*\.wasm#/rive/rive-$RT.wasm#" "$T/index.html" "$T/lobby.js"
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/lobby-overlay.tgz -C "$T" . && rm -rf "$T"
scp -q /tmp/lobby-overlay.tgz "$HOST:/tmp/lobby-overlay.tgz"
ssh "$HOST" "echo '$BUBBLES_SUDO_PW' | sudo -S -p '' bash -c 'tar xzf /tmp/lobby-overlay.tgz -C $ROOT && chown -R www-data:www-data $ROOT && rm /tmp/lobby-overlay.tgz'"
rm -f /tmp/lobby-overlay.tgz; echo "lobby overlaid on $ROOT (runtime $RT)"
