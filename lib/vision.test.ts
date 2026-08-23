import { describe, expect, it, vi } from "vitest";

import { VisionError, recognizeBooks } from "./vision";

const IMAGE = new TextEncoder().encode("fake-jpeg-bytes").buffer as ArrayBuffer;

function geminiResponse(books: unknown, finishReason = "STOP") {
  return JSON.stringify({
    candidates: [
      {
        finishReason,
        content: { parts: [{ text: JSON.stringify({ books }) }] },
      },
    ],
  });
}

function ok(body: string) {
  return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
}

/**
 * Deliberately not an `async` wrapper: the pre-flight checks reject before the
 * first await, and an extra promise hop makes workerd report the inner
 * rejection as unhandled before the test's handler attaches.
 */
function recognize(fetchImpl: typeof fetch, overrides = {}) {
  return recognizeBooks({
    apiKey: "test-key",
    image: IMAGE,
    mediaType: "image/jpeg",
    fetchImpl,
    retryDelayMs: 0,
    ...overrides,
  });
}

describe("request shape", () => {
  it("sends the image inline and requests structured JSON output", async () => {
    const fetchImpl = vi.fn(async () => ok(geminiResponse([])));
    await recognize(fetchImpl as unknown as typeof fetch);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
    );

    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("test-key");

    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.properties.books.type).toBe("array");
    expect(body.systemInstruction.parts[0].text).toContain("MANY books");

    const [image, text] = body.contents[0].parts;
    expect(image.inlineData.mimeType).toBe("image/jpeg");
    expect(typeof image.inlineData.data).toBe("string");
    expect(text.text).toBe("Identify every book in this photo.");
  });

  it("tells the model not to invent fields", async () => {
    const fetchImpl = vi.fn(async () => ok(geminiResponse([])));
    await recognize(fetchImpl as unknown as typeof fetch);

    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.systemInstruction.parts[0].text).toContain("spines");
    expect(body.systemInstruction.parts[0].text).toContain("null");
    expect(body.systemInstruction.parts[0].text).toContain("never invent");
  });
});

describe("parsing", () => {
  it("returns every recognised book", async () => {
    const fetchImpl = vi.fn(async () =>
      ok(
        geminiResponse([
          {
            title: "深度學習",
            authors: ["Ian Goodfellow", "Yoshua Bengio"],
            publisher: "碁峰",
            isbn: "978-986-476-000-1",
            confidence: 0.92,
          },
          {
            title: "人類大歷史",
            authors: ["哈拉瑞"],
            publisher: null,
            isbn: null,
            confidence: 0.4,
          },
        ]),
      ),
    );

    const { books } = await recognize(fetchImpl as unknown as typeof fetch);

    expect(books).toHaveLength(2);
    expect(books[0]).toEqual({
      title: "深度學習",
      authors: ["Ian Goodfellow", "Yoshua Bengio"],
      publisher: "碁峰",
      isbn: "9789864760001",
      confidence: 0.92,
    });
    expect(books[1].publisher).toBeNull();
    expect(books[1].isbn).toBeNull();
  });

  it("drops entries with no readable title rather than inventing one", async () => {
    const fetchImpl = vi.fn(async () =>
      ok(
        geminiResponse([
          { title: "", authors: [], publisher: null, isbn: null, confidence: 0.9 },
          { title: "   ", authors: [], publisher: null, isbn: null, confidence: 0.9 },
          { title: "真書", authors: [], publisher: null, isbn: null, confidence: 0.9 },
        ]),
      ),
    );

    const { books } = await recognize(fetchImpl as unknown as typeof fetch);
    expect(books.map((b) => b.title)).toEqual(["真書"]);
  });

  it("clamps a confidence outside 0-1 and defaults a missing one", async () => {
    const fetchImpl = vi.fn(async () =>
      ok(
        geminiResponse([
          { title: "A", authors: [], publisher: null, isbn: null, confidence: 5 },
          { title: "B", authors: [], publisher: null, isbn: null, confidence: -2 },
          { title: "C", authors: [], publisher: null, isbn: null },
        ]),
      ),
    );

    const { books } = await recognize(fetchImpl as unknown as typeof fetch);
    expect(books.map((b) => b.confidence)).toEqual([1, 0, 0]);
  });

  it("accepts an empty shelf", async () => {
    const fetchImpl = vi.fn(async () => ok(geminiResponse([])));
    const { books } = await recognize(fetchImpl as unknown as typeof fetch);
    expect(books).toEqual([]);
  });
});

describe("error paths", () => {
  it("rejects an unsupported image type before spending a request", async () => {
    const fetchImpl = vi.fn();
    await expect(() =>
      recognize(fetchImpl as unknown as typeof fetch, { mediaType: "image/heic" }),
    ).rejects.toMatchObject({ code: "unsupported_media_type" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before spending a request", async () => {
    const fetchImpl = vi.fn();
    await expect(() =>
      recognize(fetchImpl as unknown as typeof fetch, {
        image: new ArrayBuffer(6 * 1024 * 1024),
      }),
    ).rejects.toMatchObject({ code: "image_too_large" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports a missing API key", async () => {
    await expect(() =>
      recognize(vi.fn() as unknown as typeof fetch, { apiKey: undefined }),
    ).rejects.toMatchObject({ code: "missing_api_key" });
  });

  it("keeps the raw body when the reply is not valid JSON", async () => {
    const fetchImpl = vi.fn(async () => ok("<html>gateway error</html>"));

    const error = await recognize(fetchImpl as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(VisionError);
    expect(error.code).toBe("invalid_response");
    expect(error.rawResult).toBe("<html>gateway error</html>");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the raw body when Gemini answers without structured data", async () => {
    const raw = JSON.stringify({
      candidates: [{ content: { parts: [{ text: "I cannot see any books." }] } }],
    });
    const fetchImpl = vi.fn(async () => ok(raw));

    const error = await recognize(fetchImpl as unknown as typeof fetch).catch((e) => e);
    expect(error.code).toBe("invalid_response");
    expect(error.rawResult).toBe(raw);
  });

  it("treats a safety block as an invalid response", async () => {
    const fetchImpl = vi.fn(async () =>
      ok(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" }, candidates: [] })),
    );
    await expect(recognize(fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("retries twice on a server error, then gives up", async () => {
    const fetchImpl = vi.fn(async () => new Response("upstream boom", { status: 503 }));

    await expect(recognize(fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: "api_error",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("succeeds when a retry works", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(ok(geminiResponse([{ title: "撐過去了" }])));

    const { books } = await recognize(fetchImpl as unknown as typeof fetch);
    expect(books).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a client error", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad request", { status: 400 }));

    await expect(recognize(fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: "api_error",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a network failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(ok(geminiResponse([])));

    await expect(recognize(fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({
      books: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
