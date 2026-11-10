import {
  Container,
  Markdown as PiMarkdown,
  type DefaultTextStyle,
  type MarkdownOptions,
  type MarkdownTheme,
  type TuiMouseDispatchResult,
  type TuiMouseEvent,
} from '@loophole/tui-engine';

import type { ScreenMarkdownTheme } from '../../theme/pi-tui-theme';
import { getMarkdownMermaidMode, type MermaidRenderMode } from '../../utils/markdown-options';

export interface ScreenMarkdownOptions extends MarkdownOptions {
  copySource?: boolean;
  onVisualStateChange?: () => void;
}


interface MarkdownStructure {
  text: string;
  mode: MermaidRenderMode;
  transient: boolean;
}

export class Markdown extends Container {
  private sourceText: string;
  private readonly paddingX: number;
  private readonly paddingY: number;
  private readonly theme: MarkdownTheme;
  private readonly defaultTextStyle?: DefaultTextStyle;
  private readonly options: ScreenMarkdownOptions;
  private structure: MarkdownStructure | undefined;

  constructor(
    text: string,
    paddingX: number,
    paddingY: number,
    theme: MarkdownTheme,
    defaultTextStyle?: DefaultTextStyle,
    options?: ScreenMarkdownOptions,
  ) {
    super();
    this.sourceText = text;
    this.paddingX = paddingX;
    this.paddingY = paddingY;
    this.theme = theme;
    this.defaultTextStyle = defaultTextStyle;
    this.options = options ? { ...options } : {};
  }

  setText(text: string): void {
    this.sourceText = text;
    this.invalidate();
  }

  override invalidate(): void {
    this.structure = undefined;
    super.invalidate();
  }

  override render(width: number): string[] {
    if (this.sourceText.trim() === '') return [];
    this.ensureStructure();
    const lines = super.render(width);
    if (this.paddingY === 0) return lines;
    const bgFn = this.defaultTextStyle?.bgColor;
    const empty = ' '.repeat(Math.max(0, width));
    const margins = Array.from({ length: this.paddingY }, () => (bgFn ? bgFn(empty) : empty));
    return [...margins, ...lines, ...margins];
  }

  override handleMouse(event: TuiMouseEvent): TuiMouseDispatchResult | undefined {
    if (this.paddingY === 0) return super.handleMouse(event);
    if (event.y < this.paddingY) return undefined;
    return super.handleMouse({
      ...event,
      y: event.y - this.paddingY,
      height: event.height - this.paddingY * 2,
    });
  }

  private ensureStructure(): void {
    const mode = getMarkdownMermaidMode();
    const transient = (this.theme as ScreenMarkdownTheme).transient === true;
    if (
      this.structure !== undefined &&
      this.structure.text === this.sourceText &&
      this.structure.mode === mode &&
      this.structure.transient === transient
    ) {
      return;
    }
    this.structure = { text: this.sourceText, mode, transient };
    this.clear();
    if (mode === 'off' || transient) {
      this.addChild(
        new PiMarkdown(
          this.sourceText,
          this.paddingX,
          0,
          this.theme,
          this.defaultTextStyle,
          this.options,
        ),
      );
      return;
    }
    // Mermaid diagram rendering is not ported; every block renders as markdown.
    this.addChild(
      new PiMarkdown(this.sourceText, this.paddingX, 0, this.theme, this.defaultTextStyle, this.options),
    );
  }
}
