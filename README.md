# 藏書庫存管理 Book Shelf Manager

用勾選條件與關鍵字，從 Excel 書單中快速找出你的庫存書籍。
整個網站是純前端的靜態網頁，可以免費部署在 GitHub Pages 上。

- 讀取 Excel（`.xlsx`）或 CSV，欄位對應自動判斷
- 勾選篩選：**出版社、年齡層、分類標籤、購入管道、書況**
- 關鍵字輸入：**書名、作者、繪者**
- 卡片檢視 / 表格檢視、排序、書籍詳細資料
- 點任一本書會跳出詳細視窗，顯示**書封圖片與線上書籍資料**，並附誠品／博客來／Amazon 搜尋連結
- 書封可事先查好隨網站一起部署（`npm run data:covers`），訪客瀏覽時不需要再呼叫任何 API
- 匯出目前篩選結果為 CSV（可直接用 Excel 開啟）
- 支援手機、平板、電腦，並自動跟隨系統的淺色／深色模式
- 資料只在瀏覽器中解析，不會上傳到任何伺服器

---

## 目錄

1. [快速開始](#快速開始)
2. [Excel 欄位規格](#excel-欄位規格)
3. [網頁操作說明](#網頁操作說明)
   - [書籍詳細視窗與線上資料](#書籍詳細視窗與線上資料)
4. [更新書單的三種方式](#更新書單的三種方式)
5. [GitHub 部署詳細步驟](#github-部署詳細步驟)
6. [自訂網域](#自訂網域)
7. [隱私與資料公開範圍](#隱私與資料公開範圍)
8. [疑難排解](#疑難排解)
9. [專案結構](#專案結構)
10. [開發指令](#開發指令)

---

## 快速開始

需求：[Node.js](https://nodejs.org/) 22 以上、Git、GitHub 帳號。

```bash
git clone https://github.com/<你的帳號>/book-shelf-manager.git
cd book-shelf-manager
npm ci
npm run dev
```

瀏覽器開啟 `http://localhost:5173`，就會看到示範書單。
把自己的 Excel 覆蓋到 `public/data/books.xlsx`，重新整理即可看到自己的藏書。

想要一份空白範本：

```bash
npm run data:template   # 產生 public/data/template.xlsx
```

網頁右上角的「Excel 範本」按鈕也可以直接下載這份範本。

---

## Excel 欄位規格

程式會讀取檔案中的**第一個工作表**，並自動尋找標題列（前 10 列中，最先符合兩個以上已知欄位名稱的那一列），
所以標題列上方有標題文字或空白列都沒關係。

### 欄位對應表

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
| ISBN（選填）     | `ISBN`、`ISBN13`、`條碼`                       | 有填的話線上查詢會完全命中，建議填          |
| 封面連結（選填） | `封面連結`、`封面`、`書封`、`圖片`、`cover`    | 填了就用這張圖，不再使用線上查到的封面      |

其他自訂欄位（例如 `備註`、`借給誰`）不會被丟掉，會出現在書籍詳細資料視窗中。

### 填寫細節

- **欄位名稱可以加括號說明**：`狀態(收藏/待售/待共讀)` 會被視為 `狀態`。
- **多個標籤**用 `、`、`,`、`/`、`;` 分隔皆可，例如 `療癒、美感、夢想`。
- **價格**可以填數字或 `NT$1,200 元` 這類文字，程式只取其中的數字；空白代表未填。
- **年齡**維持你原本的寫法即可（`0-4 歲`、`4-10 歲`），程式會依開頭數字排序。
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
| 檢視切換     | 右上角可切換卡片／表格；點任一本書可看完整簡介與所有欄位                   |
| 匯出結果     | 「匯出結果」會把目前畫面上的書匯出成 CSV（含 BOM，Excel 開啟不會亂碼）     |
| 分享網址     | 篩選條件會寫進網址列，複製網址就能分享或加入書籤                           |
| 手機         | 上方「篩選」按鈕會叫出篩選抽屜                                             |

也可以直接把 Excel 檔**拖曳**到網頁上載入。

### 書籍詳細視窗與線上資料

點卡片或表格中的任一本書，會跳出詳細視窗，除了 Excel 裡的所有欄位之外，還會顯示：

- **書封圖片**：優先使用 Excel 的「封面連結」欄；沒有的話自動從 Google Books 取得。
- **線上書籍資料**：出版社、出版日期、頁數、ISBN、書籍介紹，以及「在 Google Books 查看」連結。
- **書店搜尋連結**：誠品線上、博客來、Amazon，用 ISBN（沒有則用書名＋作者）直接帶到搜尋結果頁。

查詢方式與注意事項：

- 查詢順序是 `ISBN` →「書名＋作者」→「書名」，並會比對書名／作者，避免抓到不相干的書；比對不過就顯示「找不到這本書」，不會亂配。
- 查詢結果會在瀏覽器快取 7 天，重複點同一本書不會重新查詢。
- 查不到或查詢失敗時，Excel 裡的資料照常顯示，只是少了封面與線上欄位；可以用書店連結自己搜尋。
- 繁體中文繪本在 Google Books 的收錄並不完整，**在 Excel 填上 ISBN 命中率會明顯提高**；真的查不到時，可以自己在「封面連結」欄貼一張圖片網址。

### 讓封面穩定顯示（重要）

Google Books 在沒有金鑰時是**依 IP 位址計算配額**的。用手機行動網路瀏覽時，整家電信商的用戶
共用少數幾個對外 IP，很容易一開啟就看到「查詢額度已用完」。加上繁體中文繪本的收錄本來就不完整，
所以建議依序做以下幾件事，效果由大到小：

**1. 事先把書封查好（最有效，建議一定要做）**

在自己的電腦上執行一次，結果會存成 `public/data/book-info.json` 並跟著網站一起部署：

```bash
npm run data:covers              # 只查還沒有資料的書
npm run data:covers -- --force   # 全部重新查一次
```

之後訪客開啟書籍時**完全不會呼叫 API**，手機、行動網路、國外連線都能穩定看到封面。
換了新的 `books.xlsx` 之後再執行一次即可（已查過的書會自動略過），然後把
`book-info.json` 一起 commit：

```bash
npm run data:covers
git add public/data/book-info.json
git commit -m "Update book covers"
git push
```

如果執行到一半就遇到配額限制，程式會停下來並保留已查到的部分，稍後或換個網路再跑一次就會接續。

**2. 在 Excel 補上 `ISBN` 欄**

有 ISBN 時查詢會直接命中，而且就算 Google Books 查不到，網站還會自動改用
[Open Library](https://openlibrary.org/) 的封面圖（不需金鑰、沒有配額限制）。

**3. 查不到的書，用 `封面連結` 欄自己指定**

`npm run data:covers` 執行完會列出查不到的書名，把封面圖片網址貼進 Excel 的「封面連結」欄即可，
這一欄的優先權最高。

**4. 申請 Google Books API 金鑰（選用）**

若你希望「載入本機 Excel」時的即時查詢也穩定，可以到 Google Cloud Console 啟用 Books API 並建立
API 金鑰，然後：

- 本機：建立 `.env.local`，內容為 `VITE_GOOGLE_BOOKS_KEY=你的金鑰`
- GitHub：到 **Settings → Secrets and variables → Actions** 新增 secret `GOOGLE_BOOKS_KEY`，
  部署工作流程會自動帶入
- 產生金鑰後請在 Google Cloud Console 加上 **HTTP 參照網址限制**（例如 `youyun8.github.io/*`），
  因為金鑰會被打包進公開的網頁檔案中

> **為什麼不是直接嵌入誠品或 Amazon 的頁面？**
> 這兩個網站都以 `X-Frame-Options` 禁止被其他網站用 iframe 嵌入，也不開放跨網域讀取資料，純靜態網站無法繞過（要繞過必須自架代理伺服器去抓取他人網站內容）。因此改用官方開放、允許跨網域查詢的 Google Books API 取得封面與書目，再以連結導向各書店。

---

## 更新書單的三種方式

1. **臨時查看（不需部署）**：點右上角「載入 Excel」或把檔案拖進網頁。資料只留在這次瀏覽中，重新整理就會回到網站內建的書單。
2. **更新網站書單（建議）**：把 `public/data/books.xlsx` 換成新的檔案，commit 後推上 GitHub，Actions 會自動重新部署。
3. **改用 CSV**：如果想讓 Git 記錄每次書單的差異，可以把書單存成 `books.csv`，用「載入 Excel」按鈕讀取（副檔名 `.csv` 也支援）。

---

## GitHub 部署詳細步驟

以下步驟會把網站部署到 `https://<你的帳號>.github.io/<專案名稱>/`，完全免費。

### 步驟 1：把專案放到你的 GitHub

**方式 A：這個專案已經在你的 GitHub 上**（最常見）— 直接跳到步驟 2。

**方式 B：從本機建立新的 repository**

```bash
cd book-shelf-manager
git init                     # 若尚未是 git 專案
git add .
git commit -m "Add book shelf manager"
git branch -M main
git remote add origin https://github.com/<你的帳號>/book-shelf-manager.git
git push -u origin main
```

> 部署工作流程監聽的是 `main` 分支。如果你的預設分支叫 `master`，
> 請把 `.github/workflows/deploy.yml` 中的 `branches: [main]` 改成 `[master]`。

### 步驟 2：放入自己的書單

```bash
# 用自己的 Excel 覆蓋示範資料
cp ~/Downloads/我的藏書.xlsx public/data/books.xlsx

git add public/data/books.xlsx
git commit -m "Update book list"
git push
```

檔名必須是 `books.xlsx`，位置必須是 `public/data/`。

### 步驟 3：開啟 GitHub Pages（只需做一次）

1. 打開瀏覽器，進入你的 repository 頁面。
2. 點上方的 **Settings**（設定）。
3. 左側選單找到 **Pages**。
4. 在 **Build and deployment → Source** 下拉選單中選 **GitHub Actions**。
   （**不要**選 "Deploy from a branch"。）
5. 這一頁不需要按儲存，選好即生效。

### 步驟 4：執行第一次部署

推送到 `main` 就會自動觸發。如果剛剛才開啟 Pages、想立刻重跑一次：

1. 回到 repository 頁面，點上方 **Actions**。
2. 左側選 **Deploy to GitHub Pages**。
3. 右側點 **Run workflow** → 選 `main` → **Run workflow**。

工作流程會依序執行：安裝套件 → `npm run lint` → `npm test` → `npm run build` → 上傳並部署。
兩個工作（`build`、`deploy`）都出現綠色勾勾就完成了，通常約 1～2 分鐘。

### 步驟 5：確認網站網址

- **Actions** 頁面點進該次執行，`deploy` 工作下方會顯示網址。
- 或回到 **Settings → Pages**，最上方會顯示
  `Your site is live at https://<你的帳號>.github.io/book-shelf-manager/`。

第一次部署後，網址可能需要 1～2 分鐘才會生效；若看到 404，稍等一下再重新整理。

### 步驟 6：日後更新

以後只要把新的 `books.xlsx` 推上去，網站就會自動更新：

```bash
cp ~/Downloads/我的藏書.xlsx public/data/books.xlsx
git add public/data/books.xlsx
git commit -m "Update book list"
git push
```

在 **Actions** 頁面可以看到部署進度。更新後若畫面沒變，請強制重新整理
（Windows：`Ctrl` + `F5`，Mac：`Cmd` + `Shift` + `R`）。

### 部署設定說明

`.github/workflows/deploy.yml` 已經處理好 GitHub Pages 的路徑問題：

| 情況                                    | 網站根目錄             | 自動採用的 base        |
| --------------------------------------- | ---------------------- | ---------------------- |
| 一般專案 repo（`book-shelf-manager`）   | `/book-shelf-manager/` | `/book-shelf-manager/` |
| 個人網站 repo（`<你的帳號>.github.io`） | `/`                    | `/`                    |
| 有自訂網域（存在 `public/CNAME`）       | `/`                    | `/`                    |

不需要手動修改設定；如果要在本機模擬子路徑，可以執行 `VITE_BASE=/book-shelf-manager/ npm run build`。

---

## 自訂網域

1. 在網域商把 `CNAME` 指向 `<你的帳號>.github.io`。
2. 在專案中建立 `public/CNAME`，內容只有一行你的網域，例如 `books.example.com`。
3. Commit、push，工作流程會自動改用根目錄路徑部署。
4. 到 **Settings → Pages → Custom domain** 填入同一個網域並勾選 **Enforce HTTPS**。

---

## 隱私與資料公開範圍

- 書單本身只在瀏覽器中解析，不會上傳到任何伺服器；但打開單本書的詳細視窗時，會把**書名（或 ISBN）**送到 Google Books API 查詢封面與書目資料。
- GitHub Pages 部署出來的網站是**公開**的，任何拿到網址的人都能看到 `public/data/books.xlsx` 的內容。
- 公開 repository 的原始檔案（包含書單）本來就可以被任何人下載。
- 若書單包含不想公開的資訊（例如購入價格），可以：
  - 把 repository 設為 **Private**（GitHub Pages 對私有 repo 需要付費方案），或
  - 不要把 `books.xlsx` 放進專案（在 `.gitignore` 中加入 `public/data/books.xlsx`），
    每次使用時用右上角「載入 Excel」讀取本機檔案。此時網站只是一個工具，資料留在你的電腦上。

---

## 疑難排解

| 狀況                                    | 原因與解法                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 網頁一片空白、主控台出現 404 找不到 js  | Pages 的 Source 沒有設成 **GitHub Actions**，或是用了 "Deploy from a branch"。回到步驟 3 重設。  |
| 網站顯示「無法載入書單」                | `public/data/books.xlsx` 不存在或檔名不符。確認檔名與路徑後重新 push。                           |
| 顯示「找不到標題列」                    | 第一個工作表的前 10 列沒有 `書名`、`作者` 之類的欄位名稱。請確認標題列存在且沒有被合併儲存格。   |
| 篩選欄少了某一組條件                    | 該欄位在 Excel 中全部是空白，或欄位名稱不在對應表中。改用對應表中的名稱即可。                    |
| 標籤沒有被拆開                          | 標籤之間請用 `、`、`,`、`/`、`;` 分隔，不要只用空白。                                            |
| Actions 失敗在 `npm run lint` 或 `test` | 點進失敗的步驟看訊息；在本機執行 `npm run lint`、`npm test` 可以重現。                           |
| Actions 失敗並顯示 Pages 相關權限錯誤   | 確認 **Settings → Actions → General → Workflow permissions** 允許工作流程執行，且步驟 3 已完成。 |
| 更新後網頁還是舊的                      | 瀏覽器快取。強制重新整理（`Ctrl`/`Cmd` + `Shift` + `R`）。                                       |
| 詳細視窗沒有封面、顯示找不到這本書      | Google Books 沒有收錄該書。在 Excel 填 `ISBN` 可大幅提高命中率，或用 `封面連結` 欄自訂圖片。     |
| 顯示「查詢次數過多，請稍後再試」        | 短時間查詢太多次觸發 Google Books 限制，稍等幾分鐘再按「重新查詢」即可。                         |

---

## 專案結構

```
.
├─ .github/workflows/
│  ├─ ci.yml               # Pull request 檢查：lint、格式、測試、build
│  └─ deploy.yml           # 推到 main 時自動部署到 GitHub Pages
├─ public/
│  ├─ data/books.xlsx      # 網站顯示的書單（換成自己的）
│  ├─ data/book-info.json  # 事先查好的封面與書目（npm run data:covers 產生）
│  ├─ data/template.xlsx   # 空白欄位範本
│  └─ favicon.svg
├─ scripts/
│  ├─ fetch-book-info.ts   # 事先查好書封與書目
│  ├─ make-template.mjs    # 產生範本與示範資料
│  └─ xlsx-writer.mjs      # 最小化的 .xlsx 產生器
├─ src/
│  ├─ components/          # 版面與 UI 元件
│  ├─ hooks/               # useBookInfo：詳細視窗的線上查詢
│  ├─ lib/
│  │  ├─ columns.ts        # Excel 欄位名稱對應
│  │  ├─ parse.ts          # 表格列轉換成書籍資料
│  │  ├─ read-spreadsheet.ts # 瀏覽器端讀取 xlsx / csv
│  │  ├─ filter.ts         # 篩選與排序邏輯
│  │  ├─ facets.ts         # 勾選選項與數量統計
│  │  ├─ book-info.ts      # Google Books 查詢、封面挑選與書店連結
│  │  ├─ url-state.ts      # 篩選條件與網址同步
│  │  └─ export-csv.ts     # 匯出結果
│  ├─ App.tsx
│  ├─ index.css            # 設計樣式與色彩變數
│  └─ types.ts
└─ vite.config.ts
```

## 開發指令

| 指令                    | 用途                                        |
| ----------------------- | ------------------------------------------- |
| `npm run dev`           | 本機開發伺服器                              |
| `npm run build`         | 型別檢查 + 產生 `dist/`                     |
| `npm run preview`       | 預覽 `dist/` 的產出                         |
| `npm run lint`          | ESLint                                      |
| `npm test`              | Vitest 單元測試（欄位對應、篩選、網址狀態） |
| `npm run format`        | Prettier 格式化                             |
| `npm run data:template` | 產生 `public/data/template.xlsx`            |
| `npm run data:sample`   | 重新產生示範用的 `public/data/books.xlsx`   |

技術：Vite 8、React 19、TypeScript、Tailwind CSS v4、read-excel-file、Vitest。
