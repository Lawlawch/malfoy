// 靜態分析：沿每條路線模擬舞台（背景、CG、立繪、服裝），找出合流時舞台不一致、說話者不在場等問題
import fs from "node:fs";
import { parseScript } from "../../engine/parser.js";
import * as story from "../../story/story.js";
const ROOT = new URL("../../story/", import.meta.url).pathname;
const OUT = process.argv[2] || ".";
const terminalIds = new Set(story.cgs.ending.filter((x) => x.terminal).map((x) => x.id));
const chars = story.characters;
const nameToId = {}; for (const [id, c] of Object.entries(chars)) { nameToId[c.name] = id; for (const a of c.aliases || []) nameToId[a] = id; }
const report = [], review = [];
const outfitTable = {};

function tri(cond, known) {   // 三值判斷：true / false / null（不知道）
  const one = (t) => {
    if (!(t.k in known)) return null;
    const a = known[t.k]; let r;
    switch (t.op) {
      case "truthy": r = !!a && a !== 0; break;
      case "==": r = a == t.v; break; case "!=": r = a != t.v; break;
      case ">": r = Number(a) > Number(t.v); break; case "<": r = Number(a) < Number(t.v); break;
      case ">=": r = Number(a) >= Number(t.v); break; case "<=": r = Number(a) <= Number(t.v); break;
    }
    return t.neg ? !r : r;
  };
  let anyNull = false;
  for (const and of cond) {
    let res = true;
    for (const t of and) { const v = one(t); if (v === false) { res = false; break; } if (v === null) res = null; }
    if (res === true) return true;
    if (res === null) anyNull = true;
  }
  return anyNull ? null : false;
}

