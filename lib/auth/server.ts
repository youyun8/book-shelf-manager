import { getCloudflareContext } from "@opennextjs/cloudflare";

import { type Auth, createAuth } from "./index";

/**
 * The request-scoped better-auth instance.
 *
 * Bindings only exist inside a request, so the instance is built per request
 * rather than at module scope.
 */
export async function getAuth(): Promise<Auth> {
  const { env } = await getCloudflareContext({ async: true });
  return createAuth(env, env.BETTER_AUTH_URL);
}
