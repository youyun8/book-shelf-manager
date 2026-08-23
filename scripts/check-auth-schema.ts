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

import { auth } from "@/lib/auth";
import * as authSchema from "@/db/auth-schema";

type FieldConfig = { fieldName?: string; required?: boolean };
type TableConfig = { modelName: string; fields: Record<string, FieldConfig> };

const problems: string[] = [];

const drizzleTables = new Map<string, SQLiteTable>();
for (const value of Object.values(authSchema)) {
  // Drizzle tables carry a name; relations objects do not.
  try {
    const name = getTableName(value as SQLiteTable);
    if (typeof name === "string") drizzleTables.set(name, value as SQLiteTable);
  } catch {
    // Not a table (relations helper, type export) - skip.
  }
}

const expected = getAuthTables(auth.options) as unknown as Record<string, TableConfig>;

for (const [model, config] of Object.entries(expected)) {
  const table = drizzleTables.get(config.modelName);
  if (!table) {
    problems.push(`missing table "${config.modelName}" (better-auth model "${model}")`);
    continue;
  }

  const columns = getTableColumns(table);
  const present = new Set(Object.keys(columns));

  if (!present.has("id")) problems.push(`${config.modelName}: missing "id" column`);

  for (const [field, cfg] of Object.entries(config.fields)) {
    const key = cfg.fieldName ?? field;
    if (!present.has(key)) {
      problems.push(
        `${config.modelName}: missing column "${key}"${cfg.required ? " (required)" : ""}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("✗ better-auth schema drift detected:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nRegenerate with `npx @better-auth/cli generate --config lib/auth/index.ts" +
      " --output db/auth-schema.ts -y`, add any columns the CLI missed, then" +
      " `npm run db:generate`.",
  );
  process.exit(1);
}

console.log(`✓ better-auth schema matches the runtime (${Object.keys(expected).length} tables)`);
