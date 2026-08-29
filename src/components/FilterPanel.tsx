import type { FacetKey, FacetOption, Filters, TextKey } from '../types';
import { FACET_KEYS, FACET_LABELS, TEXT_KEYS, TEXT_LABELS } from '../types';
import { FacetSection } from './FacetSection';
import { IconClose, IconPanelCollapse, IconSearch } from './icons';

interface FilterPanelProps {
  filters: Filters;
  facets: Record<FacetKey, FacetOption[]>;
  activeCount: number;
  onToggleFacet: (key: FacetKey, value: string) => void;
  onClearFacet: (key: FacetKey) => void;
  onChangeText: (key: TextKey, value: string) => void;
  onReset: () => void;
  /** Renders a close button. Only the mobile drawer passes this. */
  onClose?: () => void;
  /** Renders a collapse button. Only the sidebar passes this. */
  onCollapse?: () => void;
}

const TEXT_PLACEHOLDERS: Record<TextKey, string> = {
  title: '輸入書名關鍵字',
  author: '輸入作者姓名',
  illustrator: '輸入繪者姓名',
};

export function FilterPanel({
  filters,
  facets,
  activeCount,
  onToggleFacet,
  onClearFacet,
  onChangeText,
  onReset,
  onClose,
  onCollapse,
}: FilterPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="text-sm font-semibold text-fg">篩選條件</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onReset}
            disabled={activeCount === 0}
            className="focus-ring rounded px-1.5 py-0.5 text-xs font-medium text-fg-subtle transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            全部清除
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="收合篩選欄"
              title="收合篩選欄"
              className="focus-ring rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-muted hover:text-fg"
            >
              <IconPanelCollapse className="h-5 w-5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉篩選"
              className="focus-ring rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-muted hover:text-fg"
            >
              <IconClose className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <section className="space-y-3 border-b border-line py-4">
          {TEXT_KEYS.map((key) => (
            <div key={key}>
              <label
                htmlFor={`filter-${key}`}
                className="mb-1 block text-xs font-medium text-fg-muted"
              >
                {TEXT_LABELS[key]}
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
        </section>

        {FACET_KEYS.map((key) => (
          <FacetSection
            key={key}
            label={FACET_LABELS[key]}
            options={facets[key]}
            onToggle={(value) => onToggleFacet(key, value)}
            onClear={() => onClearFacet(key)}
          />
        ))}
      </div>
    </div>
  );
}
