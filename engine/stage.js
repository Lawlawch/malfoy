/* =============================================================
   stage.js  舞台：背景、立繪（自動排位、說話者高亮）、存檔縮圖
   畫面狀態全部記在 state（{bg, charas:[{id, face}]}），可以隨時從狀態重建。
   ============================================================= */
import { G, $, el, sleep } from "./core.js";

let bgA, bgB, layer;                               // 兩層背景輪流淡入；立繪層
const charaEls = {};                               // id → <img>

export function initStage(root) {
  bgA = el("div.bg"); bgB = el("div.bg");
  layer = el("div#charas");
  root.append(bgA, bgB, layer);
  G.onResize.push(() => relayout(currentState, 0));
}

let currentState = { bg: "", charas: [] };
export const bgUrl = (name) => `./assets/bg/${name}.jpg`;
export const charaUrl = (id, face) => `./assets/chara/${id}/${face}.png`;

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

/* ---------- 立繪位置 ---------- */
export function charaPos(list, id) {
  const L = G.L, n = Math.min(list.length, 3), i = list.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const xs = L.chara_x[n - 1], k = L.chara_k[n - 1];
  const w = Math.round(L.chara_w * k);
  const cx = Math.round(L.w * (xs[i] ?? 0.5));
  return { left: cx - Math.round(w / 2), top: L.chara_top, width: w };
}
function place(img, p, ms) {
  img.style.transition = ms ? `opacity ${ms}ms ease, left ${ms}ms ease, width ${ms}ms ease, filter .25s` : "none";
  Object.assign(img.style, { left: p.left + "px", top: p.top + "px", width: p.width + "px" });
}
export function relayout(state, ms) {
  currentState = state;
  state.charas.forEach((c) => { const img = charaEls[c.id]; if (img) place(img, charaPos(state.charas, c.id), ms); });
}

export async function show(state, id, face, slot, fade) {
  currentState = state;
  const existing = state.charas.find((c) => c.id === id);
  if (existing) { existing.face = face; setFace(state, id, face); relayout(state, fade); return; }
  if (slot === "left") state.charas.unshift({ id, face }); else state.charas.push({ id, face });
  await preload(charaUrl(id, face));
  const img = el("img.chara", { alt: "", src: charaUrl(id, face), draggable: "false" });
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
  if (img) img.src = charaUrl(id, face);
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
    jobs.push(preload(charaUrl(c.id, c.face)));
    const img = el("img.chara", { alt: "", src: charaUrl(c.id, c.face), draggable: "false" });
    charaEls[c.id] = img; layer.append(img);
  });
  relayout(state, 0);
  await Promise.all(jobs);
}

/* ---------- 存檔縮圖：直接用狀態（背景＋在場立繪）畫在畫布上 ---------- */
export async function thumbnail(state) {
  const L = G.L, sc = 384 / Math.max(L.w, L.h);
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
    const im = await preload(charaUrl(c.id, c.face)), p = charaPos(state.charas, c.id);
    if (im && p) ctx.drawImage(im, p.left * sc, p.top * sc, p.width * sc, p.width * im.height / im.width * sc);
  }
  try { return { url: cv.toDataURL("image/jpeg", 0.7), w: cv.width, h: cv.height }; } catch (e) { return null; }
}
