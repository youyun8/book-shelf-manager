/**
 * One row of the spreadsheet, which is one *copy* of a book rather than one
 * title: the same title is often listed several times, once per copy, and what
 * tells those rows apart is mostly the 狀態 — one copy kept, another for sale.
 * Nothing here is keyed by the title, and every list of books is keyed by `id`.
 */
export interface Book {
  /** Stable id derived from the row position in the source file. */
  id: string;
  title: string;
  /** `狀態`: what this copy is for, such as `收藏` or `待售`. */
  status: string;
  /** `購入管道` */
  channel: string;
  /** `價格`, `null` when the cell is empty or not a number. */
  price: number | null;
  /** `新舊`: how new this copy is, such as `近新` or `8新`. */
  wear: string;
  /** `書況`: the marks on this copy, such as `無` or `微斑`. */
  condition: string;
  /** `位置` */
  location: string;
  /** `備註` */
  notes: string;
  author: string;
  illustrator: string;
  translator: string;
  publisher: string;
  summary: string;
  /** Raw age text such as `4-10 歲`. */
  ageRange: string;
  /** `共讀方式`, for instance `幼兒啟蒙` or `親子共讀`. */
  readingMode: string;
  /** `建議標籤` split on the usual Chinese and ASCII separators. */
  tags: string[];
  /** `ISBN`, carried through import and export but not otherwise interpreted. */
  isbn: string;
  /** Columns that do not map to a known field, kept for the detail view. */
  extras: Record<string, string>;
}

/**
 * Every field, in the order the spreadsheet lists them: what a copy is and
 * where it came from first, what the book is second. That is the reader's own
 * order, so it is the order the table, the detail view, the editor, the sort
 * menu, the filter page and the export all follow. `fields.test.ts` holds the
 * shorter lists below to it, so the order cannot drift apart one screen at a
 * time.
 */
export const FIELD_ORDER = [
  'title',
  'status',
  'channel',
  'price',
  'wear',
  'condition',
  'location',
  'notes',
  'author',
  'illustrator',
  'translator',
  'publisher',
  'summary',
  'ageRange',
  'readingMode',
  'tags',
  'isbn',
] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];

/** One name per field, used wherever a field is labelled. */
export const FIELD_LABELS: Record<FieldKey, string> = {
  title: '書名',
  status: '狀態',
  channel: '購入管道',
  price: '價格',
  wear: '新舊',
  condition: '書況',
  location: '位置',
  notes: '備註',
  author: '作者',
  illustrator: '繪者',
  translator: '譯者',
  publisher: '出版社',
  summary: '內容簡介',
  ageRange: '適讀年齡',
  readingMode: '共讀方式',
  tags: '建議標籤',
  isbn: 'ISBN',
};

/** Where a field sits in the reader's order; unknown fields sort last. */
export function fieldIndex(field: string): number {
  const index = (FIELD_ORDER as readonly string[]).indexOf(field);
  return index === -1 ? FIELD_ORDER.length : index;
}

/** Checkbox facets, in field order. Values inside one are OR-ed, facets AND-ed. */
export const FACET_KEYS = [
  'status',
  'channel',
  'wear',
  'condition',
  'location',
  'publisher',
  'ageRange',
  'readingMode',
  'tags',
] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** Free-text filters, matched as case-insensitive substrings. */
export const TEXT_KEYS = ['title', 'author', 'illustrator'] as const;
export type TextKey = (typeof TEXT_KEYS)[number];

export type FacetSelection = Record<FacetKey, string[]>;
export type TextSelection = Record<TextKey, string>;

export interface Filters {
  facets: FacetSelection;
  text: TextSelection;
}

export interface FacetOption {
  value: string;
  /** How many books would remain if this value were selected. */
  count: number;
  selected: boolean;
}

/** Fields a reader can sort on, in field order. */
export const SORT_FIELDS = [
  'title',
  'status',
  'channel',
  'price',
  'wear',
  'condition',
  'location',
  'author',
  'illustrator',
  'translator',
  'publisher',
  'ageRange',
  'readingMode',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  field: SortField;
  direction: SortDirection;
}

/**
 * The reader's preferred order: the first rule decides, the next one breaks its
 * ties, and so on. An empty list keeps the order of the imported file.
 */
export type SortOrder = SortRule[];
export const DEFAULT_SORT: SortOrder = [];

export type ViewMode = 'grid' | 'table';

/** How many books one page shows; `all` puts the whole result on one page. */
export type PageSize = 25 | 50 | 75 | 100 | 'all';
export const PAGE_SIZES: PageSize[] = [25, 50, 75, 100, 'all'];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export const EMPTY_FILTERS: Filters = {
  facets: {
    status: [],
    channel: [],
    wear: [],
    condition: [],
    location: [],
    publisher: [],
    ageRange: [],
    readingMode: [],
    tags: [],
  },
  text: { title: '', author: '', illustrator: '' },
};
