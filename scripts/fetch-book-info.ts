/**
 * Looks every book in the spreadsheet up on Google Books once, and stores the
 * results in public/data/book-info.json.
 *
 * The site loads that file at startup, so visitors get covers and book details
 * without calling the API themselves. That matters because the key-less Google
 * Books quota is counted per IP address: on mobile networks, where thousands of
 * people share a handful of addresses, live lookups often come back as 429.
 *
 *   npm run data:covers                 # fill in the books that have no entry yet
 *   npm run data:covers -- --force      # look every book up again
 *   npm run data:covers -- --file=path/to/other.xlsx
 *   GOOGLE_BOOKS_KEY=xxx npm run data:covers   # use an API key for a higher quota
 */
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { readSheet } from 'read-excel-file/node';
import type { Book } from '../src/types';
import { rowsToBooks } from '../src/lib/parse';
import type { Row } from '../src/lib/parse';
import { cacheKey, lookupBookInfo, LookupError, setApiKey } from '../src/lib/book-info';
import type { ExternalBookInfo } from '../src/lib/book-info';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..', 'public', 'data');

const DELAY_MS = 400;
const QUOTA_WAIT_MS = 15_000;
const QUOTA_RETRIES = 1;
/** Stop once the quota is clearly gone rather than waiting book after book. */
const QUOTA_GIVE_UP_AFTER = 2;

interface InfoFile {
  version: 1;
  generatedAt: string;
  entries: Record<string, ExternalBookInfo | null>;
}

function readFlag(name: string): string | undefined {
  const found = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  return found?.slice(name.length + 3);
}

async function readExistingFile(path: string): Promise<InfoFile> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as InfoFile;
    if (parsed.entries) return parsed;
  } catch {
    // No file yet, or it is unreadable: start over.
  }
  return { version: 1, generatedAt: new Date().toISOString(), entries: {} };
}

function isQuotaError(cause: unknown): boolean {
  return cause instanceof LookupError && /額度|429/.test(cause.message);
}

/** Retries once the shared quota resets, so a long run is not lost to one 429. */
async function lookupWithRetry(book: Book): Promise<ExternalBookInfo | null> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await lookupBookInfo(book, { force: true });
    } catch (cause) {
      if (!isQuotaError(cause) || attempt >= QUOTA_RETRIES) throw cause;
      console.log(`   配額暫時用完，等待 ${QUOTA_WAIT_MS / 1000} 秒後重試…`);
      await sleep(QUOTA_WAIT_MS);
    }
  }
}

async function main(): Promise<void> {
  const key = process.env.GOOGLE_BOOKS_KEY ?? '';
  if (key !== '') setApiKey(key);

  const source = resolve(readFlag('file') ?? resolve(dataDir, 'books.xlsx'));
  const target = resolve(dataDir, 'book-info.json');
  const force = process.argv.includes('--force');

  const rows = (await readSheet(createReadStream(source))) as Row[];
  const books = rowsToBooks(rows);
  const file = await readExistingFile(target);

  console.log(`讀取 ${source}：${books.length} 本書`);
  if (key === '') console.log('提示：設定 GOOGLE_BOOKS_KEY 可提高查詢配額。');

  const missing: string[] = [];
  let found = 0;
  let skipped = 0;
  let failed = 0;
  let quotaStreak = 0;
  let stopped = false;

  for (const book of books) {
    const id = cacheKey(book);
    if (!force && id in file.entries) {
      skipped += 1;
      if (file.entries[id] === null) missing.push(book.title);
      continue;
    }

    try {
      const info = await lookupWithRetry(book);
      file.entries[id] = info;
      if (info) {
        found += 1;
        console.log(`✓ ${book.title}${info.coverUrl === '' ? '（無封面圖）' : ''}`);
      } else {
        missing.push(book.title);
        console.log(`· ${book.title} — 查不到`);
      }
    } catch (cause) {
      failed += 1;
      const message = cause instanceof Error ? cause.message : String(cause);
      console.log(`✗ ${book.title} — ${message}`);
      quotaStreak = isQuotaError(cause) ? quotaStreak + 1 : 0;
      if (quotaStreak >= QUOTA_GIVE_UP_AFTER) {
        console.log(
          '\n配額已經用完，先停在這裡。已查到的結果會保留，稍後或換個網路再執行一次即可接續。',
        );
        stopped = true;
        break;
      }
    }
    await sleep(DELAY_MS);
  }

  if (Object.keys(file.entries).length === 0) {
    console.log('\n沒有任何可寫入的結果，未產生 book-info.json。');
  } else {
    file.generatedAt = new Date().toISOString();
    await mkdir(dataDir, { recursive: true });
    await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    console.log(`\n寫入 ${target}${stopped ? '（未完成，可再執行一次接續）' : ''}`);
  }
  console.log(
    `查到 ${found} 本、沿用既有 ${skipped} 本、查不到 ${missing.length} 本、失敗 ${failed} 本`,
  );
  if (missing.length > 0) {
    console.log('\n以下書籍在 Google Books 查不到，可在 Excel 的「封面連結」欄自行填入圖片網址：');
    for (const title of missing) console.log(`  - ${title}`);
  }
}

main().catch((cause: unknown) => {
  console.error(cause);
  process.exitCode = 1;
});
