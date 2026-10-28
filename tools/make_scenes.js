// 用程式（SVG）畫出 5 個暫代場景背景，輸出到 assets/bg/*.jpg（1920x1920，重點內容放中央）。
// 會覆蓋同名檔案！換上正式背景圖之後不要再跑這支。
// 用法：node tools/make_scenes.js   （需要 playwright + chromium）
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'bg');

const W = 1920;
const wrap = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}"><defs>
<filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter><filter id="blur24"><feGaussianBlur stdDeviation="24"/></filter><filter id="blur60"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 -.12"/></filter>
${defs}</defs>${body}<rect width="${W}" height="${W}" filter="url(#grain)" opacity=".5"/>
<rect width="${W}" height="${W}" fill="url(#vig)"/></svg>`;
const vig = `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>`;
const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; })();
const stars = (n, ymax) => Array.from({ length: n }, () => `<circle cx="${rnd() * W | 0}" cy="${rnd() * ymax | 0}" r="${(rnd() * 2 + .8).toFixed(1)}" fill="#fff" opacity="${(rnd() * .6 + .3).toFixed(2)}"/>`).join('');
const win = (x, y, w, h, c = '#ffcf7a') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/><rect x="${x + w / 2 - 2}" y="${y}" width="4" height="${h}" fill="#2a1a10" opacity=".7"/><rect x="${x}" y="${y + h / 2 - 2}" width="${w}" height="4" fill="#2a1a10" opacity=".7"/>`;

// ---- 1 對角巷：暖黃昏 ----
function diagon() {
  let b = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3566"/><stop offset=".45" stop-color="#c8707a"/><stop offset=".62" stop-color="#f3b36a"/><stop offset="1" stop-color="#f7d49a"/></linearGradient>`;
  let body = `<rect width="${W}" height="${W}" fill="url(#sky)"/>`;
  body += `<g opacity=".8">${stars(40, 520)}</g>`;
  // 遠景屋頂
  body += `<path d="M0 1010 L120 900 L220 960 L340 860 L470 950 L600 880 L760 960 L900 900 L1020 970 L1180 880 L1320 960 L1470 870 L1600 950 L1760 890 L1920 960 V1100 H0Z" fill="#5a3d5c" opacity=".85"/>`;
  // 左右兩排歪斜建築（向消失點收攏）
  const left = [[0, 280, 1320, 700], [260, 520, 1180, 780], [480, 700, 1100, 840], [640, 820, 1040, 900]];
  const col = ['#2c1f33', '#3a2a3d', '#4a3447', '#5e4155'];
  left.forEach((l, i) => {
    const [x0, x1, top, base] = [l[0], l[1], l[2] - 520 + i * 40, 1180 + i * -20];
    body += `<path d="M${x0} ${base + 380} V${top + 80} L${x0 + (x1 - x0) / 2} ${top - 70 - i * 6} L${x1} ${top + 40 + i * 20} V${base + 380 - i * 60}Z" fill="${col[i]}"/>`;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
      const wx = x0 + 30 + k * ((x1 - x0 - 90) / 1.6) | 0, wy = top + 130 + r * 150 | 0; const ww = Math.max(28, (x1 - x0) / 6) | 0;
      body += win(wx, wy, ww, ww * 1.4 | 0, rnd() > .3 ? '#ffd27a' : '#f0a560');
    }
  });
  const rt = [[W, 1640, 1320], [1660, 1400, 1180], [1440, 1220, 1100], [1280, 1130, 1040]];
  rt.forEach((l, i) => {
    const [x0, x1, top] = [l[0], l[1], l[2] - 520 + i * 40], base = 1180 - i * 20;
    body += `<path d="M${x0} ${base + 380} V${top + 40} L${x1 + (x0 - x1) / 2} ${top - 80 - i * 6} L${x1} ${top + 80} V${base + 380 - i * 60}Z" fill="${col[i]}"/>`;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) {
      const ww = Math.max(28, Math.abs(x0 - x1) / 6) | 0; const wx = x1 + 30 + k * (Math.abs(x0 - x1) - 90) / 1.6 | 0, wy = top + 150 + r * 150 | 0;
      body += win(wx, wy, ww, ww * 1.4 | 0, rnd() > .3 ? '#ffd27a' : '#f0a560');
    }
  });
  // 地面石板路
  body += `<linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6a62"/><stop offset="1" stop-color="#3a2a30"/></linearGradient><path d="M0 1560 L720 1010 H1200 L1920 1560 V1920 H0Z" fill="url(#road)"/>`;
  for (let i = 0; i < 14; i++) { const y = 1010 + Math.pow(i / 14, 1.7) * 910; const sp = (y - 1010) / 910; body += `<path d="M${960 - 240 - sp * 960} ${y} H${960 + 240 + sp * 960}" stroke="#2a1c22" stroke-width="${1 + sp * 4}" opacity=".5"/>`; }
  for (let i = -8; i <= 8; i++) body += `<path d="M960 1010 L${960 + i * 260} 1920" stroke="#2a1c22" stroke-width="2" opacity=".35"/>`;
  // 路燈與懸掛招牌
  [[620, 1180], [1300, 1180], [430, 1330], [1490, 1330]].forEach(([x, y]) => {
    body += `<circle cx="${x}" cy="${y - 150}" r="110" fill="#ffd27a" opacity=".35" filter="url(#blur24)"/><rect x="${x - 5}" y="${y - 140}" width="10" height="${260}" fill="#1f1722"/><rect x="${x - 22}" y="${y - 190}" width="44" height="60" fill="#ffe3a0"/><path d="M${x - 30} ${y - 190} L${x} ${y - 225} L${x + 30} ${y - 190}Z" fill="#1f1722"/>`;
  });
  body += `<g fill="#1f1722"><rect x="470" y="940" width="6" height="90"/><rect x="450" y="1030" width="110" height="64" rx="6" fill="#7a3a3a"/><rect x="1430" y="900" width="6" height="90"/><rect x="1380" y="990" width="110" height="64" rx="6" fill="#3a5a7a"/></g>`;
  body += `<ellipse cx="960" cy="1040" rx="420" ry="120" fill="#ffd9a0" opacity=".3" filter="url(#blur60)"/>`;
  return wrap(vig, body.replace(/^/, b));
}

