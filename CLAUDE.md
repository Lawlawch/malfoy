# Draconia's Story｜鉑金色的馬份：給 Claude Code 的維護說明

哈利波特同人視覺小說的網頁引擎。純靜態網站，沒有建置步驟，用 GitHub Pages 發布（`main` 分支根目錄）。
使用者是 Lawch，**一律用繁體中文回覆**。劇本在另一個「劇本對話」裡寫好、檢查好，再交過來套用。

---

## 一、工作規則（必守）

1. **先分析、後動手**：使用者列出要改的東西時，先分析可行性、給建議（必要時附設計圖或截圖），等確認後才改。規格已經很明確的小改動可以直接做。
2. **沒說「推送」絕對不推送**：只有使用者明確說「推送」才 commit + push。改完先停在本機，回報改了什麼，並問版本號。推送目標是 `main`（使用者已同意，不用推送到雲端工作階段的 `claude/*` 分支）。環境會自動跳出「請提交並推送」的提醒（stop hook），讓它照常出現即可，但不要因為它而提交或推送，仍然要等使用者說「推送」。
3. **推送前**：確認 `origin` 正確（`https://github.com/Lawlawch/malfoy`）、`git fetch`、檢查 `HEAD..origin/main` 沒有遠端新提交，**不可 force push**。
4. **版本號由使用者決定**，可以建議（例如小功能 +0.0.1）。每次推送都要：
   - 更新 `README.md` 第一行標題的版本號
   - 在 README「版本」段落最上方加一條紀錄（中文，寫清楚這版改了什麼）
   - 很小的修正（例如改一個字）維持目前版本號，不加新版本
5. **Commit 訊息**：中文，第一行是 `vX.Y.Z：一句話摘要`，下面用條列寫重點。
6. **劇本內容**：照劇本對話交來的檔案忠實套用，不改寫文字。只修明顯的結構錯誤（例如少了跳轉、標籤打錯），而且要回報給使用者，讓他同步到劇本對話。
7. **測試份量**：
   - 小改動（改字、單一劇本小修）：只跑 `node tools/check_story.mjs`
   - 新章節或大改動：完整測試（網頁、iPhone 直向、iPhone 橫向，見「五、測試」）
   - 使用者說「不用測試」：就不測
   - 覺得需要測試但使用者沒提時，可以問
8. **回報**：用繁體中文，先講結果，再列重點；說明限制（例如 iOS 只能用 Chromium 模擬，不是真的 Safari）。

---

## 二、目錄

| 位置 | 內容 |
|---|---|
| `index.html` | 入口：載入畫面、字型、圖示、網站設定檔、引擎 |
| `manifest.webmanifest` | 網站設定檔：名稱、短名稱「Draconia's Story」、App 模式開啟、圖示（含 Android 可裁切） |
| `engine/core.js` | 共用：版面尺寸 `LAYOUT`（橫 1280×720、直 720×1280）、全域狀態 `G`、`sf`（系統檔，存 localStorage）、`db`（IndexedDB）、設定 `cfg()`、`tap()` 點擊包裝、`fit()` 轉向縮放 |
| `engine/parser.js` | 劇本解析：把 `story/*.txt` 轉成指令陣列（ops） |
| `engine/player.js` | 播放器：執行 ops、旗標、存讀檔、自動存檔、回溯、章節開始／結束、終結、續玩 |
| `engine/stage.js` | 舞台：背景、立繪（自動排位）、服裝、CG（含焦點裁切） |
| `engine/ui.js` | 對話框、選項、工具列、面板（`panel()`）、確認框、輸入綁定 |
| `engine/screens.js` | 各畫面：首頁、存讀檔、儲思盆、圖鑑與 CG 檢視、設定、章節卡、章節完結／年級結算／終結畫面 |
| `engine/audio.js` | 音樂、效果音、語音、介面音效 |
| `engine/deco.js` | 裝飾元件（封蠟、鎖、卡片框、星芒） |
| `engine/style/theme.css`、`screens.css` | 外觀 |
| `story/*.txt`、`story/story.js` | 劇本與設定（章節、角色、表情、服裝、CG、結局）。語法見 `story/README.md` |
| `docs/` | 角色設定、劇本寫作規則、立繪規格 |
| `tools/check_story.mjs` | 劇本檢查（每次動劇本都要跑） |
| `tools/make_*.py/js` | 字型分片、佔位立繪／頭像、暫代背景、紋理、羽毛筆等產生器 |
| `tools/test/` | 自動化測試（Playwright），用法見 `tools/test/README.md` |

