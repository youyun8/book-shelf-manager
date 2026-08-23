"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleDashed, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BookCover } from "@/components/book-cover";
import { PurchaseBadge, ReviewBadge } from "@/components/purchase-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { deleteBookAction, togglePurchasedAction, updateBookAction } from "@/app/(app)/actions";
import type { Book } from "@/lib/data/books";
import { formatDateTime, joinList } from "@/lib/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

export function BookDetail({ book: initialBook }: { book: Book }) {
  const router = useRouter();
  const [book, setBook] = useState(initialBook);
  const [notes, setNotes] = useState(initialBook.notes ?? "");
  const [togglePending, startToggle] = useTransition();
  const [savePending, startSave] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const notesDirty = notes !== (book.notes ?? "");

  function togglePurchased() {
    const next = !book.isPurchased;
    const previous = book;

    setBook({ ...book, isPurchased: next, purchasedAt: next ? new Date() : null });

    startToggle(async () => {
      const result = await togglePurchasedAction(book.id, next);
      if (!result.ok) {
        setBook(previous);
        toast.error("更新失敗", { description: result.error });
      }
    });
  }

  function saveNotes() {
    startSave(async () => {
      const result = await updateBookAction(book.id, { notes: notes.trim() || null });
      if (!result.ok) {
        toast.error("儲存失敗", { description: result.error });
        return;
      }
      setBook(result.data);
      setNotes(result.data.notes ?? "");
      toast.success("備註已儲存");
    });
  }

  function remove() {
    setConfirmingDelete(false);
    startDelete(async () => {
      const result = await deleteBookAction(book.id);
      if (!result.ok) {
        toast.error("刪除失敗", { description: result.error });
        return;
      }
      toast.success("已刪除這本書");
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/">
          <ArrowLeft aria-hidden />
          回到書庫
        </Link>
      </Button>

      <div className="grid gap-6 sm:grid-cols-[14rem_1fr]">
        <BookCover
          title={book.title}
          coverUrl={book.coverUrl}
          className="aspect-2/3 w-full rounded-lg border sm:w-56"
          sizes="14rem"
        />

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PurchaseBadge isPurchased={book.isPurchased} />
              {book.needsReview ? <ReviewBadge /> : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{book.title}</h1>
            {book.subtitle ? (
              <p className="text-muted-foreground text-pretty">{book.subtitle}</p>
            ) : null}
          </div>

          <Button type="button" onClick={togglePurchased} disabled={togglePending}>
            {togglePending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : book.isPurchased ? (
              <CircleDashed aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
            {book.isPurchased ? "改為未購買" : "標記為已購買"}
          </Button>

          <Separator />

          <dl className="divide-y">
            <Field label="作者" value={joinList(book.authors)} />
            <Field label="出版社" value={book.publisher} />
            <Field label="出版日期" value={book.publishedDate} />
            <Field label="ISBN-13" value={book.isbn13} />
            <Field label="ISBN-10" value={book.isbn10} />
            <Field label="頁數" value={book.pageCount} />
            <Field label="分類" value={joinList(book.categories)} />
            <Field label="語言" value={book.language} />
            <Field
              label="購買時間"
              value={book.purchasedAt ? formatDateTime(book.purchasedAt) : null}
            />
            <Field label="加入時間" value={formatDateTime(book.createdAt)} />
            <Field
              label="辨識信心"
              value={book.confidence === null ? null : `${Math.round(book.confidence * 100)}%`}
            />
          </dl>
        </div>
      </div>

      {book.description ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">簡介</h2>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty whitespace-pre-line">
            {book.description}
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <Label htmlFor="notes">我的備註</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="想在哪買、為什麼想讀、借給了誰……"
          rows={4}
        />
        <Button type="button" size="sm" onClick={saveNotes} disabled={!notesDirty || savePending}>
          {savePending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          儲存備註
        </Button>
      </section>

      <Separator />

      <section className="space-y-2">
        <h2 className="text-sm font-medium">危險操作</h2>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setConfirmingDelete(true)}
          disabled={deletePending}
        >
          {deletePending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          刪除這本書
        </Button>
      </section>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除《{book.title}》？</AlertDialogTitle>
            <AlertDialogDescription>這本書會從你的書庫永久移除，無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>確定刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
