import { readSheet } from 'read-excel-file/browser';
import type { Book } from '../types';
import { parseCsv, rowsToBooks, SpreadsheetError } from './parse';
import type { Row } from './parse';

const XLSX_PATTERN = /\.(xlsx|xlsm|xltx)$/i;

/** Reads a `.xlsx` or `.csv` blob into books. */
export async function readBooksFromFile(file: File | Blob, name?: string): Promise<Book[]> {
  const fileName = name ?? (file instanceof File ? file.name : '');
  if (fileName !== '' && !XLSX_PATTERN.test(fileName)) {
    if (/\.(csv|tsv|txt)$/i.test(fileName)) {
      return rowsToBooks(parseCsv(await file.text()));
    }
    throw new SpreadsheetError('僅支援 .xlsx 或 .csv 檔案。');
  }
  try {
    const rows = (await readSheet(file)) as Row[];
    return rowsToBooks(rows);
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    throw new SpreadsheetError('無法讀取這個 Excel 檔案，請確認檔案格式為 .xlsx。');
  }
}

/** Loads the spreadsheet that ships with the site (`public/data/books.xlsx`). */
export async function loadBundledBooks(url: string): Promise<Book[]> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new SpreadsheetError(`讀取書單失敗（HTTP ${response.status}）。`);
  const blob = await response.blob();
  return readBooksFromFile(blob, url);
}
