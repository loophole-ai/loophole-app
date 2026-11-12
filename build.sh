#!/usr/bin/env bash
# Build the Loophole CLI and/or desktop app from this checkout.
#
#   bash ./build.sh                        -> CLI (single, baseline)
#   BUILD_TARGET=desktop bash ./build.sh   -> desktop app shell
#   BUILD_TARGET=all bash ./build.sh       -> CLI + desktop app shell
#
# Everything this product needs lives in this repository, so there is no
# checkout-of-a-checkout step and no patch stack: the tree is built as-is.
#
# Versions come from OPENCODE_VERSION / LOOPHOLE_VERSION when set (release
# workflows set them); otherwise the version in packages/cli/package.json is used.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

BUILD_TARGET="${BUILD_TARGET:-cli}"

log() { printf '==> %s\n' "$*"; }

# Keep bun's global cache out of the user profile - everything stays next to the tree.
export BUN_INSTALL_CACHE_DIR="${BUN_INSTALL_CACHE_DIR:-$ROOT/.bun-cache}"

log "installing dependencies (cache: $BUN_INSTALL_CACHE_DIR)"
bun install

case "$BUILD_TARGET" in
  cli|all)
    log "building CLI (single, baseline)"
    bun run --cwd packages/cli build --single --baseline
    ;;
esac

case "$BUILD_TARGET" in
  desktop|all)
    log "building desktop app shell"
    OPENCODE_CHANNEL="${OPENCODE_CHANNEL:-prod}" bun run --cwd packages/desktop build
    ;;
esac

log "build finished ($BUILD_TARGET)"
