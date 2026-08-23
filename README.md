# 書櫃管家 (book-shelf-manager)

拍一張書架照片，自動辨識照片裡的每一本書、補齊書目資料，並記錄哪些已經買了。
資料存在 Cloudflare 雲端，隨時可以把整個書庫匯出成 CSV。

> UI 文案為繁體中文；程式碼、註解與 commit message 為英文。

---

## 目錄

- [功能](#功能)
- [架構](#架構)
- [技術棧](#技術棧)
- [使用者資料隔離](#使用者資料隔離)
- [開始使用](#開始使用)
  - [1. 安裝](#1-安裝)
  - [2. 建立 Cloudflare 資源](#2-建立-cloudflare-資源)
  - [3. 填入 wrangler.jsonc](#3-填入-wranglerjsonc)
  - [4. 設定 Google OAuth](#4-設定-google-oauth)
  - [5. 設定祕密](#5-設定祕密)
  - [6. 執行資料庫 migration](#6-執行資料庫-migration)
  - [7. 本地開發](#7-本地開發)
  - [8. 部署](#8-部署)
- [指令一覽](#指令一覽)
- [測試](#測試)
- [專案結構](#專案結構)
- [截圖](#截圖)

---

## 功能

| 需求       | 說明                                             |
| ---------- | ------------------------------------------------ |
| 拍照辨識   | 上傳書架照片，自動辨識照片中的多本書並寫入資料庫 |
| 購買狀態   | 每本書可標示已購買 / 未購買，卡片上一鍵切換      |
| 雲端與匯出 | 資料存於 D1 + R2，一鍵匯出整個書庫成 CSV         |
| 圖像化介面 | 以書封為主體的網格檢視，另有表格式清單檢視       |
| 多使用者   | 每人登入後只看得到自己的書庫，資料完全隔離       |

---

## 架構

```
                    ┌──────────────────────────────────────────┐
   瀏覽器            │        Cloudflare Workers (單一 Worker)     │
  ┌────────┐        │                                          │
  │ /      │        │  Next.js 15 App Router                   │
  │ /scan  │──────▶ │  透過 @opennextjs/cloudflare 轉譯          │
  │ /books │        │                                          │
  │ /settings│      │  ┌────────────────────────────────────┐  │
  └────────┘        │  │ app/          頁面 + Route Handlers │  │
       │            │  │ lib/auth/     require-user.ts       │  │
       │            │  │ lib/data/     綁定 D1 的 repository  │  │
       │            │  └──────────────┬─────────────────────┘  │
       │            │                 │  只有這一層碰得到資料庫    │
       │            │  ┌──────────────▼─────────────────────┐  │
       │            │  │ db/repositories/  每個 query 都帶     │  │
       │            │  │                   userId 條件        │  │
       │            │  └──────────────┬─────────────────────┘  │
       │            └─────────────────┼────────────────────────┘
       │                              │
       │            ┌─────────────────┼─────────────────┐
       │            ▼                 ▼                 ▼
       │      ┌──────────┐     ┌────────────┐    ┌────────────┐
       │      │ D1  (DB) │     │ R2(PHOTOS) │    │ KV         │
       │      │ 書籍/掃描 │     │ 書架照片    │    │(RATE_LIMIT)│
       │      │ 使用者    │     │ private    │    │ 次數限制    │
       │      └──────────┘     └────────────┘    └────────────┘
       │
       │  辨識流程（非同步）
       │  ─────────────────
       │  1. POST /api/upload   壓縮後的照片 → R2，建立 scans 記錄
       │  2. POST /api/scan     202 立即回應，工作丟進 ctx.waitUntil()
       │  3. GET  /api/scan/:id 前端每 2 秒輪詢狀態
       │
       │            Worker 內非同步工作
       └──────────────────┐
                          ▼
             ┌────────────────────────┐        ┌──────────────────────┐
             │ lib/vision.ts          │───────▶│ Anthropic Messages   │
             │ fetch + 強制 tool use   │        │ claude-sonnet-4-5    │
             └───────────┬────────────┘        └──────────────────────┘
                         │ 逐本查詢
                         ▼
             ┌────────────────────────┐        ┌──────────────────────┐
             │ lib/google-books.ts    │───────▶│ Google Books API     │
             │ 補齊 metadata 與書封     │        │ (public, 免金鑰)      │
             └───────────┬────────────┘        └──────────────────────┘
                         ▼
                   寫入 books 表
```

---

## 技術棧

| 層       | 選用                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| 前端     | Next.js 15（App Router）、TypeScript strict、Tailwind CSS v4、shadcn/ui、lucide-react |
| 執行環境 | Cloudflare Workers，透過 `@opennextjs/cloudflare`                                     |
| 資料庫   | Cloudflare D1（SQLite）+ Drizzle ORM + drizzle-kit migrations                         |
| 檔案儲存 | Cloudflare R2（bucket `book-photos`，private）                                        |
| 認證     | better-auth + better-auth-cloudflare（Google OAuth + Email OTP）                      |
| 影像辨識 | Anthropic Messages API（`claude-sonnet-4-5`），Worker 內以 `fetch` 直接呼叫           |
| 書目資料 | Google Books API（public endpoint）                                                   |
| 測試     | Vitest（`@cloudflare/vitest-pool-workers`，在 workerd 內跑真實 D1）+ Playwright       |

---

## 使用者資料隔離

D1 沒有 Row Level Security，隔離必須靠應用層強制。這是本專案風險最高的部分，
因此不依賴人的紀律，而是用四道機制擋住：

1. **單一入口** — 只有 `db/repositories/` 可以碰資料庫。每個匯出函式的第一個參數
   固定是 `userId`，每個 select / update / delete 都帶 `eq(table.userId, userId)`。
2. **靜態檢查** — `scripts/check-isolation.ts` 用 TypeScript compiler API 解析
   repository 層，只要有沒帶 `userId` 的 query、第一個參數不對、或 `app/`、
   `components/` 直接 import 資料庫，就讓 `npm run lint` 失敗。
3. **單元測試** — `db/repositories/*.test.ts` 建立兩個使用者，驗證 A 的所有讀 / 改 /
   刪操作都碰不到 B 的資料。
4. **端對端測試** — `e2e/isolation.spec.ts` 從實際執行的網站驗證同一件事：列表、
   直接輸入他人書籍網址、兩個同時登入的瀏覽器、以及未登入訪客。

`lib/data/` 是唯一把 D1 binding 綁進 repository 函式的地方，因此 `app/` 與
`components/` 即使想拿到未受限的資料庫連線也拿不到。

---

## 開始使用

### 1. 安裝

```bash
git clone <your-repo-url> book-shelf-manager
cd book-shelf-manager
npm install
```

`postinstall` 會自動執行 `wrangler types` 產生 `cloudflare-env.d.ts`。

登入 Cloudflare（如果還沒登入過）：

```bash
npx wrangler login
```

### 2. 建立 Cloudflare 資源

```bash
# D1 資料庫
npx wrangler d1 create book-shelf-manager

# R2 bucket（保持 private，不要開啟 public access）
npx wrangler r2 bucket create book-photos

# KV namespace（用於 /api/scan 的次數限制）
npx wrangler kv namespace create RATE_LIMIT
```

### 3. 填入 wrangler.jsonc

上面三個指令會各印出一個 id，貼進 `wrangler.jsonc` 對應的位置：

| 指令輸出                               | 貼到 `wrangler.jsonc` 的哪一行                                    |
| -------------------------------------- | ----------------------------------------------------------------- |
| `wrangler d1 create` 的 `database_id`  | `d1_databases[0].database_id`，取代 `"REPLACE_ME_D1_DATABASE_ID"` |
| `wrangler kv namespace create` 的 `id` | `kv_namespaces[0].id`，取代 `"REPLACE_ME_KV_NAMESPACE_ID"`        |
| R2 bucket 不會產生 id                  | `r2_buckets[0].bucket_name` 已經是 `"book-photos"`，不需修改      |

同時把 `vars.BETTER_AUTH_URL` 改成你實際部署的網址，例如
`"https://book-shelf-manager.<你的子網域>.workers.dev"`。

> **這是第一次部署最容易出錯的地方。** better-auth 會拒絕 `Origin` 與
> `BETTER_AUTH_URL` 不符的請求（回 `INVALID_ORIGIN`）。如果有多個網域，
> 用 `TRUSTED_ORIGINS` 祕密以逗號分隔補上。

改完重新產生型別：

```bash
npm run cf:typegen
```

### 4. 設定 Google OAuth

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → **APIs & Services** → **Credentials**。
2. **Create Credentials** → **OAuth client ID** → Application type 選
   **Web application**。
3. **Authorized redirect URIs** 填入（正式站與本機各一）：

   ```
   https://<你的 worker 網址>/api/auth/callback/google
   http://localhost:8787/api/auth/callback/google
   ```

4. **Authorized JavaScript origins** 填入：

   ```
   https://<你的 worker 網址>
   http://localhost:8787
   ```

5. 記下 Client ID 與 Client secret，下一步會用到。

### 5. 設定祕密

正式環境用 `wrangler secret put`（每個指令會提示你貼上值）：

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put BETTER_AUTH_SECRET      # openssl rand -base64 32
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# 選用
npx wrangler secret put RESEND_API_KEY          # 沒設定的話 OTP 只會寫進 log
npx wrangler secret put OTP_FROM_EMAIL
npx wrangler secret put TRUSTED_ORIGINS         # 逗號分隔的額外來源
```

本機開發改用 `.dev.vars`（已在 `.gitignore` 中）：

```bash
cp .dev.vars.example .dev.vars
# 編輯 .dev.vars 填入實際值
```

> 祕密不得使用 `NEXT_PUBLIC_` 前綴，也不得出現在 client bundle。
> `npm run lint` 之外，`README` 最後的驗證步驟有對應的 grep 檢查。

### 6. 執行資料庫 migration

```bash
# 本機
npm run db:migrate:local

# 正式環境
npm run db:migrate:remote
```

Schema 有變動時，先重新產生 migration：

```bash
npm run db:generate
```

### 7. 本地開發

兩種方式：

```bash
# 快速的 Next.js dev server（無 Cloudflare bindings）
npm run dev

# 完整的 Worker（有真實的 D1 / R2 / KV，行為與正式環境一致）
npm run cf:dev
```

`npm run cf:dev` 會先跑 `opennextjs-cloudflare build` 再啟動 `wrangler dev`，
預設在 <http://localhost:8787>。

要塞測試資料（兩個使用者各 20 本書）：

```bash
npm run db:seed
```

### 8. 部署

```bash
npx opennextjs-cloudflare deploy
# 或
npm run deploy
```

第一次部署後記得確認 `BETTER_AUTH_URL` 與實際網址一致，並在 Google Cloud
Console 補上正式站的 redirect URI。

推上 GitHub：

```bash
git remote add origin git@github.com:<你的帳號>/book-shelf-manager.git
git push -u origin main
```

---

## 指令一覽

| 指令                        | 用途                                                    |
| --------------------------- | ------------------------------------------------------- |
| `npm run dev`               | Next.js dev server（無 bindings）                       |
| `npm run build`             | Next.js production build                                |
| `npm run lint`              | ESLint + `tsc --noEmit` + 隔離檢查 + auth schema 檢查   |
| `npm run format`            | Prettier                                                |
| `npm run test`              | Vitest（在 workerd 內跑真實 D1）                        |
| `npm run test:e2e`          | Playwright（會自動 migrate、seed、build 並啟動 worker） |
| `npm run check:isolation`   | 只跑使用者隔離的靜態檢查                                |
| `npm run check:auth-schema` | 只檢查 better-auth schema 是否與 runtime 一致           |
| `npm run db:generate`       | 由 schema 產生 migration                                |
| `npm run db:migrate:local`  | 套用 migration 到本機 D1                                |
| `npm run db:migrate:remote` | 套用 migration 到正式 D1                                |
| `npm run db:seed`           | 塞入兩個使用者各 20 本假書（加 `-- --remote` 對正式站） |
| `npm run cf:typegen`        | 由 `wrangler.jsonc` 產生 `cloudflare-env.d.ts`          |
| `npm run cf:build`          | 產生 Worker bundle                                      |
| `npm run cf:dev`            | build 後啟動本機 Worker                                 |
| `npm run cf:preview`        | 本機預覽正式 build                                      |
| `npm run deploy`            | 部署到 Cloudflare                                       |

---

## 測試

```bash
npm run test      # 單元 / 整合測試
npm run test:e2e  # 端對端測試
```

單元測試在 workerd 內對**真實的本機 D1** 執行，套用的是實際會上線的 migration，
只有兩個對外的 HTTP 服務（Anthropic、Google Books）被 mock。

如果環境已經有預裝的 Chromium，可以讓 Playwright 直接使用而不必再下載一份：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium npm run test:e2e
```

涵蓋範圍：

- `lib/csv.test.ts` — 跳脫規則、BOM、陣列串接、中文、串流、1000 筆
- `lib/google-books.test.ts` — 結果 mapping、查無結果 fallback、API 失敗
- `lib/vision.test.ts` — 請求格式、JSON 解析、重試與各種錯誤路徑
- `lib/scan-pipeline.test.ts` — 完整辨識流程（mock Anthropic，真實 D1 + R2）
- `lib/rate-limit.test.ts` — 次數限制與時間窗
- `lib/format.test.ts` — Asia/Taipei 時間格式
- `db/repositories/*.test.ts` — 跨使用者隔離
- `e2e/` — 登入、書庫、掃描、匯出、隔離

---

## 專案結構

```
book-shelf-manager/
├── app/
│   ├── (auth)/login/page.tsx        登入頁（Google + Email OTP）
│   ├── (app)/layout.tsx             登入後的版面，未登入導向 /login
│   ├── (app)/page.tsx               書庫主頁
│   ├── (app)/scan/page.tsx          照片上傳與辨識
│   ├── (app)/books/[id]/page.tsx    單書詳情
│   ├── (app)/settings/page.tsx      帳號、匯出、刪除
│   ├── (app)/actions.ts             Server actions
│   ├── api/auth/[...all]/route.ts   better-auth handler
│   ├── api/upload/route.ts          照片上傳 → R2
│   ├── api/scan/route.ts            啟動辨識（非同步）
│   ├── api/scan/[id]/route.ts       輪詢辨識狀態
│   ├── api/photo/[scanId]/route.ts  private R2 照片，驗證後才回傳
│   └── api/export/route.ts          串流 CSV 匯出
├── components/                      book-card / book-grid / book-list /
│                                    scan-uploader / review-list / stat-bar …
│   └── ui/                          shadcn/ui 元件
├── db/
│   ├── schema.ts                    books / scans
│   ├── auth-schema.ts               better-auth 產生的表
│   ├── client.ts                    由 getCloudflareContext() 取得 D1
│   └── repositories/                books.ts / scans.ts（唯一可觸碰 db 的地方）
├── drizzle/                         產生的 migrations
├── lib/
│   ├── auth/                        better-auth 設定 + require-user.ts
│   ├── data/                        綁定 D1 的 repository（給 app/ 使用）
│   ├── vision.ts                    Anthropic 辨識封裝
│   ├── google-books.ts              書目查詢封裝
│   ├── csv.ts                       CSV 產生 + 跳脫
│   ├── r2.ts                        R2 存取
│   ├── rate-limit.ts                KV 次數限制
│   └── scan-pipeline.ts             辨識流程編排
├── scripts/
│   ├── check-isolation.ts           使用者隔離靜態檢查
│   ├── check-auth-schema.ts         better-auth schema 漂移檢查
│   └── seed.ts                      假資料
├── e2e/                             Playwright 測試
├── wrangler.jsonc
├── open-next.config.ts
├── .dev.vars.example
└── DECISIONS.md                     每個決策與理由
```

---

## 截圖

<!-- 部署後補上實際畫面 -->

| 畫面                 | 截圖   |
| -------------------- | ------ |
| 書庫主頁（網格檢視） | _待補_ |
| 書庫主頁（清單檢視） | _待補_ |
| 掃描與辨識結果確認   | _待補_ |
| 單書詳情             | _待補_ |
| 設定與匯出           | _待補_ |

---

## 授權

個人專案，未指定授權條款。
