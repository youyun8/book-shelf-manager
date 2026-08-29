import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Book,
  FacetKey,
  Filters,
  PageSize,
  SortField,
  SortOrder,
  TextKey,
  ViewMode,
} from '../types';
import { EMPTY_FILTERS } from '../types';
import type { Account } from '../lib/api';
import { api } from '../lib/api';
import { applyFilters, countActiveFilters } from '../lib/filter';
import { promoteSortField, sortBooks } from '../lib/sort';
import { buildAllFacets } from '../lib/facets';
import { copyCount, countCopiesByTitle, otherCopies } from '../lib/copies';
import { pageCount as countPages } from '../lib/pagination';
import { SpreadsheetError } from '../lib/parse';
import { readBooksFromFile } from '../lib/read-spreadsheet';
import { downloadXlsx } from '../lib/export-xlsx';
import { searchToState, stateToSearch } from '../lib/url-state';
import type { Route } from '../lib/route';
import { pathToRoute, routeHref } from '../lib/route';
import { AppHeader } from './AppHeader';
import { FiltersPage } from './FiltersPage';
import { ActiveFilters } from './ActiveFilters';
import { ResultToolbar } from './ResultToolbar';
import { BookCard } from './BookCard';
import { BookTable } from './BookTable';
import { BookDialog } from './BookDialog';
import { BookEditor } from './BookEditor';
import { Pagination } from './Pagination';
import { DropOverlay, ErrorState, LoadingState, NoResultState } from './StateBlocks';

type Status = 'loading' | 'ready' | 'error';

interface LibraryProps {
  account: Account;
  onSignOut: () => void;
  /** Returns true when the failure was an expired session, which ends the view. */
  onExpire: (error: unknown) => boolean;
}

