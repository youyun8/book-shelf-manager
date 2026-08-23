"use client";

import { BookCard } from "@/components/book-card";
import type { Book } from "@/lib/data/books";

export function BookGrid({
  books,
  selectedIds,
  pendingIds,
  onToggleSelected,
  onTogglePurchased,
}: {
  books: Book[];
  selectedIds: Set<string>;
  pendingIds: Set<string>;
  onToggleSelected: (bookId: string) => void;
  onTogglePurchased: (book: Book) => void;
}) {
  return (
    <ul
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="book-grid"
      aria-label="書封網格"
    >
      {books.map((book) => (
        <li key={book.id}>
          <BookCard
            book={book}
            selected={selectedIds.has(book.id)}
            selectionActive={selectedIds.size > 0}
            pending={pendingIds.has(book.id)}
            onToggleSelected={onToggleSelected}
            onTogglePurchased={onTogglePurchased}
          />
        </li>
      ))}
    </ul>
  );
}
