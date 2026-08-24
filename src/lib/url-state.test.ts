import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS } from '../types';
import { searchToState, stateToSearch } from './url-state';

describe('url state', () => {
  it('is empty when nothing is selected', () => {
    expect(stateToSearch({ filters: EMPTY_FILTERS, sort: 'default', view: 'grid' })).toBe('');
  });

  it('round-trips filters, sort and view', () => {
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
    };
    expect(searchToState(stateToSearch(state))).toEqual(state);
  });

  it('ignores unknown sort values', () => {
    expect(searchToState('?sort=nope').sort).toBe('default');
  });
});
