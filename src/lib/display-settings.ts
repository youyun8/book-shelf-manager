/** Reading preferences that only affect this browser, never the shared list. */
export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'normal' | 'large' | 'huge';
export type PageWidth = 'narrow' | 'normal' | 'wide' | 'full';

export interface DisplaySettings {
  theme: ThemeMode;
  fontSize: FontSize;
  width: PageWidth;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'system',
  fontSize: 'normal',
  width: 'normal',
};

export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: '跟隨系統' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
];

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'normal', label: '標準' },
  { value: 'large', label: '大' },
  { value: 'huge', label: '特大' },
];

export const WIDTH_OPTIONS: { value: PageWidth; label: string }[] = [
  { value: 'narrow', label: '窄' },
  { value: 'normal', label: '標準' },
  { value: 'wide', label: '寬' },
  { value: 'full', label: '滿版' },
];

/** Root font size in percent; every size in the app is in `rem`, so all of it scales. */
const FONT_SCALE: Record<FontSize, string> = {
  small: '87.5%',
  normal: '100%',
  large: '112.5%',
  huge: '125%',
};

const MAX_WIDTH: Record<PageWidth, string> = {
  narrow: '72rem',
  normal: '100rem',
  wide: '120rem',
  full: '100%',
};

const STORAGE_KEY = 'bsm:display:v1';

function isOneOf<T extends string>(value: unknown, options: { value: T }[]): value is T {
  return typeof value === 'string' && options.some((option) => option.value === value);
}

/** Keeps whatever is readable and falls back to the default for the rest. */
export function coerceDisplaySettings(input: unknown): DisplaySettings {
  const source = (input ?? {}) as Record<string, unknown>;
  return {
    theme: isOneOf(source.theme, THEME_OPTIONS) ? source.theme : DEFAULT_DISPLAY_SETTINGS.theme,
    fontSize: isOneOf(source.fontSize, FONT_SIZE_OPTIONS)
      ? source.fontSize
      : DEFAULT_DISPLAY_SETTINGS.fontSize,
    width: isOneOf(source.width, WIDTH_OPTIONS) ? source.width : DEFAULT_DISPLAY_SETTINGS.width,
  };
}

export function readDisplaySettings(): DisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_DISPLAY_SETTINGS : coerceDisplaySettings(JSON.parse(raw));
  } catch {
    // Private mode, a full quota or a corrupted entry: the defaults still work.
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function writeDisplaySettings(settings: DisplaySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Saving is a convenience; the settings still apply to this session.
  }
}

/**
 * Writes the settings onto `<html>`, where the stylesheet picks them up. Called
 * before the first render too, so a dark page never flashes light on reload.
 */
export function applyDisplaySettings(settings: DisplaySettings): void {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.style.fontSize = FONT_SCALE[settings.fontSize];
  root.style.setProperty('--app-max-width', MAX_WIDTH[settings.width]);
}
