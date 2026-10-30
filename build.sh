#!/usr/bin/env bash
# Install and build the prepared tree. Run get_repo.sh + prepare_src.sh first.
#
#   bash ./build.sh                     -> CLI (single, baseline)
#   BUILD_TARGET=desktop bash ./build.sh -> desktop app shell
#   BUILD_TARGET=all bash ./build.sh     -> CLI + desktop app shell
#
# Packaging (installers, gofile upload) stays in the workflow / package scripts.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

[ -d "$REPO_DIR/.git" ] || die "no ./$REPO_DIR checkout - run ./get_repo.sh and ./prepare_src.sh first"

BUILD_TARGET="${BUILD_TARGET:-cli}"

# Keep bun's global cache out of the user profile (C:) - everything stays next to
# the tree unless BUN_INSTALL_CACHE_DIR is already set.
export BUN_INSTALL_CACHE_DIR="${BUN_INSTALL_CACHE_DIR:-$ROOT/.bun-cache}"

cd "$REPO_DIR"

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
