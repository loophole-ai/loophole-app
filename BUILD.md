# Source layout

Loophole's CLI and desktop app are a **fork of upstream opencode**.

The source lives as real commits on the **`code`** branch of this repository,
based on upstream `anomalyco/opencode` (MIT).

## Branches

| Branch | Contents |
|---|---|
| `code` | **The product.** What you clone. Upstream history + Loophole commits (rebrand, MIT licensing, desktop channels, TUI screens, home composer, tool cards, CLI naming). |
| `main` | Identical to `code`. Kept in sync as a backup until the default branch is flipped to `code`. |
| `release-tooling` | Former build-automation history and release pins (archived). |
| `loophole` | Desktop release line. |
| `loophole-sync` | Pre-sync CLI release line (archived). |
| `loophole-sync-fixed` | The CLI release line. Identical to `main`/`code`. |

## Build

The desktop DMG/installer builds are built by the forge repo (`loophole-ai/forge`,
`build.yml` and `desktop.yml`), which checks out this repository at a given
ref and runs `packages/cli/script/build.ts` (or `prepare.ts` for the app).
See `services/`, `packages/cli/script/build.ts` and `packages/desktop/` for
what builds, what it bundles, and how bundles are laid out.

```bash
bun install
bun run --cwd packages/cli script/build.ts
```

## Syncing upstream

```bash
git fetch https://github.com/anomalyco/opencode.git dev
git checkout code
git merge FETCH_HEAD
```

## Licenses

This repository is dual-licensed from two MIT-licensed projects:

- **Loophole work** — Copyright (c) 2026 Loophole AI, MIT License (see [LICENSE](./LICENSE))
- **Upstream opencode** — upstream MIT License (see [LICENSE-opencode.md](./LICENSE-opencode.md))

See [NOTICE.md](./NOTICE.md) for attribution details.
