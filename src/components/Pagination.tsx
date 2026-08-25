import { pageWindow } from '../lib/pagination';
import { cn } from '../lib/cn';
import { IconChevron } from './icons';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const items = pageWindow(page, pageCount);

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2" aria-label="分頁">
      <button
        type="button"
        className="btn px-2.5 py-1.5 text-xs"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        <IconChevron className="h-3.5 w-3.5 rotate-90" />
        上一頁
      </button>

      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-xs text-fg-subtle">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`第 ${item} 頁`}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onPageChange(item)}
            className={cn(
              'focus-ring min-w-8 rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums transition',
              item === page
                ? 'border-transparent bg-accent text-accent-fg'
                : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:bg-surface-muted',
            )}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className="btn px-2.5 py-1.5 text-xs"
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        下一頁
        <IconChevron className="h-3.5 w-3.5 -rotate-90" />
      </button>
    </nav>
  );
}
