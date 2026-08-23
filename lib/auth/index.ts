import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";

import { createDb, type Database } from "@/db/client";
import { sendLoginOtpEmail } from "./send-otp";

type AuthEnv = Pick<
  CloudflareEnv,
  "DB" | "RATE_LIMIT" | "BETTER_AUTH_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
> & { BETTER_AUTH_URL?: string };

/**
 * Builds the better-auth instance.
 *
 * Called with `env` at runtime (bindings available) and without `env` by the
 * better-auth CLI, which only needs the model definitions to emit the schema.
 */
export function createAuth(env?: AuthEnv, baseURL?: string) {
  const db: Database | undefined = env ? createDb(env.DB) : undefined;

  return betterAuth({
    baseURL: baseURL ?? env?.BETTER_AUTH_URL,
    secret: env?.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: false,
        cf: {},
        d1: db ? { db, options: { usePlural: false } } : undefined,
        // better-auth-cloudflare types its bindings against the
        // @cloudflare/workers-types package while our bindings come from the
        // workerd runtime types wrangler generates. The two describe the same
        // object but are nominally distinct, so bridge them here.
        kv: env?.RATE_LIMIT as unknown as Parameters<typeof withCloudflare>[0]["kv"],
      },
      {
        emailAndPassword: { enabled: false },
        socialProviders: {
          google: {
            clientId: env?.GOOGLE_CLIENT_ID ?? "",
            clientSecret: env?.GOOGLE_CLIENT_SECRET ?? "",
          },
        },
        session: {
          expiresIn: 60 * 60 * 24 * 30,
          updateAge: 60 * 60 * 24,
        },
        account: {
          accountLinking: { enabled: true, trustedProviders: ["google", "email-otp"] },
        },
        rateLimit: {
          enabled: true,
          // Cloudflare KV enforces a 60s minimum TTL, so the window cannot be shorter.
          window: 60,
          max: 100,
        },
        plugins: [
          emailOTP({
            otpLength: 6,
            expiresIn: 10 * 60,
            disableSignUp: false,
            async sendVerificationOTP({ email, otp, type }) {
              await sendLoginOtpEmail({ email, otp, type });
            },
          }),
          // Must stay last: it copies Set-Cookie onto Next.js server action responses.
          nextCookies(),
        ],
      },
    ),
    // The CLI has no bindings, so give it a bare adapter just for schema generation.
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as never, { provider: "sqlite", usePlural: false }),
        }),
  });
}

/** Consumed by `npx @better-auth/cli generate`. Never used at runtime. */
export const auth = createAuth();

export type Auth = ReturnType<typeof createAuth>;
