import type { Book } from '../types';
import { cn } from '../lib/cn';
import { conditionClass, formatPrice } from '../lib/badge';

const MAX_TAGS = 4;

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
}

export function BookCard({ book, onOpen }: BookCardProps) {
  const credits = [
    book.author && `文 ${book.author}`,
    book.illustrator && `圖 ${book.illustrator}`,
    book.translator && `譯 ${book.translator}`,
  ].filter(Boolean);
  const extraTags = book.tags.length - MAX_TAGS;
  const hasFooter = book.price !== null || book.channel !== '' || book.location !== '';

  return (
    <button
      type="button"
      onClick={() => onOpen(book)}
      className="focus-ring group flex h-full w-full flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug font-semibold text-fg group-hover:text-accent">
          {book.title}
        </h3>
        {book.condition && (
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
              conditionClass(book.condition),
            )}
          >
            {book.condition}
          </span>
        )}
      </div>

      {credits.length > 0 && <p className="-mt-1 text-xs text-fg-muted">{credits.join('　')}</p>}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        {book.publisher && <span className="font-medium text-fg-muted">{book.publisher}</span>}
        {book.ageRange && (
          <span className="rounded bg-surface-muted px-1.5 py-0.5">{book.ageRange}</span>
        )}
      </div>

      {book.summary && (
        <p className="line-clamp-3 text-[13px] leading-relaxed text-fg-muted">{book.summary}</p>
      )}

      {book.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {book.tags.slice(0, MAX_TAGS).map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
          {extraTags > 0 && <li className="chip">+{extraTags}</li>}
        </ul>
      )}

      {hasFooter && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-fg-subtle">
          <span className="font-semibold text-fg tabular-nums">
            {book.price === null ? '' : formatPrice(book.price)}
          </span>
          <span className="flex flex-wrap items-center gap-x-2">
            {book.channel && <span>{book.channel}</span>}
            {book.location && <span className="text-fg-muted">📍 {book.location}</span>}
          </span>
        </div>
      )}
    </button>
  );
}
