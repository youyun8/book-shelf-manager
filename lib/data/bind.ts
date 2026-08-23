import { type Database, getDb } from "@/db/client";

/**
 * Turns a repository function into one that resolves the request's D1 binding
 * itself.
 *
 * Repository functions take `(userId, db, ...)` so tests can hand them a
 * database directly. Route handlers and pages must not touch `db` at all --
 * that is what keeps every query inside the repository layer -- so this module
 * is the single place that bridges the two.
 */
export type RepositoryFn<A extends unknown[], R> = (
  userId: string,
  db: Database,
  ...args: A
) => Promise<R>;

export function bindDb<A extends unknown[], R>(
  fn: RepositoryFn<A, R>,
): (userId: string, ...args: A) => Promise<R> {
  return async (userId, ...args) => fn(userId, await getDb(), ...args);
}
