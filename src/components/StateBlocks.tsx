import { IconBooks, IconSpinner, IconUpload } from './icons';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-20 text-fg-subtle">
      <IconSpinner className="h-6 w-6" />
      <p className="text-sm">正在讀取書單…</p>
    </div>
  );
}

export function ErrorState({ message, onPickFile }: { message: string; onPickFile: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface py-16 text-center">
      <IconBooks className="h-8 w-8 text-fg-subtle" />
      <div>
        <p className="text-sm font-medium text-fg">無法載入書單</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-fg-muted">{message}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onPickFile}>
        <IconUpload className="h-4 w-4" />
        改為載入本機 Excel
      </button>
    </div>
  );
}

export function NoResultState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface py-16 text-center">
      <p className="text-sm font-medium text-fg">沒有符合條件的書籍</p>
      <p className="max-w-md text-xs text-fg-muted">
        試著取消幾個勾選條件，或縮短書名、作者、繪者的關鍵字。
      </p>
      <button type="button" className="btn" onClick={onReset}>
        清除所有條件
      </button>
    </div>
  );
}

export function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-accent/10 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-surface px-10 py-8 shadow-card">
        <IconUpload className="h-7 w-7 text-accent" />
        <p className="text-sm font-medium text-fg">放開即可載入這份 Excel</p>
      </div>
    </div>
  );
}
