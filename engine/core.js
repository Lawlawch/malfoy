/* =============================================================
   core.js  共用：版面常數、畫面縮放、系統變數（sf）、IndexedDB、小工具
   ============================================================= */
import * as story from "../story/story.js";

export const SAVE_FORMAT = 1;                     // 存檔資料結構的版本：只有結構改了才升（不同的無法讀取）
export const DEBUG = /[?&]debug=1(&|$)/.test(location.search || "");
export { story };

/* ---------- 版面：橫向 1280×720、直向 720×1280（遊戲內邏輯像素）---------- */
export const LAYOUT = {
  // 立繪（半身）：chara_h = 1 倍時的高度，chara_bottom = 立繪底邊的位置（腰部切邊藏在對話框後面）
  //   chara_k = 1／2／3 人同框時的縮小比例，chara_x = 各人的中心位置（畫面寬度的比例）
  land: { w: 1280, h: 720, font: 28, chara_h: 620, chara_bottom: 720, chara_k: [1, 1, 0.9], chara_x: [[0.5], [0.33, 0.67], [0.22, 0.5, 0.78]], sel: 28 },
  port: { w: 720, h: 1280, font: 36, chara_h: 860, chara_bottom: 1000, chara_k: [1, 0.72, 0.55], chara_x: [[0.5], [0.3, 0.7], [0.2, 0.5, 0.8]], sel: 36 }
};
export const G = {
  land: true,
  L: LAYOUT.land,
  root: null,                                     // #game
  onResize: []                                    // 轉向／縮放後要呼叫的函式
};

