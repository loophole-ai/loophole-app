/**
 * The Loophole terminal screen.
 *
 * Layout (main-screen mode: the transcript flows into the terminal's own scrollback, so the
 * terminal's native scroll, search and copy keep working):
 *
 *   welcome banner
 *   transcript            messages, thinking, tool cards
 *   activity              "Working…" while the agent runs
 *   prompt slot           editor, or an approval / picker while one is open
 *   footer
 *
 * This class only knows about UI. The controller in the CLI package translates OpenCode events into
 * calls on it.
 */

import {
  Container,
  Input,
  Key,
  ProcessTerminal,
  SelectList,
  Spacer,
  Text,
  TuiMainScreen,
  matchesKey,
  type Component,
  type SelectItem,
  type SlashCommand,
  type TUI,
} from '@loophole/tui-engine';

import { ActivityComponent } from './components/chrome/activity';
import { AnnouncementComponent, type AnnouncementState } from './components/chrome/announcement';
import { FooterComponent } from './components/chrome/footer';
import { GutterContainer } from './components/chrome/gutter-container';
import { PanelComponent } from './components/chrome/panel';
import { WelcomeComponent } from './components/chrome/welcome';
import { CustomEditor } from './components/editor/custom-editor';
import { FileMentionProvider } from './components/editor/file-mention-provider';
import { AssistantMessageComponent } from './components/messages/assistant-message';
import { DiffFilesComponent, type DiffFileSummary } from './components/messages/diff-files';
import { StatusMessageComponent } from './components/messages/status-message';
import { renderUnifiedDiffPreview } from './components/media/diff-preview';
import { ThinkingComponent } from './components/messages/thinking';
import { ToolCallComponent } from './components/messages/tool-call';
import { UserMessageComponent } from './components/messages/user-message';
import { CHROME_GUTTER } from './constant/rendering';
import { currentTheme, getColorPalette, type ColorToken, type ThemeName } from './theme/index';
import { isPrintableChar, printableChar } from './utils/printable-key';

export type PermissionChoice = 'once' | 'always' | 'reject';

export type ComposerMode = 'prompt' | 'bash';

export interface ScreenOptions {
  readonly directory: string;
  readonly auto: boolean;
  readonly commands: readonly SlashCommand[];
  /** A line of text (or a slash command) was submitted, with the composer mode it was typed in. */
  readonly onSubmit: (text: string, mode: ComposerMode) => void;
  /** The user asked to stop the running turn (Esc or Ctrl+C while busy). */
  readonly onInterrupt: () => void;
  /** The user asked to leave (Ctrl+C twice, Ctrl+D on an empty editor). */
  readonly onExit: () => void;
}

export type FormAnswerValue = string | number | boolean | string[];

/** One question in a form the assistant (or a plugin) asks the user. */
export interface FormQuestion {
  readonly key: string;
  readonly title?: string;
  readonly description?: string;
  readonly kind: 'text' | 'number' | 'integer' | 'boolean' | 'single' | 'multi';
  readonly options?: readonly { readonly value: string; readonly label: string; readonly description?: string }[];
  /** Offer "Type your own answer" next to the options. */
  readonly custom?: boolean;
  readonly required?: boolean;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly placeholder?: string;
  readonly defaultValue?: FormAnswerValue;
}

export interface StreamHandle {
  update(text: string): void;
  end(text: string): void;
}

export interface PermissionRequest {
  readonly action: string;
  readonly resources: readonly string[];
  /** A message the tool or plugin attached to the request. */
  readonly message?: string;
  /** Tool metadata; edits carry `{ files: [{ patch }] }` for a diff preview. */
  readonly metadata?: Record<string, unknown>;
}

export interface PermissionDecision {
  readonly decision: PermissionChoice;
  /** Rejection feedback forwarded to the model (turns the decline into a correction). */
  readonly message?: string;
}

