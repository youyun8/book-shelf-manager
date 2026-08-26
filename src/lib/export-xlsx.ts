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
  { header: '分類標籤', value: (book) => book.tags.join('、') },
  { header: '購入管道', value: (book) => book.channel },
  { header: '購入價格', value: (book) => book.price },
  { header: '書況', value: (book) => book.condition },
  { header: '藏書位置', value: (book) => book.location },
  { header: 'ISBN', value: (book) => book.isbn },
];

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
  const widths = rows[0]!.map((header, index) => {
    if (index === 0) return 28;
    if (index === 5) return 50;
    return Math.max(12, Math.min(24, String(header).length * 2));
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
