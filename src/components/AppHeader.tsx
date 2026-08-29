import { useRef } from 'react';
import type { Account } from '../lib/api';
import type { Route } from '../lib/route';
import { routeHref } from '../lib/route';
import { cn } from '../lib/cn';
import { IconBooks, IconDownload, IconFilter, IconPlus, IconSpinner, IconUpload } from './icons';
import { DisplaySettingsMenu } from './DisplaySettingsMenu';

interface AppHeaderProps {
  account: Account;
  bookCount: number;
  busy: boolean;
  canExport: boolean;
  /** Which page is showing, so the filter link can mark itself current. */
  route: Route;
  /** How many conditions are set, shown on the filter link. */
  activeFilterCount: number;
  /** The current selection, so both links keep it when followed. */
  search: string;
  onNavigate: (route: Route) => void;
  onPickFile: (file: File) => void;
  onExport: () => void;
  onCreate: () => void;
  onSignOut: () => void;
}

export function AppHeader({
  account,
  bookCount,
  busy,
  canExport,
  route,
  activeFilterCount,
  search,
  onNavigate,
  onPickFile,
  onExport,
  onCreate,
  onSignOut,
}: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Both links are real anchors, so they can be opened in a new tab or copied
   * like any other address; a plain click is handled in the page instead.
   */
  // The label is hidden on a narrow screen, so the link says its own name.
  const filterLabel =
    activeFilterCount === 0 ? '篩選條件' : `篩選條件（${activeFilterCount} 個條件）`;

  const follow = (event: React.MouseEvent, next: Route) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate(next);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="page-shell flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* The title doubles as the way home, so the list is always one click away. */}
          <a
            href={routeHref('library', search)}
            onClick={(event) => follow(event, 'library')}
            className="focus-ring flex min-w-0 items-center gap-3 rounded-lg"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
              <IconBooks className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <h1 className="text-base leading-tight font-bold text-fg">藏書庫存管理</h1>
              <span className="flex items-center gap-1.5 truncate text-xs text-fg-subtle">
                {busy && <IconSpinner className="h-3 w-3" />}
                <span className="truncate">
                  共用書單 {bookCount} 本 · {account.email}
                </span>
              </span>
            </span>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={routeHref('filters', search)}
            onClick={(event) => follow(event, 'filters')}
            aria-current={route === 'filters' ? 'page' : undefined}
            aria-label={filterLabel}
            title={filterLabel}
            className={cn(
              'btn',
              route === 'filters' && 'border-transparent bg-accent-soft text-accent',
            )}
          >
            <IconFilter className="h-4 w-4" />
            <span className="hidden sm:inline">篩選</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">
                {activeFilterCount}
              </span>
            )}
          </a>
          <button type="button" className="btn" onClick={onExport} disabled={!canExport}>
            <IconDownload className="h-4 w-4" />
            <span className="hidden sm:inline">匯出</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            title="上傳 Excel 取代整份共用書單"
          >
            <IconUpload className="h-4 w-4" />
            <span className="hidden sm:inline">上傳 Excel</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            <IconPlus className="h-4 w-4" />
            <span className="hidden sm:inline">新增書籍</span>
          </button>
          <DisplaySettingsMenu />
          <button
            type="button"
            className="focus-ring rounded-lg px-2 py-2 text-sm text-fg-subtle transition hover:text-fg"
            onClick={onSignOut}
          >
            登出
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPickFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>
    </header>
  );
}
