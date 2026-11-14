/* =============================================================
   player.js  播放器：執行劇本指令、自動／略過、存檔快照、章節流程
   狀態（state）是一個普通物件，存檔就是把它複製一份：
     { ch, f: {bond, 旗標…}, stage: {bg, charas, bgm}, scene, sceneF, chstart }
   每句台詞（與每個選項）開始時拍一份快照 snap，存檔、自動存檔都用它，
   所以任何時候存檔（打字中、換場中）讀回來都會從這一句重新顯示。
   自動存檔：每句寫入一次（略過期間暫停，略過停下時補寫）。
   ============================================================= */
import { G, sf, saveSf, db, clone, cfg, readMark, chapterById, outfitOf, TEXT_SPEED, AUTO_SPEED, SAVE_FORMAT, DEBUG, story, sleep } from "./core.js";
import { parseScript, evalCond } from "./parser.js";
import * as stage from "./stage.js";
import * as audio from "./audio.js";
import * as ui from "./ui.js";

export const P = {
  script: null,          // 解析後的劇本 {cmds, labels, scenes, sig}
  state: null,
  pc: 0,
  snap: null,            // 最近一句開始時的快照
  token: 0,              // 每次跳章／讀檔加一；舊的執行迴圈看到不同就停
  running: false,
  auto: false,
  skip: false,
  waiting: null,         // 等待點擊時的 resolve
  autoPending: false,    // 略過期間沒寫的自動存檔，略過停下時補寫
  inGame: false
};
export const hooks = {};  // 由 screens.js 填入：card(chapter) 過渡畫面、chapterEnd(chapter, next, toYearEnd)、yearEnd(year, endingId, next)、terminal(chapter, ending, rewind)、home()、leaveHome()

/* ---------- 劇本載入（同一章只抓一次）---------- */
const cache = {};
export async function loadScript(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(`./story/${id}.txt`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`找不到劇本 story/${id}.txt`);
  const src = await res.text();
  const r = parseScript(src, { characters: story.characters, speakers: Object.keys(story.speakers) });
  if (r.errors.length) {
    console.error(`劇本 ${id} 有錯誤`, r.errors);
    if (DEBUG) ui.toast(`劇本 ${id} 有 ${r.errors.length} 個錯誤（見主控台）`);
  }
  r.chars = [...new Set(src)].filter((ch) => ch > "~").join("");   // 這一章用到的字（預載字體用）
  cache[id] = r;
  return r;
}

// 先把一章用到的字所在的字體分片下載好，出字時才不會先用系統字體再換回來（最多等 3 秒）
export async function loadFonts(r) {
  if (!r || r.fontsOk || !document.fonts) return;
  const t = r.chars + "，。「」？！…—";
  try {
    await Promise.race([
      Promise.all([document.fonts.load('400 28px "VN Serif"', t), document.fonts.load('700 28px "VN Serif"', t)]),
      sleep(3000)
    ]);
  } catch (e) {}
  r.fontsOk = true;
}

// 預先下載一章的劇本與第一張背景（停在首頁時呼叫，按下開始後就不用等網路）
export async function preloadChapter(id) {
  try {
    const c = chapterById(id); if (!c || !c.ready) return;
    const s = await loadScript(id);
    const b = s.cmds.find((x) => x.op === "bg");
    if (b) new Image().src = stage.bgUrl(b.name);
    loadFonts(s);
  } catch (e) {}
}

/* ---------- 數值 ---------- */
function applyFx(fx) {
  const f = P.state.f;
  for (const e of fx) {
    if (e.op === "add") f[e.k] = (Number(f[e.k]) || 0) + e.v; else f[e.k] = e.v;
    const rg = story.flagRange[e.k];
    if (rg) f[e.k] = Math.max(rg[0], Math.min(rg[1], Number(f[e.k])));
  }
  if (DEBUG) console.log("[數值]", JSON.stringify(f));
}
function freshFlags(from) {
  const f = clone(story.initialFlags);
  if (from) Object.assign(f, clone(from));
  for (const k in story.flagRange) if (f[k] !== undefined) { const r = story.flagRange[k]; f[k] = Math.max(r[0], Math.min(r[1], Number(f[k]))); }
  return f;
}

