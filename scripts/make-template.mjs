// Generates public/data/template.xlsx: the empty spreadsheet people fill in
// and upload to the shared library.
//   npm run data:template
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rowsToXlsx } from './xlsx-writer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..', 'public', 'data');

const HEADERS = [
  '書名',
  '作者',
  '繪者',
  '譯者',
  '出版社',
  '內容簡介',
  '適讀年齡',
  '分類標籤',
  '購入管道',
  '購入價格',
  '書況',
  '藏書位置',
];

const WIDTHS = [22, 14, 14, 12, 14, 46, 12, 22, 14, 10, 10, 14];

// Optional columns: an ISBN makes the online lookup exact, and a cover URL
// overrides the looked-up image.
const TEMPLATE_HEADERS = [...HEADERS, 'ISBN', '封面連結'];
const TEMPLATE_WIDTHS = [...WIDTHS, 16, 24];

// Two hint rows so the format of each column is obvious when the file is opened.
const TEMPLATE_ROWS = [
  TEMPLATE_HEADERS,
  [
    '走在夢的路上',
    '刀根里衣',
    '刀根里衣',
    '蘇懿禎',
    '格林文化',
    '絕美畫風，關於夢想與陪伴的心靈之旅。',
    '4-10 歲',
    '療癒、美感、夢想',
    '誠品書店',
    320,
    '收藏',
    '客廳書櫃 A1',
  ],
  [
    '（範例）多個標籤請用頓號分隔',
    '作者姓名',
    '繪者姓名',
    '譯者姓名',
    '出版社名稱',
    '一兩句書籍簡介',
    '0-4 歲',
    '標籤一、標籤二',
    '網路書店',
    250,
    '待售',
    '書房層架 B2',
  ],
];

mkdirSync(dataDir, { recursive: true });

const template = rowsToXlsx(TEMPLATE_ROWS, {
  sheetName: '書單',
  columnWidths: TEMPLATE_WIDTHS,
});
writeFileSync(resolve(dataDir, 'template.xlsx'), template);
console.log(`寫入 public/data/template.xlsx（${template.length} bytes）`);
