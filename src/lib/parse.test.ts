import { describe, expect, it } from 'vitest';
import {
  chooseColumns,
  findHeaderIndex,
  parseCsv,
  parsePrice,
  rowsToBooks,
  splitTags,
} from './parse';
import { mapHeaderRow, normalizeHeader } from './columns';
import type { Row } from './parse';

const HEADER = [
  '書名',
  '作者',
  '繪者',
  '譯者',
  '出版社',
  '內容簡介',
  '適讀年齡',
  '共讀方式',
  '建議標籤',
  '購入管道',
  '價格',
  '狀態(收藏/待售/待共讀)',
  '新舊',
  '書況(無/點/微/嚴重)',
  '藏書位置',
  '備註',
];

const ROW = [
  '走在夢的路上',
  '刀根里衣',
  '刀根里衣',
  '蘇懿禎',
  '格林文化',
  '絕美畫風。',
  '4-10 歲',
  '親子共讀',
  '療癒、美感、夢想',
  '誠品書店',
  'NT$320',
  '收藏',
  '近新',
  '微斑',
  '客廳書櫃 A1',
  '朋友送的',
];

describe('normalizeHeader', () => {
  it('drops whitespace and bracketed notes', () => {
    expect(normalizeHeader('狀態(收藏/待售/待共讀)')).toBe('狀態');
    expect(normalizeHeader(' 購入 管道 ')).toBe('購入管道');
    expect(normalizeHeader('Title')).toBe('title');
  });
});

describe('mapHeaderRow', () => {
  it('maps the sample header to book fields', () => {
    const { fields } = mapHeaderRow(HEADER);
    expect(fields.title).toBe(0);
    expect(fields.illustrator).toBe(2);
    expect(fields.summary).toBe(5);
    expect(fields.readingMode).toBe(7);
    expect(fields.tags).toBe(8);
    expect(fields.price).toBe(10);
    expect(fields.status).toBe(11);
    expect(fields.wear).toBe(12);
    expect(fields.condition).toBe(13);
    expect(fields.location).toBe(14);
    expect(fields.notes).toBe(15);
  });

  it('keeps 狀態, 新舊 and 書況 apart', () => {
    const { fields } = mapHeaderRow(['書名', '書況', '狀態', '新舊']);
    expect(fields.condition).toBe(1);
    expect(fields.status).toBe(2);
    expect(fields.wear).toBe(3);
  });

  it('prefers the most specific alias when several columns look similar', () => {
    const { fields, candidates } = mapHeaderRow(['書名', '價格', '購入價格']);
    expect(fields.price).toBe(2);
    expect(candidates.price).toEqual([2, 1]);
  });

  it('maps the optional ISBN column', () => {
    const { fields } = mapHeaderRow(['書名', 'ISBN', '封面連結']);
    expect(fields.isbn).toBe(1);
  });

  it('never mistakes a dropped 圖片 column for 繪者', () => {
    const { fields } = mapHeaderRow(['書名', '圖片']);
    expect(fields.illustrator).toBeUndefined();
  });
});

describe('parsePrice', () => {
  it('reads numbers out of formatted cells', () => {
    expect(parsePrice(320)).toBe(320);
    expect(parsePrice('NT$1,200 元')).toBe(1200);
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('免費')).toBeNull();
  });
});

describe('splitTags', () => {
  it('splits on Chinese and ASCII separators', () => {
    expect(splitTags('療癒、美感 / 夢想')).toEqual(['療癒', '美感', '夢想']);
    expect(splitTags('單一標籤')).toEqual(['單一標籤']);
    expect(splitTags(null)).toEqual([]);
  });
});

describe('findHeaderIndex', () => {
  it('skips leading title and blank rows', () => {
    const rows: Row[] = [['我的藏書清單'], [], HEADER, ROW];
    expect(findHeaderIndex(rows)).toBe(2);
  });

  it('returns -1 when nothing looks like a header', () => {
    expect(
      findHeaderIndex([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe(-1);
  });
});

describe('rowsToBooks', () => {
  it('builds a book from the sample sheet', () => {
    const [book] = rowsToBooks([HEADER, ROW]);
    expect(book).toBeDefined();
    expect(book?.title).toBe('走在夢的路上');
    expect(book?.illustrator).toBe('刀根里衣');
    expect(book?.tags).toEqual(['療癒', '美感', '夢想']);
    expect(book?.price).toBe(320);
    expect(book?.readingMode).toBe('親子共讀');
    expect(book?.status).toBe('收藏');
    expect(book?.wear).toBe('近新');
    expect(book?.condition).toBe('微斑');
    expect(book?.location).toBe('客廳書櫃 A1');
    expect(book?.notes).toBe('朋友送的');
  });

  it('keeps unknown columns in extras and skips empty rows', () => {
    const books = rowsToBooks([
      [...HEADER, 'ISBN', '借給誰'],
      [...ROW, '9789861897271', '小美'],
      [],
      ['', '', ''],
    ]);
    expect(books).toHaveLength(1);
    expect(books[0]?.isbn).toBe('9789861897271');
    expect(books[0]?.extras).toEqual({ 借給誰: '小美' });
  });

  it('files an older sheet that only has 書況 under the status it really means', () => {
    const books = rowsToBooks([
      ['書名', '書況'],
      ['小小迷路', '待售'],
      ['小藍和小黃', '微斑'],
    ]);
    expect(books[0]?.status).toBe('待售');
    expect(books[0]?.condition).toBe('');
    expect(books[1]?.status).toBe('');
    expect(books[1]?.condition).toBe('微斑');
  });

  it('reads the filled duplicate column and keeps the other one as an extra', () => {
    const books = rowsToBooks([
      ['書名', '價格', '購入價格'],
      ['小小迷路', '280', '300'],
      ['小藍和小黃', '200', ''],
    ]);
    expect(books[0]?.price).toBe(280);
    expect(books[0]?.extras).toEqual({ 購入價格: '300' });
    expect(books[1]?.price).toBe(200);
  });

  it('throws a readable error when the header is missing', () => {
    expect(() =>
      rowsToBooks([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toThrow(/標題列/);
  });
});

describe('chooseColumns', () => {
  it('keeps the header order when only one column matches', () => {
    const { candidates } = mapHeaderRow(['書名', '出版社']);
    expect(chooseColumns(candidates, [['小小迷路', '格林文化']])).toEqual({
      title: 0,
      publisher: 1,
    });
  });

  it('picks the column people actually filled in', () => {
    // `購入價格` is the more specific header, but this sheet only fills `價格`.
    const { candidates } = mapHeaderRow(['書名', '價格', '購入價格']);
    const rows = [
      ['小小迷路', '280', ''],
      ['小藍和小黃', '200', ''],
      ['田鼠阿佛', '150', ''],
    ];
    expect(chooseColumns(candidates, rows).price).toBe(1);
  });

  it('falls back to the more specific header when both are equally filled', () => {
    const { candidates } = mapHeaderRow(['書名', '價格', '購入價格']);
    const rows = [['小小迷路', '280', '300']];
    expect(chooseColumns(candidates, rows).price).toBe(2);
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    const rows = parseCsv('書名,分類標籤\r\n"小藍和小黃","友誼、""美感"""\r\n');
    expect(rows).toEqual([
      ['書名', '分類標籤'],
      ['小藍和小黃', '友誼、"美感"'],
    ]);
  });

  it('feeds rowsToBooks', () => {
    const csv = `${HEADER.join(',')}\n${ROW.join(',')}`;
    const books = rowsToBooks(parseCsv(csv));
    expect(books[0]?.publisher).toBe('格林文化');
  });
});
