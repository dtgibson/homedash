#!/usr/bin/env bash
# Public bootstrap for first installs and later updates:
#   curl -fsSL https://raw.githubusercontent.com/dtgibson/homedash/main/scripts/bootstrap.sh | bash

set -Eeuo pipefail

readonly HOMEDASH_REPO="https://github.com/dtgibson/homedash.git"
readonly HOMEDASH_DIR="${HOMEDASH_DIR:-$HOME/homedash}"
readonly HOMEDASH_PORT="1910"
readonly UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
readonly UNIT_PATH="$UNIT_DIR/homedash.service"
readonly MANAGED_RUNTIME_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/homedash"

fail() {
  printf 'homedash bootstrap failed: %s\n' "$*" >&2
  exit 1
}

uninstall_homedash() {
  case "$HOMEDASH_DIR" in
    "" | / | "$HOME") fail "refusing to remove the unsafe path $HOMEDASH_DIR." ;;
  esac

  if [[ -e "$HOMEDASH_DIR" ]]; then
    [[ -f "$HOMEDASH_DIR/package.json" ]] || fail "$HOMEDASH_DIR does not look like a homedash installation."
    grep -Eq '"name"[[:space:]]*:[[:space:]]*"homedash"' "$HOMEDASH_DIR/package.json" ||
      fail "$HOMEDASH_DIR does not look like a homedash installation."
  fi

  local backup_dir=""
  if [[ -f "$HOMEDASH_DIR/.env" || -f "$HOMEDASH_DIR/config/bookmarks.json" ]]; then
    backup_dir="${HOMEDASH_BACKUP_DIR:-$HOME/homedash-uninstall-backup-$(date +%Y%m%d-%H%M%S)}"
    mkdir -p "$backup_dir"
    if [[ -f "$HOMEDASH_DIR/.env" ]]; then
      cp -p "$HOMEDASH_DIR/.env" "$backup_dir/.env"
    fi
    if [[ -f "$HOMEDASH_DIR/config/bookmarks.json" ]]; then
      cp -p "$HOMEDASH_DIR/config/bookmarks.json" "$backup_dir/bookmarks.json"
    fi
  fi

  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user disable --now homedash.service >/dev/null 2>&1 || true
  fi
  rm -f "$UNIT_PATH"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload
  fi

  if command -v tailscale >/dev/null 2>&1; then
    if ! tailscale serve --https "$HOMEDASH_PORT" "http://127.0.0.1:$HOMEDASH_PORT" off >/dev/null 2>&1; then
      sudo tailscale serve --https "$HOMEDASH_PORT" "http://127.0.0.1:$HOMEDASH_PORT" off >/dev/null 2>&1 ||
        printf 'Warning: the Tailscale listener on port %s could not be removed automatically.\n' "$HOMEDASH_PORT" >&2
    fi
  fi

  rm -rf -- "$HOMEDASH_DIR"
  rm -rf -- "$MANAGED_RUNTIME_DIR"

  printf 'homedash has been uninstalled from this machine.\n'
  if [[ -n "$backup_dir" ]]; then
    printf 'Private settings and bookmarks were preserved at %s.\n' "$backup_dir"
  fi
  printf 'System Node.js, Tailscale itself, and other user services were left unchanged.\n'
}

case "${1:-}" in
  --uninstall)
    uninstall_homedash
    exit 0
    ;;
  "") ;;
  *) fail "unknown option: $1" ;;
esac

command -v git >/dev/null 2>&1 || fail "git is required."

install_checkout() {
  printf 'Installing homedash at %s…\n' "$HOMEDASH_DIR"
  git clone --depth 1 "$HOMEDASH_REPO" "$HOMEDASH_DIR"
}

if [[ -d "$HOMEDASH_DIR/.git" ]]; then
  printf 'Updating homedash at %s…\n' "$HOMEDASH_DIR"
  git -C "$HOMEDASH_DIR" pull --ff-only
elif [[ -d "$HOMEDASH_DIR" ]] && rmdir "$HOMEDASH_DIR" 2>/dev/null; then
  install_checkout
elif [[ -e "$HOMEDASH_DIR" ]]; then
  fail "$HOMEDASH_DIR already exists but is not a git checkout."
else
  install_checkout
fi

LLMDASH_URL="${LLMDASH_URL:-http://127.0.0.1:8787}" \
  LLMDASH_LAUNCH_URL="${LLMDASH_LAUNCH_URL:-}" \
  "$HOMEDASH_DIR/scripts/install-or-update.sh"
