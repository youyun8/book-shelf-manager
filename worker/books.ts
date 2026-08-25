import type { Env } from './env.d';

/** The shape shared with the browser; mirrors `src/types.ts`. */
export interface BookRecord {
  id: string;
  title: string;
  author: string;
  illustrator: string;
  translator: string;
  publisher: string;
  summary: string;
  ageRange: string;
  tags: string[];
  channel: string;
  price: number | null;
  condition: string;
  location: string;
  isbn: string;
  coverUrl: string;
  extras: Record<string, string>;
}

interface BookRow {
  id: string;
  title: string;
  author: string;
  illustrator: string;
  translator: string;
  publisher: string;
  summary: string;
  age_range: string;
  tags: string;
  channel: string;
  price: number | null;
  condition: string;
  location: string;
  isbn: string;
  cover_url: string;
  extras: string;
}

const COLUMNS = `id, position, title, author, illustrator, translator, publisher, summary,
  age_range, tags, channel, price, condition, location, isbn, cover_url, extras,
  created_at, updated_at, updated_by`;
const COLUMN_COUNT = 20;
/** D1 allows 100 bound parameters per statement. */
const ROWS_PER_INSERT = Math.floor(100 / COLUMN_COUNT);

function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function rowToBook(row: BookRow): BookRecord {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    illustrator: row.illustrator,
    translator: row.translator,
    publisher: row.publisher,
    summary: row.summary,
    ageRange: row.age_range,
    tags: parseJson<string[]>(row.tags, []),
    channel: row.channel,
    price: row.price,
    condition: row.condition,
    location: row.location,
    isbn: row.isbn,
    coverUrl: row.cover_url,
    extras: parseJson<Record<string, string>>(row.extras, {}),
  };
}

function text(value: unknown, limit = 2000): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, limit);
}

function price(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;
  // `免費` and `` both strip down to nothing, which is not a price of zero.
  const digits = String(value).replace(/[^\d.-]/g, '');
  if (digits === '' || digits === '-' || digits === '.') return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Trusts nothing from the browser: every field is coerced and bounded. */
export function sanitizeBook(input: unknown): Omit<BookRecord, 'id'> {
  const source = (input ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(source.tags)
    ? source.tags.map((tag) => text(tag, 80)).filter((tag) => tag !== '')
    : [];
  const extrasSource = (source.extras ?? {}) as Record<string, unknown>;
  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(extrasSource).slice(0, 30)) {
    const cleaned = text(value);
    if (cleaned !== '') extras[text(key, 80)] = cleaned;
  }

  return {
    title: text(source.title, 300) || '（未命名）',
    author: text(source.author, 200),
    illustrator: text(source.illustrator, 200),
    translator: text(source.translator, 200),
    publisher: text(source.publisher, 200),
    summary: text(source.summary, 4000),
    ageRange: text(source.ageRange, 60),
    tags: tags.slice(0, 40),
    channel: text(source.channel, 120),
    price: price(source.price),
    condition: text(source.condition, 60),
    location: text(source.location, 200),
    isbn: text(source.isbn, 40),
    coverUrl: text(source.coverUrl, 1000),
    extras,
  };
}

export async function listBooks(env: Env): Promise<BookRecord[]> {
  const result = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM books ORDER BY position ASC, created_at ASC`,
  ).all<BookRow>();
  return result.results.map(rowToBook);
}

export async function getBook(env: Env, id: string): Promise<BookRecord | null> {
  const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM books WHERE id = ?`)
    .bind(id)
    .first<BookRow>();
  return row ? rowToBook(row) : null;
}

function bindValues(
  id: string,
  position: number,
  book: Omit<BookRecord, 'id'>,
  now: number,
  by: string,
) {
  return [
    id,
    position,
    book.title,
    book.author,
    book.illustrator,
    book.translator,
    book.publisher,
    book.summary,
    book.ageRange,
    JSON.stringify(book.tags),
    book.channel,
    book.price,
    book.condition,
    book.location,
    book.isbn,
    book.coverUrl,
    JSON.stringify(book.extras),
    now,
    now,
    by,
  ];
}

const INSERT_PLACEHOLDERS = `(${new Array(COLUMN_COUNT).fill('?').join(', ')})`;

export async function createBook(
  env: Env,
  book: Omit<BookRecord, 'id'>,
  email: string,
): Promise<BookRecord> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const next = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM books',
  ).first<{
    next: number;
  }>();
  await env.DB.prepare(`INSERT INTO books (${COLUMNS}) VALUES ${INSERT_PLACEHOLDERS}`)
    .bind(...bindValues(id, next?.next ?? 1, book, now, email))
    .run();
  return { id, ...book };
}

export async function updateBook(
  env: Env,
  id: string,
  book: Omit<BookRecord, 'id'>,
  email: string,
): Promise<BookRecord | null> {
  const result = await env.DB.prepare(
    `UPDATE books SET title = ?, author = ?, illustrator = ?, translator = ?, publisher = ?,
       summary = ?, age_range = ?, tags = ?, channel = ?, price = ?, condition = ?, location = ?,
       isbn = ?, cover_url = ?, extras = ?, updated_at = ?, updated_by = ?
     WHERE id = ?`,
  )
    .bind(
      book.title,
      book.author,
      book.illustrator,
      book.translator,
      book.publisher,
      book.summary,
      book.ageRange,
      JSON.stringify(book.tags),
      book.channel,
      book.price,
      book.condition,
      book.location,
      book.isbn,
      book.coverUrl,
      JSON.stringify(book.extras),
      Date.now(),
      email,
      id,
    )
    .run();
  if (!result.meta.changes) return null;
  return { id, ...book };
}

export async function deleteBook(env: Env, id: string): Promise<boolean> {
  const result = await env.DB.prepare('DELETE FROM books WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

/**
 * Replaces the whole library in one batch, so a failed import can never leave
 * the shared list half written.
 */
export async function replaceBooks(
  env: Env,
  books: Omit<BookRecord, 'id'>[],
  email: string,
): Promise<number> {
  const now = Date.now();
  const statements: D1PreparedStatement[] = [env.DB.prepare('DELETE FROM books')];

  for (let start = 0; start < books.length; start += ROWS_PER_INSERT) {
    const chunk = books.slice(start, start + ROWS_PER_INSERT);
    const values = chunk.map(() => INSERT_PLACEHOLDERS).join(', ');
    const bound = chunk.flatMap((book, offset) =>
      bindValues(crypto.randomUUID(), start + offset + 1, book, now, email),
    );
    statements.push(
      env.DB.prepare(`INSERT INTO books (${COLUMNS}) VALUES ${values}`).bind(...bound),
    );
  }

  await env.DB.batch(statements);
  return books.length;
}

export async function recordImport(
  env: Env,
  input: { fileName: string; r2Key: string; bookCount: number; email: string },
): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO imports (id, file_name, r2_key, book_count, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      crypto.randomUUID(),
      input.fileName,
      input.r2Key,
      input.bookCount,
      Date.now(),
      input.email,
    )
    .run();
}
