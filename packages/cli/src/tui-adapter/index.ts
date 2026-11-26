/**
 * TUI Adapter - Bridges Loophole backend to PI TUI
 *
 * Interactive chat surface built from pi's widget set: an Editor (with slash
 * command + @path autocomplete), a markdown transcript, a status line, and
 * SelectList pickers. Aims to feel like the pi CLI while driving Loophole's
 * client-server API.
 */

import type { Endpoint } from "@opencode/client/effect/service"
import type { CommandInfo, EventSubscribeOutput, OpenCodeClient, SessionInfo } from "@opencode/client/promise"
import {
	CombinedAutocompleteProvider,
	Container,
	Editor,
	getNativeClipboard,
	Markdown,
	matchesKey,
	ProcessTerminal,
	ScrollView,
	SelectList,
	Spacer,
	TuiMainScreen,
	Text,
	type AutocompleteItem,
	type SelectItem,
	type TUI,
	type SlashCommand,
	VStack,
} from "@loophole/tui-pi"
import { FooterComponent } from "./footer"
import { getLogoLines } from "./logo"
import { BUILTIN_COMMANDS, EXIT_WORDS } from "./commands"
import { accent, danger, dim, editorTheme, markdownTheme } from "./theme"

export interface TuiAdapterOptions {
	/** Client already connected to the server (built with Service.headers(endpoint)). */
	client: OpenCodeClient
	endpoint: Endpoint
	directory: string
	/** Session to attach to. When omitted the adapter creates a fresh one. */
	sessionID?: string
	/** Approve permission requests automatically (like `run --auto`). Otherwise they are rejected. */
	auto?: boolean
	/** Sent as the first prompt once the UI is up. */
	initialMessage?: string
}

export class TuiAdapter {
	private ui: TUI
	private container: Container
	private editorSlot: VStack
	private messageContainer: VStack
	private editor: Editor
	private footer: FooterComponent
	private api: OpenCodeClient
	private endpoint: Endpoint
	private directory: string
	private auto: boolean
	private initialMessage: string | undefined
	private sessionID: string | undefined
	private serverCommands: CommandInfo[] = []
	private tokensIn = 0
	private tokensOut = 0
	private lastAssistant = ""
	private busy = false
	private stopped = false
	private lastCtrlC = 0
	private events = new AbortController()
	private textParts = new Map<string, { view: Markdown; text: string }>()
	private owned = new Map<string, Promise<boolean>>()

	constructor(options: TuiAdapterOptions) {
		this.endpoint = options.endpoint
		this.directory = options.directory
		this.api = options.client
		this.sessionID = options.sessionID
		this.auto = options.auto ?? false
		this.initialMessage = options.initialMessage

		const terminal = new ProcessTerminal()
		// No log directory: debug logging stays off and crash dumps go to the OS temp dir.
		this.ui = new TuiMainScreen(terminal, false, undefined)

		this.container = new VStack([])

		for (const line of getLogoLines("tiny")) {
			this.container.addChild(new Text(line))
		}
		this.container.addChild(new Spacer())

		this.messageContainer = new VStack([])
		const scrollView = new ScrollView(this.messageContainer)
		this.container.addChild(scrollView)
		this.container.addChild(new Spacer())

		// Editor lives in its own slot so pickers (/sessions) can swap in
		// without disturbing the container's layout order.
		this.editorSlot = new VStack([])
		this.container.addChild(this.editorSlot)
		this.container.addChild(new Spacer())

		this.footer = new FooterComponent({
			cwd: this.directory,
		})
		this.container.addChild(this.footer)
		this.ui.addChild(this.container)

		this.editor = new Editor(this.ui, editorTheme, {
			paddingX: 1,
			autocompleteMaxVisible: 10,
		})
		this.editor.setAutocompleteProvider(new CombinedAutocompleteProvider([...BUILTIN_COMMANDS], this.directory, null))
		this.editor.onSubmit = (text) => void this.handleSubmit(text)
		this.editorSlot.addChild(this.editor)

		// Raw-mode terminals deliver Ctrl+C / Esc as input, not as SIGINT.
		this.ui.addInputListener((data) => {
			if (matchesKey(data, "ctrl+c")) {
				if (this.busy) {
					void this.interrupt()
					return { consume: true }
				}
				const now = Date.now()
				if (now - this.lastCtrlC < 2000) {
					void this.stop().then(() => process.exit(0))
				} else {
					this.lastCtrlC = now
					this.showStatus("press Ctrl+C again to exit")
				}
				return { consume: true }
			}
			if (this.busy && matchesKey(data, "escape")) {
				void this.interrupt()
				return { consume: true }
			}
			return undefined
		})
	}