export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
// el("div.cls#id", {attr}, children...)
export function el(spec, attrs, ...kids) {
  const m = /^(\w+)?((?:[.#][\w-]+)*)$/.exec(spec);
  const e = document.createElement(m[1] || "div");
  (m[2].match(/[.#][\w-]+/g) || []).forEach((t) => (t[0] === "." ? e.classList.add(t.slice(1)) : (e.id = t.slice(1))));
  if (attrs) for (const k in attrs) {
    if (k === "text") e.textContent = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
  }
  kids.flat().forEach((k) => k != null && e.append(k));
  return e;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// 按鈕：用原生 click（滑鼠、觸控都可靠；引擎沒有攔截觸控，所以不需要額外處理）
export function tap(e, fn) { e.addEventListener("click", (ev) => { ev.stopPropagation(); fn(ev); }); return e; }

/* ---------- 畫面縮放與橫直向 ---------- */
export function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const land = vw >= vh;
  const changed = land !== G.land || !G.root.classList.contains(land ? "land" : "port");
  G.land = land; G.L = land ? LAYOUT.land : LAYOUT.port;
  const { w, h } = G.L;
  const s = Math.min(vw / w, vh / h);
  G.scale = s;
  Object.assign(G.root.style, { width: w + "px", height: h + "px", transform: `translate(${(vw - w * s) / 2}px, ${(vh - h * s) / 2}px) scale(${s})` });
  G.root.classList.toggle("land", land);
  G.root.classList.toggle("port", !land);
  if (changed) G.onResize.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
}

/* ---------- 系統變數 sf：跨存檔共用（已讀、解鎖、設定、儲思盆進度）---------- */
const SF_KEY = "malfoy_sf";
export let sf = {};
try { sf = JSON.parse(localStorage.getItem(SF_KEY)) || {}; } catch (e) { sf = {}; }
let warnedStorage = false;
export function storageWarn() {
  if (warnedStorage) return;
  warnedStorage = true;
  import("./ui.js").then((u) => u.toast("瀏覽器儲存空間無法寫入，進度可能無法保存"));
}
export function saveSf() {
  try { localStorage.setItem(SF_KEY, JSON.stringify(sf)); } catch (e) { console.warn("saveSf", e); storageWarn(); }
}

/* ---------- IndexedDB（存檔用，容量比 localStorage 大；不能用時退回 localStorage）---------- */
export const db = (() => {
  let h = null, failed = false, waiting = null;
  const LS = "malfoy_db_";
  function open() {
    if (h || failed) return Promise.resolve(h);
    if (waiting) return waiting;
    waiting = new Promise((res) => {
      try {
        const rq = indexedDB.open("malfoy_vn", 1);
        rq.onupgradeneeded = () => { rq.result.createObjectStore("meta"); rq.result.createObjectStore("snap"); };
        rq.onsuccess = () => { h = rq.result; res(h); };
        rq.onerror = rq.onblocked = () => { failed = true; res(null); };
      } catch (e) { failed = true; res(null); }
    });
    return waiting;
  }
  const lsKey = (store, key) => LS + store + "_" + key;
  return {
    async put(store, key, val) {
      const d = await open();
      if (!d) { try { localStorage.setItem(lsKey(store, key), JSON.stringify(val)); return true; } catch (e) { storageWarn(); return false; } }
      return new Promise((res) => {
        try {
          const tx = d.transaction(store, "readwrite");
          tx.objectStore(store).put(val, key);
          tx.oncomplete = () => res(true);
          tx.onerror = tx.onabort = () => { storageWarn(); res(false); };
        } catch (e) { storageWarn(); res(false); }
      });
    },
    async get(store, key) {
      const d = await open();
      if (!d) { try { return JSON.parse(localStorage.getItem(lsKey(store, key))); } catch (e) { return null; } }
      return new Promise((res) => {
        try { const rq = d.transaction(store).objectStore(store).get(key); rq.onsuccess = () => res(rq.result ?? null); rq.onerror = () => res(null); }
        catch (e) { res(null); }
      });
    },
    async all(store) {
      const d = await open(), out = {};
      if (!d) {
        const pre = LS + store + "_";
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) try { out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) {} }
        return out;
      }
      return new Promise((res) => {
        try {
          const rq = d.transaction(store).objectStore(store).openCursor();
          rq.onsuccess = () => { const c = rq.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
          rq.onerror = () => res(out);
        } catch (e) { res(out); }
      });
    },
    async del(store, key) {
      const d = await open();
      if (!d) { try { localStorage.removeItem(lsKey(store, key)); } catch (e) {} return true; }
      return new Promise((res) => {
        try { const tx = d.transaction(store, "readwrite"); tx.objectStore(store).delete(key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }
        catch (e) { res(false); }
      });
    }
  };
})();

/* ---------- 設定 ---------- */
export const TEXT_SPEED = [60, 35, 15];           // 每個字的毫秒數：慢、普通、快
export const AUTO_SPEED = [2600, 1300, 700];      // 自動播放：每句停留的基本毫秒數（另加每字 30 毫秒）
export const FONT_SCALE = [0.9, 1, 1.2];
const CFG_DEF = { text: 1, auto: 1, font: 1, skipRead: 1, bgm: 80, voice: 100, se: 80 };
export function cfg() {
  sf.cfg = sf.cfg || {};
  for (const k in CFG_DEF) if (sf.cfg[k] === undefined) sf.cfg[k] = CFG_DEF[k];
  sf.cfg.font = 1;                                  // 字體大小設定已移除：一律標準大小
  for (const k of ["text", "auto"]) if (!(sf.cfg[k] >= 0 && sf.cfg[k] < TEXT_SPEED.length)) sf.cfg[k] = TEXT_SPEED.length - 1;   // 舊設定的「極快」改為「快」
  return sf.cfg;
}
export function fontPx() { return Math.round(G.L.font * FONT_SCALE[cfg().font]); }

/* ---------- 章節與角色 ---------- */
export const chapterById = (id) => story.chapters.find((c) => c.id === id) || null;
// 角色目前的服裝：記在數值 f.outfit_<角色>（跟著存檔、場景起點、章節起點一起保存）；沒設過就用 story.js 的預設。
// 沒有 outfits 的角色回傳 null（立繪直接放在 assets/chara/<角色>/<表情>.png）
export function outfitOf(f, id) {
  const ch = story.characters[id];
  if (!ch || !ch.outfits) return null;
  const o = f && f["outfit_" + id];
  return ch.outfits.includes(o) ? o : (ch.outfit || ch.outfits[0]);
}
export const NUM_CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
export function chapterLabel(c) { return `${story.years[c.year - 1] || ""}．第${NUM_CN[c.n] || c.n}章`; }
export function avatarUrl(key) {
  const file = story.characters[key] ? key : (story.speakers[key] || "harry");
  return `./assets/avatar/${file}.png`;
}

/* ---------- 已讀記錄（逐句）：用「章節＋句子文字」算短代碼，劇本改動後只有改過的句子變回未讀 ---------- */
import { hash } from "./parser.js";
const readCache = {};
let readDirty = 0;
export function readMark(ch, text) {
  sf.read = sf.read || {};
  const key = hash(ch + "|" + text.replace(/\s+/g, " ").trim());
  const str = sf.read[ch] || "";
  let c = readCache[ch];
  if (!c || c.str !== str) { c = readCache[ch] = { str, set: new Set(str ? str.split(",") : []) }; }
  if (c.set.has(key)) return true;
  c.set.add(key);
  c.str = sf.read[ch] = str ? str + "," + key : key;
  if (++readDirty >= 15) { readDirty = 0; saveSf(); }
  return false;
}
