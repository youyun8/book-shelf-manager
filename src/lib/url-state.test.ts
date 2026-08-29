import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from '../types';
import { searchToState, stateToSearch } from './url-state';

describe('url state', () => {
  it('is empty when nothing is selected', () => {
    expect(stateToSearch({ filters: EMPTY_FILTERS, sort: [], view: 'grid', pageSize: 25 })).toBe(
      '',
    );
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
      sort: [
        { field: 'title' as const, direction: 'asc' as const },
        { field: 'price' as const, direction: 'desc' as const },
      ],
      view: 'table' as const,
      pageSize: 100 as const,
    };
    expect(searchToState(stateToSearch(state))).toEqual(state);
  });

  it('keeps a whole-list page size', () => {
    expect(searchToState('?per=all').pageSize).toBe('all');
  });

  it('ignores unknown sort and page size values', () => {
    expect(searchToState('?sort=nope').sort).toEqual([]);
    expect(searchToState('?sort=title:asc,nope:asc').sort).toEqual([
      { field: 'title', direction: 'asc' },
    ]);
    expect(searchToState('?per=7').pageSize).toBe(25);
  });

  it('reads the single-key sorts written by earlier versions', () => {
    expect(searchToState('?sort=priceDesc').sort).toEqual([{ field: 'price', direction: 'desc' }]);
    expect(searchToState('?sort=title').sort).toEqual([{ field: 'title', direction: 'asc' }]);
    expect(searchToState('?sort=default').sort).toEqual([]);
  });
});
