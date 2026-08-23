import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";

import { createDb, type Database } from "@/db/client";

import { createKvSecondaryStorage } from "./kv-storage";
import { sendLoginOtpEmail } from "./send-otp";

type AuthEnv = Pick<
  CloudflareEnv,
  "DB" | "RATE_LIMIT" | "BETTER_AUTH_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
> & { BETTER_AUTH_URL?: string; TRUSTED_ORIGINS?: string };

/**
 * Origins allowed to call the auth API, on top of the app's own base URL.
 * Set TRUSTED_ORIGINS to a comma-separated list to add preview deployments or
 * a second custom domain.
 */
function trustedOrigins(env?: AuthEnv): string[] {
  const origins = new Set<string>();
  if (env?.BETTER_AUTH_URL) origins.add(env.BETTER_AUTH_URL);
  for (const origin of (env?.TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = origin.trim();
    if (trimmed) origins.add(trimmed);
  }
  return [...origins];
}

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
      },
      {
        emailAndPassword: { enabled: false },
        trustedOrigins: trustedOrigins(env),
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
        databaseHooks: {
          user: {
            create: {
              // Email OTP sign-up carries no display name, which would leave the
              // account showing an empty string everywhere.
              before: async (user) => ({
                data: { ...user, name: user.name?.trim() || user.email.split("@")[0] },
              }),
            },
          },
        },
        rateLimit: {
          enabled: true,
          // D1, not KV: better-auth needs an atomic increment to count requests
          // and KV has none. The counters live in the `rateLimit` table.
          storage: "database",
          window: 60,
          max: 100,
          customRules: {
            // Sending a code costs us an email, so cap it much harder.
            "/email-otp/send-verification-otp": { window: 60, max: 5 },
            "/sign-in/email-otp": { window: 60, max: 10 },
          },
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
    // Overrides the adapter better-auth-cloudflare installs, which predates the
    // getAndDelete/increment methods better-auth now requires. See kv-storage.ts.
    secondaryStorage: env ? createKvSecondaryStorage(env.RATE_LIMIT) : undefined,
    // The CLI has no bindings, so give it a bare adapter just for schema generation.
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as never, { provider: "sqlite", usePlural: false }),
        }),
  });
}

export type Auth = ReturnType<typeof createAuth>;
