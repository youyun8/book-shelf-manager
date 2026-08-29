import type { Book } from '../types';
import { rowsToXlsx, type SpreadsheetCell } from './xlsx';

const COLUMNS: { header: string; value: (book: Book) => SpreadsheetCell }[] = [
  { header: '書名', value: (book) => book.title },
  { header: '作者', value: (book) => book.author },
  { header: '繪者', value: (book) => book.illustrator },
  { header: '譯者', value: (book) => book.translator },
  { header: '出版社', value: (book) => book.publisher },
  { header: '內容簡介', value: (book) => book.summary },
  { header: '適讀年齡', value: (book) => book.ageRange },
  { header: '共讀方式', value: (book) => book.readingMode },
  { header: '建議標籤', value: (book) => book.tags.join('、') },
  { header: '購入管道', value: (book) => book.channel },
  { header: '價格', value: (book) => book.price },
  { header: '狀態', value: (book) => book.status },
  { header: '新舊', value: (book) => book.wear },
  { header: '書況', value: (book) => book.condition },
  { header: '藏書位置', value: (book) => book.location },
  { header: '備註', value: (book) => book.notes },
  { header: 'ISBN', value: (book) => book.isbn },
];

/** Columns wide enough to read without resizing: the title and the summary. */
const WIDE_COLUMNS: Record<number, number> = { 0: 28, 5: 50 };

/** Converts books to rows, preserving every custom spreadsheet column. */
export function booksToRows(books: readonly Book[]): SpreadsheetCell[][] {
  const extraHeaders = [...new Set(books.flatMap((book) => Object.keys(book.extras)))];
  return [
    [...COLUMNS.map((column) => column.header), ...extraHeaders],
    ...books.map((book) => [
      ...COLUMNS.map((column) => column.value(book)),
      ...extraHeaders.map((header) => book.extras[header] ?? ''),
    ]),
  ];
}

export function booksToXlsx(books: readonly Book[]): Uint8Array {
  const rows = booksToRows(books);
  const widths = rows[0]!.map(
    (header, index) => WIDE_COLUMNS[index] ?? Math.max(12, Math.min(24, String(header).length * 2)),
  );
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
