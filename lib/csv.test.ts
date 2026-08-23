import { describe, expect, it } from "vitest";

import type { Book } from "@/db/repositories/books";
import {
  CSV_BOM,
  CSV_COLUMNS,
  bookToCsvValues,
  buildCsvFilename,
  createCsvStream,
  escapeCsvValue,
  toCsvRow,
} from "./csv";

/**
 * A deliberately strict RFC 4180 reader, written independently of the writer.
 * Asserting against a parser rather than against an expected string is what
 * actually proves the escaping is correct.
 */
function parseCsv(input: string): string[][] {
  const text = input.startsWith(CSV_BOM) ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: "b1",
    userId: "u1",
    title: "書名",
    subtitle: null,
    authors: [],
    publisher: null,
    publishedDate: null,
    isbn10: null,
    isbn13: null,
    pageCount: null,
    categories: [],
    description: null,
    language: null,
    coverUrl: null,
    isPurchased: false,
    purchasedAt: null,
    notes: null,
    source: "vision",
    confidence: null,
    needsReview: false,
    scanId: null,
    createdAt: new Date("2024-03-05T01:30:00Z"),
    updatedAt: new Date("2024-03-05T01:30:00Z"),
    ...overrides,
  };
}

async function collectBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** `ignoreBOM` keeps the BOM in the string; the default decoder swallows it. */
async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await collectBytes(stream));
}

async function* iterate(books: Book[]): AsyncGenerator<Book> {
  for (const item of books) yield item;
}

