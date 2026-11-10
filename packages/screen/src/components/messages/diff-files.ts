/**
 * The `/diff` transcript block: one bordered panel per changed file with
 * line-numbered, tinted hunks (the same visual language as the approval
 * preview). Kept separate from `StatusMessageComponent`, which renders a
 * single colour for the whole message.
 */

import { truncateToWidth, visibleWidth, type Component } from '@loophole/tui-engine';

import { currentTheme } from '../../theme/index';
import { renderUnifiedDiff } from '../media/diff-preview';

export interface DiffFileSummary {
  readonly file: string;
  readonly patch: string;
  readonly additions: number;
  readonly deletions: number;
  readonly status: 'added' | 'deleted' | 'modified';
}

const STATUS_LABEL: Record<DiffFileSummary['status'], string> = {
  added: 'added',
  deleted: 'deleted',
  modified: 'modified',
};

export class DiffFilesComponent implements Component {
  constructor(
    private readonly files: readonly DiffFileSummary[],
    private readonly maxLinesPerFile = 18,
  ) {}

  invalidate(): void {}

  render(width: number): string[] {
    const out: string[] = [currentTheme.boldFg('textStrong', 'Files changed')];
    for (const file of this.files) {
      out.push('');
      out.push(...this.renderFile(file, width));
    }
    return out;
  }

  private renderFile(file: DiffFileSummary, width: number): string[] {
    const border = (text: string) => currentTheme.fg('border', text);
    const inner = Math.max(1, width - 4);
    const counts = [
      file.additions > 0 ? currentTheme.fg('diffAdded', `+${String(file.additions)}`) : '',
      file.deletions > 0 ? currentTheme.fg('diffRemoved', `-${String(file.deletions)}`) : '',
    ]
      .filter((part) => part.length > 0)
      .join(' ');
    const status = currentTheme.fg('textMuted', STATUS_LABEL[file.status]);
    const title = truncateToWidth(
      ` ${file.file}  ${status}${counts ? `  ${counts}` : ''} `,
      Math.max(0, width - 4),
      '…',
    );
    const fill = Math.max(0, width - 3 - visibleWidth(title));

    const out: string[] = [border('╭─') + title + border(`${'─'.repeat(fill)}╮`)];
    const rows = file.patch.trim().length > 0
      ? renderUnifiedDiff(file.patch, { width: inner, maxLines: this.maxLinesPerFile })
      : [currentTheme.fg('textMuted', 'No textual diff')];
    for (const row of rows) {
      const line = truncateToWidth(row, inner, '…', true);
      out.push(border('│') + ' ' + line + ' ' + border('│'));
    }
    out.push(border(`╰${'─'.repeat(width - 2)}╯`));
    return out;
  }
}
