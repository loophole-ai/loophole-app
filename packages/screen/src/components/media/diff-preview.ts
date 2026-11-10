/**
 * Diff preview rendering as plain ANSI strings.
 *
 * Reuses the diff algorithm from approval/DiffPreview.tsx, but outputs
 * formatted text lines instead of React elements.
 */

import { visibleWidth } from '@loophole/tui-engine';
import chalk from 'chalk';

import { currentTheme } from '../../theme/index';

export type DiffLineKind = 'context' | 'add' | 'delete';

interface DiffStyles {
  add: (s: string) => string;
  del: (s: string) => string;
  addBold: (s: string) => string;
  delBold: (s: string) => string;
  addBg: (s: string) => string;
  delBg: (s: string) => string;
  gutter: (s: string) => string;
  meta: (s: string) => string;
}

function makeDiffStyles(): DiffStyles {
  const palette = currentTheme.palette;
  return {
    add: (s) => chalk.hex(palette.diffAdded)(s),
    del: (s) => chalk.hex(palette.diffRemoved)(s),
    addBold: (s) => chalk.bold.hex(palette.diffAddedStrong)(s),
    delBold: (s) => chalk.bold.hex(palette.diffRemovedStrong)(s),
    addBg: (s) => chalk.bgHex(palette.diffAddedBg).hex(palette.diffAdded)(s),
    delBg: (s) => chalk.bgHex(palette.diffRemovedBg).hex(palette.diffRemoved)(s),
    gutter: (s) => chalk.hex(palette.diffGutter)(s),
    meta: (s) => chalk.hex(palette.diffMeta)(s),
  };
}

export interface DiffLine {
  kind: DiffLineKind;
  lineNum: number;
  code: string;
}

export function computeDiffLines(
  oldText: string,
  newText: string,
  oldStart: number = 1,
  newStart: number = 1,
  isIncomplete: boolean = false,
): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const reversed: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      reversed.push({ kind: 'context', lineNum: newStart + j - 1, code: newLines[j - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      reversed.push({ kind: 'add', lineNum: newStart + j - 1, code: newLines[j - 1]! });
      j--;
    } else {
      reversed.push({ kind: 'delete', lineNum: oldStart + i - 1, code: oldLines[i - 1]! });
      i--;
    }
  }

  const result: DiffLine[] = [];
  for (let k = reversed.length - 1; k >= 0; k--) {
    result.push(reversed[k]!);
  }

  // While the text is still streaming, suppress trailing delete lines.
  // They are likely artefacts of newText not having arrived yet rather
  // than genuine deletions.
  if (isIncomplete && result.length > 0) {
    let lastNonDelete = result.length - 1;
    while (lastNonDelete >= 0 && result[lastNonDelete]!.kind === 'delete') {
      lastNonDelete--;
    }
    if (lastNonDelete >= 0) {
      result.length = lastNonDelete + 1;
    } else {
      // Every line would be shown as deleted; suppress them all so the
      // UI doesn't flash a wall of red before newText starts arriving.
      result.length = 0;
    }
  }

  return result;
}

export function renderDiffLines(
  oldText: string,
  newText: string,
  path: string,
  isIncomplete: boolean = false,
  oldStart?: number,
  newStart?: number,
  maxLines?: number,
): string[] {
  const s = makeDiffStyles();
  const diffLines = computeDiffLines(oldText, newText, oldStart ?? 1, newStart ?? 1, isIncomplete);
  const changedLines = diffLines.filter((l) => l.kind !== 'context');
  const added = changedLines.filter((l) => l.kind === 'add').length;
  const removed = changedLines.filter((l) => l.kind === 'delete').length;

  const output: string[] = [];

  let header = '';
  if (added > 0) header += s.addBold(`+${String(added)} `);
  if (removed > 0) header += s.delBold(`-${String(removed)} `);
  header += path;
  output.push(header);

  const shown =
    maxLines !== undefined && maxLines >= 0 && changedLines.length > maxLines
      ? changedLines.slice(0, maxLines)
      : changedLines;

  for (const line of shown) {
    const marker = line.kind === 'add' ? '+' : '-';
    const color = line.kind === 'add' ? s.add : s.del;
    output.push(s.gutter(String(line.lineNum).padStart(4) + ' ') + color(marker + ' ' + line.code));
  }

  const hidden = changedLines.length - shown.length;
  if (hidden > 0) {
    output.push(
      s.meta(
        `     … ${String(hidden)} more change${hidden > 1 ? 's' : ''} hidden (ctrl+o to expand)`,
      ),
    );
  }

  return output;
}

export interface ClusteredDiffOptions {
  readonly contextLines?: number;
  readonly maxLines?: number;
  readonly isIncomplete?: boolean;
  readonly expandKeyHint?: string;
  readonly oldStart?: number;
  readonly newStart?: number;
}

interface Cluster {
  readonly start: number;
  readonly end: number;
}

