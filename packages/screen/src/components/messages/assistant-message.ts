/**
 * Renders an assistant message using pi-tui Markdown.
 *
 * Displays a white bullet prefix with markdown content indented
 * to align after the bullet.
 */

import { Container, truncateToWidth, visibleWidth, type Component, type TuiMouseDispatchResult, type TuiMouseEvent } from '@loophole/tui-engine';

import { Markdown } from '../markdown/markdown';
import { MESSAGE_INDENT } from '../../constant/rendering';
import { STATUS_BULLET } from '../../constant/symbols';
import { currentTheme } from '../../theme/index';
import { createMarkdownTheme } from '../../theme/pi-tui-theme';
import { createMarkdownOptions } from '../../utils/markdown-options';
import { markOsc133Zone } from '../../utils/osc133';
import { isRenderCacheEnabled } from '../../utils/render-cache';

type AssistantMarkdownOptions = {
  transient?: boolean;
};

function firstContentLine(lines: string[]): number {
  let first = 0;
  while (first < lines.length && lines[first]!.trim() === '') first++;
  return first;
}

export class AssistantMessageComponent implements Component {
  private contentContainer: Container;
  private markdown: Markdown | undefined;
  private markdownTransient = false;
  private lastText = '';
  private lastTransient = false;
  private showBullet: boolean;

  private renderCache: { width: number; lines: string[] } | undefined;

  constructor(showBullet: boolean = true) {
    this.showBullet = showBullet;
    this.contentContainer = new Container();
  }

  private markRenderDirty(): void {
    this.renderCache = undefined;
  }

  setShowBullet(show: boolean): void {
    if (this.showBullet === show) return;
    this.showBullet = show;
    this.markRenderDirty();
  }

  updateContent(text: string, opts?: AssistantMarkdownOptions): void {
    const displayText = text.trim();
    const transient = opts?.transient === true;

    if (displayText === this.lastText && transient === this.lastTransient) return;

    this.lastText = displayText;
    this.lastTransient = transient;
    this.markRenderDirty();

    if (displayText.length === 0) {
      this.contentContainer.clear();
      this.markdown = undefined;
      this.markdownTransient = false;
      return;
    }

    if (this.markdown === undefined || this.markdownTransient !== transient) {
      this.contentContainer.clear();
      this.markdown = new Markdown(
        displayText,
        0,
        0,
        createMarkdownTheme({ transient }),
        undefined,
        {
          ...createMarkdownOptions(),
          copySource: true,
          onVisualStateChange: () => this.markRenderDirty(),
        },
      );
      this.markdownTransient = transient;
      this.contentContainer.addChild(this.markdown);
      return;
    }

    this.markdown.setText(displayText);
  }

  invalidate(): void {
    // Markdown caches ANSI colour codes keyed on (text, width).  When the
    // theme changes the cached strings contain stale colours, so we rebuild
    // the Markdown child with the new theme while preserving transient mode.
    this.markRenderDirty();
    this.contentContainer.clear();
    this.markdown = undefined;

    if (this.lastText.trim().length > 0) {
      this.markdown = new Markdown(
        this.lastText.trim(),
        0,
        0,
        createMarkdownTheme({ transient: this.lastTransient }),
        undefined,
        {
          ...createMarkdownOptions(),
          copySource: true,
          onVisualStateChange: () => this.markRenderDirty(),
        },
      );
      this.markdownTransient = this.lastTransient;
      this.contentContainer.addChild(this.markdown);
    }
  }

  handleMouse(event: TuiMouseEvent): TuiMouseDispatchResult | undefined {
    if (this.lastText.trim().length === 0) return undefined;

    const prefix = this.showBullet ? STATUS_BULLET : MESSAGE_INDENT;
    const prefixWidth = visibleWidth(prefix);
    const contentWidth = Math.max(1, Math.max(0, event.width) - prefixWidth);
    const contentLines = this.contentContainer.render(contentWidth);
    const first = firstContentLine(contentLines);
    let last = contentLines.length - 1;
    while (last >= first && contentLines[last]!.trim() === '') last--;
    const visibleRows = last - first + 1;
    const y = event.y;
    if (y < 0 || y >= visibleRows) return undefined;

    return this.contentContainer.handleMouse({
      ...event,
      x: event.x - prefixWidth,
      y: y + first,
      width: contentWidth,
      height: contentLines.length,
    });
  }

  render(width: number): string[] {
    if (this.lastText.trim().length === 0) return [];

    const safeWidth = Math.max(0, width);
    if (safeWidth <= 0) return [''];

    if (
      isRenderCacheEnabled() &&
      this.renderCache !== undefined &&
      this.renderCache.width === safeWidth
    ) {
      return this.renderCache.lines;
    }

    const prefix = this.showBullet ? STATUS_BULLET : MESSAGE_INDENT;
    const contentWidth = Math.max(1, safeWidth - visibleWidth(prefix));
    const contentLines = this.contentContainer.render(contentWidth);

    // The transcript already inserts a spacer before the message. Markdown adds
    // its own blank rows around paragraphs/code, and a trailing newline in the
    // model output adds another; trim the edges so the result is one gap at
    // most instead of two or three.
    const first = firstContentLine(contentLines);
    let last = contentLines.length - 1;
    while (last >= first && contentLines[last]!.trim() === '') last--;

    const lines: string[] = [];
    for (let i = first; i <= last; i++) {
      const p =
        i === first && this.showBullet ? currentTheme.fg('text', STATUS_BULLET) : MESSAGE_INDENT;
      lines.push(p + contentLines[i]);
    }
    if (lines.length === 0) return [];
    const rendered = markOsc133Zone(lines.map((line) => truncateToWidth(line, safeWidth, '…')));
    if (isRenderCacheEnabled()) {
      this.renderCache = { width: safeWidth, lines: rendered };
    }
    return rendered;
  }
}
