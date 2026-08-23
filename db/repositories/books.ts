import { and, asc, count, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { SQL, SQLWrapper } from "drizzle-orm";

import type { Database } from "@/db/client";
import { type BookRow, type BookSource, books } from "@/db/schema";

/**
 * Book data access.
 *
 * D1 has no row level security, so isolation is enforced here and nowhere else:
 * every exported function takes `userId` as its first parameter and every
 * statement -- select, update and delete alike -- is scoped by it. Nothing
 * outside this file may touch the `books` table.
 * `scripts/check-isolation.ts` fails the build if that rule is broken.
 */

/** A book as the rest of the app sees it: JSON columns already decoded. */
export type Book = Omit<BookRow, "authors" | "categories"> & {
  authors: string[];
  categories: string[];
};

export type BookFilter = "all" | "purchased" | "unpurchased" | "needsReview";
export type BookSort = "createdAt" | "title" | "author";

export type ListBooksOptions = {
  filter?: BookFilter;
  search?: string;
  sort?: BookSort;
  limit?: number;
  offset?: number;
};

export type BookStats = {
  total: number;
  purchased: number;
  unpurchased: number;
  needsReview: number;
};

export type CreateBookInput = {
  title: string;
  subtitle?: string | null;
  authors?: string[];
  publisher?: string | null;
  publishedDate?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  pageCount?: number | null;
  categories?: string[];
  description?: string | null;
  language?: string | null;
  coverUrl?: string | null;
  isPurchased?: boolean;
  purchasedAt?: Date | null;
  notes?: string | null;
  source?: BookSource;
  confidence?: number | null;
  needsReview?: boolean;
  scanId?: string | null;
};

export type UpdateBookInput = Partial<CreateBookInput>;

/**
 * Drizzle types a `text({ mode: "json" })` column as `string[]`, but a row
 * written by another client (or by a raw SQL seed) can still hold anything, so
 * decode defensively rather than trusting the type.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    } catch {
      // Not JSON: treat the whole string as a single entry.
      return [value];
    }
  }
  return [];
}

function toBook(row: BookRow): Book {
  return {
    ...row,
    authors: toStringArray(row.authors),
    categories: toStringArray(row.categories),
  };
}

/**
 * Builds a case-preserving "contains" match.
 *
 * `%` and `_` typed by the user are wildcards to SQLite, so they are escaped
 * and an explicit ESCAPE clause is attached -- drizzle's `like()` helper does
 * not emit one, which would silently turn a search for "100%" into "match
 * anything".
 */
function contains(column: SQLWrapper, term: string): SQL {
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`${column} like ${pattern} escape '\\'`;
}

function filterCondition(userId: string, filter: BookFilter) {
  const scope = eq(books.userId, userId);
  switch (filter) {
    case "purchased":
      return and(scope, eq(books.isPurchased, true));
    case "unpurchased":
      return and(scope, eq(books.isPurchased, false));
    case "needsReview":
      return and(scope, eq(books.needsReview, true));
    default:
      return scope;
  }
}

function searchCondition(search: string | undefined) {
  const term = search?.trim();
  if (!term) return undefined;
  return or(
    contains(books.title, term),
    contains(books.subtitle, term),
    // authors is a JSON array; matching its raw text is enough for a contains search.
    contains(sql`cast(${books.authors} as text)`, term),
    contains(books.publisher, term),
  );
}

function orderBy(sort: BookSort) {
  switch (sort) {
    case "title":
      return [asc(books.title), desc(books.createdAt)];
    case "author":
      return [asc(sql`cast(${books.authors} as text)`), asc(books.title)];
    default:
      return [desc(books.createdAt), asc(books.title)];
  }
}

export async function listBooks(
  userId: string,
  db: Database,
  options: ListBooksOptions = {},
): Promise<Book[]> {
  const { filter = "all", search, sort = "createdAt", limit, offset } = options;

  let query = db
    .select()
    .from(books)
    .where(and(filterCondition(userId, filter), searchCondition(search)))
    .orderBy(...orderBy(sort))
    .$dynamic();

  if (limit !== undefined) query = query.limit(limit);
  if (offset !== undefined) query = query.offset(offset);

  const rows = await query;
  return rows.map(toBook);
}

export async function getBook(userId: string, db: Database, bookId: string): Promise<Book | null> {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .limit(1);
  return rows[0] ? toBook(rows[0]) : null;
}

export async function getBookStats(userId: string, db: Database): Promise<BookStats> {
  const rows = await db
    .select({
      total: count(),
      purchased: sql<number>`sum(case when ${books.isPurchased} then 1 else 0 end)`,
      needsReview: sql<number>`sum(case when ${books.needsReview} then 1 else 0 end)`,
    })
    .from(books)
    .where(eq(books.userId, userId));

  const total = Number(rows[0]?.total ?? 0);
  const purchased = Number(rows[0]?.purchased ?? 0);
  const needsReview = Number(rows[0]?.needsReview ?? 0);
  return { total, purchased, unpurchased: total - purchased, needsReview };
}

export async function createBook(
  userId: string,
  db: Database,
  input: CreateBookInput,
): Promise<Book> {
  const rows = await db
    .insert(books)
    .values({
      id: crypto.randomUUID(),
      userId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      authors: input.authors ?? [],
      publisher: input.publisher ?? null,
      publishedDate: input.publishedDate ?? null,
      isbn10: input.isbn10 ?? null,
      isbn13: input.isbn13 ?? null,
      pageCount: input.pageCount ?? null,
      categories: input.categories ?? [],
      description: input.description ?? null,
      language: input.language ?? null,
      coverUrl: input.coverUrl ?? null,
      isPurchased: input.isPurchased ?? false,
      purchasedAt: input.purchasedAt ?? null,
      notes: input.notes ?? null,
      source: input.source ?? "vision",
      confidence: input.confidence ?? null,
      needsReview: input.needsReview ?? false,
      scanId: input.scanId ?? null,
    })
    .returning();

  return toBook(rows[0]);
}

/**
 * Inserts a book unless the same user already has one with that ISBN-13.
 * Returns the existing row in that case so scan results stay idempotent.
 */
export async function createBookIfNew(
  userId: string,
  db: Database,
  input: CreateBookInput,
): Promise<{ book: Book; created: boolean }> {
  if (input.isbn13) {
    const existing = await findBookByIsbn13(userId, db, input.isbn13);
    if (existing) return { book: existing, created: false };
  }
  return { book: await createBook(userId, db, input), created: true };
}

export async function findBookByIsbn13(
  userId: string,
  db: Database,
  isbn13: string,
): Promise<Book | null> {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.isbn13, isbn13), isNotNull(books.isbn13)))
    .limit(1);
  return rows[0] ? toBook(rows[0]) : null;
}

