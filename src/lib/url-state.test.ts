import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from '../types';
import { searchToState, stateToSearch } from './url-state';

describe('url state', () => {
  it('is empty when nothing is selected', () => {
    expect(
      stateToSearch({ filters: EMPTY_FILTERS, sort: 'default', view: 'grid', pageSize: 24 }),
    ).toBe('');
  });

  it('round-trips filters, sort, view and page size', () => {
    const state = {
      filters: {
        facets: {
          ...EMPTY_FILTERS.facets,
          publisher: ['格林文化', '上誼文化'],
          tags: ['療癒'],
        },
        text: { ...EMPTY_FILTERS.text, title: '小' },
      },
      sort: 'priceDesc' as const,
      view: 'table' as const,
      pageSize: 96 as const,
    };
    expect(searchToState(stateToSearch(state))).toEqual(state);
  });

  it('keeps a whole-list page size', () => {
    expect(searchToState('?per=all').pageSize).toBe('all');
  });

  it('ignores unknown sort and page size values', () => {
    expect(searchToState('?sort=nope').sort).toBe('default');
    expect(searchToState('?per=7').pageSize).toBe(24);
  });
});
