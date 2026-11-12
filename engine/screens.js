/* =============================================================
   screens.js  首頁、存檔／讀檔、儲思盆、圖鑑、設定、過渡畫面、章節完結、年級結算
   ============================================================= */
import { G, $, el, tap, sf, saveSf, db, cfg, fontPx, story, chapterById, chapterLabel, NUM_CN, DEBUG } from "./core.js";
import * as ui from "./ui.js";
import * as audio from "./audio.js";
import { sealHtml, LOCK_HTML, decorateRange, cardFrameHtml, CARD_STAR, cardRuleHtml, cardMotes } from "./deco.js";
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
          el("div.hd", {}, el("span.no", { text: label }), el("span.tm", { text: meta.time }), del),   // 刪除鈕放在標題列右側，有存檔的格子不會比空格高
          el("div.ch", { text: shortChapter(meta) }),
          note ? el("div.old", { text: note }) : null,
          el("div.ln", { text: meta.line })));
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
  const CH_SLOTS = 12;   // 每個年級暫定 12 章：沒做好的顯示上鎖格
  function render() {
    const multi = story.years.length > 1;
    S.tabs.innerHTML = "";
    S.tabs.append(el("div.vn_year", {},
      tap(el("span.vn_year_arrow" + (multi ? "" : ".off"), { text: "‹" }), () => { if (multi) { yi = (yi + story.years.length - 1) % story.years.length; render(); } }),
      el("span.vn_year_name", { text: story.years[yi] }),
      tap(el("span.vn_year_arrow" + (multi ? "" : ".off"), { text: "›" }), () => { if (multi) { yi = (yi + 1) % story.years.length; render(); } })));
    const list = el("div.vn_ch_list");
    const chs = story.chapters.filter((c) => c.year === yi + 1);
    for (let i = 0, n = Math.max(CH_SLOTS, chs.length); i < n; i++) {
      const c = chs[i];
      const open = !!(c && c.ready && sf.unlocked[c.id]);
      if (!open) { list.append(el("div.vn_ch_row.locked", {}, el("span.lock", { html: LOCK_HTML }))); continue; }
      const row = el("div.vn_ch_row", {}, el("span.no", { text: "第" + NUM_CN[c.n] + "章" }), el("span.nm", { text: c.title }), sf.done && sf.done[c.id] ? el("span.done", { "aria-label": "已讀", html: sealHtml() }) : null);
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
  const cats = [{ name: "一般 CG", list: story.cgs.normal, flag: "cgsSeen", base: 0 }, { name: "結局 CG", list: story.cgs.ending, flag: "endings", base: 900 }];   // 結局 CG 編號從 #901 起算
  let cat = 0, page = 0;
  function render() {
    tabs(S, cats.map((c) => c.name), cat, (i) => { cat = i; page = 0; render(); });
    const C = cats[cat], pages = Math.max(1, Math.ceil(C.list.length / 6));
    page = Math.min(page, pages - 1);
    const grid = el("div.vn_cg_grid");
    C.list.slice(page * 6, page * 6 + 6).forEach((it, ix) => {
      const no = C.base + page * 6 + ix + 1, got = !!(sf[C.flag] && sf[C.flag][it.id]);
      const th = el("div.thumb");
      if (got) { const ph = el("span.ph", { text: it.name }); th.append(ph); tryImg(it.id, (u) => { th.style.backgroundImage = `url(${u})`; th.style.backgroundPosition = cgPos(it.id); ph.remove(); }); }
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
      tap(el("span.vn_pg_btn" + (page >= pages - 1 ? ".off" : ""), { text: "›" }), () => { if (page < pages - 1) { page++; render(); } }),
      el("span.vn_pg_dots", { html: Array.from({ length: pages }, (_, i) => `<i${i === page ? ' class="on"' : ""}></i>`).join("") }));
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
// 圖鑑與年級結算的 CG 縮圖：載入成功後套上圖檔與焦點（story.js cgs 的 pos）
function tryImg(id, ok) { const u = `./assets/cg/${id}.webp`, im = new Image(); im.onload = () => ok(u); im.src = u; }
function cgPos(id) { const c = [...story.cgs.normal, ...story.cgs.ending].find((x) => x.id === id); return (c && c.pos) || "50% 50%"; }
function viewCG(it, no) {
  $("#vn_cgview")?.remove();
  const ph = el("span", { text: it.name });
  const img = el("div.img", {}, ph);
  const v = el("div#vn_cgview.vn_overlay", {}, img, el("div.cap", { text: "#" + no + " " + it.name }));
  tryImg(it.id, (u) => { img.style.backgroundImage = `url(${u})`; img.style.backgroundPosition = cgPos(it.id); ph.remove(); });
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
    const input = el("input", { type: "range", min: 0, max: 100, step: 1, value: c[key] });
    input.addEventListener("input", () => { c[key] = Number(input.value); val.textContent = c[key]; audio.applyVolumes(); });
    input.addEventListener("change", saveSf);
    T.append(el("div.vn_cfg_row", {}, el("span.lb", { text: label }), el("span.ctl", {}, decorateRange(input), val)));
  }
  function render() {
    // 文字與音效放在同一頁
    const main = el("div.vn_cfg_main");
    seg(main, "文字顯示速度", "text", ["慢", "普通", "快"]);
    seg(main, "自動播放速度", "auto", ["慢", "普通", "快"]);
    const box = el("span.ctl.vn_seg");
    [["開", 1], ["關", 0]].forEach(([nm, v]) => box.append(tap(el("span" + (c.skipRead === v ? ".on" : ""), { text: nm }), () => {
      c.skipRead = v; [...box.children].forEach((x) => x.classList.toggle("on", x.textContent === nm)); saveSf();
    })));
    main.append(el("div.vn_cfg_row", {}, el("span.lb", { text: "只略過已讀的句子" }), box), el("div.vn_cfg_note", { text: "關閉時，會略過尚未閱讀的句子" }));
    slider(main, "背景音樂", "bgm"); slider(main, "語音", "voice"); slider(main, "效果音", "se");
    S.body.innerHTML = ""; S.body.append(el("div.vn_cfg_wrap", {}, main));
  }
  render();
}

/* =============================================================
   章節流程畫面：過渡畫面（章名）、章節完結、年級結算
   ============================================================= */
const yearName = (y) => story.years[y - 1] || (NUM_CN[y] || y) + "年級";

// 過渡畫面：每章開始前顯示章名，約 2.5 秒；點一下可提早結束。回傳 { ready, close }
function showCard(c) {
  $("#vn_card")?.remove();
  const first = c.n === 1;                         // 每個年級第一章：年級名放大
  const e = el("div#vn_card" + (first ? ".first" : ""), {},
    el("div.deco", { html: starSky(G.L.w, G.L.h, SKY_GOLD) + cardFrameHtml(G.L.w, G.L.h) + cardMotes() }),
    el("div.in", {},
      el("div.star", { html: CARD_STAR }),
      el("div.small", { text: first ? yearName(c.year) : chapterLabel(c).replace("．", "・") }),
      first ? el("div.sub", { text: "第" + (NUM_CN[c.n] || c.n) + "章" }) : null,
      el("div.rule2", { html: cardRuleHtml(true) }),
      el("div.big", { text: c.title }),
      el("div.rule2.under", { html: cardRuleHtml(false) })));
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

/* ---------- 章節完結、年級結算：藍色星空（v0.4.7）---------- */
// 星空：上深下淺的漸層＋藍白星點（部分閃爍）＋四芒小星；不用 CSS 模糊（iPhone 會出黑框）
const SKY_BLUE = { dot: ["#cfe0ff", "#a9c6ff", "#ffffff"], spark: ["#e4eeff", "#bcd4ff"] };
const SKY_GOLD = { dot: ["#f6e6bc", "#e8cf8a", "#fff8e8"], spark: ["#fff4d0", "#f0d99a"] };   // 章名畫面：配合墨綠底與金框
function starSky(W, H, pal = SKY_BLUE) {
  const R = Math.random;
  let s = `<svg class="sky" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
  for (let i = 0; i < 520; i++) {
    const x = R() * W, y = R() * H, r = R() < 0.9 ? R() * 0.9 + 0.3 : R() * 1.4 + 1, c = R() < 0.55 ? pal.dot[0] : (R() < 0.5 ? pal.dot[1] : pal.dot[2]);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${c}" opacity="${(R() * 0.6 + 0.3).toFixed(2)}"${R() < 0.25 ? ` class="tw" style="animation-delay:${(-R() * 3).toFixed(1)}s"` : ""}/>`;
  }
  for (let i = 0; i < 26; i++) {
    const x = R() * W, y = R() * H, k = R() * 7 + 4, q = k * 0.18;
    s += `<path class="tw" style="animation-delay:${(-R() * 3).toFixed(1)}s" transform="translate(${x.toFixed(0)} ${y.toFixed(0)})" d="M0 ${-k}L${q} ${-q} ${k} 0 ${q} ${q} 0 ${k} ${-q} ${q} ${-k} 0 ${-q} ${-q}z" fill="${R() < 0.5 ? pal.spark[0] : pal.spark[1]}"/>`;
  }
  return s + "</svg>";
}
const SE_DEFS = `<svg class="se_defs" width="0" height="0" aria-hidden="true"><defs>
  <linearGradient id="seNavy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(40,64,120,.78)"/><stop offset="1" stop-color="rgba(10,20,48,.88)"/></linearGradient>
  <linearGradient id="seIce" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f1ff"/><stop offset=".5" stop-color="#b4d0f6"/><stop offset="1" stop-color="#86a9dc"/></linearGradient></defs></svg>`;
const SE_IC = {
  home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  pensieve: '<path d="M3 10h18c0 5-4 8-9 8s-9-3-9-8zM8 21h8M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 7c1-2 5-2 6 0" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  next: '<path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
};
function seBtn(act, label, fn, mode) {           // mode：""（深藍）、"main"（淺藍，可按的下一章）、"off"（鎖住）
  const fill = mode === "main" ? "url(#seIce)" : mode === "off" ? "rgba(20,30,60,.5)" : "url(#seNavy)";
  const stroke = mode === "main" ? "#eef5ff" : mode === "off" ? "rgba(170,180,210,.35)" : "#d9b86a";
  const halo = mode === "main" ? `<path d="M16 1H194L209 31 194 61H16L1 31z" fill="none" stroke="rgba(170,205,255,.45)" stroke-width="7"/>` : "";
  const ic = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${SE_IC[mode === "off" ? "lock" : act]}</svg>`;
  const b = el("div.se_btn" + (mode ? "." + mode : ""), { "data-a": act, html:
    `<svg class="bg" viewBox="0 0 210 62" preserveAspectRatio="none" aria-hidden="true">${halo}<path d="M16 1H194L209 31 194 61H16L1 31z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M20 5H190L203 31 190 57H20L7 31z" fill="none" stroke="${stroke}" stroke-width=".7" opacity=".5"/><path class="hl" d="M16 1H194L209 31 194 61H16L1 31z" fill="#fff"/></svg>` +
    (act === "next" && mode !== "off" ? `<span>${label}</span>${ic}` : `${ic}<span>${label}</span>`) + (mode === "off" ? `<em class="note">劇本修葺中</em>` : "") });
  if (mode !== "off") tap(b, fn);
  return b;
}
function starScreen(kind, inner, nextOk, onNext) {
  $("#vn_end")?.remove();
  const go = (fn) => () => { e.remove(); fn(); };
  const e = el("div#vn_end." + kind, {},
    el("div.deco", { html: SE_DEFS + starSky(G.L.w, G.L.h) + cardFrameHtml(G.L.w, G.L.h) }),
    el("div.in", {}, ...inner,
      el("div.btns", {},
        seBtn("home", "返回標題", go(() => showHome())),
        seBtn("pensieve", "儲思盆", go(() => showHome("chapters"))),
        seBtn("next", "下一章", go(onNext), nextOk ? "main" : "off"))));
  G.root.append(e);
}

// 章節完結：年級、章號、章名、完結；下一章沒做好時鎖住。年級最後一章的「下一章」進入年級結算
function showChapterEnd(c, next, toYearEnd) {
  const nextOk = toYearEnd ? true : !!(next && next.ready);
  starScreen("chend", [
    el("div.star", { html: CARD_STAR }),
    el("div.yr", { text: yearName(c.year) }),
    el("div.chn", { text: "第" + (NUM_CN[c.n] || c.n) + "章" }),
    el("div.rl", { html: cardRuleHtml(true) }),
    el("div.ttl", { text: c.title }),
    el("div.rl", { html: cardRuleHtml(false) }),
    el("div.fin", {}, el("i"), el("span", { text: "完結" }), el("i"))
  ], nextOk, toYearEnd || (() => startChapter(next.id)));
}

// 年級結算：這個年級的結局 CG、結局標題、結局語句；下一章＝下一個年級的第一章
function showYearEnd(year, endId, next) {
  const it = story.cgs.ending.find((x) => x.id === endId);
  const img = el("div.cg", {}, el("span.ph", { text: "（CG 準備中）" }));
  if (it) tryImg(it.id, (u) => { img.style.backgroundImage = `url(${u})`; img.style.backgroundPosition = cgPos(it.id); img.textContent = ""; });
  // 結局名稱「True End：綠色的學院盃」→ 小標「True End」＋大標「綠色的學院盃」；沒有前綴時小標用「結局」
  const full = it ? it.name.replace(/^結局：/, "") : "（待定）";
  const mm = it && it.name.match(/^(.+?)：(.+)$/);
  const tag = mm && mm[1] !== "結局" ? mm[1] : "結局", name = mm ? mm[2] : full;
  starScreen("yrend", [
    el("div.head", { html: CARD_STAR }, el("span", { text: yearName(year) + "　完結" }), el("span.s2", { html: CARD_STAR })),
    el("div.mid", {}, img,
      el("div.txt", {},
        el("div.etag", { text: tag }),
        el("div.ettl", { text: name }),
        el("div.rl", { html: cardRuleHtml(false) }),
        el("div.eline", { text: (it && it.line) || "" })))
  ], !!(next && next.ready && next.year === year + 1), () => startChapter(next.id));
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
hooks.chapterEnd = showChapterEnd;
hooks.home = () => showHome();
hooks.leaveHome = () => { hideHome(); $("#vn_end")?.remove(); };
