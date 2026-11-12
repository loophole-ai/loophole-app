# Source layout

Loophole's CLI and desktop app are a **fork of upstream opencode**, not a patch stack.

The source lives as real commits on the **`loophole`** branch of this repository
(`loophole-ai/loophole-app`), based on upstream `anomalyco/opencode`.

## Branches

| Branch | Contents |
|---|---|
| `loophole` | **The product.** Upstream history + Loophole commits (rebrand, licensing, desktop channels, TUI screens, home composer, tool cards, CLI naming). This is what builds run on. |
| `main` | Build automation only: workflows, `get_repo.sh`, `prepare_src.sh`, `build.sh`, `assets/`. Also on `loophole`. |

## Build flow

```
bash ./get_repo.sh        # check out the loophole branch into ./opencode
bash ./prepare_src.sh     # verify the tree + overlay assets/ (no patching)
bash ./build.sh           # bun install + build CLI / desktop
```

`get_repo.sh` takes the branch from `LOOPHOLE_SRC_BRANCH` (default `loophole`) and the
repository from `LOOPHOLE_SRC_URL`.

## Syncing upstream

```bash
git fetch https://github.com/anomalyco/opencode.git dev
git checkout loophole
git merge FETCH_HEAD          # resolve conflicts in the files we touched
```

Then bump `upstream/opencode.json` to the merged upstream commit.

## Retired: patches/

`patches/` and `dev/patch.sh` are kept for history only. The patch stack was applied once
onto upstream `9e2f9311a` and committed, so no build applies patches any more. Do not add
new patches — commit to the `loophole` branch instead.

## assets/

Binary assets (icons, logos, installer artwork) that cannot live in the source branch are
mirrored over the tree by `prepare_src.sh`, honouring `assets/deletes.txt`.
