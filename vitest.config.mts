import path from "node:path";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// .mts so Vite loads this config as ESM (the package is CommonJS by default).
const projectRoot = import.meta.dirname;

/**
 * Tests run inside workerd against a real (local) D1 database, so the
 * repository tests exercise the same SQLite engine and Drizzle driver as
 * production. The migrations in drizzle/ are handed to the worker and applied
 * in tests/setup.ts, which means a broken migration fails the test run.
 */
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        compatibilityDate: "2025-08-21",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(projectRoot, "drizzle")),
        },
      },
    })),
  ],
  resolve: {
    alias: { "@": projectRoot },
  },
  test: {
    include: ["{db,lib}/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
