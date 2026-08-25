import { describe, expect, it } from 'vitest';
import { accentSwatch, coerceDisplaySettings, DEFAULT_DISPLAY_SETTINGS } from './display-settings';

describe('coerceDisplaySettings', () => {
  it('keeps every readable preference', () => {
    expect(
      coerceDisplaySettings({
        theme: 'dark',
        fontSize: 'large',
        width: 'full',
        accent: 'forest',
      }),
    ).toEqual({ theme: 'dark', fontSize: 'large', width: 'full', accent: 'forest' });
  });

  it('falls back per field, so one bad value cannot reset the rest', () => {
    expect(coerceDisplaySettings({ theme: 'neon', accent: 'rose' })).toEqual({
      ...DEFAULT_DISPLAY_SETTINGS,
      accent: 'rose',
    });
  });

  it('survives anything that is not a settings object', () => {
    expect(coerceDisplaySettings(null)).toEqual(DEFAULT_DISPLAY_SETTINGS);
    expect(coerceDisplaySettings('nope')).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });
});

describe('accentSwatch', () => {
  it('mixes the swatch from the tone of the chosen accent', () => {
    expect(accentSwatch('indigo')).toBe('oklch(52% 0.19 275)');
    expect(accentSwatch('clay')).toBe('oklch(52% 0.16 45)');
  });
});
