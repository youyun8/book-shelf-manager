import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookDetail } from "@/components/book-detail";
import { requireUserId } from "@/lib/auth/require-user";
import { getBook } from "@/lib/data/books";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const userId = await requireUserId();
  const { id } = await params;
  const book = await getBook(userId, id);
  return { title: book?.title ?? "找不到書籍" };
}

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;

  // getBook is scoped to userId, so another user's book is indistinguishable
  // from one that does not exist.
  const book = await getBook(userId, id);
  if (!book) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <BookDetail book={book} />
    </main>
  );
}
