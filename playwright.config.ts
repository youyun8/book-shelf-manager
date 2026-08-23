import { defineConfig, devices } from "@playwright/test";

const PORT = 8787;
// Must match BETTER_AUTH_URL: better-auth rejects requests from other origins.
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Environments that ship a pre-installed Chromium (CI images, sandboxes) can
 * point the suite at it instead of downloading a second copy:
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e
 */
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

const launchOverrides = chromiumExecutable
  ? {
      launchOptions: {
        executablePath: chromiumExecutable,
        // The sandbox cannot be used when the suite runs as root.
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      },
    }
  : {};

/**
 * End-to-end tests run against a real worker: the OpenNext bundle served by
 * `wrangler dev`, backed by local D1, R2 and KV. The server command migrates
 * and seeds the database first, so the suite always starts from the same two
 * users with twenty books each.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Requests to the local worker must not go through the outbound proxy.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], ...launchOverrides },
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      // Every spec starts already signed in as alice; the isolation spec opens
      // its own context for bob.
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/alice.json",
        ...launchOverrides,
      },
    },
  ],
  webServer: {
    command: [
      "npm run db:migrate:local",
      "npm run db:seed",
      "npx opennextjs-cloudflare build",
      `npx wrangler dev --port ${PORT} --ip 127.0.0.1`,
    ].join(" && "),
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
