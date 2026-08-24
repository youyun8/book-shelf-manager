import type { FacetKey, Filters, TextKey } from '../types';
import { FACET_KEYS, FACET_LABELS, TEXT_KEYS, TEXT_LABELS } from '../types';
import { IconClose } from './icons';

interface ActiveFiltersProps {
  filters: Filters;
  onRemoveFacet: (key: FacetKey, value: string) => void;
  onClearText: (key: TextKey) => void;
  onReset: () => void;
}

export function ActiveFilters({
  filters,
  onRemoveFacet,
  onClearText,
  onReset,
}: ActiveFiltersProps) {
  const facetChips = FACET_KEYS.flatMap((key) =>
    filters.facets[key].map((value) => ({ key, value })),
  );
  const textChips = TEXT_KEYS.filter((key) => filters.text[key].trim() !== '');

  if (facetChips.length === 0 && textChips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {textChips.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onClearText(key)}
          className="focus-ring inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-fg-muted transition hover:border-line-strong hover:text-fg"
        >
          <span className="text-fg-subtle">{TEXT_LABELS[key]}：</span>
          {filters.text[key]}
          <IconClose className="h-3 w-3" />
        </button>
      ))}
      {facetChips.map(({ key, value }) => (
        <button
          key={`${key}:${value}`}
          type="button"
          onClick={() => onRemoveFacet(key, value)}
          className="focus-ring inline-flex items-center gap-1 rounded-full border border-transparent bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition hover:brightness-95"
        >
          <span className="opacity-70">{FACET_LABELS[key]}：</span>
          {value}
          <IconClose className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onReset}
        className="focus-ring rounded px-1.5 py-0.5 text-xs text-fg-subtle underline-offset-2 hover:text-accent hover:underline"
      >
        全部清除
      </button>
    </div>
  );
}
