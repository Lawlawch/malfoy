/* =============================================================
   audio.js  背景音樂、效果音、語音
   檔案：assets/bgm/<名稱>.mp3、assets/sound/<名稱>.mp3、assets/voice/<名稱>.mp3
         介面音效：assets/sound/ui_*.wav（很短，mp3 開頭會多一小段空白，所以用 WAV）
   手機瀏覽器（尤其 iOS）要等使用者點過畫面才能出聲，所以第一次點擊時解鎖，
   之前排定的背景音樂會在解鎖後自動開始。
   效果音（介面音效、劇本 @se）用 Web Audio：解碼一次後快取，播放時 BufferSource → Gain → 喇叭。
   用 new Audio() 播很短的音，手機或藍牙耳機剛開始輸出時會漸強，把聲音吃掉；Web Audio 沒有這個問題。
   背景音樂、語音維持 new Audio()。
   ============================================================= */
import { cfg, DEBUG } from "./core.js";

let bgm = null, bgmName = "", bgmVol = 100, unlocked = false, fadeTimer = null;
const url = (dir, name, ext = "mp3") => `./assets/${dir}/${name}.${ext}`;

/* ---------- Web Audio：效果音 ---------- */
let ctx = null;
const bufs = new Map(), loading = new Map();
const UI_SFX = ["ui_click", "ui_choice", "ui_open", "ui_close", "ui_page", "ui_save", "ui_slide", "ui_chapter"];
function getCtx() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) { try { ctx = new C(); } catch (e) { ctx = null; } } }
  return ctx;
}
function load(path) {
  if (bufs.has(path)) return Promise.resolve(bufs.get(path));
  if (loading.has(path)) return loading.get(path);
  const c = getCtx();
  if (!c) return Promise.resolve(null);
  const p = fetch(path).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then((ab) => new Promise((res, rej) => { const q = c.decodeAudioData(ab, res, rej); if (q && q.then) q.then(res, rej); }))   // 舊版 Safari 只有回呼寫法
    .then((b) => { bufs.set(path, b); loading.delete(path); return b; })
    .catch(() => { loading.delete(path); return null; });
  loading.set(path, p);
  return p;
}
function playBuf(path, vol) {
  const c = getCtx();
  if (!c || vol <= 0) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const go = (b) => {
    if (!b) return;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; g.gain.value = vol;
    src.connect(g); g.connect(c.destination);
    src.start(0);
  };
  const b = bufs.get(path);
  if (b) go(b); else load(path).then(go);      // 第一次播放：解碼完再播，之後直接用快取
}

function unlock() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});   // iOS：每次使用者操作時都試著喚醒（切到背景回來會再被暫停）
  if (unlocked) return;
  unlocked = true;
  UI_SFX.forEach((n) => load(url("sound", n, "wav")));               // 預載介面音效
  if (bgmName && bgm) bgm.play().catch(() => {});
}
for (const ev of ["pointerdown", "touchend", "keydown", "click"]) window.addEventListener(ev, unlock, { capture: true });

/* ---------- 介面音效 ----------
   一次點擊只播一個聲音：同一個事件裡先收集，最後只播優先順序最高的那個。
   ui_choice ＞ ui_save ＞ ui_open／ui_close／ui_page ＞ ui_click */
const PRI = { ui_choice: 4, ui_save: 3, ui_open: 2, ui_close: 2, ui_page: 2, ui_click: 1 };
let pend = null, pendT = 0;
export function uiSfx(name) {
  if (!PRI[name]) return;
  if (!pend || PRI[name] > PRI[pend]) pend = name;
  if (!pendT) pendT = setTimeout(flushUi, 0);
}
// 取消這次點擊已收集的聲音（例：存檔要等寫入成功才出聲，點擊當下不出聲）
export function uiCancel() { pend = null; }
// 不經點擊收集、直接播放的介面音效：拉條（拖動中最多每 70 毫秒一聲）、章節入場
let slideT = 0;
export function uiSlide() { const now = performance.now(); if (now - slideT < 70 || !unlocked) return; slideT = now; playBuf(url("sound", "ui_slide", "wav"), Math.min(1, cfg().se / 100) * 0.7); }
export function uiChapter() { if (DEBUG) (window.VN_SFX = window.VN_SFX || []).push("ui_chapter"); if (unlocked) playBuf(url("sound", "ui_chapter", "wav"), Math.min(1, cfg().se / 100)); }
function flushUi() {
  const n = pend; pend = null; pendT = 0;
  if (DEBUG && n) (window.VN_SFX = window.VN_SFX || []).push(n);   // 測試用：記錄播放了哪個介面音效
  if (n && unlocked) playBuf(url("sound", n, "wav"), Math.min(1, cfg().se / 100));
}
// 其他所有按鈕：ui_click。掛在 document 的捕獲階段：
// 被 ui.js「剛推進劇情 0.35 秒內」擋掉的點擊（在 window 捕獲階段就停止）不會走到這裡
const CLICKABLE = "#vn_toolbar button, #vn_home .item, .vn_cf_btn, .vn_slot, .vn_slot .del, .vn_tab, .vn_pg_btn, .vn_year_arrow, .vn_close_btn, .vn_seg > span, .se_btn, .vn_cg_item, #vn_cgview, .vn_ch_row, .vn_opt, button, [role=button]";
document.addEventListener("click", (e) => {
  const t = e.target && e.target.closest && e.target.closest(CLICKABLE);
  if (!t) return;
  if (t.closest(".off, [aria-disabled=true], .locked, .blank, .vn_debug")) return;   // 停用的按鈕不出聲
  uiSfx("ui_click");
}, true);

function fadeTo(a, target, ms, done) {
  clearInterval(fadeTimer);
  if (!ms) { a.volume = target; if (done) done(); return; }
  const start = a.volume, t0 = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, start + (target - start) * k));
    if (k >= 1) { clearInterval(fadeTimer); if (done) done(); }
  }, 40);
}
const masterBgm = () => (cfg().bgm / 100) * (bgmVol / 100);

// name = "" 代表停止
export function playBgm(name, fade = 1000, vol = 100) {
  if (name === bgmName && bgm) return;
  const old = bgm;
  if (old) fadeTo(old, 0, fade, () => old.pause());
  bgmName = name; bgmVol = vol; bgm = null;
  if (!name) return;
  const a = new Audio(url("bgm", name));
  a.loop = true; a.volume = 0;
  bgm = a;
  if (unlocked) a.play().catch(() => {});
  setTimeout(() => fadeTo(a, masterBgm(), fade), 0);
}
export function currentBgm() { return bgmName; }
export function stopAll() { playBgm("", 300); stopVoice(); }

let voice = null;
export function stopVoice() { if (voice) { voice.pause(); voice = null; } }
export function playSe(name, vol = 100) {
  if (!unlocked) return;
  const v = Math.min(1, (cfg().se / 100) * (vol / 100));
  if (getCtx()) { playBuf(url("sound", name), v); return; }
  const a = new Audio(url("sound", name));    // 不支援 Web Audio 的瀏覽器
  a.volume = v;
  a.play().catch(() => {});
}
export function playVoice(name, vol = 100) {
  stopVoice();
  if (!unlocked) return;
  voice = new Audio(url("voice", name));
  voice.volume = Math.min(1, (cfg().voice / 100) * (vol / 100));
  voice.play().catch(() => {});
}
// 設定畫面調音量時立即套用
export function applyVolumes() { if (bgm) { clearInterval(fadeTimer); bgm.volume = masterBgm(); } }
