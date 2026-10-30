#!/usr/bin/env bash
# Turn ./opencode into the Loophole source tree: reset it to the pinned upstream
# commit, apply patches/*.patch + patches/user/*.patch in sorted order, then lay
# the binary assets over it. Run get_repo.sh first.
#
#   bash ./prepare_src.sh
#
# Safe to run repeatedly: the tree is always reset before patching. Nothing is
# installed or built here - that is build.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

[ -d "$REPO_DIR/.git" ] || die "no ./$REPO_DIR checkout - run ./get_repo.sh first"

cd "$REPO_DIR"

# Start from a pristine pinned checkout. clean -fd leaves ignored files alone, so
# node_modules from a previous build survives.
git reset -q --hard HEAD
git clean -fdq

log "applying Loophole patches"
COUNT=0
while IFS= read -r patch; do
  [ -z "$patch" ] && continue
  log "  ${patch#"$ROOT"/}"
  if ! apply_patch_file "$patch"; then
    die "patch failed: ${patch#"$ROOT"/} - upstream moved the touched lines; fix the patch with dev/patch.sh"
  fi
  COUNT=$((COUNT + 1))
done < <(list_patches "$ROOT")
[ "$COUNT" -gt 0 ] || die "no patches found in ./patches"

log "overlaying assets"
overlay_assets "$ROOT" "$(pwd)"

log "patched tree ready: $ROOT/$REPO_DIR ($COUNT patches)"
