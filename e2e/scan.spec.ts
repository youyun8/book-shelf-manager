import { expect, test } from "@playwright/test";

/** A 1x1 PNG: small, and something every browser can decode. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("scan", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/scan");
  });

  test("shows the uploader and its instructions", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "掃描書架" })).toBeVisible();
    await expect(page.getByText("把書架照片拖進來，或選擇檔案")).toBeVisible();
    await expect(page.getByRole("button", { name: "選擇照片" })).toBeVisible();
  });

  test("offers a camera capture input on the page", async ({ page }) => {
    // Phones should open the camera directly rather than a file browser.
    const capture = page.locator('input[capture="environment"]');
    await expect(capture).toHaveCount(1);
    await expect(capture).toHaveAttribute("accept", /image\/jpeg/);
  });

  /**
   * Drives the whole chain for real: compress in the browser, upload to R2,
   * create the scan row, kick off recognition, and poll for the outcome. The
   * worker has no usable Anthropic key here, so the run ends in the failure
   * path -- which is exactly the branch worth proving renders something the
   * user can act on.
   */
  test("uploads a photo, processes it and reports a readable failure", async ({ page }) => {
    const uploadRequest = page.waitForResponse(
      (response) =>
        response.url().includes("/api/upload") && response.request().method() === "POST",
    );
    const scanRequest = page.waitForResponse(
      (response) => response.url().endsWith("/api/scan") && response.request().method() === "POST",
    );

    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: "shelf.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    expect((await uploadRequest).status()).toBe(201);
    expect((await scanRequest).status()).toBe(202);

    // Polling drives it to a terminal state.
    await expect(page.getByText("失敗")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("辨識服務", { exact: false })).toBeVisible();

    // The failure is recoverable from the UI.
    await expect(page.getByRole("button", { name: "重試" })).toBeVisible();
    await expect(page.getByRole("button", { name: "移除" })).toBeVisible();

    await page.getByRole("button", { name: "移除" }).click();
    await expect(page.getByText("失敗")).toHaveCount(0);
  });

  test("rejects an unsupported file type without uploading it", async ({ page }) => {
    let uploadCalled = false;
    page.on("request", (request) => {
      if (request.url().includes("/api/upload")) uploadCalled = true;
    });

    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });

    await expect(page.getByText("只接受 JPEG、PNG、WebP 或 HEIC 圖片。")).toBeVisible();
    expect(uploadCalled).toBe(false);
  });
});

test.describe("scan API", () => {
  test("does not expose another user's scan", async ({ page }) => {
    const response = await page.request.get("/api/scan/some-other-users-scan-id");
    expect(response.status()).toBe(404);
  });

  test("rejects a scan request with no id", async ({ page }) => {
    const response = await page.request.post("/api/scan", { data: {} });
    expect(response.status()).toBe(400);
  });

  test("rejects an upload with no file", async ({ page }) => {
    const response = await page.request.post("/api/upload", {
      multipart: { note: "no file here" },
    });
    expect(response.status()).toBe(400);
  });
});
