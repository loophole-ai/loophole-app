#!/usr/bin/env bash
# Prepare ./opencode for a build. Since the patch stack was retired the tree
# already carries every Loophole change as real commits, so this no longer
# applies patches: it only verifies the checkout and lays the binary assets over
# it. Run get_repo.sh first.
#
#   bash ./prepare_src.sh
#
# Safe to run repeatedly. Nothing is installed or built here - that is build.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

[ -d "$REPO_DIR/.git" ] || die "no ./$REPO_DIR checkout - run ./get_repo.sh first"

cd "$REPO_DIR"

# The tree is a branch checkout, so just drop local edits from a previous build.
git reset -q --hard HEAD
git clean -fdq

log "source tree: $(git rev-parse --short HEAD) $(git log -1 --format=%s)"

# Fail early and loudly if the code branch is missing the Loophole branding, so a
# bad checkout never produces a silently-unbranded build.
[ -f LICENSE ] || die "LICENSE missing - wrong branch checked out?"
if ! grep -q "Loophole" LICENSE; then
  die "LICENSE is not the Loophole license - the source branch is not the Loophole fork"
fi

log "overlaying assets"
overlay_assets "$ROOT" "$(pwd)"

log "tree ready: $ROOT/$REPO_DIR"
