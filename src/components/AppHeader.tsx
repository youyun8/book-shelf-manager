import { useRef } from 'react';
import type { Account } from '../lib/api';
import { IconBooks, IconDownload, IconPlus, IconSpinner, IconUpload } from './icons';
import { DisplaySettingsMenu } from './DisplaySettingsMenu';

interface AppHeaderProps {
  account: Account;
  bookCount: number;
  busy: boolean;
  canExport: boolean;
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
  onPickFile,
  onExport,
  onCreate,
  onSignOut,
}: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="page-shell flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <IconBooks className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-bold text-fg">藏書庫存管理</h1>
            <p className="flex items-center gap-1.5 truncate text-xs text-fg-subtle">
              {busy && <IconSpinner className="h-3 w-3" />}
              <span className="truncate">
                共用書單 {bookCount} 本 · {account.email}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
