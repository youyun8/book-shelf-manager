import type { Book, SortDirection, SortField, SortOrder, SortRule } from '../types';
import { FIELD_LABELS, SORT_FIELDS } from '../types';
import { compareText } from './filter';
import { CONDITION_VALUES, READING_MODE_VALUES, STATUS_VALUES, WEAR_VALUES } from './vocabulary';
import { rankOf } from './vocabulary';

/**
 * What one sortable field is called and how its values line up. `missing` is
 * kept apart from `compare` because a blank cell is not a small value: it goes
 * last whichever direction the reader picked, so flipping a sort never fills the
 * first page with books that have nothing in that column.
 */
interface FieldSpec {
  /** How the two directions read for this field, so `新舊` never says `遞增`. */
  directions: Record<SortDirection, string>;
  missing: (book: Book) => boolean;
  /** Ascending comparison. Only called when neither side is missing. */
  compare: (a: Book, b: Book) => number;
}

const TEXT_DIRECTIONS: Record<SortDirection, string> = { asc: '順序', desc: '反序' };
const SIZE_DIRECTIONS: Record<SortDirection, string> = { asc: '小到大', desc: '大到小' };

/** A plain text field: empty cells count as missing, the rest use the collator. */
function textField(read: (book: Book) => string, directions = TEXT_DIRECTIONS): FieldSpec {
  return {
    directions,
    missing: (book) => read(book) === '',
    compare: (a, b) => compareText(read(a), read(b)),
  };
}

/**
 * A field with a known list of values, such as `狀態`. Values follow the list,
 * anything unexpected sorts after it, and equal ranks fall back to the text so
 * two unknown values still have a stable order.
 */
function rankedField(
  read: (book: Book) => string,
  values: readonly string[],
  directions = TEXT_DIRECTIONS,
): FieldSpec {
  return {
    directions,
    missing: (book) => read(book) === '',
    compare: (a, b) =>
      rankOf(values, read(a)) - rankOf(values, read(b)) || compareText(read(a), read(b)),
  };
}

/** Leading number of an age label, so `0-4 歲` sorts before `4-10 歲`. */
export function ageSortKey(label: string): number {
  const match = label.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export const SORT_SPECS: Record<SortField, FieldSpec> = {
  title: textField((book) => book.title),
  status: rankedField((book) => book.status, STATUS_VALUES),
  channel: textField((book) => book.channel),
  price: {
    directions: { asc: '低到高', desc: '高到低' },
    missing: (book) => book.price === null,
    compare: (a, b) => (a.price ?? 0) - (b.price ?? 0),
  },
  wear: rankedField((book) => book.wear, WEAR_VALUES, { asc: '新到舊', desc: '舊到新' }),
  condition: rankedField((book) => book.condition, CONDITION_VALUES, {
    asc: '好到差',
    desc: '差到好',
  }),
  location: textField((book) => book.location),
  author: textField((book) => book.author),
  illustrator: textField((book) => book.illustrator),
  translator: textField((book) => book.translator),
  publisher: textField((book) => book.publisher),
  ageRange: {
    directions: SIZE_DIRECTIONS,
    missing: (book) => book.ageRange === '',
    compare: (a, b) =>
      ageSortKey(a.ageRange) - ageSortKey(b.ageRange) || compareText(a.ageRange, b.ageRange),
  },
  readingMode: rankedField((book) => book.readingMode, READING_MODE_VALUES),
};

export function sortFieldLabel(field: SortField): string {
  return FIELD_LABELS[field];
}

export function sortDirectionLabel(rule: SortRule): string {
  return SORT_SPECS[rule.field].directions[rule.direction];
}

function isSortField(value: string): value is SortField {
  return (SORT_FIELDS as readonly string[]).includes(value);
}

/** Drops unknown fields and repeats, so a hand-edited URL can never break a sort. */
export function normalizeSort(rules: readonly SortRule[]): SortOrder {
  const seen = new Set<SortField>();
  const normalized: SortOrder = [];
  for (const rule of rules) {
    if (!isSortField(rule.field) || seen.has(rule.field)) continue;
    seen.add(rule.field);
    normalized.push({ field: rule.field, direction: rule.direction === 'desc' ? 'desc' : 'asc' });
  }
  return normalized;
}

/** Fields not used yet, in the order they are offered in the menu. */
export function unusedSortFields(sort: SortOrder): SortField[] {
  const used = new Set(sort.map((rule) => rule.field));
  return SORT_FIELDS.filter((field) => !used.has(field));
}

/**
 * What one rule's field picker offers: everything still free, plus the field
 * that rule is already on. Sorting twice on the same field says nothing, so no
 * other rule's field is on the list.
 */
export function sortFieldOptions(sort: SortOrder, current: SortField): SortField[] {
  const used = new Set(sort.map((rule) => rule.field));
  return SORT_FIELDS.filter((field) => field === current || !used.has(field));
}

function compareRule(a: Book, b: Book, rule: SortRule): number {
  const spec = SORT_SPECS[rule.field];
  const aMissing = spec.missing(a);
  const bMissing = spec.missing(b);
  if (aMissing || bMissing) {
    if (aMissing && bMissing) return 0;
    return aMissing ? 1 : -1;
  }
  return spec.compare(a, b) * (rule.direction === 'desc' ? -1 : 1);
}

/**
 * Sorts by every rule in turn: the first rule decides, and each later one only
 * breaks the ties the ones before it left. With no rules the books keep the
 * order of the imported file, which is also the final tiebreaker, so the result
 * never depends on the browser's sort being stable.
 */
export function sortBooks(books: readonly Book[], sort: SortOrder): Book[] {
  const rules = normalizeSort(sort);
  const positions = new Map(books.map((book, index) => [book.id, index]));
  return [...books].sort((a, b) => {
    for (const rule of rules) {
      const result = compareRule(a, b, rule);
      if (result !== 0) return result;
    }
    return (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0);
  });
}

/**
 * Makes `field` the primary key, which is what clicking a table header does.
 * Clicking the current primary field flips it instead; the rules below it are
 * kept, so a reader can build up an order by clicking one header after another.
 */
export function promoteSortField(sort: SortOrder, field: SortField): SortOrder {
  const current = sort[0];
  if (current?.field === field) {
    const flipped: SortDirection = current.direction === 'asc' ? 'desc' : 'asc';
    return [{ field, direction: flipped }, ...sort.slice(1)];
  }
  return [{ field, direction: 'asc' }, ...sort.filter((rule) => rule.field !== field)];
}

/** Moves a rule one step up or down the list of keys. */
export function moveSortRule(sort: SortOrder, index: number, offset: number): SortOrder {
  const target = index + offset;
  if (index < 0 || index >= sort.length || target < 0 || target >= sort.length) return sort;
  const next = [...sort];
  const [rule] = next.splice(index, 1);
  next.splice(target, 0, rule as SortRule);
  return next;
}
