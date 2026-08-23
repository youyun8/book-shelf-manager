import { env } from "cloudflare:test";

import { createDb, type Database } from "@/db/client";

export function testDb(): Database {
  return createDb(env.DB);
}

/**
 * Inserts a user row directly.
 *
 * The repositories deliberately have no way to create users -- that is
 * better-auth's job -- so tests seed the FK target themselves.
 */
export async function createTestUser(name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    `insert into user (id, name, email, email_verified, created_at, updated_at)
     values (?, ?, ?, 0, ?, ?)`,
  )
    .bind(id, name, `${name}-${id.slice(0, 8)}@example.test`, now, now)
    .run();
  return id;
}

/** Removes every row so each test file starts from a clean database. */
export async function resetDatabase(): Promise<void> {
  for (const table of ["books", "scans", "session", "account", "verification", "user"]) {
    await env.DB.prepare(`delete from ${table}`).run();
  }
}
