/** A page button, or a gap standing in for the pages that were left out. */
export type PageItem = number | 'gap';

/**
 * The page buttons to render: the first and last page, the pages around the
 * current one, and a gap wherever a run was left out. Keeping the count stable
 * matters less than keeping the row short on a phone.
 */
export function pageWindow(current: number, count: number, span = 1): PageItem[] {
  if (count <= 1) return count === 1 ? [1] : [];
  // Up to seven buttons still fit on a phone, so nothing needs hiding.
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);

  const wanted = new Set<number>([1, count]);
  for (let page = current - span; page <= current + span; page += 1) {
    if (page >= 1 && page <= count) wanted.add(page);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const items: PageItem[] = [];
  let previous = 0;
  for (const page of pages) {
    // A gap that hides a single page would be longer than the page itself.
    if (previous !== 0 && page - previous > 1) {
      items.push(page - previous === 2 ? previous + 1 : 'gap');
    }
    items.push(page);
    previous = page;
  }
  return items;
}

/** How many pages the result needs, never fewer than one. */
export function pageCount(total: number, pageSize: number | 'all'): number {
  if (pageSize === 'all') return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
