import { describe, expect, it } from 'vitest';
import { pageCount, pageWindow } from './pagination';

describe('pageCount', () => {
  it('rounds up and never drops below one page', () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(500, 'all')).toBe(1);
  });
});

describe('pageWindow', () => {
  it('lists every page while they still fit', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first, last and neighbouring pages', () => {
    expect(pageWindow(6, 20)).toEqual([1, 'gap', 5, 6, 7, 'gap', 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('shows a lone hidden page instead of a gap', () => {
    expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('has nothing to show for an empty result', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });
});
