# 藏書庫存管理 Book Shelf Manager

多人共用的藏書庫存網站：登入後大家看到、編輯的都是**同一份書單**，
可以用勾選條件與關鍵字快速找出庫存書籍。未登入者看不到任何書籍資料。

- 帳號登入（Email + 密碼），只有**允許名單**中的 Email 才能註冊
- 書單存在雲端，任何裝置登入後看到的都是同一份最新資料
- 兩種更新方式：**上傳 Excel 取代整份書單**，或在網頁上**逐本新增／編輯／刪除**
- 勾選篩選：出版社、年齡層、分類標籤、購入管道、書況
- 關鍵字輸入：書名、作者、繪者
- 卡片／表格檢視、排序、匯出目前結果為 CSV
- 書籍詳細視窗會顯示封面與線上書目，可把封面存進共用書單
- 支援手機、平板、電腦，自動跟隨系統的淺色／深色模式

## 架構

```
瀏覽器 ──────► Cloudflare Worker（同一個網域）
                 ├─ 靜態網頁（React 單頁應用程式）
                 ├─ /api/auth/*   註冊、登入、登出、目前身分
                 └─ /api/books/*  共用書單的讀取與編輯（需登入）
                        │
                        ├─ D1（SQLite）  帳號、工作階段、書籍資料
                        └─ R2            上傳過的 Excel 原始檔備份
```

未登入時，`/api/books` 一律回 401，網頁只會顯示登入畫面，
瀏覽器拿不到任何書籍資料。

| 項目     | 技術                                        |
| -------- | ------------------------------------------- |
| 前端     | React 19、TypeScript、Tailwind CSS v4、Vite |
| 後端     | Cloudflare Workers、Hono                    |
| 資料庫   | Cloudflare D1（SQLite）                     |
| 檔案儲存 | Cloudflare R2                               |
| 登入     | Email + 密碼，PBKDF2 雜湊、HttpOnly Cookie  |
| 測試     | Vitest                                      |

---

## 目錄

