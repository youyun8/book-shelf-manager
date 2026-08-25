/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  /** Optional: when the bucket is not configured, uploads simply are not archived. */
  UPLOADS?: R2Bucket;
  ASSETS: Fetcher;
}

export interface SessionUser {
  id: string;
  email: string;
}
