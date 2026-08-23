import { beforeEach, describe, expect, it } from "vitest";

import { createTestUser, resetDatabase, testDb } from "@/tests/factories";
import {
  createBook,
  createBookIfNew,
  deleteAllBooks,
  deleteBook,
  deleteBooks,
  getBook,
  getBookStats,
  iterateBooks,
  listBooks,
  setPurchased,
  setPurchasedMany,
  updateBook,
} from "./books";

const db = () => testDb();

let userA: string;
let userB: string;

beforeEach(async () => {
  await resetDatabase();
  userA = await createTestUser("alice");
  userB = await createTestUser("bob");
});

describe("cross-user isolation", () => {
  it("never returns another user's books from a list", async () => {
    await createBook(userA, db(), { title: "A 的書" });
    await createBook(userB, db(), { title: "B 的書" });

    const forA = await listBooks(userA, db());
    const forB = await listBooks(userB, db());

    expect(forA.map((b) => b.title)).toEqual(["A 的書"]);
    expect(forB.map((b) => b.title)).toEqual(["B 的書"]);
  });

  it("cannot read another user's book by id", async () => {
    const bookOfB = await createBook(userB, db(), { title: "B 的秘密" });

    expect(await getBook(userA, db(), bookOfB.id)).toBeNull();
    expect(await getBook(userB, db(), bookOfB.id)).not.toBeNull();
  });

  it("cannot update another user's book", async () => {
    const bookOfB = await createBook(userB, db(), { title: "原標題" });

    const result = await updateBook(userA, db(), bookOfB.id, { title: "被竄改" });

    expect(result).toBeNull();
    expect((await getBook(userB, db(), bookOfB.id))?.title).toBe("原標題");
  });

  it("cannot toggle purchase state on another user's book", async () => {
    const bookOfB = await createBook(userB, db(), { title: "B 的書", isPurchased: false });

    expect(await setPurchased(userA, db(), bookOfB.id, true)).toBeNull();
    expect((await getBook(userB, db(), bookOfB.id))?.isPurchased).toBe(false);
  });

  it("cannot delete another user's book", async () => {
    const bookOfB = await createBook(userB, db(), { title: "B 的書" });

    expect(await deleteBook(userA, db(), bookOfB.id)).toBe(false);
    expect(await getBook(userB, db(), bookOfB.id)).not.toBeNull();
  });

  it("ignores another user's ids in batch operations", async () => {
    const ownA = await createBook(userA, db(), { title: "A 的書" });
    const ownB = await createBook(userB, db(), { title: "B 的書" });

    const updated = await setPurchasedMany(userA, db(), [ownA.id, ownB.id], true);
    expect(updated).toBe(1);
    expect((await getBook(userB, db(), ownB.id))?.isPurchased).toBe(false);

    const deleted = await deleteBooks(userA, db(), [ownA.id, ownB.id]);
    expect(deleted).toBe(1);
    expect(await getBook(userB, db(), ownB.id)).not.toBeNull();
  });

  it("deleteAllBooks only clears the calling user's library", async () => {
    await createBook(userA, db(), { title: "A1" });
    await createBook(userA, db(), { title: "A2" });
    await createBook(userB, db(), { title: "B1" });

    expect(await deleteAllBooks(userA, db())).toBe(2);
    expect(await listBooks(userA, db())).toHaveLength(0);
    expect(await listBooks(userB, db())).toHaveLength(1);
  });

  it("counts statistics per user only", async () => {
    await createBook(userA, db(), { title: "A1", isPurchased: true });
    await createBook(userA, db(), { title: "A2", needsReview: true });
    await createBook(userB, db(), { title: "B1", isPurchased: true });
    await createBook(userB, db(), { title: "B2", isPurchased: true });

    expect(await getBookStats(userA, db())).toEqual({
      total: 2,
      purchased: 1,
      unpurchased: 1,
      needsReview: 1,
    });
    expect(await getBookStats(userB, db())).toEqual({
      total: 2,
      purchased: 2,
      unpurchased: 0,
      needsReview: 0,
    });
  });

  it("scopes search to the calling user", async () => {
    await createBook(userA, db(), { title: "深度學習", authors: ["李四"] });
    await createBook(userB, db(), { title: "深度學習", authors: ["李四"] });

    expect(await listBooks(userA, db(), { search: "深度" })).toHaveLength(1);
  });

  it("lets two users hold the same ISBN independently", async () => {
    await createBook(userA, db(), { title: "同一本書", isbn13: "9781234567897" });
    const forB = await createBook(userB, db(), { title: "同一本書", isbn13: "9781234567897" });

    expect(forB.id).toBeTruthy();
    expect(await listBooks(userA, db())).toHaveLength(1);
    expect(await listBooks(userB, db())).toHaveLength(1);
  });
});

