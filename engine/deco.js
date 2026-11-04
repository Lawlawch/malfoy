/* =============================================================
   deco.js  面板元件的造型（v0.3.9）
   - 長六角形按鈕（hex）：確認框、分段按鈕、分頁、翻頁、結算按鈕、刪除鈕
   - 削角長牌（oct）：儲思盆章節格、存檔格
   - 章號小籤（tag）、已讀蠟封、鎖、拉條、浮塵
   形狀用 SVG 依元件的實際像素大小畫（尖角大小固定，不會被拉長變形）；顏色與狀態（選中、未解鎖）全部由 CSS 決定。
   元件放進畫面時自動套用（MutationObserver），各畫面的程式不用改。
   ============================================================= */
const NS = "http://www.w3.org/2000/svg";
const KINDS = [
  ["hex", ".vn_tab, .vn_cfg_navitem, .vn_seg > span, #vn_confirm .vn_cf_btn, .vn_end_btn, .vn_pg_btn, .vn_slot .del"],
  ["oct", ".vn_ch_row, .vn_slot"],
  ["tag", ".vn_ch_row .no"]
];

// 共用的紋理濾鏡與漸層（整份文件只放一次）
const DEFS = `<svg xmlns="${NS}" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>
  <filter id="dzTex" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.07" numOctaves="3" seed="11" result="coarse"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.03  1.2 0 0 0 -0.5" result="fineA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0 0.04  0.9 0 0 0 -0.4" result="coarseA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.8  -0.8 0 0 0 0.38" result="lightA"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="coarseA"/><feMergeNode in="lightA"/><feMergeNode in="fineA"/></feMerge>
    <feComposite in="m" in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="dzTexLite" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="2" seed="11" result="coarse"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.03  0.8 0 0 0 -0.34" result="fineA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0 0.04  0.45 0 0 0 -0.2" result="coarseA"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="coarseA"/><feMergeNode in="fineA"/></feMerge>
    <feComposite in="m" in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="dzMetal" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.015 0.6" numOctaves="2" seed="3" result="streak"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.02  1.5 0 0 0 -0.62" result="fineA"/>
    <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.04  1.4 0 0 0 -0.55" result="darkA"/>
    <feColorMatrix in="streak" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.8  -1.3 0 0 0 0.55" result="lightA"/>
    <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="darkA"/><feMergeNode in="lightA"/><feMergeNode in="fineA"/></feMerge>
    <feComposite in="m" in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="dzWorn" x="-4%" y="-10%" width="108%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="1" seed="2" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="dzWax" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="5" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.2" result="b"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="9" result="fine"/>
    <feComposite in="b" in2="fine" operator="arithmetic" k2="1" k3="0.35" result="bump"/>
    <feDiffuseLighting in="bump" surfaceScale="4" diffuseConstant="1.15" lighting-color="#ffffff" result="dif"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting>
    <feComposite in="d" in2="dif" operator="arithmetic" k1="1.25" result="shaded"/>
    <feSpecularLighting in="bump" surfaceScale="4" specularConstant="0.9" specularExponent="22" lighting-color="#d8ffe8" result="spec"><feDistantLight azimuth="235" elevation="38"/></feSpecularLighting>
    <feComposite in="spec" in2="d" operator="in" result="spec2"/>
    <feComposite in="shaded" in2="d" operator="in" result="sh2"/>
    <feMerge><feMergeNode in="sh2"/><feMergeNode in="spec2"/></feMerge>
  </filter>
  <filter id="dzEmboss" x="-10%" y="-10%" width="120%" height="120%">
    <feOffset dx="0.8" dy="1" in="SourceAlpha" result="o"/><feFlood flood-color="#03140c" flood-opacity="0.85"/><feComposite in2="o" operator="in" result="sh"/>
    <feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="dzInk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d5732"/><stop offset=".55" stop-color="#5e3e20"/><stop offset="1" stop-color="#432914"/></linearGradient>
  <linearGradient id="dzPaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e2b8"/><stop offset="1" stop-color="#dcc08a"/></linearGradient>
  <linearGradient id="dzLocked" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c7c4c"/><stop offset="1" stop-color="#86683c"/></linearGradient>
  <linearGradient id="dzGoldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3a1"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#8a6420"/></linearGradient>
  <linearGradient id="dzBrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c0"/><stop offset=".35" stop-color="#c9a24a"/><stop offset=".6" stop-color="#f6e3a1"/><stop offset="1" stop-color="#6e4c14"/></linearGradient>
  <radialGradient id="dzGem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b8ffd8"/><stop offset=".45" stop-color="#2fbf78"/><stop offset="1" stop-color="#086438"/></radialGradient>
  <radialGradient id="dzWaxG" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#2f7a55"/><stop offset=".55" stop-color="#155a3c"/><stop offset="1" stop-color="#0a3424"/></radialGradient>
</defs></svg>`;