export async function updateBook(
  userId: string,
  db: Database,
  bookId: string,
  input: UpdateBookInput,
): Promise<Book | null> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return getBook(userId, db, bookId);

  const rows = await db
    .update(books)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .returning();

  return rows[0] ? toBook(rows[0]) : null;
}

/** Flips the purchase flag and keeps `purchasedAt` consistent with it. */
export async function setPurchased(
  userId: string,
  db: Database,
  bookId: string,
  isPurchased: boolean,
): Promise<Book | null> {
  const rows = await db
    .update(books)
    .set({
      isPurchased,
      purchasedAt: isPurchased ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .returning();

  return rows[0] ? toBook(rows[0]) : null;
}

export async function setPurchasedMany(
  userId: string,
  db: Database,
  bookIds: string[],
  isPurchased: boolean,
): Promise<number> {
  if (bookIds.length === 0) return 0;
  const rows = await db
    .update(books)
    .set({
      isPurchased,
      purchasedAt: isPurchased ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(books.userId, userId), inArray(books.id, bookIds)))
    .returning({ id: books.id });
  return rows.length;
}

export async function deleteBook(userId: string, db: Database, bookId: string): Promise<boolean> {
  const rows = await db
    .delete(books)
    .where(and(eq(books.userId, userId), eq(books.id, bookId)))
    .returning({ id: books.id });
  return rows.length > 0;
}

export async function deleteBooks(
  userId: string,
  db: Database,
  bookIds: string[],
): Promise<number> {
  if (bookIds.length === 0) return 0;
  const rows = await db
    .delete(books)
    .where(and(eq(books.userId, userId), inArray(books.id, bookIds)))
    .returning({ id: books.id });
  return rows.length;
}

export async function deleteAllBooks(userId: string, db: Database): Promise<number> {
  const rows = await db.delete(books).where(eq(books.userId, userId)).returning({ id: books.id });
  return rows.length;
}

export async function listBooksByScan(
  userId: string,
  db: Database,
  scanId: string,
): Promise<Book[]> {
  const rows = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.scanId, scanId)))
    .orderBy(asc(books.createdAt), asc(books.title));
  return rows.map(toBook);
}

/**
 * Streams the whole library in id-ordered pages so the CSV export never holds
 * more than one page in memory.
 */
export async function* iterateBooks(
  userId: string,
  db: Database,
  options: ListBooksOptions & { pageSize?: number } = {},
): AsyncGenerator<Book, void, void> {
  const pageSize = options.pageSize ?? 200;
  let offset = 0;

  for (;;) {
    const page = await listBooks(userId, db, { ...options, limit: pageSize, offset });
    for (const book of page) yield book;
    if (page.length < pageSize) return;
    offset += pageSize;
  }
}
