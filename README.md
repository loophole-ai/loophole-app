# Loophole

Loophole is a patch distribution on top of [opencode](https://github.com/anomalyco/opencode) —
the same model VSCodium uses for VS Code. This repository contains **no opencode code**:
only the patches that turn upstream opencode into Loophole, plus the scripts that apply them.

## Layout

```
upstream/opencode.json      pinned upstream commit the patches are based on ({ref, commit})
patches/series              ordered patch list
patches/*.patch             Loophole's changes as text patches
assets/                     binary overlay (icons, logos), mirrored by repo path
assets/deletes.txt          files removed from the upstream tree
scripts/prepare-loophole.*  clone upstream at the pin, apply patches, overlay assets
.github/workflows/          build CI
```

## Build

```bash
bash scripts/prepare-loophole.sh        # or scripts\prepare-loophole.ps1 on Windows
cd ../loophole-build
bun install                             # regenerates bun.lock for the @loophole-ai/* packages
# then the normal opencode build commands
```

The build tree is a real git repo checked out at the pinned upstream commit with patches
applied — install and build with opencode's own tooling. Nothing upstream is modified
outside the patch tree.

## Syncing upstream

VSCodium-style: **no merges, ever.** To move to a newer opencode commit:

1. Update `commit` in `upstream/opencode.json`.
2. Run `scripts/prepare-loophole.ps1` (delete the old build tree first).
3. If a patch fails to apply, fix that patch against the new upstream state.
4. When everything applies cleanly, done — the patches are already the source of truth.

To develop a new feature: code in the build tree, then fold the change back into a patch
(either edit the relevant patch by hand or re-export it from the dev fork branch `opencode`
of this repository, which keeps a full code checkout and `scripts/patches/export-patches.ps1`).

See [PATCHES.md](PATCHES.md) for the patch inventory and maintenance details.
