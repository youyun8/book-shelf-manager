import type { BookInfoState } from '../hooks/useBookInfo';
import { IconExternal, IconSpinner } from './icons';

interface OnlineRecordProps {
  state: BookInfoState;
  onRetry: () => void;
}

/** The looked-up publisher, publication date, page count and blurb. */
export function OnlineRecord({ state, onRetry }: OnlineRecordProps) {
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

  if (state.status === 'missing') {
    return (
      <section className="rounded-xl border border-dashed border-line p-4">
        <p className="text-xs text-fg-subtle">
          在 Google Books 上找不到這本書。在 Excel 補上「ISBN」欄可以提高命中率。
        </p>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="rounded-xl border border-dashed border-line p-4">
        <p className="text-xs text-fg-subtle">{state.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-1.5 rounded text-xs font-medium text-accent hover:underline"
        >
          重新查詢
        </button>
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
        <p className="thin-scroll max-h-40 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-line text-fg-muted">
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
