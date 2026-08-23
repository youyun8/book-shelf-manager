import { test as setup } from "@playwright/test";

import { SEED, STORAGE_STATE, signIn } from "./helpers";

/**
 * Signs both seeded users in once and saves their cookies.
 *
 * Sending a login code is rate limited to five per minute, so logging in per
 * test would trip the app's own protection partway through the suite.
 */
setup("authenticate as alice", async ({ page }) => {
  await signIn(page, SEED.alice.email);
  await page.context().storageState({ path: STORAGE_STATE.alice });
});

setup("authenticate as bob", async ({ page }) => {
  await signIn(page, SEED.bob.email);
  await page.context().storageState({ path: STORAGE_STATE.bob });
});
