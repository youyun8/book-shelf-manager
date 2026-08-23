/**
 * Server-side book access.
 *
 * Every function here is the matching db/repositories/books.ts function with
 * the request's D1 binding already applied, so `userId` stays the first
 * argument and nothing in app/ or components/ ever holds a database handle.
 */
import * as repo from "@/db/repositories/books";
import { getDb } from "@/db/client";

import { bindDb } from "./bind";

export type {
  Book,
  BookFilter,
  BookSort,
  BookStats,
  CreateBookInput,
  ListBooksOptions,
  UpdateBookInput,
} from "@/db/repositories/books";

export const listBooks = bindDb(repo.listBooks);
export const getBook = bindDb(repo.getBook);
export const getBookStats = bindDb(repo.getBookStats);
export const createBook = bindDb(repo.createBook);
export const createBookIfNew = bindDb(repo.createBookIfNew);
export const findBookByIsbn13 = bindDb(repo.findBookByIsbn13);
export const updateBook = bindDb(repo.updateBook);
export const setPurchased = bindDb(repo.setPurchased);
export const setPurchasedMany = bindDb(repo.setPurchasedMany);
export const deleteBook = bindDb(repo.deleteBook);
export const deleteBooks = bindDb(repo.deleteBooks);
export const deleteAllBooks = bindDb(repo.deleteAllBooks);
export const listBooksByScan = bindDb(repo.listBooksByScan);

/**
 * Written out rather than bound, because the repository returns an async
 * generator: wrapping it in an async function would yield a promise of a
 * generator, which `for await` cannot consume.
 */
export async function* iterateBooks(
  userId: string,
  options: repo.ListBooksOptions & { pageSize?: number } = {},
): AsyncGenerator<repo.Book, void, void> {
  yield* repo.iterateBooks(userId, await getDb(), options);
}
