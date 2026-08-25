import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Book, FacetKey, SortKey, TextKey, ViewMode } from './types';
import { EMPTY_FILTERS } from './types';
import { applyFilters, countActiveFilters, sortBooks } from './lib/filter';
import { buildAllFacets } from './lib/facets';
import { loadBundledBooks, readBooksFromFile, SpreadsheetError } from './lib/parse';
import { downloadCsv } from './lib/export-csv';
import { searchToState, stateToSearch } from './lib/url-state';
import { AppHeader } from './components/AppHeader';
import { FilterPanel } from './components/FilterPanel';
import { ActiveFilters } from './components/ActiveFilters';
import { ResultToolbar } from './components/ResultToolbar';
import { BookCard } from './components/BookCard';
import { BookTable } from './components/BookTable';
import { BookDialog } from './components/BookDialog';
import { DropOverlay, ErrorState, LoadingState, NoResultState } from './components/StateBlocks';

const BASE = import.meta.env.BASE_URL;
const DATA_URL = `${BASE}data/books.xlsx`;
const TEMPLATE_URL = `${BASE}data/template.xlsx`;

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const initial = useMemo(() => searchToState(window.location.search), []);
  const [filters, setFilters] = useState(initial.filters);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [view, setView] = useState<ViewMode>(initial.view);

  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [sourceLabel, setSourceLabel] = useState('讀取書單中…');
  const [selected, setSelected] = useState<Book | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const describe = useCallback((label: string, count: number) => `${label} · ${count} 本藏書`, []);

  // Load the spreadsheet that ships with the site.
  useEffect(() => {
    let cancelled = false;
    loadBundledBooks(DATA_URL)
      .then((loaded) => {
        if (cancelled) return;
        setBooks(loaded);
        setStatus('ready');
        setSourceLabel(describe('books.xlsx', loaded.length));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setSourceLabel('尚未載入書單');
        setError(
          cause instanceof SpreadsheetError
            ? cause.message
            : '找不到 public/data/books.xlsx，請上傳自己的 Excel 或把檔案放進專案。',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [describe]);

  // Keep the address bar in sync so a filtered view can be shared or bookmarked.
  useEffect(() => {
    const search = stateToSearch({ filters, sort, view });
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }, [filters, sort, view]);

  const loadFile = useCallback(
    async (file: File) => {
      setStatus('loading');
      try {
        const loaded = await readBooksFromFile(file);
        setBooks(loaded);
        setStatus('ready');
        setError('');
        setSourceLabel(describe(file.name, loaded.length));
      } catch (cause) {
        setStatus('error');
        setError(cause instanceof SpreadsheetError ? cause.message : '讀取檔案時發生錯誤。');
      }
    },
    [describe],
  );

  // Dropping a spreadsheet anywhere on the page loads it.
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
      void loadFile(file);
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
  }, [loadFile]);

  const facets = useMemo(() => buildAllFacets(books, filters), [books, filters]);
  const results = useMemo(
    () => sortBooks(applyFilters(books, filters), sort),
    [books, filters, sort],
  );
  const activeCount = countActiveFilters(filters);

  const toggleFacet = useCallback((key: FacetKey, value: string) => {
    setFilters((current) => {
      const values = current.facets[key];
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return { ...current, facets: { ...current.facets, [key]: next } };
    });
  }, []);

  const clearFacet = useCallback((key: FacetKey) => {
    setFilters((current) => ({ ...current, facets: { ...current.facets, [key]: [] } }));
  }, []);

  const changeText = useCallback((key: TextKey, value: string) => {
    setFilters((current) => ({ ...current, text: { ...current.text, [key]: value } }));
  }, []);

  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const renderPanel = (onClose?: () => void) => (
    <FilterPanel
      filters={filters}
      facets={facets}
      activeCount={activeCount}
      onToggleFacet={toggleFacet}
      onClearFacet={clearFacet}
      onChangeText={changeText}
      onReset={resetFilters}
      onClose={onClose}
    />
  );

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        sourceLabel={sourceLabel}
        loading={status === 'loading'}
        canExport={results.length > 0}
        templateUrl={TEMPLATE_URL}
        onPickFile={(file) => void loadFile(file)}
        onExport={() => downloadCsv(results, '藏書清單.csv')}
      />

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-[4.75rem] flex max-h-[calc(100vh-6.5rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card">
            {renderPanel()}
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <ResultToolbar
            shown={results.length}
            total={books.length}
            sort={sort}
            view={view}
            activeFilterCount={activeCount}
            onSortChange={setSort}
            onViewChange={setView}
            onOpenFilters={() => setDrawerOpen(true)}
          />

          <ActiveFilters
            filters={filters}
            onRemoveFacet={toggleFacet}
            onClearText={(key) => changeText(key, '')}
            onReset={resetFilters}
          />

          {status === 'loading' && <LoadingState />}
          {status === 'error' && (
            <ErrorState message={error} onPickFile={() => fileInputRef.current?.click()} />
          )}
          {status === 'ready' && results.length === 0 && <NoResultState onReset={resetFilters} />}
          {status === 'ready' &&
            results.length > 0 &&
            (view === 'grid' ? (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {results.map((book) => (
                  <li key={book.id} className="flex">
                    <BookCard book={book} onOpen={setSelected} />
                  </li>
                ))}
              </ul>
            ) : (
              <BookTable books={results} onOpen={setSelected} />
            ))}
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="關閉篩選"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-hidden bg-surface p-4 shadow-card">
            {renderPanel(() => setDrawerOpen(false))}
            <button
              type="button"
              className="btn btn-primary mt-3 w-full"
              onClick={() => setDrawerOpen(false)}
            >
              查看 {results.length} 筆結果
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void loadFile(file);
          event.target.value = '';
        }}
      />

      {dragging && <DropOverlay />}
      <BookDialog book={selected} onClose={() => setSelected(null)} />

      <footer className="mx-auto max-w-[1600px] px-4 pb-8 text-center text-xs text-fg-subtle sm:px-6">
        書單只在你的瀏覽器中讀取，不會上傳到任何伺服器；點開單本書時，會用書名或 ISBN 向 Google
        Books 查詢封面與書籍資料。
      </footer>
    </div>
  );
}
