# 藏書庫存管理 Book Shelf Manager

多人共用的藏書庫存網站：登入後大家看到、編輯的都是**同一份書單**，
可以用勾選條件與關鍵字快速找出庫存書籍。未登入者看不到任何書籍資料。

- 帳號登入（Email + 密碼），只有**允許名單**中的 Email 才能註冊
- 忘記密碼可自助重設：寄出一次性連結，重設後所有裝置自動登出
- 書單存在雲端，任何裝置登入後看到的都是同一份最新資料
- 兩種更新方式：**上傳 Excel／CSV 取代整份書單**，或在網頁上**逐本新增／編輯／刪除**
- 勾選篩選：出版社、年齡層、分類標籤、購入管道、書況
- 關鍵字輸入：書名、作者、繪者
- 卡片／表格檢視、排序、每頁筆數，匯出目前結果為 Excel
- 顯示設定可自行選擇主題、色調、字級與版面寬度
- 支援手機、平板、電腦，預設跟隨系統的淺色／深色模式

## 架構

```
瀏覽器 ──────► Cloudflare Worker（同一個網域）
                 ├─ 靜態網頁（React 單頁應用程式）
                 ├─ /api/auth/*   註冊、登入、登出、忘記密碼、目前身分
                 └─ /api/books/*  共用書單的讀取、編輯與匯入（需登入）
                        ├─ D1（SQLite）  帳號、工作階段、書籍資料、匯入紀錄
                        └─ Workers KV（選用）  每次匯入的原始試算表封存
```

未登入時，`/api/books` 一律回 401，網頁只會顯示登入畫面，
瀏覽器拿不到任何書籍資料。

Excel／CSV 是**匯入格式**，不是裝置間同步的檔案。上傳時，瀏覽器會解析試算表並把書籍資料寫入 D1；
之後手機、平板和電腦都從同一個 D1 資料庫取得最新書單。若設定 `UPLOADS` KV binding，Worker
也會封存每次上傳的原始檔案；未設定時匯入與跨裝置同步仍可正常運作。

| 項目   | 技術                                        |
| ------ | ------------------------------------------- |
| 前端   | React 19、TypeScript、Tailwind CSS v4、Vite |
| 後端   | Cloudflare Workers、Hono                    |
| 資料庫 | Cloudflare D1（SQLite）                     |
| 登入   | Email + 密碼，PBKDF2 雜湊、HttpOnly Cookie  |
| 測試   | Vitest                                      |

---

## 目錄

