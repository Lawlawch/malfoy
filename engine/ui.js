/* =============================================================
   ui.js  遊戲中的介面：對話框、名牌、選項、工具列、紀錄、確認視窗、提示、輸入
   ============================================================= */
import { G, $, $$, el, tap, sleep, esc, fontPx, avatarUrl, story } from "./core.js";

let msg, txt, plate, frame, hit, dim, choicesBox, toolbar, toastEl, cover;
export const handlers = {};                        // 由 player.js 填入：advance、toggleHide、openLog、toolbar 動作……

export function initUI(root) {
  msg = el("div#msg",
    {},
    el("div.box"),
    frame = el("div#frame", {}, el("div.f1"), el("div.f2"), el("i.tl"), el("i.tr"), el("i.bl"), el("i.br")),
    plate = el("div#plate"),
    txt = el("div.txt")
  );
  hit = el("div#hit");
  dim = el("div#dim");
  choicesBox = el("div#choices");
  toastEl = el("div#vn_toast");
  root.append(msg, hit, dim, choicesBox, buildToolbar(), toastEl);
  G.onResize.push(() => { refit(); layoutChoices(); });
  bindInput(root);
}

/* =============================================================
   對話框
   ============================================================= */
let shown = null;                                   // 目前顯示的這句 {speaker, text}
let typing = null;                                  // 逐字顯示中的控制物件

export function msgVisible(on) { msg.classList.toggle("on", !!on); if (!on) hideQuill(); }
export function isHidden() { return msg.classList.contains("hid"); }
export function setHidden(on) { msg.classList.toggle("hid", !!on); }

function speakerInfo(sp) {
  if (!sp) return null;
  return { name: sp.name, avatar: sp.id || sp.name };
}

// 量出這句在對話框裡要用多大的字（太長就縮小，最小 72%）
function fitSize(text, narr) {
  const base = fontPx(), min = Math.round(base * 0.72);
  const probe = el("div.txt.probe");            // 同樣的寬度與內距，但高度隨內容（量完就移除）
  probe.textContent = text;
  msg.append(probe);
  const maxH = txt.clientHeight;
  if (!maxH) { probe.remove(); return base; }     // 對話框被隱藏時量不到，先用預設大小
  let size = base;
  while (size > min) {
    probe.style.fontSize = size + "px";
    if (probe.offsetHeight <= maxH + 1) break;
    size -= 2;
  }
  probe.remove();
  return size;
}
function refit() {
  if (!shown) return;
  txt.style.fontSize = fitSize(shown.text, !shown.speaker) + "px";
  placeQuill();
}

// 顯示一句：speed = 每字毫秒（0 = 直接全部顯示）。回傳 Promise，打完字時完成
export function showLine(speaker, text, speed) {
  finishTyping();
  shown = { speaker, text };
  const info = speakerInfo(speaker);
  msg.classList.toggle("nar", !info);
  plate.textContent = info ? info.name : "";
  plate.classList.toggle("on", !!info);
  msgVisible(true);
  txt.innerHTML = "";
  txt.style.fontSize = fitSize(text, !info) + "px";
  const chars = Array.from(text).map((c) => el("span.h", { text: c }));
  txt.append(...chars);
  if (!speed) { chars.forEach((s) => s.classList.remove("h")); showQuill(); return Promise.resolve(); }
  return new Promise((resolve) => {
    let i = 0;
    const t = { done: false, resolve, timer: 0 };
    t.finish = () => { if (t.done) return; t.done = true; clearInterval(t.timer); chars.forEach((s) => s.classList.remove("h")); typing = null; showQuill(); resolve(); };
    t.timer = setInterval(() => { if (i < chars.length) chars[i++].classList.remove("h"); else t.finish(); }, speed);
    typing = t;
  });
}
export function isTyping() { return !!typing; }
export function finishTyping() { if (typing) typing.finish(); }
export function clearLine() { finishTyping(); shown = null; txt.innerHTML = ""; plate.classList.remove("on"); hideQuill(); }
export function currentLine() { return shown; }

let quill = null;
function showQuill() { hideQuill(); quill = el("img.quill", { src: "./assets/ui/quill.png", alt: "" }); txt.append(quill); }
function hideQuill() { if (quill) { quill.remove(); quill = null; } }
function placeQuill() {}
export function quillOff() { hideQuill(); }

