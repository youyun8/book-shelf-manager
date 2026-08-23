import { notFound } from "next/navigation";

import { requireUserId } from "@/lib/auth/require-user";
import { getBook } from "@/lib/data/books";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const book = await getBook(userId, id);
  if (!book) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{book.title}</h1>
    </main>
  );
}
