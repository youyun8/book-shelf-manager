import { useCallback, useEffect, useState } from 'react';
import type { Book } from '../types';
import { cacheKey, lookupBookInfo, LookupError } from '../lib/book-info';
import type { ExternalBookInfo } from '../lib/book-info';

export type BookInfoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; info: ExternalBookInfo }
  | { status: 'missing' }
  | { status: 'error'; message: string };

interface Settled {
  key: string;
  attempt: number;
  state: BookInfoState;
}

/** Looks the open book up on Google Books, once per book, with a retry. */
export function useBookInfo(book: Book | null): { state: BookInfoState; retry: () => void } {
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);

  const key = book && book.title.trim() !== '' ? cacheKey(book) : '';
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!book || key === '') return;

    const controller = new AbortController();
    lookupBookInfo(book, { signal: controller.signal, force: attempt > 0 })
      .then((info) => {
        if (controller.signal.aborted) return;
        setSettled({
          key,
          attempt,
          state: info ? { status: 'found', info } : { status: 'missing' },
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({
          key,
          attempt,
          state: {
            status: 'error',
            message: cause instanceof LookupError ? cause.message : '查詢書籍資料時發生錯誤。',
          },
        });
      });

    return () => controller.abort();
    // `key` identifies the book being looked up; `attempt` forces a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  // Derived rather than stored, so switching books never shows a stale result.
  const state: BookInfoState =
    key === ''
      ? { status: 'idle' }
      : settled && settled.key === key && settled.attempt === attempt
        ? settled.state
        : { status: 'loading' };

  return { state, retry };
}
