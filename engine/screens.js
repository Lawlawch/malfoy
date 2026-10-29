/* =============================================================
   screens.js  首頁、存檔／讀檔、儲思盆、圖鑑、設定、過渡畫面、年級結算、劇本修葺中
   ============================================================= */
import { G, $, el, tap, sf, saveSf, db, cfg, fontPx, story, chapterById, chapterLabel, NUM_CN, DEBUG } from "./core.js";
import * as ui from "./ui.js";
import * as audio from "./audio.js";
import { P, hooks, preloadChapter, startChapter, hasContinue, doContinue, makeSave, loadSnap, saveStatus, quitToTitle, setAuto, setSkip, toggleHide, stopAutoSkip, syncTools } from "./player.js";

/* =============================================================
   首頁
   ============================================================= */
const CASTLE = '<svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="vnh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1022"/><stop offset="1" stop-color="#05060d"/></linearGradient></defs><path fill="url(#vnh)" d="M0 600V470l60-20 40 30 70-60 50 40 90-30V600zM560 600V420h30v-50h20v-60l15-35 15 35v60h20v50h35v-90h24l16-40 16 40h24v90h30V330l18-70 18 70v90h44v60h60V400h22l14-60 14 60h22v-40h40v240zM1120 600V380l25-30v-60l20-50 20 50v60l25 30v220zM1260 600V450l50-30 50 30v-70l20-40 20 40v70l40-20 40 40 70-30V600z"/><path fill="#05060d" d="M0 600V540l180-30 200 40 220-20 240 30 260-40 300 30 200-20V600z"/><g fill="#f3c26b" opacity=".85"><rect x="612" y="395" width="5" height="9"/><rect x="760" y="330" width="5" height="9"/><rect x="842" y="380" width="5" height="9"/><rect x="1150" y="330" width="5" height="9"/><rect x="1146" y="420" width="5" height="9"/><rect x="1328" y="400" width="5" height="9"/><rect x="940" y="410" width="5" height="9"/></g></svg>';

export function showHome(panelName) {
  hideHome();
  ui.closeOverlays();
  $("#vn_end")?.remove();
  const items = [];
  if (hasContinue()) items.push(["continue", "繼續"]);
  items.push(["new", "新遊戲"], ["load", "讀檔"], ["chapters", "儲思盆"], ["gallery", "圖鑑"], ["config", "設定"]);
  const menu = el("div.menu");
  items.forEach(([a, label]) => menu.append(tap(el("div.item", { "data-a": a, text: label }), () => homeAction(a))));
  const h = el("div#vn_home", {},
    el("div.bg", { html: '<div class="stars"></div><div class="moon"></div>' + CASTLE }),
    el("div.veil"),
    el("div.frame", {}, el("i.tl"), el("i.tr"), el("i.bl"), el("i.br")),
    el("div.col", {},
      el("div.ttl", {}, el("div.t1", { text: "鉑金色的馬份" }), el("div.orn", {}, el("span"), el("i"), el("span")), el("div.t2", { text: "蛇與獅之歌" })),
      menu));
  G.root.append(h);
  preloadChapter(story.chapters[0].id);
  if (sf.cont) preloadChapter(sf.cont);
  if (panelName) openPanel(panelName);
}
export function hideHome() { $("#vn_home")?.remove(); }

async function homeAction(a) {
  if (a === "continue") { await doContinue(); return; }
  if (a === "new") {
    if (hasContinue() && !(await ui.confirm({ title: "開始新遊戲？", sub: "目前的自動存檔會被取代。手動存檔不受影響。", ok: "開始", cancel: "取消" }))) return;
    hideHome();
    startChapter(story.chapters[0].id, { fresh: true });
    return;
  }
  openPanel(a);
}

export function openPanel(name) {
  stopAutoSkip();
  ({ save: () => openSaveLoad("save"), load: () => openSaveLoad("load"), chapters: openChapters, gallery: openGallery, config: openConfig })[name]?.();
}

/* =============================================================
   存檔／讀檔：3 頁 × 6 格
   ============================================================= */
