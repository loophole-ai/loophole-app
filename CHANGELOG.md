# Changelog

All notable changes to the Loophole CLI and desktop app.

Format: a `## v<version>` section per release; release notes are generated from
the section matching the version being published, so add one when cutting a release.

## v1.1.9 — 2026-11-18

### Highlights

- **`loophole commit`**: Write a conventional-commit message for the staged diff with the server model and commit with one command. Pass `--message` to skip model generation, `--dry-run` to preview, `--yes` to skip confirmation, `--model provider/model` to pick the model.
- **`loophole doctor`**: Check Loophole and its environment in one pass — runtime, git, global paths, database, config, and server reachability. Machine-readable with `--json`.
- **`loophole export-zip <session>`**: Export a session as a `.zip` containing `transcript.md`, `session.json` and diagnostics — share it, attach it to an issue, or back it up.
- **`loophole import-sessions <source...>`**: Import session exports in bulk from files, directories, or URLs.

### CLI

#### Improvements

- Screen TUI: new `/todo` command shows the newest todo list written by the model (restored when resuming a session).
- Screen TUI: new `/handoff [agent]` command forks the current session and switches to another agent, preserving the standing goal.
- Screen TUI: new `/plan-review` command treats your next message as a plan to critique instead of implementing it.
- Screen TUI: new `/goal <text>` command attaches a standing objective to every message until cleared with `/goal clear`.

### Core

#### Bug fixes

- Session exports with a UTF-8 or UTF-16 byte-order mark (common on Windows) now import correctly.

## v2.4.1 — 2026-11-23

### Highlights

