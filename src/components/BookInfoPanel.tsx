import { useState } from 'react';
import type { Book } from '../types';
import type { BookInfoState } from '../hooks/useBookInfo';
import { openLibraryCover, shopLinks } from '../lib/book-info';
import { IconExternal, IconSpinner } from './icons';

interface BookCoverProps {
  book: Book;
  state: BookInfoState;
}

/**
 * Cover sources in order of trust: the sheet's own URL, the looked-up cover,
 * then Open Library by ISBN, which needs no key and no quota. Each image that
 * fails to load moves on to the next one.
 */
function BookCover({ book, state }: BookCoverProps) {
  const found = state.status === 'found' ? state.info.coverUrl : '';
  const candidates = [book.coverUrl, found, openLibraryCover(book.isbn)].filter(
    (url) => url !== '',
  );
  // Tracking failed URLs (rather than a counter) resets by itself when the
  // dialog moves to another book.
  const [failed, setFailed] = useState<string[]>([]);
  const source = candidates.find((url) => !failed.includes(url)) ?? '';

  if (source !== '') {
    return (
      <img
        src={source}
        alt={`《${book.title}》封面`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed((current) => [...current, source])}
        className="max-h-64 w-full rounded-lg border border-line bg-surface-muted object-contain shadow-card"
      />
    );
  }

  return (
    <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-line bg-surface-muted text-center">
      {state.status === 'loading' ? (
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <IconSpinner className="h-4 w-4" /> 讀取封面…
        </span>
      ) : (
        <span className="px-3 text-xs text-fg-subtle">沒有封面圖片</span>
      )}
    </div>
  );
}

interface BookInfoPanelProps {
  book: Book;
  state: BookInfoState;
  onRetry: () => void;
  onSaveCover: (coverUrl: string) => void;
}

/** Cover, shop links and the Google Books record for one book. */
export function BookInfoPanel({ book, state, onRetry, onSaveCover }: BookInfoPanelProps) {
  // Offer to keep a looked-up cover, so the shared record stops depending on
  // the API being reachable from whoever opens the book next.
  const foundCover = state.status === 'found' ? state.info.coverUrl : '';
  const canSaveCover = foundCover !== '' && book.coverUrl !== foundCover;

  return (
    <div className="space-y-3">
      <BookCover book={book} state={state} />

      {canSaveCover && (
        <button
          type="button"
          onClick={() => onSaveCover(foundCover)}
          className="btn w-full px-2.5 py-1.5 text-xs"
        >
          把這張封面存進書單
        </button>
      )}

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-1">
        {shopLinks(book).map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn justify-between px-2.5 py-1.5 text-xs"
          >
            {link.label}
            <IconExternal className="h-3.5 w-3.5 text-fg-subtle" />
          </a>
        ))}
      </div>

      {state.status === 'error' && (
        <div className="rounded-lg border border-line bg-surface-muted p-2.5 text-xs text-fg-muted">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring mt-1.5 rounded font-medium text-accent hover:underline"
          >
            重新查詢
          </button>
        </div>
      )}
    </div>
  );
}

interface OnlineRecordProps {
  state: BookInfoState;
}

/** The looked-up publisher, publication date, page count and blurb. */
export function OnlineRecord({ state }: OnlineRecordProps) {
  if (state.status === 'idle') return null;

  if (state.status === 'loading') {
    return (
      <section className="rounded-xl border border-line bg-surface-muted p-4">
        <p className="flex items-center gap-2 text-xs text-fg-subtle">
          <IconSpinner className="h-3.5 w-3.5" /> 正在查詢網路書籍資料…
        </p>
      </section>
    );
  }

  if (state.status === 'missing' || state.status === 'error') {
    return (
      <section className="rounded-xl border border-dashed border-line p-4">
        <p className="text-xs text-fg-subtle">
          {state.status === 'missing'
            ? '在 Google Books 上找不到這本書。可用書店連結自行搜尋，或在 Excel 補上「ISBN」欄提高命中率、用「封面連結」欄自訂封面圖片。'
            : '暫時取得不到網路資料。可用書店連結自行搜尋；若經常發生，建議在電腦上執行 npm run data:covers 先把書封查好。'}
        </p>
      </section>
    );
  }

  const { info } = state;
  const facts = [
    { label: '出版社', value: info.publisher },
    { label: '出版日期', value: info.publishedDate },
    { label: '頁數', value: info.pageCount === null ? '' : `${info.pageCount} 頁` },
    { label: 'ISBN', value: info.isbn },
  ].filter((fact) => fact.value !== '');

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">
            {info.title}
            {info.subtitle && <span className="text-fg-muted">：{info.subtitle}</span>}
          </h3>
          {info.authors.length > 0 && (
            <p className="mt-0.5 text-xs text-fg-muted">{info.authors.join('、')}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] text-fg-subtle">Google Books</span>
      </div>

      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {facts.map((fact) => (
            <div key={fact.label} className="flex gap-1">
              <dt className="text-fg-subtle">{fact.label}</dt>
              <dd className="text-fg-muted">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {info.description && (
        <p className="max-h-40 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-line text-fg-muted thin-scroll">
          {info.description}
        </p>
      )}

      {info.infoLink && (
        <a
          href={info.infoLink}
          target="_blank"
          rel="noreferrer noopener"
          className="focus-ring inline-flex items-center gap-1 rounded text-xs font-medium text-accent hover:underline"
        >
          在 Google Books 查看
          <IconExternal className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  );
}
