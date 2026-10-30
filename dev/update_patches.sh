#!/usr/bin/env bash
# Re-apply the whole patch stack to the pinned tree and re-export every patch
# from the result. Use this after bumping the pin, or after editing the tree by
# hand. Conflicts pause the run so you can resolve them.
#
#   bash dev/update_patches.sh
#
# Patches are regenerated cumulatively: each one is diffed against the state the
# previous patch produced, which is exactly how prepare_src.sh applies them.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
. ./utils.sh

[ -d "$REPO_DIR/.git" ] || die "no ./$REPO_DIR checkout - run ./get_repo.sh first"

cd "$REPO_DIR"
BASE="$(git rev-parse HEAD)"
git reset -q --hard "$BASE"
git clean -fdq

PREV="$BASE"
while IFS= read -r patch; do
  [ -z "$patch" ] && continue
  rel="${patch#"$ROOT"/}"
  log "applying $rel"

  if ! apply_patch_file "$patch"; then
    log "conflicts in $rel - resolve them now"
    git apply --ignore-whitespace --reject --whitespace=nowarn "$patch" || true
    while [ -n "$(find . -name '*.rej' -print -quit)" ]; do
      find . -name '*.rej' -print
      read -r -p "Press Enter when resolved... " _
    done
  fi

  git add -A
  git diff --cached --quiet && die "$rel produced no changes"

  git -c user.name=loophole -c user.email=dev@loophole.local \
    commit -q -m "LOOPHOLE HELPER"
  CUR="$(git rev-parse HEAD)"

  git diff "$PREV" "$CUR" -U3 > "$patch"
  PREV="$CUR"
done < <(list_patches "$ROOT")

git reset -q --hard "$BASE"
git clean -fdq

log "patches regenerated"
