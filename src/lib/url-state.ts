import type { FacetKey, Filters, PageSize, SortOrder, SortRule, TextKey, ViewMode } from '../types';
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS, FACET_KEYS, PAGE_SIZES, TEXT_KEYS } from '../types';
import { normalizeSort } from './sort';

const FACET_PARAM: Record<FacetKey, string> = {
  publisher: 'pub',
  ageRange: 'age',
  readingMode: 'mode',
  tags: 'tag',
  channel: 'ch',
  status: 'st',
  wear: 'new',
  condition: 'cond',
  location: 'loc',
};
const TEXT_PARAM: Record<TextKey, string> = {
  title: 'q_title',
  author: 'q_author',
  illustrator: 'q_illustrator',
};
const VALUE_SEPARATOR = '|';
const RULE_SEPARATOR = ',';
const DIRECTION_SEPARATOR = ':';

/**
 * Sorts written by earlier versions of the app, which only had one key. They
 * still appear in bookmarks and shared links, so they are read as a one-rule
 * order rather than silently dropped.
 */
const LEGACY_SORTS: Record<string, SortRule[]> = {
  default: [],
  title: [{ field: 'title', direction: 'asc' }],
  publisher: [{ field: 'publisher', direction: 'asc' }],
  priceAsc: [{ field: 'price', direction: 'asc' }],
  priceDesc: [{ field: 'price', direction: 'desc' }],
};

export interface UrlState {
  filters: Filters;
  sort: SortOrder;
  view: ViewMode;
  pageSize: PageSize;
}

/** `title:asc,price:desc` — the reader's keys, in the order they apply. */
export function sortToParam(sort: SortOrder): string {
  return sort
    .map((rule) => `${rule.field}${DIRECTION_SEPARATOR}${rule.direction}`)
    .join(RULE_SEPARATOR);
}

export function paramToSort(raw: string | null): SortOrder {
  if (raw === null || raw === '') return [];
  const legacy = LEGACY_SORTS[raw];
  if (legacy) return legacy;
  const rules = raw.split(RULE_SEPARATOR).map((part) => {
    const [field, direction] = part.split(DIRECTION_SEPARATOR);
    return { field, direction } as SortRule;
  });
  return normalizeSort(rules);
}

function parsePageSize(raw: string | null): PageSize {
  if (raw === null) return DEFAULT_PAGE_SIZE;
  const parsed: PageSize = raw === 'all' ? 'all' : (Number(raw) as PageSize);
  return PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE;
}

/** Serializes the current selection so a filtered view can be bookmarked. */
export function stateToSearch(state: UrlState): string {
  const params = new URLSearchParams();
  for (const key of FACET_KEYS) {
    const values = state.filters.facets[key];
    if (values.length > 0) params.set(FACET_PARAM[key], values.join(VALUE_SEPARATOR));
  }
  for (const key of TEXT_KEYS) {
    const value = state.filters.text[key].trim();
    if (value !== '') params.set(TEXT_PARAM[key], value);
  }
  if (state.sort.length > 0) params.set('sort', sortToParam(state.sort));
  if (state.view !== 'grid') params.set('view', state.view);
  if (state.pageSize !== DEFAULT_PAGE_SIZE) params.set('per', String(state.pageSize));
  const search = params.toString();
  return search === '' ? '' : `?${search}`;
}

export function searchToState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const facets = { ...EMPTY_FILTERS.facets };
  for (const key of FACET_KEYS) {
    const raw = params.get(FACET_PARAM[key]);
    facets[key] = raw ? raw.split(VALUE_SEPARATOR).filter(Boolean) : [];
  }
  const text = { ...EMPTY_FILTERS.text };
  for (const key of TEXT_KEYS) {
    text[key] = params.get(TEXT_PARAM[key]) ?? '';
  }
  return {
    filters: { facets, text },
    sort: paramToSort(params.get('sort')),
    view: params.get('view') === 'table' ? 'table' : 'grid',
    pageSize: parsePageSize(params.get('per')),
  };
}
