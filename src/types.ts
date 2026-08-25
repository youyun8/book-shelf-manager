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
  /** `分類標籤` split on the usual Chinese and ASCII separators. */
  tags: string[];
  /** `購入管道` */
  channel: string;
  /** `購入價格`, `null` when the cell is empty or not a number. */
  price: number | null;
  /** `書況` / `狀態` */
  condition: string;
  /** `藏書位置` */
  location: string;
  /** `ISBN`, used to look the book up online. */
  isbn: string;
  /** `封面連結`, an image URL that overrides the looked-up cover. */
  coverUrl: string;
  /** Columns that do not map to a known field, kept for the detail view. */
  extras: Record<string, string>;
}

/** Checkbox facets. Values inside one facet are OR-ed, facets are AND-ed. */
export const FACET_KEYS = ['publisher', 'ageRange', 'tags', 'channel', 'condition'] as const;
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

export type SortKey = 'default' | 'title' | 'priceAsc' | 'priceDesc' | 'publisher';
export type ViewMode = 'grid' | 'table';

export const EMPTY_FILTERS: Filters = {
  facets: { publisher: [], ageRange: [], tags: [], channel: [], condition: [] },
  text: { title: '', author: '', illustrator: '' },
};

export const FACET_LABELS: Record<FacetKey, string> = {
  publisher: '出版社',
  ageRange: '年齡層',
  tags: '分類標籤',
  channel: '購入管道',
  condition: '書況',
};

export const TEXT_LABELS: Record<TextKey, string> = {
  title: '書名',
  author: '作者',
  illustrator: '繪者',
};