interface PromptOptions {
  /** Label in the panel's top border. */
  readonly title?: string;
  /** Panel border colour. */
  readonly accent?: ColorToken;
  /** Selected-row colour; defaults to the accent. */
  readonly selection?: ColorToken;
  /** Number keys select an item directly. */
  readonly numbered?: boolean;
  /** Hint line under the list. */
  readonly footer?: string;
  /** Add a text field above the list: typing narrows the rows by name or description. */
  readonly filterable?: boolean;
}

export class Screen {
  private readonly ui: TUI;
  private readonly transcript = new Container();
  private readonly promptSlot = new Container();
  private readonly activity: ActivityComponent;
  private readonly footer: FooterComponent;
  private readonly editor: CustomEditor;
  private readonly welcome: WelcomeComponent;
  private readonly announcement: AnnouncementComponent;
  private readonly tools = new Map<string, ToolCallComponent>();
  private options: ScreenOptions;
  private commands: SlashCommand[] | undefined;
  private themeName: ThemeName = 'dark';
  private expanded = false;
  private busy = false;
  private tokensIn = 0;
  private tokensOut = 0;
  private contextTokens = 0;
  private contextLimit = 0;
  private lastCtrlC = 0;
  private prompting = false;
  private agentLabel: string | undefined;
  private modelLabel: string | undefined;
  private sessionLabel: string | undefined;
  private version: string | undefined;
  private ready = false;
  private offline = false;
  private announcementState: AnnouncementState = { title: '', visible: false };
  private autoMode: boolean;

  constructor(options: ScreenOptions) {
    this.options = options;
    this.autoMode = options.auto;
    const terminal = new ProcessTerminal();
    // No log directory: debug logging stays off and crash dumps go to the OS temp dir.
    this.ui = new TuiMainScreen(terminal, false, undefined);

    this.activity = new ActivityComponent(() => this.ui.requestRender());
    this.footer = new FooterComponent(this.footerState());
    this.welcome = new WelcomeComponent(this.welcomeState());
    this.announcement = new AnnouncementComponent();
    this.editor = new CustomEditor(this.ui);
    this.setCommands(options.commands);
    this.wireEditor();

    const gutter = (child: Component) => {
      const box = new GutterContainer(CHROME_GUTTER, CHROME_GUTTER);
      box.addChild(child);
      return box;
    };

    this.promptSlot.addChild(this.editor);
    this.ui.addChild(gutter(this.welcome));
    this.ui.addChild(gutter(this.announcement));
    this.ui.addChild(gutter(this.transcript));
    this.ui.addChild(gutter(this.activity));
    this.ui.addChild(this.promptSlot);
    this.ui.addChild(gutter(this.footer));
  }

  // --- lifecycle ---------------------------------------------------------------------------

  start(): void {
    this.ui.start();
    this.ui.setFocus(this.editor);
  }

  stop(): void {
    this.activity.setActive(false);
    for (const tool of this.tools.values()) tool.dispose();
    this.ui.stop();
  }

  requestRender(): void {
    this.ui.requestRender();
  }