const f = (n) => Math.round(n * 10) / 10;
const hexPts = (w, h, c, i) => `${f(c + i * 0.6)},${i} ${f(w - c - i * 0.6)},${i} ${w - i},${h / 2} ${f(w - c - i * 0.6)},${h - i} ${f(c + i * 0.6)},${h - i} ${i},${h / 2}`;
const octPts = (w, h, c, i) => { const k = c + i * 0.4; return `${f(k)},${i} ${f(w - k)},${i} ${w - i},${f(k)} ${w - i},${f(h - k)} ${f(w - k)},${h - i} ${f(k)},${h - i} ${i},${f(h - k)} ${i},${f(k)}`; };
const dia = (x, y, r, cls) => `<path class="${cls}" d="M${f(x)} ${f(y - r)}l${r} ${r}-${r} ${r}-${r}-${r}z"/>`;

function draw(elm, kind) {
  const w = elm.offsetWidth, h = elm.offsetHeight;
  if (!w || !h) return;
  const key = w + "x" + h;
  if (elm._dzKey === key) return;
  elm._dzKey = key;
  let s = "";
  if (kind === "hex") {
    const c = Math.min(22, h * 0.42), sm = h < 44;
    s = `<polygon class="dz_fill" points="${hexPts(w, h, c, 1)}" filter="url(#dzTex)"/>
      <polyline class="dz_hi" points="${f(c + 3)},3 ${f(w - c - 3)},3" />
      <polygon class="dz_edge" points="${hexPts(w, h, c, 1)}" filter="url(#dzWorn)"/>
      <polygon class="dz_line" points="${hexPts(w, h, c, sm ? 4 : 6)}"/>
      ${sm ? "" : dia(c * 0.55, h / 2, 5, "dz_stud") + dia(w - c * 0.55, h / 2, 5, "dz_stud")}
      ${sm ? "" : `<path class="dz_tick" d="M${f(c + 14)} 6.5h8M${f(w - c - 22)} 6.5h8M${f(c + 14)} ${h - 6.5}h8M${f(w - c - 22)} ${h - 6.5}h8"/>`}`;
  } else if (kind === "oct") {
    const c = Math.min(16, h * 0.2);
    s = `<polygon class="dz_fill" points="${octPts(w, h, c, 1)}" filter="url(#dzTexLite)"/>
      <polygon class="dz_edge" points="${octPts(w, h, c, 1)}" filter="url(#dzWorn)"/>
      <polygon class="dz_line" points="${octPts(w, h, c, 6)}"/>
      ${[[c / 2 + 3, c / 2 + 3], [w - c / 2 - 3, c / 2 + 3], [c / 2 + 3, h - c / 2 - 3], [w - c / 2 - 3, h - c / 2 - 3]].map(([x, y]) => `<circle class="dz_stud" cx="${f(x)}" cy="${f(y)}" r="2"/>`).join("")}`;
  } else if (kind === "tag") {
    const c = Math.min(12, h * 0.32);
    s = `<polygon class="dz_fill" points="${hexPts(w, h, c, 1)}" filter="url(#dzTex)"/>
      <polygon class="dz_edge" points="${hexPts(w, h, c, 1)}"/>
      <polygon class="dz_line" points="${hexPts(w, h, c, 4)}"/>`;
  }
  elm._dzSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  elm._dzSvg.innerHTML = s;
}

const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver((es) => es.forEach((e) => draw(e.target, e.target._dzKind))) : null;
function decorate(elm, kind) {
  if (elm._dzKind) return;
  elm._dzKind = kind;
  elm.classList.add("dz", "dz_" + kind);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "dz_svg"); svg.setAttribute("aria-hidden", "true");
  elm._dzSvg = svg;
  elm.prepend(svg);
  draw(elm, kind);
  if (ro) ro.observe(elm);
}
function scan(root) {
  if (!root.querySelectorAll) return;
  for (const [kind, sel] of KINDS) {
    if (root.matches && root.matches(sel)) decorate(root, kind);
    root.querySelectorAll(sel).forEach((e) => decorate(e, kind));
  }
}
export function initDeco() {
  document.body.insertAdjacentHTML("afterbegin", DEFS);
  scan(document.body);
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && scan(n)))).observe(document.body, { childList: true, subtree: true });
}

