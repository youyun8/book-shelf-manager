import type { Book } from '../types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('無法連線到伺服器，請確認網路後再試。', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new ApiError(payload?.error ?? `請求失敗（HTTP ${response.status}）。`, response.status);
  }
  return payload as T;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export interface Account {
  email: string;
}

export const api = {
  session: () => request<{ user: Account | null }>('/api/auth/me'),

  login: (email: string, password: string) =>
    request<{ user: Account }>('/api/auth/login', jsonBody({ email, password })),

  register: (email: string, password: string) =>
    request<{ user: Account }>('/api/auth/register', jsonBody({ email, password })),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  /** Asks for a reset link. The reply never reveals whether the account exists. */
  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot', jsonBody({ email })),

  resetPassword: (token: string, password: string) =>
    request<{ email: string }>('/api/auth/reset', jsonBody({ token, password })),

  listBooks: () => request<{ books: Book[] }>('/api/books'),

  createBook: (book: Omit<Book, 'id'>) => request<{ book: Book }>('/api/books', jsonBody(book)),

  updateBook: (id: string, book: Omit<Book, 'id'>) =>
    request<{ book: Book }>(`/api/books/${encodeURIComponent(id)}`, {
      ...jsonBody(book),
      method: 'PATCH',
    }),

  deleteBook: (id: string) =>
    request<void>(`/api/books/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** Replaces the shared library and archives the original file. */
  importBooks: (file: File, books: Book[]) => {
    const form = new FormData();
    form.set('file', file);
    form.set('fileName', file.name);
    form.set('books', JSON.stringify(books));
    return request<{ imported: number }>('/api/books/import', { method: 'POST', body: form });
  },
};
