import type { FacetKey, Filters, PageSize, SortKey, TextKey, ViewMode } from '../types';
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS, FACET_KEYS, PAGE_SIZES, TEXT_KEYS } from '../types';

const FACET_PARAM: Record<FacetKey, string> = {
  publisher: 'pub',
  ageRange: 'age',
  tags: 'tag',
  channel: 'ch',
  condition: 'st',
};
const TEXT_PARAM: Record<TextKey, string> = {
  title: 'q_title',
  author: 'q_author',
  illustrator: 'q_illustrator',
};
const VALUE_SEPARATOR = '|';
const SORT_KEYS: SortKey[] = ['default', 'title', 'priceAsc', 'priceDesc', 'publisher'];

export interface UrlState {
  filters: Filters;
  sort: SortKey;
  view: ViewMode;
  pageSize: PageSize;
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
  if (state.sort !== 'default') params.set('sort', state.sort);
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
  const sortParam = params.get('sort') as SortKey | null;
  return {
    filters: { facets, text },
    sort: sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'default',
    view: params.get('view') === 'table' ? 'table' : 'grid',
    pageSize: parsePageSize(params.get('per')),
  };
}
