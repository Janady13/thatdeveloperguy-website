#!/usr/bin/env bash
# Publish dist/site to the Bubbles demo host (https://tdg.thatwebhostingguy.com/) with its own nginx server block.
#   npm run build:demo && npm run publish:demo
# Reads BUBBLES_SUDO_PW from private/deploy.env (git-ignored). Never prints it.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-user@192.168.1.132}"
NAME="${DEMO_NAME:-tdg}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || { echo "bad demo name"; exit 1; }
[ -f dist/site/index.html ] || { echo "no release — run npm run build:demo"; exit 1; }
[ -f dist/deployment/site.conf ] || { echo "no host config — run npm run build:demo"; exit 1; }
[ -f private/deploy.env ] && source private/deploy.env
: "${BUBBLES_SUDO_PW:?set BUBBLES_SUDO_PW in private/deploy.env}"
TS="$(date +%Y%m%d-%H%M%S)"
tar czf "/tmp/tdg-demo-$TS.tgz" -C dist/site .
[ -f private/tdg-demo.htpasswd ] || { echo "no private/tdg-demo.htpasswd — staging access gate credential missing"; exit 1; }
scp -q "/tmp/tdg-demo-$TS.tgz" dist/deployment/site.conf dist/deployment/csp.conf private/tdg-demo.htpasswd "$HOST:/tmp/"
ssh "$HOST" "BUBBLES_SUDO_PW='$BUBBLES_SUDO_PW' bash -s -- '$NAME' '$TS'" <<'REMOTE'
set -euo pipefail
NAME="$1"; TS="$2"; ROOT="/var/www/sites/$NAME"
S() { echo "$BUBBLES_SUDO_PW" | sudo -S -p '' "$@"; }
S rm -rf "$ROOT.new" && S mkdir -p "$ROOT.new" && S tar xzf "/tmp/tdg-demo-$TS.tgz" -C "$ROOT.new" && S chown -R www-data:www-data "$ROOT.new"
S rm -rf "$ROOT.prev"; if [ -d "$ROOT" ]; then S mv "$ROOT" "$ROOT.prev"; fi; S mv "$ROOT.new" "$ROOT"
S cp /tmp/csp.conf /etc/nginx/snippets/tdg-demo-csp.conf
S install -m 640 -o root -g www-data /tmp/tdg-demo.htpasswd /etc/nginx/tdg-demo.htpasswd
S cp /tmp/site.conf /etc/nginx/sites-available/tdg-demo.thatwebhostingguy
S ln -sfn /etc/nginx/sites-available/tdg-demo.thatwebhostingguy /etc/nginx/sites-enabled/tdg-demo.thatwebhostingguy
if S nginx -t 2>&1 | tail -1 | grep -q successful; then S systemctl reload nginx; echo "nginx reloaded"; else S nginx -t; S rm -f /etc/nginx/sites-enabled/tdg-demo.thatwebhostingguy; echo "nginx config rejected; vhost NOT enabled"; exit 1; fi
rm -f "/tmp/tdg-demo-$TS.tgz" /tmp/site.conf /tmp/csp.conf /tmp/tdg-demo.htpasswd
echo "root: $ROOT ($(find "$ROOT" -type f | wc -l) files)"
REMOTE
rm -f "/tmp/tdg-demo-$TS.tgz"
echo "https://$NAME.thatwebhostingguy.com/"
