/**
 * Fails if db/auth-schema.ts drifts from what the installed better-auth
 * actually queries.
 *
 * The published `@better-auth/cli` trails the library, so a `generate` run can
 * silently omit a column that the runtime requires (this is how `account.issuer`
 * went missing). Comparing the Drizzle tables against `getAuthTables()` turns
 * that into a build failure instead of a 500 at sign-in.
 *
 * Run with `npm run check:auth-schema` (also part of `npm run lint`).
 */
import { getTableColumns, getTableName } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getAuthTables } from "better-auth/db";

import { auth } from "@/lib/auth/cli";
import * as authSchema from "@/db/auth-schema";

type FieldConfig = { fieldName?: string; required?: boolean };
type TableConfig = { modelName: string; fields: Record<string, FieldConfig> };

const problems: string[] = [];

/**
 * Keyed by export name, because that is how the Drizzle adapter resolves a
 * better-auth model: it looks up `schema[modelName]`. The SQL table name can
 * differ (better-auth's `rateLimit` model lives in the `rate_limit` table), so
 * matching on it would produce false failures.
 */
const drizzleTables = new Map<string, SQLiteTable>();
for (const [key, value] of Object.entries(authSchema)) {
  try {
    // Throws for anything that is not a Drizzle table (relations, type exports).
    getTableName(value as SQLiteTable);
    drizzleTables.set(key, value as SQLiteTable);
  } catch {
    continue;
  }
}

const expected = getAuthTables(auth.options) as unknown as Record<string, TableConfig>;

for (const [model, config] of Object.entries(expected)) {
  const table = drizzleTables.get(model);
  if (!table) {
    problems.push(`db/auth-schema.ts has no export named "${model}" (table "${config.modelName}")`);
    continue;
  }

  const columns = getTableColumns(table);
  const present = new Set(Object.keys(columns));

  if (!present.has("id")) problems.push(`${model}: missing "id" column`);

  for (const [field, cfg] of Object.entries(config.fields)) {
    const key = cfg.fieldName ?? field;
    if (!present.has(key)) {
      problems.push(`${model}: missing column "${key}"${cfg.required ? " (required)" : ""}`);
    }
  }
}

if (problems.length > 0) {
  console.error("✗ better-auth schema drift detected:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nRegenerate with `npx @better-auth/cli generate --config lib/auth/cli.ts" +
      " --output db/auth-schema.ts -y`, add any columns the CLI missed, then" +
      " `npm run db:generate`.",
  );
  process.exit(1);
}

console.log(`✓ better-auth schema matches the runtime (${Object.keys(expected).length} tables)`);
