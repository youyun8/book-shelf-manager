import { requireApiUser } from "@/lib/auth/require-user";
import { type BookFilter, type BookSort, iterateBooks } from "@/lib/data/books";
import { buildCsvFilename, createCsvStream } from "@/lib/csv";

const FILTERS: BookFilter[] = ["all", "purchased", "unpurchased", "needsReview"];
const SORTS: BookSort[] = ["createdAt", "title", "author"];

function parseFilter(value: string | null): BookFilter {
  return FILTERS.includes(value as BookFilter) ? (value as BookFilter) : "all";
}

function parseSort(value: string | null): BookSort {
  return SORTS.includes(value as BookSort) ? (value as BookSort) : "createdAt";
}

/**
 * Streams the caller's library as CSV.
 *
 * With no query parameters it exports the whole library; `filter`, `q` and
 * `sort` narrow it to what the library page is currently showing. The rows are
 * paged out of D1 and written to the response as they arrive, so a large
 * library never has to fit in the worker's memory.
 */
export async function GET(request: Request): Promise<Response> {
  const { user, response } = await requireApiUser();
  if (!user) return response;

  const params = new URL(request.url).searchParams;
  const books = iterateBooks(user.id, {
    filter: parseFilter(params.get("filter")),
    search: params.get("q") ?? undefined,
    sort: parseSort(params.get("sort")),
    pageSize: 200,
  });

  const filename = buildCsvFilename();

  return new Response(createCsvStream(books), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      // The plain filename is ASCII already; filename* is included for clients
      // that prefer the encoded form.
      "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}
