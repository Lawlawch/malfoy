// 檢查所有章節劇本：node tools/check_story.mjs
// 錯誤（必須修）：看不懂的指令、找不到的標籤、超過 80 字、說話者沒寫……
// 提醒（建議修）：場景開頭沒有背景、說話者不在角色表、立繪或背景檔不存在……
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseScript } from "../engine/parser.js";
import * as story from "../story/story.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cgIds = [...story.cgs.normal, ...story.cgs.ending].map((c) => c.id);
let bad = 0;
// 終結結局：要有 cg，而且 cg 要在一般 CG 清單裡
const terminalIds = new Set();
for (const e of story.cgs.ending.filter((x) => x.terminal)) {
  terminalIds.add(e.id);
  if (!e.cg) { console.log(`✗ 終結結局 ${e.id}：缺少 cg 欄位`); bad++; }
  else if (!story.cgs.normal.some((x) => x.id === e.cg)) { console.log(`✗ 終結結局 ${e.id}：cg「${e.cg}」不在 story.cgs.normal 裡`); bad++; }
}
// 選項之後「不論怎麼走都一定到達終結結局」的 @choice＝放在終結分支裡的選擇（引擎只記最近一次選擇，回溯會回不到真正的岔路口）
function doomedChoices(r) {
  const cmds = r.cmds, n = cmds.length;
  const succ = (i) => {
    const c = cmds[i];
    if (c.op === "end") return [];
    if (c.op === "unlock" && c.kind === "ending" && terminalIds.has(c.id)) return [];
    if (c.op === "jump") return [r.labels[c.target]];
    if (c.op === "j") return [c.to];
    if (c.op === "jf") return [i + 1, c.to];
    if (c.op === "choice") return c.opts.map((o) => r.labels[o.target]);
    return [i + 1];
  };
  const doom = new Array(n).fill(false);   // doom[i]：從 i 出發，每條路都會走到終結結局
  for (let i = 0; i < n; i++) if (cmds[i].op === "unlock" && cmds[i].kind === "ending" && terminalIds.has(cmds[i].id)) doom[i] = true;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = n - 1; i >= 0; i--) {
      if (doom[i]) continue;
      const s = succ(i).filter((x) => x !== undefined && x >= 0 && x < n);
      if (s.length && s.every((x) => doom[x])) { doom[i] = true; changed = true; }
    }
  }
  return cmds.filter((c, i) => c.op === "choice" && doom[i]);
}
for (const ch of story.chapters.filter((c) => c.ready)) {
  const file = path.join(root, "story", ch.id + ".txt");
  if (!fs.existsSync(file)) { console.log(`✗ ${ch.id}：找不到 story/${ch.id}.txt（章節標為 ready）`); bad++; continue; }
  const r = parseScript(fs.readFileSync(file, "utf8"), { characters: story.characters, speakers: Object.keys(story.speakers), cgIds });
  const warn = [...r.warnings];
  for (const c of r.cmds) {
    if (c.op === "bg" && !fs.existsSync(path.join(root, "assets/bg", c.name + ".webp"))) warn.push({ line: c.line, msg: `背景圖不存在：assets/bg/${c.name}.webp` });
    if (c.op === "show" || c.op === "face") {
      // 有服裝的角色：每一套服裝都要有這個表情（劇本裡換裝可能發生在別的分支，所以全部檢查）
      const ch = story.characters[c.id], dirs = ch && ch.outfits ? ch.outfits.map((o) => c.id + "/" + o) : [c.id];
      for (const d of dirs) if (!fs.existsSync(path.join(root, "assets/chara", d, c.face + ".webp"))) warn.push({ line: c.line, msg: `立繪不存在：assets/chara/${d}/${c.face}.webp` });
    }
  }
  // 年級最後一章：要有 @ending（年級結算頁顯示這一輪的結局 CG 與標題）
  const i = story.chapters.indexOf(ch), nx = story.chapters[i + 1];
  if ((!nx || nx.year !== ch.year) && !r.cmds.some((c) => c.op === "unlock" && c.kind === "ending")) warn.push({ line: 0, msg: "這是年級最後一章，但沒有 @ending：年級結算頁會沒有結局 CG" });
  for (const c of doomedChoices(r)) r.errors.push({ line: c.line, msg: "這個選擇放在終結分支裡（不論選哪個都會走到終結結局），「回到上一個選擇」會回到這裡而不是真正的岔路口" });
  const texts = r.cmds.filter((c) => c.op === "text").length, choices = r.cmds.filter((c) => c.op === "choice").length;
  console.log(`${r.errors.length ? "✗" : "✓"} ${ch.id}：${texts} 句、${choices} 個選擇、${Object.keys(r.scenes).length} 個場景（簽章 ${r.sig}）`);
  r.errors.forEach((e) => console.log(`   錯誤 第 ${e.line} 行：${e.msg}`));
  warn.forEach((e) => console.log(`   提醒 第 ${e.line} 行：${e.msg}`));
  bad += r.errors.length;
}
console.log(bad ? `共 ${bad} 個錯誤` : "全部正確");
process.exit(bad ? 1 : 0);
