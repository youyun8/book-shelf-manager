import { Suspense } from "react";

import { BookGridSkeleton } from "@/components/book-grid-skeleton";
import { LibraryView } from "@/components/library-view";
import { requireUserId } from "@/lib/auth/require-user";
import { listBooks } from "@/lib/data/books";

/**
 * The whole library is loaded once and filtered in the browser: a personal
 * shelf is small enough that this makes search and sorting instant, and it
 * avoids a round trip per keystroke.
 */
async function Library() {
  const userId = await requireUserId();
  const books = await listBooks(userId);

  return <LibraryView initialBooks={books} />;
}

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="sr-only">我的書庫</h1>
      <Suspense fallback={<BookGridSkeleton />}>
        <Library />
      </Suspense>
    </main>
  );
}