// ---- 2 摩金夫人長袍店：暖色室內 ----
function malkin() {
  let d = `<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a3a"/><stop offset="1" stop-color="#4c3228"/></linearGradient><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5434"/><stop offset="1" stop-color="#3b2616"/></linearGradient><linearGradient id="beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity=".55"/><stop offset="1" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>`;
  let b = `<rect width="${W}" height="${W}" fill="url(#wall)"/>`;
  for (let x = 0; x < W; x += 120) b += `<rect x="${x}" y="0" width="4" height="1260" fill="#2a1a12" opacity=".35"/>`;
  b += `<rect y="1240" width="${W}" height="26" fill="#2e1d12"/><path d="M0 1266 H${W} V${W} H0Z" fill="url(#floor)"/>`;
  for (let i = 0; i < 12; i++) b += `<path d="M0 ${1280 + i * i * 4.5} H${W}" stroke="#2a1a0e" stroke-width="${2 + i / 3}" opacity=".5"/>`;
  // 窗（日光）
  b += `<rect x="760" y="420" width="400" height="520" fill="#f4e2b0"/><rect x="760" y="420" width="400" height="520" fill="none" stroke="#2a1a12" stroke-width="18"/><path d="M960 420 V940 M760 680 H1160" stroke="#2a1a12" stroke-width="12"/>`;
  b += `<path d="M760 940 L1160 940 L1500 1500 L420 1500Z" fill="url(#beam)" filter="url(#blur8)"/>`;
  // 架子與布匹
  const cols = ['#7a2230', '#244a6e', '#2f6a4a', '#c9a24a', '#5a3a7a', '#a64a2a', '#d8cfae'];
  [[200, 560], [1230, 560], [200, 860], [1230, 860]].forEach(([x, y], i) => {
    b += `<rect x="${x}" y="${y}" width="500" height="14" fill="#2a1a12"/>`;
    for (let k = 0; k < 7; k++) b += `<rect x="${x + 12 + k * 68}" y="${y - 160 + (k % 2) * 14}" width="58" height="${160 - (k % 2) * 14}" rx="6" fill="${cols[(k + i * 2) % 7]}"/><rect x="${x + 12 + k * 68}" y="${y - 160 + (k % 2) * 14}" width="14" height="${160 - (k % 2) * 14}" fill="#000" opacity=".18"/>`;
  });
  // 試衣台
  b += `<ellipse cx="960" cy="1320" rx="330" ry="70" fill="#1c120a" opacity=".6"/><ellipse cx="960" cy="1290" rx="300" ry="62" fill="#8a5a34"/><ellipse cx="960" cy="1270" rx="300" ry="62" fill="#a8764a"/><ellipse cx="960" cy="1270" rx="240" ry="46" fill="#b88a58" opacity=".7"/>`;
  // 掛著的長袍
  [[560, 1080, '#243a5a'], [1360, 1080, '#4a1c2a']].forEach(([x, y, c]) => b += `<rect x="${x - 60}" y="${y - 220}" width="120" height="8" fill="#1a110a"/><path d="M${x - 50} ${y - 212} L${x + 50} ${y - 212} L${x + 80} ${y + 160} L${x - 80} ${y + 160}Z" fill="${c}"/><path d="M${x} ${y - 212} V${y + 160}" stroke="#000" opacity=".3"/>`);
  b += `<circle cx="960" cy="300" r="130" fill="#ffd9a0" opacity=".5" filter="url(#blur24)"/><path d="M960 120 V230" stroke="#1a110a" stroke-width="6"/><path d="M920 230 H1000 L1020 290 H900Z" fill="#e6b860"/>`;
  return wrap(d + vig, b);
}

