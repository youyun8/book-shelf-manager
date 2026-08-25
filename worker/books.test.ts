import { describe, expect, it } from 'vitest';
import { rowToBook, sanitizeBook } from './books';

describe('sanitizeBook', () => {
  it('coerces and trims everything the browser sends', () => {
    const book = sanitizeBook({
      title: '  小小迷路  ',
      author: '克里斯霍頓',
      tags: ['親子關係', '  幽默  ', '', 42],
      price: 'NT$ 1,200 元',
      extras: { 備註: '  朋友推薦 ', 空的: '' },
      unknownField: 'ignored',
    });

    expect(book.title).toBe('小小迷路');
    expect(book.tags).toEqual(['親子關係', '幽默', '42']);
    expect(book.price).toBe(1200);
    expect(book.extras).toEqual({ 備註: '朋友推薦' });
    expect(book).not.toHaveProperty('unknownField');
  });

  it('fills in the blanks rather than trusting missing fields', () => {
    const book = sanitizeBook({});
    expect(book.title).toBe('（未命名）');
    expect(book.author).toBe('');
    expect(book.tags).toEqual([]);
    expect(book.price).toBeNull();
    expect(book.extras).toEqual({});
  });

  it('caps oversized input', () => {
    const book = sanitizeBook({
      title: 'x'.repeat(500),
      tags: new Array(60).fill('tag'),
    });
    expect(book.title).toHaveLength(300);
    expect(book.tags).toHaveLength(40);
  });

  it('keeps a price of zero and drops nonsense', () => {
    expect(sanitizeBook({ price: 0 }).price).toBe(0);
    expect(sanitizeBook({ price: '免費' }).price).toBeNull();
  });
});

describe('rowToBook', () => {
  it('maps database columns to the API shape', () => {
    const book = rowToBook({
      id: 'abc',
      title: '小小迷路',
      author: '克里斯霍頓',
      illustrator: '克里斯霍頓',
      translator: '李美妮',
      publisher: '格林文化',
      summary: '找媽媽的小貓頭鷹。',
      age_range: '0-4 歲',
      tags: '["親子關係","幽默"]',
      channel: '網路書店',
      price: 280,
      condition: '收藏',
      location: '客廳書櫃 A1',
      isbn: '9789861897271',
      extras: '{"備註":"朋友推薦"}',
    });
    expect(book.ageRange).toBe('0-4 歲');
    expect(book.tags).toEqual(['親子關係', '幽默']);
    expect(book.extras).toEqual({ 備註: '朋友推薦' });
  });

  it('survives corrupted JSON columns', () => {
    const book = rowToBook({
      id: 'abc',
      title: '書',
      author: '',
      illustrator: '',
      translator: '',
      publisher: '',
      summary: '',
      age_range: '',
      tags: 'not json',
      channel: '',
      price: null,
      condition: '',
      location: '',
      isbn: '',
      extras: 'null',
    });
    expect(book.tags).toEqual([]);
    expect(book.extras).toEqual({});
  });
});
