/* =============================================================
   stage.js  舞台：背景、立繪（自動排位、說話者高亮）、存檔縮圖
   畫面狀態全部記在 state（{bg, charas:[{id, face}]}），可以隨時從狀態重建。
   ============================================================= */
import { G, LAYOUT, el, sleep, story } from "./core.js";

let bgA, bgB, layer, cgLayer, cgUnder = null;      // 兩層背景輪流淡入；立繪層；劇情 CG 層；CG 換 CG 時墊在下面的舊 CG
const charaEls = {};                               // id → <img>
const ghosts = {};                                 // id → 換表情時疊在上面淡出的舊圖

export function initStage(root) {
  bgA = el("div.stage_bg"); bgB = el("div.stage_bg");
  layer = el("div#charas");
  cgLayer = el("div#cgl.cgl", {}, el("span.ph"));
  root.append(bgA, bgB, layer, cgLayer);
  G.onResize.push(() => relayout(currentState, 0));
}

let currentState = { bg: "", charas: [] };
export const bgUrl = (name) => `./assets/bg/${name}.webp`;
// 立繪路徑：有服裝的角色是 assets/chara/<角色>/<服裝>/<表情>.webp，沒有的是 assets/chara/<角色>/<表情>.webp
export function charaUrl(id, face, outfit) {
  const ch = story.characters[id];
  if (ch && ch.outfits) return `./assets/chara/${id}/${ch.outfits.includes(outfit) ? outfit : (ch.outfit || ch.outfits[0])}/${face}.webp`;
  return `./assets/chara/${id}/${face}.webp`;
}
const urlOf = (c) => charaUrl(c.id, c.face, c.outfit);
export const cgUrl = (id) => `./assets/cg/${id}.webp`;

const aspect = {}, lastAspect = {};                // 圖檔路徑 → 高 / 寬（立繪排位用：3:4 或 9:16）；角色 id → 上一次用的高寬比
function preload(url) {
  return new Promise((res) => { const im = new Image(); im.onload = () => { aspect[url] = im.height / im.width; res(im); }; im.onerror = () => res(null); im.src = url; });
}

/* ---------- 背景 ---------- */
export async function setBg(state, name, fade) {
  currentState = state;
  state.bg = name;
  await preload(bgUrl(name));
  const [front, back] = bgA.classList.contains("on") ? [bgB, bgA] : [bgA, bgB];
  front.style.transition = "none";
  front.style.backgroundImage = name ? `url("${bgUrl(name)}")` : "none";
  front.style.opacity = "0";
  front.style.zIndex = "2"; back.style.zIndex = "1";
  front.offsetWidth;                               // 讓瀏覽器先套用 opacity 0，再開始淡入
  front.style.transition = `opacity ${fade}ms ease`;
  front.style.opacity = "1";
  front.classList.add("on"); back.classList.remove("on");
  if (fade > 0) await sleep(fade);
  back.style.backgroundImage = "none";
}

/* ---------- 立繪位置：以立繪上方 3:4 段（頭頂到腰）排位，底部藏在對話框後面 ----------
   3:4 段高度 = 版面的 chara_h × 同框人數的縮小比例 × 角色自己的 scale（story.js 的 scale，預設 1），底邊對齊 chara_bottom。
   比較高大的角色往上長，頭的位置比別人高。長立繪（9:16）頭頂位置不變，整張高度按比例拉長，下半身往下延伸。
   直向 3 人時改用三角排（版面的 chara_trio）：左右兩人在前，排在中間的人站後排。寬度依圖檔比例自動決定，水平置中在 cx。 */
export function charaPos(list, id, L = G.L) {
  const n = Math.min(list.length, 3), i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const trio = n === 3 && L.chara_trio;
  const xs = trio ? trio.x : L.chara_x[n - 1], k = trio ? trio.k : L.chara_k[n - 1];
  const bottom = trio ? trio.bottom[i] ?? L.chara_bottom : L.chara_bottom;
  const scale = (story.characters[id] && story.characters[id].scale) || 1;
  const base = L.chara_h * k * scale;                                     // 3:4 段的高度
  const r = aspect[urlOf(list[i])] || lastAspect[id] || 4 / 3;           // 圖檔高寬比（還沒載入時沿用這個角色上一張圖的，再沒有就當 3:4）
  lastAspect[id] = r;
  const cx = Math.round(L.w * (xs[i] ?? 0.5));
  return { cx, top: Math.round(bottom - base), height: Math.round(base * r * 0.75), z: trio && i === 1 ? 0 : 1 };
}
function place(img, p, ms) {
  img.style.transition = ms ? `opacity ${ms}ms ease, left ${ms}ms ease, top ${ms}ms ease, height ${ms}ms ease, filter .25s` : "none";
  Object.assign(img.style, { left: p.cx + "px", top: p.top + "px", height: p.height + "px", zIndex: p.z });
}
export function relayout(state, ms) {
  currentState = state;
  state.charas.forEach((c) => { const img = charaEls[c.id]; if (img) place(img, charaPos(state.charas, c.id), ms); });
}

