#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_NAME="homedash"
readonly APP_PORT="1910"
readonly APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
readonly UNIT_PATH="$UNIT_DIR/$APP_NAME.service"

fail() {
  printf 'homedash install failed: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 22 or newer is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
command -v systemctl >/dev/null 2>&1 || fail "systemd is required for the durable service."

readonly NODE_BIN="$(command -v node)"
readonly NODE_MAJOR="$($NODE_BIN -p 'Number(process.versions.node.split(".")[0])')"
((NODE_MAJOR >= 22)) || fail "Node.js 22 or newer is required; found $($NODE_BIN --version)."

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  umask 077
  cat >.env <<EOF
HOMEDASH_HOST=127.0.0.1
HOMEDASH_PORT=$APP_PORT

SNOWRAVEN_URL=${SNOWRAVEN_URL:-http://127.0.0.1:1620}
LLMDASH_URL=${LLMDASH_URL:-http://127.0.0.1:8787}

HOME_LATITUDE=
HOME_LONGITUDE=
HOME_LABEL=Home

WEATHER_UNIT=fahrenheit
EBIRD_RADIUS_KM=50
EBIRD_WINDOW_DAYS=14
EBIRD_TARGET_LIMIT=5
BOOKMARKS_PATH=./config/bookmarks.json
EOF
  printf 'Created private configuration at %s/.env.\n' "$APP_DIR"
else
  printf 'Preserving existing private configuration at %s/.env.\n' "$APP_DIR"
fi

if [[ ! -f config/bookmarks.json ]]; then
  install -m 600 config/bookmarks.example.json config/bookmarks.json
  printf 'Created bookmarks at %s/config/bookmarks.json.\n' "$APP_DIR"
else
  printf 'Preserving existing bookmarks at %s/config/bookmarks.json.\n' "$APP_DIR"
fi

chmod 600 .env config/bookmarks.json

printf 'Installing exact dependencies, running checks, and building production assets…\n'
npm ci
npm run check
npm prune --omit=dev

mkdir -p "$UNIT_DIR"
cat >"$UNIT_PATH" <<EOF
[Unit]
Description=Private homedash start page
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=$NODE_BIN $APP_DIR/dist-server/server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictSUIDSGID=true
LockPersonality=true
UMask=0077

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$APP_NAME.service"
systemctl --user restart "$APP_NAME.service"

if command -v loginctl >/dev/null 2>&1; then
  if [[ "$(loginctl show-user "$USER" --property=Linger --value 2>/dev/null || true)" != "yes" ]]; then
    printf 'Enabling the user service to survive SSH logout; sudo may ask for your password.\n'
    sudo loginctl enable-linger "$USER"
  fi
fi

for _ in {1..20}; do
  if "$NODE_BIN" -e "fetch('http://127.0.0.1:$APP_PORT/healthz').then(r => r.json()).then(v => process.exit(v.ok && v.service === 'homedash' ? 0 : 1)).catch(() => process.exit(1))"; then
    break
  fi
  sleep 1
done

"$NODE_BIN" -e "fetch('http://127.0.0.1:$APP_PORT/healthz').then(r => r.json()).then(v => process.exit(v.ok && v.service === 'homedash' ? 0 : 1)).catch(() => process.exit(1))" || {
  systemctl --user status "$APP_NAME.service" --no-pager >&2 || true
  fail "the service did not pass its health check."
}

if command -v tailscale >/dev/null 2>&1; then
  if ! tailscale serve --bg --https "$APP_PORT" "http://127.0.0.1:$APP_PORT"; then
    printf 'Configuring the dedicated Tailscale HTTPS listener; sudo may ask for your password.\n'
    sudo tailscale serve --bg --https "$APP_PORT" "http://127.0.0.1:$APP_PORT"
  fi
else
  printf 'Tailscale is not installed; homedash is healthy on loopback but has no tailnet URL.\n' >&2
fi

printf '\nhomedash is installed and healthy.\n'
printf 'Private settings: %s/.env\n' "$APP_DIR"
printf 'Bookmarks: %s/config/bookmarks.json\n' "$APP_DIR"
printf 'Future updates use the same one-line command.\n'
