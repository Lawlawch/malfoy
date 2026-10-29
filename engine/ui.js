/* =============================================================
   ui.js  遊戲中的介面：對話框、名牌、選項、工具列、紀錄、確認視窗、提示、輸入
   ============================================================= */
import { G, $, $$, el, tap, sleep, esc, fontPx, avatarUrl, story } from "./core.js";

let msg, txt, plate, frame, hit, dim, choicesBox, toolbar, toastEl;
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

export function msgVisible(on) { msg.classList.toggle("on", !!on); if (!on) hideQuill(); syncToolbar(); }
export function isHidden() { return msg.classList.contains("hid"); }
export function setHidden(on) { msg.classList.toggle("hid", !!on); syncToolbar(); }

function speakerInfo(sp) {
  if (!sp) return null;
  return { name: sp.name, avatar: sp.id || sp.name };
}

// 量出這句在對話框裡要用多大的字（太長就縮小，最小 62%）
function fitSize(text, narr) {
  const base = fontPx(), min = Math.round(base * 0.62);   // 最多縮到 62%（只有很長的句子加大字體時才會用到）
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
// title：選項題目（可省略），顯示在選項上方，下面一條金色飾線
export function showChoices(opts, title) {
  return new Promise((resolve) => {
    choicesBox.innerHTML = "";
    if (title) choicesBox.append(el("div.vn_q", { text: title }));
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
    G.root.classList.add("choosing");              // 選項時刻：工具列圖示改成淺色（底下的對話框變暗了）
    layoutChoices();
  });
}
export function hideChoices() { choicesBox.classList.remove("on"); choicesBox.innerHTML = ""; dim.classList.remove("on"); G.root.classList.remove("choosing"); }
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
/* 工具列：放在對話框內側底部、靠右的一排圖示（SVG 線條圖示，墨褐色）。滑鼠移過去會顯示名稱。
   跟著對話框一起顯示、隱藏（右鍵或「隱藏」把對話框收起時，工具列也收起）。 */
const TOOLS = [["auto", "自動"], ["skip", "略過"], ["log", "紀錄"], ["hide", "隱藏"], ["save", "存檔"], ["load", "讀檔"], ["config", "設定"], ["title", "標題"]];
const ICONS = {
 "auto": "<path d=\"M8 5.5v13l10.5-6.5z\" fill=\"currentColor\" stroke=\"none\"/>",
 "skip": "<path d=\"M4 6v12l8-6zM12 6v12l8-6z\" fill=\"currentColor\" stroke=\"none\"/>",
 "log": "<path d=\"M8 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8\"/><path d=\"M8 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2 2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z\"/><path d=\"M12.5 9h4M12.5 12.5h4M12.5 16h2.5\"/>",
 "hide": "<path d=\"M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\"/><path d=\"M4 20 20 4\"/>",
 "save": "<path d=\"M4 20h10M4 6h6M4 9.5h4.5M4 13h3.5\"/><path d=\"M21 3c-4.5.5-8.5 4.2-10.5 9.2L9.5 16l3.6-1.1C18 13 20.6 8.2 21 3z\"/><path d=\"M9.5 16l4.2-4.4\"/>",
 "load": "<path d=\"M12 7C10 5.5 7 5 3.5 5.5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5v-13C17 5 14 5.5 12 7z\"/><path d=\"M12 7v13\"/>",
 "config": "<path d=\"M21.09 10.56 L21.09 13.44 L18.68 13.72 L17.97 15.47 L19.44 17.41 L17.41 19.44 L15.51 17.94 L13.77 18.67 L13.44 21.09 L10.56 21.09 L10.28 18.68 L8.53 17.97 L6.59 19.44 L4.56 17.41 L6.06 15.51 L5.33 13.77 L2.91 13.44 L2.91 10.56 L5.32 10.28 L6.03 8.53 L4.56 6.59 L6.59 4.56 L8.49 6.06 L10.23 5.33 L10.56 2.91 L13.44 2.91 L13.72 5.32 L15.47 6.03 L17.41 4.56 L19.44 6.59 L17.94 8.49 L18.67 10.23 Z\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\"/>",
 "title": "<path d=\"M4 20V9h3v2h2.5V9h5v2H17V9h3v11z\"/><path d=\"M10 20v-3.5a2 2 0 0 1 4 0V20\"/>"
};
function buildToolbar() {
  const strip = el("div.vn_strip");
  TOOLS.forEach(([act, label]) => {
    const b = el("button", { type: "button", "data-act": act, title: label, "aria-label": label });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[act]}</svg>`;
    strip.append(tap(b, () => handlers.tool && handlers.tool(act)));
  });
  toolbar = el("div#vn_toolbar", {}, strip);
  return toolbar;
}
function syncToolbar() { if (toolbar && msg) toolbar.classList.toggle("hid", !msg.classList.contains("on") || msg.classList.contains("hid")); }
export function toolbarOn(on) { toolbar.classList.toggle("on", !!on); syncToolbar(); }
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
