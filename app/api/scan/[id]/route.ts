import { requireApiUser } from "@/lib/auth/require-user";
import { listBooksByScan } from "@/lib/data/books";
import { getScan } from "@/lib/data/scans";

/**
 * Scan status plus whatever books it has produced. Polled by /scan while a
 * recognition run is in flight.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { user, response } = await requireApiUser({ notFound: true });
  if (!user) return response;

  const { id } = await params;
  const scan = await getScan(user.id, id);
  if (!scan) return new Response(null, { status: 404 });

  const books = scan.status === "done" ? await listBooksByScan(user.id, id) : [];

  return Response.json(
    {
      scanId: scan.id,
      status: scan.status,
      detectedCount: scan.detectedCount,
      errorMessage: scan.errorMessage,
      createdAt: scan.createdAt,
      books,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