function buildClusters(
  diffLines: DiffLine[],
  contextLines: number,
): { clusters: Cluster[]; changedCount: number; addedCount: number; removedCount: number } {
  const changeIndices: number[] = [];
  let added = 0;
  let removed = 0;
  for (const [i, line] of diffLines.entries()) {
    if (line.kind === 'add') {
      added++;
      changeIndices.push(i);
    } else if (line.kind === 'delete') {
      removed++;
      changeIndices.push(i);
    }
  }

  const clusters: Cluster[] = [];
  if (changeIndices.length === 0) {
    return { clusters, changedCount: 0, addedCount: added, removedCount: removed };
  }

  const mergeGap = 2 * contextLines;
  let groupStart = changeIndices[0]!;
  let groupEnd = changeIndices[0]!;
  for (let i = 1; i < changeIndices.length; i++) {
    const idx = changeIndices[i]!;
    if (idx - groupEnd <= mergeGap) {
      groupEnd = idx;
    } else {
      clusters.push({
        start: Math.max(0, groupStart - contextLines),
        end: Math.min(diffLines.length - 1, groupEnd + contextLines),
      });
      groupStart = idx;
      groupEnd = idx;
    }
  }
  clusters.push({
    start: Math.max(0, groupStart - contextLines),
    end: Math.min(diffLines.length - 1, groupEnd + contextLines),
  });

  return {
    clusters,
    changedCount: changeIndices.length,
    addedCount: added,
    removedCount: removed,
  };
}

function formatDiffRow(line: DiffLine, s: DiffStyles): string {
  const gutter = s.gutter(String(line.lineNum).padStart(4) + ' ');
  if (line.kind === 'add') return gutter + s.add('+ ' + line.code);
  if (line.kind === 'delete') return gutter + s.del('- ' + line.code);
  return gutter + '  ' + line.code;
}

/**
 * Render a diff with surrounding context, eliding unchanged middle
 * regions between change clusters with a `… N unchanged lines …`
 * separator. When `maxLines` is set, the body is capped at a cluster
 * boundary and a `ctrl+o to expand` footer is appended.
 *
 * Used by Edit's call preview where we want to show *what changed*
 * with enough context to read the change, but not the whole file.
 */
export function renderDiffLinesClustered(
  oldText: string,
  newText: string,
  path: string,
  opts: ClusteredDiffOptions = {},
): string[] {
  const s = makeDiffStyles();
  const contextLines = opts.contextLines ?? 3;
  const maxLines = opts.maxLines;
  const diffLines = computeDiffLines(
    oldText,
    newText,
    opts.oldStart ?? 1,
    opts.newStart ?? 1,
    opts.isIncomplete ?? false,
  );
  const { clusters, changedCount, addedCount, removedCount } = buildClusters(
    diffLines,
    contextLines,
  );

  const output: string[] = [];
  let header = '';
  if (addedCount > 0) header += s.addBold(`+${String(addedCount)} `);
  if (removedCount > 0) header += s.delBold(`-${String(removedCount)} `);
  header += path;
  output.push(header);

  if (clusters.length === 0) return output;

  const cap = maxLines !== undefined && maxLines >= 0 ? maxLines : Number.POSITIVE_INFINITY;
  let body = 0;
  let prevEnd = -1;
  let truncated = false;
  let shownChanges = 0;

  outer: for (const cluster of clusters) {
    if (body >= cap) {
      truncated = true;
      break;
    }
    if (prevEnd >= 0) {
      const gap = cluster.start - prevEnd - 1;
      if (gap > 0) {
        if (body + 1 > cap) {
          truncated = true;
          break;
        }
        output.push(s.meta(`     … ${String(gap)} unchanged line${gap > 1 ? 's' : ''} …`));
        body++;
      }
    }
    // Emit cluster rows one at a time; allow mid-cluster truncation so
    // a single huge cluster (e.g. the whole file replaced inline) still
    // shows the leading lines instead of degenerating to "N changes
    // hidden" with no body at all.
    for (let i = cluster.start; i <= cluster.end; i++) {
      if (body >= cap) {
        truncated = true;
        break outer;
      }
      const line = diffLines[i]!;
      output.push(formatDiffRow(line, s));
      body++;
      if (line.kind !== 'context') shownChanges++;
      prevEnd = i;
    }
  }

  if (truncated) {
    const hidden = changedCount - shownChanges;
    if (hidden > 0) {
      const hint = opts.expandKeyHint ?? 'ctrl+o';
      output.push(
        s.meta(
          `     … ${String(hidden)} more change${hidden > 1 ? 's' : ''} hidden (${hint} to expand)`,
        ),
      );
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Unified diffs (FileDiffInfo.patch): line numbers, +/- markers and row tints.
// ---------------------------------------------------------------------------

export type UnifiedRowKind = 'hunk' | 'add' | 'delete' | 'context';

export interface UnifiedDiffRow {
  readonly kind: UnifiedRowKind;
  readonly text: string;
  readonly oldLine?: number;
  readonly newLine?: number;
}

/**
 * Parse a standard unified diff into renderable rows.
 *
 * File headers (`diff --git`, `index`, `---`, `+++`) are dropped; everything
 * from the first `@@` header on is kept, including context lines. Line numbers
 * come from the hunk headers, so a multi-file patch renders each file's rows
 * with the right numbers.
 */
export function parseUnifiedDiff(patch: string): UnifiedDiffRow[] {
  const rows: UnifiedDiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const rawLine of patch.split('\n')) {
    const raw = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (raw.startsWith('@@')) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (match) {
        oldLine = Number(match[1]);
        newLine = Number(match[2]);
      }
      rows.push({ kind: 'hunk', text: raw });
      continue;
    }
    if (raw.startsWith('\\ No newline')) continue;
    // A new file section resets the hunk cursors so its `---`/`+++` headers are
    // skipped too (createTwoFilesPatch and multi-file patches emit separators).
    if (/^=+$/.test(raw) || raw.startsWith('diff --git ') || raw.startsWith('Index: ')) {
      oldLine = 0;
      newLine = 0;
      continue;
    }
    if (oldLine === 0 && newLine === 0 && (raw.startsWith('index ') || raw.startsWith('--- ') || raw.startsWith('+++ '))) {
      continue;
    }
    if (raw.startsWith('+')) {
      rows.push({ kind: 'add', text: raw.slice(1), newLine });
      newLine++;
    } else if (raw.startsWith('-')) {
      rows.push({ kind: 'delete', text: raw.slice(1), oldLine });
      oldLine++;
    } else if (raw.startsWith(' ')) {
      rows.push({ kind: 'context', text: raw.slice(1), oldLine, newLine });
      oldLine++;
      newLine++;
    } else if (raw.length > 0) {
      // Some producers omit the leading space on context rows.
      rows.push({ kind: 'context', text: raw, oldLine, newLine });
      oldLine++;
      newLine++;
    }
  }
  return rows;
}

export function diffStats(patch: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const row of parseUnifiedDiff(patch)) {
    if (row.kind === 'add') added++;
    else if (row.kind === 'delete') removed++;
  }
  return { added, removed };
}

