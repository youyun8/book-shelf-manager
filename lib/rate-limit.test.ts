import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "./rate-limit";

const LIMIT = 3;

function identifier(): string {
  return `test-${crypto.randomUUID()}`;
}

describe("rate limiting", () => {
  it("allows requests up to the limit and then rejects", async () => {
    const id = identifier();

    for (let i = 0; i < LIMIT; i += 1) {
      const result = await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: id, limit: LIMIT });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(LIMIT - (i + 1));
    }

    const blocked = await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: id, limit: LIMIT });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts each caller separately", async () => {
    const alice = identifier();
    const bob = identifier();

    for (let i = 0; i < LIMIT; i += 1) {
      await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: alice, limit: LIMIT });
    }

    expect(
      (await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: alice, limit: LIMIT })).allowed,
    ).toBe(false);
    expect(
      (await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: bob, limit: LIMIT })).allowed,
    ).toBe(true);
  });

  it("starts a fresh allowance in the next window", async () => {
    const id = identifier();
    const now = Date.UTC(2026, 0, 1, 12, 0, 30);

    for (let i = 0; i < LIMIT; i += 1) {
      await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: id, limit: LIMIT, now });
    }
    expect(
      (await consumeRateLimit({ kv: env.RATE_LIMIT, identifier: id, limit: LIMIT, now })).allowed,
    ).toBe(false);

    // Same identifier, one minute later.
    const next = await consumeRateLimit({
      kv: env.RATE_LIMIT,
      identifier: id,
      limit: LIMIT,
      now: now + 60_000,
    });
    expect(next.allowed).toBe(true);
  });

  it("reports the seconds remaining in the current window", async () => {
    const result = await consumeRateLimit({
      kv: env.RATE_LIMIT,
      identifier: identifier(),
      limit: LIMIT,
      now: Date.UTC(2026, 0, 1, 12, 0, 45),
    });
    expect(result.retryAfterSeconds).toBe(15);
  });

  it("supports a longer shared window for provider usage caps", async () => {
    const id = identifier();
    const day = 24 * 60 * 60;
    const now = Date.UTC(2026, 0, 1, 12, 0, 30);

    expect(
      await consumeRateLimit({
        kv: env.RATE_LIMIT,
        identifier: id,
        limit: 1,
        windowSeconds: day,
        now,
      }),
    ).toMatchObject({ allowed: true, remaining: 0 });
    expect(
      await consumeRateLimit({
        kv: env.RATE_LIMIT,
        identifier: id,
        limit: 1,
        windowSeconds: day,
        now,
      }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 43_170 });

    expect(
      await consumeRateLimit({
        kv: env.RATE_LIMIT,
        identifier: id,
        limit: 1,
        windowSeconds: day,
        now: now + day * 1000,
      }),
    ).toMatchObject({ allowed: true });
  });
});