function tabs(S, names, active, onPick) {
  S.tabs.innerHTML = "";
  names.forEach((t, i) => S.tabs.append(tap(el("span.vn_tab" + (i === active ? ".on" : ""), { text: t }), () => onPick(i))));
}
function shortChapter(meta) { const c = chapterById(meta.ch); return c ? chapterLabel(c) : ""; }

function openSaveLoad(mode) {
  const S = ui.panel(mode === "save" ? "存檔" : "讀檔");
  let page = 0;
  async function render() {
    tabs(S, ["1", "2", "3"], page, (i) => { page = i; render(); });
    const metas = await db.all("meta");
    const grid = el("div.vn_slots");
    S.body.innerHTML = ""; S.body.append(grid);
    for (let j = 0; j < 6; j++) {
      const n = page * 6 + j + 1, id = "m" + n, meta = metas[id] || null, label = "No." + String(n).padStart(2, "0");
      const slot = el("div.vn_slot" + (meta ? "" : ".empty"));
      if (!meta) slot.append(el("div.no", { text: label }), el("div.vn_slot_empty", { text: "— 空 —" }));
      else {
        const status = await saveStatus(meta);
        const note = status === "old" ? "舊格式的存檔，無法讀取" : status === "missing" ? "找不到這個存檔的章節" : status === "changed" ? "劇本已更新，將從段落開頭讀取" : "";
        const thumb = el("div.thumb" + (meta.th > meta.tw ? ".p" : ""));
        if (meta.thumb) thumb.style.backgroundImage = `url(${meta.thumb})`;
        const del = tap(el("span.del", { text: "刪除" }), async () => {
          if (!(await ui.confirm({ title: "刪除這個存檔？", sub: "刪除後無法復原。", ok: "刪除", cancel: "取消" }))) return;
          await db.del("snap", id); await db.del("meta", id);
          ui.panelMsg(S, "已刪除 " + label); render();
        });
        slot.append(thumb, el("div.info", {},
          el("div.hd", {}, el("span.no", { text: label }), el("span.tm", { text: meta.time })),
          el("div.ch", { text: shortChapter(meta) }),
          note ? el("div.old", { text: note }) : null,
          el("div.ln", { text: meta.line }),
          el("div.act", {}, del)));
      }
      tap(slot, async () => {
        if (mode === "load") {
          if (!meta) return;
          const snap = await db.get("snap", id);
          if (snap) loadSnap(snap);
          return;
        }
        if (meta && !(await ui.confirm({ title: "覆蓋這個存檔？", sub: "原有的存檔內容將被取代，無法復原。", ok: "覆蓋", cancel: "取消" }))) return;
        const data = await makeSave();
        if (!data) { ui.panelMsg(S, "現在無法存檔，請稍候再試"); return; }
        const ok = (await db.put("snap", id, data.snap)) && (await db.put("meta", id, data.meta));
        ui.panelMsg(S, ok ? "已存入 " + label : "存檔失敗（瀏覽器容量不足？）");
        render();
      });
      grid.append(slot);
    }
  }
  render();
}

/* =============================================================
   儲思盆（章節選擇）
   ============================================================= */
