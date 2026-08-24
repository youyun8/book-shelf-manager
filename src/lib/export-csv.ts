import type { Book } from '../types';

const COLUMNS: { header: string; value: (book: Book) => string }[] = [
  { header: '書名', value: (book) => book.title },
  { header: '作者', value: (book) => book.author },
  { header: '繪者', value: (book) => book.illustrator },
  { header: '譯者', value: (book) => book.translator },
  { header: '出版社', value: (book) => book.publisher },
  { header: '內容簡介', value: (book) => book.summary },
  { header: '適讀年齡', value: (book) => book.ageRange },
  { header: '分類標籤', value: (book) => book.tags.join('、') },
  { header: '購入管道', value: (book) => book.channel },
  { header: '購入價格', value: (book) => (book.price === null ? '' : String(book.price)) },
  { header: '書況', value: (book) => book.condition },
  { header: '藏書位置', value: (book) => book.location },
];

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function booksToCsv(books: readonly Book[]): string {
  const lines = [COLUMNS.map((column) => escapeCell(column.header)).join(',')];
  for (const book of books) {
    lines.push(COLUMNS.map((column) => escapeCell(column.value(book))).join(','));
  }
  return lines.join('\r\n');
}

/** Downloads the current result set. The BOM keeps Excel on Chinese encodings. */
export function downloadCsv(books: readonly Book[], fileName = 'books.csv'): void {
  const blob = new Blob([`\uFEFF${booksToCsv(books)}`], {
    type: 'text/csv;charset=utf-8;',
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
