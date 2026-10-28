/* =============================================================
   parser.js  劇本解析器（瀏覽器與 tools/check_story.mjs 共用）
   把一章的純文字劇本轉成指令陣列。寫法見 story/README.md。
   ============================================================= */

export const MAX_LINE = 80;          // 每個對話框最多幾個字

// 指令：參數規格（名稱 → 型別）。沒有列在這裡的 @指令 一律視為錯誤
const OPTS = { fade: "int", vol: "int" };

function err(list, line, msg) { list.push({ line, msg }); }

// 「key=value」與單字參數拆開
function splitArgs(rest) {
  const pos = [], kv = {};
  for (const tok of rest.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([a-z]+)=(.+)$/.exec(tok);
    if (m) kv[m[1]] = m[2]; else pos.push(tok);
  }
  return { pos, kv };
}

function intOpt(kv, key, line, errors) {
  if (kv[key] === undefined) return undefined;
  const n = Number(kv[key]);
  if (!Number.isFinite(n) || n < 0) { err(errors, line, `${key}= 要是非負整數`); return undefined; }
  return Math.round(n);
}

// 值：數字或文字
function parseValue(s) {
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return s.replace(/^"(.*)"$/, "$1");
}

// 效果：bond+3 / bond-2 / key=value，回傳 [{k, op, v}]
export function parseEffects(s, line, errors) {
  const out = [];
  for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^([A-Za-z_]\w*)([+-])(\d+)$/.exec(tok))) out.push({ k: m[1], op: "add", v: (m[2] === "-" ? -1 : 1) * Number(m[3]) });
    else if ((m = /^([A-Za-z_]\w*)=(.+)$/.exec(tok))) out.push({ k: m[1], op: "set", v: parseValue(m[2]) });
    else err(errors, line, `看不懂的效果「${tok}」（寫法：bond+3、c1_open=1）`);
  }
  return out;
}

/* ---------- 條件：c1_open == 1 and bond >= 60 ----------
   支援 == != > < >= <=、單獨變數（不為 0/空即成立）、not、and、or（and 優先） */
export function parseCond(s, line, errors) {
  const toks = s.match(/"[^"]*"|==|!=|>=|<=|>|<|[^\s=!<>]+/g) || [];
  let i = 0;
  function term() {
    let neg = false;
    if (toks[i] === "not") { neg = true; i++; }
    const k = toks[i++];
    if (!k || !/^[A-Za-z_]\w*$/.test(k)) { err(errors, line, `條件寫法錯誤：「${s}」`); return { k: "_", op: "truthy", neg }; }
    if (["==", "!=", ">", "<", ">=", "<="].includes(toks[i])) {
      const op = toks[i++], v = toks[i++];
      if (v === undefined) { err(errors, line, `條件缺少比較值：「${s}」`); return { k, op: "truthy", neg }; }
      return { k, op, v: parseValue(v), neg };
    }
    return { k, op: "truthy", neg };
  }
  function andExpr() {
    const list = [term()];
    while (toks[i] === "and") { i++; list.push(term()); }
    return list;
  }
  const ors = [andExpr()];
  while (toks[i] === "or") { i++; ors.push(andExpr()); }
  if (i < toks.length) err(errors, line, `條件多了看不懂的部分：「${toks.slice(i).join(" ")}」`);
  return ors;              // [[term, term], [term]]：外層 or、內層 and
}

export function evalCond(cond, f) {
  const one = (t) => {
    const a = f[t.k];
    let r;
    switch (t.op) {
      case "truthy": r = !!a && a !== 0; break;
      case "==": r = a == t.v; break;          // 寬鬆比較：存檔裡的 "1" 與 1 視為相同
      case "!=": r = a != t.v; break;
      case ">": r = Number(a) > Number(t.v); break;
      case "<": r = Number(a) < Number(t.v); break;
      case ">=": r = Number(a) >= Number(t.v); break;
      case "<=": r = Number(a) <= Number(t.v); break;
    }
    return t.neg ? !r : r;
  };
  return cond.some((and) => and.every(one));
}

