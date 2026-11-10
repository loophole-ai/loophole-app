/**
 * Built-in slash commands for the pi-style interactive TUI.
 *
 * Two sources feed the autocomplete popup:
 *  - this static list (dispatched client-side, see TuiAdapter.dispatch)
 *  - the backend's command registry (`api.command.list`), dispatched via
 *    `session.command` — those are the user-configured/plugin commands
 *    (/init, /review, custom templates, MCP prompts).
 */

export interface AdapterCommand {
	name: string
	description: string
	argumentHint?: string
}

export const BUILTIN_COMMANDS: readonly AdapterCommand[] = [
	{ name: "help", description: "List available commands" },
	{ name: "new", description: "Start a new session" },
	{ name: "sessions", description: "Switch to another session" },
	{ name: "rename", description: "Rename the current session", argumentHint: "<title>" },
	{ name: "compact", description: "Summarize the session context to free tokens" },
	{ name: "redo", description: "Clear the revert point (redo)" },
	{ name: "clear", description: "Clear the transcript view" },
	{ name: "reload", description: "Reload configuration" },
	{ name: "status", description: "Show session status and token usage" },
	{ name: "copy", description: "Copy the last assistant message" },
	{ name: "exit", description: "Exit Loophole (aliases: quit, q)" },
] as const

/** Words typed bare that exit, mirroring the old TUI's shell-mode check. */
export const EXIT_WORDS = ["exit", "quit", ":q"] as const
