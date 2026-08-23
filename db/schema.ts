import { desc, relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

/** Lifecycle of one uploaded photo as it moves through recognition. */
export const SCAN_STATUSES = ["pending", "processing", "done", "failed"] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** How a book row came to exist. */
export const BOOK_SOURCES = ["vision", "manual", "isbn"] as const;
export type BookSource = (typeof BOOK_SOURCES)[number];

/**
 * One uploaded shelf photo and the outcome of recognising it.
 *
 * `rawResult` keeps the model's unparsed reply so a bad response can be
 * inspected after the fact instead of being lost.
 */
export const scans = sqliteTable(
  "scans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    status: text("status").$type<ScanStatus>().notNull().default("pending"),
    detectedCount: integer("detected_count").notNull().default(0),
    rawResult: text("raw_result"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("scans_user_created_idx").on(table.userId, desc(table.createdAt))],
);

/**
 * A book in someone's library.
 *
 * SQLite has no array type, so `authors` and `categories` are stored as JSON
 * text. Only db/repositories/books.ts is allowed to see that representation --
 * it hands the rest of the app plain `string[]`.
 */
export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    authors: text("authors", { mode: "json" }).$type<string[]>(),
    publisher: text("publisher"),
    // Google Books returns "2011", "2011-05" and "2011-05-03" interchangeably.
    publishedDate: text("published_date"),
    isbn10: text("isbn10"),
    isbn13: text("isbn13"),
    pageCount: integer("page_count"),
    categories: text("categories", { mode: "json" }).$type<string[]>(),
    description: text("description"),
    language: text("language"),
    coverUrl: text("cover_url"),
    isPurchased: integer("is_purchased", { mode: "boolean" }).notNull().default(false),
    purchasedAt: integer("purchased_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    source: text("source").$type<BookSource>().notNull().default("vision"),
    /** Model self-assessed confidence in title + authors, 0-1. */
    confidence: real("confidence"),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
    scanId: text("scan_id").references(() => scans.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Partial: books without an ISBN must not collide with each other.
    uniqueIndex("books_user_isbn13_unique")
      .on(table.userId, table.isbn13)
      .where(sql`${table.isbn13} is not null`),
    index("books_user_created_idx").on(table.userId, desc(table.createdAt)),
    index("books_user_purchased_idx").on(table.userId, table.isPurchased),
    index("books_user_title_idx").on(table.userId, table.title),
    index("books_scan_idx").on(table.scanId),
  ],
);

export const scansRelations = relations(scans, ({ one, many }) => ({
  user: one(user, { fields: [scans.userId], references: [user.id] }),
  books: many(books),
}));

export const booksRelations = relations(books, ({ one }) => ({
  user: one(user, { fields: [books.userId], references: [user.id] }),
  scan: one(scans, { fields: [books.scanId], references: [scans.id] }),
}));

export type BookRow = typeof books.$inferSelect;
export type NewBookRow = typeof books.$inferInsert;
export type ScanRow = typeof scans.$inferSelect;
export type NewScanRow = typeof scans.$inferInsert;
