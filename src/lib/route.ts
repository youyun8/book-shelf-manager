/**
 * The two pages of the signed-in app. The filters live on their own page, so
 * the book list keeps the whole width, and a filtered view can be linked to
 * from either page: the path says which page, the query says what is selected.
 */
export type Route = 'library' | 'filters';

const FILTERS_PATH = '/filters';

export function pathToRoute(pathname: string): Route {
  return pathname.replace(/\/+$/, '') === FILTERS_PATH ? 'filters' : 'library';
}

export function routeToPath(route: Route): string {
  return route === 'filters' ? FILTERS_PATH : '/';
}

/** The address for a page, carrying the current selection across with it. */
export function routeHref(route: Route, search: string): string {
  return `${routeToPath(route)}${search}`;
}