	async start(): Promise<void> {
		this.ui.start()
		this.ui.setFocus(this.editor)
		void this.pumpEvents()
		if (!this.sessionID) await this.createSession()
		else this.refreshFooter()
		this.showStatus("Type /help for commands, / to browse commands, @path to attach files.")
		await this.refreshServerCommands()
		if (this.initialMessage?.trim()) await this.send(this.initialMessage.trim())
	}

	async stop(): Promise<void> {
		if (this.stopped) return
		this.stopped = true
		this.events.abort()
		this.ui.stop()
	}

	// --- session lifecycle ----------------------------------------------------

	private async createSession(): Promise<void> {
		try {
			const session = await this.api.session.create({
				location: { directory: this.directory },
			})
			this.sessionID = session.id
			this.refreshFooter()
		} catch (error) {
			this.showStatus(`failed to create session: ${error}`)
		}
	}

	private async interrupt(): Promise<void> {
		if (!this.sessionID) return
		await this.api.session.interrupt({ sessionID: this.sessionID }).catch(() => {})
	}

	private async refreshServerCommands(): Promise<void> {
		try {
			const response = await this.api.command.list({
				location: { directory: this.directory },
			})
			this.serverCommands = response.data
		} catch {
			// Registry stays empty; built-in commands still work.
			this.serverCommands = []
		}
		const custom: SlashCommand[] = this.serverCommands
			.filter((cmd) => !BUILTIN_COMMANDS.some((builtin) => builtin.name === cmd.name))
			.map((cmd): SlashCommand => ({ name: cmd.name, description: cmd.description ?? "custom command" }))
		this.editor.setAutocompleteProvider(
			new CombinedAutocompleteProvider([...BUILTIN_COMMANDS, ...custom], this.directory, null),
		)
	}

	private refreshFooter(): void {
		this.footer.update({
			tokensIn: this.tokensIn,
			tokensOut: this.tokensOut,
			busy: this.busy,
		})
		this.requestRender()
	}

	// --- input handling --------------------------------------------------------

	private async handleSubmit(text: string): Promise<void> {
		const inputText = text.trim()
		this.editor.setText("")
		if (!inputText) return

		if ((EXIT_WORDS as readonly string[]).includes(inputText.toLowerCase())) {
			await this.stop()
			process.exit(0)
		}

		if (inputText.startsWith("/")) {
			let name = inputText.slice(1)
			let args = ""
			const space = name.search(/\s/)
			if (space > 0) {
				args = name.slice(space).trim()
				name = name.slice(0, space)
			}
			await this.dispatch(name.toLowerCase(), args)
			return
		}

		await this.send(inputText)
	}

	private async send(text: string): Promise<void> {
		if (!this.sessionID) {
			this.showStatus("no session yet - try /new once the backend is reachable")
			return
		}
		this.messageContainer.addChild(new Text(`${accent("you")} ${text}`))
		this.requestRender()
		try {
			await this.api.session.prompt({
				sessionID: this.sessionID,
				text,
				delivery: "steer",
			})
		} catch (error) {
			this.showStatus(`failed to send message: ${error}`)
		}
	}