function openChapters() {
  const S = ui.panel("儲思盆");
  sf.unlocked = sf.unlocked || {}; sf.unlocked[story.chapters[0].id] = 1;
  let yi = 0;
  function render() {
    const multi = story.years.length > 1;
    S.tabs.innerHTML = "";
    S.tabs.append(el("div.vn_year", {},
      tap(el("span.vn_year_arrow" + (multi ? "" : ".off"), { text: "‹" }), () => { if (multi) { yi = (yi + story.years.length - 1) % story.years.length; render(); } }),
      el("span.vn_year_name", { text: story.years[yi] }),
      tap(el("span.vn_year_arrow" + (multi ? "" : ".off"), { text: "›" }), () => { if (multi) { yi = (yi + 1) % story.years.length; render(); } })));
    const list = el("div.vn_ch_list");
    const chs = story.chapters.filter((c) => c.year === yi + 1);
    for (let i = 0; i < 10; i++) {
      const c = chs[i];
      const open = !!(c && c.ready && sf.unlocked[c.id]);
      if (!open) { list.append(el("div.vn_ch_row.locked", {}, el("span.lock"))); continue; }
      const row = el("div.vn_ch_row", {}, el("span.no", { text: "第" + NUM_CN[c.n] + "章" }), el("span.nm", { text: c.title }), sf.done && sf.done[c.id] ? el("span.done", { text: "已讀" }) : null);
      tap(row, async () => {
        const note = sf.head !== undefined && c.n > sf.head && !!(sf.chStart && sf.chStart[c.id]);   // 沿用舊時間線留下的進度
        const auto = hasContinue();
        if (note || auto) {
          const sub = [note ? "此章將沿用先前的進度。" : "", auto ? "目前的自動存檔會被取代。手動存檔不受影響。" : ""].filter(Boolean).join("\n");
          if (!(await ui.confirm({ title: "從這一章開始？", sub, ok: "開始", cancel: "取消" }))) return;
        }
        S.close(); hideHome();
        startChapter(c.id);
      });
      list.append(row);
    }
    S.body.innerHTML = ""; S.body.append(list);
  }
  render();
}

/* =============================================================
   圖鑑
   ============================================================= */
function openGallery() {
  const S = ui.panel("圖鑑");
  S.root.classList.add("vn_gallery");
  const cats = [{ name: "一般 CG", list: story.cgs.normal, flag: "cgsSeen", base: 0 }, { name: "結局 CG", list: story.cgs.ending, flag: "endings", base: 500 }];   // 結局 CG 編號從 #501 起算
  let cat = 0, page = 0;
  function render() {
    tabs(S, cats.map((c) => c.name), cat, (i) => { cat = i; page = 0; render(); });
    const C = cats[cat], pages = Math.max(1, Math.ceil(C.list.length / 6));
    page = Math.min(page, pages - 1);
    const grid = el("div.vn_cg_grid");
    C.list.slice(page * 6, page * 6 + 6).forEach((it, ix) => {
      const no = C.base + page * 6 + ix + 1, got = !!(sf[C.flag] && sf[C.flag][it.id]);
      const th = el("div.thumb");
      if (got) { const ph = el("span.ph", { text: it.name }); th.append(ph); tryImg(it.id, (u) => { th.style.backgroundImage = `url(${u})`; ph.remove(); }); }
      else th.append(el("span.q", { text: "？" }));
      const item = el("div.vn_cg_item" + (got ? "" : ".locked"), {}, th, el("div.nm", { text: "#" + no + " " + (got ? it.name : "？？？") }));
      if (got) tap(item, () => viewCG(it, no));
      grid.append(item);
    });
    // 不滿 6 張時補空格，縮圖區永遠是一整頁的高度，頁碼位置不會跳動
    while (grid.children.length < 6) grid.append(el("div.vn_cg_item.blank", {}, el("div.thumb"), el("div.nm", { text: "　" })));
    const pager = el("div.vn_pager", {},
      tap(el("span.vn_pg_btn" + (page === 0 ? ".off" : ""), { text: "‹" }), () => { if (page > 0) { page--; render(); } }),
      el("span.vn_pg_no", { text: `${page + 1} / ${pages}` }),
      tap(el("span.vn_pg_btn" + (page >= pages - 1 ? ".off" : ""), { text: "›" }), () => { if (page < pages - 1) { page++; render(); } }));
    S.body.innerHTML = ""; S.body.append(grid);
    S.foot.querySelector(".vn_pager")?.remove();
    S.foot.append(pager);                          // 頁碼與翻頁鈕放在底欄，緊接縮圖區下方
    if (DEBUG) {
      const d = el("div.vn_debug", { text: "測試用：" });
      d.append(tap(el("span", { text: "全部解鎖" }), () => { debugUnlock(true); render(); }), "　", tap(el("span", { text: "全部重置" }), () => { debugUnlock(false); render(); }));
      S.body.append(d);
    }
  }
  render();
}
function tryImg(id, ok) { const u = `./assets/cg/${id}.jpg`, im = new Image(); im.onload = () => ok(u); im.src = u; }
function viewCG(it, no) {
  $("#vn_cgview")?.remove();
  const ph = el("span", { text: it.name });
  const img = el("div.img", {}, ph);
  const v = el("div#vn_cgview.vn_overlay", {}, img, el("div.cap", { text: "#" + no + " " + it.name }));
  tryImg(it.id, (u) => { img.style.backgroundImage = `url(${u})`; ph.remove(); });
  tap(v, () => v.remove());
  G.root.append(v);
}
function debugUnlock(on) {
  sf.cgsSeen = {}; sf.endings = {};
  if (on) { story.cgs.normal.forEach((c) => (sf.cgsSeen[c.id] = 1)); story.cgs.ending.forEach((c) => (sf.endings[c.id] = 1)); }
  saveSf();
}

