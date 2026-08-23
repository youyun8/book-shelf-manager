import { expect, test } from "@playwright/test";

import { SEED } from "./helpers";

const COLUMNS = [
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
];

/** RFC 4180 reader, so the assertions test the file rather than a string shape. */
function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
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
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

test.describe("CSV export", () => {
  test("streams the whole library with a BOM and the documented columns", async ({ page }) => {
    const response = await page.request.get("/api/export");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toMatch(
      /attachment; filename="books-\d{8}-\d{4}\.csv"/,
    );

    const bytes = await response.body();
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const rows = parseCsv(bytes.toString("utf8"));
    expect(rows[0]).toEqual(COLUMNS);
    expect(rows).toHaveLength(SEED.counts.total + 1);

    const purchased = rows.slice(1).filter((row) => row[COLUMNS.indexOf("isPurchased")] === "是");
    expect(purchased).toHaveLength(SEED.counts.purchased);

    // Timestamps are Taipei-local, not UTC.
    for (const row of rows.slice(1)) {
      expect(row[COLUMNS.indexOf("createdAt")]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    }
  });

  test("exports only the current filter when asked to", async ({ page }) => {
    const response = await page.request.get("/api/export?filter=purchased");
    const rows = parseCsv((await response.body()).toString("utf8"));

    expect(rows).toHaveLength(SEED.counts.purchased + 1);
    for (const row of rows.slice(1)) {
      expect(row[COLUMNS.indexOf("isPurchased")]).toBe("是");
    }
  });

  test("honours a search term", async ({ page }) => {
    const response = await page.request.get(`/api/export?q=${encodeURIComponent("藏書 07")}`);
    const rows = parseCsv((await response.body()).toString("utf8"));

    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("Alice 的藏書 07");
  });

  test("never includes another account's books", async ({ page }) => {
    const rows = parseCsv((await (await page.request.get("/api/export")).body()).toString("utf8"));
    const titles = rows.slice(1).map((row) => row[0]);

    expect(titles.every((title) => title.startsWith("Alice"))).toBe(true);
    expect(titles.some((title) => title.startsWith("Bob"))).toBe(false);
  });

  test("refuses an anonymous request", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const response = await anonymous.request.get("http://localhost:8787/api/export");

    expect(response.status()).toBe(401);
    await anonymous.close();
  });

  test("downloads from the library toolbar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "匯出 CSV" }).click();

    const download = page.waitForEvent("download");
    await page.getByTestId("export-all").click();

    expect((await download).suggestedFilename()).toMatch(/^books-\d{8}-\d{4}\.csv$/);
  });

  test("downloads from the settings page", async ({ page }) => {
    await page.goto("/settings");

    const download = page.waitForEvent("download");
    await page.getByTestId("settings-export").click();

    expect((await download).suggestedFilename()).toMatch(/^books-\d{8}-\d{4}\.csv$/);
  });
});
