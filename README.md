# Loophole

Loophole is a patch distribution on top of [opencode](https://github.com/anomalyco/opencode),
built the same way [VSCodium](https://github.com/VSCodium/vscodium) sits on top of VS Code.
This repository contains **no opencode source**: only the patches that turn upstream opencode
into Loophole, the binary overlay, and the scripts that apply them.

The upstream tree always lives **inside the workspace**, at `./opencode`, so local runs and CI
use exactly the same paths.

## Layout

```
upstream/opencode.json   pinned upstream commit ({ref, commit})
patches/[0-9]*-*.patch   Loophole changes, applied in sorted order (no series file)
patches/user/*.patch     optional, applied after the numbered stack
assets/                  binary overlay (icons, logos), mirrored by repo path
assets/deletes.txt       files removed from the upstream tree
get_repo.sh              clone pinned upstream -> ./opencode
prepare_src.sh           apply patches + overlay assets
build.sh                 bun install + build
dev/patch.sh             edit one patch against ./opencode, re-export it
dev/update_patches.sh    re-apply the whole stack and re-export every patch
dev/verify-patches.sh    fast apply check, no compile
check_tags.sh            show upstream commits/tags newer than the pin
update_upstream.sh       bump the pin and commit it
.github/workflows/       ci-build-{windows,linux,macos}.yml (CLI)
                         ci-build-desktop-{windows,linux,macos}.yml (desktop)
```

`patches/` also holds restored copies of upstream opencode's bun `patchedDependencies`
(`@ai-sdk/...`, `vite@...`, ...). They are byte-identical to upstream and arrive with the
`opencode/` checkout, so only the numbered `patches/[0-9]*-*.patch` files are applied.

## Build

Requires `git`, `bun`, and a bash shell (Git Bash on Windows). `jq` is optional.

```bash
bash ./get_repo.sh        # clone upstream at the pin -> ./opencode
bash ./prepare_src.sh     # reset the tree, apply patches, overlay assets
bash ./build.sh           # bun install + CLI build
```

The CLI lands in `opencode/packages/cli/dist/cli-windows-x64-baseline/bin/loophole.exe`
(`--single --baseline`). `BUILD_TARGET=desktop` builds the desktop app shell instead.

## Syncing upstream

No merges, ever. The patches are the source of truth.

1. `bash ./check_tags.sh` — see what upstream moved to.
2. `bash ./update_upstream.sh <commit>` — bump `upstream/opencode.json`.
3. `bash ./get_repo.sh` (with `FORCE=yes` after a pin change) and `bash ./prepare_src.sh`.
4. If a patch fails, fix it with `bash dev/patch.sh <name>`, or regenerate the stack with
   `bash dev/update_patches.sh`.
5. `bash ./dev/verify-patches.sh` — must print `OK`.

## Developing a feature

There is no full-source branch. You edit the cloned tree and export the diff:

```bash
bash ./get_repo.sh
bash ./prepare_src.sh
# edit files under ./opencode like any normal checkout
bash dev/update_patches.sh     # folds the tree back into patches/*.patch
```

To edit a single existing patch (VSCodium's `dev/patch.sh` flow):

```bash
bash dev/patch.sh 0001-rebrand-core
# resolve any .rej files, press Enter, patch is regenerated
```

New features go in `patches/user/*.patch` unless they belong in one of the existing groups.
Patches are regenerated with 3 lines of context.

## CI

One CLI workflow per OS, all triggered by a push to `main` (and PRs to `main`):

| Workflow | Runner | Output |
|---|---|---|
| `ci-build-windows.yml` | `windows-latest` | `cli-windows-x64-baseline/bin/loophole.exe` |
| `ci-build-linux.yml` | `ubuntu-latest` | `cli-linux-x64-baseline/bin/loophole` |
| `ci-build-macos.yml` | `macos-15-intel`, `macos-14` | `cli-darwin-x64-baseline`, `cli-darwin-arm64` |

Each does exactly: `get_repo.sh` → `prepare_src.sh` → `build.sh` → upload (gofile + artifact).

The desktop app has three matching workflows, with the same triggers and the same
`get_repo.sh` → `prepare_src.sh` shape:

| Workflow | Runner | Output |
|---|---|---|
| `ci-build-desktop-windows.yml` | `windows-latest` | NSIS installer (`loophole-desktop-win-x64.exe`) |
| `ci-build-desktop-linux.yml` | `ubuntu-latest` | AppImage, deb, rpm (`loophole-desktop-linux-x64.*`) |
| `ci-build-desktop-macos.yml` | `macos-15-intel`, `macos-14` | dmg + zip (x64, arm64) |

They build the CLI for the matching target first, then `bun run --cwd packages/desktop build`
and one `electron-builder` pass, the same packaging shape as forge's `desktop-builder`.
Packages are unsigned test builds: gofile + artifact, never published.

### Versions

Desktop and CLI versions are separate, like forge:

- **desktop app**: passed as `OPENCODE_VERSION` to the desktop build and package steps.
  It must not be higher than `loophole-ai/desktop`'s latest release unless that release is
  published, because the app's updater has `allowDowngrade = true` and would otherwise
  reinstall the published build on every launch.
- **bundled CLI**: passed as `OPENCODE_VERSION` to the CLI build, so the binary and
  `resources/loophole-cli.version` both carry the published CLI version.

Both default to the latest GitHub release (`loophole-ai/desktop`, `loophole-ai/cli`) and can
be overridden with the `workflow_dispatch` inputs `version` / `cli_version`. No version is
hardcoded in the patch stack; changing one is a CI input change, not a patch change.

There is no branch-picking workflow, because the repo is always patches-only.

See [PATCHES.md](PATCHES.md) for the patch inventory.
