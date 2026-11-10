/**
 * Connects the Loophole screen (@loophole/screen) to an OpenCode server.
 *
 * The screen only draws; this class owns the session, subscribes to server events and turns them
 * into screen calls: streamed text and reasoning, tool cards, permission prompts, usage.
 */

import { spawnSync } from "node:child_process"
import { readFileSync, statSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, isAbsolute, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { stripVTControlCharacters } from "node:util"

import type { Endpoint } from "@opencode/client/effect/service"
import type {
  CommandInfo,
  EventSubscribeOutput,
  FileDiffInfo,
  FormField,
  FormInfo,
  IntegrationInfo,
  ModelInfo,
  ModelRef,
  OpenCodeClient,
  SessionInfo,
  SessionMessageInfo,
  SessionStatsInfo,
} from "@opencode/client/promise"
import { TokenUsage } from "@opencode/schema/token-usage"
import { activityCalendar } from "@opencode/util/activity-calendar"
import {
  Screen,
  currentTheme,
  type ComposerMode,
  type FormAnswerValue,
  type FormQuestion,
  type PermissionDecision,
  type StreamHandle,
} from "@loophole/screen"
import { getNativeClipboard, type SlashCommand } from "@loophole/tui-engine"

import { selfCommand } from "../util/process"
import { OPENCODE_VERSION } from "../version"
import { readScreenPreferences, saveScreenModel } from "./preferences"

export interface ScreenControllerOptions {
  readonly client: OpenCodeClient
  readonly endpoint: Endpoint
  readonly directory: string
  /** Session to attach to. When omitted a fresh one is created. */
  readonly sessionID?: string
  /** Approve permission requests without asking (like `run --auto`). */
  readonly auto?: boolean
  /** Sent as the first prompt once the screen is up. */
  readonly initialMessage?: string
  /** A model chosen on the command line; it wins over the remembered preference. */
  readonly model?: ModelRef
}

/**
 * The same commands the OpenCode TUI exposes, plus the useful Kimi-CLI commands, so the
 * Loophole screen is not a reduced subset. Aliases are listed as their own palette rows, while
 * COMMAND_ALIASES still resolves each alias to its canonical handler in runCommand.
 */
const BUILTIN_COMMANDS: readonly SlashCommand[] = [
  { name: "help", description: "List available commands" },
  { name: "h", description: "Alias of /help" },
  { name: "?", description: "Alias of /help" },
  { name: "version", description: "Show the Loophole version" },
  { name: "changelog", description: "Show this build's version and highlights" },
  { name: "release-notes", description: "Alias of /changelog" },
  { name: "feedback", description: "Show where to send feedback" },
  { name: "sessions", description: "Switch to another session" },
  { name: "resume", description: "Alias of /sessions" },
  { name: "continue", description: "Alias of /sessions" },
  { name: "new", description: "Start a new session" },
  { name: "clear", description: "Clear the transcript view" },
  { name: "reset", description: "Alias of /clear" },
  { name: "open", description: "Open a session from any project" },
  { name: "projects", description: "Alias of /open" },
  { name: "project", description: "Alias of /open" },
  { name: "rename", description: "Rename the current session" },
  { name: "title", description: "Alias of /rename" },
  { name: "timeline", description: "Show the recent user messages of this session" },
  { name: "fork", description: "Fork this session" },
  { name: "compact", description: "Summarize the session context to free tokens" },
  { name: "undo", description: "Undo the last user message" },
  { name: "redo", description: "Clear the revert point (redo)" },
  { name: "copy", description: "Copy the last assistant message" },
  { name: "export", description: "Export the session transcript (add `copy` to copy it)" },
  { name: "models", description: "Choose the model and thinking effort (alias: model)" },
  { name: "model", description: "Alias of /models" },
  { name: "agents", description: "Choose the agent (alias: agent)" },
  { name: "agent", description: "Alias of /agents" },
  { name: "variants", description: "Choose the thinking effort" },
  { name: "variant", description: "Alias of /variants" },
  { name: "thinking", description: "Alias of /variants" },
  { name: "effort", description: "Alias of /variants" },
  { name: "usage", description: "Show the current usage limits" },
  { name: "mcps", description: "List MCP servers and connect or disconnect one" },
  { name: "mcp", description: "Alias of /mcps" },
  { name: "connect", description: "Connect a provider or integration" },
  { name: "login", description: "Alias of /connect — add a provider API key" },
  { name: "skills", description: "Insert a skill mention into the prompt" },
  { name: "worktrees", description: "Move this session to a worktree" },
  { name: "cd", description: "Change the session's working directory" },
  { name: "editor", description: "Compose the next message in $EDITOR" },
  { name: "btw", description: "Ask a side question without adding it to the conversation" },
  { name: "diff", description: "Show the files this session changed" },
  { name: "stats", description: "Show usage: tokens, cost, activity, models and tools", argumentHint: "[days|all|cost|models|tools]" },
  { name: "plugins", description: "List loaded plugins" },
  { name: "settings", description: "Show the configuration files in use" },
  { name: "themes", description: "Switch the screen theme" },
  { name: "theme", description: "Alias of /themes" },
  { name: "status", description: "Show session status and token usage" },
  { name: "debug", description: "Show connection and session details" },
  { name: "highlights", description: "Show this build's version and a short summary" },
  { name: "pair", description: "Pair another device with this server" },
  { name: "web", description: "Alias of /pair" },
  { name: "restart", description: "Show how to restart the local service" },
  { name: "update", description: "Update Loophole to the latest version", argumentHint: "[version]" },
  { name: "upgrade", description: "Alias of /update" },
  { name: "reload", description: "Reload configuration" },
  { name: "terminal", description: "Show how to run a shell command" },
  { name: "exit", description: "Exit Loophole" },
  { name: "quit", description: "Alias of /exit" },
  { name: "q", description: "Alias of /exit" },
]

/** Slash command aliases kept for compatibility with the old screen and with OpenCode. */
const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  model: "models",
  agent: "agents",
  thinking: "variants",
  effort: "variants",
  variant: "variants",
  resume: "sessions",
  continue: "sessions",
  projects: "open",
  project: "open",
  web: "pair",
  login: "connect",
  theme: "themes",
  title: "rename",
  mcp: "mcps",
  reset: "clear",
  upgrade: "update",
  "release-notes": "changelog",
  h: "help",
  "?": "help",
  quit: "exit",
  q: "exit",
}

const EXIT_WORDS = ["exit", "quit", ":q"]

/** Popular integrations first, mirroring the upstream connect dialog. */
const INTEGRATION_PRIORITY: Readonly<Record<string, number>> = {
  opencode: 0,
  "opencode-go": 1,
  openai: 2,
  "github-copilot": 3,
  anthropic: 4,
  google: 5,
}

type ConnectMethod = Exclude<IntegrationInfo["methods"][number], { type: "env" }>

function connectMethods(integration: IntegrationInfo): ConnectMethod[] {
  return integration.methods.filter((method): method is ConnectMethod => method.type !== "env")
}

function methodLabel(method: ConnectMethod): string {
  return method.type === "key" ? (method.label ?? "API key") : method.label
}

function connectionLabels(integration: IntegrationInfo): string[] {
  return integration.connections.map((connection) =>
    connection.type === "credential" ? connection.label : `$${connection.name}`,
  )
}

function envNames(integration: IntegrationInfo): string[] {
  return integration.methods.flatMap((method) => (method.type === "env" ? method.names : []))
}

/** How many of the newest messages are shown again when a session is opened. */
const HISTORY_LIMIT = 80
const RECONNECT_MAX_DELAY = 10_000

/** /btw answers from what the session already knows and is not added to the conversation. */
const ASIDE_INSTRUCTIONS = [
  "The user is asking a quick side question about the conversation so far.",
  "Answer directly and concisely in markdown from what you already know.",
  "Do not call any tools and do not take any actions.",
].join(" ")

type PendingPermission = {
  id: string
  sessionID: string
  action: string
  resources: ReadonlyArray<string>
  message?: string
  metadata?: Record<string, unknown>
}

/** A file attached to a prompt through an `@mention`. */
type PromptAttachment = {
  readonly uri: string
  readonly name: string
  readonly mention: { readonly start: number; readonly end: number; readonly text: string }
}

/** Read the `@` token starting at `at`. Quoted paths may contain spaces. */
function readMentionToken(text: string, at: number): { path: string; end: number } | undefined {
  const quote = text[at + 1]
  if (quote === '"' || quote === "'") {
    const close = text.indexOf(quote, at + 2)
    if (close === -1) return undefined
    const path = text.slice(at + 2, close)
    return path ? { path, end: close + 1 } : undefined
  }
  const match = /^\S+/.exec(text.slice(at + 1))
  return match ? { path: match[0], end: at + 1 + match[0].length } : undefined
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/** Translate one server form field into a question the screen can ask. Hidden/external fields are filtered by the caller. */
function toQuestion(field: Exclude<FormField, { type: "external" }>): FormQuestion {
  const base = { key: field.key, title: field.title, description: field.description, required: field.required }
  switch (field.type) {
    case "string":
      return field.options && field.options.length > 0
        ? { ...base, kind: "single", options: field.options, custom: field.custom, defaultValue: field.default }
        : { ...base, kind: "text", placeholder: field.placeholder, defaultValue: field.default }
    case "number":
    case "integer":
      return {
        ...base,
        kind: field.type,
        minimum: number(field.minimum),
        maximum: number(field.maximum),
        defaultValue: number(field.default),
      }
    case "boolean":
      return { ...base, kind: "boolean", defaultValue: field.default }
    case "multiselect":
      return {
        ...base,
        kind: "multi",
        options: field.options,
        custom: field.custom,
        minItems: field.minItems,
        maxItems: field.maxItems,
        defaultValue: field.default,
      }
  }
}

function whenMatches(condition: { key: string; op: "eq" | "neq"; value: unknown }, answers: Record<string, FormAnswerValue>): boolean {
  const actual = answers[condition.key]
  const same = actual !== undefined && String(actual) === String(condition.value)
  return condition.op === "eq" ? same : !same
}

function toolOutput(content: ReadonlyArray<{ type: string; text?: string; name?: string | null; uri?: string }> | undefined): string {
  if (!content) return ""
  return content
    .map((item) => (item.type === "text" ? (item.text ?? "") : `[file ${item.name ?? item.uri ?? ""}]`))
    .filter((text) => text.length > 0)
    .join("\n")
}

/** Compact counts for /stats: 1.2m, 320k, 42. */
function formatCount(value: number): string {
  if (value >= 1_000_000_000) return `${trimStatDecimal(value / 1_000_000_000)}b`
  if (value >= 1_000_000) return `${trimStatDecimal(value / 1_000_000)}m`
  if (value >= 1_000) return `${trimStatDecimal(value / 1_000)}k`
  return String(Math.round(value))
}

function trimStatDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "")
}

