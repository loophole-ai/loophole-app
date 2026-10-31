# Patch System

Loophole is maintained as a set of **patches on top of upstream opencode** (the same model
as VSCodium on top of VS Code). Loophole-specific changes never live as a long-lived fork
diff — they live in `patches/` + `assets/` and can be applied to any upstream snapshot.

## Layout

```
upstream/opencode.json   pinned upstream commit ({ref, commit})
patches/
  0001-rebrand-core.patch      branding, i18n strings, logo refs, service discovery, TUI/App
  0002-licensing-docs.patch    AGPL-3.0 license, READMEs, NOTICE, stats workflow, CLI licensing
  0003-desktop-channels.patch  desktop update channel, support/issue links, desktop metadata
  0004-desktop-name.patch      desktop product name, About heading, first-launch splash
  0005-telemetry-posthog.patch opt-out aggregate telemetry (LOOPHOLE_TELEMETRY_DISABLE=1)
  0006-main-screen.patch       larger animated wordmark, composer docked to the bottom
  0007-about-page.patch        clean Loophole About page (no upstream credits/trivia)
  user/                        optional extra patches, applied after the numbered stack
  archive/0004-pi-tui.patch    recovered pi-TUI snapshot - NEVER applied (see below)
  series                       legacy list, ignored by the scripts (sorted order wins)
  @ai-sdk%2F...@x.patch         copies of upstream bun patchedDependencies - NEVER applied
assets/                  binary overlay (icons, logos), mirrored by repo path
  deletes.txt            files to delete from the upstream tree
```

Application order: every numbered `patches/[0-9]*-*.patch` sorted, then
`patches/user/*.patch` sorted. There is no series file (the old `series` is kept for
reference only).

Why the numbered filter: `patches/` also contains copies of **upstream opencode's bun
dependency patches** (`@ai-sdk/...`, `vite@...`, ...). They are byte-identical to upstream
and are supplied by the `opencode/` checkout, so they must not be applied as source patches.
Only numbered files are Loophole's stack.

Notes:
- `bun.lock` is intentionally **not** patched. It is regenerated with `bun install` after the
  patches are applied (package names change from `@opencode-ai/*` to `@loophole-ai/*`).
- Binary files are never put inside `.patch` files; icons and logos live in `assets/`.

## Building a patched tree

```bash
bash ./get_repo.sh        # ./opencode at the pinned commit
bash ./prepare_src.sh     # reset + apply patches + overlay assets
```

This installs nothing and builds nothing. Afterwards:

```bash
bash ./build.sh           # bun install + CLI build
```

`prepare_src.sh` always resets the tree to the pin first, so it is safe to re-run and it never
depends on what you did in a previous session.

## Syncing upstream (the routine)

1. See what moved:
   ```bash
   bash ./check_tags.sh
   ```
2. Move the pin:
   ```bash
   bash ./update_upstream.sh <commit>
   ```
3. Rebuild the tree and check that every patch still applies:
   ```bash
   FORCE=yes bash ./get_repo.sh
   bash ./prepare_src.sh
   ```
4. If a patch fails, either fix that one:
   ```bash
   bash dev/patch.sh 0005-telemetry-posthog
   ```
   or regenerate the whole stack against the new base:
   ```bash
   bash dev/update_patches.sh
   ```
5. Round-trip check (must print `OK`):
   ```bash
   bash ./dev/verify-patches.sh
   ```

## Adding a new Loophole feature

1. Build the tree: `bash ./get_repo.sh && bash ./prepare_src.sh`.
2. Edit files directly under `./opencode` like a normal checkout.
3. Export it:
   ```bash
   bash dev/update_patches.sh
   ```
   New files are picked up automatically because patches are regenerated from the tree diff.
   If you prefer an isolated patch, create `patches/user/<name>.patch` by hand.

## Generating / refreshing a patch

`dev/patch.sh <name>` is the single-patch editor:
reset to the pin, apply all earlier patches as a throwaway commit, apply the target with
`--reject`, wait while you resolve conflicts, then write the new patch with
`git diff --staged -U3` and reset the tree.

`dev/update_patches.sh` is the batch version: apply the stack cumulatively, regenerating each
patch against the state produced by the previous one, then reset.

## Archived work

The recovered pi-TUI snapshot is kept as a branch (`recover/opencode`, `61ebc3dc3e`) but is
**not** part of the applied stack. It does not compile: its `interactive.ts` imports
`createTuiAdapter`, which the snapshot's `tui-adapter/index.ts` no longer exports. The
exported patch is parked at `patches/archive/0004-pi-tui.patch` and is never applied. Restore
it only together with a fix for that import.

`0005-telemetry-posthog.patch` came from the `telemetry-posthog` / `tui-logo-art` branches.
Every other custom commit on the local branches (Discord report link, service-port isolation,
wordmark art, splash art) was already present in `0001`-`0003`.

## CI usage

A CI job can build Loophole without this repo's history:

```bash
bash ./get_repo.sh          # clone upstream at the pin into ./opencode
bash ./prepare_src.sh       # patches + assets
bash ./build.sh             # bun install + build
```

That is exactly what `.github/workflows/ci-build-windows.yml` does. There is no layout
detection and no full-source branch to keep in sync.
