"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  CircleDashed,
  Download,
  LayoutGrid,
  List,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { BookGrid } from "@/components/book-grid";
import { BookList } from "@/components/book-list";
import { EmptyState } from "@/components/empty-state";
import { StatBar } from "@/components/stat-bar";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Book, BookFilter, BookSort } from "@/lib/data/books";
import {
  deleteBooksAction,
  setPurchasedManyAction,
  togglePurchasedAction,
} from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

const FILTER_LABELS: Record<BookFilter, string> = {
  all: "全部",
  purchased: "已購買",
  unpurchased: "未購買",
  needsReview: "待確認",
};

const SORT_LABELS: Record<BookSort, string> = {
  createdAt: "新增時間",
  title: "書名",
  author: "作者",
};

function matchesFilter(book: Book, filter: BookFilter): boolean {
  switch (filter) {
    case "purchased":
      return book.isPurchased;
    case "unpurchased":
      return !book.isPurchased;
    case "needsReview":
      return book.needsReview;
    default:
      return true;
  }
}

function matchesSearch(book: Book, term: string): boolean {
  if (!term) return true;
  const needle = term.toLocaleLowerCase();
  const haystack = [book.title, book.subtitle ?? "", ...book.authors, book.publisher ?? ""];
  return haystack.some((field) => field.toLocaleLowerCase().includes(needle));
}

function compare(a: Book, b: Book, sort: BookSort): number {
  switch (sort) {
    case "title":
      return a.title.localeCompare(b.title, "zh-Hant");
    case "author":
      return (a.authors[0] ?? "").localeCompare(b.authors[0] ?? "", "zh-Hant");
    default:
      return b.createdAt.getTime() - a.createdAt.getTime();
  }
}

/**
 * The library home.
 *
 * The whole library arrives from the server and is filtered in memory, which
 * is what makes search feel instant; the debounce only keeps the list from
 * re-sorting on every keystroke. Purchase toggles are applied optimistically
 * and rolled back if the server rejects them.
 */
