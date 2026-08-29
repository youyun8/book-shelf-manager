/** A single book row read from the spreadsheet. */
export interface Book {
  /** Stable id derived from the row position in the source file. */
  id: string;
  title: string;
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
  /** `購入管道` */
  channel: string;
  /** `價格`, `null` when the cell is empty or not a number. */
  price: number | null;
  /** `狀態`: what the book is for, such as `收藏` or `待售`. */
  status: string;
  /** `新舊`: how new the copy is, such as `近新` or `8新`. */
  wear: string;
  /** `書況`: the marks on the copy, such as `無` or `微斑`. */
  condition: string;
  /** `藏書位置` */
  location: string;
  /** `備註` */
  notes: string;
  /** `ISBN`, carried through import and export but not otherwise interpreted. */
  isbn: string;
  /** Columns that do not map to a known field, kept for the detail view. */
  extras: Record<string, string>;
}

/** Checkbox facets. Values inside one facet are OR-ed, facets are AND-ed. */
export const FACET_KEYS = [
  'publisher',
  'ageRange',
  'readingMode',
  'tags',
  'channel',
  'status',
  'wear',
  'condition',
  'location',
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

/** Fields a reader can sort on. */
export const SORT_FIELDS = [
  'title',
  'author',
  'illustrator',
  'translator',
  'publisher',
  'ageRange',
  'readingMode',
  'channel',
  'price',
  'status',
  'wear',
  'condition',
  'location',
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
    publisher: [],
    ageRange: [],
    readingMode: [],
    tags: [],
    channel: [],
    status: [],
    wear: [],
    condition: [],
    location: [],
  },
  text: { title: '', author: '', illustrator: '' },
};

export const FACET_LABELS: Record<FacetKey, string> = {
  publisher: '出版社',
  ageRange: '適讀年齡',
  readingMode: '共讀方式',
  tags: '建議標籤',
  channel: '購入管道',
  status: '狀態',
  wear: '新舊',
  condition: '書況',
  location: '藏書位置',
};

export const TEXT_LABELS: Record<TextKey, string> = {
  title: '書名',
  author: '作者',
  illustrator: '繪者',
};
