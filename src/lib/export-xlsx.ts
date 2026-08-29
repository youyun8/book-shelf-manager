import type { Book, FieldKey } from '../types';
import { FIELD_LABELS } from '../types';
import { rowsToXlsx, type SpreadsheetCell } from './xlsx';

const COLUMNS: { field: FieldKey; value: (book: Book) => SpreadsheetCell }[] = [
  { field: 'title', value: (book) => book.title },
  { field: 'status', value: (book) => book.status },
  { field: 'channel', value: (book) => book.channel },
  { field: 'price', value: (book) => book.price },
  { field: 'wear', value: (book) => book.wear },
  { field: 'condition', value: (book) => book.condition },
  { field: 'location', value: (book) => book.location },
  { field: 'notes', value: (book) => book.notes },
  { field: 'author', value: (book) => book.author },
  { field: 'illustrator', value: (book) => book.illustrator },
  { field: 'translator', value: (book) => book.translator },
  { field: 'publisher', value: (book) => book.publisher },
  { field: 'summary', value: (book) => book.summary },
  { field: 'ageRange', value: (book) => book.ageRange },
  { field: 'readingMode', value: (book) => book.readingMode },
  { field: 'tags', value: (book) => book.tags.join('、') },
  { field: 'isbn', value: (book) => book.isbn },
];

/** The header row, which is the source sheet's own order. */
export const EXPORT_FIELDS = COLUMNS.map((column) => column.field);

/** Columns wide enough to read without resizing: the title and the summary. */
const WIDE_COLUMNS: Partial<Record<FieldKey, number>> = { title: 28, summary: 50, notes: 30 };

/** Converts books to rows, preserving every custom spreadsheet column. */
export function booksToRows(books: readonly Book[]): SpreadsheetCell[][] {
  const extraHeaders = [...new Set(books.flatMap((book) => Object.keys(book.extras)))];
  return [
    [...COLUMNS.map((column) => FIELD_LABELS[column.field]), ...extraHeaders],
    ...books.map((book) => [
      ...COLUMNS.map((column) => column.value(book)),
      ...extraHeaders.map((header) => book.extras[header] ?? ''),
    ]),
  ];
}

export function booksToXlsx(books: readonly Book[]): Uint8Array {
  const rows = booksToRows(books);
  const widths = rows[0]!.map((header, index) => {
    const field = COLUMNS[index]?.field;
    const wide = field === undefined ? undefined : WIDE_COLUMNS[field];
    return wide ?? Math.max(12, Math.min(24, String(header).length * 2));
  });
  return rowsToXlsx(rows, { sheetName: 'Books', columnWidths: widths });
}

/** Downloads the current filtered result as a real Excel workbook. */
export function downloadXlsx(books: readonly Book[], fileName = 'book_library.xlsx'): void {
  const bytes = booksToXlsx(books);
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
