/**
 * Book metadata from the public Google Books API.
 *
 * No key is needed, but requests from a datacenter are rejected with
 * "unable to determine user location" unless `country` is supplied, so it is
 * always sent.
 */
const API_URL = "https://www.googleapis.com/books/v1/volumes";
const COUNTRY = "TW";

export type BookMetadata = {
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  isbn10: string | null;
  isbn13: string | null;
  pageCount: number | null;
  categories: string[];
  description: string | null;
  language: string | null;
  coverUrl: string | null;
};

type VolumeInfo = {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  language?: string;
  industryIdentifiers?: { type?: string; identifier?: string }[];
  imageLinks?: Record<string, string>;
};

type VolumesResponse = { totalItems?: number; items?: { volumeInfo?: VolumeInfo }[] };

/** Google returns http URLs; browsers block them on an https page. */
function toHttps(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

function pickIsbn(identifiers: VolumeInfo["industryIdentifiers"], type: string): string | null {
  const match = identifiers?.find((entry) => entry.type === type);
  return match?.identifier?.replace(/[^0-9Xx]/g, "") || null;
}

function toMetadata(info: VolumeInfo): BookMetadata {
  const imageLinks = info.imageLinks ?? {};
  return {
    title: info.title?.trim() ?? "",
    subtitle: info.subtitle?.trim() || null,
    authors: (info.authors ?? []).filter((a) => typeof a === "string" && a.trim().length > 0),
    publisher: info.publisher?.trim() || null,
    // Google mixes "2011", "2011-05" and "2011-05-03", so this stays text.
    publishedDate: info.publishedDate?.trim() || null,
    isbn10: pickIsbn(info.industryIdentifiers, "ISBN_10"),
    isbn13: pickIsbn(info.industryIdentifiers, "ISBN_13"),
    pageCount: typeof info.pageCount === "number" && info.pageCount > 0 ? info.pageCount : null,
    categories: (info.categories ?? []).filter((c) => typeof c === "string" && c.length > 0),
    description: info.description?.trim() || null,
    language: info.language?.trim() || null,
    // Prefer the larger artwork when the volume offers it.
    coverUrl: toHttps(imageLinks.thumbnail ?? imageLinks.smallThumbnail),
  };
}

/** Only ISBN-10 and ISBN-13 are worth querying; anything else is noise. */
function normaliseIsbn(isbn: string | null | undefined): string | null {
  const digits = isbn?.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!digits) return null;
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

export function buildQuery({
  isbn,
  title,
  author,
}: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}): string | null {
  const normalisedIsbn = normaliseIsbn(isbn);
  if (normalisedIsbn) return `isbn:${normalisedIsbn}`;

  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return null;

  const parts = [`intitle:${trimmedTitle}`];
  const trimmedAuthor = author?.trim();
  if (trimmedAuthor) parts.push(`inauthor:${trimmedAuthor}`);
  return parts.join("+");
}

export type LookupOptions = {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
  fetchImpl?: typeof fetch;
};

/**
 * Looks a book up, preferring ISBN and falling back to title + author.
 *
 * Returns null whenever the lookup cannot produce a match -- including on a
 * network or API failure. Enrichment is a bonus; the caller keeps whatever the
 * model read off the cover and flags the book for review.
 */
export async function lookupBook({
  isbn,
  title,
  author,
  fetchImpl = fetch,
}: LookupOptions): Promise<BookMetadata | null> {
  const query = buildQuery({ isbn, title, author });
  if (!query) return null;

  const url = `${API_URL}?q=${encodeURIComponent(query)}&maxResults=1&country=${COUNTRY}`;

  try {
    const response = await fetchImpl(url, { headers: { accept: "application/json" } });
    if (!response.ok) return null;

    const body = (await response.json()) as VolumesResponse;
    const info = body.items?.[0]?.volumeInfo;
    if (!info?.title) return null;

    return toMetadata(info);
  } catch {
    return null;
  }
}
