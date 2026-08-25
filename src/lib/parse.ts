import type { Book } from '../types';
import { mapHeaderRow, headerScore } from './columns';
import type { ColumnField, HeaderMap } from './columns';

const TAG_SEPARATORS = /[、,，/／;；|｜\n\r]+/;

/** Rows can hold strings, numbers, dates or `null` depending on the cell type. */
export type Cell = string | number | boolean | Date | null | undefined;
export type Row = readonly Cell[];

export function cellToText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : '';
  return String(cell).trim();
}

/** `NT$1,200 元` -> 1200. Returns null when there is no number in the cell. */
export function parsePrice(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  const text = cellToText(cell).replace(/[,，\s]/g, '');
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function splitTags(cell: Cell): string[] {
  return cellToText(cell)
    .split(TAG_SEPARATORS)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Finds the header row. Sheets often start with a title or a blank row, so the
 * first row that recognizes at least two known columns wins.
 */
export function findHeaderIndex(rows: readonly Row[], lookahead = 10): number {
  let best = -1;
  let bestScore = 1;
  for (let index = 0; index < Math.min(rows.length, lookahead); index += 1) {
    const score = headerScore(rows[index] ?? []);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}

/** How many rows actually have a value in this column. */
function filledCount(rows: readonly Row[], index: number): number {
  let count = 0;
  for (const row of rows) {
    if (cellToText(row[index]) !== '') count += 1;
  }
  return count;
}

/**
 * Picks one column per field. When a sheet carries several columns for the same
 * idea — `狀態` beside `書況`, say — the one people actually fill in is the one
 * worth showing, so the fullest column wins and the header order breaks ties.
 * The columns not chosen are kept as extra fields, so nothing is lost.
 */
export function chooseColumns(
  candidates: HeaderMap['candidates'],
  rows: readonly Row[],
): Partial<Record<ColumnField, number>> {
  const chosen: Partial<Record<ColumnField, number>> = {};
  for (const [field, indexes] of Object.entries(candidates) as [ColumnField, number[]][]) {
    if (indexes.length === 0) continue;
    let best = indexes[0] as number;
    if (indexes.length > 1) {
      let bestCount = filledCount(rows, best);
      for (const index of indexes.slice(1)) {
        const count = filledCount(rows, index);
        if (count > bestCount) {
          best = index;
          bestCount = count;
        }
      }
    }
    chosen[field] = best;
  }
  return chosen;
}

export class SpreadsheetError extends Error {}

/** Converts raw sheet rows into books. Throws when no header row is found. */
export function rowsToBooks(rows: readonly Row[]): Book[] {
  const headerIndex = findHeaderIndex(rows);
  if (headerIndex === -1) {
    throw new SpreadsheetError('找不到標題列，請確認第一列包含「書名」「作者」等欄位名稱。');
  }

  const header = rows[headerIndex] ?? [];
  const { candidates } = mapHeaderRow(header);
  const dataRows = rows.slice(headerIndex + 1);
  const fields = chooseColumns(candidates, dataRows);
  const used = new Set(Object.values(fields));
  const extras = header
    .map((label, index) => ({ index, label: cellToText(label as Cell) }))
    .filter((column) => column.label !== '' && !used.has(column.index));

  const at = (row: Row, index: number | undefined): Cell =>
    index === undefined ? null : row[index];

  const books: Book[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const title = cellToText(at(row, fields.title));
    const hasAnyValue = row.some((cell) => cellToText(cell) !== '');
    if (title === '' && !hasAnyValue) continue;

    const extraValues: Record<string, string> = {};
    for (const extra of extras) {
      const value = cellToText(row[extra.index]);
      if (value !== '') extraValues[extra.label] = value;
    }

    books.push({
      id: `row-${index}`,
      title: title || '（未命名）',
      author: cellToText(at(row, fields.author)),
      illustrator: cellToText(at(row, fields.illustrator)),
      translator: cellToText(at(row, fields.translator)),
      publisher: cellToText(at(row, fields.publisher)),
      summary: cellToText(at(row, fields.summary)),
      ageRange: cellToText(at(row, fields.ageRange)),
      tags: splitTags(at(row, fields.tags)),
      channel: cellToText(at(row, fields.channel)),
      price: parsePrice(at(row, fields.price)),
      condition: cellToText(at(row, fields.condition)),
      location: cellToText(at(row, fields.location)),
      isbn: cellToText(at(row, fields.isbn)),
      extras: extraValues,
    });
  }
  return books;
}

/** Minimal RFC 4180 CSV reader, enough for spreadsheet exports. */
export function parseCsv(input: string): Row[] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value !== '' || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((cell) => cell.trim()));
}