	// --- server events -----------------------------------------------------------

	private async pumpEvents(): Promise<void> {
		try {
			for await (const event of this.api.event.subscribe({ signal: this.events.signal })) {
				try {
					await this.onEvent(event)
				} catch (error) {
					this.showStatus(`event handling failed: ${error}`)
				}
			}
			if (!this.stopped) this.showStatus(danger("event stream ended - restart to reconnect"))
		} catch (error) {
			if (!this.stopped) this.showStatus(danger(`event stream disconnected: ${error}`))
		}
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

	private async onEvent(event: EventSubscribeOutput): Promise<void> {
		if (event.type === "permission.asked") {
			if (await this.ownsSession(event.data.sessionID)) await this.answerPermission(event.data)
			return
		}
		if (event.type === "form.created") {
			if (await this.ownsSession(event.data.form.sessionID)) await this.cancelForm(event.data.form)
			return
		}
		if (!("sessionID" in event.data) || event.data.sessionID !== this.sessionID) return

		switch (event.type) {
			case "session.execution.started":
				this.setBusy(true)
				return
			case "session.execution.succeeded":
				this.setBusy(false)
				return
			case "session.execution.interrupted":
				this.setBusy(false)
				this.showStatus("interrupted")
				return
			case "session.execution.failed":
				this.setBusy(false)
				this.showStatus(danger(`error: ${event.data.error.message}`))
				return
			case "session.text.started": {
				const view = new Markdown("", 0, 0, markdownTheme)
				this.textParts.set(this.partKey(event.data), { view, text: "" })
				this.messageContainer.addChild(view)
				this.requestRender()
				return
			}
			case "session.text.delta": {
				const part = this.textParts.get(this.partKey(event.data))
				if (!part) return
				part.text += event.data.delta
				part.view.setText(part.text)
				this.lastAssistant = part.text
				this.requestRender()
				return
			}
			case "session.text.ended": {
				const key = this.partKey(event.data)
				const part = this.textParts.get(key)
				if (part) part.view.setText(event.data.text)
				this.textParts.delete(key)
				this.lastAssistant = event.data.text
				this.requestRender()
				return
			}
			case "session.tool.input.started":
				this.messageContainer.addChild(new Text(dim(`  ~ ${event.data.name}`)))
				this.requestRender()
				return
			case "session.step.ended":
				this.tokensIn += event.data.tokens.input
				this.tokensOut += event.data.tokens.output
				this.refreshFooter()
				return
		}
	}

	private partKey(data: { assistantMessageID: string; ordinal: number }): string {
		return `${data.assistantMessageID}:${data.ordinal}`
	}

	private setBusy(busy: boolean): void {
		this.busy = busy
		this.refreshFooter()
	}

	// This UI has no permission/question dialogs yet. Mirror `run`: approve with --auto, otherwise reject so the
	// model continues without the action instead of the session hanging forever.
	private async answerPermission(request: {
		id: string
		sessionID: string
		action: string
		resources: ReadonlyArray<string>
	}): Promise<void> {
		if (!this.auto) {
			this.showStatus(danger(`permission requested: ${request.action} (${request.resources.join(", ")}); rejected`))
		}
		await this.api.permission
			.reply({
				sessionID: request.sessionID,
				requestID: request.id,
				decision: this.auto ? "once" : "reject",
				...(this.auto ? {} : { message: "The interactive UI cannot ask for permission yet, so the request was rejected. Continue without this action." }),
			})
			.catch(() => {})
	}

	private async cancelForm(form: { id: string; sessionID: string; metadata?: { kind?: unknown } }): Promise<void> {
		const question = form.metadata?.kind === "question"
		this.showStatus(danger("the assistant asked a question; the interactive UI cannot answer it yet, so it was cancelled"))
		await this.api.session.form
			.cancel({
				sessionID: form.sessionID,
				formID: form.id,
				...(question
					? { message: "The interactive UI cannot ask the user questions yet, so the question was cancelled. Continue without an answer; make reasonable assumptions and state them." }
					: {}),
			})
			.catch(() => {})
	}

	// --- command dispatch -------------------------------------------------------

	private async dispatch(name: string, args: string): Promise<void> {
		if (name === "exit" || name === "quit" || name === "q") {
			await this.stop()
			process.exit(0)
		}
		const result = this.dispatchImpl(name, args)
		const message = await result
		if (message) {
			this.showStatus(message)
		}
		this.requestRender()
	}

	private async dispatchImpl(name: string, args: string): Promise<string | void> {
		const sessionID = this.sessionID
		switch (name) {
			case "help":
				this.showHelp()
				return ""
			case "status":
				this.showStatusInfo()
				return ""
			case "clear":
				this.clearTranscript()
				this.showStatus("transcript cleared")
				return ""
			case "new":
				return this.api.session
					.create({ location: { directory: this.directory } })
					.then((response) => {
						this.switchTo(response.id, response.title ?? "")
						this.showStatus("started a new session")
						return this.refreshServerCommands()
					})
					.catch((error) => `failed to create session: ${error}`)
			case "sessions":
				return this.cmdSessions()
			case "rename":
				if (!args || !sessionID) {
					return sessionID ? "usage: /rename <title>" : "no active session"
				}
				return this.api.session.update({ sessionID, title: args }).then(() => `session renamed: ${args}`)
			case "compact":
				if (!sessionID) return "no session to compact"
				return this.api.session.compact({ sessionID }).then(() => {
					return "compaction requested"
				})
			case "undo":
			case "checkpoint": {
				if (!sessionID) return "no session to undo"
				const response = await this.api.message.list({ sessionID, limit: 50, order: "desc" })
				const lastUser = response.data.find((message) => message.type === "user" && message.text.trim().length > 0)
				if (!lastUser || lastUser.type !== "user") return "Nothing to undo."
				await this.api.session.interrupt({ sessionID }).catch(() => {})
				await this.api.session.wait({ sessionID }).catch(() => {})
				await this.api.session.revert.stage({ sessionID, messageID: lastUser.id })
				this.editor.setText(lastUser.text)
				return "Undid the last message. Edit and send it again."
			}
			case "redo":
				if (!sessionID) return "no session to redo"
				return this.api.session.revert.clear({ sessionID }).then(() => "revert point cleared (redo)")
			case "copy":
				return this.cmdCopy()
			case "reload":
				return this.api.location
					.reload()
					.then(() => {
						this.showStatus("configuration reloaded")
						return this.refreshServerCommands()
					})
					.then(() => "")
			default: {
				const serverMatch = this.serverCommands.find((cmd) => cmd.name === name)
				if (!serverMatch) {
					return `unknown command: /${name} (try /help)`
				}
				if (!sessionID) {
					return "no active session, cannot run /" + name
				}
				return this.api.session
					.command({ sessionID, name, text: args })
					.then(async () => {
						return `ran /${name}`
					})
					.catch((error) => `failed to run /${name}: ${error}`)
			}
		}
	}

	private async cmdSessions(): Promise<string> {
		let sessions: SessionInfo[]
		try {
			const response = await this.api.session.list({
				directory: this.directory,
				order: "desc",
				limit: 20,
			})
			sessions = response.data
		} catch {
			this.showStatus("failed to list sessions")
			return ""
		}
		if (!sessions.length) {
			this.showStatus("no sessions yet")
			return ""
		}
		const items = sessions.map((session): AutocompleteItem => ({
			value: session.id,
			label: session.title || session.id,
			description: session.tokens ? `${Math.round(session.tokens.input / 1000)}k in` : undefined,
		}))
		await this.showSelector(items, (item) => {
			const picked = sessions.find((session) => session.id === item.value)
			this.switchTo(picked?.id ?? item.value, picked?.title ?? item.label)
			this.showStatus(`switched to: ${picked?.title || item.label}`)
		})
		return ""
	}

	private async cmdCopy(): Promise<string> {
		if (!this.lastAssistant) return "nothing to copy yet"
		const clipboard = getNativeClipboard()
		if (!clipboard?.setText) return "clipboard not available on this platform"
		try {
			await clipboard.setText(this.lastAssistant)
			return "copied last assistant message"
		} catch {
			return "clipboard transfer failed"
		}
	}

	private switchTo(id: string, title: string): void {
		this.sessionID = id
		this.tokensIn = 0
		this.tokensOut = 0
		this.lastAssistant = ""
		this.clearTranscript()
		this.refreshFooter()
		if (title) {
			this.showStatus(`session: ${title}`)
		}
	}

	// --- help / status rendering -------------------------------------------------

	private showHelp(): void {
		const rows: string[] = [""]

		const label = (cmd: { name: string; argumentHint?: string }): string =>
			`/${cmd.name}${cmd.argumentHint ? ` ${cmd.argumentHint}` : ""}`
		const width = Math.max(...[...BUILTIN_COMMANDS, ...this.serverCommands].map((cmd) => label(cmd).length))
		const pad = (text: string): string => text.padEnd(width + 2)

		for (const cmd of BUILTIN_COMMANDS) {
			rows.push(`  ${accent(pad(label(cmd)))}${dim(cmd.description)}`)
		}

		const custom = this.serverCommands.filter((cmd) => !BUILTIN_COMMANDS.some((b) => b.name === cmd.name))
		if (custom.length) {
			rows.push("")
			rows.push(`  ${dim("custom & server commands:")}`)
			for (const cmd of custom) {
				rows.push(`  ${accent(pad(label(cmd)))}${dim(cmd.description ?? "")}`)
			}
		}

		rows.push("")
		rows.push(`  ${dim("@path to attach a file, plain text to prompt, exit/quit/q to leave.")}`)
		rows.push("")
		this.appendBlock(rows)
	}

	private showStatusInfo(): void {
		const rows = [
			"",
			`  ${dim("cwd")}     ${this.directory}`,
			`  ${dim("session")} ${this.sessionID ?? "(none)"}`,
			`  ${dim("tokens")}  in ${this.tokensIn}, out ${this.tokensOut}`,
			`  ${dim("url")}     ${this.endpoint.url}`,
			"",
		]
		this.appendBlock(rows)
	}

	// --- picker -----------------------------------------------------------------

	private async showSelector(
		items: AutocompleteItem[],
		onSelect: (item: SelectItem) => void,
	): Promise<void> {
		const list = new SelectList(items, 12, editorTheme.selectList)
		const editor = this.editor
		this.editorSlot.removeChild(editor)
		this.editorSlot.addChild(list)
		this.ui.setFocus(list)
		this.requestRender()

		list.onSelect = (item) => {
			this.editorSlot.removeChild(list)
			this.editorSlot.addChild(editor)
			this.ui.setFocus(editor)
			onSelect(item)
			this.requestRender()
		}
	}

	// --- transcript helpers --------------------------------------------------------

	private appendBlock(lines: string[]): void {
		for (const line of lines) {
			this.messageContainer.addChild(new Text(line))
		}
		this.requestRender()
	}

	private clearTranscript(): void {
		for (const child of [...this.messageContainer.children]) {
			this.messageContainer.removeChild(child)
		}
		this.requestRender()
	}

	showStatus(message: string): void {
		this.messageContainer.addChild(new Text(dim(message)))
		this.requestRender()
	}

	private requestRender(): void {
		this.ui.requestRender()
	}
}

export async function createTuiAdapter(options: TuiAdapterOptions): Promise<TuiAdapter> {
	return new TuiAdapter(options)
}
