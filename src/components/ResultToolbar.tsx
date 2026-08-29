import type { PageSize, SortOrder, ViewMode } from '../types';
import { PAGE_SIZES } from '../types';
import { cn } from '../lib/cn';
import { SortMenu } from './SortMenu';
import { IconFilter, IconGrid, IconList } from './icons';

interface ResultToolbarProps {
  shown: number;
  total: number;
  /** 1-based range of the current page inside the filtered result. */
  range: { from: number; to: number };
  sort: SortOrder;
  view: ViewMode;
  pageSize: PageSize;
  activeFilterCount: number;
  onSortChange: (sort: SortOrder) => void;
  onViewChange: (view: ViewMode) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  onOpenFilters: () => void;
}

function pageSizeLabel(size: PageSize): string {
  return size === 'all' ? '全部' : String(size);
}

export function ResultToolbar({
  shown,
  total,
  range,
  sort,
  view,
  pageSize,
  activeFilterCount,
  onSortChange,
  onViewChange,
  onPageSizeChange,
  onOpenFilters,
}: ResultToolbarProps) {
  const paged = shown > 0 && (range.from !== 1 || range.to !== shown);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button type="button" className="btn lg:hidden" onClick={onOpenFilters}>
          <IconFilter className="h-4 w-4" />
          篩選
          {activeFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">
              {activeFilterCount}
            </span>
          )}
        </button>
        <p className="text-sm text-fg-muted">
          {paged && (
            <span className="tabular-nums">
              第 {range.from}–{range.to} 本，
            </span>
          )}
          共 <span className="font-semibold text-fg tabular-nums">{shown}</span> 本
          {shown !== total && <span className="text-fg-subtle">（全部 {total} 本）</span>}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <SortMenu sort={sort} onChange={onSortChange} />

        <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
          每頁
          <select
            value={String(pageSize)}
            onChange={(event) => {
              const raw = event.target.value;
              onPageSizeChange(raw === 'all' ? 'all' : (Number(raw) as PageSize));
            }}
            className="field w-auto py-1.5 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {pageSizeLabel(size)}
              </option>
            ))}
          </select>
        </label>

        <div
          className="flex items-center rounded-lg border border-line bg-surface p-0.5"
          role="group"
          aria-label="檢視方式"
        >
          {(
            [
              { value: 'grid' as const, label: '卡片檢視', Icon: IconGrid },
              { value: 'table' as const, label: '表格檢視', Icon: IconList },
            ] satisfies { value: ViewMode; label: string; Icon: typeof IconGrid }[]
          ).map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={view === value}
              onClick={() => onViewChange(value)}
              className={cn(
                'focus-ring rounded-md p-1.5 transition',
                view === value
                  ? 'bg-accent text-accent-fg'
                  : 'text-fg-subtle hover:bg-surface-muted hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
