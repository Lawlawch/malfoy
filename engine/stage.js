/* =============================================================
   stage.js  舞台：背景、立繪（自動排位、說話者高亮）、存檔縮圖
   畫面狀態全部記在 state（{bg, charas:[{id, face}]}），可以隨時從狀態重建。
   ============================================================= */
import { G, LAYOUT, el, sleep, story } from "./core.js";

let bgA, bgB, layer, cgLayer;                      // 兩層背景輪流淡入；立繪層；劇情 CG 層
const charaEls = {};                               // id → <img>

export function initStage(root) {
  bgA = el("div.stage_bg"); bgB = el("div.stage_bg");
  layer = el("div#charas");
  cgLayer = el("div#cgl", {}, el("span.ph"));
  root.append(bgA, bgB, layer, cgLayer);
  G.onResize.push(() => relayout(currentState, 0));
}

let currentState = { bg: "", charas: [] };
export const bgUrl = (name) => `./assets/bg/${name}.jpg`;
// 立繪路徑：有服裝的角色是 assets/chara/<角色>/<服裝>/<表情>.png，沒有的是 assets/chara/<角色>/<表情>.png
export function charaUrl(id, face, outfit) {
  const ch = story.characters[id];
  if (ch && ch.outfits) return `./assets/chara/${id}/${ch.outfits.includes(outfit) ? outfit : (ch.outfit || ch.outfits[0])}/${face}.png`;
  return `./assets/chara/${id}/${face}.png`;
}
const urlOf = (c) => charaUrl(c.id, c.face, c.outfit);
export const cgUrl = (id) => `./assets/cg/${id}.jpg`;

function preload(url) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
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

/* ---------- 立繪位置：底部對齊（半身立繪的腰部切邊藏在對話框後面）----------
   高度 = 版面的 chara_h × 同框人數的縮小比例 × 角色自己的 scale（story.js，例如海格 1.15）。
   比較高大的角色往上長，頭的位置比別人高。寬度依圖檔比例自動決定，水平置中在 cx。 */
export function charaPos(list, id, L = G.L) {
  const n = Math.min(list.length, 3), i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const xs = L.chara_x[n - 1], k = L.chara_k[n - 1];
  const scale = (story.characters[id] && story.characters[id].scale) || 1;
  const height = Math.round(L.chara_h * k * scale);
  const cx = Math.round(L.w * (xs[i] ?? 0.5));
  return { cx, top: L.chara_bottom - height, height };
}
function place(img, p, ms) {
  img.style.transition = ms ? `opacity ${ms}ms ease, left ${ms}ms ease, top ${ms}ms ease, height ${ms}ms ease, filter .25s` : "none";
  Object.assign(img.style, { left: p.cx + "px", top: p.top + "px", height: p.height + "px" });
}
export function relayout(state, ms) {
  currentState = state;
  state.charas.forEach((c) => { const img = charaEls[c.id]; if (img) place(img, charaPos(state.charas, c.id), ms); });
}

export async function show(state, id, face, slot, fade, outfit) {
  currentState = state;
  const existing = state.charas.find((c) => c.id === id);
  if (existing) { existing.outfit = outfit || existing.outfit; setFace(state, id, face); relayout(state, fade); return; }
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

export function setFace(state, id, face) {
  const c = state.charas.find((x) => x.id === id);
  if (!c) return;
  c.face = face;
  const img = charaEls[id];
  if (img) img.src = urlOf(c);
}
// 換裝：角色在台上就直接換圖，保留表情與位置
export function setOutfit(state, id, outfit) {
  const c = state.charas.find((x) => x.id === id);
  if (!c) return;
  c.outfit = outfit;
  const img = charaEls[id];
  if (img) img.src = urlOf(c);
}

export async function hide(state, id, fade) {
  const i = state.charas.findIndex((c) => c.id === id);
  if (i < 0) return;
  state.charas.splice(i, 1);
  const img = charaEls[id]; delete charaEls[id];
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
function paintCg(id, im) {
  cgLayer.style.backgroundImage = im ? `url("${cgUrl(id)}")` : "";
  cgLayer.classList.toggle("noimg", !im);
  cgLayer.querySelector(".ph").textContent = im ? "" : cgName(id);
}
export async function showCg(state, id, fade) {
  state.cg = id;
  const im = await preload(cgUrl(id));
  paintCg(id, im);
  cgLayer.style.transition = "none"; cgLayer.style.opacity = "0"; cgLayer.classList.add("on");
  cgLayer.offsetWidth;
  cgLayer.style.transition = `opacity ${fade}ms ease`; cgLayer.style.opacity = "1";
  if (fade > 0) await sleep(fade);
}
export async function hideCg(state, fade) {
  if (!state.cg) return;
  state.cg = "";
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
  [bgA, bgB].forEach((b) => { b.style.transition = "none"; b.style.opacity = "0"; b.style.backgroundImage = "none"; b.classList.remove("on"); });
  const jobs = [];
  if (state.bg) {
    jobs.push(preload(bgUrl(state.bg)));
    bgA.style.backgroundImage = `url("${bgUrl(state.bg)}")`; bgA.style.opacity = "1"; bgA.classList.add("on");
  }
  state.charas.forEach((c) => {
    jobs.push(preload(urlOf(c)));
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
      ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
    }
  }
  for (const c of state.charas) {
    const im = await preload(urlOf(c)), p = charaPos(state.charas, c.id, L);
    if (im && p) { const w = p.height * im.width / im.height; ctx.drawImage(im, (p.cx - w / 2) * sc, p.top * sc, w * sc, p.height * sc); }
  }
  if (state.cg) {                                  // 劇情 CG 顯示中：縮圖用 CG（沒有圖時用佔位色）
    const im = await preload(cgUrl(state.cg));
    if (im) { const s = Math.max(L.w / im.width, L.h / im.height), sw = L.w / s, sh = L.h / s; ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height); }
    else { const g = ctx.createLinearGradient(0, 0, cv.width, cv.height); g.addColorStop(0, "#6c5a3a"); g.addColorStop(1, "#3b2a1a"); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height); }
  }
  try { return { url: cv.toDataURL("image/jpeg", 0.7), w: cv.width, h: cv.height }; } catch (e) { return null; }
}
