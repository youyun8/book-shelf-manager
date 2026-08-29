import { useEffect, useRef } from 'react';
import type { Book } from '../types';
import { FIELD_LABELS } from '../types';
import { cn } from '../lib/cn';
import { statusClass, formatPrice } from '../lib/badge';
import { IconClose, IconPencil } from './icons';

interface BookDialogProps {
  book: Book | null;
  /** The other rows with this title, which are the other copies on the shelf. */
  others: Book[];
  onClose: () => void;
  onEdit: (book: Book) => void;
}

export function BookDialog({ book, others, onClose, onEdit }: BookDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (book && !dialog.open) dialog.showModal();
    if (!book && dialog.open) dialog.close();
  }, [book]);

  // In the reader's field order: what this copy is, then what the book is.
  const rows: { label: string; value: string }[] = book
    ? [
        { label: FIELD_LABELS.channel, value: book.channel },
        { label: FIELD_LABELS.price, value: formatPrice(book.price) },
        { label: FIELD_LABELS.wear, value: book.wear },
        { label: FIELD_LABELS.condition, value: book.condition },
        { label: FIELD_LABELS.location, value: book.location },
        { label: FIELD_LABELS.notes, value: book.notes },
        { label: FIELD_LABELS.author, value: book.author },
        { label: FIELD_LABELS.illustrator, value: book.illustrator },
        { label: FIELD_LABELS.translator, value: book.translator },
        { label: FIELD_LABELS.publisher, value: book.publisher },
        { label: FIELD_LABELS.ageRange, value: book.ageRange },
        { label: FIELD_LABELS.readingMode, value: book.readingMode },
        { label: FIELD_LABELS.isbn, value: book.isbn },
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
              {book.status && (
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium',
                    statusClass(book.status),
                  )}
                >
                  {book.status}
                </span>
              )}
              <button
                type="button"
                onClick={() => onEdit(book)}
                className="btn px-2.5 py-1.5 text-xs"
              >
                <IconPencil className="h-3.5 w-3.5" />
                編輯
              </button>
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

          <div className="px-6 py-5">
            <div className="min-w-0 space-y-5">
              {others.length > 0 && (
                <section className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                  <h3 className="text-xs font-semibold text-fg-subtle">
                    同書名共 {others.length + 1} 本，這是其中一本
                  </h3>
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-fg-muted">
                    {others.map((other) => (
                      <li key={other.id} className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[11px]',
                            statusClass(other.status),
                          )}
                        >
                          {other.status || '未填狀態'}
                        </span>
                        {other.channel && <span>{other.channel}</span>}
                        {other.price !== null && (
                          <span className="tabular-nums">{formatPrice(other.price)}</span>
                        )}
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
                  <h3 className="mb-1.5 text-xs font-semibold text-fg-subtle">建議標籤</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {book.tags.map((tag) => (
                      <li key={tag} className="chip">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
