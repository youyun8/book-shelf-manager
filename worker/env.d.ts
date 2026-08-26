/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  /** Optional: when the namespace is not configured, uploads simply are not archived. */
  UPLOADS?: KVNamespace;
  ASSETS: Fetcher;
  /** Resend API key. Without it, password reset links are only written to the log. */
  RESEND_API_KEY?: string;
  /** Sender address, e.g. `藏書庫存管理 <books@example.com>`. */
  MAIL_FROM?: string;
}

export interface SessionUser {
  id: string;
  email: string;
}
