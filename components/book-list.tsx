"use client";

import Link from "next/link";
import { Check, CircleDashed, Loader2 } from "lucide-react";

import { BookCover } from "@/components/book-cover";
import { ReviewBadge } from "@/components/purchase-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Book } from "@/lib/data/books";
import { joinList } from "@/lib/format";

export function BookList({
  books,
  selectedIds,
  pendingIds,
  allSelected,
  onToggleSelected,
  onToggleAll,
  onTogglePurchased,
}: {
  books: Book[];
  selectedIds: Set<string>;
  pendingIds: Set<string>;
  allSelected: boolean;
  onToggleSelected: (bookId: string) => void;
  onToggleAll: () => void;
  onTogglePurchased: (book: Book) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="book-list">
      <table className="w-full min-w-[52rem] text-sm">
        <caption className="sr-only">書庫清單</caption>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
            <th scope="col" className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="全選目前結果"
              />
            </th>
            <th scope="col">書名</th>
            <th scope="col">作者</th>
            <th scope="col">出版社</th>
            <th scope="col">ISBN</th>
            <th scope="col" className="w-40">
              狀態
            </th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book.id} className="hover:bg-muted/40 border-t [&>td]:px-3 [&>td]:py-2">
              <td>
                <Checkbox
                  checked={selectedIds.has(book.id)}
                  onCheckedChange={() => onToggleSelected(book.id)}
                  aria-label={`選取《${book.title}》`}
                />
              </td>
              <td>
                <div className="flex items-center gap-3">
                  <BookCover
                    title={book.title}
                    coverUrl={book.coverUrl}
                    className="h-12 w-8 shrink-0 rounded-sm"
                    sizes="2rem"
                  />
                  <div className="min-w-0">
                    <Link href={`/books/${book.id}`} className="font-medium hover:underline">
                      {book.title}
                    </Link>
                    {book.subtitle ? (
                      <p className="text-muted-foreground line-clamp-1 text-xs">{book.subtitle}</p>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="text-muted-foreground">{joinList(book.authors) || "—"}</td>
              <td className="text-muted-foreground">{book.publisher || "—"}</td>
              <td className="text-muted-foreground font-mono text-xs">
                {book.isbn13 || book.isbn10 || "—"}
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={book.isPurchased ? "secondary" : "outline"}
                    size="sm"
                    disabled={pendingIds.has(book.id)}
                    onClick={() => onTogglePurchased(book)}
                    aria-label={
                      book.isPurchased
                        ? `將《${book.title}》標記為未購買`
                        : `將《${book.title}》標記為已購買`
                    }
                    data-testid="toggle-purchase"
                  >
                    {pendingIds.has(book.id) ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : book.isPurchased ? (
                      <Check aria-hidden />
                    ) : (
                      <CircleDashed aria-hidden />
                    )}
                    {book.isPurchased ? "已購買" : "未購買"}
                  </Button>
                  {book.needsReview ? <ReviewBadge /> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
