<p align="center">
  <img src=".github/assets/logo.png" width="80" alt="Loophole" />
</p>

<h1 align="center">Loophole</h1>

<p align="center">
The open-source AI coding agent for the terminal and desktop.
</p>

<div align="center">

<img src="https://img.shields.io/github/license/loophole-ai/loophole-app?style=for-the-badge&v=2" alt="License" />
<img src="https://img.shields.io/npm/v/@loophole-ai/cli?style=for-the-badge&v=2" alt="npm" />
<img src="https://img.shields.io/github/stars/loophole-ai/loophole-app?style=for-the-badge&v=2" alt="Stars" />

</div>

<div align="center">

<table>
<tbody>
<td align="center"><a href="https://www.loopholeeditor.in"><strong>Loophole Desktop</strong></a></td>
<td align="center"><a href="https://github.com/loophole-ai/loophole-app"><strong>GitHub</strong></a></td>
<td align="center"><a href="./CONTRIBUTING.md"><strong>Contributing</strong></a></td>
<td align="center"><a href="https://github.com/loophole-ai/loophole-app/issues"><strong>Issues</strong></a></td>
<td align="center"><a href="https://github.com/loophole-ai/loophole-app/discussions"><strong>Discussions</strong></a></td>
</tbody>
</table>

</div>

<br/>

Loophole is an open-source AI coding agent for the terminal and desktop. It reads, edits, and runs your code, works in any terminal, connects to any OpenAI-compatible provider, and ships as a native desktop app with the same engine.

All AI requests go directly from your machine to your chosen provider. No servers, no telemetry, no intermediate layer. Bring your own API key, or run local models.

## Features

- **CLI agent.** Boot it in a directory and it can read, edit, and create files; run shell commands; work with git; and answer questions about your codebase. It behaves like a pair programmer who is good with tools, not a chatbot stuck on answers.
- **Desktop app.** A native desktop build bundles the same engine behind a UI — the CLI you would normally interact with in the terminal, plus a chat UI, model picker, todo view, and rich tool output.
- **Tool-driven, not prompt-driven.** The agent operates through real tools: file read/write/edit, terminal, search, git, web fetch, and MCP servers you configure.
- **Multi-step, multi-agent.** Subagents for parallel research and execution, with background execution and resumable sessions.
- **Any provider, any model.** Anthropic, OpenAI, Google, DeepSeek, xAI, Mistral, Groq, OpenRouter, and local runners (Ollama, vLLM, LM Studio) via OpenAI-compatible endpoints.
- **Auto mode.** Auto-approve mode lets the agent run autonomously — and approve each action on its own merits when you want to review.
- **Checkpoints and rewinds.** Built-in session fork/rewind to step back onto earlier branches.
- **Terminal-native.** Works in any terminal emulator. No plugins, no proprietary IPC.

## Install

```bash
# CLI (npm)
npm i -g @loophole-ai/cli

# Desktop: see the releases page for installers
https://github.com/loophole-ai/desktop
```

The CLI supports Tab-complete agents, slash commands (`/todo`, `/handoff`, `/commit`, `/doctor`, and others), streaming output, and offline-capable sessions.

## Scope

- **CLI** — terminal-based AI agent (`loophole-cli` / `lhc` / `loophole`, depending on install method)
- **Desktop** — native desktop app bundling the CLI engine (`loophole` binary + UI)
- **IDE** — a full AI-native editor built on Void/VS Code, at [loophole-ai/loophole-ide](https://github.com/loophole-ai/loophole-ide)

## Upstream

Loophole is a fork of [OpenCode](https://github.com/anomalyco/opencode) (MIT License). Upstream is developed by a large community; changes land upstream first where possible. Divergences are documented in the changelogs.

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request. For security issues, see [SECURITY.md](./SECURITY.md).

## License

Loophole is licensed under the [MIT License](./LICENSE). Upstream OpenCode is MIT licensed; attribution is preserved in [LICENSE-opencode.md](./LICENSE-opencode.md) and [NOTICE.md](./NOTICE.md).

Copyright (c) 2026 Loophole AI
