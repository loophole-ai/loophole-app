# Patch System

Loophole is maintained as a set of **patches on top of upstream opencode** (the same model
as VSCodium on top of VS Code). Loophole-specific changes never live as a long-lived fork
diff — they live in `patches/` + `assets/` and can be applied to any upstream snapshot.

## Layout

```
upstream/opencode.json   pinned upstream commit ({ref, commit})
patches/
  0001-rebrand-core.patch      branding, i18n strings, logo refs, service discovery, TUI/App
  0002-licensing-docs.patch    proprietary license, READMEs, NOTICE, stats workflow, CLI licensing
  0003-desktop-channels.patch  desktop update channel, support/issue links, desktop metadata
  0004-desktop-name.patch      desktop product name, About heading, first-launch splash
  0005-telemetry-posthog.patch opt-out aggregate telemetry (LOOPHOLE_TELEMETRY_DISABLE=1)
  0006-main-screen.patch       larger animated wordmark, composer docked to the bottom
  0007-about-page.patch        clean Loophole About page (no upstream credits/trivia)
  0008-pi-tui.patch            pi-TUI snapshot used by the terminal screen
  0009-pi-default-command.patch make pi-TUI the default interactive CLI
  0010-loophole-screen.patch   Loophole terminal screen (@loophole/screen)
  0011-screen-daily-use.patch  daily-use polish for the new screen
  0012-screen-cleanup.patch    screen cleanup
  0013-full-command-set.patch  expose every OpenCode slash command in the new screen
  0014-home-screen.patch       full-width welcome box, three-zone footer, @ file mentions
  0015-home-composer.patch     Loophole wordmark, borderless composer, /diff fallback
  0016-rich-diff-and-approval.patch  diff panels, approval dialog with feedback, bordered prompts
  0017-home-polish.patch       boxed composer, provider login, flat model picker, settings hub
  0018-screen-polish.patch     narrow wordmark, provider-first models, model persistence, live rename
  0019-stats-update-palette.patch  /stats usage report, /update, Ctrl+Shift+P command palette
  0020-cli-name-and-search.patch  loophole-cli/lhc install name, Preparing server line, search in pickers
  0021-session-title-version.patch  keep renamed session titles in sync; CLI 1.1.4
  0022-branding-and-picker.patch  drop the last OpenCode strings; harden the filter pickers
  0023-picker-identity-retry.patch  confirm rows in every picker; Loophole identity; free-router hint
  0024-connect-search.patch  search the /connect provider list
  0025-desktop-inbox-and-close.patch  make Inbox the only desktop layout; close projects
  0026-tool-cards.patch  framed tool-call cards in the terminal screen
  0027-shell-mode.patch  run `!` commands locally instead of sending them to the model
  0028-tool-card-repaint.patch  repaint finished tool cards; local shell says running…
  0029-desktop-ship-polish.patch  desktop updater only moves forward; metadata and issue links
  0030-desktop-menu-brand.patch  Windows app menu heading says Loophole instead of OpenCode
  0031-upstream-sync-tool-namespace.patch  newer upstream tests follow the Loophole tool namespace
  0032-cli-upgrade-npm.patch  resolve CLI updates from the npm registry; fix the curl installer URL
  0033-user-facing-paths.patch  user-facing config/log file and directory names say loophole
  0034-desktop-wordmark-polish.patch  hide the OpenCode ghost behind the desktop wordmark; dull it and show the desktop version
  0035-cli-visual-polish.patch  live elapsed time on running cards; ranked-result count on search cards
  user/                        optional extra patches, applied after the numbered stack
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

## pi-TUI and the Loophole terminal screen

`0008-pi-tui.patch` is the recovered pi-TUI snapshot and **is** part of the applied stack. The
older note that it "does not compile" applied to the archived copy: its `interactive.ts`
imported `createTuiAdapter`, which the snapshot's `tui-adapter/index.ts` no longer exports.
That import is fixed in the applied patch, so the archived copy is obsolete.

`0009-pi-default-command.patch` makes the pi-TUI screen the default interactive interface
(`LOOPHOLE_TUI=mini` and piped stdin/stdout keep the old plain UI). `0010`-`0013` build the
Loophole terminal screen on top of it.

`0014-home-screen.patch` is the visual pass on that screen: the bordered welcome box with the
greeting and `Directory:` / `Session:` / `Model:` / `Version:` rows, the three-zone footer
(identity and badges left, directory centred, context percentage and key hints right), `@` file
mentions wired into the prompt as `file://` attachments, and all nine upstream slash-command aliases
listed as their own palette rows (47 commands total). It touches only the screen and its controller;
the engine, the server and command behaviour are unchanged.

