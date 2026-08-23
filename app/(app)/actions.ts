"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/auth/require-user";
import {
  type Book,
  type UpdateBookInput,
  deleteAllBooks,
  deleteBook,
  deleteBooks,
  setPurchased,
  setPurchasedMany,
  updateBook,
} from "@/lib/data/books";
import { deleteAllScans } from "@/lib/data/scans";
import { deleteUserPhotos } from "@/lib/r2";

/**
 * Mutations for the library UI.
 *
 * Each action re-derives the user from the session rather than trusting an id
 * from the client, then goes through lib/data so the query is scoped to that
 * user. A caller passing someone else's book id simply affects zero rows.
 */

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function failure(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

export async function togglePurchasedAction(
  bookId: string,
  isPurchased: boolean,
): Promise<ActionResult<Book>> {
  const userId = await requireUserId();
  const book = await setPurchased(userId, bookId, isPurchased);
  if (!book) return failure("找不到這本書，可能已被刪除。");

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return { ok: true, data: book };
}

export async function setPurchasedManyAction(
  bookIds: string[],
  isPurchased: boolean,
): Promise<ActionResult<number>> {
  const userId = await requireUserId();
  const updated = await setPurchasedMany(userId, bookIds, isPurchased);

  revalidatePath("/");
  return { ok: true, data: updated };
}

export async function updateBookAction(
  bookId: string,
  patch: UpdateBookInput,
): Promise<ActionResult<Book>> {
  const userId = await requireUserId();

  if (patch.title !== undefined && patch.title.trim().length === 0) {
    return failure("書名不能空白。");
  }

  const book = await updateBook(userId, bookId, patch);
  if (!book) return failure("找不到這本書，可能已被刪除。");

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return { ok: true, data: book };
}

export async function deleteBookAction(bookId: string): Promise<ActionResult> {
  const userId = await requireUserId();
  const deleted = await deleteBook(userId, bookId);
  if (!deleted) return failure("找不到這本書，可能已被刪除。");

  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deleteBooksAction(bookIds: string[]): Promise<ActionResult<number>> {
  const userId = await requireUserId();
  const deleted = await deleteBooks(userId, bookIds);

  revalidatePath("/");
  return { ok: true, data: deleted };
}

/** Wipes the caller's library, scan history and uploaded photos. */
export async function deleteEverythingAction(): Promise<ActionResult<number>> {
  const userId = await requireUserId();

  const deletedBooks = await deleteAllBooks(userId);
  await deleteAllScans(userId);
  await deleteUserPhotos(userId);

  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, data: deletedBooks };
}
