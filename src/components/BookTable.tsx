import type { Book, SortField, SortOrder } from '../types';
import { FIELD_LABELS } from '../types';
import { cn } from '../lib/cn';
import { statusClass, formatPrice } from '../lib/badge';
import { sortDirectionLabel, sortFieldLabel } from '../lib/sort';
import { IconArrowDown, IconArrowUp } from './icons';

interface BookTableProps {
  books: Book[];
  sort: SortOrder;
  /** Makes this column the first sort key, or flips it when it already is. */
  onSortBy: (field: SortField) => void;
  onOpen: (book: Book) => void;
}

/**
 * The table in the reader's own field order. Every column is sortable except
 * the tags, which a book can have many of. 譯者, 內容簡介 and 備註 are left to
 * the detail view, where there is room for their length.
 */
const COLUMNS: { field?: SortField; label?: string }[] = [
  { field: 'title' },
  { field: 'status' },
  { field: 'channel' },
  { field: 'price' },
  { field: 'wear' },
  { field: 'condition' },
  { field: 'location' },
  { field: 'author' },
  { field: 'illustrator' },
  { field: 'publisher' },
  { field: 'ageRange' },
  { field: 'readingMode' },
  { label: FIELD_LABELS.tags },
];

export function BookTable({ books, sort, onSortBy, onOpen }: BookTableProps) {
  return (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-muted text-left">
            {COLUMNS.map((column) => (
              <SortableHeader
                key={column.field ?? column.label}
                column={column}
                sort={sort}
                onSortBy={onSortBy}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr
              key={book.id}
              onClick={() => onOpen(book)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(book);
                }
              }}
              className="focus-ring cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-muted"
            >
              <th scope="row" className="max-w-[260px] px-3 py-2.5 text-left font-medium text-fg">
                {book.title}
              </th>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {book.status ? (
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      statusClass(book.status),
                    )}
                  >
                    {book.status}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">{book.channel || '—'}</td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-fg">
                {formatPrice(book.price)}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">{book.wear || '—'}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.condition || '—'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.location || '—'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">{book.author || '—'}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.illustrator || '—'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.publisher || '—'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.ageRange || '—'}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.readingMode || '—'}
              </td>
              <td className="px-3 py-2.5 text-fg-muted">{book.tags.join('、') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SortableHeaderProps {
  column: { field?: SortField; label?: string };
  sort: SortOrder;
  onSortBy: (field: SortField) => void;
}

/**
 * A header that also says where its column stands in the sort: the arrow shows
 * the direction, and the small number appears once more than one key is in use,
 * so a reader can see that the list is by name and then by price.
 */
function SortableHeader({ column, sort, onSortBy }: SortableHeaderProps) {
  const { field } = column;
  const label = field ? FIELD_LABELS[field] : (column.label ?? '');
  const at = field ? sort.findIndex((rule) => rule.field === field) : -1;
  const rule = at === -1 ? undefined : sort[at];
  const ariaSort = rule ? (rule.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-fg-muted"
    >
      {field === undefined ? (
        label
      ) : (
        <button
          type="button"
          onClick={() => onSortBy(field)}
          title={rule ? `${sortFieldLabel(field)}：${sortDirectionLabel(rule)}` : `依${label}排序`}
          className={cn(
            'focus-ring -mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition hover:text-accent',
            rule && 'text-accent',
          )}
        >
          {label}
          {rule &&
            (rule.direction === 'asc' ? (
              <IconArrowUp className="h-3 w-3" />
            ) : (
              <IconArrowDown className="h-3 w-3" />
            ))}
          {rule && sort.length > 1 && <span className="text-[10px] tabular-nums">{at + 1}</span>}
        </button>
      )}
    </th>
  );
}