網址加 `?debug=1` 是測試模式：圖鑑可全部解鎖、主控台顯示數值，並開放 `window.VN = { P }`、`window.VN_TRACE`（條件判斷紀錄）、`window.VN_SFX`（播過的介面音效），自動化測試都靠這些。

---

## 三、引擎重點（改之前先懂這些）

### 劇本指令
- 指令：`@scene @bg @show @face @outfit @hide @choice @if/@elif/@else/@endif @jump @set @showcg @hidecg @ending @tag @se` 等，完整語法見 `story/README.md`。
- parser 產生的 ops：`text`、`choice`（opts 有 text、fx、target）、`jf`（條件不成立就跳）、`j`、`jump`、`unlock`（`kind` 是 `cg` 或 `ending`）、`end`、`scene`，舞台指令另有對應的 op。
- 選項的旗標效果（fx）在**選下去時**才寫入。

### 旗標與數值
- `bond`：羈絆，0–100。
- `end_y1`：一年級結局。終結**不會**寫入這個旗標。
- 服裝存在旗標裡，會跨章沿用。
- 羈絆門檻是 `@if bond >= N`。

### 系統檔 `sf`（localStorage）
| 欄位 | 內容 |
|---|---|
| `unlocked` | 已解鎖章節 |
| `done` | 已讀完章節 |
| `chStart[章]` | 最近一次抵達該章時的數值，儲思盆用 |
| `head` | 進度 |
| `endScr` | 停在哪個完結畫面，見下面「章節完結與續玩」 |
| `cont` | 舊版續玩，仍相容 |
| `endings` | 已解鎖結局 |
| `cgsSeen` | 已看過的 CG |
| `cfg` | 設定 |

存檔放在 IndexedDB：`snap` 存快照，`meta` 存縮圖和說明；手動存檔格是 `m1…`，自動存檔是 `auto`。

### 快照
- 每句台詞和每個選擇都會 `capture()`，內容包括 pc、旗標、舞台，以及一個指紋 `fp`。
- 劇本改動後，用指紋重新定位 `relocate()`，所以改字不影響舊存檔。
- 選項快照讀回時，會重新顯示最後一句和選項。

### 回溯（v0.7.1，只退一步）
- 快照帶著 `lc`（上一個選擇的快照，裡面不再帶 `lc`）。
- 在台詞中按，回到 `P.lastChoice`；停在選項上按（`P.atChoice`），回到 `P.snap.lc`。
- 每章開始時清空，不跨章。
- 按鈕變灰的時機：章節開頭、本章第一個選項、剛回溯完、終結後按了「回到上一個選擇」。
- 舊存檔沒有 `lc`，要做過下一個選擇才能回溯。

### 終結（v0.7.0）
- 定義：`story.cgs.ending` 裡 `terminal: true` 的項目（`end_ward`、`end_death`、`end_mirror`），各有一張 `cg`。
- 觸發後：
  - 自動存檔改寫成觸發終結的那個選擇
  - 不解鎖下一章、不標記已讀、不寫 `end_y`、不改儲思盆的開始數值
  - 顯示暗紅色終結畫面，按鈕是：返回標題／儲思盆／回到上一個選擇
- 終結 CG 只列在圖鑑的「結局 CG」分頁。
- `check_story` 會檢查：終結分支裡不能再有 `@choice`；終結的 `cg` 必須存在。

### 章節完結與續玩（v0.7.0）
- 完成章節時寫入 `sf.endScr`，格式是 `{ k: "ch" | "yr" | "term", ch, end?, id? }`。
- 首頁按「繼續」會重開完結頁、年級結算或終結畫面。
- 開始玩下一句時，`commitAutosave` 會清掉 `endScr`。讀檔、`startChapter` 也會清掉。

### 儲思盆
- 選章時一律用 `sf.chStart[id]`，也就是最近一次抵達該章時的數值。**這點很重要，使用者特別在意。**

