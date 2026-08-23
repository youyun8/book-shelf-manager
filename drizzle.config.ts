import { defineConfig } from "drizzle-kit";

// Migrations are generated locally and applied to D1 with
// `wrangler d1 migrations apply`, so no live connection is configured here.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  casing: "snake_case",
  verbose: true,
  strict: true,
});
