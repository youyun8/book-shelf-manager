import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FILTER_PANEL_OPEN,
  readFilterPanelOpen,
  writeFilterPanelOpen,
} from './filter-panel';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
});

describe('filter panel preference', () => {
  beforeEach(() => store.clear());

  it('starts open and round-trips both states', () => {
    expect(readFilterPanelOpen()).toBe(DEFAULT_FILTER_PANEL_OPEN);
    writeFilterPanelOpen(false);
    expect(readFilterPanelOpen()).toBe(false);
    writeFilterPanelOpen(true);
    expect(readFilterPanelOpen()).toBe(true);
  });

  it('treats an unreadable entry as the default rather than throwing', () => {
    store.set('bsm:filters:v1', 'garbage');
    expect(readFilterPanelOpen()).toBe(DEFAULT_FILTER_PANEL_OPEN);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readFilterPanelOpen()).toBe(true);
    expect(() => writeFilterPanelOpen(false)).not.toThrow();
  });
});