/* ---------- 自動／略過 ---------- */
export function setAuto(on) { P.auto = !!on; if (on) P.skip = false; syncTools(); }
export function setSkip(on) { P.skip = !!on; if (on) { P.auto = false; ui.finishTyping(); } else flushAutosave(); syncTools(); }
export function stopAutoSkip() { P.auto = P.skip = false; flushAutosave(); syncTools(); }
export function syncTools() { ui.toolbarState({ auto: P.auto, skip: P.skip, hide: ui.isHidden() }); ui.toolbarOff({ rewind: !rewindTarget() }); }

/* ---------- 回溯（只退一步）----------
   台詞中：回到最近一次選擇；停在選項上：回到前一個選擇（選項快照裡帶著的 lc）。
   回溯到的快照不帶 lc，所以要再做一次選擇才能再回溯；每章開始時清空，不會退回上一章。 */
export function rewindTarget() {
  if (!P.inGame) return null;
  if (P.atChoice) return (P.snap && P.snap.lc) || null;
  return P.lastChoice || null;
}
export async function rewind() {
  const t = rewindTarget();
  if (!t) return false;
  return loadSnap(clone(t));
}

// 玩家點擊／Enter／滾輪向下
export function advance() {
  if (!P.inGame) return;
  if (ui.isHidden()) { ui.setHidden(false); syncTools(); return; }      // 隱藏中：先叫回對話框
  if (ui.choicesOpen()) return;
  if (P.auto || P.skip) { stopAutoSkip(); return; }                      // 自動／略過中點一下：只停止，不前進
  if (ui.isTyping()) { ui.finishTyping(); return; }
  if (P.waiting) { const w = P.waiting; P.waiting = null; w(); }
}
export function toggleHide() {
  if (!P.inGame || ui.choicesOpen()) return;
  ui.setHidden(!ui.isHidden());
  syncTools();
}

/* ---------- 執行迴圈 ---------- */
const fast = () => P.skip;
const dur = (ms) => (fast() ? 0 : ms);

async function run(token) {
  P.running = true;
  while (token === P.token) {
    const c = P.script.cmds[P.pc];
    if (!c) break;
    const next = await exec(c, token);
    if (token !== P.token) return;
    if (next === "stop") break;
    P.pc = typeof next === "number" ? next : P.pc + 1;
  }
  if (token === P.token) P.running = false;
}

function capture(idx, line) {
  const s = P.state;
  P.snap = { fmt: SAVE_FORMAT, sig: P.script.sig, pc: idx, ch: s.ch, f: clone(s.f), stage: clone(s.stage), scene: s.scene, sceneF: clone(s.sceneF), chstart: clone(s.chstart), line: line || null, fp: fingerprint(P.script, idx, s.scene),
    lc: P.lastChoice || null };   // 最近一次選擇的快照：手動存檔、自動存檔都帶著，讀檔後照樣能「回到上一個選擇」
}
// 終結結局用：每次進入 @choice 記下當時的狀態（只留最近一次）
const noLc = (snap) => { const x = clone(snap); delete x.lc; return x; };

/* ---------- 精準定位：劇本改過時，在新劇本裡找回存檔那一句 ----------
   指紋 fp = { scene, op, key（這句文字／這組選項文字）, nth（場景內第幾次出現）, prev（前面最多 3 句） }
   prev 只收「到存檔點之間沒有改數值、選項、分支」的句子，所以退回這幾句重看時，數值不會被重複計算。 */
