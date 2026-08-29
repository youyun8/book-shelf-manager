import type { Book } from '../types';

/**
 * Most titles in the shared list appear more than once, one row per physical
 * copy, and what tells them apart is usually the 狀態. Two cards that look the
 * same read as a mistake unless the page says otherwise, so the list counts how
 * many copies each title has and the book views say so.
 *
 * Titles are compared trimmed but otherwise as written: the sheet is the record
 * of what is on the shelf, and quietly folding together titles that differ by a
 * character would hide a copy rather than explain it.
 */
export function countCopiesByTitle(books: readonly Book[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const book of books) {
    const key = book.title.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function copyCount(counts: Map<string, number>, book: Book): number {
  return counts.get(book.title.trim()) ?? 1;
}

/** The other copies of the same title, in the order the list holds them. */
export function otherCopies(books: readonly Book[], book: Book): Book[] {
  const key = book.title.trim();
  return books.filter((item) => item.id !== book.id && item.title.trim() === key);
}
