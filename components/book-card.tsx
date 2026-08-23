"use client";

import Link from "next/link";
import { Check, CircleDashed, Loader2 } from "lucide-react";

import { BookCover } from "@/components/book-cover";
import { PurchaseBadge, ReviewBadge } from "@/components/purchase-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Book } from "@/lib/data/books";
import { formatAuthors } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BookCard({
  book,
  selected,
  selectionActive,
  pending,
  onToggleSelected,
  onTogglePurchased,
}: {
  book: Book;
  selected: boolean;
  selectionActive: boolean;
  pending: boolean;
  onToggleSelected: (bookId: string) => void;
  onTogglePurchased: (book: Book) => void;
}) {
  const toggleLabel = book.isPurchased
    ? `將《${book.title}》標記為未購買`
    : `將《${book.title}》標記為已購買`;

  return (
    <div
      className={cn(
        "group bg-card relative flex flex-col overflow-hidden rounded-lg border transition-shadow hover:shadow-md",
        selected && "ring-primary ring-2",
      )}
    >
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelected(book.id)}
          aria-label={`選取《${book.title}》`}
          className={cn(
            "bg-background/90 shadow-sm backdrop-blur",
            !selectionActive && !selected && "opacity-0 group-hover:opacity-100 focus:opacity-100",
          )}
        />
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
        {book.isPurchased ? <PurchaseBadge isPurchased /> : null}
        {book.needsReview ? <ReviewBadge /> : null}
      </div>

      <Link href={`/books/${book.id}`} className="block">
        <BookCover
          title={book.title}
          coverUrl={book.coverUrl}
          className="aspect-2/3 w-full"
          sizes="(min-width: 1024px) 12rem, (min-width: 640px) 25vw, 45vw"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link href={`/books/${book.id}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">{book.title}</h3>
        </Link>
        <p className="text-muted-foreground line-clamp-1 text-xs">{formatAuthors(book.authors)}</p>

        <Button
          type="button"
          variant={book.isPurchased ? "secondary" : "outline"}
          size="sm"
          className="mt-2 w-full"
          disabled={pending}
          onClick={() => onTogglePurchased(book)}
          aria-label={toggleLabel}
          data-testid="toggle-purchase"
        >
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : book.isPurchased ? (
            <Check aria-hidden />
          ) : (
            <CircleDashed aria-hidden />
          )}
          {book.isPurchased ? "已購買" : "標記已購買"}
        </Button>
      </div>
    </div>
  );
}
