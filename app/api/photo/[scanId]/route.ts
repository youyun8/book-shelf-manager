import { requireApiUser } from "@/lib/auth/require-user";
import { getScan } from "@/lib/data/scans";
import { getPhoto, keyBelongsToUser } from "@/lib/r2";

/**
 * Serves a scan photo out of the private R2 bucket.
 *
 * Every failure mode -- not signed in, someone else's scan, missing scan,
 * missing object -- answers 404. Distinguishing them would leak whether a
 * given scan id exists.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> },
): Promise<Response> {
  const { user, response } = await requireApiUser({ notFound: true });
  if (!user) return response;

  const { scanId } = await params;
  const scan = await getScan(user.id, scanId);
  if (!scan || !keyBelongsToUser(scan.r2Key, user.id)) {
    return new Response(null, { status: 404 });
  }

  const object = await getPhoto(scan.r2Key);
  if (!object) return new Response(null, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
}