// ---- 3 國王十字車站：霧、鐵拱、9¾ ----
function kings() {
  let d = `<linearGradient id="kx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5266"/><stop offset=".6" stop-color="#8f93a0"/><stop offset="1" stop-color="#b9b5ae"/></linearGradient><linearGradient id="plat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e6860"/><stop offset="1" stop-color="#2e2a28"/></linearGradient><radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>`;
  let b = `<rect width="${W}" height="${W}" fill="url(#kx)"/>`;
  // 玻璃拱頂與鐵架
  for (let i = -6; i <= 6; i++) b += `<path d="M960 120 Q${960 + i * 170} 560 ${960 + i * 230} 1080" stroke="#2c303a" stroke-width="${6 + Math.abs(6 - Math.abs(i))}" fill="none" opacity=".75"/>`;
  for (let j = 0; j < 6; j++) b += `<path d="M0 ${300 + j * 120} Q960 ${60 + j * 150} ${W} ${300 + j * 120}" stroke="#2c303a" stroke-width="5" fill="none" opacity=".55"/>`;
  // 紅磚牆與柱子
  b += `<rect x="0" y="1000" width="${W}" height="280" fill="#6a3a32"/>`;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 40; c++) b += `<rect x="${c * 50 + (r % 2) * 25}" y="${1000 + r * 32}" width="46" height="28" fill="${r % 3 ? '#7a443a' : '#5e342c'}" opacity=".55"/>`;
  [380, 1540].forEach(x => b += `<rect x="${x - 40}" y="820" width="80" height="480" fill="#2c303a"/><rect x="${x - 56}" y="800" width="112" height="30" fill="#3a3f4c"/>`);
  // 月台牌與 9¾ 拱門
  b += `<path d="M820 1280 V1000 Q960 820 1100 1000 V1280Z" fill="#241c20"/><path d="M850 1280 V1020 Q960 860 1070 1020 V1280Z" fill="#101018"/><ellipse cx="960" cy="1130" rx="260" ry="320" fill="url(#glow)" filter="url(#blur24)"/>`;
  b += `<rect x="880" y="900" width="160" height="70" rx="8" fill="#e9e2cf" stroke="#2c303a" stroke-width="6"/><text x="960" y="948" font-family="serif" font-size="46" font-weight="700" fill="#2c303a" text-anchor="middle">9¾</text>`;
  [[620, '9'], [1300, '10']].forEach(([x, t]) => b += `<rect x="${x - 55}" y="900" width="110" height="70" rx="8" fill="#e9e2cf" stroke="#2c303a" stroke-width="6"/><text x="${x}" y="948" font-family="serif" font-size="46" font-weight="700" fill="#2c303a" text-anchor="middle">${t}</text>`);
  // 月台地面
  b += `<path d="M0 1280 H${W} V${W} H0Z" fill="url(#plat)"/>`;
  for (let i = 0; i < 12; i++) b += `<path d="M0 ${1290 + i * i * 4} H${W}" stroke="#1a1816" stroke-width="${2 + i / 3}" opacity=".35"/>`;
  b += `<rect x="0" y="1290" width="${W}" height="14" fill="#d8c14a" opacity=".85"/>`;
  b += `<ellipse cx="960" cy="1400" rx="560" ry="80" fill="#ffe9a8" opacity=".18" filter="url(#blur24)"/>`;
  // 霧與蒸汽
  for (let i = 0; i < 9; i++) b += `<ellipse cx="${(i * 260 + 100) % W}" cy="${1180 + (i % 3) * 90}" rx="380" ry="90" fill="#e8e6e2" opacity=".28" filter="url(#blur60)"/>`;
  return wrap(d + vig, b);
}

