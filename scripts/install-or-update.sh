#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_NAME="homedash"
readonly APP_PORT="1910"
readonly APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
readonly UNIT_PATH="$UNIT_DIR/$APP_NAME.service"
readonly MANAGED_NODE_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/homedash/node"
readonly STATE_ROOT="${XDG_STATE_HOME:-$HOME/.local/state}"
readonly BOOKMARK_STATE_DIR="$STATE_ROOT/homedash/bookmarks"

fail() {
  printf 'homedash install failed: %s\n' "$*" >&2
  exit 1
}

command -v systemctl >/dev/null 2>&1 || fail "systemd is required for the durable service."

resolve_node() {
  local node_bin=""
  local node_major="0"

  if command -v node >/dev/null 2>&1; then
    node_bin="$(command -v node)"
    node_major="$($node_bin -p 'Number(process.versions.node.split(".")[0])')"
  fi

  if ((node_major >= 22)); then
    NODE_BIN="$node_bin"
    return
  fi

  if [[ -x "$MANAGED_NODE_ROOT/current/bin/node" ]]; then
    node_major="$("$MANAGED_NODE_ROOT/current/bin/node" -p 'Number(process.versions.node.split(".")[0])')"
    if ((node_major >= 22)); then
      NODE_BIN="$MANAGED_NODE_ROOT/current/bin/node"
      return
    fi
  fi

  command -v curl >/dev/null 2>&1 || fail "curl is required to install homedash's private Node.js runtime."
  command -v tar >/dev/null 2>&1 || fail "tar is required to install homedash's private Node.js runtime."

  local platform=""
  case "$(uname -s)" in
    Linux) platform="linux" ;;
    Darwin) platform="darwin" ;;
    *) fail "automatic Node.js setup does not support $(uname -s)." ;;
  esac

  local architecture=""
  case "$(uname -m)" in
    aarch64 | arm64) architecture="arm64" ;;
    armv7l) architecture="armv7l" ;;
    x86_64 | amd64) architecture="x64" ;;
    *) fail "automatic Node.js setup does not support $(uname -m)." ;;
  esac

  printf 'Node.js 22+ is not available; installing an isolated runtime for homedash.\n'

  local temporary_dir=""
  temporary_dir="$(mktemp -d)"
  trap 'rm -rf "$temporary_dir"' EXIT

  local release_url="https://nodejs.org/dist/latest-v22.x"
  local checksums="$temporary_dir/SHASUMS256.txt"
  curl -fsSL "$release_url/SHASUMS256.txt" -o "$checksums"

  local archive=""
  archive="$(awk -v suffix="$platform-$architecture.tar.gz" '$2 ~ suffix "$" { print $2; exit }' "$checksums")"
  [[ -n "$archive" ]] || fail "Node.js does not publish a v22 runtime for $platform-$architecture."

  local expected_checksum=""
  expected_checksum="$(awk -v archive="$archive" '$2 == archive { print $1; exit }' "$checksums")"
  [[ -n "$expected_checksum" ]] || fail "the Node.js checksum could not be found."

  curl -fsSL "$release_url/$archive" -o "$temporary_dir/$archive"

  local actual_checksum=""
  if command -v sha256sum >/dev/null 2>&1; then
    actual_checksum="$(sha256sum "$temporary_dir/$archive" | awk '{ print $1 }')"
  elif command -v shasum >/dev/null 2>&1; then
    actual_checksum="$(shasum -a 256 "$temporary_dir/$archive" | awk '{ print $1 }')"
  else
    fail "sha256sum or shasum is required to verify the Node.js download."
  fi
  [[ "$actual_checksum" == "$expected_checksum" ]] || fail "the Node.js download failed checksum verification."

  mkdir -p "$temporary_dir/extracted" "$MANAGED_NODE_ROOT"
  tar -xzf "$temporary_dir/$archive" -C "$temporary_dir/extracted"

  local extracted_name="${archive%.tar.gz}"
  local installed_dir="$MANAGED_NODE_ROOT/$extracted_name"
  if [[ ! -d "$installed_dir" ]]; then
    mv "$temporary_dir/extracted/$extracted_name" "$installed_dir"
  fi
  if [[ -e "$MANAGED_NODE_ROOT/current" && ! -L "$MANAGED_NODE_ROOT/current" ]]; then
    fail "$MANAGED_NODE_ROOT/current exists but is not a managed runtime link."
  fi
  ln -sfn "$installed_dir" "$MANAGED_NODE_ROOT/current"

  NODE_BIN="$MANAGED_NODE_ROOT/current/bin/node"
  rm -rf "$temporary_dir"
  trap - EXIT
}

NODE_BIN=""
resolve_node
readonly NODE_BIN
readonly NODE_BIN_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_BIN_DIR:$PATH"

command -v npm >/dev/null 2>&1 || fail "npm is missing from the selected Node.js runtime."
readonly NPM_BIN="$(command -v npm)"

printf 'Using Node.js %s for homedash at %s.\n' "$($NODE_BIN --version)" "$NODE_BIN"

cd "$APP_DIR"