// 文字字數（不算前後空白）
export function textLen(s) { return Array.from(s.trim()).length; }

/* ---------- 主解析 ----------
   ctx = { characters: {id: {name, faces}}, chapterId }
   回傳 { cmds, labels, scenes, sig, errors, warnings } */
export function parseScript(src, ctx = {}) {
  const chars = ctx.characters || {};
  const nameToId = {};
  for (const id in chars) nameToId[chars[id].name] = id;

  const cmds = [], labels = {}, scenes = {}, errors = [], warnings = [];
  const ifStack = [];          // { jfIdx, endJumps: [] }
  let speaker = undefined;     // undefined = 還沒寫過 #
  let pendingChoice = null;
  const lines = src.replace(/\r\n?/g, "\n").split("\n");

  const push = (c) => { cmds.push(c); return cmds.length - 1; };
  const closeChoice = () => {
    if (!pendingChoice) return;
    if (!cmds[pendingChoice].opts.length) err(errors, cmds[pendingChoice].line, "@choice 下面沒有選項（選項以「- 」開頭）");
    pendingChoice = null;
  };

  lines.forEach((raw, ix) => {
    const ln = ix + 1;
    const s = raw.trim();
    if (!s || s.startsWith(";") || s.startsWith("//")) return;

    // 選項（緊接在 @choice 之後）
    if (s.startsWith("- ")) {
      if (pendingChoice === null) { err(errors, ln, "選項「- 」只能寫在 @choice 底下"); return; }
      const m = /^-\s+(.+?)\s*->\s*(\*\w+)\s*(?:\|\s*(.*))?$/.exec(s);
      if (!m) { err(errors, ln, "選項寫法：- 選項文字 -> *標籤 | bond+3 c1_open=1"); return; }
      cmds[pendingChoice].opts.push({ text: m[1], target: m[2].slice(1), fx: m[3] ? parseEffects(m[3], ln, errors) : [], line: ln });
      return;
    }
    closeChoice();

    // 標籤
    if (s.startsWith("*")) {
      const name = s.slice(1);
      if (!/^\w+$/.test(name)) { err(errors, ln, `標籤名稱只能用英數與底線：「${s}」`); return; }
      if (labels[name] !== undefined) err(errors, ln, `標籤 *${name} 重複`);
      labels[name] = cmds.length;
      speaker = undefined;      // 標籤之後要重寫 #（避免沿用到另一條分支的說話者）
      return;
    }

    // 說話者
    if (s.startsWith("#")) {
      const body = s.slice(1).trim();
      if (!body) { speaker = null; return; }                 // 旁白
      const [nm, idPart] = body.split("|").map((x) => x.trim());
      let id = idPart || nameToId[nm] || null;
      if (idPart && !chars[idPart]) err(errors, ln, `#${body}：沒有 id 為「${idPart}」的角色`);
      if (!idPart && !nameToId[nm] && !(ctx.speakers || []).includes(nm)) warnings.push({ line: ln, msg: `說話者「${nm}」不在角色表（沒有頭像與立繪高亮）` });
      speaker = { name: nm, id };
      return;
    }

    // 指令
    if (s.startsWith("@")) {
      const m = /^@(\w+)\s*(.*)$/.exec(s);
      if (!m) { err(errors, ln, `看不懂的指令：「${s}」`); return; }
      const op = m[1], rest = m[2];
      const { pos, kv } = splitArgs(rest);
      for (const k in kv) if (!OPTS[k]) err(errors, ln, `@${op} 不認得參數「${k}=」`);
      if (["if", "elif", "else", "endif"].includes(op)) speaker = undefined;   // 分支前後要重寫 #
      const needChar = (id) => {
        if (!id) { err(errors, ln, `@${op} 缺少角色 id`); return false; }
        if (!chars[id]) { err(errors, ln, `沒有 id 為「${id}」的角色`); return false; }
        return true;
      };
      const needFace = (id, face) => {
        if (face && chars[id] && !chars[id].faces.includes(face)) err(errors, ln, `${id} 沒有表情「${face}」（有：${chars[id].faces.join("、")}）`);
      };
      switch (op) {
        case "scene": {
          const id = pos[0];
          if (!id || !/^\w+$/.test(id)) { err(errors, ln, "@scene 後面要寫場景 id（英數與底線）"); break; }
          if (scenes[id] !== undefined) err(errors, ln, `場景 ${id} 重複`);
          if (labels[id] !== undefined && scenes[id] === undefined) err(errors, ln, `場景 ${id} 與標籤同名`);
          labels[id] = scenes[id] = push({ op: "scene", id, line: ln });
          speaker = undefined;
          break;
        }
        case "bg":
          if (!pos[0]) { err(errors, ln, "@bg 缺少背景名稱"); break; }
          push({ op: "bg", name: pos[0], fade: intOpt(kv, "fade", ln, errors) ?? 800, line: ln });
          break;
        case "show": {
          const id = pos[0]; if (!needChar(id)) break;
          let face = "normal", slot = "";
          for (const p of pos.slice(1)) { if (p === "left") slot = "left"; else face = p; }
          needFace(id, face);
          push({ op: "show", id, face, slot, fade: intOpt(kv, "fade", ln, errors) ?? 300, line: ln });
          break;
        }
        case "face": {
          const id = pos[0]; if (!needChar(id)) break;
          if (!pos[1]) { err(errors, ln, "@face 缺少表情"); break; }
          needFace(id, pos[1]);
          push({ op: "face", id, face: pos[1], line: ln });
          break;
        }
        case "hide": {
          const id = pos[0]; if (!needChar(id)) break;
          push({ op: "hide", id, fade: intOpt(kv, "fade", ln, errors) ?? 300, line: ln });
          break;
        }
        case "hideall": push({ op: "hideall", fade: intOpt(kv, "fade", ln, errors) ?? 300, line: ln }); break;
        case "wait": {
          const n = Number(pos[0]);
          if (!Number.isFinite(n) || n < 0) { err(errors, ln, "@wait 後面要寫毫秒數"); break; }
          push({ op: "wait", ms: n, line: ln });
          break;
        }
        case "bgm":
          if (!pos[0]) { err(errors, ln, "@bgm 缺少音樂名稱（或 stop）"); break; }
          push({ op: "bgm", name: pos[0] === "stop" ? "" : pos[0], fade: intOpt(kv, "fade", ln, errors) ?? 1000, vol: intOpt(kv, "vol", ln, errors) ?? 100, line: ln });
          break;
        case "se": case "voice":
          if (!pos[0]) { err(errors, ln, `@${op} 缺少檔名`); break; }
          push({ op, name: pos[0], vol: intOpt(kv, "vol", ln, errors) ?? 100, line: ln });
          break;
        case "jump":
          if (!/^\*\w+$/.test(pos[0] || "")) { err(errors, ln, "@jump 後面要寫 *標籤"); break; }
          push({ op: "jump", target: pos[0].slice(1), line: ln });
          break;
        case "set": case "bond": {
          const fx = op === "bond"
            ? (/^[+-]\d+$/.test(rest.trim()) ? [{ k: "bond", op: "add", v: Number(rest.trim()) }] : (err(errors, ln, "@bond 寫法：@bond +3 或 @bond -2"), []))
            : parseEffects(rest, ln, errors);
          if (fx.length) push({ op: "fx", fx, line: ln });
          break;
        }
        case "if": {
          const idx = push({ op: "jf", cond: parseCond(rest, ln, errors), to: -1, line: ln });
          ifStack.push({ jfIdx: idx, endJumps: [], line: ln, hasElse: false });
          break;
        }
        case "elif": case "else": {
          const top = ifStack[ifStack.length - 1];
          if (!top) { err(errors, ln, `@${op} 前面沒有 @if`); break; }
          if (top.hasElse) { err(errors, ln, `@else 之後不能再寫 @${op}`); break; }
          top.endJumps.push(push({ op: "j", to: -1, line: ln }));
          if (top.jfIdx >= 0) cmds[top.jfIdx].to = cmds.length;
          if (op === "elif") top.jfIdx = push({ op: "jf", cond: parseCond(rest, ln, errors), to: -1, line: ln });
          else { top.jfIdx = -1; top.hasElse = true; }
          break;
        }
        case "endif": {
          const top = ifStack.pop();
          if (!top) { err(errors, ln, "@endif 前面沒有 @if"); break; }
          if (top.jfIdx >= 0) cmds[top.jfIdx].to = cmds.length;
          top.endJumps.forEach((j) => (cmds[j].to = cmds.length));
          break;
        }
        case "choice":
          pendingChoice = push({ op: "choice", opts: [], line: ln });
          break;
        case "cg": case "ending":
          if (!pos[0]) { err(errors, ln, `@${op} 缺少 id`); break; }
          if (ctx.cgIds && !ctx.cgIds.includes(pos[0])) warnings.push({ line: ln, msg: `圖鑑清單裡沒有「${pos[0]}」` });
          push({ op: "unlock", kind: op, id: pos[0], line: ln });
          break;
        case "hint":
          if (!rest.trim()) { err(errors, ln, "@hint 缺少文字"); break; }
          push({ op: "hint", text: rest.trim(), line: ln });
          break;
        case "end":
          push({ op: "end", line: ln });
          break;
        default:
          err(errors, ln, `不認得的指令 @${op}`);
      }
      return;
    }

    // 一般文字 = 一個對話框
    if (speaker === undefined) err(errors, ln, "文字前面要先寫說話者（#名字，旁白寫 #）。場景、標籤、@if／@elif／@else／@endif 之後都要重寫");
    if (textLen(s) > MAX_LINE) err(errors, ln, `這句有 ${textLen(s)} 字，超過 ${MAX_LINE} 字，請拆成兩句`);
    push({ op: "text", speaker: speaker || null, text: s, line: ln });
  });
  closeChoice();
  ifStack.forEach((t) => err(errors, t.line, "@if 沒有對應的 @endif"));
  push({ op: "end", line: lines.length });

  // 跳轉目標檢查
  cmds.forEach((c) => {
    if (c.op === "jump" && labels[c.target] === undefined) err(errors, c.line, `找不到標籤 *${c.target}`);
    if (c.op === "choice") c.opts.forEach((o) => { if (labels[o.target] === undefined) err(errors, o.line, `找不到標籤 *${o.target}`); });
  });
  // 場景開頭後、第一句文字前要有 @bg（相容讀檔會從場景開頭重建畫面）
  for (const id in scenes) {
    for (let i = scenes[id] + 1; i < cmds.length; i++) {
      const op = cmds[i].op;
      if (op === "bg") break;
      if (op === "text" || op === "choice" || op === "scene" || op === "end") { warnings.push({ line: cmds[scenes[id]].line, msg: `場景 ${id} 在第一句之前沒有 @bg` }); break; }
    }
  }
  if (!Object.keys(scenes).length) warnings.push({ line: 1, msg: "這一章沒有任何 @scene（劇本更新後舊存檔只能退回章節開頭）" });

  // 結構簽章：只看指令種類與跳轉，不看文字內容。改錯字不會讓存檔走相容讀檔；增刪句子才會。
  const sig = hash(cmds.map((c) => c.op + (c.op === "jump" ? c.target : "") + (c.op === "scene" ? c.id : "") + (c.op === "choice" ? c.opts.map((o) => o.target).join(",") : "")).join("|")
    + "#" + Object.keys(labels).sort().map((k) => k + labels[k]).join(","));
  return { cmds, labels, scenes, sig, errors, warnings };
}

export function hash(s) {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = ((h1 * 33) ^ c) >>> 0; h2 = ((h2 * 31) + c) >>> 0; }
  return (h1 >>> 2).toString(36) + (h2 >>> 14).toString(36);
}
