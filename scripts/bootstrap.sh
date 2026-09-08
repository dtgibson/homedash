#!/usr/bin/env bash
# Public bootstrap for first installs and later updates:
#   curl -fsSL HOMEDASH_INSTALL_URL | bash

set -Eeuo pipefail

readonly HOMEDASH_REPO="git@github.com:dtgibson/homedash.git"
readonly HOMEDASH_DIR="${HOMEDASH_DIR:-$HOME/homedash}"

fail() {
  printf 'homedash bootstrap failed: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required."

if [[ -d "$HOMEDASH_DIR/.git" ]]; then
  printf 'Updating homedash at %s…\n' "$HOMEDASH_DIR"
  git -C "$HOMEDASH_DIR" pull --ff-only
elif [[ -e "$HOMEDASH_DIR" ]]; then
  fail "$HOMEDASH_DIR already exists but is not a git checkout."
else
  printf 'Installing homedash at %s…\n' "$HOMEDASH_DIR"
  git clone --depth 1 "$HOMEDASH_REPO" "$HOMEDASH_DIR"
fi

LLMDASH_URL="${LLMDASH_URL:-http://hephaestus-developer:8787}" \
  "$HOMEDASH_DIR/scripts/install-or-update.sh"
