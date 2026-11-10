/**
 * The lines under the welcome box, modelled on the Kimi home screen:
 * a release announcement with a rendered star glyph (not an emoji), then the
 * readiness note. Keeping the note here means the announcement always sits
 * above it, directly under the box.
 */

import { truncateToWidth, type Component } from '@loophole/tui-engine';

import { currentTheme } from '../../theme/index';

export interface AnnouncementState {
  readonly title: string;
  readonly detail?: string;
  /** Hide the announcement block (the default before the controller publishes one). */
  readonly visible?: boolean;
  /** The session is connected and ready to take a prompt. */
  readonly ready?: boolean;
  /** The connection dropped and the screen is reconnecting. */
  readonly offline?: boolean;
}

export class AnnouncementComponent implements Component {
  private state: AnnouncementState;

  constructor(state: AnnouncementState = { title: '', visible: false }) {
    this.state = state;
  }

  update(state: AnnouncementState): void {
    this.state = state;
  }

  invalidate(): void {}

  render(width: number): string[] {
    const out: string[] = [];
    const { title, detail, visible, ready, offline } = this.state;

    if (visible !== false && title.length > 0) {
      const star = currentTheme.fg('primary', '✦');
      out.push('');
      out.push(truncateToWidth(`  ${star} ${currentTheme.boldFg('textStrong', title)}`, width, '…'));
      if (detail) out.push(truncateToWidth(`    ${currentTheme.fg('textDim', detail)}`, width, '…'));
      // Keep a breathing line between the release note and the readiness line.
      out.push('');
    }

    if (offline) {
      out.push(
        truncateToWidth(
          `  ${currentTheme.fg('error', '✗ Offline')}${currentTheme.fg('textMuted', ' · reconnecting…')}`,
          width,
          '…',
        ),
      );
    } else if (ready) {
      out.push(
        truncateToWidth(
          `  ${currentTheme.fg('success', '✓ Ready')}${currentTheme.fg('textMuted', ' · type a message, / for commands, @ for files')}`,
          width,
          '…',
        ),
      );
    } else {
      out.push(truncateToWidth(`  ${currentTheme.fg('textDim', '○ Starting…')}`, width, '…'));
    }

    return out;
  }
}