TAILSCALE_ORIGIN=""
if command -v tailscale >/dev/null 2>&1; then
  TAILSCALE_DNS_NAME="$(tailscale status --json 2>/dev/null | "$NODE_BIN" --input-type=module -e '
    let source = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { source += chunk; });
    process.stdin.on("end", () => {
      try {
        const dnsName = JSON.parse(source).Self?.DNSName;
        if (typeof dnsName === "string" && /^[a-z0-9.-]+\.$/i.test(dnsName)) {
          process.stdout.write(dnsName.slice(0, -1).toLowerCase());
        }
      } catch {}
    });
  ' || true)"
  if [[ -n "$TAILSCALE_DNS_NAME" ]]; then
    TAILSCALE_ORIGIN=",https://$TAILSCALE_DNS_NAME:$APP_PORT"
  fi
fi
readonly TAILSCALE_ORIGIN
readonly DEFAULT_ALLOWED_ORIGINS="http://127.0.0.1:$APP_PORT$TAILSCALE_ORIGIN"

if [[ ! -f .env ]]; then
  umask 077
  cat >.env <<EOF
HOMEDASH_HOST=127.0.0.1
HOMEDASH_PORT=$APP_PORT
HOMEDASH_ALLOWED_ORIGINS=$DEFAULT_ALLOWED_ORIGINS

SNOWRAVEN_URL=${SNOWRAVEN_URL:-http://127.0.0.1:1620}
LLMDASH_URL=${LLMDASH_URL:-http://127.0.0.1:8787}
LLMDASH_LAUNCH_URL=${LLMDASH_LAUNCH_URL:-}
TIDE_STATION_ID=${TIDE_STATION_ID:-}
TIDE_STATION_LABEL=${TIDE_STATION_LABEL:-Local tide}

HOME_LATITUDE=
HOME_LONGITUDE=
HOME_LABEL=Home

WEATHER_UNIT=fahrenheit
EBIRD_RADIUS_KM=50
EBIRD_WINDOW_DAYS=14
EBIRD_TARGET_LIMIT=5
BOOKMARKS_PATH=$BOOKMARK_STATE_DIR/bookmarks.json
EOF
  printf 'Created private configuration at %s/.env.\n' "$APP_DIR"
else
  printf 'Preserving existing private configuration at %s/.env.\n' "$APP_DIR"
  if ! grep -Eq '^[[:space:]]*HOMEDASH_ALLOWED_ORIGINS=' .env; then
    printf '\nHOMEDASH_ALLOWED_ORIGINS=%s\n' "$DEFAULT_ALLOWED_ORIGINS" >>.env
    printf 'Added exact loopback and installed Tailscale origins to private configuration.\n'
  fi
  if ! grep -Eq '^[[:space:]]*TIDE_STATION_ID=' .env; then
    printf '\nTIDE_STATION_ID=\n' >>.env
    printf 'Added an optional private tide-station placeholder.\n'
  fi
  if ! grep -Eq '^[[:space:]]*TIDE_STATION_LABEL=' .env; then
    printf 'TIDE_STATION_LABEL=Local tide\n' >>.env
  fi
fi

BOOKMARKS_FILE="$($NODE_BIN --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { isAbsolute, resolve } from "node:path";
  import { parseEnv } from "node:util";

  const configured = parseEnv(readFileSync(".env", "utf8")).BOOKMARKS_PATH;
  if (!configured || configured.includes("\0") || configured.includes("\n") || configured.includes("\r")) {
    process.exit(1);
  }
  process.stdout.write(isAbsolute(configured) ? resolve(configured) : resolve(process.cwd(), configured));
')" || fail "BOOKMARKS_PATH in .env must be a valid non-empty path."
readonly BOOKMARKS_FILE
readonly BOOKMARKS_PARENT="$(dirname "$BOOKMARKS_FILE")"

"$NODE_BIN" scripts/validate-bookmark-path.mjs \
  "$APP_DIR" "$HOME" "$UNIT_DIR" "$STATE_ROOT" "$BOOKMARKS_FILE" ||
  fail "BOOKMARKS_PATH must use a dedicated, non-sensitive state directory."

if [[ ! -e "$BOOKMARKS_FILE" ]]; then
  install -d -m 700 "$BOOKMARKS_PARENT"
  install -m 600 config/bookmarks.example.json "$BOOKMARKS_FILE"
  printf 'Created bookmarks at %s.\n' "$BOOKMARKS_FILE"
elif [[ -f "$BOOKMARKS_FILE" && ! -L "$BOOKMARKS_FILE" ]]; then
  printf 'Preserving existing bookmarks at %s.\n' "$BOOKMARKS_FILE"
else
  fail "BOOKMARKS_PATH must select a regular, non-symlink file."
fi

chmod 600 .env "$BOOKMARKS_FILE"
if [[ "$BOOKMARKS_FILE" != "$APP_DIR/config/bookmarks.json" ]]; then
  chmod 700 "$BOOKMARKS_PARENT"
fi

SYSTEMD_BOOKMARKS_PARENT="${BOOKMARKS_PARENT//\\/\\\\}"
SYSTEMD_BOOKMARKS_PARENT="${SYSTEMD_BOOKMARKS_PARENT//\"/\\\"}"
SYSTEMD_BOOKMARKS_PARENT="${SYSTEMD_BOOKMARKS_PARENT//%/%%}"
readonly SYSTEMD_BOOKMARKS_PARENT

printf 'Installing exact dependencies, running checks, and building production assets…\n'
"$NPM_BIN" ci
"$NPM_BIN" run check
"$NPM_BIN" prune --omit=dev

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
ReadWritePaths="$SYSTEMD_BOOKMARKS_PARENT"
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
printf 'Bookmarks: %s\n' "$BOOKMARKS_FILE"
printf 'Future updates use the same one-line command.\n'
