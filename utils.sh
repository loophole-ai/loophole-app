#!/usr/bin/env bash
# Shared helpers for this repository's build scripts.
#
# This is a fork of upstream opencode: the Loophole changes are ordinary commits,
# not a patch series, so there is nothing here that applies patches.

APP_NAME="${APP_NAME:-Loophole}"
BINARY_NAME="${BINARY_NAME:-loophole}"
ORG_NAME="${ORG_NAME:-loophole-ai}"
GH_REPO_PATH="${GH_REPO_PATH:-${ORG_NAME}/loophole-app}"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
log() { printf '==> %s\n' "$*"; }

repo_root() { cd "$(dirname "${BASH_SOURCE[0]}")" && pwd; }

# overlay_assets <repo-root> <target-tree> - copy assets/ over the tree by
# mirrored path, then delete every path listed in assets/deletes.txt.
overlay_assets() {
  local root="$1" target="$2" src="$1/assets"
  [ -d "$src" ] || return 0
  ( cd "$src" && find . -type f ! -name deletes.txt -print0 | while IFS= read -r -d '' f; do
      mkdir -p "$target/$(dirname "$f")"
      cp -f "$f" "$target/$f"
    done )
  if [ -f "$src/deletes.txt" ]; then
    while IFS= read -r f || [ -n "$f" ]; do
      f="${f%$'\r'}"
      [ -z "$f" ] && continue
      rm -f "$target/$f"
    done < "$src/deletes.txt"
  fi
}

# replace <sed-expr> <file> - portable in-place sed (GNU or BSD).
replace() {
  if sed --version >/dev/null 2>&1; then
    sed -i -E "$1" "$2"
  else
    sed -i '' -E "$1" "$2"
  fi
}
