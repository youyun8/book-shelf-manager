import { expect, test } from "@playwright/test";

import { SEED, search } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the seeded library with per-user statistics", async ({ page }) => {
    await expect(page.getByTestId("stat-total")).toContainText(String(SEED.counts.total));
    await expect(page.getByTestId("stat-purchased")).toContainText(String(SEED.counts.purchased));
    await expect(page.getByTestId("stat-unpurchased")).toContainText(
      String(SEED.counts.unpurchased),
    );
    await expect(page.getByTestId("stat-needsReview")).toContainText(
      String(SEED.counts.needsReview),
    );

    await expect(page.getByTestId("book-grid").getByRole("listitem")).toHaveCount(
      SEED.counts.total,
    );
  });

  test("switches between the grid and list views", async ({ page }) => {
    await expect(page.getByTestId("book-grid")).toBeVisible();

    await page.getByRole("button", { name: "清單" }).click();
    await expect(page.getByTestId("book-list")).toBeVisible();
    await expect(page.getByTestId("book-grid")).toHaveCount(0);

    // The list is a table with one row per book.
    await expect(page.getByTestId("book-list").locator("tbody tr")).toHaveCount(SEED.counts.total);
    await expect(page.getByRole("columnheader", { name: "出版社" })).toBeVisible();

    await page.getByRole("button", { name: "網格" }).click();
    await expect(page.getByTestId("book-grid")).toBeVisible();
  });

  test("filters by purchase state", async ({ page }) => {
    await page.getByTestId("stat-purchased").click();
    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.purchased} / ${SEED.counts.total} 本`,
    );

    await page.getByTestId("stat-unpurchased").click();
    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.unpurchased} / ${SEED.counts.total} 本`,
    );

    await page.getByTestId("stat-needsReview").click();
    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.needsReview} / ${SEED.counts.total} 本`,
    );

    await page.getByTestId("stat-total").click();
    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.total} / ${SEED.counts.total} 本`,
    );
  });

  test("searches by title as you type", async ({ page }) => {
    await search(page, "藏書 07", 1);
    await expect(page.getByRole("heading", { name: "Alice 的藏書 07" })).toBeVisible();

    await search(page, "不存在的書名", 0);
    await expect(page.getByText("沒有符合條件的書")).toBeVisible();

    await page.getByRole("button", { name: "清除篩選" }).click();
    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.total} / ${SEED.counts.total} 本`,
    );
  });

  test("searches by author too", async ({ page }) => {
    // Seeded authors are "Alice 作者 1".."Alice 作者 6", cycling every 6 books.
    await page.getByLabel("搜尋書名或作者").fill("Alice 作者 1");
    await expect(page.getByTestId("result-count")).not.toHaveText(
      `顯示 ${SEED.counts.total} / ${SEED.counts.total} 本`,
    );
    await expect(page.getByTestId("book-grid").getByRole("listitem").first()).toBeVisible();
  });

  test("toggles purchase state and persists it", async ({ page }) => {
    // Book 02 is unpurchased in the seed (only every third book is purchased).
    await search(page, "藏書 02", 1);

    const toggle = page.getByTestId("toggle-purchase");
    await expect(toggle).toHaveText("標記已購買");

    await toggle.click();
    await expect(toggle).toHaveText("已購買");

    // Reload to confirm the change reached D1 rather than only local state.
    await page.reload();
    await search(page, "藏書 02", 1);
    await expect(page.getByTestId("toggle-purchase")).toHaveText("已購買");
    await expect(page.getByTestId("stat-purchased")).toContainText(
      String(SEED.counts.purchased + 1),
    );

    // Put it back so the suite can be re-run against a warm database.
    await page.getByTestId("toggle-purchase").click();
    await expect(page.getByTestId("toggle-purchase")).toHaveText("標記已購買");
    await expect(page.getByTestId("stat-purchased")).toContainText(String(SEED.counts.purchased));
  });

  test("marks a batch of selected books as purchased", async ({ page }) => {
    await page.getByTestId("stat-unpurchased").click();

    const checkboxes = page.getByTestId("book-grid").getByRole("checkbox");
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();

    await expect(page.getByText("已選取 2 本")).toBeVisible();
    await page.getByRole("button", { name: "標記已購買" }).click();

    await expect(page.getByTestId("stat-purchased")).toContainText(
      String(SEED.counts.purchased + 2),
    );

    // Restore: flip the two most recent purchases back.
    await page.getByTestId("stat-purchased").click();
    const purchased = page.getByTestId("book-grid").getByRole("checkbox");
    await purchased.nth(0).click();
    await purchased.nth(1).click();
    await page.getByRole("button", { name: "標記未購買" }).click();
    await expect(page.getByTestId("stat-purchased")).toContainText(String(SEED.counts.purchased));
  });

  test("opens a book's detail page", async ({ page }) => {
    await search(page, "藏書 05", 1);
    await page.getByRole("heading", { name: "Alice 的藏書 05" }).click();

    await expect(page.getByRole("heading", { name: "Alice 的藏書 05", level: 1 })).toBeVisible();
    await expect(page.locator("dt", { hasText: "出版社" })).toBeVisible();
    await expect(page.locator("dt", { hasText: "作者" })).toBeVisible();
    await expect(page.locator("dt", { hasText: "ISBN-13" })).toBeVisible();
    await expect(page.getByLabel("我的備註")).toBeVisible();
    await expect(page.getByRole("button", { name: "標記為已購買" })).toBeVisible();
  });
});
