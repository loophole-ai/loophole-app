import { truncateToWidth, visibleWidth, type Component } from '@loophole/tui-engine';

import { currentTheme } from '../../theme/index';

export interface WelcomeState {
  readonly directory: string;
  /** Session title, falling back to the session id when the session has no title. */
  readonly session?: string;
  readonly model?: string;
  readonly version?: string;
}

/**
 * The Loophole wordmark: `packages/ui/src/assets/logo/wordmark.svg` rasterized
 * into terminal half-block art (the `narrow` variant from `packages/tui/src/logo.ts`).
 * Copied here so the screen package keeps its narrow dependency surface.
 */
const WORDMARK = [
  '██                      ██            ██',
  '██ ██████ ██████ ██████ ██████ ██████ ██  ██▀██',
  '██ ██  ██ ██  ██ ██▄▄██ ██  ██ ██  ██ ██  ██▄██',
  '██ ██████ ██████ ██▀▀▀▀ ██  ██ ██████ ██  █▄▄▄▄',
  '                 ██',
];
const WORDMARK_WIDTH = Math.max(...WORDMARK.map((row) => visibleWidth(row)));
const WORDMARK_HEIGHT = WORDMARK.length;

const PAD_X = 2;
const COLUMN_GAP = 3;
/** Below this inner width the wordmark and greeting stack instead of sitting side by side. */
const COLUMN_MIN = 24;

/**
 * The opening panel, modelled on a modern CLI welcome box: a rounded border around the
 * wordmark, a greeting with the `/help` hint, and the session facts (directory, session, model,
 * version). The panel always spans the terminal width. The readiness note and the release
 * announcement live in `AnnouncementComponent`, directly below the box.
 */
export class WelcomeComponent implements Component {
  private state: WelcomeState;

  constructor(state: WelcomeState) {
    this.state = state;
  }

  update(state: WelcomeState): void {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const { directory, session, model, version } = this.state;

    const facts: Array<[string, string]> = [['Directory', shortenHome(directory)]];
    if (session) facts.push(['Session', session]);
    if (model) facts.push(['Model', model]);
    if (version) facts.push(['Version', version]);
    const labelWidth = Math.max(...facts.map(([name]) => name.length));

    // The panel is the page frame, so it always fills the terminal: one column for each border
    // and PAD_X columns of padding on either side.
    const inner = Math.max(1, width - PAD_X * 2 - 2);
    const border = (text: string) => currentTheme.fg('primary', text);
    const rule = '─'.repeat(inner + PAD_X * 2);

    const out: string[] = [];
    const blank = () => border('│') + ' '.repeat(inner + PAD_X * 2) + border('│');
    const row = (body: string) =>
      border('│') + ' '.repeat(PAD_X) + truncateToWidth(body, inner, '…', true) + ' '.repeat(PAD_X) + border('│');

    out.push(border(`╭${rule}╮`));
    out.push(blank());

    for (const line of this.intro(inner)) out.push(row(line));
    out.push(blank());

    for (const [name, value] of facts) {
      out.push(row(`${currentTheme.fg('textDim', `${name.padEnd(labelWidth)}:`)} ${value}`));
    }

    out.push(blank());
    out.push(border(`╰${rule}╯`));

    return out;
  }

  /** The wordmark and greeting block: side by side when there is room, stacked otherwise. */
  private intro(inner: number): string[] {
    const greeting = currentTheme.boldFg('textStrong', 'Welcome to Loophole!');
    const hint = currentTheme.fg('textDim', 'Send /help for help information.');
    const rightColumn = [greeting, hint];
    const rightWidth = Math.max(...rightColumn.map((line) => visibleWidth(line)));

    if (inner < WORDMARK_WIDTH + COLUMN_GAP + Math.max(COLUMN_MIN, rightWidth)) {
      return [...WORDMARK.map((line) => currentTheme.fg('primary', line)), '', greeting, hint];
    }

    const topOffset = Math.max(0, Math.floor((WORDMARK_HEIGHT - rightColumn.length) / 2));
    return Array.from({ length: WORDMARK_HEIGHT }, (_, index) => {
      const line = WORDMARK[index] ?? '';
      const logo = currentTheme.fg('primary', line) + ' '.repeat(Math.max(0, WORDMARK_WIDTH - visibleWidth(line)));
      return logo + ' '.repeat(COLUMN_GAP) + (rightColumn[index - topOffset] ?? '');
    });
  }
}

function shortenHome(directory: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  return home && directory.startsWith(home) ? `~${directory.slice(home.length)}` : directory;
}
