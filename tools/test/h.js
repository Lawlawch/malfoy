// 測試共用工具：開頁、開始章節、自動遊玩（依策略選選項）、檢查羈絆
const { chromium, devices } = require('playwright');
const BASE = 'http://localhost:8765/index.html?debug=1';
const MODES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  'iphone-port': devices['iPhone 13'],
  'iphone-land': devices['iPhone 13 landscape'],
};
const TERMINAL_FX = { c5_fluffy: 4, c6_troll: 4, c10_shadow: 4, c8_mirror: 3, c11_fight: 3 };

async function newPage(b, mode = 'desktop') {
  const ctx = await b.newContext(MODES[mode]);
  await ctx.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.duration), Math.round(e.startTime)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {} });
  const p = await ctx.newPage();
  p.errs = [];
  p.mode = mode;
  p.on('pageerror', (e) => p.errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push('console ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && !/assets\/(cg|bgm|sound|voice|se)\//.test(r.url())) p.errs.push(r.status() + ' ' + r.url()); });
  return p;
}
async function boot(p, { fastCfg = true } = {}) {
  await p.goto(BASE); await p.waitForSelector('#vn_home .item');
  if (fastCfg) await p.evaluate(async () => { const c = await import('./engine/core.js'); c.cfg().skipRead = 0; c.saveSf(); });
}
const PL = `import('./engine/player.js')`;
async function startCh(p, id, flags, fresh = false) {
  await p.evaluate(async ([id, flags, fresh]) => {
    const c = await import('./engine/core.js'); const P = await import('./engine/player.js');
    if (flags) { c.sf.chStart = c.sf.chStart || {}; c.sf.chStart[id] = flags; }
    P.startChapter(id, fresh ? { fresh: true } : {});
  }, [id, flags, fresh]);
  await p.waitForFunction(() => window.VN && window.VN.P.inGame, null, { timeout: 15000 });
}
const state = (p) => p.evaluate(() => { const P = window.VN.P; return { inGame: P.inGame, pc: P.pc, ch: P.state && P.state.ch, f: P.state && JSON.parse(JSON.stringify(P.state.f)), skip: P.skip }; });

function bondDelta(fx) { let d = 0, set = null; for (const e of fx || []) if (e.k === 'bond') { if (e.op === 'add') d += e.v; else set = e.v; } return { d, set }; }

// 策略：targets＝想要的旗標值；avoidTerminal＝避開終結選項；mode：'max'（羈絆最大）、'random'
function makePolicy({ targets = {}, avoidTerminal = true, mode = 'max', forceTerminal = null } = {}) {
  return (info) => {
    const sc = info.opts.map((o, i) => {
      let s = 0;
      for (const e of o.fx || []) {
        if (e.k === 'bond' && e.op === 'add') s += mode === 'max' ? e.v * 10 : 0;
        if (e.k in targets && e.op === 'set' && e.v === targets[e.k]) s += 1000;
        if (e.k in targets && e.op === 'set' && e.v !== targets[e.k]) s -= 1000;
        if (TERMINAL_FX[e.k] === e.v) s += forceTerminal === e.k ? 5000 : (avoidTerminal ? -10000 : 0);
      }
      if (mode === 'random') s += Math.random() * 5;
      return s;
    });
    return sc.indexOf(Math.max(...sc));
  };
}

// 自動遊玩到 #vn_end（chend/yrend/term）；fast＝用略過（設定為略過全部）
async function play(p, policy, { fast = true, maxMs = 600000, onChoice } = {}) {
  const log = [], t0 = Date.now();
  let lastPc = -1, lastMove = Date.now();
  while (Date.now() - t0 < maxMs) {
    const pcNow = await p.evaluate(() => window.VN && window.VN.P ? window.VN.P.pc + ':' + (window.VN.P.state && window.VN.P.state.ch) : '');
    if (pcNow !== lastPc) { lastPc = pcNow; lastMove = Date.now(); }
    else if (Date.now() - lastMove > 25000 && !(await p.$('#choices.on')) && !(await p.$('#vn_confirm'))) return { end: 'stall@' + pcNow, log };
    const endCls = await p.evaluate(() => { const e = document.querySelector('#vn_end'); return e ? e.className : null; });
    if (endCls) { await p.waitForTimeout(300); return { end: endCls, log }; }
    if (await p.$('#vn_card')) { await p.waitForTimeout(250); continue; }
    const ch = await p.$('#choices.on .vn_opt');
    if (ch) {
      const info = await p.evaluate(() => {
        const P = window.VN.P, c = P.script.cmds[P.pc];
        if (!c || c.op !== 'choice') return null;
        const firstText = (t) => { const L = P.script.labels[t]; for (let i = L; i < P.script.cmds.length; i++) { const x = P.script.cmds[i]; if (x.op === 'text') return { sp: x.speaker && (x.speaker.name || x.speaker.id || x.speaker), text: x.text }; if (x.op === 'choice' || x.op === 'end') return null; } return null; };
        return { ch: P.state.ch, line: c.line, title: c.title, opts: c.opts.map((o) => ({ text: o.text, fx: o.fx, target: o.target, next: firstText(o.target) })), f: JSON.parse(JSON.stringify(P.state.f)), shown: [...document.querySelectorAll('#choices .vn_opt')].map((e) => e.textContent) };
      });
      if (!info) { await p.waitForTimeout(100); continue; }
      const idx = policy(info);
      const { d, set } = bondDelta(info.opts[idx].fx);
      const before = info.f.bond;
      await p.waitForTimeout(380);
      const els = await p.$$('#choices.on .vn_opt');
      if (p.mode === 'desktop') await els[idx].click(); else { const bx = await els[idx].boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); }
      await p.waitForFunction(() => !document.querySelector('#choices.on'), null, { timeout: 5000 }).catch(() => {});
      const after = (await state(p)).f.bond;
      const exp = set !== null ? set : Math.max(0, Math.min(100, (before || 0) + d));
      const rec = { ch: info.ch, line: info.line, title: info.title, picked: info.opts[idx].text, all: info.opts.map((o) => o.text), shownOk: JSON.stringify(info.shown) === JSON.stringify(info.opts.map((o) => o.text)), bondBefore: before, bondAfter: after, bondExp: exp, next: info.opts[idx].next, fx: info.opts[idx].fx };
      log.push(rec); if (onChoice) await onChoice(rec, idx, info);
      continue;
    }
    if (fast) {
      const s = await state(p);
      if (s.inGame && !s.skip) await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true)));
      await p.waitForTimeout(60);
    } else {
      if (p.mode === 'desktop') await p.mouse.click(640, 250); else { const vp = p.viewportSize(); await p.touchscreen.tap(vp.width / 2, vp.height * 0.35); }
      await p.waitForTimeout(90);
    }
  }
  return { end: 'timeout', log };
}
module.exports = { chromium, devices, newPage, boot, startCh, play, state, makePolicy, bondDelta, TERMINAL_FX };
