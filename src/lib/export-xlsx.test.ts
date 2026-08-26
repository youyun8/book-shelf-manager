import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { Book } from '../types';
import { booksToRows, booksToXlsx } from './export-xlsx';

const book: Book = {
  id: '1',
  title: '小王子',
  author: 'Antoine de Saint-Exupéry',
  illustrator: '',
  translator: '譯者',
  publisher: '出版社',
  summary: 'A & B < C',
  ageRange: '8+',
  tags: ['經典', '成長'],
  channel: '書店',
  price: 299,
  condition: '收藏',
  location: 'A1',
  isbn: '9781234567890',
  extras: { 備註: '禮物' },
};

describe('Excel export', () => {
  it('includes standard fields and the union of custom fields', () => {
    const rows = booksToRows([book]);
    expect(rows[0]).toContain('ISBN');
    expect(rows[0]).toContain('備註');
    expect(rows[1]).toContain(299);
    expect(rows[1]).toContain('禮物');
  });

  it('creates a valid XLSX archive with escaped shared strings', () => {
    const files = unzipSync(booksToXlsx([book]));
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    const strings = strFromU8(files['xl/sharedStrings.xml']!);
    expect(strings).toContain('A &amp; B &lt; C');
    expect(strFromU8(files['xl/worksheets/sheet1.xml']!)).toContain('<v>299</v>');
  });
});