/* =============================================================
   設定
   ============================================================= */
function openConfig() {
  const S = ui.panel("設定");
  const c = cfg();
  let cat = 0;
  function seg(T, label, key, names, onChange) {
    const box = el("span.ctl.vn_seg");
    names.forEach((nm, i) => box.append(tap(el("span" + (c[key] === i ? ".on" : ""), { text: nm }), () => {
      c[key] = i; [...box.children].forEach((x, j) => x.classList.toggle("on", j === i));
      saveSf(); onChange && onChange();
    })));
    T.append(el("div.vn_cfg_row", {}, el("span.lb", { text: label }), box));
  }
  function slider(T, label, key) {
    const val = el("span.val", { text: c[key] });
    const input = el("input", { type: "range", min: 0, max: 100, step: 5, value: c[key] });
    input.addEventListener("input", () => { c[key] = Number(input.value); val.textContent = c[key]; audio.applyVolumes(); });
    input.addEventListener("change", saveSf);
    T.append(el("div.vn_cfg_row", {}, el("span.lb", { text: label }), el("span.ctl", {}, input, val)));
  }
  function render() {
    const nav = el("div.vn_cfg_nav"), main = el("div.vn_cfg_main");
    ["文字", "音效"].forEach((nm, i) => nav.append(tap(el("div.vn_cfg_navitem" + (i === cat ? ".on" : ""), { text: nm }), () => { cat = i; render(); })));
    if (cat === 0) {
      seg(main, "文字顯示速度", "text", ["慢", "普通", "快"]);
      seg(main, "自動播放速度", "auto", ["慢", "普通", "快"]);
      seg(main, "字體大小", "font", ["小", "中", "大"], () => { G.root.style.setProperty("--fs", fontPx() + "px"); G.onResize.forEach((fn) => fn()); });
      const box = el("span.ctl.vn_seg");
      [["開", 1], ["關", 0]].forEach(([nm, v]) => box.append(tap(el("span" + (c.skipRead === v ? ".on" : ""), { text: nm }), () => {
        c.skipRead = v; [...box.children].forEach((x) => x.classList.toggle("on", x.textContent === nm)); saveSf();
      })));
      main.append(el("div.vn_cfg_row", {}, el("span.lb", { text: "只略過已讀的句子" }), box), el("div.vn_cfg_note", { text: "關閉時，會略過尚未閱讀的句子" }));
    } else {
      slider(main, "背景音樂", "bgm"); slider(main, "語音", "voice"); slider(main, "效果音", "se");
    }
    S.body.innerHTML = ""; S.body.append(el("div.vn_cfg_wrap", {}, nav, main));
  }
  render();
}

/* =============================================================
   章節流程畫面：過渡畫面（章名）、年級結算、劇本修葺中
   ============================================================= */
const yearName = (y) => story.years[y - 1] || (NUM_CN[y] || y) + "年級";

