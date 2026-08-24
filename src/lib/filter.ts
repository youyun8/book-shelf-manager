import type { Book, FacetKey, Filters, SortKey } from '../types';
import { FACET_KEYS, TEXT_KEYS } from '../types';

/** The values of a book for one checkbox facet. Empty cells match nothing. */
export function facetValues(book: Book, key: FacetKey): string[] {
  if (key === 'tags') return book.tags;
  const value = book[key];
  return value === '' ? [] : [value];
}

function matchesFacet(book: Book, key: FacetKey, selected: readonly string[]): boolean {
  if (selected.length === 0) return true;
  return facetValues(book, key).some((value) => selected.includes(value));
}

function includesText(haystack: string, needle: string): boolean {
  if (needle === '') return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function matchesText(book: Book, filters: Filters): boolean {
  return TEXT_KEYS.every((key) => includesText(book[key], filters.text[key].trim()));
}

/**
 * Applies every filter. `except` skips one facet, which is how the sidebar
 * counts stay meaningful while that facet already has selections.
 */
export function applyFilters(books: readonly Book[], filters: Filters, except?: FacetKey): Book[] {
  return books.filter((book) => {
    if (!matchesText(book, filters)) return false;
    return FACET_KEYS.every(
      (key) => key === except || matchesFacet(book, key, filters.facets[key]),
    );
  });
}

export function countActiveFilters(filters: Filters): number {
  const facets = FACET_KEYS.reduce((total, key) => total + filters.facets[key].length, 0);
  const text = TEXT_KEYS.filter((key) => filters.text[key].trim() !== '').length;
  return facets + text;
}

const collator = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });

export function compareText(a: string, b: string): number {
  if (a === b) return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  return collator.compare(a, b);
}

export function sortBooks(books: readonly Book[], sort: SortKey): Book[] {
  const sorted = [...books];
  switch (sort) {
    case 'title':
      return sorted.sort((a, b) => compareText(a.title, b.title));
    case 'publisher':
      return sorted.sort(
        (a, b) => compareText(a.publisher, b.publisher) || compareText(a.title, b.title),
      );
    case 'priceAsc':
    case 'priceDesc': {
      const direction = sort === 'priceAsc' ? 1 : -1;
      return sorted.sort((a, b) => {
        if (a.price === null && b.price === null) return compareText(a.title, b.title);
        if (a.price === null) return 1;
        if (b.price === null) return -1;
        return (a.price - b.price) * direction;
      });
    }
    default:
      return sorted;
  }
}
