import { useEffect, useId, useRef, useState } from 'react';
import type { AccentColor } from '../lib/display-settings';
import {
  ACCENT_OPTIONS,
  accentSwatch,
  FONT_SIZE_OPTIONS,
  THEME_OPTIONS,
  WIDTH_OPTIONS,
} from '../lib/display-settings';
import { useDisplaySettings } from '../hooks/useDisplaySettings';
import { cn } from '../lib/cn';
import { IconSliders } from './icons';

interface ChoiceRowProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function ChoiceRow<T extends string>({ label, options, value, onChange }: ChoiceRowProps<T>) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-xs font-medium text-fg-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium whitespace-nowrap transition',
              option.value === value
                ? 'border-transparent bg-accent text-accent-fg'
                : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:bg-surface-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface AccentRowProps {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
}

/** The accent is picked from the colour itself rather than from its name. */
function AccentRow({ value, onChange }: AccentRowProps) {
  return (
    <div role="group" aria-label="色調">
      <p className="mb-1.5 text-xs font-medium text-fg-muted">色調</p>
      <div className="flex flex-wrap gap-2">
        {ACCENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.label}
            aria-label={option.label}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring h-7 w-7 rounded-full border-2 transition',
              option.value === value ? 'border-fg' : 'border-transparent hover:border-line-strong',
            )}
          >
            <span
              className="block h-full w-full rounded-full"
              style={{ backgroundColor: accentSwatch(option.value) }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Per-browser reading preferences: colour theme, accent, text size and width. */
export function DisplaySettingsMenu() {
  const { settings, update, reset, isDefault } = useDisplaySettings();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Clicking elsewhere or pressing Escape closes the panel, as a menu should.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-controls={panelId}
        title="顯示設定：主題、字級、版面寬度"
        onClick={() => setOpen((current) => !current)}
      >
        <IconSliders className="h-4 w-4" />
        <span className="hidden sm:inline">顯示設定</span>
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] space-y-4 rounded-xl border border-line bg-surface p-4 shadow-card"
        >
          <ChoiceRow
            label="主題"
            options={THEME_OPTIONS}
            value={settings.theme}
            onChange={(value) => update('theme', value)}
          />
          <AccentRow value={settings.accent} onChange={(value) => update('accent', value)} />
          <ChoiceRow
            label="字級"
            options={FONT_SIZE_OPTIONS}
            value={settings.fontSize}
            onChange={(value) => update('fontSize', value)}
          />
          <ChoiceRow
            label="版面寬度"
            options={WIDTH_OPTIONS}
            value={settings.width}
            onChange={(value) => update('width', value)}
          />

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <p className="text-[11px] text-fg-subtle">只會影響這個瀏覽器</p>
            <button
              type="button"
              className="focus-ring rounded px-1 text-xs font-medium text-accent hover:underline disabled:text-fg-subtle disabled:no-underline"
              onClick={reset}
              disabled={isDefault}
            >
              恢復預設
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
