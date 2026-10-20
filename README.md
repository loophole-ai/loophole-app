<p align="center">
  <a href="https://github.com/loophole-ai/loophole-app">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Loophole logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://github.com/loophole-ai/loophole-app"><img alt="GitHub" src="https://img.shields.io/badge/github-loophole--ai%2Floophole--app-181717?style=flat-square" /></a>
</p>

[![Loophole Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://github.com/loophole-ai/loophole-app)

---

### Installation

Loophole is distributed as source. Build it with Bun 1.3 or newer:

```bash
bun install
bun run dev
```

`bun run dev` starts the CLI and terminal UI. Pass a directory to open another project.

Prebuilt binaries and desktop builds, when published, are available from the [releases page](https://github.com/loophole-ai/loophole-app/releases).

### Desktop App (BETA)

Loophole also builds an Electron desktop application from this repository:

```bash
bun run dev:desktop
```

### Agents

Loophole includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more in the [repository docs](https://github.com/loophole-ai/loophole-app).

### Contributing

If you're interested in contributing to Loophole, please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### License

Loophole is licensed under the **GNU Affero General Public License, version 3 (AGPL-3.0)**.
See the [LICENSE](./LICENSE) file for the full license text.

Loophole is a fork of [OpenCode](https://github.com/anomalyco/opencode), which is
licensed under the MIT License. Copyright (c) 2025 opencode. The original MIT
license text is reproduced in [LICENSE-opencode.md](./LICENSE-opencode.md) and
must be retained. Attribution details are in [NOTICE.md](./NOTICE.md).

"OpenCode" and related names and logos are trademarks of their respective
owners. This project is not affiliated with or endorsed by the OpenCode project
or its authors.
