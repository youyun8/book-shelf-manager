import { useEffect, useRef, useState } from 'react';
import type { SortDirection, SortField, SortOrder } from '../types';
import {
  moveSortRule,
  sortDirectionLabel,
  sortFieldLabel,
  sortFieldOptions,
  unusedSortFields,
} from '../lib/sort';
import { cn } from '../lib/cn';
import { IconArrowDown, IconArrowUp, IconClose, IconPlus, IconSort } from './icons';

interface SortMenuProps {
  sort: SortOrder;
  onChange: (sort: SortOrder) => void;
}

/** `書名 → 價格`, or the default when nothing is chosen. */
function summarize(sort: SortOrder): string {
  if (sort.length === 0) return '檔案順序';
  return sort.map((rule) => sortFieldLabel(rule.field)).join(' → ');
}

/**
 * Builds the reader's own sort order: as many keys as they like, in the order
 * they should apply. The first key decides, the ones under it only break ties,
 * which is what makes "by name, then by price" possible.
 */
export function SortMenu({ sort, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // A click anywhere else, or Escape, closes the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const available = unusedSortFields(sort);

  const setRule = (index: number, patch: Partial<SortOrder[number]>) =>
    onChange(sort.map((rule, at) => (at === index ? { ...rule, ...patch } : rule)));

  const addRule = () => {
    const next = available[0];
    if (next) onChange([...sort, { field: next, direction: 'asc' }]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="btn py-1.5 text-xs"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <IconSort className="h-4 w-4" />
        <span className="text-fg-subtle">排序</span>
        <span className="max-w-[12rem] truncate font-medium">{summarize(sort)}</span>
        {sort.length > 1 && (
          <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">
            {sort.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="排序方式"
          className="absolute right-0 z-30 mt-2 w-[min(24rem,90vw)] rounded-xl border border-line bg-surface p-4 shadow-card"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">排序方式</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="關閉排序"
              className="focus-ring rounded-lg p-1 text-fg-subtle transition hover:bg-surface-muted hover:text-fg"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-fg-subtle">
            由上往下依序排列：上面的欄位先排，下面的欄位用來排相同的書。
          </p>

          <ol className="mt-3 space-y-2">
            {sort.map((rule, index) => (
              <li key={rule.field} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-center text-xs tabular-nums text-fg-subtle">
                  {index + 1}
                </span>
                <select
                  value={rule.field}
                  aria-label={`第 ${index + 1} 個排序欄位`}
                  onChange={(event) => setRule(index, { field: event.target.value as SortField })}
                  className="field w-auto min-w-0 flex-1 py-1.5 text-xs"
                >
                  {sortFieldOptions(sort, rule.field).map((field) => (
                    <option key={field} value={field}>
                      {sortFieldLabel(field)}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.direction}
                  aria-label={`第 ${index + 1} 個排序方向`}
                  onChange={(event) =>
                    setRule(index, { direction: event.target.value as SortDirection })
                  }
                  className="field w-auto py-1.5 text-xs"
                >
                  {(['asc', 'desc'] satisfies SortDirection[]).map((direction) => (
                    <option key={direction} value={direction}>
                      {sortDirectionLabel({ field: rule.field, direction })}
                    </option>
                  ))}
                </select>
                <StepButton
                  label={`把${sortFieldLabel(rule.field)}往前移`}
                  disabled={index === 0}
                  onClick={() => onChange(moveSortRule(sort, index, -1))}
                >
                  <IconArrowUp className="h-3.5 w-3.5" />
                </StepButton>
                <StepButton
                  label={`把${sortFieldLabel(rule.field)}往後移`}
                  disabled={index === sort.length - 1}
                  onClick={() => onChange(moveSortRule(sort, index, 1))}
                >
                  <IconArrowDown className="h-3.5 w-3.5" />
                </StepButton>
                <StepButton
                  label={`移除${sortFieldLabel(rule.field)}`}
                  onClick={() => onChange(sort.filter((_, at) => at !== index))}
                >
                  <IconClose className="h-3.5 w-3.5" />
                </StepButton>
              </li>
            ))}
          </ol>

          {sort.length === 0 && (
            <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-3 text-xs text-fg-subtle">
              目前照 Excel 檔案的原始順序顯示。
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              className="btn py-1.5 text-xs"
              onClick={addRule}
              disabled={available.length === 0}
            >
              <IconPlus className="h-3.5 w-3.5" />
              加入排序欄位
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={sort.length === 0}
              className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-fg-subtle transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              回到檔案順序
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'focus-ring shrink-0 rounded-md border border-line p-1.5 text-fg-subtle transition',
        'hover:bg-surface-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-35',
      )}
    >
      {children}
    </button>
  );
}
