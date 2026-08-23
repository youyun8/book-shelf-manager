import { expect, test } from "@playwright/test";

import { SEED, STORAGE_STATE, search } from "./helpers";

/**
 * The application-level substitute for row level security, checked from the
 * outside: whatever the repository layer promises, one signed-in account must
 * not be able to reach another's data through the running app.
 */
test.describe("user isolation", () => {
  test("one account never sees another account's books", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.total} / ${SEED.counts.total} 本`,
    );
    await expect(page.getByText("Bob 的藏書", { exact: false })).toHaveCount(0);

    await search(page, "Bob", 0);
    await expect(page.getByText("沒有符合條件的書")).toBeVisible();
  });

  test("a book id belonging to another account is not found", async ({ page }) => {
    // Alice's own book renders.
    const own = await page.goto(`/books/${SEED.alice.bookPrefix}000`);
    expect(own?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Alice 的藏書 01", level: 1 })).toBeVisible();

    // Bob's does not, even though the row exists.
    const other = await page.goto(`/books/${SEED.bob.bookPrefix}000`);
    expect(other?.status()).toBe(404);
    await expect(page.getByText("Bob 的藏書 01")).toHaveCount(0);
  });

  test("each account sees only its own shelf", async ({ page, browser }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Alice 的藏書 01" })).toBeVisible();
    await expect(page.getByText("Bob 的藏書", { exact: false })).toHaveCount(0);

    const bobContext = await browser.newContext({ storageState: STORAGE_STATE.bob });
    const bobPage = await bobContext.newPage();
    await bobPage.goto("/");

    await expect(bobPage.getByRole("heading", { name: "Bob 的藏書 01" })).toBeVisible();
    await expect(bobPage.getByText("Alice 的藏書", { exact: false })).toHaveCount(0);
    await expect(bobPage.getByTestId("result-count")).toHaveText(
      `顯示 ${SEED.counts.total} / ${SEED.counts.total} 本`,
    );

    await bobContext.close();
  });

  test("an anonymous visitor is sent to the login page", async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await anonymous.newPage();

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "使用 Google 登入" })).toBeVisible();

    // A resource route answers 404 rather than revealing that the id exists.
    const photo = await page.request.get("/api/photo/seed-scan-000");
    expect(photo.status()).toBe(404);

    await anonymous.close();
  });
});