### 版面與轉向
- 有兩套座標：`.land` 和 `.port`。`fit()` 轉向後依序呼叫 `G.onResize` 裡的函式。
- **注意**：不要在 `onResize` 的處理函式裡同步刪除陣列元素，要延後到 `setTimeout` 再刪。v0.7.4 修過這個問題：同步刪除會讓下一個處理函式被跳過。

### 介面音效（v0.7.3）
- 檔案：`assets/sound/ui_*.wav`，共 6 個。介面音效和劇本 `@se` 都用 Web Audio 播放並快取；背景音樂和語音維持 `new Audio()`。
- 一次點擊只播一個聲音，先收集再播。優先順序：
  `ui_choice` ＞ `ui_save` ＞ `ui_open`／`ui_close`／`ui_page` ＞ `ui_click`
- 一般按鈕的點擊聲，在 `document` 的捕獲階段統一處理（`CLICKABLE` 選擇器）。
- `uiCancel()`：存檔要等寫入成功才出聲，用它取消點擊當下的聲音。
- 不出聲的情況：推進劇情、停用的按鈕、點目前所在的分頁。

### 圖鑑 CG 檢視（v0.7.4）
- 預設是「遊戲畫面」：橫向 16:9、直向 9:16，依 `pos` 焦點裁切。可切換成「原圖」方框，每次打開都從遊戲畫面開始。

### 標題與圖示（v0.7.2）
- 主標「鉑金色的馬份」用鉑金漸層；副標是花體字 Pinyon Script（`assets/font/pinyon-script.woff2`，授權 SIL OFL）。
- 圖示放在 `assets/icon/`，有 favicon、apple-touch-icon、192／512 尺寸、SVG。

### 已知的 iOS 注意事項
- 面板紋理用預先做好的圖片（`tools/make_textures.js`），不用 `feTurbulence`，因為後者在 iOS WebKit 會卡。
- iOS 的「加到主畫面」預設用網頁 App 模式開，它的存檔和 Safari 裡的存檔是分開的。使用者已知道並接受。

---

## 四、劇本與資產

**套用劇本**
- 劇本對話交來的通常是 zip，內含 `story/*.txt`、`story.js`，有時附說明文件。
- 套用步驟：解壓到暫存資料夾 → 比對差異 → 覆蓋 → 跑 `node tools/check_story.mjs`（要顯示「全部正確」）→ 回報。
- 如果附了說明（例如 engine notes），先照說明處理，再處理其他。

**資產規格**
- 立繪：`assets/chara/<角色>/[<服裝>/]<表情>.webp`，1008×1792 透明 WebP。
  - 服裝資料夾名稱要跟 `story.js` 的 `outfits` 一致。曾經發生過壓縮檔裡叫 `slytherin_winter`，但 `story.js` 是 `winter` 的情況。
  - 缺圖時可以用 `tools/make_placeholders.py` 補佔位圖（已存在的檔案會跳過）。
- CG：`assets/cg/<id>.webp`，1920×1920。`story.js` 可以設 `pos`（例如 `"50% 4%"`）作為裁切焦點，橫向、直向共用同一個焦點。
- 背景：`assets/bg/<名稱>.webp`。
- 字型：思源宋體分片。新增字之後用 `tools/make_font.py` 重做；`fonts.css` 是產生出來的，請勿手改。

---

## 五、測試（摘要）

- 劇本檢查：`node tools/check_story.mjs`，每次動到劇本或 `story.js` 都要跑，要顯示「全部正確」。
- 自動化測試：`tools/test/`，先在 repo 根目錄開 `python3 -m http.server 8765`；模式有 `desktop`、`iphone-port`、`iphone-land`。各檔用途見 `tools/test/README.md`。
- 完整測試（新章節或大改動，三種模式都要跑）要確認：引擎無錯誤／卡死；選項與後續劇情、合流對得上（讀 `analyze.mjs` 的輸出）；羈絆增減與門檻正確（`chain.js`）；各結局、終結可到達且能回到上一個選擇；存讀檔；章節與圖鑑解鎖（讀完才標記已讀）；儲思盆沿用最近一次的數值；回溯；立繪與合流舞台一致；沒有卡頓（`perf.js`）。
- 已知誤報：
  - `chain.js` 的「選項與台詞不一致」：ch1_09 第 61 行、ch1_05 第 772 行是改寫，不是錯。
  - `analyze.mjs` 的「合流時舞台不一致」「說話者不在場」都人工確認過，是刻意安排。
