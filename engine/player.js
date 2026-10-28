/* =============================================================
   player.js  播放器：執行劇本指令、自動／略過、存檔快照、章節流程
   狀態（state）是一個普通物件，存檔就是把它複製一份：
     { ch, f: {bond, 旗標…}, stage: {bg, charas, bgm}, scene, sceneF, chstart }
   每句台詞（與每個選項）開始時拍一份快照 snap，存檔、自動存檔都用它，
   所以任何時候存檔（打字中、換場中）讀回來都會從這一句重新顯示。
   ============================================================= */
import { G, sf, saveSf, db, clone, cfg, readMark, chapterById, TEXT_SPEED, AUTO_SPEED, SAVE_FORMAT, DEBUG, story, sleep } from "./core.js";
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
  autoNext: false,       // 章節第一句要寫入自動存檔
  inGame: false
};
export const hooks = {};  // 由 screens.js 填入：showEnd(chapter)、home()

/* ---------- 劇本載入（同一章只抓一次）---------- */
const cache = {};
export async function loadScript(id) {
  if (cache[id]) return cache[id];
  const res = await fetch(`./story/${id}.txt`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`找不到劇本 story/${id}.txt`);
  const r = parseScript(await res.text(), { characters: story.characters, speakers: Object.keys(story.speakers) });
  if (r.errors.length) {
    console.error(`劇本 ${id} 有錯誤`, r.errors);
    if (DEBUG) ui.toast(`劇本 ${id} 有 ${r.errors.length} 個錯誤（見主控台）`);
  }
  cache[id] = r;
  return r;
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
export function setSkip(on) { P.skip = !!on; if (on) { P.auto = false; ui.finishTyping(); } syncTools(); }
export function stopAutoSkip() { P.auto = P.skip = false; syncTools(); }
export function syncTools() { ui.toolbarState({ auto: P.auto, skip: P.skip, hide: ui.isHidden() }); }

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
  P.snap = { fmt: SAVE_FORMAT, sig: P.script.sig, pc: idx, ch: s.ch, f: clone(s.f), stage: clone(s.stage), scene: s.scene, sceneF: clone(s.sceneF), chstart: clone(s.chstart), line: line || null };
}

