# Changelog

All notable changes to the Loophole CLI and desktop app.

Format: a `## v<version>` section per release; release notes are generated from
the section matching the version being published, so add one when cutting a release.

## v2.3.0 — 2026-11-13

### Highlights

- **Background Subagents by Default**: Subagents now return immediately, continue in the background, and report back whenever they become idle. You can keep working in the parent session while multiple subagents run concurrently. ([#63382](https://github.com/anomalyco/opencode/pull/63382))
- **Quieter Transcripts by Default**: The TUI now summarizes each run of tool calls and thoughts into one collapsible activity row, so the answer is easier to follow. To see every step again, set **Verbosity** to `medium` or `high` in settings, or set `session.verbosity` in your TUI config; an existing setting is kept. ([#63207](https://github.com/anomalyco/opencode/pull/63207))
- **Jump to an Earlier Prompt**: In the desktop app, open **Jump to message** from the command palette or press `Cmd+Alt+G` (`Ctrl+Alt+G` on Windows and Linux) to search prompts across the current session and jump directly to one. ([#63585](https://github.com/anomalyco/opencode/pull/63585))

### Core

#### Improvements

- Subagents now always run in the background, return their session ID immediately, and report results to their parent whenever they become idle. ([#63382](https://github.com/anomalyco/opencode/pull/63382))
- Added experimental support for MCP events, behind the `mcp_events` flag. ([#63254](https://github.com/anomalyco/opencode/pull/63254), [#63261](https://github.com/anomalyco/opencode/pull/63261), [#63269](https://github.com/anomalyco/opencode/pull/63269))
- Shell commands now survive server handoffs and keep their output when interrupted.
- Added experimental support for moving a shell command to the background when its timeout expires, behind the `shell_timeout_background` flag. With the flag on, an explicit timeout on a background command stops it. ([#63024](https://github.com/anomalyco/opencode/pull/63024), [#63703](https://github.com/anomalyco/opencode/pull/63703))
- Local Windows shell commands now run through the process daemon.
- Added support for freeform tool input on compatible models.
- Added LM Studio decision-model support.
- Agents are now told when their session is a fork. Thanks @hasta84. ([#63235](https://github.com/anomalyco/opencode/pull/63235))
- Tool output truncation now keeps the beginning of the output and preserves a usable preview if the full output cannot be saved.
- Tail reads no longer load the entire file into memory.
- Providers can present a client certificate for gateways that require mutual TLS. Set `settings.tls` with `cert`, `key` and an optional `passphrase` on the provider; values accept `{file:}` and `{env:}` like `apiKey`. ([#61832](https://github.com/anomalyco/opencode/pull/61832))
- When a subagent goes idle while its own background work is still running, its report to the parent now says it is still running, so the parent waits for the final report instead of treating the partial answer as done. ([#63675](https://github.com/anomalyco/opencode/pull/63675))
- Code Mode gets simpler structured results from file and skill tools: `write` and `edit` return their confirmation as a string, `patch` returns an empty result, and `skill` returns the skill's directory and content. ([#63616](https://github.com/anomalyco/opencode/pull/63616), [#63635](https://github.com/anomalyco/opencode/pull/63635), [#63618](https://github.com/anomalyco/opencode/pull/63618), [#63623](https://github.com/anomalyco/opencode/pull/63623))

#### Bug fixes

- Fixed case-only file renames in patches on case-insensitive filesystems.
- Fixed stale thinking being retained after Claude Agent prompts or tools change.
- Fixed directly driven child sessions not resuming after a restart.
- Fixed plugin replacement stopping when cleanup of an earlier plugin fails.
- Fixed MCP OAuth refreshes and localhost redirects when a server rewrites `127.0.0.1`.
- Fixed saved API keys being omitted from local-model discovery.
- Local model discovery (Ollama, LM Studio, vLLM) waits up to 15 seconds per request instead of 1, so remote or tunnelled endpoints list their models, and a slow endpoint no longer delays other endpoints or config reloads. ([#63700](https://github.com/anomalyco/opencode/pull/63700))
- In Code Mode, calling a namespace as if it were a tool now suggests up to three real tools under it. ([#63697](https://github.com/anomalyco/opencode/pull/63697))
- Fixed retryable provider streams losing completed work when interrupted.
- Fixed GitHub Copilot requests using the wrong endpoint before models finish loading.
- Fixed exhausted request rate limits being treated as terminal. Thanks @Kyle-j-bush. ([#59816](https://github.com/anomalyco/opencode/pull/59816))
- Fixed LM Studio models with a null context length and accepted decision-type models. Thanks @tomzhu1024. ([#56214](https://github.com/anomalyco/opencode/pull/56214))

### TUI

#### Improvements

- Transcript verbosity now defaults to `low`, which summarizes each run of tools and thoughts into one activity row. A `session.verbosity` you already set is kept. ([#63207](https://github.com/anomalyco/opencode/pull/63207))
- Session IDs found in messages can now be opened directly.
- Activity tabs are clickable and open the correct view.
- Shell mode has its own prompt color under the new designs.

#### Bug fixes

- Restored pasted text when undo brings back its placeholder.
- Restored the live draft after browsing prompt history.
- Fixed copying a paste from within the prompt selection.
- Preserved the Mini composer caret when closing the command palette.
- Prevented image bytes from being retained in transcript storage when image previews are disabled.
- Fixed paste-chip contrast across light and dark themes.
- Fixed plugin-provided themes updating live.
- Session lists now open at the top rather than at the current session.
- Mini scrollback now shows the subagent card instead of obsolete launch instructions.

### Desktop

#### Improvements

- Added **Jump to message** to the command palette with `Cmd+Alt+G` / `Ctrl+Alt+G`, including prompts not yet loaded in the timeline. Thanks @usrnk1. ([#63585](https://github.com/anomalyco/opencode/pull/63585))
- Added the experimental **Recent** sessions sidebar, with cross-server recency, local pins, reordering, and standard session-row actions.
- Recent sessions are limited to the last seven days and 30 rows, and can be hidden or muted.
- Added an experimental customizable sessions sidebar.
- Mermaid diagrams can now be maximized for zooming and panning. ([#59250](https://github.com/anomalyco/opencode/pull/59250))
- Added `Alt+Enter` to place a follow-up first in the queue and `Mod+Enter` to steer the next queued prompt.
- Holding the modifier key now shows tab shortcut numbers.
- Each server’s terminal shell can be selected from its menu.
- Added a free-limit panel in place of the composer when applicable.
- Session IDs are easier to find and copy.

#### Bug fixes

- Recent sessions now keep stable recency ordering through list reloads, renames, and completed runs.
- Fixed browser panes not retrying after server plugins finish loading.
- Fixed mention suggestions being recreated while typing.
- Fixed SSH prompts failing to advance or close after connection.
- Fixed pasted provider-auth redirect URLs being rejected.
- Restored message footers in the New timeline.
- Fixed links whose labels contain inline code.
- Fixed the desktop main process freezing while probing the login-shell environment.
- Fixed the drag region after changing layout direction.
- Fixed vertical-tab previews snapping to the wrong tab.
- Fixed the file-tree sidebar opening animation.
- Fixed pairing QR-code contrast in light themes. Thanks @ssskay. ([#63220](https://github.com/anomalyco/opencode/pull/63220))
- Fixed activity-tab navigation and click handling. Thanks @OpeOginni. ([#60168](https://github.com/anomalyco/opencode/pull/60168))

### SDK

#### Improvements

- Event subscriptions can now receive `experimental.mcp.event` events from MCP event subscriptions.
- Model capability schemas now advertise supported freeform tool-input formats.
- Session throughput is now measured from the first streamed token.
- Session creation documentation now clarifies the `parentID` field.

### Extensions

#### Improvements

- Promise-based tools can cooperatively stop through `ToolContext.signal`.
- Added the experimental `session.fork` hook.
- Promise plugin cleanup failures no longer prevent subsequent plugin replacements.
- `@opencode/plugin/effect` now exports `Tool`, so an `execute.before` hook can reject a call with `Tool.Error` without importing `@opencode/schema/tool`. ([#63698](https://github.com/anomalyco/opencode/pull/63698))

## v2.2.7 — 2026-11-10

### Highlights

- **GitHub Copilot Auto**: Pick **Auto** in the model picker when your Copilot account has an Auto pool, and Copilot's router chooses the model for each session at the Auto discount. If routing fails, OpenCode falls back to the account's default chat model. ([#62997](https://github.com/anomalyco/opencode/pull/62997))
- **Side Panel Tab Shortcuts**: Right-click a side panel tab and choose **Close tabs to the right**. `⌘W` now closes side panel tabs wherever focus is, `⌥⌘W` or `Ctrl+Alt+W` always closes the session tab, and `⌘⇧T` reopens the last closed tab of either kind where it was. ([#62922](https://github.com/anomalyco/opencode/pull/62922))
- **Mark Sessions Read or Unread**: Open the menu on a tab, Home row, project row or inbox card and choose **Mark as unread** to keep its dot until you next visit. ([#62889](https://github.com/anomalyco/opencode/pull/62889))

### Breaking changes

#### `@opencode/ai`: `ImageResponse.image` is removed

This affects code that imports `@opencode/ai` directly. Read `response.images[0]` instead of `response.image`. ([#63011](https://github.com/anomalyco/opencode/pull/63011))

#### SDK: fewer endpoints wait for plugins to load

On a Location that is still loading plugins, `agent.list` returns the agents loaded so far, and `integration.list`, `usage.limits`, `vcs.init`, `rpc.call` and `artifact.*` no longer wait up to 5 seconds. Entries and actions that a plugin provides appear when it finishes loading, so refresh on the matching `*.updated` event. Model, provider, `generate.*`, `voice.*` and `websearch.query` endpoints still wait. ([#62796](https://github.com/anomalyco/opencode/pull/62796), [#63040](https://github.com/anomalyco/opencode/pull/63040))

### Core

#### Improvements

- **MCP Logins Stay Signed In**: Remote MCP servers that rotate refresh tokens no longer sign you out when several clients refresh at once or the token endpoint fails for a moment. ([#62827](https://github.com/anomalyco/opencode/pull/62827), [#63012](https://github.com/anomalyco/opencode/pull/63012))
- `read` accepts a negative `offset` to read from the end of a file, such as `-50` for the last 50 lines. An offset past the end returns the last lines and the file's line count instead of failing. ([#62147](https://github.com/anomalyco/opencode/pull/62147))
- When `read` can't find a file, it suggests close names: different capitalization, another extension, a small typo, or the matching path inside the project. ([#62147](https://github.com/anomalyco/opencode/pull/62147))
- Shell results end with `Exit code: N`. Commands killed by a signal show the signal name, and timeouts say how long they waited and suggest a larger timeout. ([#62141](https://github.com/anomalyco/opencode/pull/62141))
- Prompt cache warming times its pings from the model's `cache.ttl` by default (`interval: "auto"`), or every 4 minutes without a TTL. Models whose cache outlasts the warming `duration` are no longer pinged. ([#62831](https://github.com/anomalyco/opencode/pull/62831))
- When MCP servers connect, disconnect or change tools, Code Mode sends the model a short list of what changed instead of the whole tool catalog. ([#62176](https://github.com/anomalyco/opencode/pull/62176))

#### Bug fixes

- GitHub Copilot session costs use the amount Copilot charged instead of the catalog estimate, and content-filter errors name the filter that blocked the response. ([#62034](https://github.com/anomalyco/opencode/pull/62034))
- GitHub Copilot picks up a new API endpoint after a plan change on its next model refresh, so you no longer have to sign in again. ([#62171](https://github.com/anomalyco/opencode/pull/62171))
- Remote MCP servers that rotate refresh tokens no longer log you out when the TUI, desktop app, background service or several projects refresh the same login at once. ([#62827](https://github.com/anomalyco/opencode/pull/62827))
- A temporary failure while refreshing an MCP OAuth token keeps your login for the next try instead of marking the server `needs_auth`. ([#63012](https://github.com/anomalyco/opencode/pull/63012))
- MCP tool calls no longer fail when the server's result doesn't match the tool's own output schema, so completed actions aren't reported as failed. ([#61254](https://github.com/anomalyco/opencode/pull/61254))
- MCP prompts stay available when refreshing a server's prompt list fails. ([#62266](https://github.com/anomalyco/opencode/pull/62266))
- With `background_compaction` on, a background summary no longer stops a running Claude Agent session mid tool call. ([#63025](https://github.com/anomalyco/opencode/pull/63025))
- After `opencode auth logout` on a `.well-known` integration, its remote providers and policies stop applying until you log back in. ([#62760](https://github.com/anomalyco/opencode/pull/62760))
- OpenCode Console workspace policies still apply when Console's instructions or skills fail to load. ([#62702](https://github.com/anomalyco/opencode/pull/62702))
- Cloudflare AI Gateway providers set up with only `gatewayApiKey` now send that key. ([#62574](https://github.com/anomalyco/opencode/pull/62574))
- A v1 model override that sets only some capabilities no longer resets the others, so catalog capabilities like PDF input are kept. ([#62573](https://github.com/anomalyco/opencode/pull/62573))
- A v1 provider config that sets both `api` and `options.baseURL` keeps `options.baseURL`. ([#62570](https://github.com/anomalyco/opencode/pull/62570))
- Legacy model references with an inline variant, such as `"openai/gpt-5#high"`, keep the variant. ([#62254](https://github.com/anomalyco/opencode/pull/62254))
- A fresh install imports saved provider credentials from the legacy `auth.json`, and skips an invalid one with a warning instead of stopping setup. ([#62568](https://github.com/anomalyco/opencode/pull/62568))
- Cache warming stops for a session when a ping rebuilds the cache instead of reading it, counts its interval from when a request was sent, and no longer pings during compaction or after the session is deleted. ([#62926](https://github.com/anomalyco/opencode/pull/62926), [#62941](https://github.com/anomalyco/opencode/pull/62941), [#62972](https://github.com/anomalyco/opencode/pull/62972))
- Tokens and cost from `session.generate` requests, including cache warming pings, count toward the session's totals. ([#63006](https://github.com/anomalyco/opencode/pull/63006))
- Under zsh, a glob that matches nothing, like `rm *.tmp`, is passed through as bash does instead of stopping the command. ([#62141](https://github.com/anomalyco/opencode/pull/62141))
- Truncated shell output that starts mid-line drops the partial first line, so the "showing lines X–Y" notice is exact. ([#62141](https://github.com/anomalyco/opencode/pull/62141))
- On Windows, multi-line commands no longer lose everything after the first line with PowerShell 7 from the Microsoft Store. ([#62522](https://github.com/anomalyco/opencode/pull/62522))
- `read` no longer cuts an emoji in half when it shortens a long line. ([#62575](https://github.com/anomalyco/opencode/pull/62575))
- Generated session titles no longer include the model's commentary. Thanks [@shanebishop1](https://github.com/shanebishop1). ([#62267](https://github.com/anomalyco/opencode/pull/62267))
- Markdown agents whose `description` starts with a bracketed tag, like `[Beta] Reviews code`, now load. ([#62250](https://github.com/anomalyco/opencode/pull/62250))
- Markdown agent and command files that fail to load log a warning with the file path and frontmatter error. ([#62464](https://github.com/anomalyco/opencode/pull/62464), [#62251](https://github.com/anomalyco/opencode/pull/62251))
- Markdown agent discovery skips `node_modules`. ([#62571](https://github.com/anomalyco/opencode/pull/62571))
- Failed plugin installs from git show git's own error instead of "An unknown git error occurred". ([#62261](https://github.com/anomalyco/opencode/pull/62261))

### TUI

#### Improvements

- The update and confirm dialogs have buttons you can move between with `←`/`→` and `Tab`/`Shift+Tab`. ([#62906](https://github.com/anomalyco/opencode/pull/62906))
- The model picker no longer has a **Usage** action; use `/usage` instead. ([#62927](https://github.com/anomalyco/opencode/pull/62927))

#### Bug fixes

- Session exports are saved in the current working directory instead of the system temp folder. ([#62253](https://github.com/anomalyco/opencode/pull/62253))
- Typing a child session's exact ID in the open-session menu lists that session. ([#62262](https://github.com/anomalyco/opencode/pull/62262))
- The TUI follows the terminal's current light or dark mode instead of a cached palette. ([#62248](https://github.com/anomalyco/opencode/pull/62248))

### Desktop

#### Improvements

- Right-click a side panel tab to **Close tabs to the right**. `⌘W` closes side panel tabs wherever focus is, the new **Close session tab** command (`⌥⌘W` or `Ctrl+Alt+W`) always closes the session tab, and `⌘⇧T` reopens the last closed side panel or session tab where it was. ([#62922](https://github.com/anomalyco/opencode/pull/62922))
- Added **Mark as read** and **Mark as unread** to the menus for tabs, Home rows, project rows and inbox cards, and **Rename** to inbox cards. ([#62889](https://github.com/anomalyco/opencode/pull/62889))
- The answer you pick in the question dock shows as a raised card. ([#62896](https://github.com/anomalyco/opencode/pull/62896))
- Inline rename and custom-answer fields no longer show a focus border. ([#62919](https://github.com/anomalyco/opencode/pull/62919))

#### Bug fixes

- On Windows and Linux, `Ctrl+Shift+R` toggles the review panel again instead of reloading the window. ([#62567](https://github.com/anomalyco/opencode/pull/62567))
- Closing the last side panel tab slides the panel shut. ([#62758](https://github.com/anomalyco/opencode/pull/62758))
- Selects, menus, tooltips and toasts opened from a dialog are reachable by screen readers. ([#62913](https://github.com/anomalyco/opencode/pull/62913))
- An error appears when a path can't be opened in its default app. ([#62572](https://github.com/anomalyco/opencode/pull/62572))
- Cut, Copy, Paste and Select All in the right-click menu follow the app language. ([#62252](https://github.com/anomalyco/opencode/pull/62252))
- Ukrainian tool titles use nouns. ([#62263](https://github.com/anomalyco/opencode/pull/62263))
- Scrolling titlebar search results no longer jumps back when late results arrive, the inbox no longer announces already-running sessions as working on load, and the quote toolbar comes back after `Escape`. ([#62597](https://github.com/anomalyco/opencode/pull/62597))

### SDK

#### Improvements

- `session.generate` returns `tokens` and `cost` along with `text`. ([#62835](https://github.com/anomalyco/opencode/pull/62835))
- `credential.updated` includes the `integrationID` and `credentialID` of the login that changed. ([#62762](https://github.com/anomalyco/opencode/pull/62762))
- Predicate questions in `client.experimental.generate.decisions` accept optional `criteria: { true?, false? }`. ([#62819](https://github.com/anomalyco/opencode/pull/62819))

### Extensions

#### Improvements

- ACP clients can redirect a running turn with the `_session/steering` extension, advertised as `_meta.steering.supported` in `initialize`. Thanks [@smagnuso](https://github.com/smagnuso). ([#54394](https://github.com/anomalyco/opencode/pull/54394))

## v2.2.6 — 2026-11-06

### Highlights

- **Shared MCP Connections**: Turn on pooling for an MCP server to share one connection across projects with the same setup, so you run fewer processes and start faster. ([#61185](https://github.com/anomalyco/opencode/pull/61185))
- **GUI Plugin Themes and New Slots**: GUI plugins can now add color themes, render or add actions to code blocks, and use native settings and menu components. ([#61485](https://github.com/anomalyco/opencode/pull/61485), [#61533](https://github.com/anomalyco/opencode/pull/61533), [#61527](https://github.com/anomalyco/opencode/pull/61527), [#61509](https://github.com/anomalyco/opencode/pull/61509))
- **Mobile Composer Dock**: On phones and tablets, composer actions now sit in a touch dock above the keyboard with larger buttons. ([#61773](https://github.com/anomalyco/opencode/pull/61773))
- **Scripted Runs in Worktrees**: Run `opencode run -w` to start the session in a new git worktree, or `--worktree=<name>` to name it. ([#60712](https://github.com/anomalyco/opencode/pull/60712))
- **Automatically Archived Runs**: Add `--archived` to `opencode run` to keep scripted and CI sessions out of your inbox and session lists. ([#61270](https://github.com/anomalyco/opencode/pull/61270))

### Core

#### Improvements

- Added opt-in MCP connection sharing through `pool: true`. ([#61185](https://github.com/anomalyco/opencode/pull/61185))
- Added `opencode run --archived`, which creates the session already archived so scripted and CI runs stay out of the inbox, home, and session lists. Archived sessions are also hidden from the TUI session list and skipped by `--continue`. ([#61270](https://github.com/anomalyco/opencode/pull/61270))
- Added `opencode run --worktree` (`-w`), which starts the session in a new git worktree. Use `--worktree=<name>` to choose the worktree name. It cannot be combined with `--continue` or `--session`. ([#60712](https://github.com/anomalyco/opencode/pull/60712))
- Added provider- and model-specific session warming settings, including an `interval: "auto"` mode based on cache TTL. ([#60025](https://github.com/anomalyco/opencode/pull/60025), [#60969](https://github.com/anomalyco/opencode/pull/60969))
- Added the `websearch.use` policy action and switches for enabling all feature flags with `OPENCODE_FLAGS=all` or `experimental.all_flags`. ([#61557](https://github.com/anomalyco/opencode/pull/61557), [#61826](https://github.com/anomalyco/opencode/pull/61826))
- Added an experimental bytecode VM for Code Mode. It is off by default; turn it on with `experimental.codemode_vm: true` or `OPENCODE_FLAGS=codemode_vm`. ([#62358](https://github.com/anomalyco/opencode/pull/62358))
- Added support for Microsoft Store installations of PowerShell 7 on Windows. ([#61952](https://github.com/anomalyco/opencode/pull/61952))
- Added Azure Messages support for Foundry Claude models. ([#60934](https://github.com/anomalyco/opencode/pull/60934))

#### Bug fixes

- `opencode run` now waits for the background shell commands, subagents, and image jobs that its prompt started, then lets the model respond to their results before it exits. While it waits, it prints `waiting for N background job(s)` (a `background_wait` event with `--format json`). There is no time limit: a job that never exits, such as a dev server or file watcher, keeps the run open until you press Ctrl+C or send SIGTERM, so set a timeout on CI jobs. ([#60699](https://github.com/anomalyco/opencode/pull/60699), [#61911](https://github.com/anomalyco/opencode/pull/61911))
- Reworked noninteractive `opencode run` execution so arguments, cancellation, compiled WebSocket upgrades, and service shutdown complete reliably. SIGTERM now cancels the session and its background jobs and exits with code 143. ([#61911](https://github.com/anomalyco/opencode/pull/61911), [#61721](https://github.com/anomalyco/opencode/pull/61721), [#61518](https://github.com/anomalyco/opencode/pull/61518), [#61564](https://github.com/anomalyco/opencode/pull/61564))
- Serve file reads and media from the server API as sandboxed downloads, and refuse cross-site browser navigations and requests from disallowed origins to `/api/*`, so a file in your project cannot run scripts on the server's origin. ([#62422](https://github.com/anomalyco/opencode/pull/62422))
- Webfetch and Code Mode `fetch` now reject URLs that contain credentials and ignore the `#fragment` when matching permission rules, and Code Mode `fetch` checks every redirect against your webfetch rules. ([#60502](https://github.com/anomalyco/opencode/pull/60502), [#61701](https://github.com/anomalyco/opencode/pull/61701), [#62373](https://github.com/anomalyco/opencode/pull/62373))
- Ask for `external_directory` permission before `session_move` leaves the current project. ([#62204](https://github.com/anomalyco/opencode/pull/62204))
- Wait up to 2 seconds for MCP servers that are still connecting before a model call, so tools from servers that connect quickly reach the first prompt and `opencode run`. Also expand `~` in local MCP working directories, handle legacy stdio servers, and send `logo_uri` during dynamic registration. ([#60490](https://github.com/anomalyco/opencode/pull/60490), [#61496](https://github.com/anomalyco/opencode/pull/61496), [#61817](https://github.com/anomalyco/opencode/pull/61817), [#59031](https://github.com/anomalyco/opencode/pull/59031))
- Time out OpenCode Console config requests after 5 seconds, so startup no longer hangs when the Console accepts the connection but never answers. ([#62404](https://github.com/anomalyco/opencode/pull/62404))
- Retry provider requests while their host is unreachable and recover prematurely ended Cohere streams. ([#61880](https://github.com/anomalyco/opencode/pull/61880), [#61184](https://github.com/anomalyco/opencode/pull/61184))
- Keep legacy custom providers whose models set only part of `limit`, such as only `limit.context`, instead of dropping the whole provider without an error. Thanks @Tarquinen. ([#62240](https://github.com/anomalyco/opencode/pull/62240))
- `opencode acp` now removes a session that a client creates with `session/new` and closes without prompting, so IDE integrations no longer leave empty sessions behind. ([#62189](https://github.com/anomalyco/opencode/pull/62189))
- Prevent repeated zsh `q` flags from freezing shell permission scanning. Thanks @yangguan-xue. ([#60791](https://github.com/anomalyco/opencode/pull/60791))
- Allow npm upgrade install scripts again. Thanks @renatomoselli. ([#51554](https://github.com/anomalyco/opencode/pull/51554))

### TUI

#### Improvements

- Added **Scroll on send** in Settings. Choose **Keep** (`session.submit_scroll: "keep"`) to retain your reading position after submitting a prompt. ([#61460](https://github.com/anomalyco/opencode/pull/61460))

#### Bug fixes

- Allow Ctrl+Z to suspend OpenCode while a form or dialog is open. ([#62118](https://github.com/anomalyco/opencode/pull/62118))
- Keep focus on an open dialog when a question arrives and contain plugin dialogs that throw during rendering. ([#60365](https://github.com/anomalyco/opencode/pull/60365), [#62110](https://github.com/anomalyco/opencode/pull/62110))
- Show an error when Ctrl+V cannot read the clipboard. Thanks @jimmyallinai. ([#61094](https://github.com/anomalyco/opencode/pull/61094))
- Prevent session titles containing newlines from crashing the TUI. Thanks @vishalshekhar. ([#57523](https://github.com/anomalyco/opencode/pull/57523))
- Improved message spacing and prevented older history from flashing while scrolling. ([#62104](https://github.com/anomalyco/opencode/pull/62104), [#59236](https://github.com/anomalyco/opencode/pull/59236))
- Jump to the first or last message with Home, End, and Ctrl+G in subagent sessions. Thanks @ricky9408. ([#60817](https://github.com/anomalyco/opencode/pull/60817))
- Keypad Home, End, Page Up, and Page Down now navigate the transcript like the main keys in terminals that use the kitty keyboard protocol. Thanks @argszero. ([#59770](https://github.com/anomalyco/opencode/pull/59770))
- `opencode mini` now uses the agent colors from your config. Thanks @ferdinandyb. ([#62067](https://github.com/anomalyco/opencode/pull/62067))
- Return to the `/mcp` list after signing in to an MCP server, with that server still selected. Thanks @Tarquinen. ([#62245](https://github.com/anomalyco/opencode/pull/62245))
- Allow favoriting models with Ctrl+F in `/models` when they come from a provider declared in config or an add-on instead of a saved connection. Thanks @Tarquinen. ([#62244](https://github.com/anomalyco/opencode/pull/62244))

### Desktop

#### Improvements

- Added a mobile composer dock for touch devices, with 44px action targets and predictable multiline input. ([#61773](https://github.com/anomalyco/opencode/pull/61773))
- Added close-other-tabs and close-tabs-after actions to the tab menu. ([#61631](https://github.com/anomalyco/opencode/pull/61631))
- Added unread-session grouping in Inbox and failed-run indicators on tabs. ([#61691](https://github.com/anomalyco/opencode/pull/61691), [#62077](https://github.com/anomalyco/opencode/pull/62077))
- MCP sign-in now accepts a pasted redirect URL when automatic redirection is unavailable. ([#61706](https://github.com/anomalyco/opencode/pull/61706))
- Markdown file previews now display frontmatter as a properties list. ([#60333](https://github.com/anomalyco/opencode/pull/60333))
- The command palette shows a date instead of "Xd ago" for sessions 7 or more days old. Hover the time to see the full date and time. ([#62314](https://github.com/anomalyco/opencode/pull/62314))
- Prompt history now keeps up to 200 prompts. Past the newest 100, only prompts without attachments are kept. ([#62313](https://github.com/anomalyco/opencode/pull/62313))

#### Bug fixes

- Improved prompt submission and timeline behavior during loading, reconnects, retries, scrolling, compaction, and optimistic delivery. ([#62025](https://github.com/anomalyco/opencode/pull/62025), [#62037](https://github.com/anomalyco/opencode/pull/62037), [#61932](https://github.com/anomalyco/opencode/pull/61932), [#62151](https://github.com/anomalyco/opencode/pull/62151))
- Surface loading and offline failures in review previews, file search, details, Word pages, and review diffs instead of showing empty or clean results. ([#62114](https://github.com/anomalyco/opencode/pull/62114), [#61862](https://github.com/anomalyco/opencode/pull/61862))
- Fixed provider connection, MCP sign-in, settings, and plugin loading flows that could become stuck after failures. ([#62102](https://github.com/anomalyco/opencode/pull/62102), [#61917](https://github.com/anomalyco/opencode/pull/61917), [#61580](https://github.com/anomalyco/opencode/pull/61580))
- Preserve drafts, focus, caret position, queued prompts, and selected terminal tabs across failed or concurrent transitions. ([#61579](https://github.com/anomalyco/opencode/pull/61579), [#61969](https://github.com/anomalyco/opencode/pull/61969), [#61852](https://github.com/anomalyco/opencode/pull/61852))
- Restart plugins after failed update handoffs and recover the renderer, storage, event stream, and background-service connection from transient failures. ([#61649](https://github.com/anomalyco/opencode/pull/61649), [#61908](https://github.com/anomalyco/opencode/pull/61908), [#61804](https://github.com/anomalyco/opencode/pull/61804), [#61748](https://github.com/anomalyco/opencode/pull/61748))
- Corrected V2 file labels and mention syntax. Thanks @velmet and @cheapredwine. ([#55677](https://github.com/anomalyco/opencode/pull/55677), [#60737](https://github.com/anomalyco/opencode/pull/60737))
- Attach only the `@mentions` in a line comment that match an existing file or folder, so a comment such as `Check @here` no longer fails the send. Render partial diffs in the review pane when it shows all lines, instead of a blank pane. Thanks @Tarquinen. ([#62242](https://github.com/anomalyco/opencode/pull/62242), [#62241](https://github.com/anomalyco/opencode/pull/62241))
- Keep pasted images sendable after the clipboard tool deletes its temporary file. Thanks @lfscqk67. ([#62057](https://github.com/anomalyco/opencode/pull/62057))
- While an input method is composing text, Escape, Enter, and Tab go to the input method instead of stopping the agent or picking a suggestion. ([#62318](https://github.com/anomalyco/opencode/pull/62318))
- Fixed padding in the WSL distribution picker, the position of worktree and branch labels in Home search results, and the selected ring on the Interface layout setting. Thanks @inuyume. ([#53676](https://github.com/anomalyco/opencode/pull/53676), [#62317](https://github.com/anomalyco/opencode/pull/62317), [#62309](https://github.com/anomalyco/opencode/pull/62309))

### SDK

#### Improvements

- Added `client.experimental.job.list()` and its Effect equivalent for listing background shell, subagent, and image jobs, with session, descendant, kind, and status filters. ([#60698](https://github.com/anomalyco/opencode/pull/60698))
- Server embedders can provide a custom `fetch` implementation for OpenCode HTTP, model, web, and remote MCP traffic. ([#61582](https://github.com/anomalyco/opencode/pull/61582))

### Extensions

#### Improvements

- Added `CodeBlock` and `CodeBlockAction` GUI registries for custom fenced-code rendering and actions. ([#61533](https://github.com/anomalyco/opencode/pull/61533))
- GUI plugins can contribute themes through the `Theme` registry. ([#61485](https://github.com/anomalyco/opencode/pull/61485))
- Added `ctx.ui.Select`, settings layout components, and menu-row components for native-looking plugin interfaces. ([#61527](https://github.com/anomalyco/opencode/pull/61527))
- GUI plugin side panels can set, read, and persist their preferred width. ([#61509](https://github.com/anomalyco/opencode/pull/61509))

#### Bug fixes

- Isolated plugin dialogs, Markdown renderers, terminal views, lazy chunks, and artifact viewers so failures do not take down their host surface. ([#62110](https://github.com/anomalyco/opencode/pull/62110), [#62123](https://github.com/anomalyco/opencode/pull/62123), [#61993](https://github.com/anomalyco/opencode/pull/61993))

## v2.2.5 — 2026-10-30


## v1.1.6

### Fixed

- `loophole-cli upgrade` no longer fails with **Timed out** on slow connections: package installs now get 20 minutes instead of 5, which matters because a platform package is ~250 MB.
- `loophole-cli upgrade` no longer passes `--allow-scripts` to npm, which is not a valid npm flag.

### Changed

- Release notes are generated from `CHANGELOG.md`, so every release page lists what changed.

## v1.1.5

### Added

- Custom OpenAI-compatible providers: connect an endpoint with its base URL and model id.
- Model list in the editor and desktop app now shows every model from every connected provider, with per-model switches.
- Autocomplete settings: enable, choose the model, and store the Inception key.
- Voice input over WebSocket, with live transcript into the composer.
- Slash commands and skills from the CLI, available from the composer.
- Permission cards: allow once, allow always, or deny before a tool runs.

### Changed

- Only two modes, **Plan** and **Build**, matching the CLI's own agents.
- Token and context counts come from the CLI session, so they start at zero and grow with real usage.
- Provider, model, and integration reads retry while the CLI finishes starting instead of failing with 503.
- The editor reuses the existing session database, so updating never appears to wipe sessions or statistics.

### Fixed

- The CLI refused to start in the editor: the launch password was never passed to it.
- The editor resolved its own `loophole` shim instead of the CLI and reported "exited code 0".
- `PATCH /api/config` was sent fields the CLI rejects, causing a 400 validation error.
- Readiness timeout raised for slow cold starts with a large model catalog.

## v1.1.4

### Added

- Bundled CLI inside the desktop app.
- Inception-only fill-in-the-middle autocomplete (Mercury Edit 2).

### Fixed

- License text and npm metadata now describe the Loophole license.
