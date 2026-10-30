#!/usr/bin/env bash
# Edit one patch against the cloned tree, then regenerate it. This is the
# VSCodium dev/patch.sh workflow: reset to the pin, apply everything before the
# target, apply the target with --reject, let you resolve conflicts, re-export.
#
#   bash dev/patch.sh 0001-rebrand-core
#   bash dev/patch.sh patches/user/my-fix.patch
#
# The ./opencode tree is reset to the pinned commit when the script exits.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
. ./utils.sh

[ $# -ge 1 ] || die "usage: dev/patch.sh <patch-name>"

TARGET="$1"
case "$TARGET" in
  */*) ;;
  *.patch) TARGET="patches/$TARGET" ;;
  *) TARGET="patches/$TARGET.patch" ;;
esac
[ -f "$TARGET" ] || die "no such patch: $TARGET"
TARGET_ABS="$(cd "$(dirname "$TARGET")" && pwd)/$(basename "$TARGET")"

[ -d "$REPO_DIR/.git" ] || die "no ./$REPO_DIR checkout - run ./get_repo.sh first"

cd "$REPO_DIR"
BASE="$(git rev-parse HEAD)"
git reset -q --hard "$BASE"
git clean -fdq

# Apply every patch that sorts before the target and commit them, so the diff we
# export at the end contains only the target patch.
HELPER=0
while IFS= read -r patch; do
  [ -z "$patch" ] && continue
  [ "$patch" = "$TARGET_ABS" ] && break
  log "prerequisite ${patch#"$ROOT"/}"
  apply_patch_file "$patch"
  HELPER=1
done < <(list_patches "$ROOT")

if [ "$HELPER" = "1" ]; then
  git add -A
  git -c user.name=loophole -c user.email=dev@loophole.local \
    commit -q -m "LOOPHOLE HELPER"
fi

log "applying ${TARGET_ABS#"$ROOT"/} (rejects are expected)"
if ! git apply --ignore-whitespace --reject --whitespace=nowarn "$TARGET_ABS"; then
  echo
  echo "Resolve the conflicts below, delete each .rej file, then press Enter."
  find . -name '*.rej' -print
  read -r -p "Press Enter when done... " _
  while [ -n "$(find . -name '*.rej' -print -quit)" ]; do
    find . -name '*.rej' -print
    read -r -p "Still unresolved. Press Enter... " _
  done
fi

git add -A
git diff --cached -U3 > "$TARGET_ABS"

git reset -q --hard "$BASE"
git clean -fdq

log "regenerated ${TARGET_ABS#"$ROOT"/}"