`0015-home-composer.patch` refines that screen: the welcome box spans the full terminal width and
carries the `loophole` half-block wordmark, the footer drops its rule, the composer becomes a single
`── input ──` header with no side or bottom border, `/diff` falls back to the files a session
touched when no git snapshot exists, and a staged `/undo` is committed before the next prompt.

`0016-rich-diff-and-approval.patch` brings the rest of the visual pass: unified diffs are parsed
into line-numbered rows with tinted additions/removals, `/diff` renders one bordered panel per file,
the approval dialog is a bordered panel with numbered choices and a diff/command preview, and
"Reject, tell the model what to do instead" forwards the typed feedback as a permission correction.
Pickers, structured questions and text prompts share the same bordered panel, and finished tool
calls show a ✓/✗ mark plus their elapsed time.

`0017-home-polish.patch` restores the boxed composer (only the footer rule is gone), reports the
real context usage as `context: N% (used/limit)`, and adds the rest of the home-screen workflow:
`/connect` (and its `/login` alias) lists providers with their key/OAuth/command/external methods,
asks optional method form fields, and refreshes models after connecting; `/models` is one flat
list with the provider in the label and the current row marked; `/settings` is an interactive hub
for model, thinking effort, agent, theme, auto-approve, directory, providers, config files, MCP,
plugins, usage and debug info. A one-shot `✦` release announcement sits under the welcome panel,
the wordmark is trimmed to three rows, and assistant/thinking blocks drop the duplicate leading
blank line and trailing padding that produced extra gaps in the transcript.

`0018-screen-polish.patch` finishes the home-screen pass: the wordmark uses the taller `narrow`
art, the `✦` announcement sits above the `✓ Ready` line, and the welcome panel updates live so a
session rename immediately changes its `Session:` row. `/models` is now a provider-first picker
(with `/models <provider>` jumping straight in), model rows no longer repeat the provider, and the
last model is remembered in `~/.local/state/loophole/screen.json` across launches (an explicit
`--model` still wins). `/diff` unwraps the `session.diff` response and falls back to the
working-tree diff, `/compact` streams the compaction summary the way OpenCode does, and `/help`,
`/version`, `/changelog`, `/feedback`, `/title`, `/mcp`, `/theme`, `/reset` and `/upgrade` join the
palette with their aliases as visible rows.

`0019-stats-update-palette.patch` adds the last three daily-driver commands. `/stats` mirrors
`loophole stats --full`: an activity heatmap, session/prompt/step counts, tool success, active
days and best streak, then cost and token breakdowns, per-model usage and per-tool reliability.
It accepts `all`, a number of days, or `cost` / `models` / `tools` to show a single section.
`/update` runs this build's own `upgrade` command in a child process (optional version argument)
and prints the updater output in the transcript; it never updates on launch. `Ctrl+Shift+P`
(and plain `Ctrl+P` on terminals that cannot distinguish the two) opens a filterable command
palette containing every built-in command, every alias, and the server's custom commands.

`0020-cli-name-and-search.patch` settles the install identity and the long-list pickers. The CLI
binary is now `loophole-cli` (with `lhc` as a short alias), installed into `~/.loophole/bin`, and
the desktop CLI installer, updater detection, ACP auth hint, help text, and user-facing command
hints all use that name; stale `loophole`/`loophole2` binaries are removed on install. The startup
line now reads `Preparing server...` (and `Preparing server (version mismatch)...` when replacing
an older service) instead of mentioning the background server. `/models` now filters as you type,
and the same filter applies to `/sessions`, `/open`, and `/skills`, so a 350-model OpenRouter list
is searchable instead of scroll-only. The `/stats` activity calendar drops the blank line between
weekday rows and uses a five-step glyph gradient, so the whole year reads as one compact heatmap.

`0021-session-title-version.patch` keeps a renamed session's title in sync everywhere. The active
title is tracked in the controller, refreshed by `session.renamed` events (including renames from
the desktop or another client), shown by `/status` and `/debug`, and preferred in the `/sessions`
picker, so it is not only the welcome box that updates. It also pins the CLI version to `1.1.4` in
the package metadata and in every CLI/desktop build workflow.