/* =============================================================
   選項
   ============================================================= */
export function showChoices(opts) {
  return new Promise((resolve) => {
    choicesBox.innerHTML = "";
    const shownAt = Date.now();
    opts.forEach((o, i) => {
      const b = el("div.vn_opt", { text: o.text });
      tap(b, () => {
        if (Date.now() - shownAt < 350) return;    // 剛出現的 0.35 秒內不接受（避免同一下點擊直接選到）
        hideChoices();
        resolve(i);
      });
      choicesBox.append(b);
    });
    dim.classList.add("on");
    choicesBox.classList.add("on");
    layoutChoices();
  });
}
export function hideChoices() { choicesBox.classList.remove("on"); choicesBox.innerHTML = ""; dim.classList.remove("on"); }
// 選項太多、太長時縮小字體，直到放得下
function layoutChoices() {
  if (!choicesBox.classList.contains("on")) return;
  let size = G.L.sel;
  choicesBox.style.fontSize = size + "px";
  for (let g = 0; g < 10 && choicesBox.scrollHeight > choicesBox.clientHeight + 1 && size > 18; g++) {
    size = Math.floor(size * 0.92);
    choicesBox.style.fontSize = size + "px";
  }
}
export function choicesOpen() { return choicesBox.classList.contains("on"); }

/* =============================================================
   工具列
   ============================================================= */
const TOOLS = [["auto", "自動"], ["skip", "略過"], ["log", "紀錄"], ["hide", "隱藏"], ["save", "存檔"], ["load", "讀檔"], ["config", "設定"], ["title", "標題"]];
function buildToolbar() {
  const strip = el("div.vn_strip", {}, el("i.tl"), el("i.tr"), el("i.bl"), el("i.br"));
  TOOLS.forEach(([act, label], i) => {
    if (i) strip.append(el("s"));
    strip.append(tap(el("button", { type: "button", "data-act": act, text: label }), () => handlers.tool && handlers.tool(act)));
  });
  toolbar = el("div#vn_toolbar", {}, strip);
  return toolbar;
}
export function toolbarOn(on) { toolbar.classList.toggle("on", !!on); }
export function toolbarState(s) {
  for (const k in s) { const b = $(`[data-act="${k}"]`, toolbar); if (b) b.classList.toggle("active", !!s[k]); }
}

/* =============================================================
   提示、確認視窗、黑幕
   ============================================================= */
let toastTimer = 0;
export function toast(text) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

// confirm({title, sub, ok, cancel, single}) → Promise<boolean>
export function confirm(o) {
  return new Promise((resolve) => {
    $("#vn_confirm")?.remove();
    const close = (v) => { box.remove(); resolve(v); };
    const box = el("div#vn_confirm.vn_overlay", {},
      el("div.vn_cf_box", {},
        el("div.vn_cf_title", { text: o.title || "" }),
        o.sub ? el("div.vn_cf_sub", { text: o.sub }) : null,
        el("div.vn_cf_btns", {},
          o.single ? null : tap(el("span.vn_cf_btn.vn_cf_no", { text: o.cancel || "取消" }), () => close(false)),
          tap(el("span.vn_cf_btn.vn_cf_yes", { text: o.ok || "確定" }), () => close(true)))));
    box.dataset.esc = "no";
    G.root.append(box);
  });
}

export function coverOn() { cover?.remove(); cover = el("div#vn_cover"); G.root.append(cover); setTimeout(coverOff, 8000); }
export function coverOff() {
  const c = cover; if (!c) return; cover = null;
  c.classList.add("out"); setTimeout(() => c.remove(), 600);
}

/* =============================================================
   紀錄
   ============================================================= */
export const log = [];
export function pushLog(speaker, text) {
  const nm = speaker ? speaker.name : "";
  const last = log[log.length - 1];
  if (last && last.name === nm && last.text === text) return;
  log.push({ name: nm, key: speaker ? (speaker.id || speaker.name) : "", text });
  if (log.length > 300) log.shift();
}
export function resetLog() { log.length = 0; }