function formatPercent(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`
}

function formatDuration(value: number): string {
  if (value < 1_000) return `${String(Math.round(value))}ms`
  return `${trimStatDecimal(value / 1_000)}s`
}

function truncateStat(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`
}

/** One `label   value` line inside a /stats section. */
function statRow(label: string, value: string): string {
  return `  ${currentTheme.fg("textMuted", label.padEnd(20))}${currentTheme.fg("text", value)}`
}

function statTableHeader(label: string, second: string, third: string, fourth: string): string {
  const row = `${truncateStat(label, 34).padEnd(34)}${second.padStart(10)}${third.padStart(12)}${fourth.padStart(12)}`
  return currentTheme.fg("textMuted", row)
}

function statTableRow(label: string, second: string, third: string, fourth: string): string {
  const name = truncateStat(label, 34).padEnd(34)
  return [
    currentTheme.fg("text", name),
    currentTheme.fg("textMuted", second.padStart(10)),
    currentTheme.fg("textMuted", third.padStart(12)),
    currentTheme.fg("textMuted", fourth.padStart(12)),
  ].join("")
}

/** The GitHub-style activity heatmap shown at the top of /stats. */
function renderStatActivity(
  stats: SessionStatsInfo,
  from: number,
  to: number,
  muted: (text: string) => string,
  strong: (text: string) => string,
): string[] {
  const width = Math.max(24, (process.stdout.columns ?? 80) - 10)
  const calendar = activityCalendar({ activity: stats.activity, from, to, maxWeeks: width })
  const months = calendar.months
    .map((month, index) =>
      (index === calendar.months.length - 1 || month.label.length <= month.span ? month.label : "").padEnd(month.span),
    )
    .join("")
    .trimEnd()
  const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
  const glyphs = ["·", "░", "▒", "▓", "█"]
  const paint = (level: number) => {
    if (level < 0) return " "
    if (level === 0) return muted(glyphs[0])
    if (level === 1) return muted(glyphs[1])
    if (level === 2) return currentTheme.fg("text", glyphs[2])
    if (level === 3) return strong(glyphs[3])
    return currentTheme.boldFg("primary", glyphs[4])
  }
  const lines = [
    `${strong("activity")}${calendar.clipped ? muted(` · last ${String(calendar.weeks.length)} weeks`) : ""}`,
    `   ${muted(months)}`,
  ]
  // Keep the seven weekday rows adjacent (GitHub-style). Blank lines between
  // them made the calendar tall and impossible to scan as a week.
  weekdays.forEach((label, day) => {
    lines.push(`${muted(label)} ${calendar.weeks.map((week) => paint(week[day].level)).join("")}`)
  })
  lines.push("", `   ${muted("less")} ${[0, 1, 2, 3, 4].map(paint).join("")} ${muted("more")}`)
  return lines
}

export class ScreenController {
  private readonly api: OpenCodeClient
  /** Mutable so /cd and /worktrees can move the session to another directory. */
  private directory: string
  private auto: boolean
  private readonly screen: Screen
  private sessionID: string | undefined
  /** The live title of the active session; kept in sync with /rename and session events. */
  private sessionTitle: string | undefined
  private serverCommands: CommandInfo[] = []
  private readonly events = new AbortController()
  private readonly owned = new Map<string, Promise<boolean>>()
  private readonly texts = new Map<string, { handle: StreamHandle; text: string }>()
  private readonly reasonings = new Map<string, { handle: StreamHandle; text: string }>()
  private readonly rawInputs = new Map<string, string>()
  /** The streaming compaction summary, shown the way OpenCode renders it. */
  private compaction: { handle: StreamHandle; text: string } | undefined
  private lastAssistant = ""
  private tokensIn = 0
  private tokensOut = 0
  /** Tokens in the model's context window, from the most recent step. */
  private contextTokens = 0
  private stopped = false
  /** Permission prompts and forms are answered one at a time so two dialogs never fight over the editor slot. */
  private promptQueue: Promise<void> = Promise.resolve()
  private readonly handledPrompts = new Set<string>()
  /** Resolves when the transcript matches the server. Events wait for it so they never race a history load. */
  private ready: Promise<void> = Promise.resolve()
  private connectedOnce = false
  private offline = false
  private currentModel: ModelRef | undefined
  private currentAgent: string | undefined
  private models: ModelInfo[] | undefined
  /** Provider display names, fetched lazily for the model picker. */
  private providerNames: Map<string, string> | undefined
  /** A model passed with `--model`; it must not be overridden by the remembered preference. */
  private readonly explicitModel: ModelRef | undefined
  /** A staged /undo revert must be committed before the next prompt is admitted. */
  private pendingRevert = false

  constructor(private readonly options: ScreenControllerOptions) {
    this.api = options.client
    this.directory = options.directory
    this.auto = options.auto ?? false
    this.sessionID = options.sessionID
    this.explicitModel = options.model
    this.screen = new Screen({
      directory: options.directory,
      auto: this.auto,
      commands: BUILTIN_COMMANDS,
      onSubmit: (text, mode) => void this.submit(text, mode),
      onInterrupt: () => void this.interrupt(),
      onExit: () => void this.exit(),
    })
  }

  async start(): Promise<void> {
    this.screen.setVersion(OPENCODE_VERSION)
    // One-shot home-screen announcement. Kept before start() so it lands in the
    // first frame above the transcript instead of being inserted later.
    this.screen.setAnnouncement({
      title: `New release: Loophole ${OPENCODE_VERSION}`,
      detail: "Run /changelog to see what changed, or /connect to add a provider key.",
    })
    this.screen.start()
    if (this.sessionID) this.ready = this.loadSession()
    void this.pumpEvents()
    if (!this.sessionID) {
      await this.createSession()
    } else {
      await this.ready
    }
    // Await the model list so the welcome panel can show the model's real name.
    await this.loadModels()
    // Restore the model the user picked last time, so a fresh launch does not
    // silently fall back to the server's default provider/model.
    await this.restoreModelPreference()
    await this.refreshServerCommands()
    this.screen.setReady(true)
    if (this.options.initialMessage?.trim()) await this.send(this.options.initialMessage.trim())
  }