const keyOf = (c) => (c.op === "text" ? c.text : c.op === "choice" ? c.opts.map((o) => o.text).join("|") : "");
const BARRIER = ["fx", "choice", "jf", "j", "jump", "scene", "end"];
function sceneRange(script, scene) {
  let start = 0;
  if (scene) { start = script.scenes[scene]; if (start === undefined) return null; }
  let end = script.cmds.length;
  for (const id in script.scenes) { const v = script.scenes[id]; if (v > start && v < end) end = v; }
  return [start, end];
}
function prevLines(cmds, idx, start) {
  const out = [];
  for (let i = idx - 1; i > start && out.length < 3; i--) {
    if (BARRIER.includes(cmds[i].op)) break;
    if (cmds[i].op === "text") out.push(cmds[i].text);
  }
  return out;
}
function fingerprint(script, idx, scene) {
  const c = script.cmds[idx], r = sceneRange(script, scene);
  if (!c || !r) return null;
  const key = keyOf(c);
  let nth = 0;
  for (let i = r[0]; i < idx; i++) if (script.cmds[i].op === c.op && keyOf(script.cmds[i]) === key) nth++;
  return { scene: scene || "", op: c.op, key, nth, prev: prevLines(script.cmds, idx, r[0]) };
}
// 回傳 { pc, how: "exact" | "near" }，找不到回傳 null
export function relocate(script, fp) {
  if (!fp) return null;
  const r = sceneRange(script, fp.scene);
  if (!r) return null;
  const cmds = script.cmds, [start, end] = r;
  const cands = [];
  for (let i = start; i < end; i++) if (cmds[i].op === fp.op && keyOf(cmds[i]) === fp.key) cands.push(i);
  if (cands.length === 1) return { pc: cands[0], how: "exact" };
  if (cands.length > 1) {                          // 同一場景出現好幾次（例如「……」）：用前面幾句比對，再不行用第幾次出現
    const score = (i) => { const p = prevLines(cmds, i, start); return fp.prev.filter((x, k) => p[k] === x).length; };
    const best = Math.max(...cands.map(score));
    const top = cands.filter((i) => score(i) === best);
    return { pc: top.length === 1 ? top[0] : (top[fp.nth] ?? top[0]), how: "exact" };
  }
  for (const p of fp.prev) {                       // 這句本身被改寫了：回到最近一句沒改過的句子
    const m = [];
    for (let i = start; i < end; i++) if (cmds[i].op === "text" && cmds[i].text === p) m.push(i);
    if (m.length === 1) return { pc: m[0], how: "near" };
  }
  return null;
}

