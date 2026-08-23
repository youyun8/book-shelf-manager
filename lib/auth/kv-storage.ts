import type { SecondaryStorage } from "@better-auth/core/db";

/**
 * Session cache backed by Cloudflare KV.
 *
 * better-auth-cloudflare ships its own KV adapter, but it only implements
 * get/set/delete -- better-auth also requires `getAndDelete` and `increment`,
 * so calls into it fail at runtime. This is a complete implementation.
 *
 * Note the deliberate split: rate limiting is configured to use D1, not this
 * storage, because KV has no atomic increment and no read-after-write
 * consistency, which would make a counter easy to slip past. `increment` is
 * implemented for completeness only.
 */

/** KV rejects any TTL shorter than this. */
const MIN_TTL_SECONDS = 60;

export function createKvSecondaryStorage(kv: KVNamespace): SecondaryStorage {
  return {
    async get(key) {
      return kv.get(key);
    },

    async getAndDelete(key) {
      const value = await kv.get(key);
      if (value !== null) await kv.delete(key);
      return value;
    },

    async set(key, value, ttl) {
      if (ttl === undefined) {
        await kv.put(key, value);
        return;
      }
      await kv.put(key, value, { expirationTtl: Math.max(ttl, MIN_TTL_SECONDS) });
    },

    async delete(key) {
      await kv.delete(key);
    },

    /**
     * Best effort only: KV offers no atomic increment, so two concurrent
     * callers can read the same value and write the same result. Nothing in
     * this app relies on it (rate limiting uses D1), but the interface
     * requires it.
     */
    async increment(key, ttl) {
      const current = Number((await kv.get(key)) ?? 0);
      const next = Number.isFinite(current) ? current + 1 : 1;
      await kv.put(key, String(next), {
        expirationTtl: Math.max(ttl, MIN_TTL_SECONDS),
      });
      return next;
    },
  };
}