  // --- state shown in chrome ------------------------------------------------------------------

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.activity.setActive(busy);
    this.refreshFooter();
  }

  addUsage(input: number, output: number): void {
    this.tokensIn += input;
    this.tokensOut += output;
    this.refreshFooter();
  }

  /** Replace the usage counters (used when a session is loaded or re-synced). */
  setUsage(input: number, output: number): void {
    this.tokensIn = input;
    this.tokensOut = output;
    this.refreshFooter();
  }

  setAgent(agent: string | undefined): void {
    this.agentLabel = agent;
    this.refreshFooter();
  }

  setModel(label: string | undefined): void {
    this.modelLabel = label;
    this.refreshFooter();
    this.refreshWelcome();
  }

  /** The session shown in the welcome panel: its title, or its id when it has none. */
  setSession(label: string | undefined): void {
    this.sessionLabel = label;
    this.refreshWelcome();
  }

  /** The CLI build version shown in the welcome panel. */
  setVersion(version: string | undefined): void {
    this.version = version;
    this.refreshWelcome();
  }

  /** Publish the one-shot release announcement under the welcome panel. */
  setAnnouncement(state: AnnouncementState): void {
    this.announcementState = state;
    this.refreshAnnouncement();
  }

  /** The screen finished connecting and can take a prompt. */
  setReady(ready: boolean): void {
    this.ready = ready;
    this.refreshAnnouncement();
  }

  /** Tokens in the model's context window and the window size, for the footer percentage. */
  setContext(tokens: number, limit: number): void {
    this.contextTokens = tokens;
    this.contextLimit = limit;
    this.refreshFooter();
  }

  /** Toggle the auto-approve badge shown in the footer (set from /settings). */
  setAuto(auto: boolean): void {
    this.autoMode = auto;
    this.refreshFooter();
  }

  /** Show "reconnecting…" in the footer while the server connection is down. */
  setOffline(offline: boolean): void {
    this.offline = offline;
    this.refreshFooter();
    this.refreshAnnouncement();
  }

  setCommands(commands: readonly SlashCommand[]): void {
    this.commands = [...commands];
    this.editor.setAutocompleteProvider(
      new FileMentionProvider(this.commands, this.options.directory, null),
    );
  }

  /** Update the directory shown in the footer after /cd or /worktrees moves the session. */
  setDirectory(directory: string): void {
    this.options = { ...this.options, directory };
    // The mention provider scans from the working directory, so it has to be rebuilt.
    if (this.commands) {
      this.editor.setAutocompleteProvider(
        new FileMentionProvider(this.commands, this.options.directory, null),
      );
    }
    this.refreshFooter();
    this.refreshWelcome();
  }

  /** Resolve and apply a theme by name. 'auto' asks the terminal for its background. */
  async setTheme(theme: ThemeName): Promise<void> {
    this.themeName = theme;
    currentTheme.setPalette(await getColorPalette(theme));
    this.ui.requestRender();
  }

  getTheme(): ThemeName {
    return this.themeName;
  }

  /** The current composer text. Used by /editor and /undo. */
  getPrompt(): string {
    return this.editor.getText();
  }

  setPrompt(text: string): void {
    this.editor.setText(text);
    this.ui.requestRender();
  }

  /** Append text at the end of the composer. Used by /skills. */
  insertPrompt(text: string): void {
    this.editor.setText(this.editor.getText() + text);
    this.ui.requestRender();
  }

  /** A single-line text prompt in the editor's place. Esc resolves with undefined. */
  askText(title: string, placeholder = ''): Promise<string | undefined> {
    return this.promptText([currentTheme.boldFg('primary', title)], placeholder, () => undefined);
  }

  // --- transcript ---------------------------------------------------------------------------------

  addUser(text: string): void {
    this.transcript.addChild(new UserMessageComponent(text));
    this.ui.requestRender();
  }

  /** A finished assistant message (used when an earlier session is shown again). */
  addAssistant(text: string): void {
    const view = new AssistantMessageComponent();
    view.updateContent(text);
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(view);
    this.ui.requestRender();
  }

  /** A finished reasoning block (used when an earlier session is shown again). */
  addReasoning(text: string): void {
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(new ThinkingComponent(text, true, 'finalized', this.ui));
    this.ui.requestRender();
  }

  /** A dim one-line notice (errors use `error`, warnings `warning`). */
  addStatus(text: string, color?: ColorToken): void {
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(new StatusMessageComponent(text, color));
    this.ui.requestRender();
  }

  /**
   * A pre-styled multi-line block (used by /stats). Unlike `addStatus` the text is rendered
   * exactly as given, so per-section colours and tables keep their alignment.
   */
  addReport(text: string): void {
    const body = text
      .replaceAll('\r', '')
      .split('\n')
      .map((line) => (line.length > 0 ? `  ${line}` : line))
      .join('\n');
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(new Text(body, 0, 0));
    this.ui.requestRender();
  }

  /** Rich per-file diff panels (used by `/diff`). */
  addDiff(files: readonly DiffFileSummary[]): void {
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(new DiffFilesComponent(files));
    this.ui.requestRender();
  }

  beginText(): StreamHandle {
    const view = new AssistantMessageComponent();
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(view);
    return {
      update: (text) => {
        view.updateContent(text, { transient: true });
        this.ui.requestRender();
      },
      end: (text) => {
        view.updateContent(text);
        this.ui.requestRender();
      },
    };
  }

  beginReasoning(): StreamHandle {
    const view = new ThinkingComponent('', true, 'live', this.ui);
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(view);
    return {
      update: (text) => {
        view.setText(text);
        this.ui.requestRender();
      },
      end: (text) => {
        view.setText(text);
        view.finalize();
        this.ui.requestRender();
      },
    };
  }

  tool(id: string, name: string, local = false): ToolCallComponent {
    const known = this.tools.get(id);
    if (known) return known;
    const card = new ToolCallComponent({
      id,
      name,
      directory: this.options.directory,
      requestRender: () => this.ui.requestRender(),
      local,
    });
    card.setExpanded(this.expanded);
    this.tools.set(id, card);
    this.transcript.addChild(new Spacer(1));
    this.transcript.addChild(card);
    this.ui.requestRender();
    return card;
  }

  clearTranscript(): void {
    for (const tool of this.tools.values()) tool.dispose();
    this.tools.clear();
    this.transcript.clear();
    this.ui.requestRender();
  }

  toggleExpand(): void {
    this.expanded = !this.expanded;
    for (const tool of this.tools.values()) tool.setExpanded(this.expanded);
    this.ui.requestRender();
  }

  // --- prompts that replace the editor ---------------------------------------------------------------

  /** Ask whether the agent may run an action. Resolves with the user's choice and optional feedback. */
  async askPermission(request: PermissionRequest): Promise<PermissionDecision> {
    const items: SelectItem[] = [
      { value: 'once', label: '[1] Approve once' },
      { value: 'always', label: '[2] Approve for this session' },
      { value: 'reject', label: '[3] Reject' },
      { value: 'reject-feedback', label: '[4] Reject, tell the model what to do instead' },
    ];
    const value = await this.prompt(this.permissionHeading(request), items, 'reject', 0, {
      title: 'approval',
      accent: 'warning',
      numbered: true,
      footer: '▲/▼ select · 1–4 choose · enter confirm · esc reject',
    });
    if (value === 'reject-feedback') {
      const message = await this.askText('Reject this action', 'Tell the model what to do instead');
      const feedback = message?.trim();
      return { decision: 'reject', ...(feedback ? { message: feedback } : {}) };
    }
    return { decision: (value ?? 'reject') as PermissionChoice };
  }

  /** The approval body: action, resources, and a diff preview when the tool sent one. */
  private permissionHeading(request: PermissionRequest): string[] {
    const lines = [
      currentTheme.boldFg('warning', `The agent is requesting approval to ${request.action}:`),
    ];
    if (request.message) lines.push(currentTheme.fg('text', request.message));
    const shown = request.resources.slice(0, 4);
    for (const resource of shown) lines.push(`  ${currentTheme.fg('textDim', resource)}`);
    if (request.resources.length > shown.length) {
      lines.push(
        `  ${currentTheme.fg('textMuted', `… ${String(request.resources.length - shown.length)} more`)}`,
      );
    }
    const patch = permissionPatch(request.metadata);
    if (patch) {
      lines.push('');
      for (const line of renderUnifiedDiffPreview(patch, 5)) lines.push(`  ${line}`);
    }
    return lines;
  }

  /** Let the user pick one item from a list. Resolves with its value, or undefined when cancelled. */
  pick(title: string, items: SelectItem[]): Promise<string | undefined> {
    return this.prompt([], items, undefined, 0, { title, accent: 'border' });
  }

  private prompt(
    heading: string[],
    items: SelectItem[],
    cancelValue: string | undefined,
    initialIndex = 0,
    options: PromptOptions = {},
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      const selection = options.selection ?? options.accent ?? 'primary';
      const listTheme = {
        selectedPrefix: (text: string) => currentTheme.fg(selection, text),
        selectedText: (text: string) => currentTheme.fg(selection, text),
        description: (text: string) => currentTheme.fg('textMuted', text),
        scrollInfo: (text: string) => currentTheme.fg('textMuted', text),
        noMatch: (text: string) => currentTheme.fg('textMuted', text),
      };

      let settled = false;
      const finish = (value: string | undefined) => {
        if (settled) return;
        settled = true;
        this.prompting = false;
        this.promptSlot.clear();
        this.promptSlot.addChild(this.editor);
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
        resolve(value);
      };

      const makeList = (listItems: SelectItem[], startIndex = 0): SelectList => {
        const list = new SelectList(listItems, options.filterable ? 12 : 10, listTheme);
        if (startIndex > 0 && startIndex < listItems.length) list.setSelectedIndex(startIndex);
        list.onSelect = (item) => finish(item.value);
        list.onCancel = () => finish(cancelValue);
        if (options.numbered) {
          const handle = list.handleInput.bind(list);
          list.handleInput = (data: string) => {
            const match = /^([1-9])$/.exec(data);
            if (match) {
              const index = Number(match[1]) - 1;
              const item = items[index];
              if (item) {
                list.setSelectedIndex(index);
                finish(item.value);
                return;
              }
            }
            handle(data);
          };
        }
        return list;
      };

      const panel = new PanelComponent({
        title: options.title,
        accent: options.accent ?? 'borderFocus',
        paddingY: 0,
      });
      if (heading.length > 0) {
        panel.addChild(new Text(heading.join('\n'), 0, 0));
        panel.addChild(new Spacer(1));
      }

      let focus: Component;
      const listSlot = new Container();
      const filterLine = new Text(this.filterLine(''), 0, 0);
      let query = '';
      let list = makeList(items, initialIndex);
      listSlot.addChild(list);

      const rebuild = () => {
        list = makeList(filterPaletteItems(items, query));
        listSlot.clear();
        listSlot.addChild(list);
        filterLine.setText(this.filterLine(query));
        this.ui.requestRender();
      };

      if (options.filterable) {
        panel.addChild(filterLine);
        panel.addChild(new Spacer(1));
      }
      panel.addChild(listSlot);

      // Every picker shares one focused host. Enter, Escape and the filter text
      // are handled here (so they cannot be lost to a terminal's key encoding),
      // while arrows, paging, Tab and number keys go to the visible list.
      let done = false;
      const host: Component = {
        handleInput: (data: string) => {
          // A picker that has already resolved must not react to the same
          // keystroke twice (or to a key repeat arriving right after close).
          if (done) return;
          if (isPickerEnter(data)) {
            const item = list.getSelectedItem();
            if (item) {
              done = true;
              finish(item.value);
            }
            return;
          }
          if (isPickerEscape(data)) {
            done = true;
            finish(cancelValue);
            return;
          }
          if (options.filterable) {
            if (matchesKey(data, Key.backspace)) {
              if (query.length === 0) return;
              query = query.slice(0, -1);
              rebuild();
              return;
            }
            const char = printableChar(data);
            if (isPrintableChar(char)) {
              query += char;
              rebuild();
              return;
            }
          }
          list.handleInput(data);
        },
        invalidate: () => {},
        render: () => [],
      };
      focus = host;

      if (options.footer) {
        panel.addChild(new Spacer(1));
        panel.addChild(new Text(currentTheme.fg('textMuted', options.footer), 0, 0));
      }

      this.prompting = true;
      this.editor.dismissAutocomplete();
      this.promptSlot.clear();
      this.promptSlot.addChild(new Spacer(1));
      this.promptSlot.addChild(panel);
      this.ui.setFocus(focus);
      this.ui.requestRender();
    });
  }

  /** The palette's filter line: a dim label, a prompt glyph, and the typed query. */
  private filterLine(query: string): string {
    const value =
      query.length > 0
        ? currentTheme.fg('text', query)
        : currentTheme.fg('textMuted', 'type to narrow the list…');
    return `${currentTheme.fg('textMuted', 'filter')} ${currentTheme.fg('primary', '>')} ${value}`;
  }

  /** Ctrl+Shift+P: open every command in a filterable palette and run the picked one. */
  openCommandPalette(): void {
    if (this.prompting) return;
    const commands = this.commands ?? [];
    if (commands.length === 0) {
      this.addStatus('No commands are available yet.');
      return;
    }
    const items = commands.map((command) => ({
      value: command.name,
      label: `/${command.name}`,
      description: command.description,
    }));
    void this.prompt([], items, undefined, 0, {
      title: 'commands',
      accent: 'border',
      filterable: true,
      footer: 'type to filter · ↑/↓ select · enter run · esc close',
    }).then((value) => {
      if (value) this.options.onSubmit(`/${value}`);
    });
  }

  /** Like `pick`, with the cursor starting on the item whose value is `current`. */
  pickCurrent(title: string, items: SelectItem[], current: string | undefined): Promise<string | undefined> {
    const index = Math.max(0, items.findIndex((item) => item.value === current));
    return this.prompt([], items, undefined, index, { title, accent: 'border' });
  }

  /** Like `pick`, with a text field that narrows the rows by name or description. */
  pickFilterable(
    title: string,
    items: SelectItem[],
    initialIndex = 0,
    footer = 'type to filter · ↑/↓ select · enter confirm · esc back',
  ): Promise<string | undefined> {
    return this.prompt([], items, undefined, initialIndex, {
      title,
      accent: 'border',
      filterable: true,
      footer,
    });
  }

  /**
   * Ask one question of a form. Resolves with the answer, or undefined when the user cancelled
   * (Esc), which the caller treats as dismissing the whole form.
   */
  async askQuestion(question: FormQuestion, progress?: string): Promise<FormAnswerValue | undefined> {
    const heading = [
      currentTheme.boldFg('primary', question.title ?? 'Question') +
        (progress ? currentTheme.fg('textMuted', `  (${progress})`) : ''),
      ...(question.description ? [currentTheme.fg('text', question.description)] : []),
    ];
    const other = '\u0000other';

    switch (question.kind) {
      case 'boolean': {
        const items: SelectItem[] = [
          { value: 'true', label: '[1] Yes' },
          { value: 'false', label: '[2] No' },
        ];
        const start = question.defaultValue === false ? 1 : 0;
        const value = await this.prompt(heading, items, undefined, start, {
          title: 'question',
          accent: 'border',
          numbered: true,
          footer: '▲/▼ select · 1–2 choose · enter confirm · esc dismiss',
        });
        return value === undefined ? undefined : value === 'true';
      }
      case 'single': {
        const options = question.options ?? [];
        if (options.length === 0) return this.askFormText({ ...question, kind: 'text' }, heading);
        const items: SelectItem[] = options.map((option, index) => ({
          value: option.value,
          label: `[${String(index + 1)}] ${option.label}`,
          description: option.description,
        }));
        if (question.custom) items.push({ value: other, label: `[${String(items.length + 1)}] Type your own answer…` });
        const start =
          typeof question.defaultValue === 'string' ? Math.max(0, items.findIndex((item) => item.value === question.defaultValue)) : 0;
        const value = await this.prompt(heading, items, undefined, start, {
          title: 'question',
          accent: 'border',
          numbered: true,
          footer: `▲/▼ select · 1–${String(items.length)} choose · enter confirm · esc dismiss`,
        });
        if (value === undefined) return undefined;
        if (value === other) return this.askFormText({ ...question, kind: 'text', required: true }, heading);
        return value;
      }
      case 'multi': {
        const options = question.options ?? [];
        const chosen = new Set<string>(Array.isArray(question.defaultValue) ? question.defaultValue : []);
        const custom: string[] = [];
        const done = '\u0000done';
        let cursor = 0;
        let notice = '';
        for (;;) {
          const items: SelectItem[] = [
            ...options.map((option) => ({
              value: option.value,
              label: `${chosen.has(option.value) ? '[x]' : '[ ]'} ${option.label}`,
              description: option.description,
            })),
            ...custom.map((text) => ({ value: text, label: `[x] ${text}` })),
          ];
          if (question.custom) items.push({ value: other, label: 'Type your own answer…' });
          items.push({ value: done, label: `Done (${String(chosen.size)} selected)` });
          const hint = currentTheme.fg('textMuted', 'Enter toggles an option. Choose Done to submit, Esc to dismiss.');
          const lines = [...heading, hint, ...(notice ? [currentTheme.fg('warning', notice)] : [])];
          const value = await this.prompt(lines, items, undefined, cursor, {
            title: 'question',
            accent: 'border',
          });
          if (value === undefined) return undefined;
          cursor = Math.max(0, items.findIndex((item) => item.value === value));
          notice = '';
          if (value === done) {
            if (question.minItems !== undefined && chosen.size < question.minItems) {
              notice = `Select at least ${String(question.minItems)}.`;
              continue;
            }
            if (question.required && chosen.size === 0) {
              notice = 'Select at least one option.';
              continue;
            }
            return [...chosen];
          }
          if (value === other) {
            const text = await this.askFormText({ ...question, kind: 'text', required: true }, heading);
            if (typeof text === 'string' && text.trim() && !chosen.has(text.trim())) {
              custom.push(text.trim());
              chosen.add(text.trim());
            }
            continue;
          }
          if (chosen.has(value)) {
            chosen.delete(value);
            const index = custom.indexOf(value);
            if (index >= 0) custom.splice(index, 1);
          } else if (question.maxItems !== undefined && chosen.size >= question.maxItems) {
            notice = `At most ${String(question.maxItems)} can be selected.`;
          } else {
            chosen.add(value);
          }
        }
      }
      default:
        return this.askFormText(question, heading);
    }
  }

  private async askFormText(question: FormQuestion, heading: string[]): Promise<string | number | undefined> {
    const numeric = question.kind === 'number' || question.kind === 'integer';
    const fallback = question.defaultValue !== undefined && !Array.isArray(question.defaultValue) ? String(question.defaultValue) : '';
    const raw = await this.promptText(heading, question.placeholder ?? fallback, (value) => {
      const text = value.trim();
      if (text === '') return question.required && fallback === '' ? 'An answer is required.' : undefined;
      if (!numeric) return undefined;
      const parsed = Number(text);
      if (!Number.isFinite(parsed)) return 'Enter a number.';
      if (question.kind === 'integer' && !Number.isInteger(parsed)) return 'Enter a whole number.';
      if (question.minimum !== undefined && parsed < question.minimum) return `Must be at least ${String(question.minimum)}.`;
      if (question.maximum !== undefined && parsed > question.maximum) return `Must be at most ${String(question.maximum)}.`;
      return undefined;
    });
    if (raw === undefined) return undefined;
    const text = raw.trim() === '' ? fallback : raw.trim();
    return numeric && text !== '' ? Number(text) : text;
  }

  /** A single-line text prompt in the editor's place. Esc cancels; `validate` returns an error message. */
  private promptText(
    heading: string[],
    placeholder: string,
    validate: (value: string) => string | undefined,
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      const input = new Input({ prompt: '> ', placeholder, placeholderStyle: (text) => currentTheme.fg('textMuted', text) });
      const error = new Text('', 0, 0);
      const panel = new PanelComponent({ title: 'input', accent: 'borderFocus', paddingY: 0 });
      if (heading.length > 0) {
        panel.addChild(new Text(heading.join('\n'), 0, 0));
        panel.addChild(new Spacer(1));
      }
      panel.addChild(input);
      panel.addChild(error);
      panel.addChild(new Spacer(1));
      panel.addChild(new Text(currentTheme.fg('textMuted', 'Enter to submit, Esc to dismiss.'), 0, 0));

      const finish = (value: string | undefined) => {
        this.prompting = false;
        this.promptSlot.clear();
        this.promptSlot.addChild(this.editor);
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
        resolve(value);
      };
      input.onSubmit = (value) => {
        const problem = validate(value);
        if (problem) {
          error.setText(currentTheme.fg('error', problem));
          this.ui.requestRender();
          return;
        }
        finish(value);
      };
      input.onEscape = () => finish(undefined);

      this.prompting = true;
      this.promptSlot.clear();
      this.promptSlot.addChild(new Spacer(1));
      this.promptSlot.addChild(panel);
      this.ui.setFocus(input);
      this.ui.requestRender();
    });
  }

  // --- internals ------------------------------------------------------------------------------------------

  private footerState() {
    return {
      directory: this.options.directory,
      tokensIn: this.tokensIn,
      tokensOut: this.tokensOut,
      busy: this.busy,
      auto: this.autoMode,
      agent: this.agentLabel,
      model: this.modelLabel,
      contextTokens: this.contextTokens,
      contextLimit: this.contextLimit,
      offline: this.offline,
    };
  }

  private refreshFooter(): void {
    this.footer.update(this.footerState());
    this.ui.requestRender();
  }

  private welcomeState() {
    return {
      directory: this.options.directory,
      session: this.sessionLabel,
      model: this.modelLabel,
      version: this.version,
    };
  }

  private refreshWelcome(): void {
    this.welcome.update(this.welcomeState());
    this.ui.requestRender();
  }

  private refreshAnnouncement(): void {
    this.announcement.update({
      ...this.announcementState,
      ready: this.ready,
      offline: this.offline,
    });
    this.ui.requestRender();
  }

  private wireEditor(): void {
    this.editor.onSubmit = (text) => {
      // Bash mode is a composer state, not text: capture it before the editor
      // clears and reset to prompt mode for the next message.
      const mode = this.editor.inputMode;
      this.editor.setText('');
      this.editor.setInputMode('prompt');
      this.options.onSubmit(text, mode);
    };
    this.editor.onEscape = () => {
      if (this.busy) this.options.onInterrupt();
    };
    this.editor.onCtrlC = () => {
      if (this.busy) {
        this.options.onInterrupt();
        return;
      }
      const now = Date.now();
      if (now - this.lastCtrlC < 2000) {
        this.options.onExit();
        return;
      }
      this.lastCtrlC = now;
      this.addStatus('Press Ctrl+C again to exit.');
    };
    this.editor.onCtrlD = () => {
      if (this.editor.getText().length === 0 && !this.prompting) this.options.onExit();
    };
    this.editor.onToggleToolExpand = () => this.toggleExpand();
    this.editor.onPreInput = (data) => {
      // Ctrl+Shift+P is the documented shortcut. Terminals without the Kitty
      // keyboard protocol cannot distinguish it from Ctrl+P, so accept both.
      if (matchesKey(data, Key.ctrlShift('p')) || matchesKey(data, Key.ctrl('p'))) {
        this.openCommandPalette();
        return true;
      }
      return false;
    };
  }
}

