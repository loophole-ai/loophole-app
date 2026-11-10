#!/usr/bin/env bash
# Fetch the Loophole source tree into ./opencode, inside the workspace.
#
# Since the patch stack was retired, the source lives as real commits on the
# `loophole` branch of this repository (a fork of upstream opencode). Nothing is
# patched, installed or built here.
#
#   bash ./get_repo.sh                 -> ./opencode at the code branch head
#   REPO_DIR=code bash ./get_repo.sh   -> custom tree location
#   FORCE=yes bash ./get_repo.sh       -> delete and re-clone the tree first
#   LOOPHOLE_SRC_URL=... bash ./get_repo.sh -> clone from a mirror
#   LOOPHOLE_SRC_BRANCH=... bash ./get_repo.sh -> use another branch

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

# The code branch is the source of truth; upstream/opencode.json only records
# which upstream commit it was last synced to.
SRC_URL="${LOOPHOLE_SRC_URL:-https://github.com/${ORG_NAME}/loophole-app.git}"
SRC_BRANCH="${LOOPHOLE_SRC_BRANCH:-loophole}"
BASE_COMMIT="$(pin_field commit || true)"

if [ -e "$REPO_DIR" ] && [ ! -d "$REPO_DIR/.git" ]; then
  die "$REPO_DIR exists but is not a git checkout - remove it or set REPO_DIR"
fi

if [ "${FORCE:-no}" = "yes" ] && [ -d "$REPO_DIR" ]; then
  log "removing existing $REPO_DIR (FORCE=yes)"
  rm -rf "$REPO_DIR"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  log "cloning ${SRC_URL#https://github.com/} (${SRC_BRANCH}) -> $REPO_DIR"
  mkdir -p "$REPO_DIR"
  git -C "$REPO_DIR" init -q
  git -C "$REPO_DIR" remote add origin "$SRC_URL"
else
  git -C "$REPO_DIR" remote set-url origin "$SRC_URL"
fi

# Keep the tree LF on Windows and ignore file mode churn.
git -C "$REPO_DIR" config core.autocrlf false
git -C "$REPO_DIR" config core.fileMode false
git -C "$REPO_DIR" config advice.detachedHead false

log "fetching ${SRC_BRANCH}"
git -C "$REPO_DIR" fetch -q origin "${SRC_BRANCH}"
git -C "$REPO_DIR" checkout -q -f -B "${SRC_BRANCH}" FETCH_HEAD
git -C "$REPO_DIR" reset -q --hard FETCH_HEAD
git -C "$REPO_DIR" clean -fdq

log "source tree ready: $REPO_DIR @ $(git -C "$REPO_DIR" rev-parse --short HEAD) (${SRC_BRANCH})"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "REPO_DIR=$REPO_DIR"
    echo "OPENCODE_COMMIT=$(git -C "$REPO_DIR" rev-parse HEAD)"
    echo "UPSTREAM_BASE=${BASE_COMMIT:-}"
  } >> "$GITHUB_ENV"
fi
