import type { Book } from '../types';
import { cn } from '../lib/cn';
import { conditionClass, formatPrice } from '../lib/badge';

interface BookTableProps {
  books: Book[];
  onOpen: (book: Book) => void;
}

const HEADERS = [
  '書名',
  '作者',
  '繪者',
  '出版社',
  '適讀年齡',
  '分類標籤',
  '購入管道',
  '價格',
  '書況',
  '藏書位置',
];

export function BookTable({ books, onOpen }: BookTableProps) {
  return (
    <div className="thin-scroll overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-muted text-left">
            {HEADERS.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-fg-muted"
              >
                {header}
              </th>
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
              <td className="px-3 py-2.5 text-fg-muted">{book.tags.join('、') || '—'}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">{book.channel || '—'}</td>
              <td className="px-3 py-2.5 whitespace-nowrap tabular-nums text-fg">
                {formatPrice(book.price)}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {book.condition ? (
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      conditionClass(book.condition),
                    )}
                  >
                    {book.condition}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                {book.location || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