for (const ch of story.chapters) {
  const file = ROOT + ch.id + ".txt";
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const r = parseScript(src, { characters: story.characters, speakers: Object.keys(story.speakers) });
  const cmds = r.cmds, n = cmds.length, L = src.split("\n");
  // 狀態：bg、cg、立繪（順序）、服裝（本章設定的）、已知旗標（本章 set 的）
  const key = (s) => JSON.stringify([s.bg, s.cg, s.charas.map((c) => c.id), s.known, s.outfit]);
  const at = Array.from({ length: n }, () => new Map());
  // 前面章節留下的旗標：依本章測試過的值分岔（== != 的值，再加「其他」），讓 @if／@elif 的判斷前後一致
  const cand = {};
  for (const c of cmds) if (c.op === "jf") for (const and of c.cond) for (const t of and) { if (t.k === "bond" || !["==", "!=", "truthy"].includes(t.op)) continue; (cand[t.k] = cand[t.k] || new Set(["__x"])).add(t.op === "truthy" ? 0 : t.v); }
  const work = [];
  const push = (pc, s, from) => {
    if (pc === undefined || pc < 0 || pc >= n) return;
    const k = key(s);
    if (at[pc].has(k)) return;
    if (at[pc].size >= 400) return;
    at[pc].set(k, { s, from });
    work.push([pc, s]);
  };
  push(0, { bg: "", cg: "", charas: [], known: {}, outfit: {} }, -1);
  const issues = new Map();   // 去重
  const addIssue = (kind, line, msg) => { const k = kind + line + msg; if (!issues.has(k)) issues.set(k, { kind, line, msg }); };
  let steps = 0;
  while (work.length && steps++ < 3000000) {
    const [pc, s0] = work.pop();
    const c = cmds[pc];
    const s = { bg: s0.bg, cg: s0.cg, charas: s0.charas.map((x) => ({ ...x })), known: { ...s0.known }, outfit: { ...s0.outfit } };
    const shown = (id) => s.charas.some((x) => x.id === id);
    let next = [pc + 1];
    switch (c.op) {
      case "scene": s.charas = []; s.cg = ""; break;
      case "bg": s.bg = c.name; break;
      case "showcg": s.cg = c.id; break;
      case "hidecg": s.cg = ""; break;
      case "show": {
        if (!shown(c.id)) { if (c.slot === "left") s.charas.unshift({ id: c.id }); else s.charas.push({ id: c.id }); }
        const ci = chars[c.id];
        if (ci && ci.outfits) {
          const o = s.outfit[c.id] || "(沿用前章)";
          outfitTable[ch.id] = outfitTable[ch.id] || {};
          (outfitTable[ch.id][c.id] = outfitTable[ch.id][c.id] || new Set()).add(o);
        }
        if (s.charas.length >= 4) addIssue("同時立繪 ≥4", c.line, s.charas.map((x) => x.id).join("、"));
        break;
      }
      case "face": if (!shown(c.id)) addIssue("換表情但角色不在場", c.line, c.id + " " + c.face); break;
      case "hide": if (!shown(c.id)) addIssue("隱藏不在場的角色", c.line, c.id); s.charas = s.charas.filter((x) => x.id !== c.id); break;
      case "hideall": s.charas = []; break;
      case "outfit": s.outfit[c.id] = c.outfit; break;
      case "fx": for (const e of c.fx) { if (e.op === "set") s.known[e.k] = e.v; else delete s.known[e.k]; } break;
      case "text": {
        const spId = c.speaker ? (c.speaker.id || nameToId[c.speaker.name] || null) : null;
        if (spId && chars[spId] && chars[spId].faces && !shown(spId) && !s.cg) addIssue("說話者不在場（有立繪的角色）", c.line, `${chars[spId].name}：${c.text.slice(0, 24)}`);
        break;
      }
      case "jump": next = [r.labels[c.target]]; break;
      case "j": next = [c.to]; break;
      case "jf": {
        const unk = c.cond.flat().find((t) => cand[t.k] && !(t.k in s.known));
        if (unk) { for (const v of cand[unk.k]) push(pc, { ...s, known: { ...s.known, [unk.k]: v } }, pc); continue; }
        const t = tri(c.cond, s.known); next = t === true ? [pc + 1] : t === false ? [c.to] : [pc + 1, c.to]; break; }
      case "choice": {   // 選項的旗標在選下去時才寫入
        for (const o of c.opts) { const k2 = { ...s.known }; for (const e of o.fx || []) { if (e.op === "set") k2[e.k] = e.v; else delete k2[e.k]; } push(r.labels[o.target], { ...s, known: k2 }, pc); }
        next = []; break;
      }
      case "unlock": if (c.kind === "ending" && terminalIds.has(c.id)) next = []; break;
      case "end": next = []; break;
    }
    for (const x of next) push(x, s, pc);
  }
  if (process.env.DUMP && process.env.DUMP.split(":")[0] === ch.id) { const ln = +process.env.DUMP.split(":")[1]; for (let pc = 0; pc < n; pc++) if (cmds[pc].line === ln) for (const { s } of at[pc].values()) console.log(s.charas.map((x) => x.id).join(","), JSON.stringify(s.known)); }
  // 合流時舞台不一致：在每句台詞上，若有多種到達狀態（只看 bg/cg/立繪），列出
  const reported = new Set();
  for (let pc = 0; pc < n; pc++) {
    const c = cmds[pc];
    if (c.op !== "text") continue;
    const kinds = new Map();
    for (const { s } of at[pc].values()) { const k = JSON.stringify([s.bg, s.cg, s.charas.map((x) => x.id).sort()]); if (!kinds.has(k)) kinds.set(k, s); }
    if (kinds.size > 1) {
      const sig = [...kinds.keys()].sort().join("|");
      if (reported.has(sig)) continue;   // 同一段不一致只報第一句
      reported.add(sig);
      const desc = [...kinds.values()].map((s) => `背景 ${s.bg || "（無）"}${s.cg ? "／CG " + s.cg : ""}／立繪 ${s.charas.map((x) => (chars[x.id] ? chars[x.id].name : x.id)).join("、") || "（無）"}`);
      addIssue("合流時舞台不一致", c.line, `「${c.text.slice(0, 20)}」\n        ${desc.join("\n        ")}`);
    }
  }
  // 日夜：背景名稱與台詞用字
  let curBg = "";
  for (let i = 0; i < n; i++) {
    const c = cmds[i];
    if (c.op === "bg") curBg = c.name;
    if (c.op === "scene") curBg = "";
    if (c.op !== "text") continue;
    const night = /night|dark|moon/.test(curBg), day = /_day|sunset|morning/.test(curBg);
    if (night && /(早上|清晨|早晨|中午|午餐|早餐|太陽很大|陽光灑)/.test(c.text)) addIssue("夜晚背景＋白天用字？", c.line, `${curBg}：${c.text.slice(0, 30)}`);
    if (day && /(深夜|半夜|午夜|月光|宵禁|晚餐|晚上)/.test(c.text)) addIssue("白天背景＋夜晚用字？", c.line, `${curBg}：${c.text.slice(0, 30)}`);
  }
  // 選擇複查用：每個選項的分支開頭、合流點
  for (let pc = 0; pc < n; pc++) {
    const c = cmds[pc];
    if (c.op !== "choice") continue;
    review.push(`\n## ${ch.id} 第 ${c.line} 行 選擇${c.title ? "「" + c.title + "」" : ""}`);
    const reach = c.opts.map((o) => { const seen = new Set(); const st = [r.labels[o.target]]; while (st.length) { const x = st.pop(); if (x === undefined || seen.has(x) || x >= n) continue; seen.add(x); const k = cmds[x]; if (k.op === "end") continue; if (k.op === "choice" && x !== pc) continue; const nx = k.op === "jump" ? [r.labels[k.target]] : k.op === "j" ? [k.to] : k.op === "jf" ? [x + 1, k.to] : k.op === "choice" ? k.opts.map((q) => r.labels[q.target]) : (k.op === "unlock" && terminalIds.has(k.id)) ? [] : [x + 1]; st.push(...nx); } return seen; });
    // 合流點：所有選項都會到達、最早的那句 text
    let merge = null;
    for (let x = 0; x < n; x++) if (cmds[x].op === "text" && reach.every((s) => s.has(x))) { if (merge === null || [...reach[0]].indexOf(x) < [...reach[0]].indexOf(merge)) merge = x; }
    c.opts.forEach((o, i) => {
      const fx = (o.fx || []).map((e) => e.k + (e.op === "add" ? (e.v >= 0 ? "+" : "") + e.v : "=" + e.v)).join(" ");
      const t0 = r.labels[o.target]; const texts = [];
      for (let x = t0; x < n && texts.length < 3; x++) { const k = cmds[x]; if (k.op === "text") texts.push(k.text.replace(/\n/g, " ")); if (k.op === "choice" || k.op === "end" || k.op === "jump" || k.op === "j") break; }
      review.push(`  [${i + 1}] ${o.text}  {${fx}}\n      → ${texts.join(" ／ ")}`);
    });
    if (merge !== null) review.push(`  ⇒ 合流（第 ${cmds[merge].line} 行）：${cmds[merge].text.replace(/\n/g, " ").slice(0, 60)}`);
    else review.push(`  ⇒ 不合流（各自到章末或下一個選擇）`);
  }
  const list = [...issues.values()].sort((a, b) => a.line - b.line);
  report.push(`\n# ${ch.id}〈${ch.title}〉：${list.length} 項`);
  for (const it of list) report.push(`  [${it.kind}] 第 ${it.line} 行：${it.msg}`);
}
report.push("\n# 服裝（本章 @show 時的服裝；「沿用前章」＝本章沒有 @outfit）");
for (const [ch, m] of Object.entries(outfitTable)) report.push(`  ${ch}：` + Object.entries(m).map(([id, s]) => `${chars[id].name}=${[...s].join("/")}`).join("　"));
fs.writeFileSync(OUT + "/static_report.txt", report.join("\n"));
fs.writeFileSync(OUT + "/choice_review.txt", review.join("\n"));
const counts = {};
for (const l of report) { const m = l.match(/^\s+\[(.+?)\]/); if (m) counts[m[1]] = (counts[m[1]] || 0) + 1; }
console.log(counts);
