#!/usr/bin/env bash
# Fast check, no compile: make sure every patch still applies to the pinned
# upstream commit. Run it after bumping upstream/opencode.json, before CI.
#
#   bash dev/verify-patches.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
. ./utils.sh

bash ./get_repo.sh
bash ./prepare_src.sh

echo "OK: $(list_patches "$ROOT" | wc -l | tr -d ' ') patches apply to $(pin_field commit | cut -c1-8)"