describe("json columns", () => {
  it("round-trips authors and categories as arrays", async () => {
    const created = await createBook(userA, db(), {
      title: "測試",
      authors: ["王小明", "陳大文"],
      categories: ["電腦", "程式設計"],
    });

    expect(created.authors).toEqual(["王小明", "陳大文"]);
    const fetched = await getBook(userA, db(), created.id);
    expect(fetched?.authors).toEqual(["王小明", "陳大文"]);
    expect(fetched?.categories).toEqual(["電腦", "程式設計"]);
  });

  it("defaults missing arrays to empty rather than null", async () => {
    const created = await createBook(userA, db(), { title: "無作者" });
    expect(created.authors).toEqual([]);
    expect(created.categories).toEqual([]);
  });
});

describe("purchase state", () => {
  it("stamps purchasedAt when marking purchased and clears it when unmarking", async () => {
    const book = await createBook(userA, db(), { title: "書" });
    expect(book.purchasedAt).toBeNull();

    const purchased = await setPurchased(userA, db(), book.id, true);
    expect(purchased?.isPurchased).toBe(true);
    expect(purchased?.purchasedAt).toBeInstanceOf(Date);

    const reverted = await setPurchased(userA, db(), book.id, false);
    expect(reverted?.isPurchased).toBe(false);
    expect(reverted?.purchasedAt).toBeNull();
  });
});

describe("filtering, search and sorting", () => {
  beforeEach(async () => {
    await createBook(userA, db(), { title: "B 書", authors: ["張三"], isPurchased: true });
    await createBook(userA, db(), { title: "A 書", authors: ["李四"], needsReview: true });
    await createBook(userA, db(), { title: "C 書", authors: ["王五"], publisher: "遠流" });
  });

  it("filters by purchase state and review flag", async () => {
    expect(await listBooks(userA, db(), { filter: "purchased" })).toHaveLength(1);
    expect(await listBooks(userA, db(), { filter: "unpurchased" })).toHaveLength(2);
    expect(await listBooks(userA, db(), { filter: "needsReview" })).toHaveLength(1);
    expect(await listBooks(userA, db(), { filter: "all" })).toHaveLength(3);
  });

  it("searches title, author and publisher", async () => {
    expect((await listBooks(userA, db(), { search: "A 書" }))[0]?.title).toBe("A 書");
    expect((await listBooks(userA, db(), { search: "李四" }))[0]?.title).toBe("A 書");
    expect((await listBooks(userA, db(), { search: "遠流" }))[0]?.title).toBe("C 書");
  });

  it("treats LIKE wildcards in the search term as literal characters", async () => {
    await createBook(userA, db(), { title: "100% 純愛" });

    expect(await listBooks(userA, db(), { search: "%" })).toHaveLength(1);
    expect(await listBooks(userA, db(), { search: "_" })).toHaveLength(0);
  });

  it("sorts by title", async () => {
    const sorted = await listBooks(userA, db(), { sort: "title" });
    expect(sorted.map((b) => b.title)).toEqual(["A 書", "B 書", "C 書"]);
  });

  it("sorts newest first by default", async () => {
    const sorted = await listBooks(userA, db());
    expect(sorted).toHaveLength(3);
    expect(sorted[0].createdAt.getTime()).toBeGreaterThanOrEqual(sorted[2].createdAt.getTime());
  });
});

describe("createBookIfNew", () => {
  it("does not duplicate a book the user already has by ISBN-13", async () => {
    const first = await createBookIfNew(userA, db(), {
      title: "重複的書",
      isbn13: "9789861234567",
    });
    const second = await createBookIfNew(userA, db(), {
      title: "重複的書",
      isbn13: "9789861234567",
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.book.id).toBe(first.book.id);
    expect(await listBooks(userA, db())).toHaveLength(1);
  });

  it("still inserts books that have no ISBN", async () => {
    await createBookIfNew(userA, db(), { title: "無 ISBN" });
    await createBookIfNew(userA, db(), { title: "無 ISBN" });
    expect(await listBooks(userA, db())).toHaveLength(2);
  });
});

describe("iterateBooks", () => {
  it("pages through the whole library and stays scoped to one user", async () => {
    for (let i = 0; i < 25; i += 1) {
      await createBook(userA, db(), { title: `A-${i}` });
    }
    await createBook(userB, db(), { title: "B 的書" });

    const seen: string[] = [];
    for await (const book of iterateBooks(userA, db(), { pageSize: 10 })) {
      seen.push(book.title);
    }

    expect(seen).toHaveLength(25);
    expect(seen).not.toContain("B 的書");
  });
});
