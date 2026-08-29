/** Colour for the 狀態 badge. Unknown values fall back to a neutral style. */
const STATUS_STYLES: { match: string[]; className: string }[] = [
  {
    match: ['收藏', '典藏', '保留'],
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
  {
    match: ['待售', '出售', '販售'],
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300',
  },
  {
    match: ['絕版', '交換'],
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300',
  },
  {
    match: ['待共讀', '共讀'],
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300',
  },
  {
    match: ['待讀', '未讀'],
    className:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/25 dark:bg-violet-400/10 dark:text-violet-300',
  },
  {
    match: ['已售', '售出', '送出', '轉讓'],
    className: 'border-line bg-surface-muted text-fg-muted line-through decoration-fg-subtle/60',
  },
];

const NEUTRAL = 'border-line bg-surface-muted text-fg-muted';

export function statusClass(status: string): string {
  const found = STATUS_STYLES.find((style) =>
    style.match.some((keyword) => status.includes(keyword)),
  );
  return found?.className ?? NEUTRAL;
}

export function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return `NT$ ${price.toLocaleString('zh-Hant-TW')}`;
}