export interface UnifiedDiffRenderOptions {
  /** Maximum rows to emit before a "more lines" footer. */
  readonly maxLines?: number;
  /** Show only changed rows (used by the approval preview). */
  readonly changedOnly?: boolean;
  /** Pad every row to this width so the background tint fills the panel. */
  readonly width?: number;
}

export function renderUnifiedDiff(patch: string, options: UnifiedDiffRenderOptions = {}): string[] {
  const s = makeDiffStyles();
  const all = parseUnifiedDiff(patch);
  const rows = options.changedOnly
    ? all.filter((row) => row.kind === 'add' || row.kind === 'delete')
    : all;
  if (rows.length === 0) return [];

  let maxNumber = 0;
  for (const row of rows) {
    maxNumber = Math.max(maxNumber, row.oldLine ?? 0, row.newLine ?? 0);
  }
  const numberWidth = Math.max(2, String(maxNumber).length);
  const cap = options.maxLines !== undefined && options.maxLines >= 0 ? options.maxLines : Number.POSITIVE_INFINITY;

  const output: string[] = [];
  let emitted = 0;
  for (const row of rows) {
    if (emitted >= cap) break;
    output.push(formatUnifiedRow(row, numberWidth, s, options.width));
    emitted++;
  }

  const hidden = rows.length - emitted;
  if (hidden > 0) {
    const label = `… ${String(hidden)} more line${hidden === 1 ? '' : 's'}`;
    const text = s.meta(label);
    output.push(options.width !== undefined ? padStyled(text, visibleLength(label), options.width) : text);
  }
  return output;
}

/** Compact changed-lines-only preview (approval panels). */
export function renderUnifiedDiffPreview(patch: string, maxLines = 8): string[] {
  return renderUnifiedDiff(patch, { changedOnly: true, maxLines });
}

function formatUnifiedRow(
  row: UnifiedDiffRow,
  numberWidth: number,
  s: DiffStyles,
  width: number | undefined,
): string {
  if (row.kind === 'hunk') {
    return width === undefined
      ? s.meta(row.text)
      : padStyled(s.meta(row.text), visibleLength(row.text), width);
  }
  const number = row.kind === 'delete' ? row.oldLine : row.newLine;
  const gutter = s.gutter(String(number ?? '').padStart(numberWidth) + ' ');
  if (row.kind === 'add') {
    const line = `${gutter}${s.add(' + ')}${s.addBg(row.text)}`;
    return width === undefined ? line : padStyled(line, visibleLength(row.text) + numberWidth + 4, width, s.addBg);
  }
  if (row.kind === 'delete') {
    const line = `${gutter}${s.del(' - ')}${s.delBg(row.text)}`;
    return width === undefined ? line : padStyled(line, visibleLength(row.text) + numberWidth + 4, width, s.delBg);
  }
  const line = `${gutter}   ${row.text}`;
  return width === undefined ? line : padStyled(line, visibleLength(row.text) + numberWidth + 4, width);
}

function visibleLength(text: string): number {
  return visibleWidth(text);
}

/** Pad a styled row to `width` cells, painting the padding with `fill`. */
function padStyled(
  styled: string,
  plainLength: number,
  width: number,
  fill: (s: string) => string = (s) => s,
): string {
  const padding = Math.max(0, width - plainLength);
  return styled + fill(' '.repeat(padding));
}
