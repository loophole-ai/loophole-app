#!/usr/bin/env bash
# Move the pin to a new upstream commit and commit the bump. Verify first with
# dev/verify-patches.sh and fix any patch that no longer applies.
#
#   bash ./update_upstream.sh <commit> [ref]
#   PUSH=yes bash ./update_upstream.sh <commit>
#
# Typical cycle:
#   bash ./check_tags.sh
#   bash ./update_upstream.sh <sha>
#   bash ./dev/update_patches.sh     # regenerate anything that moved
#   bash ./dev/verify-patches.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
. ./utils.sh

NEW="${1:-}"
[ -n "$NEW" ] || die "usage: ./update_upstream.sh <commit> [ref]"
REF="${2:-$(pin_field ref || echo dev)}"

if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" cat-file -e "${NEW}^{commit}" 2>/dev/null \
    || git -C "$REPO_DIR" fetch -q origin "$NEW" 2>/dev/null || true
  if git -C "$REPO_DIR" cat-file -e "${NEW}^{commit}" 2>/dev/null; then
    NEW="$(git -C "$REPO_DIR" rev-parse "${NEW}^{commit}")"
  else
    die "unknown commit: $NEW (fetch it into $REPO_DIR first)"
  fi
fi

log "pinning ${REF} @ ${NEW:0:12}"

if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --arg ref "$REF" --arg commit "$NEW" '{ref: $ref, commit: $commit}' \
    upstream/opencode.json > "$tmp"
  mv "$tmp" upstream/opencode.json
else
  printf '{\n  "ref": "%s",\n  "commit": "%s"\n}\n' "$REF" "$NEW" \
    > upstream/opencode.json
fi

git add upstream/opencode.json
git -c user.name="${GIT_AUTHOR_NAME:-loophole}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-dev@loophole.local}" \
    commit -q -m "build(upstream): bump opencode to ${NEW:0:7}"
log "committed pin bump"

if [ "${PUSH:-no}" = "yes" ]; then
  git push origin "$(git rev-parse --abbrev-ref HEAD)"
fi
