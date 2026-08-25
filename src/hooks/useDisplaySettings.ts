import { useCallback, useEffect, useState } from 'react';
import type { DisplaySettings } from '../lib/display-settings';
import {
  applyDisplaySettings,
  DEFAULT_DISPLAY_SETTINGS,
  readDisplaySettings,
  writeDisplaySettings,
} from '../lib/display-settings';

interface DisplaySettingsControls {
  settings: DisplaySettings;
  /** Changes one preference and keeps the rest. */
  update: <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => void;
  reset: () => void;
  isDefault: boolean;
}

/** Reads the saved reading preferences and keeps `<html>` in step with them. */
export function useDisplaySettings(): DisplaySettingsControls {
  const [settings, setSettings] = useState<DisplaySettings>(readDisplaySettings);

  useEffect(() => {
    applyDisplaySettings(settings);
    writeDisplaySettings(settings);
  }, [settings]);

  const update = useCallback(
    <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => setSettings(DEFAULT_DISPLAY_SETTINGS), []);

  const isDefault = (Object.keys(DEFAULT_DISPLAY_SETTINGS) as (keyof DisplaySettings)[]).every(
    (key) => settings[key] === DEFAULT_DISPLAY_SETTINGS[key],
  );

  return { settings, update, reset, isDefault };
}
