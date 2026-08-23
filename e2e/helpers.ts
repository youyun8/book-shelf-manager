import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Ids produced by scripts/seed.ts, so tests can address specific rows. */
export const SEED = {
  alice: { email: "alice@example.test", userId: "seed-user-000", bookPrefix: "seed-alice-book-" },
  bob: { email: "bob@example.test", userId: "seed-user-001", bookPrefix: "seed-bob-book-" },
  /** 20 books each, of which 7 are purchased and 3 need review (see seed.ts). */
  counts: { total: 20, purchased: 7, unpurchased: 13, needsReview: 3 },
};

/** Saved sign-in state, produced by auth.setup.ts. */
export const STORAGE_STATE = {
  alice: ".playwright/alice.json",
  bob: ".playwright/bob.json",
};

const KV_NAMESPACE_ID = "REPLACE_ME_KV_NAMESPACE_ID";

/**
 * Reads the one-time code better-auth just stored.
 *
 * In local development the code is never emailed, so the test picks it up from
 * the same KV namespace the app wrote it to, through wrangler's local explorer
 * API. Nothing test-specific exists in the application itself.
 */
async function readOtp(request: APIRequestContext, email: string): Promise<string> {
  const key = encodeURIComponent(`verification:sign-in-otp-${email}`);
  const response = await request.get(
    `/cdn-cgi/local/explorer/api/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`,
  );
  expect(response.ok(), "the OTP should be in local KV").toBeTruthy();

  const body = (await response.json()) as { value?: string };
  const otp = body.value?.split(":")[0];
  expect(otp, `no OTP stored for ${email}`).toMatch(/^\d{6}$/);
  return otp as string;
}

/**
 * Signs in through the real login form.
 *
 * Only auth.setup.ts calls this: sending a code is rate limited to 5 per
 * minute, so the tests reuse a saved session instead of logging in each time.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");

  await page.getByLabel("電子郵件").fill(email);
  await page.getByRole("button", { name: "寄送登入驗證碼" }).click();

  const otpField = page.getByLabel("驗證碼");
  await expect(otpField).toBeVisible();

  await otpField.fill(await readOtp(page.request, email));
  await page.getByRole("button", { name: "登入", exact: true }).click();

  await page.waitForURL("/");
}

/** Fills the search box and waits for the debounced list to settle. */
export async function search(page: Page, term: string, expectedMatches: number): Promise<void> {
  await page.getByLabel("搜尋書名或作者").fill(term);
  await expect(page.getByTestId("result-count")).toHaveText(
    `顯示 ${expectedMatches} / ${SEED.counts.total} 本`,
  );
}