/* ---------- 已讀蠟封、鎖 ---------- */
let sealSeed = 0;
export function sealHtml(text = "已讀") {
  // 邊緣不規則的蠟滴（每枚的形狀略有不同），浮雕光影由 dzWax 濾鏡處理；外圈金環、內圈點線、金字
  const n = 30, seed = sealSeed++ * 1.7;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 27 + Math.sin(i * 2.3 + seed) * 1.6 + (i % 4 === 0 ? 1.8 : 0);
    d += (i ? "L" : "M") + f(32 + r * Math.cos(a)) + " " + f(32 + r * Math.sin(a));
  }
  return `<svg class="dz_seal" viewBox="0 0 64 64" aria-hidden="true" style="transform: rotate(${-14 + (sealSeed % 3) * 5}deg)">
    <path d="${d}Z" fill="url(#dzWaxG)" filter="url(#dzWax)"/>
    <circle cx="32" cy="32" r="20" fill="none" stroke="#0b2c1e" stroke-width="2.4" opacity=".55"/>
    <circle cx="32" cy="32" r="19.4" fill="none" stroke="#d9b86a" stroke-width="1.1" opacity=".9" filter="url(#dzEmboss)"/>
    <circle cx="32" cy="32" r="16" fill="none" stroke="#d9b86a" stroke-width=".6" stroke-dasharray="1.4 2" opacity=".75"/>
    <text x="32" y="37.2" text-anchor="middle" font-size="14" font-weight="700" fill="#f0d99a" letter-spacing="0.5" filter="url(#dzEmboss)" style="font-family: var(--vn-serif)">${text}</text>
  </svg>`;
}
export const LOCK_HTML = `<svg class="dz_lock" viewBox="0 0 46 46" aria-hidden="true">
  <path d="M23 2l21 21-21 21L2 23z" class="dz_lock_plate" filter="url(#dzTex)"/><path d="M23 2l21 21-21 21L2 23z" class="dz_lock_edge"/><path d="M23 7l16 16-16 16L7 23z" class="dz_lock_line"/>
  <path d="M17 22v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#4a2e12" stroke-width="2.4"/><rect x="14.5" y="21.5" width="17" height="13" rx="2" fill="#4a2e12"/>
  <circle cx="23" cy="27" r="1.8" fill="#b8955a"/><path d="M23 28v3" stroke="#b8955a" stroke-width="1.6"/></svg>`;

/* ---------- 拉條：魔杖軌道＋黃銅菱形鈕（中間墨綠寶石）。原生 input 疊在上面負責操作 ---------- */
export function decorateRange(input) {
  const wrap = document.createElement("span");
  wrap.className = "dz_range";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "dz_range_svg"); svg.setAttribute("aria-hidden", "true");
  wrap.append(svg, input);
  const paint = () => {
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w) return;
    const v = (Number(input.value) - Number(input.min || 0)) / ((Number(input.max || 100) - Number(input.min || 0)) || 1);
    const y = h / 2 - 4, x0 = 14, x1 = w - 14, xv = x0 + (x1 - x0) * v;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `<polygon class="dz_rg_track" points="${x0},${y} ${x0 + 12},${y - 6} ${x1 - 12},${y - 6} ${x1},${y} ${x1 - 12},${y + 6} ${x0 + 12},${y + 6}" filter="url(#dzTex)"/>
      <polygon class="dz_rg_edge" points="${x0},${y} ${x0 + 12},${y - 6} ${x1 - 12},${y - 6} ${x1},${y} ${x1 - 12},${y + 6} ${x0 + 12},${y + 6}" filter="url(#dzWorn)"/>
      ${xv > x0 + 1 ? `<polygon points="${x0 + 1},${y} ${Math.min(xv, x0 + 12)},${y - 4} ${f(xv)},${y - 4} ${f(xv)},${y + 4} ${Math.min(xv, x0 + 12)},${y + 4}" fill="url(#dzGoldV)" filter="url(#dzMetal)"/>` : ""}
      ${dia(x0 - 5, y, 5, "dz_rg_cap")}${dia(x1 + 5, y, 5, "dz_rg_cap")}
      ${[0.25, 0.5, 0.75].map((t) => `<circle class="dz_rg_tick" cx="${f(x0 + (x1 - x0) * t)}" cy="${y + 15}" r="2.2"/>`).join("")}
      <g transform="translate(${f(xv)} ${y})"><path d="M0 -15l13 15-13 15-13-15z" fill="url(#dzBrass)" class="dz_rg_knob" filter="url(#dzMetal)"/><path d="M0 -15l13 15-13 15-13-15z" fill="none" stroke="#4a3008" stroke-width="1.2" filter="url(#dzWorn)"/><path d="M0 -10.5l9 10.5-9 10.5-9-10.5z" fill="none" stroke="#fff2c0" stroke-width=".6" opacity=".45"/>
        <path d="M0 -6l6 6-6 6-6-6z" fill="url(#dzGem)" stroke="#063a22" stroke-width=".6"/><circle cx="-2" cy="-2.2" r="1.2" fill="#fff" opacity=".8"/></g>`;
  };
  input.addEventListener("input", paint);
  if (ro) new ResizeObserver(paint).observe(wrap);
  requestAnimationFrame(paint);
  return wrap;
}

