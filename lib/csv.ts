/**
 * CSV export.
 *
 * Written to open cleanly in Excel: a UTF-8 byte order mark so Chinese text is
 * not mojibake, CRLF line endings per RFC 4180, and timestamps rendered in
 * Asia/Taipei rather than the worker's UTC.
 */
import type { Book } from "@/db/repositories/books";
import { formatDateTime, formatFileStamp, joinList } from "./format";

/** Excel only detects UTF-8 in a CSV when the file starts with a BOM. */
export const CSV_BOM = "\uFEFF";

export const CSV_LINE_ENDING = "\r\n";

/** Column order is part of the file's contract; do not reorder. */
export const CSV_COLUMNS = [
  "title",
  "subtitle",
  "authors",
  "publisher",
  "publishedDate",
  "isbn13",
  "isbn10",
  "pageCount",
  "categories",
  "language",
  "isPurchased",
  "purchasedAt",
  "notes",
  "source",
  "coverUrl",
  "createdAt",
] as const;

/** A value needs quoting when it holds a delimiter, a quote, or a line break. */
const NEEDS_QUOTING = /[",\r\n]/;

export function escapeCsvValue(value: string): string {
  if (!NEEDS_QUOTING.test(value)) return value;
  // Inside a quoted field, a literal quote is written twice.
  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsvRow(values: readonly string[]): string {
  return values.map(escapeCsvValue).join(",");
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

function number(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/** One row, in CSV_COLUMNS order. */
export function bookToCsvValues(book: Book): string[] {
  return [
    book.title,
    text(book.subtitle),
    joinList(book.authors),
    text(book.publisher),
    text(book.publishedDate),
    text(book.isbn13),
    text(book.isbn10),
    number(book.pageCount),
    joinList(book.categories),
    text(book.language),
    book.isPurchased ? "是" : "否",
    formatDateTime(book.purchasedAt),
    text(book.notes),
    book.source,
    text(book.coverUrl),
    formatDateTime(book.createdAt),
  ];
}

export function csvHeaderLine(): string {
  return toCsvRow(CSV_COLUMNS) + CSV_LINE_ENDING;
}

export function bookToCsvLine(book: Book): string {
  return toCsvRow(bookToCsvValues(book)) + CSV_LINE_ENDING;
}

/** `books-YYYYMMDD-HHmm.csv`, stamped in Taipei time. */
export function buildCsvFilename(now: Date = new Date()): string {
  return `books-${formatFileStamp(now)}.csv`;
}

/**
 * Streams the export instead of building it in memory.
 *
 * The source is an async iterable so the caller can page through D1: a large
 * library is written out page by page and never held in the worker's memory
 * all at once.
 */
export function createCsvStream(books: AsyncIterable<Book>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = books[Symbol.asyncIterator]();
  let headerWritten = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerWritten) {
        headerWritten = true;
        controller.enqueue(encoder.encode(CSV_BOM + csvHeaderLine()));
        return;
      }

      try {
        const { value, done } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(bookToCsvLine(value)));
      } catch (error) {
        controller.error(error);
      }
    },

    async cancel(reason) {
      // The client went away mid-download; stop paging the database.
      await iterator.return?.(reason);
    },
  });
}
