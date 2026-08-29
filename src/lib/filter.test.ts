import { describe, expect, it } from 'vitest';
import type { Book, Filters } from '../types';
import { EMPTY_FILTERS } from '../types';
import { applyFilters, countActiveFilters } from './filter';
import { buildFacet } from './facets';

function book(overrides: Partial<Book>): Book {
  return {
    id: 'x',
    title: '',
    author: '',
    illustrator: '',
    translator: '',
    publisher: '',
    summary: '',
    ageRange: '',
    readingMode: '',
    tags: [],
    channel: '',
    price: null,
    status: '',
    wear: '',
    condition: '',
    location: '',
    notes: '',
    isbn: '',
    extras: {},
    ...overrides,
  };
}

const BOOKS: Book[] = [
  book({
    id: '1',
    title: '走在夢的路上',
    author: '刀根里衣',
    illustrator: '刀根里衣',
    publisher: '格林文化',
    ageRange: '4-10 歲',
    tags: ['療癒', '夢想'],
    channel: '誠品書店',
    price: 320,
    status: '收藏',
  }),
  book({
    id: '2',
    title: '小小迷路',
    author: '克里斯霍頓',
    illustrator: '克里斯霍頓',
    publisher: '格林文化',
    ageRange: '0-4 歲',
    tags: ['幽默'],
    channel: '網路書店',
    price: 280,
    status: '收藏',
  }),
  book({
    id: '3',
    title: '小藍和小黃',
    author: '李歐．李奧尼',
    illustrator: '李歐．李奧尼',
    publisher: '青林國際',
    ageRange: '3-6 歲',
    tags: ['友誼', '美感'],
    channel: '二手書店',
    price: 200,
    status: '待售',
  }),
];

function withFilters(patch: Partial<Filters['facets']>, text: Partial<Filters['text']> = {}) {
  return {
    facets: { ...EMPTY_FILTERS.facets, ...patch },
    text: { ...EMPTY_FILTERS.text, ...text },
  };
}

describe('applyFilters', () => {
  it('returns everything when nothing is selected', () => {
    expect(applyFilters(BOOKS, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('ORs values inside one facet', () => {
    const result = applyFilters(BOOKS, withFilters({ status: ['收藏', '待售'] }));
    expect(result).toHaveLength(3);
  });

  it('ANDs different facets', () => {
    const result = applyFilters(
      BOOKS,
      withFilters({ publisher: ['格林文化'], ageRange: ['0-4 歲'] }),
    );
    expect(result.map((item) => item.id)).toEqual(['2']);
  });

  it('matches any selected tag', () => {
    const result = applyFilters(BOOKS, withFilters({ tags: ['夢想', '友誼'] }));
    expect(result.map((item) => item.id)).toEqual(['1', '3']);
  });

  it('matches text as a case-insensitive substring', () => {
    expect(applyFilters(BOOKS, withFilters({}, { title: '小' })).map((item) => item.id)).toEqual([
      '2',
      '3',
    ]);
    expect(applyFilters(BOOKS, withFilters({}, { illustrator: '霍頓' }))).toHaveLength(1);
    expect(applyFilters(BOOKS, withFilters({}, { author: '  ' }))).toHaveLength(3);
  });

  it('combines text and checkbox filters', () => {
    const result = applyFilters(BOOKS, withFilters({ publisher: ['格林文化'] }, { title: '小' }));
    expect(result.map((item) => item.id)).toEqual(['2']);
  });

  it('can skip one facet, which is how sidebar counts are computed', () => {
    const filters = withFilters({ publisher: ['青林國際'], status: ['收藏'] });
    expect(applyFilters(BOOKS, filters)).toHaveLength(0);
    expect(applyFilters(BOOKS, filters, 'publisher')).toHaveLength(2);
  });
});

describe('countActiveFilters', () => {
  it('counts every checked box and filled input', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters(withFilters({ tags: ['友誼', '美感'] }, { title: '小', author: ' ' })),
    ).toBe(3);
  });
});

describe('buildFacet', () => {
  it('counts against the other filters and marks selections', () => {
    const filters = withFilters({ publisher: ['格林文化'] });
    const options = buildFacet(BOOKS, filters, 'ageRange');
    expect(options.map((option) => option.value)).toEqual(['0-4 歲', '3-6 歲', '4-10 歲']);
    expect(options.find((option) => option.value === '3-6 歲')?.count).toBe(0);
    expect(options.find((option) => option.value === '4-10 歲')?.count).toBe(1);

    const publishers = buildFacet(BOOKS, filters, 'publisher');
    expect(publishers.find((option) => option.value === '格林文化')?.selected).toBe(true);
    expect(publishers.find((option) => option.value === '青林國際')?.count).toBe(1);
  });

  it('orders other facets by count', () => {
    const options = buildFacet(BOOKS, EMPTY_FILTERS, 'publisher');
    expect(options[0]?.value).toBe('格林文化');
  });
});
