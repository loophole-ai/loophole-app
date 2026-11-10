import { truncateToWidth, type Component } from '@loophole/tui-engine';

import { currentTheme } from '../../theme/index';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** "Working…" row above the editor. Renders nothing while idle. */
export class ActivityComponent implements Component {
  private active = false;
  private label = 'Working';
  private frame = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly requestRender: () => void) {}

  setActive(active: boolean, label = 'Working'): void {
    this.label = label;
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.startedAt = Date.now();
      this.timer = setInterval(() => {
        this.frame = (this.frame + 1) % FRAMES.length;
        this.requestRender();
      }, 90);
      (this.timer as { unref?: () => void }).unref?.();
    } else if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (!this.active) return [];
    const seconds = Math.floor((Date.now() - this.startedAt) / 1000);
    const line = `${currentTheme.fg('primary', FRAMES[this.frame] ?? '⠋')} ${currentTheme.fg('textDim', `${this.label}…`)} ${currentTheme.fg('textMuted', `${String(seconds)}s`)}`;
    return ['', truncateToWidth(line, Math.max(0, width), '…')];
  }
}
