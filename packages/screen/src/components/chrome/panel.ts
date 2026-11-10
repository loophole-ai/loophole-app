/**
 * A bordered panel used by the prompt slot: the approval dialog, structured
 * questions and the pickers. Content is stretched to the terminal width and
 * the title sits in the top rule (`╭─ approval ─────…`).
 */

import { truncateToWidth, visibleWidth, type Component } from '@loophole/tui-engine';

import { currentTheme, type ColorToken } from '../../theme/index';

export interface PanelOptions {
  /** Optional label in the top border. */
  readonly title?: string;
  /** Optional right-aligned fact in the top border (`+12/-3`, `preview`). */
  readonly meta?: string;
  /** Optional left-aligned fact in the bottom border (`1.2s`, `ctrl+o expand`). */
  readonly footer?: string;
  /** Border colour. Defaults to the focus border. */
  readonly accent?: ColorToken;
  /** Spaces between the border and the content. Defaults to 1. */
  readonly paddingX?: number;
  /** Blank rows above and below the content. Defaults to 0. */
  readonly paddingY?: number;
}

export class PanelComponent implements Component {
  private readonly children: Component[] = [];

  constructor(private readonly options: PanelOptions = {}) {}

  addChild(child: Component): void {
    this.children.push(child);
  }

  invalidate(): void {
    for (const child of this.children) child.invalidate();
  }

  render(width: number): string[] {
    const requestedPadding = Math.max(0, this.options.paddingX ?? 1);
    const paddingX = Math.min(requestedPadding, Math.max(0, Math.floor((width - 3) / 2)));
    const paddingY = Math.max(0, this.options.paddingY ?? 0);
    const inner = Math.max(1, width - 2 - paddingX * 2);
    const paint = (text: string) => currentTheme.fg(this.options.accent ?? 'borderFocus', text);

    const blank = () => paint('│') + ' '.repeat(inner + paddingX * 2) + paint('│');
    const row = (content: string) =>
      paint('│') +
      ' '.repeat(paddingX) +
      truncateToWidth(content, inner, '…', true) +
      ' '.repeat(paddingX) +
      paint('│');

    const title = this.options.title ? ` ${this.options.title} ` : '';
    const meta = this.options.meta ? ` ${this.options.meta} ` : '';
    const titleWidth = visibleWidth(title);
    const metaWidth = visibleWidth(meta);
    const showMeta = metaWidth > 0 && width - 4 - titleWidth >= metaWidth + 3;
    const fittedTitle =
      titleWidth > Math.max(0, width - 4 - (showMeta ? metaWidth + 3 : 0))
        ? truncateToWidth(title, Math.max(0, width - 4 - (showMeta ? metaWidth + 3 : 0)), '…')
        : title;
    const fittedTitleWidth = visibleWidth(fittedTitle);
    const topFill = Math.max(0, width - 3 - fittedTitleWidth - (showMeta ? metaWidth : 0));
    const top =
      paint('╭─') +
      (fittedTitle ? currentTheme.boldFg(this.options.accent ?? 'borderFocus', fittedTitle) : '') +
      paint('─'.repeat(topFill)) +
      (showMeta ? currentTheme.fg('textMuted', meta) : '') +
      paint('╮');

    const out: string[] = [top];
    for (let i = 0; i < paddingY; i++) out.push(blank());
    for (const child of this.children) {
      for (const line of child.render(inner)) out.push(row(line));
    }
    for (let i = 0; i < paddingY; i++) out.push(blank());
    const footer = this.options.footer ? ` ${this.options.footer} ` : '';
    const footerWidth = visibleWidth(footer);
    const showFooter = footerWidth > 0 && width - 3 >= footerWidth + 2;
    const bottomFill = Math.max(0, width - 3 - (showFooter ? footerWidth : 0));
    out.push(
      paint('╰─') +
        (showFooter ? currentTheme.fg('textMuted', footer) : '') +
        paint('─'.repeat(bottomFill)) +
        paint('╯'),
    );
    return out;
  }
}
