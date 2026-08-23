/**
 * Secrets are provisioned with `wrangler secret put` (production) or `.dev.vars`
 * (local), so they never appear in wrangler.jsonc and are not picked up by
 * `wrangler types`. Declaration-merge them into the generated CloudflareEnv so
 * server code gets the same type safety as for real bindings.
 */
interface CloudflareEnv {
  ANTHROPIC_API_KEY?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Comma-separated extra origins allowed to call the auth API. */
  TRUSTED_ORIGINS?: string;
  /** Optional Resend API key; without it OTP codes are logged instead of emailed. */
  RESEND_API_KEY?: string;
  /** From address for OTP emails. */
  OTP_FROM_EMAIL?: string;
}
