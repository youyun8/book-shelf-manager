import type { FacetKey, FacetOption, Filters, TextKey } from '../types';
import { FACET_KEYS, FIELD_LABELS, TEXT_KEYS } from '../types';
import { FacetSection } from './FacetSection';
import { IconSearch } from './icons';

interface FiltersPageProps {
  filters: Filters;
  facets: Record<FacetKey, FacetOption[]>;
  activeCount: number;
  /** How many books the current selection leaves, and how many there are. */
  shown: number;
  total: number;
  onToggleFacet: (key: FacetKey, value: string) => void;
  onClearFacet: (key: FacetKey) => void;
  onChangeText: (key: TextKey, value: string) => void;
  onReset: () => void;
  onDone: () => void;
}

const TEXT_PLACEHOLDERS: Record<TextKey, string> = {
  title: '輸入書名關鍵字',
  author: '輸入作者姓名',
  illustrator: '輸入繪者姓名',
};

/**
 * The filters on their own page. Every condition is visible at once here,
 * rather than in a column beside the books, so the result count travels with
 * the reader: it sits in the bar that takes them back to the list.
 */
export function FiltersPage({
  filters,
  facets,
  activeCount,
  shown,
  total,
  onToggleFacet,
  onClearFacet,
  onChangeText,
  onReset,
  onDone,
}: FiltersPageProps) {
  return (
    <main className="page-shell px-4 py-6 sm:px-6">
      <div className="sticky top-[3.75rem] z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-fg">篩選條件</h2>
          <p className="text-xs text-fg-subtle">
            符合 <span className="font-semibold text-fg tabular-nums">{shown}</span> 本
            <span className="text-fg-subtle">（全部 {total} 本）</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={onReset} disabled={activeCount === 0}>
            全部清除
          </button>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            查看 {shown} 筆結果
          </button>
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-fg">關鍵字</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_KEYS.map((key) => (
            <div key={key}>
              <label
                htmlFor={`filter-${key}`}
                className="mb-1 block text-xs font-medium text-fg-muted"
              >
                {FIELD_LABELS[key]}
              </label>
              <div className="relative">
                <IconSearch className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-fg-subtle" />
                <input
                  id={`filter-${key}`}
                  type="search"
                  value={filters.text[key]}
                  onChange={(event) => onChangeText(key, event.target.value)}
                  placeholder={TEXT_PLACEHOLDERS[key]}
                  className="field pl-8"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {FACET_KEYS.map((key) => (
          <FacetSection
            key={key}
            label={FIELD_LABELS[key]}
            options={facets[key]}
            onToggle={(value) => onToggleFacet(key, value)}
            onClear={() => onClearFacet(key)}
          />
        ))}
      </div>
    </main>
  );
}
