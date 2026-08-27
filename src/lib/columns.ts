import type { Book } from '../types';

/** Book fields that can be filled from a spreadsheet column. */
export type ColumnField = Exclude<keyof Book, 'id' | 'extras'>;

/**
 * Accepted header names per field. Matching is done on a normalized header
 * (whitespace removed, bracketed notes stripped, latin text lower-cased), first
 * by exact alias and then by substring, so `狀態(收藏/待售/待共讀)` still maps to
 * `condition` and `書籍內容摘要` still maps to `summary`.
 */
const COLUMN_ALIASES: Record<ColumnField, string[]> = {
  title: ['書名', '書籍名稱', '名稱', '書目', 'title', 'name'],
  author: ['作者', '文字', '文', 'author', 'writer'],
  illustrator: ['繪者', '插畫', '插畫者', '繪圖', '圖', 'illustrator'],
  translator: ['譯者', '翻譯', 'translator'],
  publisher: ['出版社', '出版商', '出版', 'publisher'],
  summary: [
    '內容簡介',
    '書籍內容摘要',
    '內容摘要',
    '簡介',
    '摘要',
    '內容',
    'summary',
    'description',
  ],
  ageRange: ['適讀年齡', '年齡層', '適讀', '建議年齡', '年齡', 'age', 'agerange'],
  tags: ['分類標籤', '建議標籤', '標籤', '分類', '主題', 'tags', 'tag', 'category'],
  channel: ['購入管道', '購買管道', '取得管道', '購書管道', '管道', '來源', 'channel', 'source'],
  price: ['購入價格', '價格', '售價', '定價', '金額', 'price', 'cost'],
  condition: ['書況', '狀態', '書籍狀態', 'condition', 'status'],
  location: ['藏書位置', '存放位置', '書櫃位置', '擺放位置', '位置', 'location', 'shelf'],
  isbn: ['isbn', 'isbn13', 'isbn10', '國際書碼', '條碼'],
};

/**
 * Headers that are claimed so no field can take them. The shelf no longer shows
 * book images, and older sheets still carry a cover column; claiming it here
 * keeps `圖片` from being mistaken for `繪者` by the substring pass. The column
 * itself still reaches the detail view as an extra, like any other unmapped one.
 */
const IGNORED_ALIASES = [
  '封面連結',
  '封面網址',
  '封面',
  '書封',
  '圖片連結',
  '圖片',
  'cover',
  'coverurl',
  'image',
];

const FIELD_ORDER = Object.keys(COLUMN_ALIASES) as ColumnField[];

/** Strips whitespace and bracketed notes so headers compare predictably. */
export function normalizeHeader(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[（([【][^）)\]】]*[）)\]】]/g, '')
    .replace(/[\s\u3000]+/g, '')
    .toLowerCase();
}

/** Maps a header row to book fields, judged on the header text alone. */
export interface HeaderMap {
  /** Best guess per field: the first candidate, in alias order. */
  fields: Partial<Record<ColumnField, number>>;
  /**
   * Every column whose header matches a field, in alias order. Sheets grown
   * over time often carry two columns for the same idea (`狀態` next to `書況`),
   * and only the data says which one is actually in use.
   */
  candidates: Partial<Record<ColumnField, number[]>>;
}

export function mapHeaderRow(headerRow: readonly unknown[]): HeaderMap {
  const normalized = headerRow.map(normalizeHeader);
  const candidates: Partial<Record<ColumnField, number[]>> = {};
  const taken = new Set<number>();

  const claim = (field: ColumnField, index: number) => {
    if (taken.has(index)) return;
    const list = candidates[field] ?? [];
    if (list.includes(index)) return;
    list.push(index);
    candidates[field] = list;
    taken.add(index);
  };

  // Dropped columns are claimed first, so no field can pick them up later.
  for (const alias of IGNORED_ALIASES) {
    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index] === alias) taken.add(index);
    }
  }

  // Exact matches win over substring matches, so `價格` never steals `購入價格`.
  for (const field of FIELD_ORDER) {
    for (const alias of COLUMN_ALIASES[field]) {
      const index = normalized.indexOf(alias);
      if (index !== -1) claim(field, index);
    }
  }
  for (const field of FIELD_ORDER) {
    if (candidates[field] !== undefined) continue;
    for (const alias of COLUMN_ALIASES[field]) {
      const index = normalized.findIndex((header) => header.includes(alias));
      if (index !== -1) {
        claim(field, index);
        break;
      }
    }
  }

  const fields: Partial<Record<ColumnField, number>> = {};
  for (const field of FIELD_ORDER) {
    const first = candidates[field]?.[0];
    if (first !== undefined) fields[field] = first;
  }

  return { fields, candidates };
}

/** How many known fields a row looks like it contains. Used to find the header. */
export function headerScore(row: readonly unknown[]): number {
  const map = mapHeaderRow(row);
  return Object.keys(map.fields).length;
}
