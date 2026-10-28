# Patch System

Loophole is maintained as a set of **patches on top of upstream opencode** (same model
as VSCodium on top of VS Code). The Loophole-specific changes never live as a long-lived
fork diff â€” they live in `patches/` + `assets/`, and can be applied to any upstream
snapshot.

## Layout

```
UPSTREAM-REF              full SHA of the upstream commit the patches are based on
patches/
  series                  ordered list of patches
  0001-rebrand-core.patch     branding, i18n strings, logos refs, service discovery, TUI/App
  0002-licensing-docs.patch   AGPL-3.0 license, READMEs, NOTICE, stats workflow, CLI licensing
  0003-desktop-channels.patch desktop update channel, support/issue links, desktop metadata
assets/                   binary overlay (icons, logos), mirrored by repo path
  deletes.txt             files to delete from the upstream tree
scripts/patches/
  export-patches.ps1      regenerate patches + assets from committed state (HEAD vs UPSTREAM-REF)
  apply-patches.ps1       fresh upstream checkout + apply patches + overlay assets
```

Notes:
- `bun.lock` is intentionally **not** patched. It is regenerated with `bun install`
  after the patches are applied (package names change from `@opencode-ai/*` to
  `@loophole-ai/*`).
- Binary files (icons, PNGs) are never put inside `.patch` files. They live in
  `assets/` and are copied over the tree by the apply script.

## Building a patched tree

```powershell
scripts/prepare-loophole.ps1
# -> D:\Loophole\loophole-build  (override with -Target <dir>)
```

This clones the fork locally (it already contains the upstream objects), checks out
`UPSTREAM-REF` detached, applies every patch in `patches/series`, copies the binary
overlay, and applies deletions. It installs nothing and builds nothing.

Afterwards, in the build tree:

```powershell
cd D:\Loophole\loophole-build
bun install          # regenerate bun.lock (manual step)
# ... normal opencode build commands
```

## Syncing upstream (the routine)

1. Fetch upstream and pick the new base:
   ```powershell
   git fetch upstream
   git log --oneline upstream/dev -5        # choose the commit to move to
   ```
2. Merge it into the Loophole branch as usual and resolve conflicts
   (the `patches/*.patch` files tell you exactly which areas Loophole touches â€”
   conflicts should only happen where upstream edits the same lines).
3. Update `UPSTREAM-REF` to the new upstream SHA.
4. Regenerate the patches:
   ```powershell
   the dev fork branch (`opencode`): scripts/patches/export-patches.ps1
   ```
5. Verify the round-trip (should print no diff):
   ```powershell
   scripts/prepare-loophole.ps1 -Target D:\Loophole\loophole-build
   cd D:\Loophole\loophole-build; git add -A; git diff --cached <loophole-HEAD-sha>
   ```

## Adding a new Loophole feature

1. Implement and **commit** it on the Loophole branch as usual.
2. If it touches new files, add the paths to the right group in
   `the dev fork branch (`opencode`): scripts/patches/export-patches.ps1` (group 1 is the catch-all; groups 2 and 3
   are explicit lists), or just let group 1 pick it up.
3. Re-run `export-patches.ps1`.

## CI usage

A CI job can build Loophole without this fork's history:

```
git clone https://github.com/anomalyco/opencode.git tree
git -C tree checkout $(cat UPSTREAM-REF)
git apply patches/*.patch          # in series order
xcopy /E /Y assets\ tree\          # minus deletes.txt
# rm files listed in assets/deletes.txt
bun install && <build>
```