async function exec(c, token) {
  const s = P.state, st = s.stage;
  switch (c.op) {
    case "text": {
      const idx = P.pc;
      capture(idx, { speaker: c.speaker, text: c.text });
      if (P.autoNext) { P.autoNext = false; commitAutosave(); }          // 章節第一句：寫入自動存檔
      const read = readMark(s.ch, c.text);
      if (!read && P.skip && cfg().skipRead) setSkip(false);            // 遇到未讀的句子：停止略過
      ui.pushLog(c.speaker, c.text);
      stage.focus(st, c.speaker && c.speaker.id);
      ui.coverOff();
      await ui.showLine(c.speaker, c.text, P.skip ? 0 : TEXT_SPEED[cfg().text]);
      if (token !== P.token) return "stop";
      const nx = P.script.cmds[idx + 1];
      if (nx && nx.op === "choice") return;                              // 選項前的最後一句：打完字直接出選項
      await waitAdvance(c.text, token);
      return;
    }
    case "choice": {
      capture(P.pc, ui.currentLine());
      stopAutoSkip();
      commitAutosave();                                                  // 進入選項：寫入自動存檔
      saveSf();
      const i = await ui.showChoices(c.opts);
      if (token !== P.token) return "stop";
      const o = c.opts[i];
      applyFx(o.fx);
      ui.clearLine();
      return P.script.labels[o.target];
    }
    case "scene":
      s.scene = c.id; s.sceneF = clone(s.f);
      await stage.hideAll(st, 0);
      return;
    case "bg": ui.quillOff(); await stage.setBg(st, c.name, dur(c.fade)); return;
    case "show": await stage.show(st, c.id, c.face, c.slot, dur(c.fade)); return;
    case "face": stage.setFace(st, c.id, c.face); return;
    case "hide": await stage.hide(st, c.id, dur(c.fade)); return;
    case "hideall": await stage.hideAll(st, dur(c.fade)); return;
    case "wait": if (!fast()) await sleep(c.ms); return;
    case "bgm": st.bgm = c.name; audio.playBgm(c.name, c.fade, c.vol); return;
    case "se": if (!fast()) audio.playSe(c.name, c.vol); return;
    case "voice": if (!fast()) audio.playVoice(c.name, c.vol); return;
    case "fx": applyFx(c.fx); return;
    case "jump": return P.script.labels[c.target];
    case "jf": return evalCond(c.cond, s.f) ? undefined : c.to;
    case "j": return c.to;
    case "unlock": {
      const key = c.kind === "ending" ? "endings" : "cgsSeen";
      sf[key] = sf[key] || {}; sf[key][c.id] = 1; saveSf();
      return;
    }
    case "hint": ui.toast(c.text); return;
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
  P.token++; P.waiting = null; P.inGame = false;
  stopAutoSkip();
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
  hooks.leaveHome && hooks.leaveHome();
  ui.coverOn();
  const token = P.token;
  const script = await loadScript(id);
  if (token !== P.token) return;
  sf.chStart = sf.chStart || {}; sf.unlocked = sf.unlocked || {};
  const f = freshFlags(opt.fresh ? null : sf.chStart[id]);
  P.script = script;
  P.state = { ch: id, f, stage: { bg: "", charas: [], bgm: "" }, scene: "", sceneF: clone(f), chstart: clone(f) };
  // 抵達這一章：記下當時的數值（儲思盆用，每次抵達都更新）與時間線位置
  sf.unlocked[id] = 1;
  sf.chStart[id] = clone(f);
  sf.head = c.n;
  delete sf.cont;
  await clearAutosave();
  saveSf();
  ui.resetLog();
  await stage.rebuild(P.state.stage);
  P.pc = 0; P.autoNext = true;
  enterGame();
  run(token);
}

/* ---------- 章節結束 ---------- */
function endChapter() {
  const s = P.state, id = s.ch;
  const i = story.chapters.findIndex((c) => c.id === id), next = story.chapters[i + 1];
  if (DEBUG) console.log("[章節結束] 羈絆", s.f.bond);
  sf.done = sf.done || {}; sf.unlocked = sf.unlocked || {}; sf.chStart = sf.chStart || {};
  sf.done[id] = 1;
  // 不論下一章做好了沒有，都記下通關時的數值並解鎖；之後章節上線，儲思盆就能直接進入
  if (next) { sf.unlocked[next.id] = 1; sf.chStart[next.id] = clone(s.f); sf.head = next.n; }
  // 「繼續」：下一章已做好 → 從下一章開頭；還沒做好 → 保留自動存檔（回到最後一個選項）
  if (next && next.ready) sf.cont = next.id; else delete sf.cont;
  saveSf();
  leaveGame();
  hooks.showEnd && hooks.showEnd(chapterById(id));
}

/* ---------- 自動存檔 ---------- */
async function commitAutosave() {
  if (!P.snap) return;
  const snap = clone(P.snap);
  const ok = await db.put("snap", "auto", snap);
  if (ok) { sf.auto = { fmt: SAVE_FORMAT }; delete sf.cont; saveSf(); }
}
async function clearAutosave() { delete sf.auto; await db.del("snap", "auto"); }
export function hasContinue() {
  if (sf.cont) { const c = chapterById(sf.cont); if (c && c.ready) return true; }
  return !!(sf.auto && sf.auto.fmt === SAVE_FORMAT);
}
export async function doContinue() {
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
    fmt: SAVE_FORMAT, sig: snap.sig, ch: snap.ch, chTitle: c ? c.title : "",
    time: `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
    line: line.replace(/\s+/g, " ").slice(0, 40)
  };
  if (th) { meta.thumb = th.url; meta.tw = th.w; meta.th = th.h; }
  return { snap, meta };
}

/* ---------- 讀檔 ----------
   格式不同 → 無法讀取
   劇本結構相同 → 原樣讀取，從存檔那一句重新顯示
   劇本結構改過 → 相容讀檔：退回存檔所在場景的開頭（找不到場景就退回章節開頭），還原當時的數值 */
export async function saveStatus(meta) {
  if (!meta || meta.fmt !== SAVE_FORMAT) return "old";
  const c = chapterById(meta.ch);
  if (!c || !c.ready) return "missing";
  try { const sc = await loadScript(meta.ch); return sc.sig === meta.sig ? "ok" : "changed"; } catch (e) { return "missing"; }
}

export async function loadSnap(snap) {
  if (!snap || snap.fmt !== SAVE_FORMAT) { await ui.confirm({ title: "無法讀取這個存檔", sub: "這是舊格式的存檔，無法在目前的版本讀取。", ok: "知道了", single: true }); return false; }
  const c = chapterById(snap.ch);
  let script = null;
  try { if (c && c.ready) script = await loadScript(snap.ch); } catch (e) {}
  if (!script) { await ui.confirm({ title: "無法讀取這個存檔", sub: "找不到這個存檔所屬的章節。", ok: "知道了", single: true }); return false; }
  let compat = script.sig !== snap.sig;
  if (compat && !(await ui.confirm({ title: "劇本已更新", sub: "將從該段落開頭繼續。", ok: "繼續", cancel: "取消" }))) return false;

  leaveGame();
  const token = P.token;
  ui.closeOverlays();
  hooks.leaveHome && hooks.leaveHome();
  P.script = script;
  ui.resetLog();
  if (!compat) {
    P.state = { ch: snap.ch, f: freshFlags(snap.f), stage: clone(snap.stage), scene: snap.scene, sceneF: clone(snap.sceneF), chstart: clone(snap.chstart) };
    P.pc = snap.pc;
  } else {
    const sceneOk = snap.scene && script.scenes[snap.scene] !== undefined;
    const f = freshFlags(sceneOk ? snap.sceneF : snap.chstart);
    P.state = { ch: snap.ch, f, stage: { bg: "", charas: [], bgm: "" }, scene: "", sceneF: clone(f), chstart: clone(snap.chstart || f) };
    P.pc = sceneOk ? script.scenes[snap.scene] : 0;
  }
  P.autoNext = false;
  P.snap = null;
  await stage.rebuild(P.state.stage);
  if (token !== P.token) return false;
  audio.playBgm(P.state.stage.bgm || "", 600);
  enterGame();
  // 停在選項的存檔：把選項前最後一句補回對話框
  const cmd = P.script.cmds[P.pc];
  if (!compat && cmd && cmd.op === "choice" && snap.line) { ui.pushLog(snap.line.speaker, snap.line.text); await ui.showLine(snap.line.speaker, snap.line.text, 0); }
  run(token);
  return true;
}

// 返回標題
export function quitToTitle() { leaveGame(); hooks.home && hooks.home(); }

ui.handlers.advance = advance;
ui.handlers.toggleHide = toggleHide;
ui.handlers.inGame = () => P.inGame;
ui.handlers.openLog = () => { stopAutoSkip(); ui.openLog(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) saveSf(); });
if (DEBUG) window.VN = { P };   // 測試模式：可在主控台檢查狀態
