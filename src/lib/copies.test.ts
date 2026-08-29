import { describe, expect, it } from 'vitest';
import type { Book } from '../types';
import { copyCount, countCopiesByTitle, otherCopies } from './copies';

function book(id: string, title: string, status = ''): Book {
  return {
    id,
    title,
    status,
    channel: '',
    price: null,
    wear: '',
    condition: '',
    location: '',
    notes: '',
    author: '',
    illustrator: '',
    translator: '',
    publisher: '',
    summary: '',
    ageRange: '',
    readingMode: '',
    tags: [],
    isbn: '',
    extras: {},
  };
}

const BOOKS = [
  book('1', 'TIDY 整潔', '收藏'),
  book('2', '一吋蟲', '收藏'),
  book('3', 'TIDY 整潔', '待共讀'),
  book('4', ' TIDY 整潔 ', '待售'),
];

describe('copies', () => {
  it('counts the rows that share a title, ignoring surrounding space', () => {
    const counts = countCopiesByTitle(BOOKS);
    expect(copyCount(counts, BOOKS[0]!)).toBe(3);
    expect(copyCount(counts, BOOKS[1]!)).toBe(1);
  });

  it('lists the other copies without the book itself', () => {
    expect(otherCopies(BOOKS, BOOKS[0]!).map((item) => item.id)).toEqual(['3', '4']);
    expect(otherCopies(BOOKS, BOOKS[1]!)).toEqual([]);
  });

  it('never merges two copies into one', () => {
    const counts = countCopiesByTitle(BOOKS);
    expect([...counts.values()].reduce((total, count) => total + count, 0)).toBe(BOOKS.length);
  });
});