1. [部署到 Cloudflare（詳細步驟）](#部署到-cloudflare詳細步驟)
2. [帳號管理](#帳號管理)
3. [本機開發](#本機開發)
4. [Excel 欄位規格](#excel-欄位規格)
5. [網頁操作說明](#網頁操作說明)
6. [備份與還原](#備份與還原)
7. [安全性說明](#安全性說明)
8. [疑難排解](#疑難排解)
9. [專案結構與指令](#專案結構與指令)

---

## 部署到 Cloudflare（詳細步驟）

需求：[Node.js](https://nodejs.org/) 20.19 以上（建議使用 22 LTS）、Git、一個 Cloudflare 帳號（免費方案即可）。

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

### 步驟 3：建立 Cloudflare 儲存資源

```bash
npx wrangler d1 create book-shelf-manager
npx wrangler kv namespace create UPLOADS
```

第一個指令建立共用資料庫，第二個建立封存原始上傳檔案的 KV namespace；請記下兩者印出的 ID。
KV 是選用功能：若不想封存原始檔案，可不執行第二個指令，並從 `wrangler.jsonc` 移除整個
`kv_namespaces` 區塊。

### 步驟 4：填入資源 ID

打開 `wrangler.jsonc`，把 `d1_databases` 的 `database_id` 換成自己的 D1 ID：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "book-shelf-manager",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
]
```

`binding` 必須維持為 `DB`，Worker 才能找到資料庫。

若要封存上傳檔案，也把 `kv_namespaces` 的 `id` 換成自己的 KV ID；`binding` 必須維持為
`UPLOADS`。不要沿用 repository 內的 D1 或 KV ID，因為它們屬於另一個 Cloudflare 帳號。

### 步驟 5：建立資料表

```bash
npm run db:migrate
```

這會把 `migrations/` 內尚未執行的 migration 套用到線上 D1。第一次執行時若 Wrangler
詢問是否要繼續，確認顯示的資料庫名稱正確後回答 `y`。

### 步驟 6：部署

```bash
npm run deploy
```

完成後會印出網址，形如 `https://book-shelf-manager.<你的帳號>.workers.dev`。
打開網址若看到登入畫面，就代表 Worker、靜態網頁與 D1 binding 都已部署成功。

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
3. 登入後點右上角「上傳 Excel」，選擇 `.xlsx`、`.xlsm` 或 `.csv` 書單檔案。
4. 確認提示後，書籍會寫入 D1；其他裝置重新載入或登入後就會看到同一份最新書單。
5. 用另一台裝置登入並新增或編輯一本書，確認第一台裝置重新整理後能看到變更。

> 上傳 Excel 會取代 D1 中的整份共用書單。第一次正式匯入前，建議保留原始 Excel；
> 日後覆蓋前則先用網頁的「匯出」下載 CSV，或依照[備份與還原](#備份與還原)匯出 D1。

### 步驟 9（選用）：設定忘記密碼的寄信服務

不設定也能用，只是「忘記密碼」寄不出信（重設連結會寫進 Worker 記錄檔，
可用 `npx wrangler tail` 查看後手動傳給對方）。要讓它自動寄信：

1. 到 [Resend](https://resend.com/) 註冊（免費方案每天 100 封）。
2. **Domains** 新增並驗證你的網域；若只是先試用可以跳過這步，
   但寄件人必須維持 `onboarding@resend.dev`，而且只能寄到你註冊 Resend 的那個信箱。
3. **API Keys** 建立一把金鑰，存成 Worker 密鑰：

   ```bash
   npx wrangler secret put RESEND_API_KEY
   # 貼上金鑰後按 Enter
   ```

4. 驗證好網域的話，把 `wrangler.jsonc` 的 `MAIL_FROM` 改成自己的寄件地址：

   ```jsonc
   "vars": { "MAIL_FROM": "藏書庫存管理 <books@你的網域>" }
   ```

5. 重新部署 `npm run deploy`，然後在登入畫面點「忘記密碼？」測試一次。

### 步驟 10（選用）：設定 GitHub 自動部署

設定後，只要推到 `main` 就會自動測試、套用資料庫更新並重新部署。

1. 到 Cloudflare 後台 → **My Profile → API Tokens → Create Token**，
   選 **Edit Cloudflare Workers** 範本，建立後複製權杖。
2. 在 Cloudflare 後台首頁右側複製 **Account ID**。
3. 回到 GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**，
   新增兩個：
   - `CLOUDFLARE_API_TOKEN`：步驟 1 的權杖
   - `CLOUDFLARE_ACCOUNT_ID`：步驟 2 的 Account ID
4. 之後推送到 `main` 即會自動部署（`.github/workflows/deploy.yml`）。

### 步驟 11（選用）：自訂網域

在 Cloudflare 後台 **Workers & Pages → book-shelf-manager → Settings → Domains & Routes**
新增自己的網域即可，不需要改程式。

---

## 帳號管理

| 需求               | 做法                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 允許新的人註冊     | `npm run db:allow -- someone@example.com`                                                                                                                                                                                                      |
| 查看允許名單       | `npx wrangler d1 execute book-shelf-manager --remote --command "SELECT email FROM allowed_emails"`                                                                                                                                             |
| 移除某人的註冊資格 | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM allowed_emails WHERE email='someone@x.com'"`                                                                                                                       |
| 停用已註冊的帳號   | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM users WHERE email='someone@x.com'"`（連同工作階段一起消失）                                                                                                        |
| 忘記密碼           | 在登入畫面點「忘記密碼？」輸入 Email，系統會寄出一次性重設連結（60 分鐘內有效、只能用一次，重設後該帳號的所有裝置都會登出）。沒設定寄信服務時連結會寫進 Worker 記錄檔（`npx wrangler tail`）；真的不行也可以用上一列指令刪除帳號讓對方重新註冊 |
| 強制所有人重新登入 | `npx wrangler d1 execute book-shelf-manager --remote --command "DELETE FROM sessions"`                                                                                                                                                         |

登入狀態會保留 30 天，之後需要重新登入。

---

## 本機開發

需要兩個終端機視窗：

```bash
npm run db:migrate:local   # 只需第一次
npm run db:allow -- 你的信箱@example.com --local

# 終端機 1：API（Worker + D1 的本機模擬）
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

支援 `.xlsx`、`.xlsm` 與 `.csv`；Excel 檔會讀取**第一個工作表**。系統會自動尋找標題列
（前 10 列中最先符合兩個以上欄位名稱的那一列），一次最多匯入 5,000 本書。

| 網頁上的用途 | Excel 欄位名稱（任一種寫法都可以）             | 說明                                        |
| ------------ | ---------------------------------------------- | ------------------------------------------- |
| 書名         | `書名`、`書籍名稱`、`名稱`、`Title`            | 建議必填，空白列會被略過                    |
| 作者         | `作者`、`文`、`Author`                         | 可用關鍵字搜尋                              |
| 繪者         | `繪者`、`插畫`、`繪圖`、`Illustrator`          | 可用關鍵字搜尋                              |
| 譯者         | `譯者`、`翻譯`                                 | 顯示於卡片與詳細資料                        |
| 出版社       | `出版社`、`出版商`、`Publisher`                | 勾選篩選                                    |
| 書籍內容摘要 | `內容簡介`、`書籍內容摘要`、`內容摘要`、`簡介` | 卡片顯示三行，詳細資料顯示全文              |
| 適讀年齡     | `適讀年齡`、`年齡層`、`建議年齡`               | 勾選篩選，會依數字大小排序（0-4 早於 4-10） |
| 分類標籤     | `分類標籤`、`建議標籤`、`標籤`、`分類`         | 勾選篩選，可填多個標籤                      |
| 購入管道     | `購入管道`、`購買管道`、`來源`                 | 勾選篩選                                    |
| 購入價格     | `購入價格`、`價格`、`售價`、`定價`             | 可排序                                      |
| 書況         | `書況`、`狀態`、`書籍狀態`                     | 勾選篩選，例如 收藏／待售／待共讀           |
| 藏書位置     | `藏書位置`、`存放位置`、`書櫃位置`、`位置`     | 顯示於卡片與表格                            |
| ISBN（選填） | `ISBN`、`ISBN13`、`條碼`                       | 顯示於詳細資料，匯出時一併帶出              |

其他自訂欄位（例如 `備註`、`借給誰`）不會被丟掉，會出現在書籍詳細視窗中。
舊檔案裡的 `封面連結`、`圖片` 之類的欄位會被略過：網頁不再顯示書籍圖片。

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
| 匯出         | 「匯出」把目前篩選結果存成 `book_library.xlsx`（包含 ISBN 與自訂欄位）     |
| 每頁顯示     | 結果列右邊的「每頁」可選 25／50／75／100 或全部，下方會出現分頁按鈕        |
| 顯示設定     | 右上角「顯示設定」可調整主題（跟隨系統／淺色／深色）、色調、字級與版面寬度 |
| 分享網址     | 篩選條件、排序與每頁筆數會寫進網址列，複製給同樣有帳號的人即可看到同一頁   |
| 手機         | 上方「篩選」按鈕會叫出篩選抽屜                                             |

> 上傳試算表會取代整份共用書單，動作前會跳出確認視窗。若有設定 `UPLOADS` KV，原始檔案
> 會另外封存；這不是書單還原介面，因此重要異動前仍建議先匯出 XLSX 或備份 D1。

---

## 備份與還原

D1 是共用書單的唯一資料來源；KV 只封存匯入時的原始檔案，不參與同步。建議使用以下其中一種備份方式：

| 方式          | 適合情況                                | 做法                                                                                              |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 網頁匯出 XLSX | 想保留目前看到的書單，並能用 Excel 開啟 | 清除不需要的篩選條件後按「匯出」，把下載的 `.xlsx` 存到 Google Drive、OneDrive 或其他個人雲端硬碟 |
| 匯出完整 D1   | 要備份書籍、帳號、允許名單及其他資料表  | 在專案目錄執行下面的 `wrangler d1 export` 指令                                                    |

匯出完整線上資料庫：

```bash
mkdir -p backups
npx wrangler d1 export book-shelf-manager --remote --output "backups/book-shelf-manager.sql"
```

`backups/book-shelf-manager.sql` 可能包含 Email、密碼雜湊及有效工作階段的雜湊值，
不要放進公開 repository。建議保存到只有管理者能存取的位置。

需要還原時，請先確認目前選用的是正確的 Cloudflare 帳號與 D1 資料庫，再執行：

```bash
npx wrangler d1 execute book-shelf-manager --remote --file "backups/book-shelf-manager.sql"
```

還原會改動線上資料；若線上資料庫仍可使用，還原前先再匯出一份當下狀態。一般使用者若只需要
恢復書單，也可以直接把先前匯出的 XLSX 重新上傳，不必還原帳號與工作階段。

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
- 同一個 Email 連續登入失敗 8 次，會被暫停 15 分鐘；忘記密碼的申請套用同樣的次數限制。
- 重設密碼的連結 60 分鐘後失效、只能使用一次，申請新的連結會讓舊的立刻作廢；資料庫同樣只存連結的雜湊值。重設成功後該帳號的所有登入狀態都會被清除。
- 「忘記密碼」不論該 Email 有沒有帳號都回覆同一句話，避免被用來探測誰有帳號。
- 寫入類請求會檢查 `Origin`，阻擋跨站送出的表單。
- 允許名單與帳號互相獨立：把 Email 從允許名單移除**不會**自動停用已註冊的帳號，
  需要停用時請一併刪除 `users` 中的該筆資料（見上方帳號管理）。

---

## 疑難排解

| 狀況                                 | 原因與解法                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 註冊時顯示「不在允許名單中」         | 執行 `npm run db:allow -- 該信箱`，注意大小寫不影響、前後不要有空白。                                                                                                      |
| 部署時說找不到 D1 資料庫             | `wrangler.jsonc` 的 `database_id` 還沒填，或填錯。重新執行 `npx wrangler d1 create book-shelf-manager` 取得。                                                              |
| 網頁打得開但一直轉圈、主控台出現 500 | 資料表還沒建立。執行 `npm run db:migrate`。                                                                                                                                |
| 登入出現 `Error 1102`（CPU 超時）    | Workers 免費方案的限制。把 `worker/auth.ts` 的 `PBKDF2_ITERATIONS` 調低，或升級付費方案。                                                                                  |
| 上傳 Excel 顯示「找不到標題列」      | 第一個工作表的前 10 列沒有 `書名`、`作者` 之類的欄位名稱，或標題列被合併儲存格。                                                                                           |
| 篩選欄少了某一組條件                 | 該欄位在 Excel 中全部是空白，或欄位名稱不在對應表中。                                                                                                                      |
| 忘記密碼沒收到信                     | 還沒設定 `RESEND_API_KEY`（連結會寫進 `npx wrangler tail` 的記錄），或 Resend 網域尚未驗證。未驗證時寄件人只能是 `onboarding@resend.dev`，且只能寄給你註冊 Resend 的信箱。 |
| 重設連結顯示「已經失效」             | 連結超過 60 分鐘、已經用過，或後來又申請了新的連結（舊的會立刻作廢）。重新申請一次即可。                                                                                   |
| 想找之前上傳的原始檔案               | 有設定 `UPLOADS` 時，可在 Cloudflare KV 中依 `imports.archive_key` 找到封存檔；未設定時請查看上傳裝置或個人雲端硬碟。要恢復書單可重新上傳檔案或還原 D1 備份。              |
| GitHub Actions 部署失敗              | 確認 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID` 兩個 secret 都有設定，且權杖有 Workers 編輯權限。                                                                   |

---

## 專案結構與指令

```
.
├─ .github/workflows/
│  ├─ ci.yml               # Pull request 檢查
│  └─ deploy.yml           # 推到 main 時部署到 Cloudflare
├─ migrations/
│  ├─ 0001_init.sql        # D1 資料表
│  ├─ 0002_password_resets.sql
│  ├─ 0003_kv_archive_key.sql # 匯入紀錄改用 KV 封存鍵
│  └─ 0004_drop_cover_url.sql # 移除不再使用的封面欄位
├─ worker/                 # Cloudflare Worker（API）
│  ├─ index.ts             # 路由與權限
│  ├─ auth.ts              # 密碼雜湊、工作階段、允許名單、登入限制、重設連結
│  ├─ mail.ts              # 透過 Resend 寄出重設信件
│  └─ books.ts             # 書籍資料的讀寫與欄位淨化
├─ scripts/
│  └─ allow-email.mjs      # 加入允許名單
├─ src/                    # 前端
│  ├─ components/          # 版面與 UI 元件（含登入畫面、書籍編輯）
│  ├─ hooks/               # useSession、useDisplaySettings
│  ├─ lib/
│  │  ├─ api.ts            # 呼叫 Worker API
│  │  ├─ columns.ts        # Excel 欄位名稱對應
│  │  ├─ parse.ts          # 表格列轉換成書籍資料
│  │  ├─ read-spreadsheet.ts # 瀏覽器端讀取 xlsx / csv
│  │  ├─ filter.ts         # 篩選與排序
│  │  ├─ facets.ts         # 勾選選項與數量統計
│  │  ├─ badge.ts          # 書況色塊與價格格式
│  │  ├─ display-settings.ts # 主題、色調、字級、版面寬度
│  │  ├─ pagination.ts     # 每頁筆數與分頁按鈕
│  │  ├─ url-state.ts      # 篩選條件與網址列同步
│  │  ├─ xlsx.ts           # 建立單一工作表的 XLSX
│  │  └─ export-xlsx.ts    # 匯出目前結果與自訂欄位
│  ├─ types.ts             # 書籍與篩選條件的型別
│  └─ App.tsx              # 登入與書單的切換
└─ wrangler.jsonc          # Worker、靜態資源、D1、KV 與環境變數設定
```

| 指令                          | 用途                                         |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | 前端開發伺服器（需搭配 `dev:api`）           |
| `npm run dev:api`             | 本機 Worker + D1                             |
| `npm run build`               | 型別檢查 + 打包前端                          |
| `npm run preview`             | 用 Worker 跑打包後的完整網站                 |
| `npm run deploy`              | 打包並部署到 Cloudflare                      |
| `npm run db:migrate`          | 對線上資料庫套用 migration                   |
| `npm run db:migrate:local`    | 對本機資料庫套用 migration                   |
| `npm run db:allow -- <email>` | 把 Email 加入允許名單（加 `--local` 為本機） |
| `npm run lint`                | ESLint                                       |
| `npm test`                    | Vitest 單元測試                              |
