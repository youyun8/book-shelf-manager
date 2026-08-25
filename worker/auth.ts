import type { Env, SessionUser } from './env.d';

export type { SessionUser };

/**
 * Password hashing uses PBKDF2 through WebCrypto, the strongest primitive
 * available on Workers without shipping WASM.
 *
 * The count is chosen to fit the 10 ms CPU budget of the Workers free plan; on
 * the paid plan raise it to 100_000 or more. Because the number is stored with
 * each hash, changing it here only affects passwords set afterwards — nobody
 * gets locked out.
 */
const PBKDF2_ITERATIONS = 25_000;
const KEY_LENGTH_BITS = 256;
const SESSION_DAYS = 30;
export const RESET_MINUTES = 60;
const SESSION_COOKIE = 'bsm_session';
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Base64url, so the token can sit in a link without escaping. */
function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_LENGTH_BITS,
  );
  return toBase64(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${hash}`;
}

/** Constant-time compare, so a wrong password cannot be timed out character by character. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false;
  const candidate = await derive(password, fromBase64(salt), Number(iterations));
  return timingSafeEqual(candidate, hash);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/** Long enough to matter, short enough that a family will actually use it. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return '密碼至少需要 10 個字元。';
  if (password.length > 200) return '密碼過長。';
  return null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toBase64(digest);
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .run();
  return token;
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(await sha256(token))
    .run();
}

export function readSessionCookie(request: Request): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookie(token: string, secure: boolean): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) flags.push('Secure');
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${flags.join('; ')}`;
}

export function clearedCookie(secure: boolean): string {
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) flags.push('Secure');
  return `${SESSION_COOKIE}=; ${flags.join('; ')}`;
}

export async function userForToken(env: Env, token: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    `SELECT users.id AS id, users.email AS email, sessions.expires_at AS expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?`,
  )
    .bind(await sha256(token))
    .first<{ id: string; email: string; expires_at: number }>();

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    await deleteSession(env, token);
    return null;
  }
  return { id: row.id, email: row.email };
}

export async function isAllowedEmail(env: Env, email: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT email FROM allowed_emails WHERE email = ?')
    .bind(email)
    .first<{ email: string }>();
  return row !== null;
}

/** Returns true when the caller should be turned away without checking the password. */
export async function isThrottled(env: Env, key: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT failures, window_start FROM login_attempts WHERE key = ?',
  )
    .bind(key)
    .first<{ failures: number; window_start: number }>();
  if (!row) return false;
  if (Date.now() - row.window_start > FAILURE_WINDOW_MS) return false;
  return row.failures >= MAX_FAILURES;
}

export async function recordFailure(env: Env, key: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO login_attempts (key, failures, window_start) VALUES (?, 1, ?)
     ON CONFLICT (key) DO UPDATE SET
       failures = CASE WHEN ? - login_attempts.window_start > ? THEN 1 ELSE login_attempts.failures + 1 END,
       window_start = CASE WHEN ? - login_attempts.window_start > ? THEN ? ELSE login_attempts.window_start END`,
  )
    .bind(key, now, now, FAILURE_WINDOW_MS, now, FAILURE_WINDOW_MS, now)
    .run();
}

export async function clearFailures(env: Env, key: string): Promise<void> {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}

/**
 * Issues a single-use password reset token. Only its hash is stored, and any
 * earlier unused token for the same account is dropped so a forwarded old mail
 * cannot be replayed.
 */
export async function createPasswordReset(env: Env, userId: string): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL')
    .bind(userId)
    .run();
  await env.DB.prepare(
    'INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256(token), userId, now, now + RESET_MINUTES * 60 * 1000)
    .run();
  return token;
}

/**
 * Spends a reset token: sets the new password, marks the token used and signs
 * every device out, because whoever asked for the reset may have lost a device.
 */
export async function consumePasswordReset(
  env: Env,
  token: string,
  password: string,
): Promise<{ email: string } | null> {
  const hash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT password_resets.user_id AS user_id, password_resets.expires_at AS expires_at,
            password_resets.used_at AS used_at, users.email AS email
     FROM password_resets JOIN users ON users.id = password_resets.user_id
     WHERE password_resets.token_hash = ?`,
  )
    .bind(hash)
    .first<{ user_id: string; expires_at: number; used_at: number | null; email: string }>();

  if (!row || row.used_at !== null || row.expires_at < Date.now()) return null;

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(
      await hashPassword(password),
      row.user_id,
    ),
    env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').bind(now, hash),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id),
  ]);
  return { email: row.email };
}
