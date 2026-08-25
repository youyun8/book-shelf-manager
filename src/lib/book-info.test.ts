import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Book } from '../types';
import {
  buildQueries,
  lookupBookInfo,
  LookupError,
  normalizeIsbn,
  pickBestVolume,
  setApiKey,
} from './book-info';

function book(overrides: Partial<Book> = {}): Book {
  return {
    id: '1',
    title: '小小迷路',
    author: '克里斯霍頓',
    illustrator: '克里斯霍頓',
    translator: '李美妮',
    publisher: '格林文化',
    summary: '',
    ageRange: '0-4 歲',
    tags: [],
    channel: '',
    price: null,
    condition: '收藏',
    location: '',
    isbn: '',
    extras: {},
    ...overrides,
  };
}

const VOLUME = {
  id: 'abc123',
  volumeInfo: {
    title: '小小迷路',
    authors: ['克里斯霍頓'],
    publisher: '格林文化',
    publishedDate: '2015-06-26',
    description: '找媽媽的小貓頭鷹。',
    pageCount: 32,
    categories: ['Juvenile Fiction'],
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789861897271' }],
    canonicalVolumeLink: 'https://books.google.com/books/about?id=abc123',
  },
};

const UNRELATED = {
  id: 'zzz',
  volumeInfo: { title: '完全不相關的書', authors: ['某人'] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(pages: unknown[]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const items = pages[calls.length - 1];
    return { ok: true, status: 200, json: async () => ({ items }) } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

describe('normalizeIsbn', () => {
  it('keeps only valid lengths', () => {
    expect(normalizeIsbn('978-986-189-727-1')).toBe('9789861897271');
    expect(normalizeIsbn('986189727X')).toBe('986189727X');
    expect(normalizeIsbn('12345')).toBe('');
  });
});

describe('buildQueries', () => {
  it('tries the ISBN first, then title with author, then the title alone', () => {
    expect(buildQueries(book({ isbn: '978-986-189-727-1' }))).toEqual([
      'isbn:9789861897271',
      'intitle:"小小迷路" inauthor:"克里斯霍頓"',
      'intitle:"小小迷路"',
      '"小小迷路"',
    ]);
  });

  it('skips the author clause when there is no author', () => {
    expect(buildQueries(book({ author: '' }))).toEqual(['intitle:"小小迷路"', '"小小迷路"']);
  });
});

describe('pickBestVolume', () => {
  it('picks the volume matching the title and author', () => {
    const info = pickBestVolume([UNRELATED, VOLUME], book());
    expect(info?.id).toBe('abc123');
    expect(info?.publisher).toBe('格林文化');
    expect(info?.isbn).toBe('9789861897271');
  });

  it('rejects results that match neither title, author nor ISBN', () => {
    expect(pickBestVolume([UNRELATED], book())).toBeNull();
    expect(pickBestVolume([], book())).toBeNull();
  });

  it('accepts an ISBN match even when the title differs', () => {
    const info = pickBestVolume([VOLUME], book({ title: '書名寫錯了', isbn: '9789861897271' }));
    expect(info?.id).toBe('abc123');
  });
});

describe('lookupBookInfo', () => {
  it('returns the first query that matches', async () => {
    const { calls } = stubFetch([[VOLUME]]);
    const info = await lookupBookInfo(book(), { force: true });
    expect(info?.title).toBe('小小迷路');
    expect(calls).toHaveLength(1);
  });

  it('falls through to the looser query when the first finds nothing', async () => {
    const { calls } = stubFetch([[UNRELATED], [VOLUME]]);
    const info = await lookupBookInfo(book(), { force: true });
    expect(info?.id).toBe('abc123');
    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[1] ?? '')).toContain('intitle:"小小迷路"');
  });

  it('resolves to null when nothing matches any query', async () => {
    stubFetch([[UNRELATED], [UNRELATED], [UNRELATED]]);
    await expect(lookupBookInfo(book(), { force: true })).resolves.toBeNull();
  });

  it('reports a readable message when the API rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429 }) as unknown as Response),
    );
    await expect(lookupBookInfo(book(), { force: true })).rejects.toBeInstanceOf(LookupError);
  });

  it('reports a readable message when the network is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(lookupBookInfo(book(), { force: true })).rejects.toThrow(/網路/);
  });
});

describe('setApiKey', () => {
  it('adds the key to the request when one is configured', async () => {
    const { calls } = stubFetch([[VOLUME]]);
    setApiKey('test-key');
    await lookupBookInfo(book(), { force: true });
    setApiKey('');
    expect(calls[0]).toContain('key=test-key');
  });
});
