#!/usr/bin/env bash
# Fetch the pinned upstream opencode commit into ./opencode, inside the workspace.
# This is the Loophole equivalent of VSCodium's get_repo.sh (which puts VS Code in
# ./vscode). Nothing is patched, installed or built here.
#
#   bash ./get_repo.sh                 -> ./opencode at the pinned commit
#   REPO_DIR=code bash ./get_repo.sh   -> custom tree location
#   FORCE=yes bash ./get_repo.sh       -> delete and re-clone the tree first
#   UPSTREAM_URL=... bash ./get_repo.sh -> clone from a mirror

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

REF="$(pin_field ref || true)"
COMMIT="$(pin_field commit || true)"
[ -n "${COMMIT:-}" ] || die "upstream/opencode.json has no commit"

if [ -e "$REPO_DIR" ] && [ ! -d "$REPO_DIR/.git" ]; then
  die "$REPO_DIR exists but is not a git checkout - remove it or set REPO_DIR"
fi

if [ "${FORCE:-no}" = "yes" ] && [ -d "$REPO_DIR" ]; then
  log "removing existing $REPO_DIR (FORCE=yes)"
  rm -rf "$REPO_DIR"
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  log "cloning $UPSTREAM_URL -> $REPO_DIR"
  mkdir -p "$REPO_DIR"
  git -C "$REPO_DIR" init -q
  git -C "$REPO_DIR" remote add origin "$UPSTREAM_URL"
else
  git -C "$REPO_DIR" remote set-url origin "$UPSTREAM_URL"
fi

# Keep the tree LF on Windows, otherwise git apply rejects the patches, and keep
# the exec bit out of the way (patches carry the mode they need).
git -C "$REPO_DIR" config core.autocrlf false
git -C "$REPO_DIR" config core.fileMode false
git -C "$REPO_DIR" config advice.detachedHead false

log "fetching ${REF:-upstream} @ ${COMMIT:0:12}"
if ! git -C "$REPO_DIR" fetch --depth 1 -q origin "$COMMIT"; then
  log "shallow fetch by commit failed, fetching full history"
  git -C "$REPO_DIR" fetch -q origin ${REF:+"$REF"} || git -C "$REPO_DIR" fetch -q origin
fi

git -C "$REPO_DIR" checkout -q -f --detach "$COMMIT" 2>/dev/null \
  || git -C "$REPO_DIR" checkout -q -f FETCH_HEAD
git -C "$REPO_DIR" clean -fdq

log "upstream tree ready: $REPO_DIR @ $(git -C "$REPO_DIR" rev-parse --short HEAD)"

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "REPO_DIR=$REPO_DIR"
    echo "OPENCODE_COMMIT=$COMMIT"
  } >> "$GITHUB_ENV"
fi
