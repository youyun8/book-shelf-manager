import { Hono } from 'hono';
import type { Env, SessionUser } from './env.d';
import {
  clearFailures,
  clearedCookie,
  createSession,
  deleteSession,
  hashPassword,
  isAllowedEmail,
  isThrottled,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  readSessionCookie,
  recordFailure,
  sessionCookie,
  userForToken,
  verifyPassword,
} from './auth';
import {
  createBook,
  deleteBook,
  listBooks,
  recordImport,
  replaceBooks,
  sanitizeBook,
  updateBook,
} from './books';

type Variables = { user: SessionUser };
interface Credentials {
  email?: string;
  password?: string;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const isSecure = (request: Request) => new URL(request.url).protocol === 'https:';

/**
 * Defence in depth against cross-site writes. The session cookie is SameSite=Lax,
 * so a browser will not attach it to a cross-site POST in the first place; this
 * refuses the request outright if one ever arrives.
 */
app.use('/api/*', async (context, next) => {
  const method = context.req.method;
  if (method === 'GET' || method === 'HEAD') return next();
  const origin = context.req.header('Origin');
  if (origin) {
    const target = new URL(context.req.url);
    if (new URL(origin).host !== target.host) {
      return context.json({ error: '請求來源不正確。' }, 403);
    }
  }
  await next();
});

/** Reject anything that is not signed in before it can reach book data. */
app.use('/api/books/*', async (context, next) => {
  const token = readSessionCookie(context.req.raw);
  const user = token ? await userForToken(context.env, token) : null;
  if (!user) return context.json({ error: '請先登入。' }, 401);
  context.set('user', user);
  await next();
});
app.use('/api/books', async (context, next) => {
  const token = readSessionCookie(context.req.raw);
  const user = token ? await userForToken(context.env, token) : null;
  if (!user) return context.json({ error: '請先登入。' }, 401);
  context.set('user', user);
  await next();
});

app.get('/api/auth/me', async (context) => {
  const token = readSessionCookie(context.req.raw);
  const user = token ? await userForToken(context.env, token) : null;
  if (!user) return context.json({ user: null }, 200);
  return context.json({ user: { email: user.email } });
});

app.post('/api/auth/register', async (context) => {
  const body = await context.req.json<Credentials>().catch((): Credentials => ({}));
  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';

  if (!isValidEmail(email)) return context.json({ error: '請輸入有效的 Email。' }, 400);
  const problem = passwordProblem(password);
  if (problem) return context.json({ error: problem }, 400);

  if (!(await isAllowedEmail(context.env, email))) {
    return context.json({ error: '這個 Email 不在允許名單中，請聯絡管理者。' }, 403);
  }

  const existing = await context.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string }>();
  if (existing) return context.json({ error: '這個 Email 已經註冊過了，請直接登入。' }, 409);

  const id = crypto.randomUUID();
  await context.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, email, await hashPassword(password), Date.now(), Date.now())
    .run();

  const token = await createSession(context.env, id);
  context.header('Set-Cookie', sessionCookie(token, isSecure(context.req.raw)));
  return context.json({ user: { email } }, 201);
});

app.post('/api/auth/login', async (context) => {
  const body = await context.req.json<Credentials>().catch((): Credentials => ({}));
  const email = normalizeEmail(body.email ?? '');
  const password = body.password ?? '';
  if (!isValidEmail(email) || password === '') {
    return context.json({ error: '請輸入 Email 與密碼。' }, 400);
  }

  if (await isThrottled(context.env, email)) {
    return context.json({ error: '嘗試次數過多，請 15 分鐘後再試。' }, 429);
  }

  const user = await context.env.DB.prepare(
    'SELECT id, email, password_hash FROM users WHERE email = ?',
  )
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();

  // The same reply for an unknown address and a wrong password, so the form
  // cannot be used to find out who has an account.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordFailure(context.env, email);
    return context.json({ error: 'Email 或密碼不正確。' }, 401);
  }

  await clearFailures(context.env, email);
  await context.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(Date.now(), user.id)
    .run();

  const token = await createSession(context.env, user.id);
  context.header('Set-Cookie', sessionCookie(token, isSecure(context.req.raw)));
  return context.json({ user: { email: user.email } });
});

app.post('/api/auth/logout', async (context) => {
  const token = readSessionCookie(context.req.raw);
  if (token) await deleteSession(context.env, token);
  context.header('Set-Cookie', clearedCookie(isSecure(context.req.raw)));
  return context.body(null, 204);
});

app.get('/api/books', async (context) => {
  const books = await listBooks(context.env);
  return context.json({ books });
});

app.post('/api/books', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const book = await createBook(context.env, sanitizeBook(body), context.get('user').email);
  return context.json({ book }, 201);
});

app.patch('/api/books/:id', async (context) => {
  const body = await context.req.json().catch(() => ({}));
  const book = await updateBook(
    context.env,
    context.req.param('id'),
    sanitizeBook(body),
    context.get('user').email,
  );
  if (!book) return context.json({ error: '找不到這本書。' }, 404);
  return context.json({ book });
});

app.delete('/api/books/:id', async (context) => {
  const removed = await deleteBook(context.env, context.req.param('id'));
  if (!removed) return context.json({ error: '找不到這本書。' }, 404);
  return context.body(null, 204);
});

/**
 * Replaces the shared library with the rows of an uploaded spreadsheet. The
 * browser parses the file (it already knows how) and sends both the parsed rows
 * and the original file, which is archived in R2.
 */
app.post('/api/books/import', async (context) => {
  const email = context.get('user').email;
  const form = await context.req.formData().catch(() => null);
  if (!form) return context.json({ error: '上傳格式不正確。' }, 400);

  const raw = form.get('books');
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : '');
  } catch {
    return context.json({ error: '上傳格式不正確。' }, 400);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return context.json({ error: '這份檔案沒有可匯入的書籍。' }, 400);
  }
  if (parsed.length > 5000) {
    return context.json({ error: '一次最多匯入 5000 本書。' }, 413);
  }

  const books = parsed.map(sanitizeBook);
  const file = form.get('file');
  const fileName =
    typeof form.get('fileName') === 'string' ? String(form.get('fileName')) : '書單.xlsx';

  let r2Key = '';
  if (file instanceof File && context.env.UPLOADS) {
    r2Key = `imports/${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.xlsx`;
    await context.env.UPLOADS.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      customMetadata: { fileName, uploadedBy: email },
    });
  }

  const count = await replaceBooks(context.env, books, email);
  await recordImport(context.env, { fileName, r2Key, bookCount: count, email });
  return context.json({ imported: count });
});

app.all('/api/*', (context) => context.json({ error: 'Not found' }, 404));

// Everything else is the single page app, served from the assets binding.
app.all('*', (context) => context.env.ASSETS.fetch(context.req.raw));

export default app;
