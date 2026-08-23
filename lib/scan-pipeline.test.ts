import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pipeline runs against the real local D1 and R2 that miniflare provides;
 * only the two outbound HTTP services are faked. `getDb` and `getPhoto`
 * normally resolve their binding through the OpenNext request context, which
 * does not exist outside a worker request, so they are pointed at the test
 * bindings directly.
 */
vi.mock("@/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/client")>();
  const { env: testEnv } = await import("cloudflare:test");
  return { ...actual, getDb: async () => actual.createDb(testEnv.DB) };
});

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  const { env: testEnv } = await import("cloudflare:test");
  return { ...actual, getPhoto: async (key: string) => testEnv.PHOTOS.get(key) };
});

const { createTestUser, resetDatabase, testDb } = await import("@/tests/factories");
const { listBooks } = await import("@/db/repositories/books");
const { createScan, getScan } = await import("@/db/repositories/scans");
const { processScan } = await import("@/lib/scan-pipeline");

const PHOTO_BYTES = new TextEncoder().encode("pretend-this-is-a-jpeg");

let userId: string;
let otherUserId: string;
let scanId: string;
let r2Key: string;

async function seedScan(): Promise<void> {
  scanId = crypto.randomUUID();
  r2Key = `${userId}/${scanId}.jpg`;
  await env.PHOTOS.put(r2Key, PHOTO_BYTES, {
    httpMetadata: { contentType: "image/jpeg" },
  });
  await createScan(userId, testDb(), { id: scanId, r2Key });
}

beforeEach(async () => {
  await resetDatabase();
  userId = await createTestUser("alice");
  otherUserId = await createTestUser("bob");
  await seedScan();
});

function anthropicResponse(books: unknown) {
  return new Response(
    JSON.stringify({
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "toolu_1", name: "record_books", input: { books } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function googleBooksResponse(info: unknown) {
  return new Response(
    JSON.stringify({ totalItems: info ? 1 : 0, items: info ? [{ volumeInfo: info }] : [] }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

/** Routes the pipeline's outbound calls to canned replies. */
function fakeFetch(handlers: {
  anthropic?: () => Response | Promise<Response>;
  googleBooks?: (url: string) => Response | Promise<Response>;
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("https://api.anthropic.com")) {
      return handlers.anthropic?.() ?? anthropicResponse([]);
    }
    if (url.startsWith("https://www.googleapis.com")) {
      return handlers.googleBooks?.(url) ?? googleBooksResponse(null);
    }
    throw new Error(`unexpected fetch to ${url}`);
  }) as unknown as typeof fetch;
}

const DETECTED = [
  {
    title: "人類大歷史",
    authors: ["哈拉瑞"],
    publisher: "天下文化",
    isbn: "9789864791422",
    confidence: 0.95,
  },
  { title: "模糊的書背", authors: [], publisher: null, isbn: null, confidence: 0.35 },
];

const VOLUME = {
  title: "人類大歷史",
  subtitle: "從野獸到扮演上帝",
  authors: ["哈拉瑞"],
  publisher: "天下文化",
  publishedDate: "2018-01",
  pageCount: 528,
  categories: ["History"],
  description: "簡介。",
  language: "zh-TW",
  industryIdentifiers: [
    { type: "ISBN_10", identifier: "9864791427" },
    { type: "ISBN_13", identifier: "9789864791422" },
  ],
  imageLinks: { thumbnail: "http://books.google.com/cover.jpg" },
};

describe("the happy path", () => {
  it("recognises books, enriches them and records the scan as done", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () => anthropicResponse(DETECTED),
      googleBooks: (url) =>
        url.includes(encodeURIComponent("isbn:9789864791422"))
          ? googleBooksResponse(VOLUME)
          : googleBooksResponse(null),
    });

    const result = await processScan({ userId, scanId, apiKey: "test-key", fetchImpl });

    expect(result).toEqual({ status: "done", detectedCount: 2 });

    const scan = await getScan(userId, testDb(), scanId);
    expect(scan?.status).toBe("done");
    expect(scan?.detectedCount).toBe(2);
    expect(scan?.errorMessage).toBeNull();
    // The unparsed reply is kept so a bad response can be inspected later.
    expect(scan?.rawResult).toContain("record_books");

    const books = await listBooks(userId, testDb());
    expect(books).toHaveLength(2);

    const enriched = books.find((b) => b.title === "人類大歷史");
    expect(enriched).toMatchObject({
      subtitle: "從野獸到扮演上帝",
      authors: ["哈拉瑞"],
      publisher: "天下文化",
      publishedDate: "2018-01",
      isbn13: "9789864791422",
      isbn10: "9864791427",
      pageCount: 528,
      language: "zh-TW",
      coverUrl: "https://books.google.com/cover.jpg",
      source: "vision",
      needsReview: false,
      isPurchased: false,
    });
    expect(enriched?.scanId).toBe(scanId);
    expect(enriched?.categories).toEqual(["History"]);
  });

  it("flags a low-confidence reading for review even when the lookup succeeds", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () =>
        anthropicResponse([
          { title: "看不太清楚", authors: ["某人"], publisher: null, isbn: null, confidence: 0.4 },
        ]),
      googleBooks: () => googleBooksResponse({ title: "看不太清楚", authors: ["某人"] }),
    });

    await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    const [book] = await listBooks(userId, testDb());
    expect(book.confidence).toBeCloseTo(0.4);
    expect(book.needsReview).toBe(true);
  });

  it("flags a book for review when Google Books has nothing, keeping what was read", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () =>
        anthropicResponse([
          {
            title: "冷門書",
            authors: ["作者"],
            publisher: "小出版社",
            isbn: null,
            confidence: 0.95,
          },
        ]),
      googleBooks: () => googleBooksResponse(null),
    });

    await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    const [book] = await listBooks(userId, testDb());
    expect(book).toMatchObject({
      title: "冷門書",
      authors: ["作者"],
      publisher: "小出版社",
      coverUrl: null,
      needsReview: true,
    });
  });

  it("records an empty shelf as a successful scan with nothing found", async () => {
    const fetchImpl = fakeFetch({ anthropic: () => anthropicResponse([]) });

    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(result).toEqual({ status: "done", detectedCount: 0 });
    expect((await getScan(userId, testDb(), scanId))?.status).toBe("done");
    expect(await listBooks(userId, testDb())).toHaveLength(0);
  });

  it("does not add a book the user already owns", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () => anthropicResponse([DETECTED[0]]),
      googleBooks: () => googleBooksResponse(VOLUME),
    });

    await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    // A second photo of the same shelf.
    await seedScan();
    const second = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(second.detectedCount).toBe(0);
    expect(await listBooks(userId, testDb())).toHaveLength(1);
  });
});