// 過渡畫面：每章開始前顯示章名，約 2.5 秒；點一下可提早結束。回傳 { ready, close }
function showCard(c) {
  $("#vn_card")?.remove();
  const first = c.n === 1;                         // 每個年級第一章：年級名放大
  const e = el("div#vn_card" + (first ? ".first" : ""), {},
    el("div.in", {},
      el("div.small", { text: first ? yearName(c.year) : chapterLabel(c).replace("．", "・") }),
      first ? el("div.sub", { text: "第" + (NUM_CN[c.n] || c.n) + "章" }) : null,
      el("div.rule", {}, el("i")),
      el("div.big", { text: c.title })));
  G.root.append(e);
  let done;
  const ready = new Promise((r) => (done = r));
  const t0 = performance.now(), MIN = 2500;
  setTimeout(done, MIN);
  tap(e, () => { if (performance.now() - t0 > 300) done(); });
  return {
    ready,
    close() { e.classList.add("out"); setTimeout(() => e.remove(), 700); }
  };
}

// 年級結算：這個年級的結局 CG 與標題；按鈕：返回標題、儲思盆、下一個年級開始
function showYearEnd(year, endId, next) {
  $("#vn_end")?.remove();
  const it = story.cgs.ending.find((x) => x.id === endId);
  const img = el("div.cg");
  if (it) { const ph = el("span.ph", { text: it.name }); img.append(ph); tryImg(it.id, (u) => { img.style.backgroundImage = `url(${u})`; ph.remove(); }); }
  else img.classList.add("none");
  if (it) img.querySelector(".ph").textContent = "（CG 準備中）";
  const go = (fn) => () => { e.remove(); fn(); };
  const nextYear = () => { if (next && next.ready && next.year === year + 1) startChapter(next.id); else showUnfinished(); };
  const e = el("div#vn_end.vn_overlay.year", {},
    el("div.vn_endcard", {},
      el("div.small", { text: yearName(year) + "・完" }),
      el("div.rule", {}, el("i")),
      img,
      el("div.big", { text: it ? it.name : "" }),
      el("div.btns", {},
        tap(el("span.vn_end_btn", { "data-a": "home", text: "返回標題" }), go(() => showHome())),
        tap(el("span.vn_end_btn", { "data-a": "pensieve", text: "儲思盆" }), go(() => showHome("chapters"))),
        tap(el("span.vn_end_btn.main", { "data-a": "next", text: (NUM_CN[year + 1] || year + 1) + "年級開始" }), go(nextYear)))));
  G.root.append(e);
}

// 劇本修葺中：下一章（或下一個年級）還沒做好
function showUnfinished() {
  $("#vn_end")?.remove();
  const go = (fn) => () => { e.remove(); fn(); };
  const e = el("div#vn_end.vn_overlay.wip", {},
    el("div.vn_endcard", {},
      el("div.big", { text: "劇本修葺中" }),
      el("div.rule", {}, el("i")),
      el("div.phrase", { text: "後面的故事仍在撰寫中，敬請期待。" }),
      el("div.btns", {},
        tap(el("span.vn_end_btn", { "data-a": "home", text: "返回標題" }), go(() => showHome())),
        tap(el("span.vn_end_btn", { "data-a": "pensieve", text: "儲思盆" }), go(() => showHome("chapters"))))));
  G.root.append(e);
}

/* =============================================================
   工具列動作
   ============================================================= */
ui.handlers.tool = async (act) => {
  if (!P.inGame) return;
  if (act === "auto") setAuto(!P.auto);
  else if (act === "skip") setSkip(!P.skip);
  else if (act === "hide") toggleHide();
  else if (act === "log") { stopAutoSkip(); ui.openLog(); }
  else if (act === "title") {
    stopAutoSkip();
    if (await ui.confirm({ title: "返回標題畫面？", sub: "將從剛才的位置繼續。", ok: "返回標題", cancel: "取消" })) quitToTitle();
  } else openPanel(act);
  syncTools();
};

hooks.card = showCard;
hooks.yearEnd = showYearEnd;
hooks.unfinished = showUnfinished;
hooks.home = () => showHome();
hooks.leaveHome = () => { hideHome(); $("#vn_end")?.remove(); };
