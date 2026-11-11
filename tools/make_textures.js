// 產生面板用的預算紋理（v0.5.0）：把 deco.js 原本即時運算的雜訊濾鏡，預先畫成可無縫鋪貼的透明紋理與蠟封圖。
// iOS（WebKit）用 CPU 以 3 倍解析度即時算 feTurbulence，存檔格、章節格要等約 1 秒才出現；改貼圖後即時顯示。
// 執行：NODE_PATH=$(npm root -g) node tools/make_textures.js（需要 playwright）
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const OUT = path.join(__dirname, "..", "assets", "ui");
const T = 512;   // 紋理一格的大小（CSS 像素）；紋路很細，1 倍解析度就夠，檔案也小

// 與 deco.js 原本的濾鏡相同，只是去掉原圖本身（只留疊上去的紋路），並讓雜訊可無縫接邊
const TEX = {
  tex_paper: `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.035 0.07" numOctaves="3" seed="11" stitchTiles="stitch" result="coarse"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.03  1.2 0 0 0 -0.5" result="fineA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0 0.04  0.9 0 0 0 -0.4" result="coarseA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.8  -0.8 0 0 0 0.38" result="lightA"/>
    <feMerge><feMergeNode in="coarseA"/><feMergeNode in="lightA"/><feMergeNode in="fineA"/></feMerge>`,
  tex_lite: `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="2" seed="11" stitchTiles="stitch" result="coarse"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.03  0.8 0 0 0 -0.34" result="fineA"/>
    <feColorMatrix in="coarse" type="matrix" values="0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0 0.04  0.45 0 0 0 -0.2" result="coarseA"/>
    <feMerge><feMergeNode in="coarseA"/><feMergeNode in="fineA"/></feMerge>`,
  tex_metal: `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="fine"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.015 0.6" numOctaves="2" seed="3" stitchTiles="stitch" result="streak"/>
    <feColorMatrix in="fine" type="matrix" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.02  1.5 0 0 0 -0.62" result="fineA"/>
    <feColorMatrix in="streak" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0 0.04  1.4 0 0 0 -0.55" result="darkA"/>
    <feColorMatrix in="streak" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.8  -1.3 0 0 0 0.55" result="lightA"/>
    <feMerge><feMergeNode in="darkA"/><feMergeNode in="lightA"/><feMergeNode in="fineA"/></feMerge>`
};
const WAX = `<filter id="w" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
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
    <feMerge><feMergeNode in="sh2"/><feMergeNode in="spec2"/></feMerge></filter>
  <radialGradient id="g" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#2f7a55"/><stop offset=".55" stop-color="#155a3c"/><stop offset="1" stop-color="#0a3424"/></radialGradient>`;
function waxPath(k) {   // 與 deco.js sealHtml 相同的蠟滴外形（第 k 枚）
  const n = 30, seed = k * 1.7, f = (v) => Math.round(v * 10) / 10; let d = "";
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = 27 + Math.sin(i * 2.3 + seed) * 1.6 + (i % 4 === 0 ? 1.8 : 0); d += (i ? "L" : "M") + f(32 + r * Math.cos(a)) + " " + f(32 + r * Math.sin(a)); }
  return d + "Z";
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: T, height: T }, deviceScaleFactor: 1 })).newPage();
  for (const [name, fx] of Object.entries(TEX)) {
    await p.setContent(`<html><body style="margin:0;background:transparent"><svg width="${T}" height="${T}" style="display:block"><filter id="x" x="0" y="0" width="${T}" height="${T}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${fx}</filter><rect width="${T}" height="${T}" fill="#000" filter="url(#x)"/></svg></body></html>`);
    await p.screenshot({ path: path.join(OUT, name + ".png"), omitBackground: true });
  }
  const q = await (await b.newContext({ viewport: { width: 80, height: 80 }, deviceScaleFactor: 3 })).newPage();   // 蠟滴扭曲後會超出 64，四邊各留 8
  for (let k = 0; k < 4; k++) {
    await q.setContent(`<html><body style="margin:0;background:transparent"><svg width="80" height="80" viewBox="-8 -8 80 80" style="display:block;overflow:visible"><defs>${WAX}</defs><path d="${waxPath(k)}" fill="url(#g)" filter="url(#w)"/></svg></body></html>`);
    await q.screenshot({ path: path.join(OUT, `wax${k}.png`), omitBackground: true });
  }
  await b.close();
})();