async function exec(c, token) {
  const s = P.state, st = s.stage;
  switch (c.op) {
    case "text": {
      const idx = P.pc;
      capture(idx, { speaker: c.speaker, text: c.text });
      if (P.skip) P.autoPending = true; else commitAutosave();          // 每句寫入自動存檔（略過期間先記著，停下時補寫）
      const read = readMark(s.ch, c.text);
      if (!read && P.skip && cfg().skipRead) {                          // 遇到未讀的句子：停止略過，並提示原因
        setSkip(false);
        if (!ui.isHidden()) ui.toast("※ 未讀句子不會略過，可在設定更改");
      }
      ui.pushLog(c.speaker, c.text);
      stage.focus(st, c.speaker && c.speaker.id);
      await ui.showLine(c.speaker, c.text, P.skip ? 0 : TEXT_SPEED[cfg().text]);
      if (token !== P.token) return "stop";
      const nx = P.script.cmds[idx + 1];
      if (nx && nx.op === "choice") return;                              // 選項前的最後一句：打完字直接出選項
      await waitAdvance(c.text, token);
      return;
    }
    case "choice": {
      capture(P.pc, ui.currentLine());
      P.lastChoice = noLc(P.snap);
      P.atChoice = true;
      stopAutoSkip();                                                    // （同時更新「回溯」按鈕）
      commitAutosave();                                                  // 進入選項：寫入自動存檔
      saveSf();
      const i = await ui.showChoices(c.opts, c.title);
      if (token !== P.token) return "stop";
      P.atChoice = false;
      const o = c.opts[i];
      applyFx(o.fx);
      syncTools();
      ui.clearLine();
      return P.script.labels[o.target];
    }
    case "scene":
      s.scene = c.id; s.sceneF = clone(s.f);
      stage.setTag(st, "");                                              // 進入新場景：角標自動收起
      await stage.hideCg(st, 0);
      await stage.hideAll(st, 0);
      return;
    case "showcg":                                                       // 劇情中顯示 CG，同時解鎖圖鑑
      sf.cgsSeen = sf.cgsSeen || {}; sf.cgsSeen[c.id] = 1; saveSf();
      ui.quillOff(); await stage.showCg(st, c.id, dur(c.fade)); return;
    case "hidecg": await stage.hideCg(st, dur(c.fade)); return;
    case "bg": ui.quillOff(); await stage.setBg(st, c.name, dur(c.fade)); return;
    case "show": await stage.show(st, c.id, c.face, c.slot, dur(c.fade), outfitOf(s.f, c.id)); return;
    case "outfit": s.f["outfit_" + c.id] = c.outfit; stage.setOutfit(st, c.id, c.outfit); return;   // 換裝：之後一直沿用（跨場景、跨章節）
    case "face": stage.setFace(st, c.id, c.face, dur(150)); return;   // 換表情 0.15 秒交叉淡化
    case "hide": await stage.hide(st, c.id, dur(c.fade)); return;
    case "hideall": await stage.hideAll(st, dur(c.fade)); return;
    case "wait": if (!fast()) await sleep(c.ms); return;
    case "bgm": st.bgm = c.name; audio.playBgm(c.name, c.fade, c.vol); return;
    case "se": if (!fast()) audio.playSe(c.name, c.vol); return;
    case "voice": if (!fast()) audio.playVoice(c.name, c.vol); return;
    case "fx": applyFx(c.fx); return;
    case "jump": return P.script.labels[c.target];
    case "jf": {
      const r = evalCond(c.cond, s.f);
      if (DEBUG) (window.VN_TRACE = window.VN_TRACE || []).push({ ch: s.ch, line: c.line, r, f: clone(s.f) });   // 測試模式：記下每個條件判斷的結果
      return r ? undefined : c.to;
    }
    case "j": return c.to;
    case "unlock": {
      const key = c.kind === "ending" ? "endings" : "cgsSeen";
      sf[key] = sf[key] || {}; sf[key][c.id] = 1; saveSf();
      if (c.kind === "ending") {
        const it = story.cgs.ending.find((x) => x.id === c.id);
        if (it && it.terminal) { await terminal(it); return "stop"; }   // 終結結局：故事在這裡結束，後面的 @jump 不再執行
        const ch = chapterById(s.ch); if (ch) s.f["end_y" + ch.year] = c.id;   // 年級結算頁顯示這一輪的結局
      }
      return;
    }
    case "hint": ui.toast(c.text); return;
    case "tag": stage.setTag(st, c.text); return;                        // 左上角角標（文字存在 stage.tag，存檔會一起記下）
    case "end": endChapter(); return "stop";
  }
}

// 等玩家點擊；自動／略過時時間到就自己前進。有視窗開著或對話框隱藏時暫停計時。
function waitAdvance(text, token) {
  return new Promise((resolve) => {
    P.waiting = resolve;
    let waited = 0, last = Date.now();
    const autoMs = () => AUTO_SPEED[cfg().auto] + Array.from(text).length * 30;
    const loop = () => {
      if (token !== P.token || P.waiting !== resolve) return;
      const now = Date.now();
      if (!ui.overlayOpen() && !ui.isHidden()) waited += now - last;
      last = now;
      if ((P.skip && waited >= 40) || (P.auto && waited >= autoMs())) { P.waiting = null; resolve(); return; }
      setTimeout(loop, 40);
    };
    setTimeout(loop, 40);
  });
}

/* ---------- 進入遊戲畫面 / 離開 ---------- */
function enterGame() {
  P.inGame = true;
  ui.toolbarOn(true); ui.hitOn(true); ui.setHidden(false);
  syncTools();
}
export function leaveGame() {
  stopAutoSkip();                                  // 略過中離開：先補寫自動存檔
  P.token++; P.waiting = null; P.inGame = false; P.atChoice = false;
  ui.hideChoices(); ui.clearLine(); ui.msgVisible(false);
  ui.toolbarOn(false); ui.hitOn(false);
  audio.stopAll();
  saveSf();
}

