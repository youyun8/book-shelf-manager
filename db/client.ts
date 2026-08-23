import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

/** Includes drizzle's `$client` handle, which some adapters (better-auth) require. */
export type Database = DrizzleD1Database<typeof schema> & { $client: D1Database };

/** Wraps a raw D1 binding. Used by tests and by callers that already hold one. */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

/** The request-scoped D1 binding, resolved through the OpenNext Cloudflare context. */
export async function getDb(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.DB);
}
