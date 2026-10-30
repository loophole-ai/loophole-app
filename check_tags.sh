#!/usr/bin/env bash
# Show what upstream has moved to since the pinned commit, plus recent tags.
# Read-only: nothing here changes the pin. Use update_upstream.sh for that.
#
#   bash ./check_tags.sh
#   LIMIT=50 bash ./check_tags.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

PIN="$(pin_field commit)"
REF="$(pin_field ref || true)"
LIMIT="${LIMIT:-30}"

log "pinned: ${REF:-upstream} @ ${PIN:0:12}"

if [ -d "$REPO_DIR/.git" ]; then
  if git -C "$REPO_DIR" fetch -q origin ${REF:+"$REF"} 2>/dev/null; then
    log "commits on ${REF:-origin} after the pin"
    git -C "$REPO_DIR" log --oneline "$PIN..FETCH_HEAD" | head -n "$LIMIT" || true
  else
    log "could not fetch ${REF:-origin}; skipping commit list"
  fi
else
  log "no $REPO_DIR checkout - run get_repo.sh for the commit list"
fi

log "recent upstream tags"
git ls-remote --tags --refs "$UPSTREAM_URL" \
  | sed 's#.*refs/tags/##' \
  | sort -V \
  | tail -n "$LIMIT"