  async stop(): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.events.abort()
    this.screen.stop()
  }

  private async exit(): Promise<never> {
    await this.stop()
    process.exit(0)
  }

  // --- session -------------------------------------------------------------------------------

  private async createSession(): Promise<void> {
    try {
      const session = await this.api.session.create({ location: { directory: this.directory } })
      this.sessionID = session.id
      await this.applyInfo(session)
    } catch (error) {
      this.screen.addStatus(`Failed to create a session: ${String(error)}`, "error")
    }
  }

  private async interrupt(): Promise<void> {
    if (!this.sessionID) return
    await this.api.session.interrupt({ sessionID: this.sessionID }).catch(() => {})
  }

  private async refreshServerCommands(): Promise<void> {
    try {
      const response = await this.api.command.list({ location: { directory: this.directory } })
      this.serverCommands = response.data
    } catch {
      this.serverCommands = []
    }
    const custom = this.serverCommands
      .filter((command) => !BUILTIN_COMMANDS.some((builtin) => builtin.name === command.name))
      .map((command): SlashCommand => ({ name: command.name, description: command.description ?? "custom command" }))
    this.screen.setCommands([...BUILTIN_COMMANDS, ...custom])
  }

  // --- input -------------------------------------------------------------------------------------

  private async submit(text: string, mode: ComposerMode = "prompt"): Promise<void> {
    const input = text.trim()
    if (!input) return
    // `!command` is the composer's local shell mode: run it here instead of
    // sending it to the model (the editor already stripped the `!`).
    if (mode === "bash") return await this.runShellCommand(input)
    if (EXIT_WORDS.includes(input.toLowerCase())) return void (await this.exit())
    if (input.startsWith("/")) {
      let name = input.slice(1)
      let args = ""
      const space = name.search(/\s/)
      if (space > 0) {
        args = name.slice(space).trim()
        name = name.slice(0, space)
      }
      await this.runCommand(name.toLowerCase(), args)
      return
    }
    await this.send(input)
  }

  /** Run one `!` command locally and show it as a Shell card. */
  private async runShellCommand(command: string): Promise<void> {
    const card = this.screen.tool(
      `local-shell-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
      "shell",
      true,
    )
    card.setInput({ command })
    card.setRunning()
    const shell =
      process.platform === "win32"
        ? [process.env.ComSpec?.trim() || "cmd.exe", "/d", "/s", "/c", command]
        : [process.env.SHELL?.trim() || "/bin/sh", "-c", command]
    try {
      const proc = Bun.spawn(shell, {
        cwd: this.directory,
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      })
      // Drain both pipes together: a chatty stderr must not fill its buffer
      // while we wait for stdout.
      const [stdout, stderr] = await Promise.all([
        proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
        proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
      ])
      const code = await proc.exited
      const output = [stdout, stderr]
        .map((part) => part.trimEnd())
        .filter((part) => part.length > 0)
        .join("\n")
      card.setResult({ output, isError: code !== 0 })
    } catch (error) {
      card.setResult({ output: String(error), isError: true })
    }
  }

  private async send(text: string): Promise<void> {
    if (!this.sessionID) {
      this.screen.addStatus("There is no session yet. Try /new.", "warning")
      return
    }
    this.screen.addUser(text)
    try {
      // A staged rewind is only a preview until the next prompt is sent: commit it first, or the
      // new message lands before the boundary the server still has staged.
      if (this.pendingRevert) {
        this.pendingRevert = false
        await this.api.session.revert.commit({ sessionID: this.sessionID }).catch(() => {})
      }
      const files = this.fileMentions(text)
      await this.api.session.prompt({
        sessionID: this.sessionID,
        text,
        delivery: "steer",
        ...(files.length > 0 ? { files } : {}),
      })
    } catch (error) {
      this.screen.addStatus(`Failed to send the message: ${String(error)}`, "error")
    }
  }

  /**
   * Turn `@path` tokens in a message into prompt file attachments.
   *
   * The server never parses `@` out of the text, so the CLI resolves each mention itself: the
   * token stays in the message and the attachment records its range so the UI can highlight it.
   * Quoted paths (with spaces) work, `~` is expanded, and a token only becomes an attachment when
   * the path actually exists.
   */
  private fileMentions(text: string): PromptAttachment[] {
    const files: PromptAttachment[] = []
    const seen = new Set<string>()
    let index = 0
    while (index < text.length) {
      const at = text.indexOf("@", index)
      if (at === -1) break
      const before = at === 0 ? "" : text[at - 1]
      if (before !== "" && !/[\s([{;,:=]/.test(before)) {
        index = at + 1
        continue
      }
      const token = readMentionToken(text, at)
      if (!token) {
        index = at + 1
        continue
      }
      const prefix = token.end - token.path.length
      let absolute = this.resolveMentionPath(token.path)
      let end = token.end
      if (!absolute) {
        // Trailing punctuation usually belongs to the sentence, not the file name.
        const trimmed = token.path.replace(/[.,;:!?)\]}]+$/, "")
        if (trimmed && trimmed !== token.path) {
          absolute = this.resolveMentionPath(trimmed)
          if (absolute) end = prefix + trimmed.length
        }
      }
      if (!absolute) {
        index = token.end
        continue
      }
      if (!seen.has(absolute)) {
        seen.add(absolute)
        files.push({
          uri: pathToFileURL(absolute).href,
          name: basename(absolute),
          mention: { start: at, end, text: text.slice(at, end) },
        })
      }
      index = token.end
    }
    return files
  }

  private resolveMentionPath(raw: string): string | undefined {
    if (!raw) return undefined
    const expanded = raw.startsWith("~") ? join(homedir(), raw.slice(1)) : raw
    const absolute = isAbsolute(expanded) ? expanded : resolve(this.directory, expanded)
    try {
      const info = statSync(absolute)
      return info.isFile() || info.isDirectory() ? absolute : undefined
    } catch {
      return undefined
    }
  }

  private async runCommand(name: string, args: string): Promise<void> {
    const sessionID = this.sessionID
    const command = COMMAND_ALIASES[name] ?? name
    try {
      switch (command) {
        case "exit":
          return void (await this.exit())
        case "help":
          return this.showHelp()
        case "version":
          return this.screen.addStatus(`Loophole ${OPENCODE_VERSION}`)
        case "changelog":
          return await this.showHighlights()
        case "feedback":
          return this.screen.addStatus(
            "Feedback\nReport issues and ideas at https://github.com/loophole-ai/loophole-app/issues",
          )
        case "status": {
          const name = this.sessionTitle ? `"${this.sessionTitle}" (${sessionID ?? "-"})` : (sessionID ?? "(none)")
          return this.screen.addStatus(
            `Session ${name} · ${String(this.tokensIn)} tokens in · ${String(this.tokensOut)} out`,
          )
        }
        case "clear":
          this.screen.clearTranscript()
          return
        case "new": {
          const session = await this.api.session.create({ location: { directory: this.directory } })
          await this.switchTo(session.id, session.title ?? "", session)
          return void (await this.refreshServerCommands())
        }
        case "sessions":
          return await this.pickSession()
        case "open":
          return await this.pickSession(true)
        case "models":
          return await this.pickModel(args)
        case "agents":
          return await this.pickAgent(args)
        case "variants":
          return await this.pickVariant(args)
        case "rename": {
          if (!sessionID) return this.screen.addStatus("There is no active session.", "warning")
          const title = args || (await this.screen.askText("Rename session", "New title"))
          if (!title?.trim()) return
          const next = title.trim()
          await this.api.session.update({ sessionID, title: next })
          // Keep every view of the session in sync: the welcome box, /status,
          // /debug, and the session picker all read this local title.
          this.sessionTitle = next
          this.screen.setSession(next)
          return this.screen.addStatus(`Session renamed to "${next}".`)
        }
        case "compact": {
          if (!sessionID) return this.screen.addStatus("There is no session to compact.", "warning")
          try {
            await this.api.session.compact({ sessionID })
            this.screen.addStatus(
              "Compaction requested. The conversation summary appears here when the model finishes.",
            )
          } catch (error) {
            this.screen.addStatus(`Could not compact the session: ${String(error)}`, "error")
          }
          return
        }
        case "undo":
          return await this.undo()
        case "redo":
          if (!sessionID) return this.screen.addStatus("There is no session.", "warning")
          await this.api.session.revert.clear({ sessionID })
          this.pendingRevert = false
          return this.screen.addStatus("Revert point cleared.")
        case "copy":
          return await this.copyLast()
        case "export":
          return await this.exportTranscript(args)
        case "fork":
          return await this.forkSession()
        case "timeline":
          return await this.showTimeline()
        case "usage":
          return await this.showUsage()
        case "mcps":
          return await this.pickMcp()
        case "connect":
          return await this.connectIntegration()
        case "skills":
          return await this.pickSkill()
        case "worktrees":
          return await this.pickWorktree()
        case "cd":
          return await this.changeDirectory(args)
        case "editor":
          return await this.openEditor()
        case "btw":
          return await this.askAside(args)
        case "diff":
          return await this.showDiff()
        case "stats":
          return await this.showStats(args)
        case "plugins":
          return await this.showPlugins()
        case "settings":
          return await this.showSettingsMenu()
        case "themes":
          return await this.pickTheme()
        case "debug":
          return await this.showDebug()
        case "highlights":
          return await this.showHighlights()
        case "pair":
          return await this.pairDevice()
        case "restart":
          return this.screen.addStatus(
            "The local service stops when this process exits. Close the screen and start Loophole again to restart it.",
          )
        case "update":
          return await this.updateCli(args)
        case "reload":
          await this.api.location.reload()
          await this.refreshServerCommands()
          return this.screen.addStatus("Configuration reloaded.")
        case "terminal":
          return this.screen.addStatus(
            "This screen uses your terminal's own scrollback. Type ! followed by a command to run a shell command.",
          )
        default: {
          if (!this.serverCommands.some((item) => item.name === name)) {
            return this.screen.addStatus(`Unknown command /${name}. Try /help.`, "warning")
          }
          if (!sessionID) return this.screen.addStatus(`There is no active session, cannot run /${name}.`, "warning")
          await this.api.session.command({ sessionID, name, text: args })
        }
      }
    } catch (error) {
      this.screen.addStatus(`/${name} failed: ${String(error)}`, "error")
    }
  }

  private showHelp(): void {
    const rows = [...BUILTIN_COMMANDS, ...this.serverCommands.filter((c) => !BUILTIN_COMMANDS.some((b) => b.name === c.name))]
      .map((command) => `  /${command.name.padEnd(14)} ${command.description ?? ""}`)
      .join("\n")
    this.screen.addStatus(
      `Commands\n${rows}\n\nctrl+shift+p opens the command palette · ctrl+o expands tool output · esc interrupts · ctrl+c twice exits\n/models, /agents and /variants change what the next message uses`,
    )
  }

  private async pickSession(all = false): Promise<void> {
    const response = all
      ? await this.api.session.list({ order: "desc", limit: 30 })
      : await this.api.session.list({ directory: this.directory, order: "desc", limit: 30 })
    const sessions: SessionInfo[] = response.data
    if (sessions.length === 0) return this.screen.addStatus("There are no sessions yet.")
    const id = await this.screen.pickFilterable(
      all ? "Open a session" : "Switch session",
      sessions.map((session) => ({
        value: session.id,
        label:
          session.id === this.sessionID && this.sessionTitle ? this.sessionTitle : session.title || session.id,
        description:
          session.location.directory === this.directory
            ? session.tokens
              ? `${String(Math.round(session.tokens.input / 1000))}k in`
              : undefined
            : session.location.directory,
      })),
      0,
      "type to search sessions · ↑/↓ select · enter open · esc back",
    )
    const picked = sessions.find((session) => session.id === id)
    if (!picked) return
    if (picked.location.directory !== this.directory) {
      this.directory = picked.location.directory
      this.screen.setDirectory(this.directory)
      await this.refreshServerCommands()
    }
    await this.switchTo(picked.id, picked.title ?? "", picked)
  }

  private async copyLast(): Promise<void> {
    if (!this.lastAssistant) return this.screen.addStatus("There is nothing to copy yet.")
    const clipboard = getNativeClipboard()
    if (!clipboard?.setText) return this.screen.addStatus("The clipboard is not available on this platform.", "warning")
    await clipboard.setText(this.lastAssistant)
    this.screen.addStatus("Copied the last assistant message.")
  }

  private async exportTranscript(args: string): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session to export.", "warning")
    const data = await this.api.session.export({ sessionID })
    const lines: string[] = [`# ${data.info.title ?? sessionID}`, ""]
    for (const message of data.messages) {
      if (message.type === "user") {
        lines.push("## User", "", message.text.trim(), "")
      } else if (message.type === "assistant") {
        const text = message.content
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("\n")
          .trim()
        if (text) lines.push("## Assistant", "", text, "")
      }
    }
    const markdown = lines.join("\n")
    if (args.trim().toLowerCase() === "copy") {
      const clipboard = getNativeClipboard()
      if (!clipboard?.setText) return this.screen.addStatus("The clipboard is not available on this platform.", "warning")
      await clipboard.setText(markdown)
      return this.screen.addStatus(`Copied the transcript (${String(data.messages.length)} messages).`)
    }
    const file = join(tmpdir(), `loophole-session-${sessionID}.md`)
    writeFileSync(file, markdown, "utf8")
    this.screen.addStatus(`Exported ${String(data.messages.length)} messages to ${file}`)
  }

  private async forkSession(): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session to fork.", "warning")
    const session = await this.api.session.fork({ sessionID })
    await this.switchTo(session.id, session.title ?? "", session)
    await this.refreshServerCommands()
    this.screen.addStatus("Forked the session.")
  }

  private async showTimeline(): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session.", "warning")
    const response = await this.api.message.list({ sessionID, limit: 100, order: "desc" })
    const users = response.data
      .filter((message): message is Extract<SessionMessageInfo, { type: "user" }> => message.type === "user" && message.text.trim().length > 0)
      .reverse()
    if (users.length === 0) return this.screen.addStatus("There are no user messages yet.")
    const rows = users.slice(-15).map((message, index) => {
      const first = message.text.trim().split(/\r?\n/)[0] ?? ""
      return `  ${String(index + 1).padStart(2)}. ${first.length > 90 ? `${first.slice(0, 87)}…` : first}`
    })
    this.screen.addStatus(`Timeline (newest last)\n${rows.join("\n")}`)
  }

  private async showUsage(): Promise<void> {
    const response = await this.api.usage.limits({ location: { directory: this.directory } })
    const info = response.data
    if (!info) return this.screen.addStatus("No usage limits are available for this workspace.")
    const lines = [`Workspace: ${info.workspace.name ?? info.workspace.id}`]
    if (info.go) {
      lines.push(
        `Go: rolling ${String(info.go.rolling.percent)}% · weekly ${String(info.go.weekly.percent)}% · monthly ${String(info.go.monthly.percent)}%`,
      )
    }
    for (const budget of info.budgets) {
      lines.push(`${budget.id}: $${budget.spent.toFixed(2)} of $${budget.limit.toFixed(2)}`)
    }
    lines.push(info.workspace.usageURL)
    this.screen.addStatus(`Usage\n${lines.join("\n")}`)
  }

  private async pickMcp(): Promise<void> {
    const response = await this.api.mcp.list({ location: { directory: this.directory } })
    const servers = response.data
    if (servers.length === 0) return this.screen.addStatus("No MCP servers are configured.")
    const name = await this.screen.pick(
      "MCP servers",
      servers.map((server) => ({
        value: server.name,
        label: server.title ?? server.name,
        description: this.mcpStatus(server.status),
      })),
    )
    const server = servers.find((item) => item.name === name)
    if (!server) return
    if (server.status.status === "connected") {
      await this.api.mcp.disconnect({ server: server.name, location: { directory: this.directory } })
      return this.screen.addStatus(`Disconnected ${server.name}.`)
    }
    await this.api.mcp.connect({ server: server.name, location: { directory: this.directory } })
    this.screen.addStatus(`Connecting ${server.name}…`)
  }

  private mcpStatus(status: { status: string; error?: string }): string {
    if (status.status === "failed" || status.status === "needs_auth") return `${status.status}: ${status.error ?? ""}`
    return status.status
  }

  private async connectIntegration(): Promise<void> {
    const response = await this.api.integration.list({ location: { directory: this.directory } })
    const integrations = response.data
    if (integrations.length === 0) {
      return this.screen.addStatus(
        "No integrations are available. Make sure the local service is running, then try /reload.",
        "warning",
      )
    }

    const sorted = [...integrations].sort(
      (a, b) =>
        (INTEGRATION_PRIORITY[a.id] ?? 99) - (INTEGRATION_PRIORITY[b.id] ?? 99) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    const integrationID = await this.screen.pickFilterable(
      "Connect a provider or integration",
      sorted.map((integration) => {
        const methods = connectMethods(integration)
        const connections = connectionLabels(integration)
        return {
          value: integration.id,
          label: `${connections.length > 0 ? "✓ " : ""}${integration.name}`,
          description:
            connections.length > 0
              ? connections.join(", ")
              : methods.length > 0
                ? methods.map(methodLabel).join(" · ")
                : envNames(integration).length > 0
                  ? `env: ${envNames(integration).join(", ")}`
                  : "no connect method",
        }
      }),
      0,
      "type to search providers · ↑/↓ select · enter connect · esc cancel",
    )
    if (!integrationID) return
    const integration = sorted.find((item) => item.id === integrationID)
    if (!integration) return

    const methods = connectMethods(integration)
    if (methods.length === 0) {
      const env = envNames(integration)
      return this.screen.addStatus(
        env.length > 0
          ? `${integration.name} uses environment variables: ${env.join(", ")}. Set one, then run /reload.`
          : `${integration.name} cannot be connected from this screen.`,
      )
    }

    let method = methods[0]
    if (methods.length > 1) {
      const picked = await this.screen.pick(
        `Connect ${integration.name}`,
        methods.map((item, index) => ({ value: String(index), label: methodLabel(item) })),
      )
      if (picked === undefined) return
      method = methods[Number(picked)]
    }
    if (!method) return

    const answer = await this.askMethodForm(method)
    if (answer === null) return
    const formAnswer = answer && Object.keys(answer).length > 0 ? { answer } : {}

    if (method.type === "key") {
      const key = await this.screen.askText(`API key for ${integration.name}`, "Paste the key")
      if (!key?.trim()) return
      await this.api.integration.connect.key({
        integrationID: integration.id,
        key: key.trim(),
        ...formAnswer,
        location: { directory: this.directory },
      })
      return await this.connectedIntegration(integration.name)
    }

    if (method.type === "external") {
      await this.api.integration.connect.external({
        integrationID: integration.id,
        methodID: method.id,
        ...formAnswer,
        location: { directory: this.directory },
      })
      return await this.connectedIntegration(integration.name)
    }

    if (method.type === "command") {
      const attempt = await this.api.integration.command.connect({
        integrationID: integration.id,
        methodID: method.id,
        location: { directory: this.directory },
      })
      this.screen.addStatus(`Waiting for ${integration.name} to finish signing in…`)
      const result = await this.pollCommand(integration.id, attempt.data.attemptID)
      if (result === "complete") await this.connectedIntegration(integration.name)
      return
    }

    const attempt = await this.api.integration.oauth.connect({
      integrationID: integration.id,
      methodID: method.id,
      ...formAnswer,
      location: { directory: this.directory },
    })
    const data = attempt.data
    this.screen.addStatus(`${integration.name}\n${data.instructions}\n${data.url}\n\nWaiting for sign-in…`)

    if (data.mode === "code") {
      const code = await this.screen.askText(
        `Authorization code for ${integration.name}`,
        "Paste the code from the browser",
      )
      if (!code?.trim()) {
        await this.api.integration.oauth
          .cancel({ integrationID: integration.id, attemptID: data.attemptID, location: { directory: this.directory } })
          .catch(() => {})
        return
      }
      await this.api.integration.oauth.complete({
        integrationID: integration.id,
        attemptID: data.attemptID,
        code: code.trim(),
        location: { directory: this.directory },
      })
      return await this.connectedIntegration(integration.name)
    }

    const result = await this.pollOAuth(integration.id, data.attemptID, data.time.expires)
    if (result === "complete") await this.connectedIntegration(integration.name)
  }

  /** Ask the optional form fields a connect method declares (base URL, region, …). */
  private async askMethodForm(
    method: ConnectMethod,
  ): Promise<Record<string, FormAnswerValue> | null | undefined> {
    const fields = "form" in method ? (method.form ?? []) : []
    const answer: Record<string, FormAnswerValue> = {}
    for (const field of fields) {
      if (field.type === "external") continue
      if (field.when && !field.when.every((condition) => whenMatches(condition, answer))) continue
      if (field.hidden) {
        if (field.default !== undefined) answer[field.key] = field.default as FormAnswerValue
        continue
      }
      const value = await this.screen.askQuestion(toQuestion(field))
      if (value === undefined) return null
      answer[field.key] = value
    }
    return answer
  }

  /** Refresh the model/command lists after a provider or integration is connected. */
  private async connectedIntegration(name: string): Promise<void> {
    await this.loadModels(true)
    if (!this.currentModel) {
      const fallback = await this.api.model.default({ location: { directory: this.directory } }).catch(() => undefined)
      if (fallback?.data) {
        this.currentModel = { providerID: fallback.data.providerID, id: fallback.data.id }
        this.refreshIdentity()
      }
    }
    await this.refreshServerCommands()
    this.screen.addStatus(`${name} connected.`)
  }

  private async pollCommand(
    integrationID: string,
    attemptID: string,
  ): Promise<"complete" | "failed" | "timeout"> {
    const deadline = Date.now() + 5 * 60_000
    while (Date.now() < deadline) {
      await this.sleep(1000)
      const response = await this.api.integration.command
        .status({ integrationID, attemptID, location: { directory: this.directory } })
        .catch(() => undefined)
      const status = response?.data
      if (!status) continue
      if (status.status === "complete") return "complete"
      if (status.status === "failed") {
        this.screen.addStatus(status.message, "error")
        return "failed"
      }
      if (status.status === "pending" && status.message) this.screen.addStatus(status.message)
    }
    this.screen.addStatus("The sign-in attempt timed out.", "warning")
    return "timeout"
  }

  private async pollOAuth(
    integrationID: string,
    attemptID: string,
    expires: number,
  ): Promise<"complete" | "failed" | "expired" | "timeout"> {
    while (Date.now() < expires) {
      await this.sleep(2000)
      const response = await this.api.integration.oauth
        .status({ integrationID, attemptID, location: { directory: this.directory } })
        .catch(() => undefined)
      const status = response?.data
      if (!status) continue
      if (status.status === "complete") return "complete"
      if (status.status === "failed") {
        this.screen.addStatus(`Connection failed: ${status.message}`, "error")
        return "failed"
      }
      if (status.status === "expired") {
        this.screen.addStatus("The sign-in attempt expired.", "warning")
        return "expired"
      }
    }
    this.screen.addStatus("The sign-in attempt timed out.", "warning")
    return "timeout"
  }

  private async pickSkill(): Promise<void> {
    const response = await this.api.skill.list({ location: { directory: this.directory } })
    const skills = response.data
    if (skills.length === 0) return this.screen.addStatus("No skills are available.")
    const id = await this.screen.pickFilterable(
      "Skills",
      skills.map((skill) => ({ value: skill.id, label: skill.name, description: skill.description })),
      0,
      "type to search skills · ↑/↓ select · enter insert · esc back",
    )
    const skill = skills.find((item) => item.id === id)
    if (!skill) return
    this.screen.insertPrompt(`@${skill.name} `)
    this.screen.addStatus(`Inserted @${skill.name} into the prompt.`)
  }

  private async pickWorktree(): Promise<void> {
    const location = await this.api.location.get({ location: { directory: this.directory } })
    const worktrees = await this.api.worktree.list({ projectID: location.project.id })
    if (worktrees.length === 0) return this.screen.addStatus("This project has no worktrees.")
    const directory = await this.screen.pickCurrent(
      "Move this session to a worktree",
      worktrees.map((worktree) => ({
        value: worktree.directory,
        label: worktree.directory,
        description: worktree.strategy,
      })),
      this.directory,
    )
    if (!directory || directory === this.directory) return
    await this.moveTo(directory)
  }

  private async changeDirectory(args: string): Promise<void> {
    const input = args.trim() || (await this.screen.askText("Change working directory", this.directory))
    if (!input?.trim()) return
    const value = input.trim()
    const expanded = value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value
    await this.moveTo(resolve(this.directory, expanded))
  }

  /** Move the active session (and every later request) to another directory. */
  private async moveTo(directory: string): Promise<void> {
    const sessionID = this.sessionID
    if (sessionID) await this.api.session.move({ sessionID, directory })
    this.directory = directory
    this.screen.setDirectory(directory)
    await this.refreshServerCommands()
    if (sessionID) await this.loadSession()
    this.screen.addStatus(`Working directory: ${directory}`)
  }

  private async openEditor(): Promise<void> {
    const configured = process.env.VISUAL?.trim() || process.env.EDITOR?.trim() || (process.platform === "win32" ? "notepad" : "vi")
    const [editor, ...editorArgs] = configured.split(/\s+/)
    if (!editor) return this.screen.addStatus("No editor is configured. Set $EDITOR.", "warning")
    const file = join(tmpdir(), `loophole-prompt-${String(process.pid)}.md`)
    writeFileSync(file, this.screen.getPrompt(), "utf8")
    this.screen.stop()
    try {
      const result = spawnSync(editor, [...editorArgs, file], { stdio: "inherit" })
      if (result.error) {
        this.screen.addStatus(`Could not open ${editor}: ${result.error.message}`, "error")
        return
      }
      const text = readFileSync(file, "utf8").trim()
      if (text) this.screen.setPrompt(text)
    } finally {
      this.screen.start()
    }
  }

  private async askAside(args: string): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session.", "warning")
    const question = args.trim() || (await this.screen.askText("Ask a side question", "Ask anything"))
    if (!question?.trim()) return
    this.screen.addStatus(`/btw ${question.trim()}`)
    const result = await this.api.session.generate({
      sessionID,
      prompt: `${ASIDE_INSTRUCTIONS}\n\n${question.trim()}`,
    })
    this.screen.addAssistant(result.text.trim())
  }

  private async showDiff(): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session.", "warning")

    // `session.diff` is wrapped in `{ data }`; the promise client does not
    // unwrap it, unlike the session getters. Missing this made /diff always
    // look empty.
    const turn = await this.api.session
      .diff({ sessionID, context: 12 })
      .catch(() => undefined)
    const turnFiles = (turn?.data ?? []).filter((diff) => diff.more !== true)
    if (this.renderDiffFiles(turnFiles)) return

    // The turn diff compares git snapshots, so a directory that is not a git
    // repository (or a session that predates snapshots) reports nothing. Fall
    // back to the working-tree diff, then to the files the session touched.
    const working = await this.api.vcs
      .diff({ location: { directory: this.directory }, mode: "working", context: 12 })
      .catch(() => undefined)
    const workingFiles = (working?.data ?? []).filter((diff) => diff.more !== true)
    if (this.renderDiffFiles(workingFiles)) return

    const files = await this.changedFiles(sessionID)
    if (files.length === 0) return this.screen.addStatus("This session has not changed any files.")
    const rows = files.slice(0, 40).map((file) => `  ${file}`)
    const more = files.length > 40 ? `\n  … ${String(files.length - 40)} more` : ""
    this.screen.addStatus(
      `Files changed\n${rows.join("\n")}${more}\n\nNo git snapshot is available here, so this lists the files the session touched.`,
    )
  }

  /** Render diff panels; returns false when there is nothing to show. */
  private renderDiffFiles(files: ReadonlyArray<FileDiffInfo>): boolean {
    if (files.length === 0) return false
    const shown = files.slice(0, 20)
    this.screen.addDiff(shown)
    if (files.length > shown.length) {
      this.screen.addStatus(`… ${String(files.length - shown.length)} more changed files.`)
    }
    return true
  }

  /** Files a session touched, from assistant snapshots and tool inputs. */
  private async changedFiles(sessionID: string): Promise<string[]> {
    const response = await this.api.message.list({ sessionID, limit: 500, order: "asc" }).catch(() => undefined)
    if (!response) return []
    const files = new Set<string>()
    const add = (value: unknown) => {
      if (typeof value === "string" && value.length > 0) files.add(value)
    }
    for (const message of response.data) {
      if (message.type !== "assistant") continue
      for (const file of message.snapshot?.files ?? []) add(file)
      for (const part of message.content) {
        if (part.type !== "tool") continue
        const state = part.state
        if (state.status !== "completed" && state.status !== "error") continue
        const input = state.input as Record<string, unknown>
        add(input.filePath)
        add(input.file_path)
        add(input.path)
        const paths = input.paths
        if (Array.isArray(paths)) for (const path of paths) add(path)
      }
    }
    return [...files].sort()
  }

  /**
   * `/stats` — usage, cost, activity, models and tool reliability, modelled on
   * `loophole-cli stats --full`. Optional args: `all`, a number of days, or any of
   * `cost`, `models`, `tools` to show only those sections.
   */
  private async showStats(args: string): Promise<void> {
    const words = args.trim().toLowerCase().split(/\s+/).filter((word) => word.length > 0)
    const only = new Set(words.filter((word) => word === "cost" || word === "models" || word === "tools"))
    const all = words.includes("all")
    const days = words.map((word) => Number(word)).find((value) => Number.isFinite(value) && value >= 0)

    const now = new Date()
    const to = now.getTime() + 1
    let from: number | undefined
    let label: string
    if (all) {
      label = "all time"
    } else if (days !== undefined) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      start.setDate(start.getDate() - Math.max(0, days - 1))
      from = start.getTime()
      label = days <= 1 ? "today" : `last ${String(days)} days`
    } else {
      from = new Date(now.getFullYear(), 0, 1).getTime()
      label = `${String(now.getFullYear())} so far`
    }

    const stats = await this.api.session.stats({
      ...(from !== undefined ? { from } : {}),
      to,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      tools: "detail",
    })

    const muted = (text: string) => currentTheme.fg("textMuted", text)
    const strong = (text: string) => currentTheme.fg("primary", text)
    const totalTokens = TokenUsage.total(stats.tokens)
    const totals = stats.tools.mode === "none" ? undefined : stats.tools.totals
    const finished = (totals?.succeeded ?? 0) + (totals?.failed ?? 0)
    const success = finished > 0 ? ((totals?.succeeded ?? 0) / finished) * 100 : undefined
    const empty = stats.sessions === 0 && stats.prompts === 0 && stats.steps === 0

    const lines: string[] = [`${currentTheme.boldFg("primary", "Stats")} ${muted(`· ${label} · all projects`)}`, ""]
    // Passing a section name (`cost`, `models`, `tools`) narrows the report the
    // way the CLI's `stats --models` / `--tools` / `--cost` flags do.
    if (only.size === 0) {
      if (empty) {
        lines.push(muted("No activity in this range."))
      } else {
        lines.push(...renderStatActivity(stats, from ?? stats.range.from, stats.range.to, muted, strong))
        lines.push("")
        const sessions = [`${strong(formatCount(stats.sessions))} ${stats.sessions === 1 ? "session" : "sessions"}`]
        if (stats.subagents > 0) sessions.push(`${strong(formatCount(stats.subagents))} subagents`)
        lines.push(sessions.join(muted(" · ")))
        lines.push(
          `${strong(formatCount(stats.prompts))} prompts ${muted("·")} ${strong(formatCount(stats.steps))} steps ${muted("·")} ${strong(formatCount(totalTokens))} tokens`,
        )
        lines.push(
          `${success === undefined ? muted("no tool calls") : `${strong(formatPercent(success))} tool success`} ${muted("·")} ${strong(formatCount(stats.activeDays))} active days ${muted("·")} best streak ${strong(String(stats.streak))} ${stats.streak === 1 ? "day" : "days"}`,
        )
      }
    }

    const section = (title: string) => {
      if (lines[lines.length - 1] !== "") lines.push("")
      lines.push(currentTheme.boldFg("primary", title))
    }
    const show = (name: string) => only.size === 0 || only.has(name)
    if (show("cost")) {
      section("COST & TOKENS")
      const input = stats.tokens.input + stats.tokens.cache.read + stats.tokens.cache.write
      const cached = input === 0 ? 0 : (stats.tokens.cache.read / input) * 100
      lines.push(
        statRow("cost", `$${stats.cost.toFixed(2)}`),
        statRow("input", formatCount(stats.tokens.input)),
        statRow("output", formatCount(stats.tokens.output)),
        statRow("reasoning", formatCount(stats.tokens.reasoning)),
        statRow("cache read", formatCount(stats.tokens.cache.read)),
        statRow("cache write", formatCount(stats.tokens.cache.write)),
        statRow("cached input", formatPercent(cached)),
      )
    }
    if (show("models")) {
      section("MODELS")
      if (stats.models.length === 0) {
        lines.push(muted("  no model usage"))
      } else {
        const shown = stats.models.slice(0, 10)
        lines.push(statTableHeader("model", "tokens", "steps", "cost"))
        for (const item of shown) {
          lines.push(
            statTableRow(
              `${item.model.providerID}/${item.model.id}${item.model.variant ? `#${item.model.variant}` : ""}`,
              formatCount(TokenUsage.total(item.tokens)),
              formatCount(item.steps),
              `$${item.cost.toFixed(2)}`,
            ),
          )
        }
        const more = stats.models.length - shown.length
        if (more > 0) lines.push(muted(`  +${String(more)} more models`))
      }
    }
    if (show("tools")) {
      section("TOOL RELIABILITY")
      if (stats.tools.mode !== "detail" || stats.tools.usage.length === 0) {
        lines.push(muted("  no tool calls"))
      } else {
        const shown = stats.tools.usage.slice(0, 10)
        lines.push(statTableHeader("tool", "calls", "error", "p50"))
        for (const tool of shown) {
          const terminal = tool.succeeded + tool.failed
          lines.push(
            statTableRow(
              tool.name,
              formatCount(tool.calls),
              terminal === 0 ? "-" : formatPercent((tool.failed / terminal) * 100),
              tool.durationP50 === undefined ? "-" : formatDuration(tool.durationP50),
            ),
          )
        }
        const more = stats.tools.usage.length - shown.length
        if (more > 0) lines.push(muted(`  +${String(more)} more tools`))
        lines.push(
          "",
          muted(`${formatCount(finished)} finished calls · ${formatCount(totals?.unfinished ?? 0)} unfinished`),
        )
      }
    }
    lines.push("", muted("loophole.ai"))
    this.screen.addReport(lines.join("\n"))
  }

  /** `/update` — run this CLI's own `upgrade` command and show what it did. */
  private async updateCli(args: string): Promise<void> {
    const target = args.trim().split(/\s+/)[0] ?? ""
    this.screen.addStatus(target ? `Updating Loophole to ${target}…` : "Checking for a Loophole update…")
    let command: string[]
    try {
      command = selfCommand()
    } catch (error) {
      return this.screen.addStatus(`Could not locate the Loophole executable: ${String(error)}`, "error")
    }
    const [executable, ...prefix] = command
    const result = spawnSync(executable, [...prefix, "upgrade", ...(target ? [target] : [])], {
      encoding: "utf8",
      timeout: 180_000,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    })
    if (result.error) return this.screen.addStatus(`Update failed: ${result.error.message}`, "error")
    const output = stripVTControlCharacters(`${result.stdout ?? ""}\n${result.stderr ?? ""}`)
      .replaceAll("\r", "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
    if (result.status !== 0) {
      return this.screen.addStatus(
        `Update failed (exit code ${String(result.status ?? "unknown")}).\n${output.join("\n") || "The updater printed no details."}`,
        "error",
      )
    }
    const shown = output.slice(-40)
    const hidden = output.length - shown.length
    const body = shown.join("\n") + (hidden > 0 ? `\n… ${String(hidden)} more lines` : "")
    this.screen.addStatus(body.length > 0 ? `Update\n${body}` : "Loophole is up to date.")
  }

  private async showPlugins(): Promise<void> {
    const response = await this.api.plugin.list({ location: { directory: this.directory } })
    if (response.data.length === 0) return this.screen.addStatus("No plugins are loaded.")
    const rows = response.data.map((plugin) => {
      const name = plugin.id ?? this.pluginSource(plugin.source)
      const state = plugin.state.status === "active" ? "active" : `failed: ${plugin.state.error}`
      return `  ${name} — ${state}`
    })
    this.screen.addStatus(`Plugins\n${rows.join("\n")}`)
  }

  private pluginSource(source: { type: string; target?: string; path?: string }): string {
    if (source.type === "package") return source.target ?? "package"
    if (source.type === "local") return source.path ?? "local"
    return source.type
  }

  /** Interactive settings hub, wired to the engine's live state. */
  private async showSettingsMenu(): Promise<void> {
    for (;;) {
      const picked = await this.screen.pick("Settings", [
        {
          value: "model",
          label: "Model",
          description: this.currentModel ? this.modelLabel(this.currentModel) : "not set",
        },
        {
          value: "thinking",
          label: "Thinking effort",
          description: this.currentModel?.variant ?? "default",
        },
        {
          value: "agent",
          label: "Agent",
          description: this.currentAgent ?? "default",
        },
        {
          value: "theme",
          label: "Theme",
          description: this.screen.getTheme(),
        },
        {
          value: "auto",
          label: "Auto-approve",
          description: this.auto ? "on — permission prompts are skipped" : "off — ask before running tools",
        },
        {
          value: "directory",
          label: "Working directory",
          description: this.directory,
        },
        {
          value: "connect",
          label: "Providers & integrations",
          description: "add an API key or sign in",
        },
        {
          value: "config",
          label: "Configuration files",
          description: "loophole.json and the config files in use",
        },
        {
          value: "mcps",
          label: "MCP servers",
          description: "connect or disconnect a server",
        },
        {
          value: "plugins",
          label: "Plugins",
          description: "loaded plugins and their state",
        },
        {
          value: "usage",
          label: "Usage limits",
          description: "workspace budget and rolling usage",
        },
        {
          value: "debug",
          label: "Debug info",
          description: "server, session and model details",
        },
        { value: "close", label: "Close settings" },
      ])
      if (!picked || picked === "close") return
      switch (picked) {
        case "model":
          await this.pickModel("")
          break
        case "thinking":
          await this.pickVariant("")
          break
        case "agent":
          await this.pickAgent("")
          break
        case "theme":
          await this.pickTheme()
          break
        case "auto":
          this.auto = !this.auto
          this.screen.setAuto(this.auto)
          this.screen.addStatus(`Auto-approve ${this.auto ? "on" : "off"}.`)
          break
        case "directory":
          await this.changeDirectory("")
          break
        case "connect":
          await this.connectIntegration()
          break
        case "config":
          await this.showSettings()
          break
        case "mcps":
          await this.pickMcp()
          break
        case "plugins":
          await this.showPlugins()
          break
        case "usage":
          await this.showUsage()
          break
        case "debug":
          await this.showDebug()
          break
      }
    }
  }

  private async showSettings(): Promise<void> {
    const entries = await this.api.config.get({ location: { directory: this.directory } })
    const lines: string[] = []
    for (const entry of entries) {
      if (entry.type === "directory") {
        lines.push(`directory: ${entry.path}`)
        continue
      }
      lines.push(`config: ${entry.path ?? "(inline)"}`)
      const model = entry.info.model
      if (model) {
        lines.push(
          `  model: ${
            typeof model === "string"
              ? model
              : `${model.providerID}/${model.model}${model.variant ? ` (${model.variant})` : ""}`
          }`,
        )
      }
      if (entry.info.default_agent) lines.push(`  default_agent: ${entry.info.default_agent}`)
      if (entry.info.share) lines.push(`  share: ${entry.info.share}`)
      if (entry.info.update) lines.push(`  update: ${entry.info.update}`)
    }
    this.screen.addStatus(lines.length > 0 ? `Settings\n${lines.join("\n")}` : "No configuration files are loaded.")
  }

  private async pickTheme(): Promise<void> {
    const picked = await this.screen.pickCurrent(
      "Theme",
      [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "auto", label: "Auto (detect from the terminal)" },
      ],
      this.screen.getTheme(),
    )
    if (!picked) return
    await this.screen.setTheme(picked)
    this.screen.addStatus(`Theme: ${picked}`)
  }

  private async showDebug(): Promise<void> {
    const info = await this.api.server.info().catch(() => undefined)
    const lines = [
      `server: ${info ? `${info.version} (pid ${String(info.pid)})` : "unavailable"}`,
      `urls: ${info?.urls.join(", ") ?? "unknown"}`,
      `directory: ${this.directory}`,
      `session: ${this.sessionTitle ? `"${this.sessionTitle}" (${this.sessionID ?? "-"})` : (this.sessionID ?? "(none)")}`,
      `agent: ${this.currentAgent ?? "(default)"}`,
      `model: ${this.currentModel ? this.modelLabel(this.currentModel) : "(default)"}`,
      `tokens: ${String(this.tokensIn)} in · ${String(this.tokensOut)} out`,
    ]
    this.screen.addStatus(`Debug\n${lines.join("\n")}`)
  }

  private async showHighlights(): Promise<void> {
    const info = await this.api.server.info().catch(() => undefined)
    this.screen.addStatus(
      `Loophole ${info?.version ?? ""}\nThe Loophole terminal screen: sessions, agents, tools, MCP, skills, plugins and the full command set.`,
    )
  }

  private async pairDevice(): Promise<void> {
    const pair = await this.api.server.pair()
    const minutes = Math.max(1, Math.round(pair.expires_in / 60))
    this.screen.addStatus(
      `Pairing code: ${pair.code}\nExpires in ${String(minutes)} minute${minutes === 1 ? "" : "s"}. Open Loophole on the other device and enter this code to connect.`,
    )
  }

  private async undo(): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no session.", "warning")
    const response = await this.api.message.list({ sessionID, limit: 50, order: "desc" })
    const lastUser = response.data.find((message) => message.type === "user" && message.text.trim().length > 0)
    if (!lastUser || lastUser.type !== "user") return this.screen.addStatus("Nothing to undo.", "warning")
    await this.api.session.interrupt({ sessionID })
    await this.api.session.wait({ sessionID }).catch(() => {})
    await this.api.session.revert.stage({ sessionID, messageID: lastUser.id })
    this.pendingRevert = true
    this.screen.setPrompt(lastUser.text)
    this.screen.addStatus("Undid the last message. It is back in the prompt; edit and send it again.")
  }

  private async switchTo(id: string, title: string, info?: SessionInfo): Promise<void> {
    this.sessionID = id
    this.sessionTitle = title || undefined
    this.tokensIn = 0
    this.tokensOut = 0
    this.pendingRevert = false
    this.lastAssistant = ""
    this.texts.clear()
    this.reasonings.clear()
    this.rawInputs.clear()
    this.screen.clearTranscript()
    this.screen.setBusy(false)
    this.screen.setUsage(0, 0)
    this.contextTokens = 0
    this.screen.setContext(0, this.contextWindow())
    this.ready = this.loadSession(info)
    await this.ready
    if (this.transcriptEmpty) this.screen.addStatus(title ? `Session: ${title}` : "Started a new session.")
  }

  // --- loading a session: history, model/agent, pending prompts ------------------------------------------

  private transcriptEmpty = true

  private async loadSession(known?: SessionInfo): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return
    try {
      const info = known ?? (await this.api.session.get({ sessionID }))
      await this.applyInfo(info)
      await this.replayHistory(sessionID)
      await this.restorePending()
    } catch (error) {
      this.screen.addStatus(`Could not load the session: ${String(error)}`, "error")
    }
  }

  /** Show the session's agent and model in the footer, falling back to the server default model. */
  private async applyInfo(info: SessionInfo): Promise<void> {
    this.currentAgent = info.agent
    this.currentModel = info.model
    this.pendingRevert = info.revert !== undefined
    this.sessionTitle = info.title || undefined
    this.screen.setSession(info.title || info.id)
    if (!this.currentModel) {
      const fallback = await this.api.model.default({ location: { directory: this.directory } }).catch(() => undefined)
      if (fallback?.data) this.currentModel = { providerID: fallback.data.providerID, id: fallback.data.id }
    }
    this.refreshIdentity()
  }

  private refreshIdentity(): void {
    this.screen.setAgent(this.currentAgent)
    this.screen.setModel(this.currentModel ? this.modelLabel(this.currentModel) : undefined)
    this.screen.setContext(this.contextTokens, this.contextWindow())
  }

  /** The context window of the active model, or 0 when the server has not reported one yet. */
  private contextWindow(): number {
    const model = this.currentModel
    if (!model) return 0
    const known = this.models?.find((item) => item.providerID === model.providerID && item.id === model.id)
    return known?.limit.context ?? 0
  }

  private modelLabel(model: ModelRef): string {
    const known = this.models?.find((item) => item.providerID === model.providerID && item.id === model.id)
    const base = known ? known.name : `${model.providerID}/${model.id}`
    return model.variant ? `${base} (${model.variant})` : base
  }

  /** Draw the newest messages of the session again, the way they looked when they were live. */
  private async replayHistory(sessionID: string): Promise<void> {
    const response = await this.api.message.list({ sessionID, limit: HISTORY_LIMIT, order: "desc" })
    if (sessionID !== this.sessionID) return
    const messages: SessionMessageInfo[] = [...response.data].reverse()

    this.texts.clear()
    this.reasonings.clear()
    this.rawInputs.clear()
    this.screen.clearTranscript()
    this.transcriptEmpty = messages.length === 0

    let tokensIn = 0
    let tokensOut = 0
    let contextTokens = 0
    let running = false
    for (const [index, message] of messages.entries()) {
      switch (message.type) {
        case "user":
          this.screen.addUser(message.text)
          break
        case "assistant": {
          tokensIn += message.tokens?.input ?? 0
          tokensOut += message.tokens?.output ?? 0
          const usage = message.tokens
        contextTokens = usage
          ? usage.input + usage.output + usage.reasoning + usage.cache.read + usage.cache.write
          : 0
          // The newest message may still be streaming; the live events draw it instead.
          const streaming = index === messages.length - 1 && message.time.completed === undefined && message.finish === undefined
          if (streaming) {
            running = true
            break
          }
          for (const part of message.content) {
            if (part.type === "text") {
              if (part.text.trim()) {
                this.screen.addAssistant(part.text)
                this.lastAssistant = part.text
              }
            } else if (part.type === "reasoning") {
              if (part.text.trim()) this.screen.addReasoning(part.text)
            } else {
              this.replayTool(part)
            }
          }
          if (message.error) this.screen.addStatus(`Error: ${message.error.message}`, "error")
          break
        }
        case "compaction":
          this.screen.addStatus("Conversation compacted.")
          break
        default:
          break
      }
    }
    this.tokensIn = tokensIn
    this.tokensOut = tokensOut
    this.contextTokens = contextTokens
    this.screen.setUsage(tokensIn, tokensOut)
    this.screen.setContext(contextTokens, this.contextWindow())
    this.screen.setBusy(running)
    if (response.cursor.next) {
      this.screen.addStatus(`Showing the last ${String(HISTORY_LIMIT)} messages of this session.`)
    }
  }

  private replayTool(part: Extract<SessionMessageInfo, { type: "assistant" }>["content"][number] & { type: "tool" }): void {
    const card = this.screen.tool(part.id, part.name)
    const state = part.state
    if (state.status === "streaming") return
    card.setInput(state.input)
    if (state.status === "running") return card.setRunning()
    if (state.status === "completed") {
      return card.setResult({ output: toolOutput(state.content), isError: false, metadata: state.metadata })
    }
    const detail = toolOutput(state.content)
    card.setResult({
      output: detail ? `${state.error.message}\n${detail}` : state.error.message,
      isError: true,
      metadata: state.metadata,
    })
  }

  /** Prompts that were raised while this screen was not listening (start-up, reconnect). */
  private async restorePending(): Promise<void> {
    const location = { directory: this.directory }
    const [forms, permissions] = await Promise.all([
      this.api.form.list({ location }).catch(() => undefined),
      this.api.permission.request.list({ location }).catch(() => undefined),
    ])
    for (const request of permissions?.data ?? []) {
      if (await this.ownsSession(request.sessionID)) this.queuePermission(request)
    }
    for (const form of forms?.data ?? []) {
      if (await this.ownsSession(form.sessionID)) this.queueForm(form)
    }
  }

  // --- model, agent, thinking effort ---------------------------------------------------------------------

  private async loadModels(force = false): Promise<ModelInfo[]> {
    if (this.models && !force) return this.models
    // A forced reload follows /connect or /reload, so refresh the provider
    // display names too instead of keeping the pre-connect cache.
    if (force) this.providerNames = undefined
    try {
      const response = await this.api.model.list({ location: { directory: this.directory }, types: ["chat"] })
      this.models = response.data.filter((model) => model.enabled && model.status !== "deprecated")
      this.refreshIdentity()
    } catch (error) {
      this.models = this.models ?? []
      if (force) this.screen.addStatus(`Could not list models: ${String(error)}`, "error")
    }
    return this.models
  }

  /**
   * Apply the model chosen in an earlier CLI session. A model passed with
   * `--model` always wins, and an unknown/unavailable preference is ignored so
   * removing a provider never leaves the screen pointing at a dead model.
   */
  private async restoreModelPreference(): Promise<void> {
    if (this.explicitModel || !this.sessionID) return
    const preferred = readScreenPreferences().model
    if (!preferred) return
    const known = this.models?.find(
      (model) => model.providerID === preferred.providerID && model.id === preferred.id,
    )
    if (!known) return
    const current = this.currentModel
    if (
      current !== undefined &&
      current.providerID === preferred.providerID &&
      current.id === preferred.id &&
      current.variant === preferred.variant
    ) {
      return
    }
    try {
      await this.api.session.switchModel({ sessionID: this.sessionID, model: preferred })
      this.currentModel = preferred
      this.refreshIdentity()
    } catch {
      // The session may already have moved on; the remembered model is best-effort.
    }
  }

  private async applyModel(model: ModelRef): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no active session.", "warning")
    await this.api.session.switchModel({ sessionID, model })
    this.currentModel = model
    saveScreenModel(model)
    this.refreshIdentity()
    this.screen.addStatus(`Model: ${this.modelLabel(model)}`)
  }

  private async pickModel(args: string): Promise<void> {
    const models = await this.loadModels(true)
    if (models.length === 0) return this.screen.addStatus("No models are available. Connect a provider first.", "warning")

    // `/models provider/model` selects directly. A bare provider name (no slash)
    // falls through to the provider picker below.
    if (args.includes("/")) {
      const [reference, variant] = args.split(/\s+/)
      const match = models.find(
        (model) =>
          `${model.providerID}/${model.id}` === reference ||
          `${model.providerID}/${model.modelID}` === reference,
      )
      if (!match) return this.screen.addStatus(`Unknown model "${reference}". Use /models to browse.`, "warning")
      if (variant && !match.variants.some((item) => item.id === variant)) {
        return this.screen.addStatus(`"${match.name}" has no thinking effort called "${variant}".`, "warning")
      }
      return await this.applyModel({ providerID: match.providerID, id: match.id, variant })
    }

    // Provider first, then that provider's models (the Kimi picker flow). The
    // provider is no longer repeated on every row, because the second dialog
    // already scopes the list to one provider.
    const current = this.currentModel
    const names = await this.loadProviderNames()
    const grouped = new Map<string, ModelInfo[]>()
    for (const model of models) {
      const list = grouped.get(model.providerID)
      if (list) list.push(model)
      else grouped.set(model.providerID, [model])
    }
    const providerLabel = (id: string) => names.get(id) ?? id
    const providerIDs = [...grouped.keys()].sort((a, b) => {
      if (a === current?.providerID) return -1
      if (b === current?.providerID) return 1
      return providerLabel(a).localeCompare(providerLabel(b))
    })

    // `/models openrouter` jumps straight to that provider's models.
    const requested = args.trim().toLowerCase()
    const direct = requested
      ? providerIDs.find(
          (id) => id.toLowerCase() === requested || providerLabel(id).toLowerCase() === requested,
        )
      : undefined
    const providerID =
      direct ??
      (await this.screen.pickCurrent(
        "Select a provider",
        providerIDs.map((id) => ({
          value: id,
          label: `${id === current?.providerID ? "✓ " : ""}${providerLabel(id)}`,
          description: `${String(grouped.get(id)?.length ?? 0)} model${(grouped.get(id)?.length ?? 0) === 1 ? "" : "s"}`,
        })),
        current?.providerID,
      ))
    if (!providerID) return

    const options = [...(grouped.get(providerID) ?? [])].sort((a, b) => {
      // OpenRouter's free router picks any free model with capacity, so it is the
      // most reliable free choice; keep it at the top of OpenRouter's list.
      if (providerID === "openrouter") {
        const freeRouter = Number(b.id === "openrouter/free") - Number(a.id === "openrouter/free")
        if (freeRouter !== 0) return freeRouter
      }
      return b.time.released - a.time.released || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    })
    if (options.length === 0) return
    const selectedID =
      current !== undefined && current.providerID === providerID ? current.id : undefined
    const rows = options.map((model) => {
      const isCurrent =
        current !== undefined && current.providerID === providerID && current.id === model.id
      const isFreeRouter = providerID === "openrouter" && model.id === "openrouter/free"
      return {
        value: model.id,
        label: `${isCurrent ? "✓ " : ""}${isFreeRouter ? "Free Models Router" : model.name}`,
        description: isFreeRouter
          ? "free · picks an available free model automatically"
          : [
              `${String(Math.round(model.limit.context / 1000))}k context`,
              model.limit.output > 0 ? `${String(Math.round(model.limit.output / 1000))}k output` : undefined,
              model.variants.length > 0
                ? `thinking: ${model.variants.map((variant) => variant.id).join(", ")}`
                : undefined,
              model.status === "alpha" || model.status === "beta" ? model.status : undefined,
            ]
              .filter((part): part is string => part !== undefined)
              .join(" · "),
      }
    })
    const currentIndex = Math.max(0, options.findIndex((model) => model.id === selectedID))
    const modelID = await this.screen.pickFilterable(
      `${providerLabel(providerID)} models`,
      rows,
      currentIndex,
      "type to search models · ↑/↓ select · enter confirm · esc back",
    )
    if (!modelID) return
    const chosen = options.find((model) => model.id === modelID)
    if (!chosen) return

    let variant: string | undefined
    if (chosen.variants.length > 0) {
      const sameModel =
        current !== undefined && current.providerID === chosen.providerID && current.id === chosen.id
      const picked = await this.chooseVariant(chosen, sameModel ? current?.variant : undefined)
      if (picked === undefined) return
      variant = picked || undefined
    }
    await this.applyModel({ providerID: chosen.providerID, id: chosen.id, variant })
  }

  /** Provider display names for the model picker; ids are the fallback. */
  private async loadProviderNames(): Promise<Map<string, string>> {
    if (this.providerNames) return this.providerNames
    const response = await this.api.provider
      .list({ location: { directory: this.directory } })
      .catch(() => undefined)
    this.providerNames = new Map((response?.data ?? []).map((provider) => [provider.id, provider.name]))
    return this.providerNames
  }

  /** Resolves with the variant id, "" for the model's default, or undefined when cancelled. */
  private chooseVariant(model: ModelInfo, current: string | undefined): Promise<string | undefined> {
    return this.screen.pickCurrent(
      `Thinking effort for ${model.name}`,
      [{ value: "", label: "Default" }, ...model.variants.map((variant) => ({ value: variant.id, label: variant.id }))],
      current ?? "",
    )
  }

  private async pickVariant(args: string): Promise<void> {
    const current = this.currentModel
    if (!current) return this.screen.addStatus("There is no model selected yet. Use /model.", "warning")
    const models = await this.loadModels()
    const info = models.find((model) => model.providerID === current.providerID && model.id === current.id)
    if (!info || info.variants.length === 0) {
      return this.screen.addStatus(`${this.modelLabel({ ...current, variant: undefined })} has no thinking effort options.`, "warning")
    }
    let variant: string | undefined
    if (args) {
      const wanted = args.trim()
      if (wanted !== "default" && !info.variants.some((item) => item.id === wanted)) {
        return this.screen.addStatus(
          `Unknown effort "${wanted}". Options: default, ${info.variants.map((item) => item.id).join(", ")}.`,
          "warning",
        )
      }
      variant = wanted === "default" ? undefined : wanted
    } else {
      const picked = await this.chooseVariant(info, current.variant)
      if (picked === undefined) return
      variant = picked || undefined
    }
    await this.applyModel({ providerID: current.providerID, id: current.id, variant })
  }

  private async pickAgent(args: string): Promise<void> {
    const sessionID = this.sessionID
    if (!sessionID) return this.screen.addStatus("There is no active session.", "warning")
    const response = await this.api.agent.list({ location: { directory: this.directory } })
    const agents = response.data.filter((agent) => agent.mode !== "subagent" && !agent.hidden)
    if (agents.length === 0) return this.screen.addStatus("No agents are available.", "warning")
    let id = args.trim()
    if (id) {
      if (!agents.some((agent) => agent.id === id)) {
        return this.screen.addStatus(`Unknown agent "${id}". Options: ${agents.map((agent) => agent.id).join(", ")}.`, "warning")
      }
    } else {
      const picked = await this.screen.pickCurrent(
        "Choose an agent",
        agents.map((agent) => ({ value: agent.id, label: agent.name, description: agent.description })),
        this.currentAgent,
      )
      if (!picked) return
      id = picked
    }
    await this.api.session.switchAgent({ sessionID, agent: id })
    this.currentAgent = id
    this.refreshIdentity()
    this.screen.addStatus(`Agent: ${id}`)
  }

  // --- server events -------------------------------------------------------------------------------

  /**
   * Follow the server's event stream for as long as the screen is open. When the connection drops it
   * retries with a growing delay; every new connection starts with `server.connected`, which is the
   * cue to re-sync the transcript (see onEvent).
   */
  private async pumpEvents(): Promise<void> {
    let failures = 0
    while (!this.stopped) {
      try {
        for await (const event of this.api.event.subscribe({ signal: this.events.signal })) {
          failures = 0
          try {
            await this.onEvent(event)
          } catch (error) {
            this.screen.addStatus(`Event handling failed: ${String(error)}`, "error")
          }
        }
      } catch {
        // Fall through to the reconnect path below.
      }
      if (this.stopped) return
      if (!this.offline) {
        this.offline = true
        this.screen.setOffline(true)
        this.screen.addStatus("Lost the connection to the server. Reconnecting…", "warning")
      }
      failures += 1
      await this.sleep(Math.min(1000 * 2 ** (failures - 1), RECONNECT_MAX_DELAY))
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms)
      this.events.signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true })
    })
  }

  private ownsSession(sessionID: string): Promise<boolean> {
    if (sessionID === this.sessionID) return Promise.resolve(true)
    const known = this.owned.get(sessionID)
    if (known) return known
    // Subagents run in child sessions of the current one.
    const result = this.api.session
      .get({ sessionID })
      .then((session) => (session.parentID ? this.ownsSession(session.parentID) : false))
      .catch(() => false)
    this.owned.set(sessionID, result)
    return result
  }

  private key(data: { assistantMessageID: string; ordinal: number }): string {
    return `${data.assistantMessageID}:${String(data.ordinal)}`
  }

  private async onEvent(event: EventSubscribeOutput): Promise<void> {
    if (event.type === "server.connected") {
      // Every connection announces itself. The first one matches what start() already loaded; later ones
      // mean the connection dropped, so events may have been missed: redraw from the server's state.
      const reconnected = this.connectedOnce
      this.connectedOnce = true
      if (this.offline) {
        this.offline = false
        this.screen.setOffline(false)
      }
      if (reconnected) {
        this.ready = this.resync()
      }
      return
    }
    await this.ready
    if (event.type === "permission.asked") {
      if (await this.ownsSession(event.data.sessionID)) this.queuePermission(event.data)
      return
    }
    if (event.type === "form.created") {
      if (await this.ownsSession(event.data.form.sessionID)) this.queueForm(event.data.form)
      return
    }
    // A rename from this screen, the desktop app, or another client must not
    // leave /status, /debug, or the session picker pointing at the old title.
    if (event.type === "session.renamed") {
      if (event.data.sessionID === this.sessionID) {
        this.sessionTitle = event.data.title
        this.screen.setSession(event.data.title)
      }
      return
    }
    if (!("sessionID" in event.data) || event.data.sessionID !== this.sessionID) return

    switch (event.type) {
      case "session.execution.started":
        return this.screen.setBusy(true)
      case "session.execution.succeeded":
        return this.screen.setBusy(false)
      case "session.execution.interrupted":
        this.screen.setBusy(false)
        return this.screen.addStatus("Interrupted.", "warning")
      case "session.execution.failed":
        this.screen.setBusy(false)
        return this.screen.addStatus(`Error: ${event.data.error.message}`, "error")
      case "session.retry.scheduled": {
        const reason = event.data.error.message.replace(/\s+/g, " ").trim()
        const detail = reason.length > 160 ? `${reason.slice(0, 157)}…` : reason
        // OpenRouter's per-model ":free" endpoints share an upstream pool and can
        // be saturated; its free router picks an available one. Say so instead of
        // letting the retry loop look like a broken model.
        const tip =
          event.data.attempt === 1 &&
          this.currentModel?.providerID === "openrouter" &&
          this.currentModel.id.endsWith(":free")
            ? "\nTip: /models openrouter/openrouter/free picks an available free model automatically."
            : ""
        return this.screen.addStatus(
          `Request failed${detail ? `: ${detail}` : ""} — retrying (attempt ${String(event.data.attempt)})… (Esc to stop)${tip}`,
          "warning",
        )
      }
      case "session.compaction.started":
        // Mirror the upstream TUI: a "Compaction" block that streams the summary
        // as the model writes it, instead of a status line that only appears at
        // the end.
        this.screen.addStatus("Compacting the conversation…")
        this.compaction = { handle: this.screen.beginText(), text: "**Compaction**\n\n" }
        this.compaction.handle.update(this.compaction.text)
        return
      case "session.compaction.delta": {
        if (!this.compaction) return
        this.compaction.text += event.data.text
        this.compaction.handle.update(this.compaction.text)
        return
      }
      case "session.compaction.ended": {
        const tokens = event.data.tokens
        if (tokens) {
          this.contextTokens = tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
          this.screen.setContext(this.contextTokens, this.contextWindow())
        }
        const summary = event.data.text.trim()
        if (this.compaction) {
          this.compaction.handle.end(summary ? `**Compaction**\n\n${summary}` : this.compaction.text)
          this.compaction = undefined
          return
        }
        return this.screen.addStatus(summary ? `Conversation compacted.\n\n${summary}` : "Conversation compacted.")
      }
      case "session.compaction.failed":
        this.compaction = undefined
        return this.screen.addStatus(`Could not compact the conversation: ${event.data.error.message}`, "error")
      case "session.text.started":
        this.texts.set(this.key(event.data), { handle: this.screen.beginText(), text: "" })
        return
      case "session.text.delta": {
        const key = this.key(event.data)
        let part = this.texts.get(key)
        if (!part) {
          part = { handle: this.screen.beginText(), text: "" }
          this.texts.set(key, part)
        }
        part.text += event.data.delta
        this.lastAssistant = part.text
        part.handle.update(part.text)
        return
      }
      case "session.text.ended": {
        const key = this.key(event.data)
        const open = this.texts.get(key) ?? { handle: this.screen.beginText(), text: "" }
        open.handle.end(event.data.text)
        this.texts.delete(key)
        this.lastAssistant = event.data.text
        return
      }
      case "session.reasoning.started":
        this.reasonings.set(this.key(event.data), { handle: this.screen.beginReasoning(), text: "" })
        return
      case "session.reasoning.delta": {
        const part = this.reasonings.get(this.key(event.data))
        if (!part) return
        part.text += event.data.delta
        part.handle.update(part.text)
        return
      }
      case "session.reasoning.ended": {
        const key = this.key(event.data)
        this.reasonings.get(key)?.handle.end(event.data.text)
        this.reasonings.delete(key)
        return
      }
      case "session.tool.input.started":
        this.screen.tool(event.data.id, event.data.name)
        return
      case "session.tool.input.delta": {
        this.rawInputs.set(event.data.id, (this.rawInputs.get(event.data.id) ?? "") + event.data.delta)
        return
      }
      case "session.tool.input.ended": {
        this.rawInputs.delete(event.data.id)
        try {
          const parsed: unknown = JSON.parse(event.data.text)
          if (parsed && typeof parsed === "object") {
            this.screen.tool(event.data.id, "tool").setInput(parsed as Record<string, unknown>)
          }
        } catch {
          // Incomplete input is replaced by the exact one in tool.called.
        }
        return
      }
      case "session.tool.called": {
        const card = this.screen.tool(event.data.id, "tool")
        card.setInput(event.data.input)
        card.setRunning()
        return
      }
      case "session.tool.progress":
        return this.screen.tool(event.data.id, "tool").setProgress(event.data.metadata)
      case "session.tool.success":
        return this.screen.tool(event.data.id, "tool").setResult({
          output: toolOutput(event.data.content),
          isError: false,
          metadata: event.data.metadata,
        })
      case "session.tool.failed": {
        const detail = toolOutput(event.data.content)
        return this.screen.tool(event.data.id, "tool").setResult({
          output: detail ? `${event.data.error.message}\n${detail}` : event.data.error.message,
          isError: true,
          metadata: event.data.metadata,
        })
      }
      case "session.agent.selected":
        this.currentAgent = event.data.agent
        return this.refreshIdentity()
      case "session.model.selected":
        this.currentModel = event.data.model
        return this.refreshIdentity()
      case "session.step.ended":
        const step = event.data.tokens
        this.tokensIn += step.input
        this.tokensOut += step.output
        this.contextTokens = step.input + step.output + step.reasoning + step.cache.read + step.cache.write
        this.screen.setContext(this.contextTokens, this.contextWindow())
        return this.screen.addUsage(event.data.tokens.input, event.data.tokens.output)
    }
  }

  // --- permissions and questions -----------------------------------------------------------------------

  private queuePermission(request: PendingPermission): void {
    if (this.handledPrompts.has(request.id)) return
    this.handledPrompts.add(request.id)
    this.promptQueue = this.promptQueue.then(() => this.answerPermission(request)).catch(() => {})
  }

  private async answerPermission(request: PendingPermission): Promise<void> {
    const decision: PermissionDecision = this.auto ? { decision: "once" } : await this.screen.askPermission(request)
    await this.api.permission
      .reply({
        sessionID: request.sessionID,
        requestID: request.id,
        decision: decision.decision,
        // Feedback turns a plain decline into a correction the model can act on.
        ...(decision.decision === "reject" && decision.message ? { message: decision.message } : {}),
      })
      .catch(() => {})
  }

  private queueForm(form: FormInfo): void {
    if (this.handledPrompts.has(form.id)) return
    this.handledPrompts.add(form.id)
    this.promptQueue = this.promptQueue.then(() => this.answerForm(form)).catch(() => {})
  }

  /** Ask every question of a form, one dialog at a time, then send the answers (or cancel on Esc). */
  private async answerForm(form: FormInfo): Promise<void> {
    const askable = form.fields.filter((field) => field.type !== "external" && !field.hidden)
    const answers: Record<string, FormAnswerValue> = {}
    let position = 0
    for (const field of form.fields) {
      if (field.type === "external") {
        this.screen.addStatus(`${field.title ?? "This form"} needs a browser: ${field.url}`, "warning")
        continue
      }
      if (field.hidden) continue
      if (field.when && !field.when.every((condition) => whenMatches(condition, answers))) continue
      position += 1
      const progress = askable.length > 1 ? `${String(position)}/${String(askable.length)}` : undefined
      const value = await this.screen.askQuestion(toQuestion(field), progress)
      if (value === undefined) {
        this.screen.addStatus("Question dismissed.", "warning")
        await this.api.session.form.cancel({ sessionID: form.sessionID, formID: form.id }).catch(() => {})
        return
      }
      if (value === "" || (Array.isArray(value) && value.length === 0 && !field.required)) continue
      answers[field.key] = value
    }
    await this.api.session.form
      .reply({ sessionID: form.sessionID, formID: form.id, answer: answers })
      .catch((error) => this.screen.addStatus(`Could not send the answers: ${String(error)}`, "error"))
  }

  // --- re-sync after a reconnect -------------------------------------------------------------------------

  private async resync(): Promise<void> {
    if (!this.sessionID) return
    await this.loadSession()
    this.screen.addStatus("Reconnected.")
  }
}
