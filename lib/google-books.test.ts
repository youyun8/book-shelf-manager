import { describe, expect, it, vi } from "vitest";

import { buildQuery, lookupBook } from "./google-books";

function volume(info: unknown) {
  return new Response(JSON.stringify({ totalItems: 1, items: [{ volumeInfo: info }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const FULL_VOLUME = {
  title: "人類大歷史",
  subtitle: "從野獸到扮演上帝",
  authors: ["哈拉瑞"],
  publisher: "天下文化",
  publishedDate: "2018-01",
  description: "一部橫跨十萬年的人類簡史。",
  pageCount: 528,
  categories: ["History", "Civilization"],
  language: "zh-TW",
  industryIdentifiers: [
    { type: "ISBN_10", identifier: "9864791427" },
    { type: "ISBN_13", identifier: "978-9864791422" },
  ],
  imageLinks: {
    smallThumbnail: "http://books.google.com/books/content?id=1&zoom=5",
    thumbnail: "http://books.google.com/books/content?id=1&zoom=1",
  },
};

describe("query building", () => {
  it("prefers ISBN when one is available", () => {
    expect(buildQuery({ isbn: "978-986-479-000-1", title: "略過", author: "略過" })).toBe(
      "isbn:9789864790001",
    );
  });

  it("falls back to title and author", () => {
    expect(buildQuery({ title: "人類大歷史", author: "哈拉瑞" })).toBe(
      "intitle:人類大歷史+inauthor:哈拉瑞",
    );
  });

  it("omits the author when there is none", () => {
    expect(buildQuery({ title: "人類大歷史" })).toBe("intitle:人類大歷史");
  });

  it("ignores an ISBN that is the wrong length", () => {
    expect(buildQuery({ isbn: "12345", title: "書名" })).toBe("intitle:書名");
  });

  it("returns null when there is nothing to search on", () => {
    expect(buildQuery({})).toBeNull();
    expect(buildQuery({ title: "   " })).toBeNull();
  });
});

describe("lookup", () => {
  it("maps a volume onto book metadata", async () => {
    const fetchImpl = vi.fn(async () => volume(FULL_VOLUME));

    const result = await lookupBook({ isbn: "9789864791422", fetchImpl: fetchImpl as never });

    expect(result).toEqual({
      title: "人類大歷史",
      subtitle: "從野獸到扮演上帝",
      authors: ["哈拉瑞"],
      publisher: "天下文化",
      publishedDate: "2018-01",
      isbn10: "9864791427",
      isbn13: "9789864791422",
      pageCount: 528,
      categories: ["History", "Civilization"],
      description: "一部橫跨十萬年的人類簡史。",
      language: "zh-TW",
      // http is rewritten so the cover is not blocked on an https page.
      coverUrl: "https://books.google.com/books/content?id=1&zoom=1",
    });
  });

  it("sends the country parameter so datacenter requests are not rejected", async () => {
    const fetchImpl = vi.fn(async () => volume(FULL_VOLUME));
    await lookupBook({ isbn: "9789864791422", fetchImpl: fetchImpl as never });

    const url = (fetchImpl.mock.calls[0] as unknown as [string])[0];
    expect(url).toContain("country=TW");
    expect(url).toContain("maxResults=1");
    expect(url).toContain(encodeURIComponent("isbn:9789864791422"));
  });

  it("falls back to the small thumbnail when there is no large one", async () => {
    const fetchImpl = vi.fn(async () =>
      volume({
        ...FULL_VOLUME,
        imageLinks: { smallThumbnail: "http://books.google.com/small" },
      }),
    );

    const result = await lookupBook({ title: "人類大歷史", fetchImpl: fetchImpl as never });
    expect(result?.coverUrl).toBe("https://books.google.com/small");
  });

  it("fills absent fields with null rather than empty strings", async () => {
    const fetchImpl = vi.fn(async () => volume({ title: "只有書名" }));

    const result = await lookupBook({ title: "只有書名", fetchImpl: fetchImpl as never });
    expect(result).toMatchObject({
      title: "只有書名",
      subtitle: null,
      authors: [],
      publisher: null,
      publishedDate: null,
      isbn10: null,
      isbn13: null,
      pageCount: null,
      categories: [],
      description: null,
      coverUrl: null,
    });
  });

  it("returns null when the search finds nothing", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ totalItems: 0 }), { status: 200 }),
    );

    expect(await lookupBook({ title: "查無此書", fetchImpl: fetchImpl as never })).toBeNull();
  });

  it("returns null on an API error instead of failing the scan", async () => {
    const fetchImpl = vi.fn(async () => new Response("quota exceeded", { status: 429 }));
    expect(await lookupBook({ title: "書名", fetchImpl: fetchImpl as never })).toBeNull();
  });

  it("returns null when the network call throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connection reset");
    });
    expect(await lookupBook({ title: "書名", fetchImpl: fetchImpl as never })).toBeNull();
  });

  it("does not call the API when there is nothing to search on", async () => {
    const fetchImpl = vi.fn();
    expect(await lookupBook({ fetchImpl: fetchImpl as never })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
