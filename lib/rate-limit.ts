/**
 * Per-user request throttling backed by Cloudflare KV.
 *
 * A fixed window keyed by the minute. KV has no atomic increment, so two
 * requests landing in the same instant can both read the same count -- an
 * acceptable trade for an abuse guard whose job is to stop a user hammering
 * the vision API, not to enforce an exact quota. Anything needing exactness
 * would want a Durable Object.
 */
const DEFAULT_WINDOW_SECONDS = 60;

/** KV refuses a TTL below 60s; the extra margin keeps the key alive to the window's end. */
const KEY_TTL_SECONDS = 120;

export type RateLimitResult = {
  allowed: boolean;
  /** Requests still available in this window. */
  remaining: number;
  /** Seconds until the window rolls over. */
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  kv: KVNamespace;
  /** Identifies the caller; always scope it per user. */
  identifier: string;
  limit: number;
  /** Fixed-window duration. Defaults to one minute. */
  windowSeconds?: number;
  now?: number;
};

export async function consumeRateLimit({
  kv,
  identifier,
  limit,
  windowSeconds = DEFAULT_WINDOW_SECONDS,
  now = Date.now(),
}: RateLimitOptions): Promise<RateLimitResult> {
  const duration = Math.max(60, Math.floor(windowSeconds));
  const window = Math.floor(now / (duration * 1000));
  const key = `ratelimit:${identifier}:${window}`;
  const retryAfterSeconds = duration - Math.floor((now % (duration * 1000)) / 1000);

  const stored = await kv.get(key);
  const used = Number(stored ?? 0);
  const count = Number.isFinite(used) && used > 0 ? used : 0;

  if (count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  await kv.put(key, String(count + 1), {
    expirationTtl: Math.max(KEY_TTL_SECONDS, duration * 2),
  });

  return { allowed: true, remaining: limit - (count + 1), retryAfterSeconds };
}