/* ---------- 開始一章 ----------
   opt.fresh：新遊戲（數值歸零）
   沒有 fresh：從儲思盆／下一章進入，用「最近一次抵達這一章」時的數值 */
export async function startChapter(id, opt = {}) {
  const c = chapterById(id);
  if (!c || !c.ready) { ui.toast("這一章還在製作中"); return; }
  leaveGame();
  ui.closeOverlays();
  const card = hooks.card ? hooks.card(c) : null;  // 過渡畫面（章名），先蓋住畫面，再在後面準備場景
  hooks.leaveHome && hooks.leaveHome();
  const token = P.token;
  let script;
  try { script = await loadScript(id); } catch (e) { card && card.close(); ui.toast("讀取劇本失敗"); hooks.home && hooks.home(); return; }
  await loadFonts(script);
  if (card) await card.ready;
  if (token !== P.token) return;
  sf.chStart = sf.chStart || {}; sf.unlocked = sf.unlocked || {};
  const f = freshFlags(opt.fresh ? null : sf.chStart[id]);
  P.script = script;
  P.state = { ch: id, f, stage: { bg: "", charas: [], bgm: "" }, scene: "", sceneF: clone(f), chstart: clone(f) };
  P.lastChoice = null;
  // 抵達這一章：記下當時的數值（儲思盆用，每次抵達都更新）與時間線位置
  sf.unlocked[id] = 1;
  sf.chStart[id] = clone(f);
  sf.head = c.n;
  delete sf.cont; delete sf.endScr;
  await clearAutosave();
  saveSf();
  ui.resetLog();
  await stage.rebuild(P.state.stage);
  P.pc = 0;
  card && card.close();
  enterGame();
  run(token);
}

/* ---------- 終結結局 ----------
   不解鎖下一章、不寫年級結局旗標、不改儲思盆的進度；自動存檔改回觸發終結的那個選擇，
   之後不論「回到上一個選擇」、返回標題或直接關掉網頁，「繼續」都會回到那個選擇前。 */
async function terminal(it) {
  const s = P.state, c = chapterById(s.ch), back = P.lastChoice ? clone(P.lastChoice) : null;
  stopAutoSkip();
  P.autoPending = false;
  if (back) { await db.put("snap", "auto", back); sf.auto = { fmt: SAVE_FORMAT }; } else await clearAutosave();
  delete sf.cont;
  sf.endScr = { k: "term", ch: s.ch, id: it.id };   // 離開後「繼續」重開終結畫面
  saveSf();
  leaveGame();
  openEndScreen(sf.endScr, back);
}

/* ---------- 章節結束 ---------- */
function endChapter() {
  const s = P.state, id = s.ch;
  const i = story.chapters.findIndex((c) => c.id === id), next = story.chapters[i + 1];
  if (DEBUG) console.log("[章節結束] 羈絆", s.f.bond);
  P.autoPending = false;   // 章節已完成：之後由完結畫面接手「繼續」
  sf.done = sf.done || {}; sf.unlocked = sf.unlocked || {}; sf.chStart = sf.chStart || {};
  sf.done[id] = 1;
  // 不論下一章做好了沒有，都記下通關時的數值並解鎖；之後章節上線，儲思盆就能直接進入
  if (next) { sf.unlocked[next.id] = 1; sf.chStart[next.id] = clone(s.f); sf.head = next.n; }
  // 「繼續」：重開章節完結畫面（進入年級結算後改為年級結算畫面），直到開始玩下一句為止
  delete sf.cont;
  const c = chapterById(id);
  sf.endScr = { k: "ch", ch: id, end: s.f["end_y" + c.year] || null };
  saveSf();
  leaveGame();
  openEndScreen(sf.endScr);
}

