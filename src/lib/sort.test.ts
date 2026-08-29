import { describe, expect, it } from 'vitest';
import type { Book, SortOrder } from '../types';
import {
  ageSortKey,
  moveSortRule,
  normalizeSort,
  promoteSortField,
  sortBooks,
  sortDirectionLabel,
  sortFieldOptions,
} from './sort';

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

const ids = (books: readonly Book[]) => books.map((item) => item.id);

const BOOKS: Book[] = [
  book({ id: '1', title: '小小迷路', publisher: '格林文化', price: 280, status: '待售' }),
  book({ id: '2', title: '一吋蟲', publisher: '上誼文化', price: 180, status: '收藏' }),
  book({ id: '3', title: '小小迷路', publisher: '格林文化', price: 150, status: '收藏' }),
  book({ id: '4', title: '一吋蟲', publisher: '青林國際', price: 320, status: '共讀中' }),
];

describe('sortBooks', () => {
  it('keeps the file order when no key is chosen', () => {
    expect(ids(sortBooks(BOOKS, []))).toEqual(['1', '2', '3', '4']);
  });

  it('breaks ties with the keys that follow, in order', () => {
    const byTitleThenPrice: SortOrder = [
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'asc' },
    ];
    expect(ids(sortBooks(BOOKS, byTitleThenPrice))).toEqual(['2', '4', '3', '1']);

    const byTitleThenPriceDesc: SortOrder = [
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'desc' },
    ];
    expect(ids(sortBooks(BOOKS, byTitleThenPriceDesc))).toEqual(['4', '2', '1', '3']);
  });

  it('falls back to the file order once every key ties', () => {
    const sorted = sortBooks(BOOKS, [{ field: 'title', direction: 'asc' }]);
    expect(ids(sorted)).toEqual(['2', '4', '1', '3']);
  });

  it('keeps books with an empty cell last in both directions', () => {
    const books = [...BOOKS, book({ id: '5', title: '無價格' })];
    expect(ids(sortBooks(books, [{ field: 'price', direction: 'asc' }]))).toEqual([
      '3',
      '2',
      '1',
      '4',
      '5',
    ]);
    expect(ids(sortBooks(books, [{ field: 'price', direction: 'desc' }]))).toEqual([
      '4',
      '1',
      '2',
      '3',
      '5',
    ]);
  });

  it('sorts ages by their first number and conditions by how new they are', () => {
    const books = [
      book({ id: 'a', ageRange: '4-10 歲', wear: '7新' }),
      book({ id: 'b', ageRange: '0-3 歲', wear: '近新' }),
      book({ id: 'c', ageRange: '3-6 歲', wear: '9新' }),
    ];
    expect(ids(sortBooks(books, [{ field: 'ageRange', direction: 'asc' }]))).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(ids(sortBooks(books, [{ field: 'wear', direction: 'asc' }]))).toEqual(['b', 'c', 'a']);
  });

  it('follows the spreadsheet vocabulary rather than the alphabet', () => {
    const sorted = sortBooks(BOOKS, [{ field: 'status', direction: 'asc' }]);
    expect(sorted.map((item) => item.status)).toEqual(['收藏', '收藏', '待售', '共讀中']);
  });

  it('does not depend on the order the books arrive in', () => {
    const sort: SortOrder = [{ field: 'publisher', direction: 'asc' }];
    const reversed = sortBooks([...BOOKS].reverse(), sort);
    expect(reversed.map((item) => item.publisher)).toEqual(
      sortBooks(BOOKS, sort).map((item) => item.publisher),
    );
  });
});

describe('normalizeSort', () => {
  it('drops unknown fields and repeats of a field already used', () => {
    const sort = normalizeSort([
      { field: 'title', direction: 'desc' },
      { field: 'nope', direction: 'asc' } as never,
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'sideways' } as never,
    ]);
    expect(sort).toEqual([
      { field: 'title', direction: 'desc' },
      { field: 'price', direction: 'asc' },
    ]);
  });
});

describe('promoteSortField', () => {
  it('makes a field the first key and keeps the rest below it', () => {
    const sort: SortOrder = [
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'desc' },
    ];
    expect(promoteSortField(sort, 'price')).toEqual([
      { field: 'price', direction: 'asc' },
      { field: 'title', direction: 'asc' },
    ]);
  });

  it('flips the field that is already first', () => {
    const sort: SortOrder = [{ field: 'title', direction: 'asc' }];
    expect(promoteSortField(sort, 'title')).toEqual([{ field: 'title', direction: 'desc' }]);
  });
});

describe('moveSortRule', () => {
  it('swaps a rule with its neighbour and ignores moves off the ends', () => {
    const sort: SortOrder = [
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'asc' },
    ];
    expect(moveSortRule(sort, 1, -1)).toEqual([sort[1], sort[0]]);
    expect(moveSortRule(sort, 0, -1)).toBe(sort);
    expect(moveSortRule(sort, 1, 1)).toBe(sort);
  });
});

describe('labels', () => {
  it('offers the field it is on plus the ones still free', () => {
    const sort: SortOrder = [
      { field: 'title', direction: 'asc' },
      { field: 'price', direction: 'asc' },
    ];
    const options = sortFieldOptions(sort, 'title');
    expect(options).toContain('title');
    expect(options).not.toContain('price');
  });

  it('names each direction in the words of its field', () => {
    expect(sortDirectionLabel({ field: 'price', direction: 'asc' })).toBe('低到高');
    expect(sortDirectionLabel({ field: 'wear', direction: 'asc' })).toBe('新到舊');
  });
});

describe('ageSortKey', () => {
  it('reads the first number of an age label', () => {
    expect(ageSortKey('0-4 歲')).toBe(0);
    expect(ageSortKey('4-10 歲')).toBe(4);
    expect(ageSortKey('全齡')).toBe(Number.POSITIVE_INFINITY);
  });
});
