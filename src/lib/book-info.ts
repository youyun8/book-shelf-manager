import type { Book } from '../types';

/** Book details fetched from Google Books, shown next to the shelf record. */
export interface ExternalBookInfo {
  id: string;
  title: string;
  subtitle: string;
  authors: string[];
  publisher: string;
  publishedDate: string;
  description: string;
  pageCount: number | null;
  categories: string[];
  isbn: string;
  coverUrl: string;
  infoLink: string;
}

export class LookupError extends Error {}

/** Lookups already resolved earlier in this session. */
const seeded = new Map<string, ExternalBookInfo | null>();

let apiKey = readEnvApiKey();

function readEnvApiKey(): string {
  // Present when the site is built with VITE_GOOGLE_BOOKS_KEY; absent in Node.
  try {
    return (import.meta.env?.VITE_GOOGLE_BOOKS_KEY as string | undefined) ?? '';
  } catch {
    return '';
  }
}

/** Raises the request quota above the shared per-IP anonymous limit. */
export function setApiKey(key: string): void {
  apiKey = key;
}

/** Cover by ISBN from Open Library: no key, no quota, and no CORS needed. */
export function openLibraryCover(isbn: string): string {
  const normalized = normalizeIsbn(isbn);
  return normalized === '' ? '' : `${OPEN_LIBRARY_COVER}/${normalized}-L.jpg?default=false`;
}

const ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY_COVER = 'https://covers.openlibrary.org/b/isbn';
const TIMEOUT_MS = 12_000;
const CACHE_PREFIX = 'bsm:book-info:v1:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Shape of the parts of the Google Books response this module reads. */
interface VolumeInfo {
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
  infoLink?: string;
  canonicalVolumeLink?: string;
}
interface Volume {
  id?: string;
  volumeInfo?: VolumeInfo;
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[！!？?，,、。．·・…：:；;～~—\-_'"'"「」『』（）()[\]【】《》〈〉]/g, '');
}

/** Digits only; `978-986-189-727-1` and `9789861897271` are the same book. */
export function normalizeIsbn(value: string): string {
  const digits = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  return digits.length === 10 || digits.length === 13 ? digits : '';
}

function quote(value: string): string {
  return `"${value.replace(/"/g, ' ').trim()}"`;
}

/** Search terms to try in order, from the most precise to the loosest. */
export function buildQueries(book: Book): string[] {
  const queries: string[] = [];
  const isbn = normalizeIsbn(book.isbn);
  const title = book.title.trim();
  const author = book.author.trim();

  if (isbn !== '') queries.push(`isbn:${isbn}`);
  if (title !== '' && author !== '')
    queries.push(`intitle:${quote(title)} inauthor:${quote(author)}`);
  if (title !== '') {
    queries.push(`intitle:${quote(title)}`);
    queries.push(quote(title));
  }
  return [...new Set(queries)];
}

/** Largest available cover, forced to https so the page stays secure. */
export function pickCover(imageLinks: Record<string, string> | undefined): string {
  if (!imageLinks) return '';
  const order = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail'];
  for (const key of order) {
    const url = imageLinks[key];
    if (url) return url.replace(/^http:/, 'https:').replace(/&edge=curl/, '');
  }
  return '';
}

function toInfo(volume: Volume): ExternalBookInfo | null {
  const info = volume.volumeInfo;
  if (!info || !info.title) return null;
  const identifiers = info.industryIdentifiers ?? [];
  const isbn13 = identifiers.find((item) => item.type === 'ISBN_13')?.identifier;
  const isbn10 = identifiers.find((item) => item.type === 'ISBN_10')?.identifier;

  return {
    id: volume.id ?? info.title,
    title: info.title,
    subtitle: info.subtitle ?? '',
    authors: info.authors ?? [],
    publisher: info.publisher ?? '',
    publishedDate: info.publishedDate ?? '',
    description: info.description ?? '',
    pageCount: typeof info.pageCount === 'number' ? info.pageCount : null,
    categories: info.categories ?? [],
    isbn: isbn13 ?? isbn10 ?? '',
    coverUrl: pickCover(info.imageLinks),
    infoLink: info.canonicalVolumeLink ?? info.infoLink ?? '',
  };
}

/**
 * Google Books happily returns loosely related volumes, so results are scored
 * against the shelf record and clearly wrong matches are dropped.
 */
export function pickBestVolume(volumes: readonly Volume[], book: Book): ExternalBookInfo | null {
  const wantedTitle = normalizeForMatch(book.title);
  const wantedAuthor = normalizeForMatch(book.author);
  const wantedIsbn = normalizeIsbn(book.isbn);

  let best: { info: ExternalBookInfo; score: number } | null = null;
  for (const volume of volumes) {
    const info = toInfo(volume);
    if (!info) continue;

    const title = normalizeForMatch(info.title);
    let score = 0;
    if (wantedIsbn !== '' && normalizeIsbn(info.isbn) === wantedIsbn) score += 100;
    if (title === wantedTitle) score += 50;
    else if (wantedTitle !== '' && (title.includes(wantedTitle) || wantedTitle.includes(title)))
      score += 25;
    if (
      wantedAuthor !== '' &&
      info.authors.some((author) => {
        const candidate = normalizeForMatch(author);
        return candidate.includes(wantedAuthor) || wantedAuthor.includes(candidate);
      })
    )
      score += 20;
    if (info.coverUrl !== '') score += 5;
    if (info.description !== '') score += 3;

    if (!best || score > best.score) best = { info, score };
  }

  // A volume that matches neither the ISBN, the title nor the author is noise.
  return best && best.score >= 20 ? best.info : null;
}

function readCache(key: string): ExternalBookInfo | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as { at: number; info: ExternalBookInfo | null };
    if (Date.now() - entry.at > CACHE_TTL_MS) return undefined;
    return entry.info;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, info: ExternalBookInfo | null): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), info }));
  } catch {
    // Private mode or a full quota: the lookup still works, just uncached.
  }
}