/* ---------- 過渡畫面的金框、星芒、裝飾線、浮塵 ---------- */
const G1 = "#d9b86a", G2 = "#f0d99a", G3 = "#8a6a1f";
export function cardFrameHtml(W, H) {
  const m = 30;
  const corner = (x, y, sx, sy) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${G1}" stroke-linecap="round">
    <path d="M0 78V0h78" stroke-width="1.6"/><path d="M9 60V9h51" stroke-width=".8" opacity=".7"/>
    <path d="M78 0c13 0 18 11 9 15-7 3-10-3-6-6" stroke-width="1.3"/><path d="M0 78c0 13 11 18 15 9 3-7-3-10-6-6" stroke-width="1.3"/>
    <path d="M15 15c11 2 18 9 20 20M15 15c2 11 9 18 20 20" stroke-width="1" opacity=".8"/>
    <path d="M15 8l7 7-7 7-7-7z" fill="${G2}" stroke="${G3}" stroke-width=".6"/></g>`;
  return `<svg class="vn_card_frame" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <rect x="${m + 9}" y="${m + 9}" width="${W - 2 * m - 18}" height="${H - 2 * m - 18}" fill="none" stroke="${G1}" stroke-width=".7" opacity=".35"/>
    ${corner(m, m, 1, 1)}${corner(W - m, m, -1, 1)}${corner(m, H - m, 1, -1)}${corner(W - m, H - m, -1, -1)}</svg>`;
}
export const CARD_STAR = `<svg class="vn_card_star" viewBox="0 0 60 46" aria-hidden="true"><g transform="translate(30 23)">
  <path d="M0 -20L3.2 -3.2 20 0 3.2 3.2 0 20 -3.2 3.2 -20 0 -3.2 -3.2z" fill="${G2}" opacity=".95"/>
  <path d="M0 -11L1.6 -1.6 11 0 1.6 1.6 0 11 -1.6 1.6 -11 0 -1.6 -1.6z" transform="rotate(45)" fill="${G1}" opacity=".8"/><circle r="2.4" fill="#fff8e0"/></g>
  <circle cx="10" cy="10" r="1.4" fill="${G2}" opacity=".7"/><circle cx="52" cy="36" r="1.1" fill="${G2}" opacity=".6"/></svg>`;
export function cardRuleHtml(long) {
  const w = long ? 460 : 260, h = long ? 30 : 20, c = w / 2, y = h / 2;
  const mid = long
    ? `<path d="M${c - 34} ${y}c6 0 9-8 16-8s8 5 4 8M${c + 34} ${y}c-6 0-9-8-16-8s-8 5-4 8M${c - 34} ${y}c6 0 9 8 16 8s8-5 4-8M${c + 34} ${y}c-6 0-9 8-16 8s-8-5-4-8"/><path d="M${c - 110} ${y}c8-6 18-6 26 0M${c + 110} ${y}c-8-6-18-6-26 0" stroke-width=".9"/>`
    : `<path d="M${c - 34} ${y}H${c - 12}M${c + 34} ${y}H${c + 12}"/>`;
  return `<svg class="vn_card_rule ${long ? "long" : "short"}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <g fill="none" stroke="${G1}" stroke-width="1.2" stroke-linecap="round"><path d="M6 ${y}H${c - 34}M${w - 6} ${y}H${c + 34}"/>${mid}</g>
    <path d="M${c} ${y - 8}l8 8-8 8-8-8z" fill="#e8cf8a" stroke="${G3}" stroke-width=".8"/><circle cx="6" cy="${y}" r="2" fill="${G1}"/><circle cx="${w - 6}" cy="${y}" r="2" fill="${G1}"/></svg>`;
}
export function cardMotes(n = 22) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 100, y = 15 + Math.random() * 80, r = (Math.random() * 2.2 + 1.4).toFixed(1), d = (6 + Math.random() * 6).toFixed(1), dl = (-Math.random() * 8).toFixed(1), o = (Math.random() * 0.45 + 0.25).toFixed(2);
    s += `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${r}px;height:${r}px;--o:${o};animation-duration:${d}s;animation-delay:${dl}s"></i>`;
  }
  return `<div class="vn_card_motes" aria-hidden="true">${s}</div>`;
}
