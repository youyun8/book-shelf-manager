import { createAuth } from "./index";

/**
 * Config-only auth instance for `npx @better-auth/cli generate` and
 * scripts/check-auth-schema.ts.
 *
 * It lives in its own module so importing the auth config at runtime does not
 * also construct this binding-less instance -- which would otherwise warn about
 * a missing secret on every request.
 */
export const auth = createAuth();
