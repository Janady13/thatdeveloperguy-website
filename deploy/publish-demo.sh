#!/usr/bin/env bash
# Publish dist/site to the Bubbles demo host (https://tdg.thatwebhostingguy.com/) with its own nginx server block.
#   npm run build:demo && npm run publish:demo
# Reads BUBBLES_SUDO_PW from private/deploy.env (git-ignored). Never prints it.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:-user@100.90.97.104}"
IDENTITY="${DEPLOY_IDENTITY:-}"
NAME="${DEMO_NAME:-tdg}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || { echo "bad demo name"; exit 1; }
[ -f dist/site/index.html ] || { echo "no release — run npm run build:demo"; exit 1; }
[ -f dist/deployment/site.conf ] || { echo "no host config — run npm run build:demo"; exit 1; }
[ -f private/deploy.env ] && source private/deploy.env
: "${BUBBLES_SUDO_PW:?set BUBBLES_SUDO_PW in private/deploy.env}"
TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="/tmp/tdg-demo-$TS.tgz"
trap 'rm -f "$ARCHIVE"' EXIT
SSH_CLIENT=(ssh)
SCP_CLIENT=(scp)
SSH_ARGS=(-o BatchMode=yes)
if [ "${DEPLOY_PASSWORD_AUTH:-off}" = "on" ]; then
  export SSHPASS="${BUBBLES_SSH_PW:-$BUBBLES_SUDO_PW}"
  SSH_CLIENT=(sshpass -e ssh)
  SCP_CLIENT=(sshpass -e scp)
  SSH_ARGS=(-o BatchMode=no -o PreferredAuthentications=password -o PubkeyAuthentication=no)
fi
if [ -n "$IDENTITY" ]; then
  [ -f "$IDENTITY" ] || { echo "missing deploy identity: $IDENTITY"; exit 1; }
  SSH_ARGS+=(-i "$IDENTITY" -o IdentitiesOnly=yes)
fi
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$ARCHIVE" -C dist/site .
"${SCP_CLIENT[@]}" -q "${SSH_ARGS[@]}" "$ARCHIVE" dist/deployment/site.conf dist/deployment/csp.conf "$HOST:/tmp/"
"${SSH_CLIENT[@]}" "${SSH_ARGS[@]}" "$HOST" "BUBBLES_SUDO_PW='$BUBBLES_SUDO_PW' bash -s -- '$NAME' '$TS'" <<'REMOTE'
set -euo pipefail
NAME="$1"; TS="$2"; ROOT="/var/www/sites/$NAME"; BACKUP="/var/backups/$NAME-demo-$TS.tgz"
SITE_CONFIG="/etc/nginx/sites-available/tdg-demo.thatwebhostingguy"; CSP_CONFIG="/etc/nginx/snippets/tdg-demo-csp.conf"
S() { echo "$BUBBLES_SUDO_PW" | sudo -S -p '' "$@"; }
S rm -rf "$ROOT.new" && S mkdir -p "$ROOT.new" && S tar xzf "/tmp/tdg-demo-$TS.tgz" -C "$ROOT.new" && S chown -R www-data:www-data "$ROOT.new"
S mkdir -p /var/backups
if [ -d "$ROOT" ]; then S tar -czf "$BACKUP" -C "$(dirname "$ROOT")" "$(basename "$ROOT")"; fi
if [ -f "$SITE_CONFIG" ]; then S cp "$SITE_CONFIG" "$SITE_CONFIG.prev"; fi
if [ -f "$CSP_CONFIG" ]; then S cp "$CSP_CONFIG" "$CSP_CONFIG.prev"; fi
S cp /tmp/csp.conf "$CSP_CONFIG"
S cp /tmp/site.conf "$SITE_CONFIG"
S ln -sfn "$SITE_CONFIG" /etc/nginx/sites-enabled/tdg-demo.thatwebhostingguy
if ! S nginx -t; then
  [ -f "$SITE_CONFIG.prev" ] && S cp "$SITE_CONFIG.prev" "$SITE_CONFIG"
  [ -f "$CSP_CONFIG.prev" ] && S cp "$CSP_CONFIG.prev" "$CSP_CONFIG"
  S rm -rf "$ROOT.new"
  echo "nginx config rejected; previous release preserved"
  exit 1
fi
S rm -rf "$ROOT.prev"; if [ -d "$ROOT" ]; then S mv "$ROOT" "$ROOT.prev"; fi; S mv "$ROOT.new" "$ROOT"
if ! S systemctl reload nginx; then
  S rm -rf "$ROOT.failed"; S mv "$ROOT" "$ROOT.failed"; S mv "$ROOT.prev" "$ROOT"
  [ -f "$SITE_CONFIG.prev" ] && S cp "$SITE_CONFIG.prev" "$SITE_CONFIG"
  [ -f "$CSP_CONFIG.prev" ] && S cp "$CSP_CONFIG.prev" "$CSP_CONFIG"
  S systemctl reload nginx
  echo "nginx reload failed; previous release restored"
  exit 1
fi
echo "nginx reloaded"
rm -f "/tmp/tdg-demo-$TS.tgz" /tmp/site.conf /tmp/csp.conf
echo "root: $ROOT ($(find "$ROOT" -type f | wc -l) files)"
echo "backup: $BACKUP"
REMOTE
echo "https://$NAME.thatwebhostingguy.com/"
