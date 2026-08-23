import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/** The signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/** For pages and server actions: sends anonymous visitors to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Convenience for the common case of only needing the id to scope a query. */
export async function requireUserId(): Promise<string> {
  return (await requireUser()).id;
}

/**
 * For route handlers.
 *
 * Returns the user, or a ready-made error response. Handlers that serve a
 * specific resource should pass `notFound: true` so an anonymous request
 * cannot tell an existing resource from a missing one.
 */
export async function requireApiUser(
  options: { notFound?: boolean } = {},
): Promise<{ user: SessionUser; response?: never } | { user?: never; response: Response }> {
  const user = await getSessionUser();
  if (user) return { user };

  return {
    response: options.notFound
      ? new Response(null, { status: 404 })
      : Response.json({ error: "請先登入" }, { status: 401 }),
  };
}