/* ---------- 完結／結算／終結畫面：完成時與「繼續」重開時共用 ----------
   e：{ k: "ch"|"yr"|"term", ch, end?, id? }；back：終結當下觸發的選擇快照（重開時改讀自動存檔） */
function openEndScreen(e, back) {
  const c = chapterById(e.ch);
  if (!c) return false;
  const i = story.chapters.findIndex((x) => x.id === e.ch), next = story.chapters[i + 1];
  if (e.k === "term") {
    const it = story.cgs.ending.find((x) => x.id === e.id);
    if (!it) return false;
    const rewind = async () => {
      const snap = back ? clone(back) : await db.get("snap", "auto");
      if (!snap || !(await loadSnap(snap))) startChapter(e.ch);
    };
    hooks.terminal && hooks.terminal(c, it, rewind);
    return true;
  }
  const toYear = () => { sf.endScr = { k: "yr", ch: e.ch, end: e.end }; saveSf(); hooks.yearEnd && hooks.yearEnd(c.year, e.end, next); };
  if (e.k === "yr") { toYear(); return true; }
  // 一律先出章節完結畫面；年級最後一章按「下一章」進入年級結算
  const lastOfYear = !next || next.year !== c.year;
  hooks.chapterEnd && hooks.chapterEnd(c, next, lastOfYear ? toYear : null);
  return true;
}

/* ---------- 自動存檔 ---------- */
async function commitAutosave() {
  if (!P.snap || !P.inGame) return;
  P.autoPending = false;
  const snap = clone(P.snap);
  const ok = await db.put("snap", "auto", snap);
  // 系統變數只在狀態改變時才寫（避免每句都重寫整份已讀記錄）
  if (!ok) return;
  // 寫入期間若已到了完結／終結畫面（已離開遊戲），不可清掉剛記下的畫面
  const clr = P.inGame && (sf.cont || sf.endScr);
  if (!sf.auto || sf.auto.fmt !== SAVE_FORMAT || clr) { sf.auto = { fmt: SAVE_FORMAT }; if (clr) { delete sf.cont; delete sf.endScr; } saveSf(); }
}
function flushAutosave() { if (P.autoPending) commitAutosave(); }
async function clearAutosave() { delete sf.auto; await db.del("snap", "auto"); }
export function hasContinue() {
  if (sf.endScr && chapterById(sf.endScr.ch)) return true;
  if (sf.cont) { const c = chapterById(sf.cont); if (c && c.ready) return true; }
  return !!(sf.auto && sf.auto.fmt === SAVE_FORMAT);
}
export async function doContinue() {
  if (sf.endScr) { hooks.leaveHome && hooks.leaveHome(); if (openEndScreen(sf.endScr)) return; delete sf.endScr; saveSf(); hooks.home && hooks.home(); return; }
  if (sf.cont) { const c = chapterById(sf.cont); if (c && c.ready) return startChapter(c.id); }
  const snap = await db.get("snap", "auto");
  if (snap) return loadSnap(snap);
}

