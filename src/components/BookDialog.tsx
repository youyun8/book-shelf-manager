import { useEffect, useRef } from 'react';
import type { Book } from '../types';
import { cn } from '../lib/cn';
import { conditionClass, formatPrice } from '../lib/badge';
import { useBookInfo } from '../hooks/useBookInfo';
import { BookInfoPanel, OnlineRecord } from './BookInfoPanel';
import { IconClose } from './icons';

interface BookDialogProps {
  book: Book | null;
  onClose: () => void;
}

export function BookDialog({ book, onClose }: BookDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { state, retry } = useBookInfo(book);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (book && !dialog.open) dialog.showModal();
    if (!book && dialog.open) dialog.close();
  }, [book]);

  const rows: { label: string; value: string }[] = book
    ? [
        { label: '作者', value: book.author },
        { label: '繪者', value: book.illustrator },
        { label: '譯者', value: book.translator },
        { label: '出版社', value: book.publisher },
        { label: '適讀年齡', value: book.ageRange },
        { label: '購入管道', value: book.channel },
        { label: '購入價格', value: formatPrice(book.price) },
        { label: '藏書位置', value: book.location },
        { label: 'ISBN', value: book.isbn },
        ...Object.entries(book.extras).map(([label, value]) => ({ label, value })),
      ].filter((row) => row.value !== '' && row.value !== '—')
    : [];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(54rem,94vw)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-card backdrop:bg-black/40"
    >
      {book && (
        <div className="thin-scroll max-h-[85vh] overflow-y-auto">
          <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-surface px-6 py-5">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-fg">{book.title}</h2>
              {book.publisher && <p className="mt-1 text-sm text-fg-muted">{book.publisher}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {book.condition && (
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium',
                    conditionClass(book.condition),
                  )}
                >
                  {book.condition}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="focus-ring rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-muted hover:text-fg"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex flex-col gap-6 px-6 py-5 sm:flex-row">
            <div className="w-full shrink-0 sm:w-44">
              <BookInfoPanel book={book} state={state} onRetry={retry} />
            </div>

            <div className="min-w-0 flex-1 space-y-5">
              {book.summary && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold text-fg-subtle">內容簡介</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line text-fg-muted">
                    {book.summary}
                  </p>
                </section>
              )}

              {book.tags.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-xs font-semibold text-fg-subtle">分類標籤</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {book.tags.map((tag) => (
                      <li key={tag} className="chip">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {rows.map((row) => (
                  <div key={row.label} className="border-b border-line pb-2">
                    <dt className="text-xs text-fg-subtle">{row.label}</dt>
                    <dd className="mt-0.5 text-sm text-fg">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <OnlineRecord state={state} />
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
