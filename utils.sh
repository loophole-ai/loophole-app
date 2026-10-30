#!/usr/bin/env bash
# Shared helpers for the Loophole patch pipeline (VSCodium-style).
# Sourced by the root scripts and by dev/*.sh.

APP_NAME="${APP_NAME:-Loophole}"
BINARY_NAME="${BINARY_NAME:-loophole}"
ORG_NAME="${ORG_NAME:-loophole-ai}"
GH_REPO_PATH="${GH_REPO_PATH:-${ORG_NAME}/loophole-app}"
REPO_DIR="${REPO_DIR:-opencode}"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/anomalyco/opencode.git}"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }
log() { printf '==> %s\n' "$*"; }

# Absolute path to the repo root (the directory holding this file).
repo_root() { cd "$(dirname "${BASH_SOURCE[0]}")" && pwd; }

# pin_field <field> [file] - read ref/commit from upstream/opencode.json.
# jq is preferred but not required, so local Windows checkouts work without it.
pin_field() {
  local field="$1" file="${2:-upstream/opencode.json}"
  [ -f "$file" ] || return 1
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg f "$field" '.[$f] // empty' "$file"
  else
    sed -n "s/.*\"${field}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$file" | head -n 1
  fi
}

# list_patches <repo-root> - the Loophole stack is every numbered patch in
# patches/ (0001-..., 0002-...) followed by patches/user/*.patch, applied in
# sorted order. There is no series file.
#
# The numbered prefix is the filter on purpose: patches/ also holds copies of
# upstream opencode's bun patchedDependencies (@ai-sdk..., vite@..., ...) plus
# the old series file. Those must never be applied as source patches.
# patches/wip/ is deliberately not scanned.
list_patches() {
  local root="${1:-.}"
  {
    find "$root/patches" -maxdepth 1 -type f -name '[0-9]*-*.patch' 2>/dev/null | sort
    find "$root/patches/user" -maxdepth 1 -type f -name '*.patch' 2>/dev/null | sort
  }
}

# apply_patch_file <file> - apply one patch to the current directory (a git tree).
apply_patch_file() {
  git apply --ignore-whitespace --whitespace=nowarn "$1"
}

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