export function cacheKey(book: Book): string {
  const isbn = normalizeIsbn(book.isbn);
  return isbn !== ''
    ? `isbn:${isbn}`
    : `${normalizeForMatch(book.title)}|${normalizeForMatch(book.author)}`;
}

async function fetchVolumes(query: string, signal?: AbortSignal): Promise<Volume[]> {
  const key = apiKey === '' ? '' : `&key=${encodeURIComponent(apiKey)}`;
  const url = `${ENDPOINT}?q=${encodeURIComponent(query)}&maxResults=10&printType=books${key}`;
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new LookupError('無法連線到 Google Books，請確認網路連線後再試。');
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new LookupError(
        '這個網路的 Google Books 查詢額度已用完（行動網路較常發生）。可稍後再試，或改用 Wi-Fi。',
      );
    }
    if (response.status === 403)
      throw new LookupError('Google Books 目前拒絕這次查詢，請稍後再試。');
    throw new LookupError(`查詢失敗（HTTP ${response.status}）。`);
  }
  const payload = (await response.json()) as { items?: Volume[] };
  return payload.items ?? [];
}

/**
 * Looks a shelf record up on Google Books. Resolves to `null` when nothing
 * matches, and throws a `LookupError` with a readable message when the request
 * itself fails. Results are cached per book for a week.
 */
export async function lookupBookInfo(
  book: Book,
  options: { signal?: AbortSignal; force?: boolean } = {},
): Promise<ExternalBookInfo | null> {
  const key = cacheKey(book);
  if (!options.force) {
    const preloaded = seeded.get(key);
    if (preloaded !== undefined) return preloaded;
    const cached = readCache(key);
    if (cached !== undefined) return cached;
  }

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    for (const query of buildQueries(book)) {
      const volumes = await fetchVolumes(query, timeout.signal);
      const match = pickBestVolume(volumes, book);
      if (match) {
        seeded.set(key, match);
        writeCache(key, match);
        return match;
      }
    }
    seeded.set(key, null);
    writeCache(key, null);
    return null;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError' && !options.signal?.aborted) {
      throw new LookupError('查詢逾時，請再試一次。');
    }
    throw cause;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

/** Search links to the shops people actually buy these books from. */
export function shopLinks(book: Book): { label: string; url: string }[] {
  const isbn = normalizeIsbn(book.isbn);
  const keyword = isbn !== '' ? isbn : [book.title, book.author].filter(Boolean).join(' ');
  const encoded = encodeURIComponent(keyword);
  return [
    { label: '誠品線上', url: `https://www.eslite.com/search?keyword=${encoded}` },
    { label: '博客來', url: `https://search.books.com.tw/search/query/key/${encoded}` },
    { label: 'Amazon', url: `https://www.amazon.com/s?k=${encoded}` },
  ];
}
