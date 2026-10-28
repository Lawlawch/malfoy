/* =============================================================
   main.js  開機：建立畫面、套用縮放與橫直向、預載字體、顯示首頁
   ============================================================= */
import { G, $, el, fit, fontPx, DEBUG } from "./core.js";
import { initStage } from "./stage.js";
import { initUI } from "./ui.js";
import { showHome } from "./screens.js";
import "./player.js";

const root = G.root = el("div#game");
document.body.append(root);
initStage(root);
initUI(root);
const setFont = () => root.style.setProperty("--fs", fontPx() + "px");
G.onResize.unshift(setFont);

window.addEventListener("resize", fit);
window.addEventListener("orientationchange", () => setTimeout(fit, 150));
fit();
setFont();

// 字體：開機先預載劇本與介面用字所在的分片，出字時不會換字型閃一下
async function fonts() {
  if (!document.fonts) return;
  const pre = (window.VN_PRELOAD || "") + "，。「」？！…— ";
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 24px "VN Serif"', pre),
        document.fonts.load('700 24px "VN Serif"', "鉑金色的馬份蛇與獅之歌繼續新遊戲讀檔儲思盆圖鑑設定存檔紀錄返回標題第章年級")
      ]),
      new Promise((r) => setTimeout(r, 6000))       // 網路很慢時最多等 6 秒
    ]);
  } catch (e) {}
  document.fonts.addEventListener?.("loadingdone", () => G.onResize.forEach((fn) => { try { fn(); } catch (e) {} }));
}

await fonts();
showHome();
const boot = $("#vn_boot");
if (boot) { boot.classList.add("hide"); setTimeout(() => boot.remove(), 600); }
if (DEBUG) console.log("測試模式：圖鑑可全部解鎖、主控台顯示數值");