// ---- 4 火車車廂：窗外風景 ----
function train() {
  let d = `<linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a86b8"/><stop offset=".6" stop-color="#e8b87a"/><stop offset="1" stop-color="#f6d9a0"/></linearGradient><linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3a28"/><stop offset="1" stop-color="#3e2218"/></linearGradient><clipPath id="wclip"><rect x="520" y="400" width="880" height="620"/></clipPath>`;
  let b = `<rect width="${W}" height="${W}" fill="url(#wood)"/>`;
  for (let x = 0; x < W; x += 90) b += `<rect x="${x}" y="0" width="3" height="${W}" fill="#1c0e08" opacity=".35"/>`;
  b += `<g clip-path="url(#wclip)"><rect x="520" y="400" width="880" height="620" fill="url(#sk)"/><circle cx="1180" cy="760" r="70" fill="#fff4cf" opacity=".9" filter="url(#blur8)"/>
  <path d="M520 860 Q700 760 900 840 T1400 800 V1020 H520Z" fill="#5b6f8a" opacity=".85"/><path d="M520 930 Q760 840 980 920 T1400 900 V1020 H520Z" fill="#3f5a4a"/><path d="M520 990 Q800 930 1100 985 T1400 970 V1020 H520Z" fill="#2c4636"/>
  <path d="M760 930 l22 -60 l22 60z M860 940 l18 -50 l18 50z M1060 935 l24 -66 l24 66z" fill="#1d3226"/></g>`;
  b += `<rect x="520" y="400" width="880" height="620" fill="none" stroke="#c9a24a" stroke-width="16"/><rect x="500" y="380" width="920" height="660" fill="none" stroke="#2a1208" stroke-width="22"/><path d="M960 400 V1020" stroke="#2a1208" stroke-width="12"/>`;
  b += `<rect x="540" y="420" width="840" height="80" fill="#fff" opacity=".05"/>`;
  // 行李架
  b += `<rect x="160" y="300" width="1600" height="16" fill="#c9a24a"/><path d="M160 316 V420 M560 316 V420 M1360 316 V420 M1760 316 V420" stroke="#c9a24a" stroke-width="8"/><path d="M200 330 H1720" stroke="#8a6a1f" stroke-width="3" stroke-dasharray="16 16"/>`;
  b += `<rect x="260" y="230" width="300" height="76" rx="10" fill="#4a2a1c" stroke="#c9a24a" stroke-width="5"/><rect x="1280" y="210" width="360" height="96" rx="10" fill="#2e3a50" stroke="#c9a24a" stroke-width="5"/>`;
  // 燈
  b += `<circle cx="960" cy="200" r="220" fill="#ffd9a0" opacity=".35" filter="url(#blur24)"/><path d="M930 120 H990 L1010 210 H910Z" fill="#e6b860" stroke="#6a4a1a" stroke-width="5"/>`;
  // 座椅
  b += `<path d="M120 1180 H1800 V1500 H120Z" fill="#5a1f2a"/><path d="M120 1180 Q960 1100 1800 1180 V1260 H120Z" fill="#7a2a38"/>`;
  for (let i = 0; i < 9; i++) b += `<circle cx="${220 + i * 185}" cy="${1290 + (i % 2) * 60}" r="10" fill="#c9a24a" opacity=".7"/>`;
  b += `<rect x="0" y="1500" width="${W}" height="${W - 1500}" fill="#2a1710"/><path d="M0 1500 H${W}" stroke="#c9a24a" stroke-width="10"/>`;
  b += `<ellipse cx="960" cy="1060" rx="520" ry="120" fill="#ffe3a0" opacity=".22" filter="url(#blur60)"/>`;
  return wrap(d + vig, b);
}