1. [部署到 Cloudflare（詳細步驟）](#部署到-cloudflare詳細步驟)
2. [帳號管理](#帳號管理)
3. [本機開發](#本機開發)
4. [Excel 欄位規格](#excel-欄位規格)
5. [網頁操作說明](#網頁操作說明)
6. [書封與線上書目](#書封與線上書目)
7. [安全性說明](#安全性說明)
8. [疑難排解](#疑難排解)
9. [專案結構與指令](#專案結構與指令)

---

## 部署到 Cloudflare（詳細步驟）

需求：[Node.js](https://nodejs.org/) 22 以上、Git、一個 Cloudflare 帳號（免費方案即可）。

### 步驟 1：取得程式碼並安裝

```bash
git clone https://github.com/<你的帳號>/book-shelf-manager.git
cd book-shelf-manager
npm ci
```

### 步驟 2：登入 Cloudflare

```bash
npx wrangler login      # 會開啟瀏覽器，登入後按「Allow」
npx wrangler whoami     # 確認登入成功
```

### 步驟 3：建立資料庫與檔案儲存空間

```bash
npx wrangler d1 create book-shelf-manager
```

指令會印出一段設定，其中有一行 `database_id = "xxxxxxxx-..."`，**把這個 id 複製起來**。

```bash
npx wrangler r2 bucket create book-shelf-uploads
```

> 第一次使用 R2 需要先在 Cloudflare 後台 **R2 → 啟用**（免費額度很充足）。
> 如果不想啟用 R2，可以把 `wrangler.jsonc` 中的 `r2_buckets` 整段刪掉，
> 功能不受影響，只是上傳的 Excel 原始檔不會被備份。

### 步驟 4：填入 database_id

打開 `wrangler.jsonc`，把這一行換成步驟 3 拿到的 id：

```jsonc
"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID",
```

### 步驟 5：建立資料表

```bash
npm run db:migrate
```

### 步驟 6：部署

```bash
npm run deploy
```

完成後會印出網址，形如 `https://book-shelf-manager.<你的帳號>.workers.dev`。

### 步驟 7：把自己加進允許名單

**這一步很重要**：沒有列在名單上的 Email 無法註冊，也就看不到任何資料。

```bash
npm run db:allow -- 你的信箱@example.com
```

要加入家人或同事，就多執行幾次：

```bash
npm run db:allow -- 家人的信箱@example.com
```

### 步驟 8：註冊並上傳書單

1. 打開步驟 6 的網址。
2. 點「註冊」，用剛剛加入名單的 Email 設定密碼（至少 10 個字元）。
3. 登入後點右上角「上傳 Excel」，選擇你的書單檔案。
4. 確認提示後，書單就會出現，其他人登入也會看到同一份。

### 步驟 9（選用）：設定 GitHub 自動部署

設定後，只要推到 `main` 就會自動測試、套用資料庫更新並重新部署。

1. 到 Cloudflare 後台 → **My Profile → API Tokens → Create Token**，
   選 **Edit Cloudflare Workers** 範本，建立後複製權杖。
2. 在 Cloudflare 後台首頁右側複製 **Account ID**。
3. 回到 GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**，
   新增兩個：
   - `CLOUDFLARE_API_TOKEN`：步驟 1 的權杖
   - `CLOUDFLARE_ACCOUNT_ID`：步驟 2 的 Account ID
4. 之後推送到 `main` 即會自動部署（`.github/workflows/deploy.yml`）。

### 步驟 10（選用）：自訂網域

在 Cloudflare 後台 **Workers & Pages → book-shelf-manager → Settings → Domains & Routes**
新增自己的網域即可，不需要改程式。

---

## 帳號管理

| 需求               | 做法                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 允許新的人註冊     | `npm run db:allow -- someone@example.com`                                                                                               |
| 查看允許名單       | `npx wrangler d1 execute book-shelf-manager --remote --command "SELECT email FROM allowed_emails"`                                      |
| 移除某人的註冊資格 | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM allowed_emails WHERE email='someone@x.com'"`                |
| 停用已註冊的帳號   | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM users WHERE email='someone@x.com'"`（連同工作階段一起消失） |
| 忘記密碼           | 目前沒有寄信功能：用上一列指令刪除該帳號，對方就能用同一個 Email 重新註冊（書單資料不受影響）                                           |
| 強制所有人重新登入 | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM sessions"`                                                  |

登入狀態會保留 30 天，之後需要重新登入。

---

## 本機開發

需要兩個終端機視窗：

```bash
npm run db:migrate:local   # 只需第一次
npm run db:allow -- 你的信箱@example.com --local

# 終端機 1：API（Worker + D1 + R2 的本機模擬）
npm run dev:api

# 終端機 2：網頁（會自動把 /api 轉送到終端機 1）
npm run dev
```

打開 `http://localhost:5173`。若想測試和線上完全一樣的組合，用：

```bash
npm run build && npm run preview
```

---

## Excel 欄位規格

上傳時會讀取檔案中的**第一個工作表**，並自動尋找標題列（前 10 列中最先符合兩個以上欄位名稱的那一列）。

| 網頁上的用途     | Excel 欄位名稱（任一種寫法都可以）             | 說明                                        |
| ---------------- | ---------------------------------------------- | ------------------------------------------- |
| 書名             | `書名`、`書籍名稱`、`名稱`、`Title`            | 建議必填，空白列會被略過                    |
| 作者             | `作者`、`文`、`Author`                         | 可用關鍵字搜尋                              |
| 繪者             | `繪者`、`插畫`、`繪圖`、`Illustrator`          | 可用關鍵字搜尋                              |
| 譯者             | `譯者`、`翻譯`                                 | 顯示於卡片與詳細資料                        |
| 出版社           | `出版社`、`出版商`、`Publisher`                | 勾選篩選                                    |
| 書籍內容摘要     | `內容簡介`、`書籍內容摘要`、`內容摘要`、`簡介` | 卡片顯示三行，詳細資料顯示全文              |
| 適讀年齡         | `適讀年齡`、`年齡層`、`建議年齡`               | 勾選篩選，會依數字大小排序（0-4 早於 4-10） |
| 分類標籤         | `分類標籤`、`建議標籤`、`標籤`、`分類`         | 勾選篩選，可填多個標籤                      |
| 購入管道         | `購入管道`、`購買管道`、`來源`                 | 勾選篩選                                    |
| 購入價格         | `購入價格`、`價格`、`售價`、`定價`             | 可排序                                      |
| 書況             | `書況`、`狀態`、`書籍狀態`                     | 勾選篩選，例如 收藏／待售／待共讀           |
| 藏書位置         | `藏書位置`、`存放位置`、`書櫃位置`、`位置`     | 顯示於卡片與表格                            |
| ISBN（選填）     | `ISBN`、`ISBN13`、`條碼`                       | 有填的話封面查詢會完全命中，建議填          |
| 封面連結（選填） | `封面連結`、`封面`、`書封`、`圖片`、`cover`    | 填了就用這張圖，不再使用線上查到的封面      |

其他自訂欄位（例如 `備註`、`借給誰`）不會被丟掉，會出現在書籍詳細視窗中。

需要空白範本時執行 `npm run data:template`，或直接點網頁右上角的「範本」。

### 填寫細節

- **欄位名稱可以加括號說明**：`狀態(收藏/待售/待共讀)` 會被視為 `狀態`。
- **多個標籤**用 `、`、`,`、`/`、`;` 分隔皆可，例如 `療癒、美感、夢想`。
- **價格**可以填數字或 `NT$1,200 元`，程式只取其中的數字；空白代表未填。
- 欄位順序可以任意調換，也可以只填其中幾欄。
- 若檔案裡有兩欄意思重疊（例如同時有「狀態」和「書況」），程式會挑**實際有填資料的那一欄**當作篩選依據，另一欄會保留在書籍詳細視窗中。

---

## 網頁操作說明

| 區域         | 操作                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| 左側篩選欄   | 書名／作者／繪者輸入關鍵字；出版社、年齡層、分類標籤、購入管道、書況用勾選 |
| 條件邏輯     | 同一組條件之間是「或」，不同組條件之間是「且」                             |
| 選項後的數字 | 勾選這個條件後會剩下幾本書（已把其他條件算進去）                           |
| 上方條件列   | 顯示目前生效的條件，點一下即可移除；「全部清除」一次歸零                   |
| 新增書籍     | 右上角「新增書籍」，填完儲存後所有人都看得到                               |
| 編輯／刪除   | 點任一本書 →「編輯」，可修改所有欄位或刪除                                 |
| 上傳 Excel   | 右上角「上傳 Excel」或把檔案拖進網頁，**會用整份檔案取代目前的共用書單**   |
| 匯出         | 「匯出」把目前篩選結果存成 CSV（含 BOM，Excel 開啟不會亂碼）               |
| 分享網址     | 篩選條件會寫進網址列，複製給同樣有帳號的人即可看到相同的篩選結果           |
| 手機         | 上方「篩選」按鈕會叫出篩選抽屜                                             |

> 上傳 Excel 會取代整份共用書單，動作前會跳出確認視窗。
> 原始檔案會備份到 R2，若不小心覆蓋掉，可以在 Cloudflare 後台的 R2 找回先前上傳的檔案。

---

## 書封與線上書目

點任一本書會跳出詳細視窗，除了 Excel 的欄位之外還會顯示：

- **書封圖片**：優先用「封面連結」欄，其次是 Google Books 查到的圖，再其次是 Open Library（用 ISBN，免金鑰）。
- **線上書籍資料**：出版社、出版日期、頁數、ISBN、書籍介紹與 Google Books 連結。
- **書店搜尋連結**：誠品線上、博客來、Amazon。

查詢順序是 `ISBN` →「書名＋作者」→「書名」，並會比對書名／作者，避免抓到不相干的書。
查到封面後可以按「**把這張封面存進書單**」，之後所有人開啟這本書都會直接看到這張封面，
不需要再查詢一次（Google Books 無金鑰時的配額是依 IP 計算，行動網路容易額度不足）。

如果希望即時查詢更穩定，可在建置時提供 Google Books API 金鑰：

```bash
VITE_GOOGLE_BOOKS_KEY=你的金鑰 npm run deploy
```

金鑰會被打包進公開的網頁檔案，請在 Google Cloud Console 設定 HTTP 參照網址限制。

> **為什麼不是直接嵌入誠品或 Amazon 的頁面？**
> 這兩個網站都以 `X-Frame-Options` 禁止被其他網站用 iframe 嵌入，也不開放跨網域讀取資料。
> 因此改用官方開放、允許跨網域查詢的 Google Books API 取得封面與書目，再以連結導向各書店。

---

## 安全性說明

- 書籍 API 一律需要有效的工作階段，未登入回 401；網頁本身沒有任何預先打包的書籍資料。
- 密碼以 PBKDF2-SHA256 加隨機鹽雜湊後儲存，資料庫中沒有明碼。
  迭代次數會跟著雜湊一起存，因此日後調高不會讓既有帳號無法登入。
  預設 25,000 次是為了配合 Workers **免費方案**每次請求 10ms CPU 的限制；
  若你使用付費方案（每月 $5，CPU 上限 30 秒），可以把 `worker/auth.ts` 的
  `PBKDF2_ITERATIONS` 調成 100,000 以上，之後新設定的密碼就會用新的次數。
- 工作階段 Cookie 為 `HttpOnly`、`SameSite=Lax`，正式網域上會加上 `Secure`，JavaScript 讀不到。
- 資料庫只存 Cookie 的雜湊值，就算資料庫外洩也無法被拿來冒充登入。
- 同一個 Email 連續登入失敗 8 次，會被暫停 15 分鐘。
- 寫入類請求會檢查 `Origin`，阻擋跨站送出的表單。
- 允許名單與帳號互相獨立：把 Email 從允許名單移除**不會**自動停用已註冊的帳號，
  需要停用時請一併刪除 `users` 中的該筆資料（見上方帳號管理）。

---

## 疑難排解

| 狀況                                 | 原因與解法                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 註冊時顯示「不在允許名單中」         | 執行 `npm run db:allow -- 該信箱`，注意大小寫不影響、前後不要有空白。                                         |
| 部署時說找不到 D1 資料庫             | `wrangler.jsonc` 的 `database_id` 還沒填，或填錯。重新執行 `npx wrangler d1 create book-shelf-manager` 取得。 |
| 網頁打得開但一直轉圈、主控台出現 500 | 資料表還沒建立。執行 `npm run db:migrate`。                                                                   |
| 登入出現 `Error 1102`（CPU 超時）    | Workers 免費方案的限制。把 `worker/auth.ts` 的 `PBKDF2_ITERATIONS` 調低，或升級付費方案。                     |
| 上傳 Excel 顯示「找不到標題列」      | 第一個工作表的前 10 列沒有 `書名`、`作者` 之類的欄位名稱，或標題列被合併儲存格。                              |
| 篩選欄少了某一組條件                 | 該欄位在 Excel 中全部是空白，或欄位名稱不在對應表中。                                                         |
| 詳細視窗顯示「查詢額度已用完」       | Google Books 免金鑰配額依 IP 計算。查到封面後按「把這張封面存進書單」即可一勞永逸，或設定 API 金鑰。          |
| 想看之前上傳過的 Excel               | Cloudflare 後台 → R2 → `book-shelf-uploads` → `imports/` 資料夾。                                             |
| GitHub Actions 部署失敗              | 確認 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID` 兩個 secret 都有設定，且權杖有 Workers 編輯權限。      |

---

## 專案結構與指令

```
.
├─ .github/workflows/
│  ├─ ci.yml               # Pull request 檢查
│  └─ deploy.yml           # 推到 main 時部署到 Cloudflare
├─ migrations/
│  └─ 0001_init.sql        # D1 資料表
├─ worker/                 # Cloudflare Worker（API）
│  ├─ index.ts             # 路由與權限
│  ├─ auth.ts              # 密碼雜湊、工作階段、允許名單、登入限制
│  └─ books.ts             # 書籍資料的讀寫與欄位淨化
├─ public/data/template.xlsx  # 空白欄位範本
├─ scripts/
│  ├─ allow-email.mjs      # 加入允許名單
│  ├─ make-template.mjs    # 產生範本
│  └─ xlsx-writer.mjs      # 最小化的 .xlsx 產生器
├─ src/                    # 前端
│  ├─ components/          # 版面與 UI 元件（含登入畫面、書籍編輯）
│  ├─ hooks/               # useSession、useBookInfo
│  ├─ lib/
│  │  ├─ api.ts            # 呼叫 Worker API
│  │  ├─ columns.ts        # Excel 欄位名稱對應
│  │  ├─ parse.ts          # 表格列轉換成書籍資料
│  │  ├─ read-spreadsheet.ts # 瀏覽器端讀取 xlsx / csv
│  │  ├─ filter.ts         # 篩選與排序
│  │  ├─ facets.ts         # 勾選選項與數量統計
│  │  ├─ book-info.ts      # Google Books 查詢與書店連結
│  │  └─ export-csv.ts     # 匯出結果
│  └─ App.tsx              # 登入與書單的切換
└─ wrangler.jsonc          # Worker、D1、R2 設定
```

| 指令                          | 用途                                         |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | 前端開發伺服器（需搭配 `dev:api`）           |
| `npm run dev:api`             | 本機 Worker + D1 + R2                        |
| `npm run build`               | 型別檢查 + 打包前端                          |
| `npm run preview`             | 用 Worker 跑打包後的完整網站                 |
| `npm run deploy`              | 打包並部署到 Cloudflare                      |
| `npm run db:migrate`          | 對線上資料庫套用 migration                   |
| `npm run db:migrate:local`    | 對本機資料庫套用 migration                   |
| `npm run db:allow -- <email>` | 把 Email 加入允許名單（加 `--local` 為本機） |
| `npm run lint`                | ESLint                                       |
| `npm test`                    | Vitest 單元測試                              |
| `npm run data:template`       | 產生 `public/data/template.xlsx`             |
