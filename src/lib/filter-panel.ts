/**
 * Whether the filter sidebar is open, remembered per browser like the display
 * settings. It is kept in its own entry rather than in `display-settings.ts`
 * because the settings menu holds its own copy of those, and two copies of one
 * entry would overwrite each other.
 */
const STORAGE_KEY = 'bsm:filters:v1';

/** Open is the default: a reader who has never touched it sees the filters. */
export const DEFAULT_FILTER_PANEL_OPEN = true;

export function readFilterPanelOpen(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'open') return true;
    if (raw === 'collapsed') return false;
    // Missing, or written by something else: the default rather than a guess.
    return DEFAULT_FILTER_PANEL_OPEN;
  } catch {
    // Private mode or a blocked store: the default still works.
    return DEFAULT_FILTER_PANEL_OPEN;
  }
}

export function writeFilterPanelOpen(open: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, open ? 'open' : 'collapsed');
  } catch {
    // Saving is a convenience; the panel still opens and closes this session.
  }
}
