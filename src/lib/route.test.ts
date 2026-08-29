import { describe, expect, it } from 'vitest';
import { pathToRoute, routeHref, routeToPath } from './route';

describe('route', () => {
  it('reads the page out of the path', () => {
    expect(pathToRoute('/filters')).toBe('filters');
    expect(pathToRoute('/filters/')).toBe('filters');
    expect(pathToRoute('/')).toBe('library');
    expect(pathToRoute('')).toBe('library');
    // Anything unknown is the list, which is what the Worker serves too.
    expect(pathToRoute('/nope')).toBe('library');
  });

  it('carries the selection between pages', () => {
    expect(routeHref('filters', '?pub=%E6%A0%BC%E6%9E%97')).toBe('/filters?pub=%E6%A0%BC%E6%9E%97');
    expect(routeHref('library', '')).toBe('/');
    expect(routeToPath('library')).toBe('/');
  });
});
