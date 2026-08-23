import { getCloudflareContext } from "@opennextjs/cloudflare";

import { type Auth, createAuth } from "./index";

/**
 * The request-scoped better-auth instance.
 *
 * Bindings only exist inside a request, so the instance is built per request
 * rather than at module scope.
 *
 * The base URL comes from BETTER_AUTH_URL rather than the incoming request:
 * under OpenNext the request URL is normalised to the configured host, so it
 * is not a reliable source, and better-auth rejects any request whose Origin
 * header does not match. Additional hostnames (preview deployments, a second
 * custom domain) go in TRUSTED_ORIGINS.
 */
export async function getAuth(): Promise<Auth> {
  const { env } = await getCloudflareContext({ async: true });
  return createAuth(env, env.BETTER_AUTH_URL);
}