export function LibraryView({ initialBooks }: { initialBooks: Book[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<BookFilter>("all");
  const [sort, setSort] = useState<BookSort>("createdAt");
  const [searchInput, setSearchInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [batchPending, startBatch] = useTransition();

  const search = useDebouncedValue(searchInput, 300);

  const stats = useMemo(
    () => ({
      total: books.length,
      purchased: books.filter((book) => book.isPurchased).length,
      unpurchased: books.filter((book) => !book.isPurchased).length,
      needsReview: books.filter((book) => book.needsReview).length,
    }),
    [books],
  );

  const visible = useMemo(
    () =>
      books
        .filter((book) => matchesFilter(book, filter) && matchesSearch(book, search))
        .sort((a, b) => compare(a, b, sort)),
    [books, filter, search, sort],
  );

  const selectedInView = visible.filter((book) => selectedIds.has(book.id));
  const allSelected = visible.length > 0 && selectedInView.length === visible.length;

  function toggleSelected(bookId: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((previous) =>
      allSelected ? new Set() : new Set([...previous, ...visible.map((book) => book.id)]),
    );
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function patchBook(bookId: string, patch: Partial<Book>) {
    setBooks((previous) =>
      previous.map((book) => (book.id === bookId ? { ...book, ...patch } : book)),
    );
  }

  async function togglePurchased(book: Book) {
    const next = !book.isPurchased;

    // Optimistic: flip immediately, restore the previous values on failure.
    patchBook(book.id, { isPurchased: next, purchasedAt: next ? new Date() : null });
    setPendingIds((previous) => new Set(previous).add(book.id));

    try {
      const result = await togglePurchasedAction(book.id, next);
      if (!result.ok) {
        patchBook(book.id, { isPurchased: book.isPurchased, purchasedAt: book.purchasedAt });
        toast.error("更新失敗", { description: result.error });
      }
    } catch {
      patchBook(book.id, { isPurchased: book.isPurchased, purchasedAt: book.purchasedAt });
      toast.error("更新失敗", { description: "連線出了問題，請稍後再試一次。" });
    } finally {
      setPendingIds((previous) => {
        const nextPending = new Set(previous);
        nextPending.delete(book.id);
        return nextPending;
      });
    }
  }

  function batchSetPurchased(isPurchased: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const snapshot = books;

    setBooks((previous) =>
      previous.map((book) =>
        selectedIds.has(book.id)
          ? { ...book, isPurchased, purchasedAt: isPurchased ? new Date() : null }
          : book,
      ),
    );

    startBatch(async () => {
      const result = await setPurchasedManyAction(ids, isPurchased);
      if (!result.ok) {
        setBooks(snapshot);
        toast.error("批次更新失敗", { description: result.error });
        return;
      }
      clearSelection();
      toast.success(`已更新 ${result.data} 本書`);
    });
  }

  function batchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const snapshot = books;

    setBooks((previous) => previous.filter((book) => !selectedIds.has(book.id)));
    setConfirmingDelete(false);

    startBatch(async () => {
      const result = await deleteBooksAction(ids);
      if (!result.ok) {
        setBooks(snapshot);
        toast.error("刪除失敗", { description: result.error });
        return;
      }
      clearSelection();
      toast.success(`已刪除 ${result.data} 本書`);
    });
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (search.trim()) params.set("q", search.trim());
    if (sort !== "createdAt") params.set("sort", sort);
    const query = params.toString();
    return query ? `/api/export?${query}` : "/api/export";
  }, [filter, search, sort]);

  const filtering = filter !== "all" || search.trim().length > 0;

  return (
    <div className="space-y-6">
      <StatBar stats={stats} activeFilter={filter} onSelect={setFilter} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜尋書名或作者"
            aria-label="搜尋書名或作者"
            className="pl-8"
          />
        </div>

        <Select value={filter} onValueChange={(value) => setFilter(value as BookFilter)}>
          <SelectTrigger aria-label="篩選" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(value) => setSort(value as BookSort)}>
          <SelectTrigger aria-label="排序" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                依{label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border p-0.5" role="group" aria-label="檢視方式">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={cn("h-7 px-2", view === "grid" && "bg-accent text-accent-foreground")}
          >
            <LayoutGrid aria-hidden />
            <span className="sr-only sm:not-sr-only">網格</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={cn("h-7 px-2", view === "list" && "bg-accent text-accent-foreground")}
          >
            <List aria-hidden />
            <span className="sr-only sm:not-sr-only">清單</span>
          </Button>
        </div>

        <Button asChild variant="outline" size="sm" className="ml-auto">
          <a href={exportHref} download>
            <Download aria-hidden />
            匯出 CSV
          </a>
        </Button>
      </div>

      {selectedIds.size > 0 ? (
        <div className="bg-accent flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm font-medium">已選取 {selectedIds.size} 本</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={batchPending}
            onClick={() => batchSetPurchased(true)}
          >
            <Check aria-hidden />
            標記已購買
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={batchPending}
            onClick={() => batchSetPurchased(false)}
          >
            <CircleDashed aria-hidden />
            標記未購買
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={batchPending}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden />
            刪除
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
            <X aria-hidden />
            取消選取
          </Button>
        </div>
      ) : null}

      {books.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="書庫還是空的"
          description="對著書架拍一張照片，就能自動辨識書名、補齊書目資料並加進書庫。"
          action={
            <Button asChild>
              <Link href="/scan">開始掃描書架</Link>
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="沒有符合條件的書"
          description={filtering ? "試著換個關鍵字，或把篩選改成「全部」。" : undefined}
          action={
            filtering ? (
              <Button
                variant="outline"
                onClick={() => {
                  setFilter("all");
                  setSearchInput("");
                }}
              >
                清除篩選
              </Button>
            ) : undefined
          }
        />
      ) : view === "grid" ? (
        <BookGrid
          books={visible}
          selectedIds={selectedIds}
          pendingIds={pendingIds}
          onToggleSelected={toggleSelected}
          onTogglePurchased={togglePurchased}
        />
      ) : (
        <BookList
          books={visible}
          selectedIds={selectedIds}
          pendingIds={pendingIds}
          allSelected={allSelected}
          onToggleSelected={toggleSelected}
          onToggleAll={toggleAll}
          onTogglePurchased={togglePurchased}
        />
      )}

      <p className="text-muted-foreground text-xs" data-testid="result-count">
        顯示 {visible.length} / {books.length} 本
      </p>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除 {selectedIds.size} 本書？</AlertDialogTitle>
            <AlertDialogDescription>這些書會從你的書庫永久移除，無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={batchDelete}>確定刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
