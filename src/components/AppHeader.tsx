import { useRef } from 'react';
import { IconBooks, IconDownload, IconSpinner, IconUpload } from './icons';

interface AppHeaderProps {
  sourceLabel: string;
  loading: boolean;
  canExport: boolean;
  templateUrl: string;
  onPickFile: (file: File) => void;
  onExport: () => void;
}

export function AppHeader({
  sourceLabel,
  loading,
  canExport,
  templateUrl,
  onPickFile,
  onExport,
}: AppHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <IconBooks className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-bold text-fg">藏書庫存管理</h1>
            <p className="truncate text-xs text-fg-subtle">
              {loading ? (
                <span className="inline-flex items-center gap-1">
                  <IconSpinner className="h-3 w-3" /> 讀取書單中…
                </span>
              ) : (
                sourceLabel
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={templateUrl}
            download
            className="btn hidden text-fg-muted sm:inline-flex"
            title="下載欄位範本，填好後可直接載入"
          >
            <IconDownload className="h-4 w-4" />
            Excel 範本
          </a>
          <button type="button" className="btn" onClick={onExport} disabled={!canExport}>
            <IconDownload className="h-4 w-4" />
            <span className="hidden sm:inline">匯出結果</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
          >
            <IconUpload className="h-4 w-4" />
            載入 Excel
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
