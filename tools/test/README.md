# 測試工具（tools/test）

先在 repo 根目錄開本機伺服器：`python3 -m http.server 8765`
需要 Node 與 Playwright（Chromium）：`npm i -D playwright && npx playwright install chromium`
模式：`desktop`（1280×720）、`iphone-port`（iPhone 13 直向）、`iphone-land`（iPhone 13 橫向）。iOS 是 Chromium 模擬，不是真的 Safari。

| 檔案 | 測什麼 | 用法 |
|---|---|---|
| `h.js` | 共用：開頁、開章、依策略自動遊玩、逐個選項檢查羈絆 | — |
| `chain.js` | 完整 12 章連續遊玩：羈絆、羈絆門檻、結局、章節開始數值、已讀／解鎖；可隨機回溯 | `node chain.js desktop out ABCDRR 0.5`（A–D 指定路線、R 隨機；最後的數字＝每個選擇後回溯的機率） |
| `term.js` | 各終結：終結畫面、不解鎖下一章、回到上一個選擇、自動存檔 | `node term.js out desktop` |
| `saveload.js` | 存讀檔 12 項 | `node saveload.js desktop` |
| `pensieve.js` | 儲思盆：已讀、解鎖、沿用最近一次的數值 | `node pensieve.js desktop` |
| `stress.js` | 連點、選項中亂點、開關面板、旋轉 | `node stress.js desktop` |
| `endscr.js` | 完結頁／年級結算／終結畫面離開後「繼續」 | `node endscr.js desktop` |
| `rewind.js`、`rwstress.js` | 工具列「回溯」與壓力測試 | `node rewind.js desktop` |
| `sfx.js` | 介面音效：每個操作只出一個、出對的聲音 | `node sfx.js desktop` |
| `cgview.js` | 圖鑑 CG 檢視：遊戲畫面／原圖、關閉方式、轉向 | `node cgview.js iphone-port` |
| `perf.js` | 卡頓：CPU 降速模擬手機，點擊反應、面板開啟、畫面停頓 | `node perf.js iphone-port 4` |
| `analyze.mjs` | 靜態分析：沿每條路線模擬舞台，找合流時立繪不一致、說話者不在場、服裝、日夜用字；輸出每個選擇的分支開頭與合流點 | `node analyze.mjs out` → `out/static_report.txt`、`out/choice_review.txt` |

輸出資料夾（`out`）要先建立。測試要網址加 `?debug=1`（h.js 已處理）。
