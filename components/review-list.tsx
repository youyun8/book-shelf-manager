"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BookCover } from "@/components/book-cover";
import { ReviewBadge } from "@/components/purchase-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteBooksAction, updateBookAction } from "@/app/(app)/actions";
import type { Book } from "@/lib/data/books";
import { cn } from "@/lib/utils";

type Draft = {
  keep: boolean;
  title: string;
  authors: string;
  publisher: string;
  isbn13: string;
  isPurchased: boolean;
};

function toDraft(book: Book): Draft {
  return {
    keep: true,
    title: book.title,
    authors: book.authors.join("、"),
    publisher: book.publisher ?? "",
    isbn13: book.isbn13 ?? "",
    isPurchased: book.isPurchased,
  };
}

function splitAuthors(value: string): string[] {
  return value
    .split(/[、,;]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function changed(book: Book, draft: Draft): boolean {
  return (
    draft.title !== book.title ||
    draft.authors !== book.authors.join("、") ||
    draft.publisher !== (book.publisher ?? "") ||
    draft.isbn13 !== (book.isbn13 ?? "") ||
    draft.isPurchased !== book.isPurchased
  );
}

/**
 * Confirmation step after a scan.
 *
 * The books are already in the database -- writing them first is what lets the
 * worker finish and the browser poll for a result -- so this screen edits and
 * deletes existing rows rather than creating them.
 */
export function ReviewList({
  scanId,
  books,
  onDone,
}: {
  scanId: string;
  books: Book[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(books.map((book) => [book.id, toDraft(book)])),
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function patch(bookId: string, update: Partial<Draft>) {
    setDrafts((previous) => ({ ...previous, [bookId]: { ...previous[bookId], ...update } }));
  }

  const keptCount = books.filter((book) => drafts[book.id]?.keep).length;

  function confirm() {
    startTransition(async () => {
      const removed = books.filter((book) => !drafts[book.id]?.keep).map((book) => book.id);
      const edited = books.filter(
        (book) => drafts[book.id]?.keep && changed(book, drafts[book.id]),
      );

      const failures: string[] = [];

      for (const book of edited) {
        const draft = drafts[book.id];
        const result = await updateBookAction(book.id, {
          title: draft.title.trim(),
          authors: splitAuthors(draft.authors),
          publisher: draft.publisher.trim() || null,
          isbn13: draft.isbn13.trim() || null,
          isPurchased: draft.isPurchased,
          purchasedAt: draft.isPurchased ? new Date() : null,
          // The user has now looked at it, whatever the model thought.
          needsReview: false,
        });
        if (!result.ok) failures.push(`《${book.title}》${result.error}`);
      }

      if (removed.length > 0) {
        const result = await deleteBooksAction(removed);
        if (!result.ok) failures.push(result.error);
      }

      if (failures.length > 0) {
        toast.error("部分項目儲存失敗", { description: failures[0] });
        return;
      }

      setSaved(true);
      toast.success(`已加入 ${keptCount} 本書`, {
        description: removed.length > 0 ? `並移除 ${removed.length} 本。` : undefined,
      });
      router.refresh();
    });
  }

  if (saved) {
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Check className="size-5 text-emerald-600" aria-hidden />
          <p className="text-sm font-medium">這次掃描已確認完成。</p>
          <div className="ml-auto flex gap-2">
            <Button asChild size="sm">
              <Link href="/">回到書庫</Link>
            </Button>
            {onDone ? (
              <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                繼續掃描
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby={`review-${scanId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`review-${scanId}`} className="text-lg font-semibold">
          確認辨識結果
        </h2>
        <span className="text-muted-foreground text-sm">
          共 {books.length} 本，將保留 {keptCount} 本
        </span>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        標示「待確認」的書代表辨識信心較低或查不到書目資料，請檢查書名與作者是否正確。
        取消勾選的書會在確認時從書庫移除。
      </p>

      <ul className="space-y-3">
        {books.map((book) => {
          const draft = drafts[book.id];
          if (!draft) return null;

          return (
            <li key={book.id}>
              <Card className={cn("py-4", !draft.keep && "opacity-55")}>
                <CardContent className="flex gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <Checkbox
                      checked={draft.keep}
                      onCheckedChange={(checked) => patch(book.id, { keep: checked === true })}
                      aria-label={`保留《${book.title}》`}
                    />
                    <BookCover
                      title={book.title}
                      coverUrl={book.coverUrl}
                      className="h-20 w-14 shrink-0 rounded-sm"
                      sizes="3.5rem"
                    />
                  </div>

                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`title-${book.id}`}>書名</Label>
                        {book.needsReview ? <ReviewBadge /> : null}
                        {book.confidence !== null ? (
                          <span className="text-muted-foreground text-xs">
                            信心 {Math.round(book.confidence * 100)}%
                          </span>
                        ) : null}
                      </div>
                      <Input
                        id={`title-${book.id}`}
                        value={draft.title}
                        disabled={!draft.keep}
                        onChange={(event) => patch(book.id, { title: event.target.value })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`authors-${book.id}`}>作者</Label>
                      <Input
                        id={`authors-${book.id}`}
                        value={draft.authors}
                        placeholder="以「、」分隔"
                        disabled={!draft.keep}
                        onChange={(event) => patch(book.id, { authors: event.target.value })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`publisher-${book.id}`}>出版社</Label>
                      <Input
                        id={`publisher-${book.id}`}
                        value={draft.publisher}
                        disabled={!draft.keep}
                        onChange={(event) => patch(book.id, { publisher: event.target.value })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`isbn-${book.id}`}>ISBN-13</Label>
                      <Input
                        id={`isbn-${book.id}`}
                        value={draft.isbn13}
                        inputMode="numeric"
                        disabled={!draft.keep}
                        onChange={(event) => patch(book.id, { isbn13: event.target.value })}
                      />
                    </div>

                    <div className="flex items-end">
                      <Label className="gap-2">
                        <Checkbox
                          checked={draft.isPurchased}
                          disabled={!draft.keep}
                          onCheckedChange={(checked) =>
                            patch(book.id, { isPurchased: checked === true })
                          }
                        />
                        已經買了
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={confirm} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          確認並加入書庫
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            setDrafts((previous) =>
              Object.fromEntries(
                Object.entries(previous).map(([id, draft]) => [id, { ...draft, keep: false }]),
              ),
            )
          }
        >
          <Trash2 aria-hidden />
          全部不要
        </Button>
      </div>
    </section>
  );
}