export function Library({ account, onSignOut, onExpire }: LibraryProps) {
  const initial = useMemo(() => searchToState(window.location.search), []);
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState<SortOrder>(initial.sort);
  const [view, setView] = useState<ViewMode>(initial.view);
  const [pageSize, setPageSize] = useState<PageSize>(initial.pageSize);
  const [page, setPage] = useState(1);

  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Book | null>(null);
  const [editing, setEditing] = useState<Book | null | undefined>(undefined);
  const [route, setRoute] = useState<Route>(() => pathToRoute(window.location.pathname));
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fail = useCallback(
    (cause: unknown, fallback: string) => {
      if (onExpire(cause)) return;
      setError(cause instanceof Error ? cause.message : fallback);
    },
    [onExpire],
  );

  const load = useCallback(
    () =>
      api
        .listBooks()
        .then(({ books: loaded }) => {
          setBooks(loaded);
          setStatus('ready');
          setError('');
        })
        .catch((cause: unknown) => {
          setStatus('error');
          fail(cause, '讀取書單失敗。');
        }),
    [fail],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const search = stateToSearch({ filters, sort, view, pageSize });

  // Keep the address bar in sync so a filtered view can be shared or bookmarked.
  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }, [search]);

  // Back and forward move between the two pages, and restore what was selected.
  useEffect(() => {
    const onPopState = () => {
      const restored = searchToState(window.location.search);
      setRoute(pathToRoute(window.location.pathname));
      setFilters(restored.filters);
      setSort(restored.sort);
      setView(restored.view);
      setPageSize(restored.pageSize);
      setPage(1);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      window.history.pushState(null, '', routeHref(next, search));
      setRoute(next);
      window.scrollTo({ top: 0 });
    },
    [search],
  );

  const importFile = useCallback(
    async (file: File) => {
      setNotice('');
      let parsed: Book[];
      try {
        parsed = await readBooksFromFile(file);
      } catch (cause) {
        setError(cause instanceof SpreadsheetError ? cause.message : '讀取檔案時發生錯誤。');
        return;
      }
      if (parsed.length === 0) {
        setError('這份檔案沒有可匯入的書籍。');
        return;
      }
      const confirmed = window.confirm(
        `這會用「${file.name}」的 ${parsed.length} 本書，取代大家目前看到的 ${books.length} 本書。確定要繼續嗎？`,
      );
      if (!confirmed) return;

      setBusy(true);
      try {
        const { imported } = await api.importBooks(file, parsed);
        setNotice(`已更新共用書單：${imported} 本書。`);
        await load();
      } catch (cause) {
        fail(cause, '上傳失敗，請再試一次。');
      } finally {
        setBusy(false);
      }
    },
    [books.length, fail, load],
  );

  // Dropping a spreadsheet anywhere on the page starts an import.
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      depth += 1;
      setDragging(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      event.preventDefault();
      void importFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFile]);

  const saveBook = useCallback(
    async (values: Omit<Book, 'id'>, id: string | null) => {
      setBusy(true);
      try {
        if (id === null) {
          const { book } = await api.createBook(values);
          setBooks((current) => [...current, book]);
          setNotice(`已新增《${book.title}》。`);
        } else {
          const { book } = await api.updateBook(id, values);
          setBooks((current) => current.map((item) => (item.id === id ? book : item)));
          setSelected((current) => (current?.id === id ? book : current));
          setNotice(`已更新《${book.title}》。`);
        }
        setEditing(undefined);
      } catch (cause) {
        fail(cause, '儲存失敗，請再試一次。');
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const removeBook = useCallback(
    async (book: Book) => {
      if (!window.confirm(`確定要從共用書單刪除《${book.title}》嗎？`)) return;
      setBusy(true);
      try {
        await api.deleteBook(book.id);
        setBooks((current) => current.filter((item) => item.id !== book.id));
        setEditing(undefined);
        setSelected(null);
        setNotice(`已刪除《${book.title}》。`);
      } catch (cause) {
        fail(cause, '刪除失敗，請再試一次。');
      } finally {
        setBusy(false);
      }
    },
    [fail],
  );

  const facets = useMemo(() => buildAllFacets(books, filters), [books, filters]);
  // Most titles are on the shelf more than once, so every view says how many.
  const copies = useMemo(() => countCopiesByTitle(books), [books]);
  const results = useMemo(
    () => sortBooks(applyFilters(books, filters), sort),
    [books, filters, sort],
  );
  const activeCount = countActiveFilters(filters);

  const pageCount = countPages(results.length, pageSize);
  // The result can shrink under the current page, for instance when a filter is
  // added or a book is deleted, so the page is clamped rather than stored back.
  const currentPage = Math.min(page, pageCount);
  const from = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const pageResults = pageSize === 'all' ? results : results.slice(from, from + pageSize);

  const goToPage = useCallback((next: number) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Any change to the selection sends the reader back to its first page.
  const changeFilters = useCallback((next: (current: Filters) => Filters) => {
    setFilters(next);
    setPage(1);
  }, []);

  const toggleFacet = useCallback(
    (key: FacetKey, value: string) => {
      changeFilters((current) => {
        const values = current.facets[key];
        const next = values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value];
        return { ...current, facets: { ...current.facets, [key]: next } };
      });
    },
    [changeFilters],
  );

  const clearFacet = useCallback(
    (key: FacetKey) => {
      changeFilters((current) => ({ ...current, facets: { ...current.facets, [key]: [] } }));
    },
    [changeFilters],
  );

  const changeText = useCallback(
    (key: TextKey, value: string) => {
      changeFilters((current) => ({ ...current, text: { ...current.text, [key]: value } }));
    },
    [changeFilters],
  );

  const resetFilters = useCallback(() => changeFilters(() => EMPTY_FILTERS), [changeFilters]);

  const changeSort = useCallback((next: SortOrder) => {
    setSort(next);
    setPage(1);
  }, []);

  // Clicking a table header sorts by that column, keeping the keys under it.
  const sortByField = useCallback(
    (field: SortField) => changeSort(promoteSortField(sort, field)),
    [changeSort, sort],
  );

  const changePageSize = useCallback((next: PageSize) => {
    setPageSize(next);
    setPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        account={account}
        bookCount={books.length}
        busy={busy || status === 'loading'}
        canExport={results.length > 0}
        route={route}
        activeFilterCount={activeCount}
        search={search}
        onNavigate={navigate}
        onPickFile={(file) => void importFile(file)}
        onExport={() => downloadXlsx(results)}
        onCreate={() => setEditing(null)}
        onSignOut={() => void onSignOut()}
      />

      {route === 'filters' ? (
        <FiltersPage
          filters={filters}
          facets={facets}
          activeCount={activeCount}
          shown={results.length}
          total={books.length}
          onToggleFacet={toggleFacet}
          onClearFacet={clearFacet}
          onChangeText={changeText}
          onReset={resetFilters}
          onDone={() => navigate('library')}
        />
      ) : (
        <main className="page-shell space-y-4 px-4 py-6 sm:px-6">
          <ResultToolbar
            shown={results.length}
            total={books.length}
            range={{ from: from + 1, to: from + pageResults.length }}
            sort={sort}
            view={view}
            pageSize={pageSize}
            onSortChange={changeSort}
            onViewChange={setView}
            onPageSizeChange={changePageSize}
          />

          <ActiveFilters
            filters={filters}
            onRemoveFacet={toggleFacet}
            onClearText={(key) => changeText(key, '')}
            onReset={resetFilters}
          />

          {notice !== '' && (
            <p className="rounded-lg border border-line bg-accent-soft px-3 py-2 text-xs text-accent">
              {notice}
            </p>
          )}
          {error !== '' && status === 'ready' && (
            <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-fg">
              {error}
            </p>
          )}

          {status === 'loading' && <LoadingState />}
          {status === 'error' && (
            <ErrorState
              message={error}
              onRetry={() => {
                setStatus('loading');
                void load();
              }}
            />
          )}
          {status === 'ready' && books.length === 0 && (
            <EmptyLibrary
              onCreate={() => setEditing(null)}
              onUpload={() => fileInputRef.current?.click()}
            />
          )}
          {status === 'ready' && books.length > 0 && results.length === 0 && (
            <NoResultState onReset={resetFilters} />
          )}
          {status === 'ready' && results.length > 0 && (
            <>
              {view === 'grid' ? (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pageResults.map((book) => (
                    <li key={book.id} className="flex">
                      <BookCard book={book} copies={copyCount(copies, book)} onOpen={setSelected} />
                    </li>
                  ))}
                </ul>
              ) : (
                <BookTable
                  books={pageResults}
                  sort={sort}
                  onSortBy={sortByField}
                  onOpen={setSelected}
                />
              )}
              <Pagination page={currentPage} pageCount={pageCount} onPageChange={goToPage} />
            </>
          )}
        </main>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = '';
        }}
      />

      {dragging && <DropOverlay />}

      <BookDialog
        book={selected}
        others={selected ? otherCopies(books, selected) : []}
        onClose={() => setSelected(null)}
        onEdit={(book) => {
          setSelected(null);
          setEditing(book);
        }}
      />

      <BookEditor
        book={editing}
        saving={busy}
        onSave={(values, id) => void saveBook(values, id)}
        onDelete={(book) => void removeBook(book)}
        onClose={() => setEditing(undefined)}
      />

      <footer className="page-shell px-4 pb-8 text-center text-xs text-fg-subtle sm:px-6">
        共用書單只有登入的成員看得到。
      </footer>
    </div>
  );
}

function EmptyLibrary({ onCreate, onUpload }: { onCreate: () => void; onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface py-16 text-center">
      <p className="text-sm font-medium text-fg">共用書單目前是空的</p>
      <p className="max-w-md text-xs text-fg-muted">
        上傳一份 Excel 就能建立整份書單，也可以先手動新增一本書。
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={onUpload}>
          上傳 Excel
        </button>
        <button type="button" className="btn" onClick={onCreate}>
          新增書籍
        </button>
      </div>
    </div>
  );
}