// 面板外框（紀錄、存檔、設定……共用）。回傳 {root, tabs, body, foot, close}
export function panel(title, id) {
  closeOverlays();
  const r = el("div.vn_scr.vn_sys.vn_overlay" + (id ? "#" + id : ""), {},
    el("div.vn_sys_panel", {},
      el("div.vn_sys_head", {}, el("span.vn_sys_title", { text: title }), el("span.vn_close_btn", { text: "×" })),
      el("div.vn_tabs"), el("div.vn_scr_body"), el("div.vn_scr_foot", {}, el("span.vn_scr_msg"))));
  const S = { root: r, tabs: $(".vn_tabs", r), body: $(".vn_scr_body", r), foot: $(".vn_scr_foot", r), close: () => { r.remove(); $("#vn_cgview")?.remove(); } };
  tap($(".vn_close_btn", r), S.close);
  G.root.append(r);
  return S;
}
export function panelMsg(S, text) {
  const m = $(".vn_scr_msg", S.root);
  m.textContent = text; m.classList.add("show");
  clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove("show"), 2200);
}
export function closeOverlays() { $$(".vn_scr, #vn_cgview").forEach((e) => e.remove()); }
export function overlayOpen() { return !!$(".vn_overlay", G.root) || !!$("#vn_home", G.root); }

export function openLog() {
  const S = panel("紀錄", "vn_log");
  const body = el("div.log_body");
  S.body.replaceWith(body);
  $(".vn_tabs", S.root).remove();
  $(".vn_scr_foot", S.root).remove();
  if (!log.length) body.append(el("div.vn_empty", { text: "（目前沒有紀錄）" }));
  log.forEach((r) => {
    body.append(el("div.vn_log_row", {},
      el("div.vn_log_av", {}, r.name ? el("img", { alt: "", src: avatarUrl(r.key) }) : null),
      el("div.vn_log_main", {}, r.name ? el("div.vn_log_name", { text: r.name }) : null, el("div.vn_log_text", { text: r.text }))));
  });
  body.scrollTop = body.scrollHeight;
}

/* =============================================================
   輸入：全部集中在這裡
   - 點畫面（#hit）／Enter／滾輪向下：下一句
   - 右鍵：隱藏對話框；滾輪向上：紀錄；Esc：關閉最上層視窗
   - 有視窗開著時，劇情不會前進
   ============================================================= */
let lastAdvance = 0;
function bindInput(root) {
  hit.addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (overlayOpen()) return;
    lastAdvance = Date.now();
    handlers.advance && handlers.advance();
  });
  root.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (overlayOpen() || !handlers.inGame || !handlers.inGame()) return;
    handlers.toggleHide && handlers.toggleHide();
  });
  let wheelAt = 0;
  root.addEventListener("wheel", (e) => {
    if (overlayOpen() || !handlers.inGame || !handlers.inGame()) return;
    const now = Date.now();
    if (now - wheelAt < 200) return;
    wheelAt = now;
    if (e.deltaY > 0) { lastAdvance = now; handlers.advance && handlers.advance(); }
    else if (e.deltaY < 0 && handlers.openLog) handlers.openLog();
  }, { passive: true });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const c = $("#vn_confirm");
      if (c) { $(".vn_cf_no", c)?.click(); return; }
      if ($("#vn_cgview")) { $("#vn_cgview").remove(); return; }
      const p = $$(".vn_scr", root).pop();
      if (p) { $(".vn_close_btn", p)?.click(); return; }
      return;
    }
    if (e.key === "Enter" && !e.repeat) {
      if (overlayOpen() || e.target.closest?.("input")) return;
      lastAdvance = Date.now();
      handlers.advance && handlers.advance();
    }
  });
  // 剛推進劇情的 0.35 秒內，畫面上新出現的按鈕不接受點擊（手機放開手指後瀏覽器補送的 click）
  // 只擋「因為推進劇情才出現」的東西（選項、章末頁、確認框），工具列不受影響
  window.addEventListener("click", (e) => {
    if (Date.now() - lastAdvance < 350 && e.target.closest && e.target.closest("#choices, #vn_end, #vn_confirm")) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}
export function hitOn(on) { hit.classList.toggle("on", !!on); }
