/**
 * Transcript card for one tool call.
 *
 *   ● Shell  npm test                  <- header: state bullet, label, key argument
 *     > 12 tests passed                <- outcome rows (collapsed) or full output (expanded)
 *
 * The card is driven by OpenCode session events: input arrives first (possibly partial), then the
 * call runs, then it succeeds or fails. Every state change rebuilds the children, which are cheap.
 */

import { Container, Text, type Component } from '@loophole/tui-engine';

import { PanelComponent } from '../chrome/panel';
import { computeDiffLines, renderDiffLinesClustered, renderUnifiedDiff } from '../media/diff-preview';
import { outcomeRows } from './tool-renderers/outcome';
import { TruncatedOutputComponent } from './tool-renderers/truncated';
import { FAILURE_MARK, SUCCESS_MARK } from '../../constant/symbols';
import { currentTheme, type ColorToken } from '../../theme/index';

export type ToolCallState = 'streaming' | 'running' | 'success' | 'error';

export interface ToolCallInit {
  readonly id: string;
  readonly name: string;
  /** Used to show paths relative to the project. */
  readonly directory: string;
  /** Asks the screen to repaint; drives the spinner. */
  readonly requestRender: () => void;
  /**
   * A shell command run by the CLI itself (`!cmd`), not by the model. Its
   * running row cannot be interrupted with Esc, so it says `running…` instead.
   */
  readonly local?: boolean;
}

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_MS = 90;