describe("error paths", () => {
  it("marks the scan failed with a readable message when the API keeps erroring", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () => new Response("upstream is down", { status: 503 }),
    });

    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(result.status).toBe("failed");
    const scan = await getScan(userId, testDb(), scanId);
    expect(scan?.status).toBe("failed");
    expect(scan?.errorMessage).toBe("辨識服務暫時無法使用，請稍後再試一次。");
    expect(await listBooks(userId, testDb())).toHaveLength(0);
  });

  it("stores the raw reply when the model does not return valid JSON", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () =>
        new Response("<html>502 Bad Gateway</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    });

    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(result.status).toBe("failed");
    const scan = await getScan(userId, testDb(), scanId);
    expect(scan?.errorMessage).toBe("辨識服務回傳了無法解析的內容，請再試一次。");
    expect(scan?.rawResult).toBe("<html>502 Bad Gateway</html>");
  });

  it("reports a missing API key instead of failing silently", async () => {
    const fetchImpl = fakeFetch({});

    const result = await processScan({ userId, scanId, apiKey: undefined, fetchImpl });

    expect(result.status).toBe("failed");
    expect((await getScan(userId, testDb(), scanId))?.errorMessage).toBe(
      "伺服器尚未設定辨識服務的金鑰，請聯絡管理員。",
    );
  });

  it("fails cleanly when the photo is gone from R2", async () => {
    await env.PHOTOS.delete(r2Key);
    const fetchImpl = fakeFetch({});

    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(result.status).toBe("failed");
    expect((await getScan(userId, testDb(), scanId))?.status).toBe("failed");
  });

  it("keeps the books when only the metadata lookup fails", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () => anthropicResponse([DETECTED[0]]),
      googleBooks: () => {
        throw new Error("connection reset");
      },
    });

    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(result.status).toBe("done");
    const [book] = await listBooks(userId, testDb());
    expect(book.title).toBe("人類大歷史");
    expect(book.needsReview).toBe(true);
  });

  it("clears a previous error when the scan is retried", async () => {
    const failing = fakeFetch({ anthropic: () => new Response("boom", { status: 500 }) });
    await processScan({ userId, scanId, apiKey: "k", fetchImpl: failing });
    expect((await getScan(userId, testDb(), scanId))?.status).toBe("failed");

    const succeeding = fakeFetch({
      anthropic: () => anthropicResponse([DETECTED[0]]),
      googleBooks: () => googleBooksResponse(VOLUME),
    });
    const result = await processScan({ userId, scanId, apiKey: "k", fetchImpl: succeeding });

    expect(result).toEqual({ status: "done", detectedCount: 1 });
    const scan = await getScan(userId, testDb(), scanId);
    expect(scan?.status).toBe("done");
    expect(scan?.errorMessage).toBeNull();
  });
});

describe("isolation", () => {
  it("refuses to process another user's scan", async () => {
    const fetchImpl = fakeFetch({ anthropic: () => anthropicResponse(DETECTED) });

    const result = await processScan({ userId: otherUserId, scanId, apiKey: "k", fetchImpl });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("找不到這次掃描。");
    // The real owner's scan is untouched and no books were written anywhere.
    expect((await getScan(userId, testDb(), scanId))?.status).toBe("pending");
    expect(await listBooks(otherUserId, testDb())).toHaveLength(0);
    expect(await listBooks(userId, testDb())).toHaveLength(0);
  });

  it("writes the books to the scan's owner only", async () => {
    const fetchImpl = fakeFetch({
      anthropic: () => anthropicResponse([DETECTED[0]]),
      googleBooks: () => googleBooksResponse(VOLUME),
    });

    await processScan({ userId, scanId, apiKey: "k", fetchImpl });

    expect(await listBooks(userId, testDb())).toHaveLength(1);
    expect(await listBooks(otherUserId, testDb())).toHaveLength(0);
  });
});
