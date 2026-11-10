import { truncateToWidth, visibleWidth, type Component } from '@loophole/tui-engine';

import { currentTheme } from '../../theme/index';

export interface FooterState {
  readonly directory: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly busy: boolean;
  readonly auto: boolean;
  /** Active agent, shown before the model. */
  readonly agent?: string;
  /** Active model label, including the thinking effort when one is selected. */
  readonly model?: string;
  /** Tokens currently in the model's context window. */
  readonly contextTokens?: number;
  /** The model's context window size, when the server reports one. */
  readonly contextLimit?: number;
  /** The server connection dropped and the screen is trying to reconnect. */
  readonly offline?: boolean;
}

function compactPath(directory: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  return home && directory.startsWith(home) ? `~${directory.slice(home.length)}` : directory;
}

function compactCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

/**
 * The status row under the editor: the agent and model on the left, the working directory in the
 * middle and the context usage plus key hints on the right. There is no rule above it — the input
 * header already separates the composer from the transcript. Parts drop out from the middle
 * outwards when the terminal is narrow.
 */
export class FooterComponent implements Component {
  private state: FooterState;

  constructor(state: FooterState) {
    this.state = state;
  }

  update(state: FooterState): void {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const { directory, tokensIn, tokensOut, busy, auto, agent, model, contextTokens, contextLimit, offline } = this.state;

    const badges: string[] = [];
    if (offline) badges.push(currentTheme.fg('error', 'reconnecting'));
    if (auto) badges.push(currentTheme.fg('warning', 'auto'));

    const identity = [agent, model].filter((value): value is string => Boolean(value)).join(' · ');
    const leftParts = [...badges];
    if (identity) leftParts.push(currentTheme.fg('textDim', identity));
    const left = leftParts.join('  ');

    let usage = '';
    if (contextLimit !== undefined && contextLimit > 0) {
      const used = contextTokens ?? 0;
      const percent = Math.min(100, Math.round((used / contextLimit) * 100));
      usage = `context: ${String(percent)}% (${compactCount(used)}/${compactCount(contextLimit)})`;
    } else if (tokensIn + tokensOut > 0) {
      usage = `${compactCount(tokensIn)} in · ${compactCount(tokensOut)} out`;
    }
    const hint = busy ? 'esc interrupt' : 'ctrl+o expand · ctrl+c exit';
    const right = [usage, hint]
      .filter((value) => value.length > 0)
      .map((value) => currentTheme.fg('textMuted', value))
      .join('  ·  ');

    const centre = currentTheme.fg('textDim', compactPath(directory));

    const lw = visibleWidth(left);
    const cw = visibleWidth(centre);
    const rw = visibleWidth(right);

    if (lw + cw + rw + 4 <= width) {
      const start = Math.max(lw + 2, Math.floor((width - cw) / 2));
      if (start + cw + 2 <= width - rw) {
        return [left + ' '.repeat(start - lw) + centre + ' '.repeat(width - rw - start - cw) + right];
      }
    }
    if (lw + rw + 2 <= width) {
      return [left + ' '.repeat(width - lw - rw) + right];
    }
    if (rw < width) {
      const room = width - rw - 2;
      return [truncateToWidth(left, Math.max(0, room), '…') + ' '.repeat(Math.max(2, width - rw - room)) + right];
    }
    return [truncateToWidth(right, Math.max(0, width), '…')];
  }
}
