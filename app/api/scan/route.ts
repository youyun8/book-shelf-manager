import { getCloudflareContext } from "@opennextjs/cloudflare";

import { requireApiUser } from "@/lib/auth/require-user";
import { getScan } from "@/lib/data/scans";
import { consumeRateLimit } from "@/lib/rate-limit";
import { processScan } from "@/lib/scan-pipeline";

/** Recognition is expensive, so cap how often one account can start it. */
const SCANS_PER_MINUTE = 10;

/**
 * Starts recognition for an uploaded photo.
 *
 * Returns as soon as the work is queued: recognising a shelf and looking every
 * book up takes longer than a worker should hold a request open, so the job
 * runs under `ctx.waitUntil` and the client polls GET /api/scan/[id].
 */
export async function POST(request: Request): Promise<Response> {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  let body: { scanId?: unknown };
  try {
    body = (await request.json()) as { scanId?: unknown };
  } catch {
    return Response.json({ error: "請求格式不正確。" }, { status: 400 });
  }

  const scanId = typeof body.scanId === "string" ? body.scanId : null;
  if (!scanId) {
    return Response.json({ error: "缺少 scanId。" }, { status: 400 });
  }

  const { env, ctx } = await getCloudflareContext({ async: true });

  const limit = await consumeRateLimit({
    kv: env.RATE_LIMIT,
    identifier: `scan:${user.id}`,
    limit: SCANS_PER_MINUTE,
  });
  if (!limit.allowed) {
    return Response.json(
      { error: `辨識次數太頻繁，請在 ${limit.retryAfterSeconds} 秒後再試。` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  // Scoped to the caller, so another user's scan id simply is not found.
  const scan = await getScan(user.id, scanId);
  if (!scan) return new Response(null, { status: 404 });

  if (scan.status === "processing") {
    return Response.json({ scanId, status: scan.status }, { status: 202 });
  }

  ctx.waitUntil(
    processScan({ userId: user.id, scanId, apiKey: env.ANTHROPIC_API_KEY }).then(() => undefined),
  );

  return Response.json({ scanId, status: "processing" }, { status: 202 });
}