- **macOS 12 Session Fix**: OpenCode can save assistant messages again on the older SQLite version included with macOS 12. ([#65771](https://github.com/anomalyco/opencode/pull/65771))
- **Config-Only Providers Show Their Models**: Providers you set up only in your config, such as Ollama, now show their models in `/models` without a `/connect` login. ([#65793](https://github.com/anomalyco/opencode/pull/65793))
- **Unread `/btw` Answers**: When a side question finishes behind another side-panel tab, its tab shows an unread dot until you open it. ([#65821](https://github.com/anomalyco/opencode/pull/65821))

### Core

#### Improvements

- With `experimental.model_speeds` enabled, model service tiers are exposed as remembered speeds instead of separate model-picker entries. ([#65749](https://github.com/anomalyco/opencode/pull/65749))

#### Bug fixes

- Fixed assistant messages failing to save on macOS 12 because its system SQLite does not support the JSON operator used in v2.4.0. ([#65771](https://github.com/anomalyco/opencode/pull/65771))
- Fixed compaction retaining more recent history than `keep.tokens`, including when a single newest message already exceeds the allowance. ([#65768](https://github.com/anomalyco/opencode/pull/65768))
- Fixed occasional extra cache cost in long goal sessions after a compaction. ([#65788](https://github.com/anomalyco/opencode/pull/65788))

### TUI

#### Improvements

- With `experimental.model_speeds` enabled, `/speed` and `/fast` list the current model’s service tiers and relative prices. The `speed.list` and `speed.cycle` keybinds are available without default bindings. ([#65749](https://github.com/anomalyco/opencode/pull/65749))

#### Bug fixes

- Fixed `/models` hiding models from config-only providers such as Ollama when no `/connect` login exists. ([#65793](https://github.com/anomalyco/opencode/pull/65793))

### Desktop

#### Improvements

- With `experimental.model_speeds` enabled, models with service tiers have a speed dropdown beside the variant selector; `/speed` cycles through the available speeds. ([#65749](https://github.com/anomalyco/opencode/pull/65749))
- Layout choices in Settings now use consistent navigation-card previews and accent styling. ([#65757](https://github.com/anomalyco/opencode/pull/65757), [#65800](https://github.com/anomalyco/opencode/pull/65800))

#### Bug fixes

- Fixed `/btw` answers completed behind another side-panel tab providing no unread indication. The tab now shows a dot until viewed. ([#65821](https://github.com/anomalyco/opencode/pull/65821))
- Fixed the timeline, Home list, file viewers and tool output adding invisible or oversized stops to keyboard Tab navigation. They remain focusable by clicking for keyboard scrolling. ([#65758](https://github.com/anomalyco/opencode/pull/65758), [#65785](https://github.com/anomalyco/opencode/pull/65785))
- Fixed unwanted focus rings around clicked Settings pages, error details, What’s New and the terminal, and corrected the split button’s focus-ring corners. ([#65783](https://github.com/anomalyco/opencode/pull/65783), [#65785](https://github.com/anomalyco/opencode/pull/65785))
- Fixed folder paths showing middle-truncation markers unnecessarily at fractional UI zoom levels. ([#65225](https://github.com/anomalyco/opencode/pull/65225))

### SDK

#### Bug fixes

- An aborted shared event subscription now stops immediately even when the source has already completed or failed with buffered events remaining. Thanks @chirag127. ([#65441](https://github.com/anomalyco/opencode/pull/65441))

### Extensions

#### Improvements

- Effect and Promise plugins can create, list and delete automations through `ctx.experimental.automation.{create,list,delete}`. ([#65747](https://github.com/anomalyco/opencode/pull/65747))
- `@opencode/plugin` now supports `@opentui/core` and `@opentui/solid` from version 0.8.0, allowing plugins capped below OpenTUI 0.9 to install again. ([#65819](https://github.com/anomalyco/opencode/pull/65819))

## v2.4.0 — 2026-11-23

### Highlights

- **Built-In Desktop Browser**: Import your sign-ins and browsing history from Chrome, Edge, Firefox or Safari, and add extensions from Chromium browsers or the Chrome and Edge stores. Everything stays in one persistent desktop profile: chat links open signed in, your tabs survive restarts and the agent can read and drive the same pages without you switching apps. ([#63002](https://github.com/anomalyco/opencode/pull/63002), [#65073](https://github.com/anomalyco/opencode/pull/65073))
- **Automations**: Ask the agent to run a prompt, a script or a shell command on a timer, on a cron schedule or when an MCP server sends an event, and manage them with `/automation`. Set `"automations": false` in your config if you don't want them. ([#65296](https://github.com/anomalyco/opencode/pull/65296), [#65186](https://github.com/anomalyco/opencode/pull/65186))
- **Generate Videos**: When a connected provider has a video model, the agent can make videos with `generate_video`. It keeps working while the video renders and saves the files into your workspace when they're ready. ([#63666](https://github.com/anomalyco/opencode/pull/63666), [#65664](https://github.com/anomalyco/opencode/pull/65664))
- **New TUI Look**: The TUI's new designs are on by default, and the `opencode` theme is the new one. Pick `opencode-classic` in **Theme** to keep the previous colors. ([#64988](https://github.com/anomalyco/opencode/pull/64988))
- **Windows Taskbar Status**: On Windows, the taskbar button shows session progress, counts sessions that need you and flashes when a permission or question is waiting. ([#65317](https://github.com/anomalyco/opencode/pull/65317), [#65318](https://github.com/anomalyco/opencode/pull/65318), [#65319](https://github.com/anomalyco/opencode/pull/65319))

### Upgrade notes

- **Image tool renamed.** `experimental_image_generate` is now `generate_image`. Permission rules with the old name are mapped automatically, but saved "always allow" approvals are not, so it asks again once. ([#65682](https://github.com/anomalyco/opencode/pull/65682))
- **Plugins that follow a version now update on their own.** A plugin written as `name@latest`, a version range (such as `name@^1.2.0`), a Git branch or a Git `semver:` range is checked on startup and every 24 hours, and a newer match is installed and reloaded. Ranges never leave their range, and if a new version fails to load the previous one keeps running. A bare `name`, an exact version, another tag such as `@next`, a Git tag or a commit hash doesn't update itself; `opencode plugin update` still updates those by hand. ([#64764](https://github.com/anomalyco/opencode/pull/64764), [#65052](https://github.com/anomalyco/opencode/pull/65052), [#65056](https://github.com/anomalyco/opencode/pull/65056))
- **GitHub Copilot no longer reads `GITHUB_TOKEN`.** Set `COPILOT_GITHUB_TOKEN` or sign in with OAuth. ([#64697](https://github.com/anomalyco/opencode/pull/64697))
- **MCP servers are tried on the newest protocol first.** A server without a `protocol` setting is probed before falling back to the legacy handshake. Set `protocol: "legacy"` on a server that misbehaves. ([#65282](https://github.com/anomalyco/opencode/pull/65282))
- **The TUI `opencode` theme changed.** It now means the new theme; set `opencode-classic` for the previous look, and `experimental["new-designs"]: false` in your TUI config for the previous designs. ([#64988](https://github.com/anomalyco/opencode/pull/64988))
- **Chat links open in the browser pane.** In the desktop app, web links from the chat open beside the conversation. Modifier-click a link to open it in your system browser. A `browser` deny in your permission rules refuses every agent browser call. ([#63002](https://github.com/anomalyco/opencode/pull/63002))
- **OpenCode Go connects through OpenCode.** The connect dialogs and `opencode auth login` list one **OpenCode** option that includes Go models. **OpenCode Go** is only listed when a Go key is already saved, and saved keys keep working. ([#65466](https://github.com/anomalyco/opencode/pull/65466))
- **New desktop shortcut.** `Cmd+Shift+S` (`Ctrl+Shift+S` on Windows and Linux) now archives the open session. The composer's `Cmd+U` and `Escape`/`Ctrl+G` now follow the **Attach file** and **Stop session** shortcuts. ([#65428](https://github.com/anomalyco/opencode/pull/65428), [#64394](https://github.com/anomalyco/opencode/pull/64394))
- **Code Mode session tool paths moved.** `tools.opencode.session_rename` and `session_move` are now `tools.opencode.session.rename` and `.move`. Direct tool names and permission actions are unchanged. ([#65080](https://github.com/anomalyco/opencode/pull/65080))
- **TUI plugins need OpenTUI 0.9.4.** `@opencode/plugin` requires `@opentui/core` and `@opentui/solid` 0.9.4 or later. Renderers passed to `registerCodeBlockRenderer` now receive an OpenTUI block (`block.text`) instead of a Markdown token; `codeBlockStyle` and `escaped` are gone. ([#63989](https://github.com/anomalyco/opencode/pull/63989))
- **SDK: plugins load in the background again.** Plugins are meant to load asynchronously, and the server never waits for them. In v2.2.7 the model, provider, `generate.*`, `voice.*` and `websearch.query` endpoints started waiting up to 5 seconds for plugins and returning 503 after that ([#63040](https://github.com/anomalyco/opencode/pull/63040)); this release removes that wait. Right after startup these endpoints answer with whatever has loaded, so a list can be empty or partial. Long-lived clients should refresh on the matching `*.updated` event, such as `model.updated`. One-shot scripts should wait on their side, for example by polling `plugin.list` until it returns plugins, or the endpoint until the entry they need appears. ([#63814](https://github.com/anomalyco/opencode/pull/63814))
- **Desktop voice needs a matching server.** The app reads each voice model's engine, which older servers don't report, so voice shows as unavailable against a server from before this release. ([#65506](https://github.com/anomalyco/opencode/pull/65506))
- **Storage write path.** Assistant parts are now saved as their own rows. `experimental.part_rows: false` restores the old path for this release. ([#65039](https://github.com/anomalyco/opencode/pull/65039))

### Core

#### Improvements

- Added automations. Agents can schedule prompts, Code Mode scripts or fixed shell commands to run once, on an interval, on a cron schedule or when a connected MCP server pushes an event. Use the `/automation` command or the `automation` tools. A shell action asks for approval once, when it's created, and records each run's exit code and output. Set `"automations": false` to turn them off. ([#65296](https://github.com/anomalyco/opencode/pull/65296), [#65186](https://github.com/anomalyco/opencode/pull/65186), [#65217](https://github.com/anomalyco/opencode/pull/65217), [#65236](https://github.com/anomalyco/opencode/pull/65236), [#65001](https://github.com/anomalyco/opencode/pull/65001), [#65699](https://github.com/anomalyco/opencode/pull/65699))
- MCP Events shipped: OpenCode follows the MCP Events beta for push delivery, with argument checks, heartbeats and automatic reconnects. An event too large for its prompt is skipped and its automation keeps running. ([#65271](https://github.com/anomalyco/opencode/pull/65271), [#65673](https://github.com/anomalyco/opencode/pull/65673))
- MCP servers without a `protocol` setting now negotiate the newest MCP protocol and fall back to the legacy handshake. ([#65282](https://github.com/anomalyco/opencode/pull/65282))
- Agents can generate videos with `generate_video` whenever a connected provider has a video model. The job runs in the background, survives a server restart, saves the finished videos into the workspace and wakes the agent with their paths. Set a default model with `experimental.video_generate.model`. The image tool is now called `generate_image`. ([#63666](https://github.com/anomalyco/opencode/pull/63666), [#64546](https://github.com/anomalyco/opencode/pull/64546), [#65664](https://github.com/anomalyco/opencode/pull/65664), [#65682](https://github.com/anomalyco/opencode/pull/65682))
- Plugins that follow a version (`name@latest`, a version range, a Git branch or a Git `semver:` range) are checked on startup and every 24 hours, and a newer match is installed and reloaded without a restart. A range stays within its range, and if a new version fails to load, the previous one keeps running. Other plugins still only report updates. ([#64764](https://github.com/anomalyco/opencode/pull/64764), [#65052](https://github.com/anomalyco/opencode/pull/65052), [#65056](https://github.com/anomalyco/opencode/pull/65056))
- The Claude Agent provider has a `configDir` setting for a Claude config folder other than the default. Given a list of folders, a chat moves to the next account when one hits its usage limit. Claude Agent sessions also show up in Claude Code as coming from `opencode`. ([#62514](https://github.com/anomalyco/opencode/pull/62514), [#65035](https://github.com/anomalyco/opencode/pull/65035), [#65016](https://github.com/anomalyco/opencode/pull/65016))
- Removing a Sign in with ChatGPT account, with `opencode auth logout` or the remove button in the app, now also revokes it with OpenAI. ([#64947](https://github.com/anomalyco/opencode/pull/64947))
- The ChatGPT plan model lists now come from models.dev, so new models show up without an OpenCode update. ([#65579](https://github.com/anomalyco/opencode/pull/65579))
- Voice models are now listed from models.dev, adding newer OpenAI models such as `gpt-live-1.1`. ([#65491](https://github.com/anomalyco/opencode/pull/65491))
- Reading far into a large file with `read`, or reading its tail, takes far fewer reads, which is much faster on remote workspaces. ([#65611](https://github.com/anomalyco/opencode/pull/65611))
- The shell tool's result says why a command ended without an exit code, and lists its output after the smaller fields so they survive truncation. ([#65365](https://github.com/anomalyco/opencode/pull/65365), [#65513](https://github.com/anomalyco/opencode/pull/65513))
- Code Mode scripts can define getters and setters, errors have a `stack` showing where they were thrown, and a failed import says why. ([#64908](https://github.com/anomalyco/opencode/pull/64908), [#64939](https://github.com/anomalyco/opencode/pull/64939), [#64587](https://github.com/anomalyco/opencode/pull/64587))
- A `timeout` set on a provider now applies to every request, including image, video, speech, transcription, embedding and compaction requests, which previously could hang forever on a stalled provider. ([#64692](https://github.com/anomalyco/opencode/pull/64692))
- Gemma 4 models on Google's Interactions API offer the `none` and `thinking` variants, and the provider's `safetySettings` are sent to Interactions. ([#65038](https://github.com/anomalyco/opencode/pull/65038), [#65036](https://github.com/anomalyco/opencode/pull/65036))
- Added `claude-agent` as a web search provider. With Claude Agent connected, set `"websearch": { "provider": "claude-agent" }` to run `websearch` through Claude Code's WebSearch, which Claude plans include, so any model can search without a search API key. ([#65704](https://github.com/anomalyco/opencode/pull/65704))
- With `full_codemode` on, agents can call `tools.opencode.session.interrupt` to stop another session, its background jobs and its subagents. ([#65718](https://github.com/anomalyco/opencode/pull/65718))
- Stored blobs, such as generated videos, are deleted a week after they were written, so the data folder no longer grows without limit. Copies saved into your project are untouched; `GET /api/experimental/blob/:id` returns 404 for a deleted blob. ([#65671](https://github.com/anomalyco/opencode/pull/65671))
- Config now reloads only when a file that feeds it changes, not on every write under `.opencode` such as editing a skill. ([#62158](https://github.com/anomalyco/opencode/pull/62158))
- Each streamed assistant part is saved as its own row instead of rewriting the whole message on every update, so long steps with many tool calls save reliably. ([#65039](https://github.com/anomalyco/opencode/pull/65039))

#### Bug fixes

- Fixed GitHub Copilot picking up `GITHUB_TOKEN`, which git tooling and GitHub Actions often set without Copilot access. It now reads `COPILOT_GITHUB_TOKEN`. ([#64697](https://github.com/anomalyco/opencode/pull/64697))
- Fixed shell commands the scanner can't analyze, such as dynamic execution, failing outright. They now ask for permission, and a matching `shell` deny rule still blocks them. ([#65269](https://github.com/anomalyco/opencode/pull/65269))
- Fixed sessions getting stuck on provider 400 errors after a model called a tool by a dotted name such as a Code Mode path. A Code Mode tool called at the top level now runs as that tool, with a note telling the model to use `execute`. ([#65292](https://github.com/anomalyco/opencode/pull/65292), [#65193](https://github.com/anomalyco/opencode/pull/65193), [#65494](https://github.com/anomalyco/opencode/pull/65494))
- Fixed a forced tool choice for a namespaced tool naming a tool the request never declared on every provider except native OpenAI Responses. ([#65621](https://github.com/anomalyco/opencode/pull/65621), [#65726](https://github.com/anomalyco/opencode/pull/65726))
- Fixed the shell tool's description not saying which OS and shell commands run in when `full_codemode` is on. ([#65712](https://github.com/anomalyco/opencode/pull/65712))
- Fixed a revoked or expired ChatGPT sign-in failing every prompt with "Request failed: 400". It now asks you to connect again. ([#65289](https://github.com/anomalyco/opencode/pull/65289))
- Fixed `edit` and `patch` replacing every non-UTF-8 character (Latin-1, cp1252, GBK…) with `�` across the whole file. They now refuse to rewrite such files. ([#64868](https://github.com/anomalyco/opencode/pull/64868))
- Fixed the review pane showing every line as changed in repositories with `core.autocrlf=true`, and symlinks as modified with `core.symlinks=false`. ([#64884](https://github.com/anomalyco/opencode/pull/64884))
- Fixed file permission rules not matching other capitalizations of the same path on macOS. Thanks @knp-sap. ([#64626](https://github.com/anomalyco/opencode/pull/64626))
- Fixed the model picker staying empty while a slow project was still loading. ([#63814](https://github.com/anomalyco/opencode/pull/63814))
- Fixed Claude Agent processes staying alive after their session was deleted. Thanks @WTLAIB. ([#62649](https://github.com/anomalyco/opencode/pull/62649))
- Fixed Claude Agent models becoming unavailable after Claude Code renamed them, and Claude Agent now waits up to 60 seconds for its process to start. ([#65032](https://github.com/anomalyco/opencode/pull/65032), [#65064](https://github.com/anomalyco/opencode/pull/65064))
- Fixed shell commands failing with "failed to open output file" after OpenCode's shell output directory was removed. ([#64889](https://github.com/anomalyco/opencode/pull/64889))
- Fixed concurrent shell commands failing on Windows with PowerShell 7 from the Microsoft Store, and stopping one such command killing the others. ([#64901](https://github.com/anomalyco/opencode/pull/64901))
- Fixed `opencode service set password` writing the password to the CLI log. ([#64911](https://github.com/anomalyco/opencode/pull/64911))
- Fixed `opencode run` hanging when a FIFO is passed as an attachment; it's now rejected right away. Thanks @yang0228. ([#64696](https://github.com/anomalyco/opencode/pull/64696))
- Fixed `opencode <name>` crashing with a stack trace when `<name>` is neither a command nor a directory. It now prints help and the error. ([#65262](https://github.com/anomalyco/opencode/pull/65262))
- Fixed the background service becoming unresponsive at startup with a large database write-ahead log on a slow disk. ([#64532](https://github.com/anomalyco/opencode/pull/64532))
- Fixed a client that opens a session during a running tool call not seeing that tool's progress, such as a running subagent's session. ([#64929](https://github.com/anomalyco/opencode/pull/64929))
- Fixed Markdown commands dropping a separate `variant` next to `model`, and agents being skipped when frontmatter repair turned inline lists or objects into strings. ([#65118](https://github.com/anomalyco/opencode/pull/65118), [#65119](https://github.com/anomalyco/opencode/pull/65119))
- Fixed Google Interactions responses stopping early when Google splits a response across requests. ([#65006](https://github.com/anomalyco/opencode/pull/65006))
- Fixed GPT models over OpenAI's WebSocket transport resending the whole conversation after a freeform tool call such as `execute` or `patch`. ([#64706](https://github.com/anomalyco/opencode/pull/64706))
- Fixed `gpt-6.2-astra` and later Astra models getting a 500k context window with ChatGPT sign-in; they stay at 272k. ([#64725](https://github.com/anomalyco/opencode/pull/64725))
- OpenAI `cyber_policy` and Gemini "terms of use" refusals are now reported as content policy errors. Thanks @lu-zero. ([#64844](https://github.com/anomalyco/opencode/pull/64844), [#64910](https://github.com/anomalyco/opencode/pull/64910))
- Fixed MiniMax text-to-video requests without an aspect ratio being rejected; they now default to `16:9`. ([#64822](https://github.com/anomalyco/opencode/pull/64822))
- Fixed several Code Mode built-ins to match Bun: `localeCompare` and `Date` `toLocale*` honor their locale and options, `toBase64`/`fromBase64` honor their options, `Buffer` `map`, `filter`, `slice` and `subarray` return a Buffer, and `Uint8Array.BYTES_PER_ELEMENT` is defined. ([#64935](https://github.com/anomalyco/opencode/pull/64935), [#64938](https://github.com/anomalyco/opencode/pull/64938), [#64931](https://github.com/anomalyco/opencode/pull/64931), [#64933](https://github.com/anomalyco/opencode/pull/64933), [#64930](https://github.com/anomalyco/opencode/pull/64930), [#64965](https://github.com/anomalyco/opencode/pull/64965))
- Fixed large file views not refreshing when only the end of the file changed. ([#65114](https://github.com/anomalyco/opencode/pull/65114))
- Fixed the install script failing with a disk-space error when `curl` is installed through Snap. ([#65132](https://github.com/anomalyco/opencode/pull/65132))

### TUI

#### Improvements

- The new TUI designs are on by default, and the theme named `opencode` is the new theme. The previous default is available as `opencode-classic`, and `opencode2` keeps working as an alias of `opencode`. To go back to the previous designs, turn off **New designs** in the Experiments dialog. ([#64988](https://github.com/anomalyco/opencode/pull/64988))
- `/login` and `/auth` open the same dialog as `/connect`, which now lists a single **OpenCode** entry that includes OpenCode Go models. ([#65265](https://github.com/anomalyco/opencode/pull/65265), [#65466](https://github.com/anomalyco/opencode/pull/65466))
- Pressing `↓` opens the picker on the first tab with something running, the same tab that clicking the footer opens. ([#64972](https://github.com/anomalyco/opencode/pull/64972))
- Text prompt dialogs such as rename session, `/btw`, worktree names and connect forms end with a **Submit** button, and prompt and export dialogs have tighter spacing. ([#64944](https://github.com/anomalyco/opencode/pull/64944))
- The `opencode` theme's light mode uses lighter grays for the prompt box, selected tabs and hovered rows. ([#64962](https://github.com/anomalyco/opencode/pull/64962))

#### Bug fixes

- Fixed connect forms built from integration fields, such as the Azure resource name, showing an empty row between the title and the input. ([#64944](https://github.com/anomalyco/opencode/pull/64944))
- Fixed list dialogs ending with two blank rows, and the **Manage workspaces** footer not staying at the bottom. ([#64983](https://github.com/anomalyco/opencode/pull/64983))
- Fixed long dialog lists replacing their last visible row with a stray `…`. ([#64934](https://github.com/anomalyco/opencode/pull/64934))
- Fixed the selection bar of a delete-confirmation row staying blue instead of red. ([#64936](https://github.com/anomalyco/opencode/pull/64936))
- Fixed file, agent and skill mentions landing on the wrong text when you restore a prompt sent from the desktop or web app that contains tabs or wide characters. ([#63989](https://github.com/anomalyco/opencode/pull/63989))

### Desktop

#### Improvements

- The browser pane keeps you signed in. Links from the chat open beside the conversation in one saved profile, you can import sign-ins and browsing history from Chrome, Edge, Firefox, Safari and other browsers, and you can install store extensions after reviewing what they can access. The pane gains a right-click menu, find in page, page dialogs, permission prompts, pop-up blocking and readable error pages, and the address bar completes from your history. The agent can read and drive the same signed-in tabs. ([#63002](https://github.com/anomalyco/opencode/pull/63002), [#65073](https://github.com/anomalyco/opencode/pull/65073))
- New tabs that a page opens in the browser pane appear beside the tab they came from, and middle-clicking a link opens it in a new tab. ([#65126](https://github.com/anomalyco/opencode/pull/65126), [#65091](https://github.com/anomalyco/opencode/pull/65091))
- Comments in the browser pane, file viewer and review diff can be sent to the session right away with `Mod+Enter`. Depending on your follow-up setting, they send, steer or queue. ([#65264](https://github.com/anomalyco/opencode/pull/65264))
- Added **Wrap code blocks** under Settings › General › Timeline, plus a **Wrap lines** button on timeline code blocks with lines too long to fit. ([#64545](https://github.com/anomalyco/opencode/pull/64545), [#64576](https://github.com/anomalyco/opencode/pull/64576))
- Added **Keep side panel open across sessions** in Settings › General. ([#64950](https://github.com/anomalyco/opencode/pull/64950))
- Added an **Archive session** command, bound to `Cmd+Shift+S` (`Ctrl+Shift+S` on Windows and Linux). ([#65428](https://github.com/anomalyco/opencode/pull/65428))
- The Home session menu has **Open** and **Open in background**, and Home shows the provider connect hint when nothing is connected. ([#65209](https://github.com/anomalyco/opencode/pull/65209), [#65212](https://github.com/anomalyco/opencode/pull/65212), [#64885](https://github.com/anomalyco/opencode/pull/64885))
- The Inbox layout's sidebar has a **Drafts** group for unsent new-session drafts. ([#65525](https://github.com/anomalyco/opencode/pull/65525))
- Conversation search (`Cmd+F` / `Ctrl+F`) has previous and next match buttons. ([#64865](https://github.com/anomalyco/opencode/pull/64865))
- The connect dialog lists one **OpenCode** option that includes OpenCode Go models, Settings › Providers follows the same rule, and the free model picker has a tighter layout. ([#65466](https://github.com/anomalyco/opencode/pull/65466), [#65740](https://github.com/anomalyco/opencode/pull/65740), [#64927](https://github.com/anomalyco/opencode/pull/64927))
- When you reach your ChatGPT Business workspace's usage limit, a dialog explains it and offers **Copy request for admin**. ([#64926](https://github.com/anomalyco/opencode/pull/64926))
- Voice uses the newest GPT-Live model the server lists. ([#65506](https://github.com/anomalyco/opencode/pull/65506))
- Shortcuts go through the same keymap engine as the TUI, and the new **Stop session** command can be changed in Settings › Shortcuts. ([#64394](https://github.com/anomalyco/opencode/pull/64394))
- Shortcuts can be key chords, such as `Mod+K Mod+C` or `G I`. In Settings › Shortcuts, click **+** on a shortcut you just recorded to add another key, up to 4. While a chord is pending, a panel lists the keys that continue it. ([#64395](https://github.com/anomalyco/opencode/pull/64395))
- The activity pill keeps a subagent listed while work it started is still running. ([#64790](https://github.com/anomalyco/opencode/pull/64790))
- The goal pill has a new design with the labels Following goal, Goal paused and Goal reached. ([#60001](https://github.com/anomalyco/opencode/pull/60001))
- Keyboard focus shows as one consistent ring across the app, no longer appears after a mouse click, and moves to the next item when the focused one is removed. The timeline and the composer no longer draw a ring around their whole frame. ([#64909](https://github.com/anomalyco/opencode/pull/64909), [#64976](https://github.com/anomalyco/opencode/pull/64976), [#65082](https://github.com/anomalyco/opencode/pull/65082), [#65084](https://github.com/anomalyco/opencode/pull/65084), [#65100](https://github.com/anomalyco/opencode/pull/65100), [#65690](https://github.com/anomalyco/opencode/pull/65690))
- Only the latest response shows its Copy button all the time; older ones show it on hover or focus. ([#64640](https://github.com/anomalyco/opencode/pull/64640))
- Added experimental tab groups for side tabs under Settings › Experimental. ([#64407](https://github.com/anomalyco/opencode/pull/64407))
- On Windows, the taskbar button shows session status as a progress bar, a count badge for sessions that need you, and flashes when a permission or question is waiting. Notifications say what is being asked and disappear once you answer. ([#65317](https://github.com/anomalyco/opencode/pull/65317), [#65318](https://github.com/anomalyco/opencode/pull/65318), [#65319](https://github.com/anomalyco/opencode/pull/65319), [#65325](https://github.com/anomalyco/opencode/pull/65325), [#65421](https://github.com/anomalyco/opencode/pull/65421))
- On Windows, the jump list has **New Session** and **New Window**, you can drag files from the file tree into other apps, and **Open in** includes Windows Terminal and lists only installed apps. ([#65327](https://github.com/anomalyco/opencode/pull/65327), [#65330](https://github.com/anomalyco/opencode/pull/65330), [#65320](https://github.com/anomalyco/opencode/pull/65320))
- The web app can be built to run under a path prefix, for example behind a reverse proxy, with `bun --cwd packages/app build --base=/opencode/`. ([#64597](https://github.com/anomalyco/opencode/pull/64597))
- The background activity menu stays smooth with many subagents, and the model picker stays responsive with catalogs of thousands of models. ([#65634](https://github.com/anomalyco/opencode/pull/65634), [#65189](https://github.com/anomalyco/opencode/pull/65189), [#65635](https://github.com/anomalyco/opencode/pull/65635))

#### Bug fixes

- Fixed `opencode://open-project` and `opencode://new-session` links doing nothing. ([#65332](https://github.com/anomalyco/opencode/pull/65332))
- Fixed file links like `~/Downloads/clip.mp4` showing "File not found". `~` now opens in the server's home folder. ([#65689](https://github.com/anomalyco/opencode/pull/65689))
- Fixed an open session's side panel tabs disappearing after you had used many other sessions. ([#65328](https://github.com/anomalyco/opencode/pull/65328), [#65322](https://github.com/anomalyco/opencode/pull/65322))
- Fixed the app freezing when opening a session on a remote server with **Share sign-ins with remote servers** on. ([#65339](https://github.com/anomalyco/opencode/pull/65339))
- Fixed the app freezing for several seconds when you open a group of long Code Mode scripts. An Execute row now lists its latest 10 calls, with **+N more** for the earlier ones. ([#65696](https://github.com/anomalyco/opencode/pull/65696))
- Fixed the browser pane showing "The browser couldn't open" in a project whose server had only just started. ([#65720](https://github.com/anomalyco/opencode/pull/65720))
- Fixed **Clear browsing data** clearing everything on the first click; it now asks first. ([#65124](https://github.com/anomalyco/opencode/pull/65124))
- Fixed browser tabs showing a generic globe instead of the site's icon, saved tabs appearing late after the app reopens, and the page going blank while a panel is resized on Windows. ([#65094](https://github.com/anomalyco/opencode/pull/65094), [#65067](https://github.com/anomalyco/opencode/pull/65067), [#65083](https://github.com/anomalyco/opencode/pull/65083))
- Fixed sites in the browser pane replacing the app's badge on the taskbar or Dock. ([#65646](https://github.com/anomalyco/opencode/pull/65646))
- Fixed the mouse Back and Forward buttons doing nothing. ([#65129](https://github.com/anomalyco/opencode/pull/65129))
- Fixed a subagent's pending permission request not reappearing after a reload or reconnect. ([#65120](https://github.com/anomalyco/opencode/pull/65120))
- Fixed background jobs that changed while the job list was loading showing the wrong state, and rows in the activity menu jumping around. ([#64966](https://github.com/anomalyco/opencode/pull/64966), [#65312](https://github.com/anomalyco/opencode/pull/65312))
- Fixed the session view crashing when a timeline row disappeared mid-update. ([#64565](https://github.com/anomalyco/opencode/pull/64565))
- Fixed earlier replies being folded into the "Used N tools" group when a session was woken without a new message. ([#64917](https://github.com/anomalyco/opencode/pull/64917))
- Fixed the Context tab showing the latest instruction update as the "System Prompt". ([#64991](https://github.com/anomalyco/opencode/pull/64991))
- Fixed the session header briefly showing the wrong worktree while a new session starts. ([#65190](https://github.com/anomalyco/opencode/pull/65190))
- Fixed Grep, Glob and List rows showing the parent of the folder they searched, and Windows paths not showing relative to the project. ([#65460](https://github.com/anomalyco/opencode/pull/65460), [#65639](https://github.com/anomalyco/opencode/pull/65639))
- Fixed server event streams going stale after Windows wakes from sleep, and windows reopening in the wrong place after being snapped or minimized. ([#65321](https://github.com/anomalyco/opencode/pull/65321), [#65323](https://github.com/anomalyco/opencode/pull/65323))
- Fixed the Windows caption buttons being hard to see with a contrast theme. ([#65324](https://github.com/anomalyco/opencode/pull/65324))
- Fixed **Open in PowerShell** on Windows opening Windows PowerShell instead of PowerShell 7 when it's installed. ([#64873](https://github.com/anomalyco/opencode/pull/64873))
- Fixed builds packaged without `app-update.yml`, such as AUR packages, showing update-check errors. Settings now shows **Updates unavailable**. ([#64681](https://github.com/anomalyco/opencode/pull/64681))
- Fixed the message menu's "Today" and "Yesterday" labels, and Home's date headers staying invisible while scrolling. ([#65081](https://github.com/anomalyco/opencode/pull/65081), [#64665](https://github.com/anomalyco/opencode/pull/64665))
- Fixed clipped or misleading focus rings, the side panel's add button being skipped by `Tab`, and the **Compacted** label only partly highlighting on hover. ([#65215](https://github.com/anomalyco/opencode/pull/65215), [#65192](https://github.com/anomalyco/opencode/pull/65192), [#65176](https://github.com/anomalyco/opencode/pull/65176), [#65177](https://github.com/anomalyco/opencode/pull/65177), [#65211](https://github.com/anomalyco/opencode/pull/65211), [#65213](https://github.com/anomalyco/opencode/pull/65213), [#65644](https://github.com/anomalyco/opencode/pull/65644))
- Fixed the Hex voice tip showing on phones and tablets, and a fringe on project icon corners. ([#64583](https://github.com/anomalyco/opencode/pull/64583), [#64582](https://github.com/anomalyco/opencode/pull/64582))

### SDK

#### Improvements

- Added `experimental.job.cancel` to cancel a running background job, and an `experimental.job.updated` event when a job starts, moves to the background or ends. `@opencode/client/solid`'s `createData` has a `job` slice. ([#64790](https://github.com/anomalyco/opencode/pull/64790), [#65266](https://github.com/anomalyco/opencode/pull/65266), [#64956](https://github.com/anomalyco/opencode/pull/64956))
- The video endpoints (`experimental.generate.video.create` and `.get`) no longer need a flag. Video jobs survive a server restart, can return more than one video, and stay readable for 24 hours after they finish. ([#65664](https://github.com/anomalyco/opencode/pull/65664), [#64546](https://github.com/anomalyco/opencode/pull/64546))
- The automation endpoints work without a flag, and an automation can run a shell command as its action. ([#65296](https://github.com/anomalyco/opencode/pull/65296), [#65186](https://github.com/anomalyco/opencode/pull/65186))

### Extensions

#### Improvements

- A plugin tool can set `options.codemode` to an object (`{ pinned?, description?, input?, output? }`) to give its Code Mode form its own description and schemas. Top-level `options.pinned` still works but is deprecated. ([#64515](https://github.com/anomalyco/opencode/pull/64515))
- The `execute.before` and `execute.after` tool hooks receive `info`, the tool's definition, and `codemode`, which is true when a Code Mode script made the call. ([#64515](https://github.com/anomalyco/opencode/pull/64515))
- An integration's OAuth method can define `revoke` to sign a credential out remotely before it's removed. ([#64947](https://github.com/anomalyco/opencode/pull/64947))
- TUI plugins can read a session's running background jobs with `api.data.job.list(sessionID)` (experimental). ([#64956](https://github.com/anomalyco/opencode/pull/64956))
- `experimental.idle` background entries can have the kind `video`. ([#63666](https://github.com/anomalyco/opencode/pull/63666))
- GUI plugins can declare their own SVG icons with `Plugin.define({ icons })` and use them through `ctx.icons`. The built-in `outline-pair` and `outline-steer` icons were removed. ([#64577](https://github.com/anomalyco/opencode/pull/64577))
- The GUI composer API adds `composer.send(commentID)` and `composer.delivery()`, and the `Browser` contract adds `experimental.open` and `experimental.close`. ([#65264](https://github.com/anomalyco/opencode/pull/65264), [#63002](https://github.com/anomalyco/opencode/pull/63002))
- GUI `System.open` only launches HTTP, HTTPS and mail URLs, and `Browser.open` refuses `file://` URLs outside the built-in preview. ([#63002](https://github.com/anomalyco/opencode/pull/63002))

## v2.3.2 — 2026-11-18

### Highlights

- **GPT-6.2 Prompt Caching**: GPT-6.2 models don't cache a system prompt sent in the Responses `instructions` field, so every step re-billed it as uncached input. OpenCode now sends it as a leading developer message on every Responses route, including OpenAI (API key and ChatGPT sign-in), GitHub Copilot, Zen, Azure and OpenRouter, so it is cached from the second step on. ([#64542](https://github.com/anomalyco/opencode/pull/64542), [#64544](https://github.com/anomalyco/opencode/pull/64544))

### Core

#### Bug fixes

- Fixed GPT-6.2 models re-billing the system prompt as uncached input on every step. On GitHub Copilot `gpt-6.2-sol`, uncached input per step dropped from about 14,000 tokens to 3. Compaction through `/responses/compact` now reads the same cached prefix. ([#64542](https://github.com/anomalyco/opencode/pull/64542), [#64544](https://github.com/anomalyco/opencode/pull/64544))
- `webfetch` structured output no longer repeats the `url` and `format` it was called with. ([#64534](https://github.com/anomalyco/opencode/pull/64534))

## v2.3.1 — 2026-11-17

### Highlights

- **Timed-Out Shell Commands Keep Running**: A shell command still running when its timeout expires now moves to the background instead of being killed, so long builds and test runs finish and report back. A foreground `timeout: 0` now means the default 120 seconds. ([#63699](https://github.com/anomalyco/opencode/pull/63699))
- **Compaction Without the Wait**: As a session nears automatic compaction, the summary is now written in the background, so your next prompt doesn't pause for it. Set `compaction.background: false` to turn it off; a background summary that ends up unused still costs tokens. ([#64290](https://github.com/anomalyco/opencode/pull/64290))
- **GPT 6.2 with ChatGPT Sign-In**: GPT 6.2 Sol and GPT 6.2 Astra, plus their fast variants, now show up in the model picker when you sign in with ChatGPT. ([#64508](https://github.com/anomalyco/opencode/pull/64508))
- **Update Plugins from Settings**: Open **Settings › Extensions**, click **Check for updates**, then **Update** on any plugin with a new version. ([#64511](https://github.com/anomalyco/opencode/pull/64511))
- **Comment on Selected Code**: Selecting code in diff and file viewers now just selects it, so you can copy it, and an **Add comment** toolbar appears beside the selection. ([#64410](https://github.com/anomalyco/opencode/pull/64410))

### Core

#### Improvements

- Shell commands still running when their timeout expires now move to the background instead of being killed, in every build. The `shell_timeout_background` flag is gone; configs that still set it keep loading. A foreground `timeout: 0` now uses the default 120 second timeout instead of waiting until the command exits. ([#63699](https://github.com/anomalyco/opencode/pull/63699))
- Background compaction is now on by default: as a session nears automatic compaction, the summary is written in the background so the next prompt doesn't wait for it. Turn it off with `compaction.background: false`; a background summary that is never used still costs tokens. The `experimental.background_compaction` setting is removed. ([#64290](https://github.com/anomalyco/opencode/pull/64290))
- OpenCode again reads `CLAUDE.md` in any directory that has no `AGENTS.md`, and falls back to `~/.claude/CLAUDE.md` when the global `AGENTS.md` is missing. This also applies to instructions found when the agent reads nested files. Set `OPENCODE_DISABLE_CLAUDE_CODE` or `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT` to skip every `CLAUDE.md`. ([#64474](https://github.com/anomalyco/opencode/pull/64474), [#64533](https://github.com/anomalyco/opencode/pull/64533))
- Added GPT 6.2 Sol and GPT 6.2 Astra, plus their fast variants, to the ChatGPT model list. ([#64508](https://github.com/anomalyco/opencode/pull/64508))
- `websearch` now returns a flat list of results, each with its `url`, `title`, `content` and `published` date. ([#64471](https://github.com/anomalyco/opencode/pull/64471))
- Code Mode and plugins get a simpler structured result from `read`: `text` (with `offset`, `lineCount` and `next`), `directory` (entry names) or `media` (a URI instead of base64). What the model sees is unchanged. ([#64361](https://github.com/anomalyco/opencode/pull/64361))
- Code Mode programs can use Node's `Buffer` for encoding and decoding bytes. ([#64365](https://github.com/anomalyco/opencode/pull/64365))
- In Code Mode, `search("issues")` now works as shorthand for `search({ query: "issues" })`. ([#64347](https://github.com/anomalyco/opencode/pull/64347))
- Code Mode tool summaries in the catalog can now be up to 500 characters instead of 120, so the model sees more of each tool's description. ([#64341](https://github.com/anomalyco/opencode/pull/64341))
- The `glob` and `grep` tools now report a malformed filename glob (for example `[`) as an error that names the parameter to fix, instead of returning no results. ([#63960](https://github.com/anomalyco/opencode/pull/63960))
- Server requests that crash now return a 500 with a readable JSON `UnknownError` body instead of an empty one. Storage problems name the cause (for example "Storage is full" or "Storage is read-only"); other crashes include a `ref` you can find in the server log. ([#64022](https://github.com/anomalyco/opencode/pull/64022))
- The shell tool description now tells the model that its session ID is in the `OPENCODE_SESSION_ID` environment variable. ([#63718](https://github.com/anomalyco/opencode/pull/63718))
- Experimental schedules are now automations, behind the `automations` flag (the old `schedules` flag still works). An automation runs on a time, an interval, a cron or a pushed MCP event, and either sends a prompt (to the creating session, another session or a new subagent) or runs a Code Mode program that decides whether to send one. Use `/automation` or the `automation_*` tools. Active or paused plain prompt schedules carry over; schedules with a condition or run limit, and finished ones, are dropped. ([#64160](https://github.com/anomalyco/opencode/pull/64160))

#### Bug fixes

- Fixed finished shell commands leaving zombie processes under `opencode-pty`. The process daemon now cleans each command up when it exits. Background processes started by a successful command (`cmd &`) keep running, and a failed command's leftovers are stopped. ([#64266](https://github.com/anomalyco/opencode/pull/64266), [#64251](https://github.com/anomalyco/opencode/pull/64251))
- Fixed ChatGPT and OpenAI subscription logins losing their sharing-limit safeguards and context caps when a token refresh failed. ([#64470](https://github.com/anomalyco/opencode/pull/64470))
- Fixed Claude Agent models falling back to a 200K context window when Claude Code adds or renames a model. Thanks @Tarquinen. ([#64107](https://github.com/anomalyco/opencode/pull/64107))
- Fixed requests being rejected after switching models mid-session on OpenAI-compatible providers. Models that declare a different reasoning field (such as `reasoning_content`) no longer receive `reasoning_details` from earlier turns. ([#64243](https://github.com/anomalyco/opencode/pull/64243))
- Rejecting a permission request now rejects only the other pending requests from the same step, not every pending request in the session. ([#64343](https://github.com/anomalyco/opencode/pull/64343))
- Fixed a finished subagent being reported to its parent as still running when its answer quoted the "Background work still running" heading. ([#64026](https://github.com/anomalyco/opencode/pull/64026))
- Fixed ACP clients missing turns that a background shell woke after the original turn ended. ([#64262](https://github.com/anomalyco/opencode/pull/64262))
- Reading a small text file now applies the default line and byte limits, so a short file with very many lines is paged instead of returned whole. ([#63810](https://github.com/anomalyco/opencode/pull/63810))
- Paged reads that select a single blank line now return that line instead of an empty result. ([#63809](https://github.com/anomalyco/opencode/pull/63809))
- `read` now rejects `limit: 0` with "Limit must be a positive integer". ([#63808](https://github.com/anomalyco/opencode/pull/63808))
- Text files that start with `BM` are no longer mistaken for BMP images, and only real `GIF87a`/`GIF89a` headers count as GIFs, so these files read as text again. ([#63822](https://github.com/anomalyco/opencode/pull/63822), [#63811](https://github.com/anomalyco/opencode/pull/63811))
- Fixed shell output pages, grep previews, generated titles, read lines and shell output tails splitting emoji and other multi-byte characters, which showed up as `�`. ([#63984](https://github.com/anomalyco/opencode/pull/63984), [#63967](https://github.com/anomalyco/opencode/pull/63967))
- Shell commands using unknown ANSI-C escapes such as `$'\q'` are now read the same way Bash and Zsh read them, so permission rules can match them. ([#64263](https://github.com/anomalyco/opencode/pull/64263))
- Session title search is now case-insensitive for non-ASCII letters, such as Cyrillic and accented text. ([#64259](https://github.com/anomalyco/opencode/pull/64259))
- Fixed `grep` results being dropped when a matching line or path is not valid UTF-8. Thanks @Tarquinen. ([#62249](https://github.com/anomalyco/opencode/pull/62249))
- The `@` file picker now finds files in hidden folders such as `.github/` and dotfiles such as `.env.example` when file search uses ripgrep (the default on Windows and outside git repos). `.git` and gitignored files stay excluded. Thanks @Tarquinen. ([#62577](https://github.com/anomalyco/opencode/pull/62577))
- An unreachable well-known integration source is now skipped instead of dropping every well-known source. Thanks @Tarquinen. ([#62578](https://github.com/anomalyco/opencode/pull/62578))
- A corrupt cached project ID is now ignored instead of being used. Thanks @Tarquinen. ([#62576](https://github.com/anomalyco/opencode/pull/62576))
- Plugin tool renames from `tool.execute.before` now apply to calls inside Code Mode programs, and a renamed call returns the new tool's structured result. ([#63633](https://github.com/anomalyco/opencode/pull/63633), [#64333](https://github.com/anomalyco/opencode/pull/64333))
- In Code Mode, calling a tool that doesn't exist now returns a rejected promise, so `.catch` and `Promise.allSettled` can handle it instead of the whole script failing. ([#64510](https://github.com/anomalyco/opencode/pull/64510))
- A Code Mode program that only logs no longer shows a stray `null` line before its logs. ([#64344](https://github.com/anomalyco/opencode/pull/64344))

### TUI

#### Improvements

- Permission prompts from a subagent, and from that subagent's own subagents, now appear while you view the subagent's session. Prompts also show in front of an open composer. ([#64343](https://github.com/anomalyco/opencode/pull/64343))
- The export dialog under the new designs can save to the system temp directory as well as the project folder. Thanks @Tarquinen. ([#62490](https://github.com/anomalyco/opencode/pull/62490))
- Removed time to first token (ttft) from the assistant message footer. Tokens per second still shows when `session.tps` is on. ([#63759](https://github.com/anomalyco/opencode/pull/63759))

#### Bug fixes

- When another TUI sharing your tabs closes the session you're viewing, closing it here now moves to the neighbouring tab. ([#64261](https://github.com/anomalyco/opencode/pull/64261))
- Fixed broken characters at the edges of the shell output viewer and the inline shell display when output is long. ([#63967](https://github.com/anomalyco/opencode/pull/63967), [#63984](https://github.com/anomalyco/opencode/pull/63984))

### Desktop

#### Improvements

- You can check for and install plugin package updates from **Settings › Extensions**. Use **Check for updates** to look for new versions, then click **Update** on any plugin that has one. ([#64511](https://github.com/anomalyco/opencode/pull/64511), [#64525](https://github.com/anomalyco/opencode/pull/64525))
- Selecting code in diff and file viewers now just selects text, so you can copy it. An **Add comment** toolbar appears next to the selection to comment on those lines; line numbers and the gutter `+` still start a comment directly. ([#64410](https://github.com/anomalyco/opencode/pull/64410))
- Cmd+F (Ctrl+F) now finds text in Markdown, Mermaid, CSV and HTML previews in the side panel, using the same find bar as the code view. ([#63663](https://github.com/anomalyco/opencode/pull/63663))
- Disconnecting a provider or removing an account in **Settings → Providers** now asks for confirmation first. Disconnecting OpenCode Console says how many providers will stop working. ([#64212](https://github.com/anomalyco/opencode/pull/64212))
- The model picker's variant flyout now follows the keyboard: it opens beside the highlighted row, `→` enters it to pick a variant or toggle Favorite, and `←` or `Escape` goes back. A model's Console budget and reset time now show in the flyout. ([#64409](https://github.com/anomalyco/opencode/pull/64409), [#64423](https://github.com/anomalyco/opencode/pull/64423))
- When **New worktree** is selected for a new session, the composer shows the base branch (`from dev ▾`). Click it to pick another base; the choice applies immediately, and **Use main checkout** switches back. ([#64228](https://github.com/anomalyco/opencode/pull/64228))
- Redesigned the folder picker for remote servers, with a path bar, up to three recent-project pills plus a **More projects** menu, and a search box that shows the selected folder. ([#64241](https://github.com/anomalyco/opencode/pull/64241))
- ` ```latex ` and ` ```math ` code fences now render as display math once complete. ([#64380](https://github.com/anomalyco/opencode/pull/64380))
- The new icon set is now the default, and the **New icons** experiment has been removed. ([#64466](https://github.com/anomalyco/opencode/pull/64466), [#64451](https://github.com/anomalyco/opencode/pull/64451))
- The copy button under assistant messages is now always visible. Message metadata still appears on hover. ([#64478](https://github.com/anomalyco/opencode/pull/64478))
- Text files opened in side-panel tabs now have the same copy and download actions as other files. ([#64463](https://github.com/anomalyco/opencode/pull/64463))
- **Manage models** now shows every provider as a card with a `⋯` menu, whether or not you're signed in to OpenCode Console. ([#64235](https://github.com/anomalyco/opencode/pull/64235))
- The connect provider dialog has a cleaner layout for every sign-in step: breadcrumbs, method icons, full-width device codes, and a "Signing in from another device?" row for pasting a redirect URL. ([#63829](https://github.com/anomalyco/opencode/pull/63829))
- **Collapse long messages** is no longer experimental. It is now a setting under **Timeline** preferences. ([#64441](https://github.com/anomalyco/opencode/pull/64441))
- Settings now opens on your client preferences, which are listed first, pairing is grouped with Servers, and there's a **Help & feedback** link. ([#64440](https://github.com/anomalyco/opencode/pull/64440), [#64220](https://github.com/anomalyco/opencode/pull/64220))
- Automatic compactions now always show as a single quiet divider; manual and failed compactions still show the full record. ([#64290](https://github.com/anomalyco/opencode/pull/64290))
- Pairing QR codes can carry a server name, which becomes the paired server's default name. ([#64139](https://github.com/anomalyco/opencode/pull/64139))
- Image attachment thumbnails are larger, with a 3:2 crop, and a failed image no longer moves the message below it when retried. ([#64215](https://github.com/anomalyco/opencode/pull/64215))
- The Hex voice tip no longer appears when Hex is already installed, its copy now says what Hex is, and tips wait an hour after first launch before the first one shows. ([#64130](https://github.com/anomalyco/opencode/pull/64130), [#64131](https://github.com/anomalyco/opencode/pull/64131), [#63974](https://github.com/anomalyco/opencode/pull/63974), [#63760](https://github.com/anomalyco/opencode/pull/63760))
- Added missing translations for every non-English language, about 920 strings each. ([#64205](https://github.com/anomalyco/opencode/pull/64205))

#### Bug fixes

- Fixed the desktop app failing to start when `drafts.sqlite` was a symlink to or copy of the CLI's `opencode.db`. The desktop now moves that file aside and creates its own, leaving the CLI database untouched. ([#64203](https://github.com/anomalyco/opencode/pull/64203))
- Switching session tabs with a keyboard shortcut now focuses the composer. ([#64418](https://github.com/anomalyco/opencode/pull/64418))
- Long prompts now stay folded while a new session is being created. ([#64452](https://github.com/anomalyco/opencode/pull/64452))
- On macOS, the browser pane stays live while you resize panels instead of showing a still image. ([#64443](https://github.com/anomalyco/opencode/pull/64443))
- Submenus now open one at a time and swap without blinking, and stay open while you move the pointer across other items to reach them. ([#63739](https://github.com/anomalyco/opencode/pull/63739))
- Pressing a button now dismisses its tooltip until you hover it again, and copy buttons show "Copied" for two seconds, including in the `/btw` panel. ([#63834](https://github.com/anomalyco/opencode/pull/63834))
- Dialogs now use consistent sizes, corner radius and row styles across the command palette, session search, model picker, location picker and other lists. ([#63432](https://github.com/anomalyco/opencode/pull/63432), [#64216](https://github.com/anomalyco/opencode/pull/64216), [#64206](https://github.com/anomalyco/opencode/pull/64206))
- Sessions on OpenCode Go no longer show a $0.00 cost. ([#63744](https://github.com/anomalyco/opencode/pull/63744))
- **Use main checkout** now stays on one line in the branch picker, and wrapped question descriptions have better spacing. ([#64450](https://github.com/anomalyco/opencode/pull/64450), [#64446](https://github.com/anomalyco/opencode/pull/64446))
- Restyled the **Timeline detail** slider and visibility buttons in settings so they read as clickable. ([#64186](https://github.com/anomalyco/opencode/pull/64186))
- Polished small details: animated counts no longer look faded at rest, the sidebar resize pill is hidden, the sidebar peek insets match, subagent breadcrumbs show a hover background, and screen readers name the redirect URL field after its label only. ([#64155](https://github.com/anomalyco/opencode/pull/64155), [#64219](https://github.com/anomalyco/opencode/pull/64219), [#64192](https://github.com/anomalyco/opencode/pull/64192), [#63742](https://github.com/anomalyco/opencode/pull/63742), [#63885](https://github.com/anomalyco/opencode/pull/63885))

### SDK

#### Improvements

- Unhandled server errors now return a JSON `UnknownError` body (`message` and `ref`) with status 500 instead of an empty body. ([#64022](https://github.com/anomalyco/opencode/pull/64022))
- Experimental automation endpoints replace the schedule endpoints: `/api/experimental/automation` and `client.experimental.automation.*` (`create`, `list`, `get`, `pause`, `resume`, `delete`). `/api/experimental/schedule` and `client.experimental.schedule.*` are removed. ([#64160](https://github.com/anomalyco/opencode/pull/64160))
- Config adds `compaction.background`; `experimental.background_compaction` and the `shell_timeout_background` flag are removed. ([#64290](https://github.com/anomalyco/opencode/pull/64290), [#63699](https://github.com/anomalyco/opencode/pull/63699))

#### Bug fixes

- Apps embedding the SDK with an in-memory database no longer import the user's legacy `auth.json` credentials. Only a database file opened by path imports them. ([#63716](https://github.com/anomalyco/opencode/pull/63716))

### Extensions

#### Improvements

- Each tool call inside a Code Mode program now has its own call ID in plugin hooks and traces. Its permission requests still show on the `execute` call's row. ([#64324](https://github.com/anomalyco/opencode/pull/64324))
- Plugin `SessionIdleBackground` items can now be `{ kind: "codemode", sessionID, jobID }`, and GUI plugin `BridgeLayout` accepts an optional `clip` rectangle. ([#64343](https://github.com/anomalyco/opencode/pull/64343), [#63819](https://github.com/anomalyco/opencode/pull/63819))

#### Bug fixes

- The browser extension's URL bar action buttons are now spaced 6px apart. ([#64214](https://github.com/anomalyco/opencode/pull/64214))

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
