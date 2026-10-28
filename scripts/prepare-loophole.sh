#!/usr/bin/env bash
# Creates a clean Loophole build tree: upstream opencode at the pinned commit + Loophole patches.
#
#   scripts/prepare-loophole.sh                          -> ../loophole-build
#   TARGET=/some/dir scripts/prepare-loophole.sh         -> custom location
#   UPSTREAM_URL=... scripts/prepare-loophole.sh         -> clone from a mirror
#
# Nothing is installed and nothing is built here. After this, run:
#   cd ../loophole-build && bun install   (regenerates bun.lock for the @loophole-ai/* packages)
#   then build with the normal opencode build commands.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/anomalyco/opencode.git}"
TARGET="${TARGET:-$(dirname "$ROOT")/loophole-build}"
COMMIT="$(jq -r .commit "$ROOT/upstream/opencode.json")"

if [ -z "$COMMIT" ] || [ "$COMMIT" = "null" ]; then
  echo "error: upstream/opencode.json has no commit" >&2
  exit 1
fi
if [ -e "$TARGET" ]; then
  echo "error: target already exists: $TARGET (delete it or set TARGET)" >&2
  exit 1
fi

echo "cloning $UPSTREAM_URL -> $TARGET"
git clone --no-checkout --filter=blob:none "$UPSTREAM_URL" "$TARGET"
git -C "$TARGET" checkout --detach "$COMMIT"
# keep executable bits from patches, not from the local filesystem
git -C "$TARGET" config core.fileMode false

# apply patches in series order
while IFS= read -r patch; do
  [ -z "$patch" ] && continue
  patch="${patch%$'\r'}"
  [ -z "$patch" ] && continue
  echo "applying $patch"
  git -C "$TARGET" apply --index --whitespace=nowarn "$ROOT/patches/$patch"
done < "$ROOT/patches/series"

# binary overlay (icons, logos), mirrored by repo path
cd "$ROOT/assets"
find . -type f ! -name deletes.txt -print0 | while IFS= read -r -d '' f; do
  mkdir -p "$TARGET/$(dirname "$f")"
  cp "$f" "$TARGET/$f"
done
if [ -f deletes.txt ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    rm -f "$TARGET/$f"
  done < deletes.txt
fi

echo
echo "patch tree ready: $TARGET"
echo "  upstream: $COMMIT"
echo
echo "next: cd $TARGET && bun install && <build>"
