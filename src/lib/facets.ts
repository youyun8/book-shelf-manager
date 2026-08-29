import type { Book, FacetKey, FacetOption, Filters } from '../types';
import { FACET_KEYS } from '../types';
import { applyFilters, facetValues, compareText } from './filter';
import { ageSortKey } from './sort';
import {
  CONDITION_VALUES,
  READING_MODE_VALUES,
  STATUS_VALUES,
  WEAR_VALUES,
  rankOf,
} from './vocabulary';

/**
 * Facets whose values have a natural order are listed in that order instead of
 * by count, so `狀態` always reads 收藏 → 待售 and `新舊` always reads new to old.
 */
const ORDERED_FACETS: Partial<Record<FacetKey, readonly string[]>> = {
  readingMode: READING_MODE_VALUES,
  status: STATUS_VALUES,
  wear: WEAR_VALUES,
  condition: CONDITION_VALUES,
};

/**
 * Builds the checkbox options for one facet. Counts are computed against the
 * books that pass every *other* filter, so a count tells you how many books you
 * would see after ticking that box. Selected values are always listed, even at
 * zero, so a selection never disappears from the panel.
 */
export function buildFacet(books: readonly Book[], filters: Filters, key: FacetKey): FacetOption[] {
  const scope = applyFilters(books, filters, key);
  const counts = new Map<string, number>();

  for (const book of scope) {
    for (const value of facetValues(book, key)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  for (const book of books) {
    for (const value of facetValues(book, key)) {
      if (!counts.has(value)) counts.set(value, 0);
    }
  }

  const selected = new Set(filters.facets[key]);
  const options = [...counts.entries()].map(([value, count]) => ({
    value,
    count,
    selected: selected.has(value),
  }));

  const ordered = ORDERED_FACETS[key];
  if (key === 'ageRange') {
    options.sort(
      (a, b) => ageSortKey(a.value) - ageSortKey(b.value) || compareText(a.value, b.value),
    );
  } else if (ordered) {
    options.sort(
      (a, b) =>
        rankOf(ordered, a.value) - rankOf(ordered, b.value) || compareText(a.value, b.value),
    );
  } else {
    options.sort((a, b) => b.count - a.count || compareText(a.value, b.value));
  }
  return options;
}

export function buildAllFacets(
  books: readonly Book[],
  filters: Filters,
): Record<FacetKey, FacetOption[]> {
  return Object.fromEntries(
    FACET_KEYS.map((key) => [key, buildFacet(books, filters, key)]),
  ) as Record<FacetKey, FacetOption[]>;
}