describe("escaping", () => {
  it("leaves an ordinary value alone", () => {
    expect(escapeCsvValue("人類大歷史")).toBe("人類大歷史");
    expect(escapeCsvValue("")).toBe("");
  });

  it("quotes a value containing a comma", () => {
    expect(escapeCsvValue("哈拉瑞, 尤瓦爾")).toBe('"哈拉瑞, 尤瓦爾"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvValue('他說「"讚"」')).toBe('"他說「""讚""」"');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsvValue("第一行\n第二行")).toBe('"第一行\n第二行"');
    expect(escapeCsvValue("第一行\r\n第二行")).toBe('"第一行\r\n第二行"');
  });

  it("joins a row with commas", () => {
    expect(toCsvRow(["a", "b,c", 'd"e'])).toBe('a,"b,c","d""e"');
  });
});

describe("row values", () => {
  it("emits the columns in the documented order", () => {
    expect(CSV_COLUMNS).toEqual([
      "title",
      "subtitle",
      "authors",
      "publisher",
      "publishedDate",
      "isbn13",
      "isbn10",
      "pageCount",
      "categories",
      "language",
      "isPurchased",
      "purchasedAt",
      "notes",
      "source",
      "coverUrl",
      "createdAt",
    ]);
    expect(bookToCsvValues(book())).toHaveLength(CSV_COLUMNS.length);
  });

  it("joins authors and categories with a semicolon and space", () => {
    const values = bookToCsvValues(
      book({ authors: ["哈拉瑞", "林俊宏"], categories: ["歷史", "人文"] }),
    );
    expect(values[2]).toBe("哈拉瑞; 林俊宏");
    expect(values[8]).toBe("歷史; 人文");
  });

  it("writes the purchase flag as 是 / 否", () => {
    expect(bookToCsvValues(book({ isPurchased: true }))[10]).toBe("是");
    expect(bookToCsvValues(book({ isPurchased: false }))[10]).toBe("否");
  });

  it("renders timestamps in Asia/Taipei", () => {
    const values = bookToCsvValues(
      book({
        createdAt: new Date("2024-03-05T01:30:00Z"),
        purchasedAt: new Date("2024-12-31T16:05:00Z"),
      }),
    );
    expect(values[15]).toBe("2024-03-05 09:30");
    expect(values[11]).toBe("2025-01-01 00:05");
  });

  it("writes empty strings for missing values, never 'null'", () => {
    const values = bookToCsvValues(book());
    expect(values.filter((v) => v.toLowerCase().includes("null"))).toEqual([]);
    expect(values[1]).toBe("");
    expect(values[7]).toBe("");
    expect(values[11]).toBe("");
  });
});

describe("the exported file", () => {
  it("starts with a UTF-8 BOM so Excel shows Chinese correctly", async () => {
    const bytes = await collectBytes(createCsvStream(iterate([book()])));
    // The bytes are the contract Excel actually reads: EF BB BF.
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = await collect(createCsvStream(iterate([book()])));
    expect(text.startsWith(CSV_BOM)).toBe(true);
    expect(text.codePointAt(0)).toBe(0xfeff);
  });

  it("round-trips values containing commas, quotes, newlines and Chinese", async () => {
    const nasty = book({
      title: '這本書, 有"引號"',
      subtitle: "第一行\n第二行",
      authors: ["哈拉瑞, Ph.D.", '林"譯者"俊宏'],
      publisher: "天下\r\n文化",
      notes: '筆記：他說 "買了", 但還沒看\n第二行',
      isPurchased: true,
      categories: ["歷史, 文明"],
    });

    const parsed = parseCsv(await collect(createCsvStream(iterate([nasty]))));

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual([...CSV_COLUMNS]);

    const [title, subtitle, authors, publisher] = parsed[1];
    expect(title).toBe('這本書, 有"引號"');
    expect(subtitle).toBe("第一行\n第二行");
    expect(authors).toBe('哈拉瑞, Ph.D.; 林"譯者"俊宏');
    expect(publisher).toBe("天下\r\n文化");
    expect(parsed[1][10]).toBe("是");
    expect(parsed[1][12]).toBe('筆記：他說 "買了", 但還沒看\n第二行');
    expect(parsed[1][8]).toBe("歷史, 文明");
  });

  it("writes a header even when the library is empty", async () => {
    const parsed = parseCsv(await collect(createCsvStream(iterate([]))));
    expect(parsed).toEqual([[...CSV_COLUMNS]]);
  });

  it("uses CRLF line endings", async () => {
    const text = await collect(createCsvStream(iterate([book(), book()])));
    expect(text.split("\r\n")).toHaveLength(4); // header + 2 rows + trailing empty
    expect(text.includes("\n\r")).toBe(false);
  });

  it("streams 1000 books without loading them all at once", async () => {
    const books = Array.from({ length: 1000 }, (_, index) =>
      book({
        id: `b${index}`,
        title: `第 ${index} 本, 書`,
        authors: [`作者${index}`],
        isPurchased: index % 2 === 0,
      }),
    );

    let pulled = 0;
    async function* counted(): AsyncGenerator<Book> {
      for (const item of books) {
        pulled += 1;
        yield item;
      }
    }

    const stream = createCsvStream(counted());
    const reader = stream.getReader();

    // The header arrives before the source has been asked for anything.
    await reader.read();
    expect(pulled).toBe(0);

    reader.releaseLock();
    const parsed = parseCsv(await collect(stream));

    expect(pulled).toBe(1000);
    expect(parsed).toHaveLength(1000); // 1000 rows; the header was already consumed
    expect(parsed[0][0]).toBe("第 0 本, 書");
    expect(parsed[999][0]).toBe("第 999 本, 書");
    expect(parsed[999][10]).toBe("否");
  });

  it("stops paging the database when the download is cancelled", async () => {
    let closed = false;
    async function* endless(): AsyncGenerator<Book> {
      try {
        for (let i = 0; ; i += 1) yield book({ id: `b${i}` });
      } finally {
        closed = true;
      }
    }

    const reader = createCsvStream(endless()).getReader();
    await reader.read(); // header
    await reader.read(); // first row
    await reader.cancel("user navigated away");

    expect(closed).toBe(true);
  });

  it("surfaces a database error instead of truncating the file silently", async () => {
    async function* failing(): AsyncGenerator<Book> {
      yield book();
      throw new Error("D1 went away");
    }

    const reader = createCsvStream(failing()).getReader();
    await reader.read(); // header
    await reader.read(); // first row
    await expect(() => reader.read()).rejects.toThrow("D1 went away");
  });
});

describe("filename", () => {
  it("stamps the Taipei date and time", () => {
    expect(buildCsvFilename(new Date("2024-03-05T01:30:00Z"))).toBe("books-20240305-0930.csv");
    expect(buildCsvFilename(new Date("2024-12-31T16:05:00Z"))).toBe("books-20250101-0005.csv");
  });
});
