import { useEffect, useRef, useState } from 'react';
import type { Book } from '../types';
import { FIELD_LABELS } from '../types';
import { splitTags } from '../lib/parse';
import {
  CONDITION_VALUES,
  READING_MODE_VALUES,
  STATUS_VALUES,
  WEAR_VALUES,
} from '../lib/vocabulary';
import { IconClose, IconSpinner } from './icons';

type Draft = Omit<Book, 'id' | 'tags' | 'extras'> & { tags: string };

const EMPTY: Draft = {
  title: '',
  status: '',
  channel: '',
  price: null,
  wear: '',
  condition: '',
  location: '',
  notes: '',
  author: '',
  illustrator: '',
  translator: '',
  publisher: '',
  summary: '',
  ageRange: '',
  readingMode: '',
  tags: '',
  isbn: '',
};

/**
 * `options` is a fixed list the sheet keeps on its lookup page, so the field is
 * a picker rather than a text box. It used to be a datalist behind a text
 * input, which reads as if the other values are gone: a datalist filters its
 * suggestions by what the box already says, so a book already marked 收藏 只
 * offered 收藏 until the box was cleared. A select always shows the whole list.
 */
const FIELDS: {
  key: keyof Draft;
  label: string;
  placeholder?: string;
  options?: readonly string[];
  /** The price is a number, so it gets its own input rather than a text one. */
  numeric?: boolean;
}[] = [
  { key: 'status', label: FIELD_LABELS.status, options: STATUS_VALUES },
  { key: 'channel', label: FIELD_LABELS.channel },
  { key: 'price', label: FIELD_LABELS.price, numeric: true },
  { key: 'wear', label: FIELD_LABELS.wear, options: WEAR_VALUES },
  { key: 'condition', label: FIELD_LABELS.condition, options: CONDITION_VALUES },
  { key: 'location', label: FIELD_LABELS.location, placeholder: '例如 竹北 / 辦公室' },
  { key: 'author', label: FIELD_LABELS.author },
  { key: 'illustrator', label: FIELD_LABELS.illustrator },
  { key: 'translator', label: FIELD_LABELS.translator },
  { key: 'publisher', label: FIELD_LABELS.publisher },
  { key: 'ageRange', label: FIELD_LABELS.ageRange, placeholder: '例如 3-6 歲' },
  { key: 'readingMode', label: FIELD_LABELS.readingMode, options: READING_MODE_VALUES },
  { key: 'isbn', label: FIELD_LABELS.isbn, placeholder: '例如 9789861897271' },
];

/**
 * The fixed list, plus whatever this book already says if the sheet has since
 * moved on. An older row is never silently rewritten by opening the editor.
 */
function optionsFor(options: readonly string[], current: string): string[] {
  return current === '' || options.includes(current) ? [...options] : [...options, current];
}

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
                  {field.numeric ? (
                    <input
                      id={`book-${field.key}`}
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
                  ) : field.options ? (
                    <select
                      id={`book-${field.key}`}
                      value={String(draft[field.key] ?? '')}
                      onChange={(event) => set(field.key, event.target.value)}
                      className="field"
                    >
                      <option value="">未填</option>
                      {optionsFor(field.options, String(draft[field.key] ?? '')).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`book-${field.key}`}
                      value={String(draft[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(event) => set(field.key, event.target.value)}
                      className="field"
                    />
                  )}
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="book-notes" className="mb-1 block text-xs font-medium text-fg-muted">
                備註
              </label>
              <textarea
                id="book-notes"
                rows={2}
                value={draft.notes}
                onChange={(event) => set('notes', event.target.value)}
                className="field resize-y"
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

            <div>
              <label htmlFor="book-tags" className="mb-1 block text-xs font-medium text-fg-muted">
                建議標籤
              </label>
              <input
                id="book-tags"
                value={draft.tags}
                placeholder="用、或 , 分隔，例如 療癒、美感"
                onChange={(event) => set('tags', event.target.value)}
                className="field"
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
