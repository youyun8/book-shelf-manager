import { useMemo, useState } from 'react';
import type { FacetOption } from '../types';
import { cn } from '../lib/cn';
import { IconChevron, IconSearch } from './icons';

const VISIBLE_LIMIT = 10;
const SEARCHABLE_FROM = 12;

interface FacetSectionProps {
  label: string;
  options: FacetOption[];
  onToggle: (value: string) => void;
  onClear: () => void;
}

export function FacetSection({ label, options, onToggle, onClear }: FacetSectionProps) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const selectedCount = options.filter((option) => option.selected).length;
  const searchable = options.length >= SEARCHABLE_FROM;

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter((option) => option.value.toLowerCase().includes(needle));
  }, [options, query]);

  const visible = expanded || query !== '' ? matching : matching.slice(0, VISIBLE_LIMIT);
  const hiddenCount = matching.length - visible.length;

  if (options.length === 0) return null;

  return (
    <section className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="focus-ring -ml-1 flex flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <IconChevron
            className={cn('h-4 w-4 text-fg-subtle transition-transform', !open && '-rotate-90')}
          />
          <span className="text-sm font-semibold text-fg">{label}</span>
          {selectedCount > 0 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-fg">
              {selectedCount}
            </span>
          )}
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            className="focus-ring rounded px-1 text-xs text-fg-subtle hover:text-accent"
            onClick={onClear}
          >
            清除
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {searchable && (
            <div className="relative">
              <IconSearch className="pointer-events-none absolute top-2.5 left-2.5 h-3.5 w-3.5 text-fg-subtle" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`搜尋${label}`}
                aria-label={`搜尋${label}選項`}
                className="field py-1.5 pl-8 text-xs"
              />
            </div>
          )}

          <ul className="thin-scroll max-h-72 space-y-0.5 overflow-y-auto pr-1">
            {visible.map((option) => (
              <li key={option.value}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition hover:bg-surface-muted',
                    option.count === 0 && !option.selected && 'opacity-45',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={option.selected}
                    onChange={() => onToggle(option.value)}
                    className="focus-ring h-4 w-4 shrink-0 rounded border-line-strong accent-[var(--app-accent)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-fg" title={option.value}>
                    {option.value}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                    {option.count}
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-1.5 py-2 text-xs text-fg-subtle">沒有符合的選項</li>
            )}
          </ul>

          {hiddenCount > 0 && (
            <button
              type="button"
              className="focus-ring rounded px-1.5 text-xs font-medium text-accent hover:underline"
              onClick={() => setExpanded(true)}
            >
              顯示其他 {hiddenCount} 項
            </button>
          )}
          {expanded && matching.length > VISIBLE_LIMIT && query === '' && (
            <button
              type="button"
              className="focus-ring rounded px-1.5 text-xs font-medium text-accent hover:underline"
              onClick={() => setExpanded(false)}
            >
              收合
            </button>
          )}
        </div>
      )}
    </section>
  );
}