// ---- 5 活米村車站：藍調夜色、遠方城堡 ----
function hogsmeade() {
  let d = `<linearGradient id="ns" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050816"/><stop offset=".55" stop-color="#18224a"/><stop offset="1" stop-color="#3a4a7a"/></linearGradient><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3050"/><stop offset="1" stop-color="#0c0f1c"/></linearGradient>`;
  let b = `<rect width="${W}" height="${W}" fill="url(#ns)"/><g>${stars(120, 900)}</g>`;
  b += `<circle cx="1480" cy="420" r="80" fill="#f7f2d6"/><circle cx="1480" cy="420" r="170" fill="#cfd8ff" opacity=".25" filter="url(#blur24)"/>`;
  b += `<path d="M0 1000 L180 820 L300 920 L520 700 L700 900 L860 790 L1000 900 L1240 740 L1460 900 L1640 800 L1920 960 V1180 H0Z" fill="#1c2442"/><path d="M0 1060 L260 930 L420 1000 L700 880 L980 1010 L1300 900 L1600 1010 L1920 920 V1200 H0Z" fill="#141a34"/>`;
  // 遠方城堡
  b += `<g fill="#0a0e20"><rect x="700" y="760" width="520" height="190"/><rect x="740" y="690" width="40" height="80"/><path d="M730 692 L760 620 L790 692Z"/><rect x="860" y="640" width="52" height="130"/><path d="M850 642 L886 548 L922 642Z"/><rect x="980" y="700" width="40" height="70"/><path d="M972 702 L1000 640 L1028 702Z"/><rect x="1100" y="680" width="48" height="90"/><path d="M1090 682 L1124 600 L1158 682Z"/><rect x="1180" y="730" width="40" height="40"/></g><g fill="#ffcf7a">${[760, 880, 1000, 1110, 820, 940, 1060, 1180].map((x, i) => `<rect x="${x}" y="${(i < 4 ? 720 : 800) + (i % 3) * 6}" width="8" height="14" opacity=".9"/>`).join('')}</g>`;
  // 樹林
  b += `<path d="M0 1180 ${Array.from({ length: 36 }, (_, i) => `L${i * 54} ${1100 - (i % 3) * 40 - (i % 7) * 12} L${i * 54 + 27} ${1180}`).join(' ')} H${W} V1300 H0Z" fill="#0a0e1c"/>`;
  // 車站小屋
  b += `<rect x="340" y="1020" width="620" height="270" fill="#2c2438"/><path d="M310 1030 L650 900 L990 1030Z" fill="#171221"/><rect x="590" y="860" width="40" height="70" fill="#171221"/>`;
  [[390, 1080], [500, 1080], [740, 1080], [850, 1080]].forEach(([x, y]) => b += win(x, y, 66, 100, '#ffbf6a'));
  b += `<rect x="610" y="1150" width="80" height="140" fill="#ffbf6a" opacity=".85"/><rect x="520" y="980" width="260" height="46" rx="6" fill="#d8c8a0"/><text x="650" y="1014" font-family="serif" font-size="30" font-weight="700" fill="#2c2438" text-anchor="middle">HOGSMEADE</text>`;
  // 月台、鐵軌、燈
  b += `<path d="M0 1290 H${W} V${W} H0Z" fill="url(#gr)"/><rect y="1290" width="${W}" height="14" fill="#8a96b8" opacity=".6"/>`;
  b += `<path d="M0 1560 H${W} M0 1640 H${W}" stroke="#56607e" stroke-width="10"/>`;
  for (let i = 0; i < 40; i++) b += `<rect x="${i * 56}" y="1540" width="30" height="120" fill="#1a1e30" opacity=".7"/>`;
  [[1100, 1290], [1500, 1290], [260, 1290]].forEach(([x, y]) => b += `<circle cx="${x}" cy="${y - 250}" r="130" fill="#ffd27a" opacity=".35" filter="url(#blur24)"/><rect x="${x - 6}" y="${y - 240}" width="12" height="250" fill="#0c0f1c"/><rect x="${x - 26}" y="${y - 290}" width="52" height="64" fill="#ffe3a0"/><path d="M${x - 34} ${y - 290} L${x} ${y - 326} L${x + 34} ${y - 290}Z" fill="#0c0f1c"/>`);
  b += `<ellipse cx="960" cy="1360" rx="760" ry="70" fill="#8aa0e0" opacity=".14" filter="url(#blur24)"/>`;
  return wrap(vig, b);
}

const scenes = { 'diagon_alley.jpg': diagon, 'malkin_shop.jpg': malkin, 'kings_cross.jpg': kings, 'train_compartment.jpg': train, 'hogsmeade_station.jpg': hogsmeade };
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: W, height: W } });
  for (const [f, fn] of Object.entries(scenes)) {
    await pg.setContent(`<body style="margin:0;background:#000">${fn()}</body>`);
    await pg.screenshot({ path: path.join(OUT, f), type: 'jpeg', quality: 86 });
    console.log('wrote', f);
  }
  await br.close();
})();
