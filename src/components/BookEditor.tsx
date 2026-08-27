import { useEffect, useRef, useState } from 'react';
import type { Book } from '../types';
import { splitTags } from '../lib/parse';
import { IconClose, IconSpinner } from './icons';

type Draft = Omit<Book, 'id' | 'tags' | 'extras'> & { tags: string };

const EMPTY: Draft = {
  title: '',
  author: '',
  illustrator: '',
  translator: '',
  publisher: '',
  summary: '',
  ageRange: '',
  tags: '',
  channel: '',
  price: null,
  condition: '',
  location: '',
  isbn: '',
};

const FIELDS: { key: keyof Draft; label: string; placeholder?: string }[] = [
  { key: 'author', label: '作者' },
  { key: 'illustrator', label: '繪者' },
  { key: 'translator', label: '譯者' },
  { key: 'publisher', label: '出版社' },
  { key: 'ageRange', label: '適讀年齡', placeholder: '例如 3-6 歲' },
  { key: 'channel', label: '購入管道' },
  { key: 'condition', label: '書況', placeholder: '例如 收藏 / 待售' },
  { key: 'location', label: '藏書位置' },
  { key: 'isbn', label: 'ISBN', placeholder: '例如 9789861897271' },
];

function toDraft(book: Book | null): Draft {
  if (!book) return EMPTY;
  return { ...book, tags: book.tags.join('、') };
}

interface BookEditorProps {
  /** `null` creates a new book; a book edits it. `undefined` keeps the dialog closed. */
  book: Book | null | undefined;
  saving: boolean;
  onSave: (values: Omit<Book, 'id'>, id: string | null) => void;
  onDelete: (book: Book) => void;
  onClose: () => void;
}

export function BookEditor({ book, saving, onSave, onDelete, onClose }: BookEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = book !== undefined;
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  // Reset the form during render whenever the dialog opens on a different book.
  if (open && loadedFor !== (book?.id ?? null)) {
    setLoadedFor(book?.id ?? null);
    setDraft(toDraft(book));
  }
  if (!open && loadedFor !== undefined) {
    setLoadedFor(undefined);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { tags, price, ...rest } = draft;
    onSave(
      {
        ...rest,
        price,
        tags: splitTags(tags),
        extras: book?.extras ?? {},
      },
      book?.id ?? null,
    );
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(42rem,94vw)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-card"
    >
      {open && (
        <form onSubmit={submit} className="thin-scroll max-h-[85vh] overflow-y-auto">
          <header className="sticky top-0 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
            <h2 className="text-base font-bold">{book ? '編輯書籍' : '新增書籍'}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              className="focus-ring rounded-lg p-1.5 text-fg-subtle transition hover:bg-surface-muted hover:text-fg"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="book-title" className="mb-1 block text-xs font-medium text-fg-muted">
                書名 <span className="text-accent">*</span>
              </label>
              <input
                id="book-title"
                required
                value={draft.title}
                onChange={(event) => set('title', event.target.value)}
                className="field"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`book-${field.key}`}
                    className="mb-1 block text-xs font-medium text-fg-muted"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`book-${field.key}`}
                    value={String(draft[field.key] ?? '')}
                    placeholder={field.placeholder}
                    onChange={(event) => set(field.key, event.target.value)}
                    className="field"
                  />
                </div>
              ))}

              <div>
                <label
                  htmlFor="book-price"
                  className="mb-1 block text-xs font-medium text-fg-muted"
                >
                  購入價格
                </label>
                <input
                  id="book-price"
                  inputMode="decimal"
                  value={draft.price === null ? '' : String(draft.price)}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    const value = raw === '' ? null : Number(raw.replace(/[^\d.-]/g, ''));
                    setDraft((current) => ({
                      ...current,
                      price: value === null || Number.isNaN(value) ? null : value,
                    }));
                  }}
                  className="field"
                />
              </div>
            </div>

            <div>
              <label htmlFor="book-tags" className="mb-1 block text-xs font-medium text-fg-muted">
                分類標籤
              </label>
              <input
                id="book-tags"
                value={draft.tags}
                placeholder="用、或 , 分隔，例如 療癒、美感"
                onChange={(event) => set('tags', event.target.value)}
                className="field"
              />
            </div>

            <div>
              <label
                htmlFor="book-summary"
                className="mb-1 block text-xs font-medium text-fg-muted"
              >
                內容簡介
              </label>
              <textarea
                id="book-summary"
                rows={4}
                value={draft.summary}
                onChange={(event) => set('summary', event.target.value)}
                className="field resize-y"
              />
            </div>
          </div>

          <footer className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
            {book ? (
              <button
                type="button"
                onClick={() => onDelete(book)}
                className="focus-ring rounded-lg px-2 py-1 text-sm text-red-600 transition hover:underline dark:text-red-400"
              >
                刪除這本書
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button type="button" className="btn" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving && <IconSpinner className="h-4 w-4" />}
                儲存
              </button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
  );
}