/** Rows whose name, value, or description contain the palette query. */
function filterPaletteItems(items: readonly SelectItem[], query: string): SelectItem[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...items];
  return items.filter((item) =>
    `${item.label} ${item.value} ${item.description ?? ''}`.toLowerCase().includes(needle),
  );
}

/**
 * Terminal Enter comes in several encodings: legacy CR, LF, numpad SS3 M, Kitty
 * CSI-u (13 or 57414, optionally with modifiers or an event type), and xterm
 * modifyOtherKeys. Accept all of them so confirming a row never depends on the
 * terminal's keyboard protocol.
 */
const PICKER_ENTER_SEQUENCE = /^\x1b\[(?:13|57414)(?:;[0-9]+(?::[0-9]+)?)?u$|^\x1b\[27;[0-9]+;(?:13|57414)~$/

function isPickerEnter(data: string): boolean {
  return matchesKey(data, Key.enter) || matchesKey(data, Key.return) || PICKER_ENTER_SEQUENCE.test(data);
}

function isPickerEscape(data: string): boolean {
  return data === '\x1b' || matchesKey(data, Key.escape);
}

/** The diff carried by permission metadata: `{ diff }` or `{ files: [{ patch }] }`. */
function permissionPatch(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return '';
  if (typeof metadata.diff === 'string' && metadata.diff.trim().length > 0) return metadata.diff;
  const files = metadata.files;
  if (!Array.isArray(files)) return '';
  return files
    .map((file) =>
      file && typeof file === 'object' && typeof (file as { patch?: unknown }).patch === 'string'
        ? (file as { patch: string }).patch
        : '',
    )
    .filter((patch) => patch.length > 0)
    .join('\n');
}