export async function show(state, id, face, slot, fade, outfit) {
  currentState = state;
  const existing = state.charas.find((c) => c.id === id);
  if (existing) { existing.outfit = outfit || existing.outfit; setFace(state, id, face, fade ? 150 : 0); relayout(state, fade); return; }
  const entry = { id, face };
  if (outfit) entry.outfit = outfit;
  if (slot === "left") state.charas.unshift(entry); else state.charas.push(entry);
  await preload(urlOf(entry));
  const img = el("img.chara", { alt: "", src: urlOf(entry), draggable: "false" });
  img.style.opacity = "0";
  charaEls[id] = img;
  layer.append(img);
  place(img, charaPos(state.charas, id), 0);
  img.offsetWidth;
  relayout(state, fade);
  img.style.opacity = "1";
  if (fade > 0) await sleep(fade);
}

// 換表情：ms > 0 時舊圖疊在上面淡出（交叉淡化），新圖載入完成才開始，不會閃
export function setFace(state, id, face, ms = 0) {
  const c = state.charas.find((x) => x.id === id);
  if (!c) return;
  c.face = face;
  const img = charaEls[id];
  if (img) swapSrc(id, img, urlOf(c), ms);
}
function dropGhost(id) { if (ghosts[id]) { ghosts[id].remove(); delete ghosts[id]; } }
function swapSrc(id, img, url, ms) {
  dropGhost(id);
  if (!ms || !img.complete || !img.naturalWidth) { img.src = url; preload(url); return; }
  const g = img.cloneNode();
  g.style.transition = "none";
  g.style.opacity = getComputedStyle(img).opacity;
  img.after(g); ghosts[id] = g;
  preload(url).then(() => {
    if (ghosts[id] !== g) return;
    img.src = url;
    return (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  }).then(() => {
    if (ghosts[id] !== g) return;
    g.style.transition = `opacity ${ms}ms ease`; g.style.opacity = "0";
    setTimeout(() => { if (ghosts[id] === g) dropGhost(id); }, ms + 30);
  });
}
// 換裝：角色在台上就直接換圖，保留表情與位置
export function setOutfit(state, id, outfit) {
  const c = state.charas.find((x) => x.id === id);
  if (!c) return;
  c.outfit = outfit;
  const img = charaEls[id];
  if (img) swapSrc(id, img, urlOf(c), 0);
}

export async function hide(state, id, fade) {
  const i = state.charas.findIndex((c) => c.id === id);
  if (i < 0) return;
  state.charas.splice(i, 1);
  const img = charaEls[id]; delete charaEls[id]; dropGhost(id);
  if (img) { img.style.transition = `opacity ${fade}ms ease`; img.style.opacity = "0"; setTimeout(() => img.remove(), fade + 30); }
  relayout(state, fade);
  if (fade > 0) await sleep(fade);
}

export async function hideAll(state, fade) {
  const ids = state.charas.map((c) => c.id);
  await Promise.all(ids.map((id) => hide(state, id, fade)));
}

/* ---------- 劇情 CG：蓋住背景與立繪，對話框在上面。沒有圖檔時顯示佔位畫面與 CG 名稱 ---------- */
function cgName(id) { const c = [...story.cgs.normal, ...story.cgs.ending].find((x) => x.id === id); return c ? c.name : id; }
// CG 焦點：story.js 的 cgs 可加 pos（例如 "50% 15%"），裁切時以這一點為準；沒寫就置中
export function cgPos(id) { const c = [...story.cgs.normal, ...story.cgs.ending].find((x) => x.id === id); return (c && c.pos) || "50% 50%"; }
function cgFrac(id) { const m = cgPos(id).match(/([\d.]+)%\s+([\d.]+)%/); return m ? [m[1] / 100, m[2] / 100] : [0.5, 0.5]; }
function paintCg(id, im) {
  cgLayer.style.backgroundImage = im ? `url("${cgUrl(id)}")` : "";
  cgLayer.style.backgroundPosition = cgPos(id);
  cgLayer.classList.toggle("noimg", !im);
  cgLayer.querySelector(".ph").textContent = im ? "" : cgName(id);
}
// CG 顯示中又換另一張：把舊 CG 複製一份墊在下面，新 CG 疊上去淡入，中間不會露出背景
function dropCgUnder() { if (cgUnder) { cgUnder.remove(); cgUnder = null; } }
export async function showCg(state, id, fade) {
  const swap = !!state.cg && cgLayer.classList.contains("on") && fade > 0;
  state.cg = id;
  const im = await preload(cgUrl(id));
  dropCgUnder();
  if (swap) {
    cgUnder = cgLayer.cloneNode(true); cgUnder.removeAttribute("id");
    cgUnder.style.transition = "none"; cgUnder.style.opacity = "1";
    cgLayer.before(cgUnder);
  }
  paintCg(id, im);
  cgLayer.style.transition = "none"; cgLayer.style.opacity = "0"; cgLayer.classList.add("on");
  cgLayer.offsetWidth;
  cgLayer.style.transition = `opacity ${fade}ms ease`; cgLayer.style.opacity = "1";
  if (fade > 0) await sleep(fade);
  if (state.cg === id) dropCgUnder();
}
export async function hideCg(state, fade) {
  if (!state.cg) return;
  state.cg = "";
  dropCgUnder();
  cgLayer.style.transition = `opacity ${fade}ms ease`; cgLayer.style.opacity = "0";
  if (fade > 0) await sleep(fade);
  if (!state.cg) cgLayer.classList.remove("on");
}

// 說話者高亮：兩人以上在場、而且說話者在場時，其他人稍微變暗
export function focus(state, speakerId) {
  const dim = state.charas.length >= 2 && state.charas.some((c) => c.id === speakerId);
  state.charas.forEach((c) => { const img = charaEls[c.id]; if (img) img.style.filter = dim && c.id !== speakerId ? "brightness(0.55)" : "none"; });
}

// 從狀態直接重建整個舞台（讀檔用，不播轉場）
export async function rebuild(state) {
  currentState = state;
  Object.keys(charaEls).forEach((id) => { charaEls[id].remove(); delete charaEls[id]; });
  Object.keys(ghosts).forEach(dropGhost); dropCgUnder();
  [bgA, bgB].forEach((b) => { b.style.transition = "none"; b.style.opacity = "0"; b.style.backgroundImage = "none"; b.classList.remove("on"); });
  const jobs = [];
  if (state.bg) {
    jobs.push(preload(bgUrl(state.bg)));
    bgA.style.backgroundImage = `url("${bgUrl(state.bg)}")`; bgA.style.opacity = "1"; bgA.classList.add("on");
  }
  await Promise.all(state.charas.map((c) => preload(urlOf(c))));   // 先載入立繪，才知道高寬比（3:4 或 9:16）
  state.charas.forEach((c) => {
    const img = el("img.chara", { alt: "", src: urlOf(c), draggable: "false" });
    charaEls[c.id] = img; layer.append(img);
  });
  relayout(state, 0);
  cgLayer.style.transition = "none";
  if (state.cg) { const im = await preload(cgUrl(state.cg)); paintCg(state.cg, im); cgLayer.style.opacity = "1"; cgLayer.classList.add("on"); }
  else { cgLayer.style.opacity = "0"; cgLayer.classList.remove("on"); }
  await Promise.all(jobs);
}

/* ---------- 存檔縮圖：直接用狀態（背景＋在場立繪）畫在畫布上 ----------
   不論目前是直向或橫向，一律用橫向版面畫成 16:9，存檔格裡的縮圖才會一致 */
// 立繪底部 15% 漸層淡出（跟畫面上的 mask-image 一樣），存檔縮圖用
function fadeBottom(im) {
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const g = x.createLinearGradient(0, im.height * 0.85, 0, im.height);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
  x.globalCompositeOperation = "destination-out"; x.fillStyle = g; x.fillRect(0, im.height * 0.85, im.width, im.height * 0.15);
  return c;
}
export async function thumbnail(state) {
  const L = LAYOUT.land, sc = 384 / Math.max(L.w, L.h);
  const cv = document.createElement("canvas");
  cv.width = Math.round(L.w * sc); cv.height = Math.round(L.h * sc);
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cv.width, cv.height);
  if (state.bg) {
    const im = await preload(bgUrl(state.bg));
    if (im) {                                      // 等比例裁切填滿、置中（跟畫面上的 background-size: cover 一樣）
      const s = Math.max(L.w / im.width, L.h / im.height), sw = L.w / s, sh = L.h / s;
      ctx.filter = "blur(0.6px)";                 // 跟畫面上的背景模糊一致（縮圖比例約 0.3）
      ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
      ctx.filter = "none";
    }
  }
  for (const c of state.charas) {
    const im = await preload(urlOf(c)), p = charaPos(state.charas, c.id, L);
    if (im && p) { const w = p.height * im.width / im.height; ctx.drawImage(fadeBottom(im), (p.cx - w / 2) * sc, p.top * sc, w * sc, p.height * sc); }
  }
  if (state.cg) {                                  // 劇情 CG 顯示中：縮圖用 CG（沒有圖時用佔位色）
    const im = await preload(cgUrl(state.cg));
    if (im) { const s = Math.max(L.w / im.width, L.h / im.height), sw = L.w / s, sh = L.h / s, [fx, fy] = cgFrac(state.cg); ctx.drawImage(im, (im.width - sw) * fx, (im.height - sh) * fy, sw, sh, 0, 0, cv.width, cv.height); }
    else { const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, "#6c5a3a"); g.addColorStop(1, "#3b2a1a"); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height); }
  }
  try { return { url: cv.toDataURL("image/jpeg", 0.7), w: cv.width, h: cv.height }; } catch (e) { return null; }
}