/* ---------- 手動存檔：回傳要存的資料（沒有可存的位置時回傳 null）---------- */
export async function makeSave() {
  if (!P.inGame || !P.snap) return null;
  const snap = clone(P.snap);
  const c = chapterById(snap.ch);
  const th = await stage.thumbnail(snap.stage);
  const line = snap.line ? snap.line.text : "";
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const meta = {
    fmt: SAVE_FORMAT, sig: snap.sig, fp: snap.fp, ch: snap.ch, chTitle: c ? c.title : "",
    time: `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
    line: line.replace(/\s+/g, " ").slice(0, 40)
  };
  if (th) { meta.thumb = th.url; meta.tw = th.w; meta.th = th.h; }
  return { snap, meta };
}

/* ---------- 讀檔 ----------
   格式不同 → 無法讀取
   劇本結構相同 → 原樣讀取，從存檔那一句重新顯示
   劇本結構改過 → 先用指紋在同一場景找回那一句（或最近一句沒改過的句子），找到就直接讀取；
                   找不到（場景被刪或改名）才退回場景開頭／章節開頭，還原當時的數值 */
// 回傳 "ok"（可原樣或精準讀取）、"changed"（會退回段落開頭）、"old"、"missing"
export async function saveStatus(meta) {
  if (!meta || meta.fmt !== SAVE_FORMAT) return "old";
  const c = chapterById(meta.ch);
  if (!c || !c.ready) return "missing";
  try {
    const sc = await loadScript(meta.ch);
    if (sc.sig === meta.sig || relocate(sc, meta.fp)) return "ok";
    return "changed";
  } catch (e) { return "missing"; }
}

export async function loadSnap(snap) {
  if (!snap || snap.fmt !== SAVE_FORMAT) { await ui.confirm({ title: "無法讀取這個存檔", sub: "這是舊格式的存檔，無法在目前的版本讀取。", ok: "知道了", single: true }); return false; }
  const c = chapterById(snap.ch);
  let script = null;
  try { if (c && c.ready) script = await loadScript(snap.ch); } catch (e) {}
  if (!script) { await ui.confirm({ title: "無法讀取這個存檔", sub: "找不到這個存檔所屬的章節。", ok: "知道了", single: true }); return false; }
  let compat = script.sig !== snap.sig, found = null;
  if (compat) { found = relocate(script, snap.fp); if (found) compat = false; }
  if (compat && !(await ui.confirm({ title: "劇本已更新", sub: "將從該段落開頭繼續。", ok: "繼續", cancel: "取消" }))) return false;

  leaveGame();
  if (sf.endScr) { delete sf.endScr; saveSf(); }   // 讀檔／回到上一個選擇：不再停在完結畫面
  const token = P.token;
  ui.closeOverlays();
  hooks.leaveHome && hooks.leaveHome();
  P.script = script;
  ui.resetLog();
  await loadFonts(script);
  if (token !== P.token) return false;
  if (!compat) {
    P.state = { ch: snap.ch, f: freshFlags(snap.f), stage: clone(snap.stage), scene: snap.scene, sceneF: clone(snap.sceneF), chstart: clone(snap.chstart) };
    P.pc = found ? found.pc : snap.pc;
    if (DEBUG && found) console.log("[精準讀檔]", found.how, "→ 指令", found.pc);
  } else {
    const sceneOk = snap.scene && script.scenes[snap.scene] !== undefined;
    const f = freshFlags(sceneOk ? snap.sceneF : snap.chstart);
    P.state = { ch: snap.ch, f, stage: { bg: "", charas: [], bgm: "" }, scene: "", sceneF: clone(f), chstart: clone(snap.chstart || f) };
    P.pc = sceneOk ? script.scenes[snap.scene] : 0;
  }
  P.snap = null;
  P.lastChoice = snap.lc ? clone(snap.lc) : null;
  await stage.rebuild(P.state.stage);
  if (token !== P.token) return false;
  audio.playBgm(P.state.stage.bgm || "", 600);
  enterGame();
  // 停在選項的存檔：把選項前最後一句補回對話框
  const cmd = P.script.cmds[P.pc];
  if (!compat && cmd && cmd.op === "choice" && snap.line && (!found || found.how === "exact")) { ui.pushLog(snap.line.speaker, snap.line.text); await ui.showLine(snap.line.speaker, snap.line.text, 0); }
  run(token);
  return true;
}

// 返回標題
export function quitToTitle() { leaveGame(); hooks.home && hooks.home(); }

ui.handlers.advance = advance;
ui.handlers.toggleHide = toggleHide;
ui.handlers.inGame = () => P.inGame;
ui.handlers.openLog = () => { stopAutoSkip(); ui.openLog(); };
// 切到背景或關閉頁面時：補寫自動存檔、保存系統變數
document.addEventListener("visibilitychange", () => { if (document.hidden) { flushAutosave(); saveSf(); } });
window.addEventListener("pagehide", () => { flushAutosave(); saveSf(); });
if (DEBUG) window.VN = { P };   // 測試模式：可在主控台檢查狀態
