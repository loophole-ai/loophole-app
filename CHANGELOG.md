# Changelog

All notable changes to the Loophole CLI and desktop app.

Format: a `## v<version>` section per release; release notes are generated from
the section matching the version being published, so add one when cutting a release.

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
