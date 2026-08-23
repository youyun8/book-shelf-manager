import { getAuth } from "@/lib/auth/server";

/** better-auth owns every route under /api/auth/*. */
async function handler(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