const LABELS: Record<string, string> = {
  bash: 'Shell',
  shell: 'Shell',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  patch: 'Patch',
  apply_patch: 'Patch',
  glob: 'Glob',
  grep: 'Grep',
  list: 'List',
  lsp: 'LSP',
  webfetch: 'Fetch',
  websearch: 'Search',
  codesearch: 'Search',
  task: 'Agent',
  subagent: 'Agent',
  todowrite: 'Todos',
  question: 'Question',
  skill: 'Skill',
  batch: 'Batch',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function relativePath(file: string, directory: string): string {
  if (!file) return '';
  const root = directory.endsWith('/') || directory.endsWith('\\') ? directory : directory + '/';
  return file.startsWith(root) ? file.slice(root.length) : file;
}

/** The one argument worth showing in the header, per tool. */
export function keyArgument(name: string, input: Record<string, unknown>, directory: string): string {
  const path = text(input.path) || text(input.filePath);
  switch (name) {
    case 'bash':
    case 'shell':
      return text(input.command).split('\n')[0] ?? '';
    case 'read':
    case 'write':
    case 'edit':
    case 'lsp':
    case 'list':
      return relativePath(path, directory);
    case 'glob':
    case 'grep': {
      const pattern = text(input.pattern);
      const where = relativePath(path, directory);
      return where ? `${pattern}  in ${where}` : pattern;
    }
    case 'webfetch':
      return text(input.url);
    case 'websearch':
    case 'codesearch':
      return text(input.query);
    case 'task':
    case 'subagent':
      return text(input.description) || text(input.prompt).split('\n')[0] || '';
    case 'skill':
      return text(input.name);
    default: {
      for (const value of Object.values(input)) {
        if (typeof value === 'string' && value.length > 0) return value.split('\n')[0] ?? '';
      }
      return '';
    }
  }
}

export class ToolCallComponent extends Container {
  private readonly init: ToolCallInit;
  private input: Record<string, unknown> = {};
  private state: ToolCallState = 'streaming';
  private output = '';
  private diff = '';
  private expanded = false;
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = Date.now();
  private finishedAt: number | undefined;

  constructor(init: ToolCallInit) {
    super();
    this.init = init;
    this.startSpinner();
    this.rebuild();
  }

  get id(): string {
    return this.init.id;
  }

  setInput(input: Record<string, unknown>): void {
    this.input = input;
    this.rebuild();
  }

  setRunning(): void {
    this.state = 'running';
    this.startedAt = Date.now();
    this.finishedAt = undefined;
    this.startSpinner();
    this.rebuild();
  }

  setProgress(metadata: Record<string, unknown>): void {
    if (typeof metadata.output === 'string') this.output = metadata.output;
    this.rebuild();
  }

  setResult(result: { output: string; isError: boolean; metadata?: Record<string, unknown> }): void {
    this.state = result.isError ? 'error' : 'success';
    this.output = result.output;
    this.diff = diffFrom(result.metadata);
    this.finishedAt = Date.now();
    this.stopSpinner();
    this.rebuild();
    // The spinner was the only thing repainting this card. Once it stops, the
    // terminal would keep showing the last running frame until an unrelated
    // input event forces a redraw, so request the final frame ourselves.
    this.init.requestRender();
  }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.rebuild();
  }

  /** Stops the spinner timer. Call when the card is discarded. */
  dispose(): void {
    this.stopSpinner();
  }

  private startSpinner(): void {
    if (this.timer || this.state === 'success' || this.state === 'error') return;
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER.length;
      this.rebuild();
      this.init.requestRender();
    }, SPINNER_MS);
    // A card must never keep the process alive on its own.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private stopSpinner(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private bullet(): string {
    switch (this.state) {
      case 'success':
        return currentTheme.fg('success', SUCCESS_MARK);
      case 'error':
        return currentTheme.fg('error', FAILURE_MARK);
      default:
        return currentTheme.fg('primary', `${SPINNER[this.frame] ?? '⠋'} `);
    }
  }

  /** Elapsed time for finished calls, shown next to the key argument. */
  private duration(): string {
    if (this.state === 'streaming' || this.state === 'running') return '';
    return formatElapsed(Math.max(0, (this.finishedAt ?? Date.now()) - this.startedAt));
  }

  private rebuild(): void {
    this.clear();
    const name = this.init.name;
    const label = LABELS[name] ?? name;
    const argument = keyArgument(name, this.input, this.init.directory);
    const card = new PanelComponent({
      title: `${this.bullet()}${currentTheme.boldFg('text', label)}  ${currentTheme.fg('textDim', argument)}`,
      meta: this.meta(),
      footer: this.footer(),
      accent: this.border(),
      paddingX: 1,
      paddingY: 0,
    });
    for (const row of this.body()) card.addChild(row);
    this.addChild(card);
  }

  /** Frame colour: running/pending accent, success neutral, failure error. */
  private border(): ColorToken {
    if (this.state === 'error') return 'error';
    if (this.state === 'success') return 'border';
    return 'primary';
  }

  /** Right-hand facts in the top border: diff statistics, a failure badge, or a result count. */
  private meta(): string {
    if (this.state === 'error') return currentTheme.fg('error', 'failed');
    // Search cards get a ranked-results count, omp-style, instead of a diff stat.
    if (this.state === 'success' && (this.init.name === 'websearch' || this.init.name === 'codesearch')) {
      const urls = new Set(this.output.match(/https?:\/\/[^\s)]+/g) ?? []);
      if (urls.size > 0) return currentTheme.fg('textDim', `${String(urls.size)} results`);
    }
    const { added, removed } = this.stats();
    const parts: string[] = [];
    if (added > 0) parts.push(currentTheme.fg('success', `+${String(added)}`));
    if (removed > 0) parts.push(currentTheme.fg('error', `-${String(removed)}`));
    return parts.join(currentTheme.fg('textMuted', '/'));
  }

  /** Left-hand facts in the bottom border: live elapsed time, duration, expand hint, interrupt hint. */
  private footer(): string {
    if (this.state === 'running') {
      const elapsed = formatElapsed(Date.now() - this.startedAt);
      return this.init.local ? `${elapsed} · running…` : `${elapsed} · esc to interrupt`;
    }
    if (this.state === 'streaming') return '';
    const parts: string[] = [];
    const elapsed = this.duration();
    if (elapsed) parts.push(elapsed);
    if (this.hidden()) parts.push('ctrl+o expand');
    return parts.join(' · ');
  }

  private hidden(): boolean {
    if (this.expanded) return false;
    const name = this.init.name;
    if (name === 'edit' || name === 'write' || name === 'patch' || name === 'apply_patch') return true;
    return this.output.trim().split('\n').length > 3;
  }

  private stats(): { added: number; removed: number } {
    const before = text(this.input.oldString);
    const after = text(this.input.newString);
    if (before || after) {
      let added = 0;
      let removed = 0;
      for (const line of computeDiffLines(before, after)) {
        if (line.kind === 'add') added++;
        else if (line.kind === 'delete') removed++;
      }
      return { added, removed };
    }
    if (this.init.name === 'write' && text(this.input.content)) {
      return { added: text(this.input.content).split('\n').length, removed: 0 };
    }
    return diffStats(this.diff);
  }

  private body(): Component[] {
    if (this.state === 'streaming' || this.state === 'running') {
      return this.output.trim() ? outcomeRows(this.output, 'last') : [];
    }
    const isError = this.state === 'error';
    const name = this.init.name;
    // Edits and writes show what changed rather than the tool's own "ok" message.
    if (!isError && (name === 'edit' || name === 'write' || name === 'patch' || name === 'apply_patch')) {
      const changed = this.changeRows();
      if (changed.length > 0) return changed;
    }
    if (!this.output.trim()) return [];
    if (!this.expanded && !isError) return outcomeRows(this.output, 'first');
    return [new TruncatedOutputComponent(this.output, { expanded: this.expanded, isError })];
  }

  private changeRows(): Component[] {
    const path = relativePath(text(this.input.path) || text(this.input.filePath), this.init.directory);
    const before = text(this.input.oldString);
    const after = text(this.input.newString);
    let lines: string[] = [];
    if (before || after) {
      lines = renderDiffLinesClustered(before, after, path, { maxLines: this.expanded ? undefined : 12 });
    } else if (this.diff) {
      lines = renderUnifiedDiff(this.diff, { maxLines: this.expanded ? undefined : 12 });
    } else if (this.state === 'success' && text(this.input.content)) {
      const total = text(this.input.content).split('\n').length;
      lines = [currentTheme.fg('textDim', `${String(total)} lines`)];
    }
    if (lines.length === 0) return [];
    return [new Text(lines.join('\n'), 0, 0)];
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1_000) return `${String(ms)}ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}m ${String(Math.round(seconds % 60))}s`;
}

function diffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added++;
    else if (line.startsWith('-')) removed++;
  }
  return { added, removed };
}

function diffFrom(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return '';
  if (typeof metadata.diff === 'string') return metadata.diff;
  const files = metadata.files;
  if (Array.isArray(files)) {
    return files
      .map((file) => (file && typeof file === 'object' && typeof (file as { patch?: unknown }).patch === 'string' ? (file as { patch: string }).patch : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}