`0022-branding-and-picker.patch` removes the last places where the product still introduced itself as
OpenCode. The generic and per-model system prompts, the `/changelog` highlights, the web-search
permission prompt, the model-resolution error, the ChatGPT OAuth agent name, the OAuth callback page
(now a plain text wordmark), the MCP `add` hint, the update dialog, the stats poster and the
"model not found" hint all say Loophole. The built-in `opencode` skill is gone, the `report` skill is
rebranded, and the model-visible tool namespace is now `loophole` (`tools.loophole.session_move`,
`loophole_list_mcp_resources`, ...). The filterable pickers are also hardened: a resolved picker
ignores repeated Enter/Escape, Enter confirms the highlighted row explicitly, and any open slash/path
autocomplete is dismissed before a picker takes focus. Retry status lines now include the provider's
reason, e.g. `Request failed: <reason> - retrying (attempt 2)...`.

`0023-picker-identity-retry.patch` fixes confirming a row in every picker, makes the assistant introduce
itself as Loophole, and explains free-model retries. Pickers (filterable or not) now share one focused
host that handles Enter and Escape itself and accepts every Enter encoding (CR, LF, SS3 numpad, Kitty
CSI-u, xterm modifyOtherKeys), so a highlighted model is selected regardless of the terminal's keyboard
protocol. The `identity` plugin now tells the model it is Loophole, an AI agent built by Loophole AI,
and never to present itself as the underlying model or provider; the generic and per-model prompts say
the same. Provider errors prefer an upstream explanation over a gateway's generic "Provider returned
error", and retry status shows the real reason, `(Esc to stop)`, and (for OpenRouter `:free` models) a
hint pointing at the Free Models Router, which now sits at the top of OpenRouter's model list as
"Free Models Router".

`0024-connect-search.patch` makes `/connect` (and its `/login` alias) searchable. The provider list can
hold 350+ integrations, so it now opens the same filterable picker as `/models`: type to narrow by
provider name, method, environment variable or connection label, then Enter connects. It uses the
shared picker host from `0023`, so Enter/Escape behave the same in every terminal.

`0025-desktop-inbox-and-close.patch` makes the desktop app's Inbox the only interface and lets a
project be closed. The Interface setting (top tabs / side tabs / inbox) is gone, its preview component
and styles are deleted, the default layout is Inbox, and the settings accessor always renders the inbox
layout even when an older build stored another value. The Projects settings list now shows the projects
this client has open, and each row's menu plus the project settings header gain a Close action that
removes the project from this client's lists (the folder and its sessions stay on disk/server);
closing from the project page returns to the Projects list.

`0026-tool-cards.patch` restyles the transcript after oh-my-pi's terminal UI: every tool call is now a
rounded framed card (`╭─ ✓ Edit  src/app.ts ─── +12/-3 ─╮` … `╰─ 1.2s · ctrl+o expand ──╯`). The top
border carries the status glyph, tool name and key argument plus diff statistics (or `failed`), the
bottom border carries the duration, the expand hint and `esc to interrupt` while running, and the frame
is accent-coloured while running, neutral on success and red on failure. The shared panel gains
right-aligned `meta` and left-aligned `footer` border facts, so pickers and approvals keep their look.

`0027-shell-mode.patch` makes the composer's `!` shell mode actually run commands. The editor already
switched to bash mode visually; submitting now carries that mode to the controller, which runs the
command locally (ComSpec/cmd on Windows, `$SHELL` or `/bin/sh` elsewhere) in the session directory
instead of sending it to the model. The run appears as a normal Shell tool card with the usual live
spinner, duration, success/error frame and expandable stdout/stderr, and the composer returns to prompt
mode after each command.

`0028-tool-card-repaint.patch` makes a finished tool card repaint immediately. The spinner used to be
the only thing asking the screen for frames, so when a local `!` command (or any tool result) stopped
it, the terminal kept showing the last running frame until an unrelated key press forced a redraw — the
command had finished in 40ms but looked stuck on `esc to interrupt`. `setResult` now requests the final
frame itself, and a locally-run shell card says `running…` while it works instead of promising an Esc
interrupt it cannot honour.

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
