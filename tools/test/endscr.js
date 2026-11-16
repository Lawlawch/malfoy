// 在章節完結／年級結算／終結畫面離開後，「繼續」是否回到該畫面
const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
async function tapSel(p, sel) {
  await p.waitForSelector(sel, { timeout: 10000 }); await p.waitForTimeout(400);
  const e = await p.$(sel);
  if (p.mode === 'desktop') await e.click(); else { const b = await e.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
}
const endInfo = (p) => p.evaluate(() => { const e = document.querySelector('#vn_end'); if (!e) return null; const q = (s) => { const x = e.querySelector(s); return x ? x.textContent.trim() : null; }; return { cls: e.className, ttl: q('.ttl') || q('.ettl'), next: (e.querySelector('.se_btn[data-a=next]') || {}).className || null }; });
const sfGet = (p) => p.evaluate(async () => { const c = await import('./engine/core.js'); return { endScr: c.sf.endScr || null, cont: c.sf.cont || null }; });
async function reloadContinue(p) {
  await p.reload(); await p.waitForSelector('#vn_home .item');
  const items = await p.$$eval('#vn_home .item', (es) => es.map((e) => e.dataset.a));
  if (!items.includes('continue')) return { noCont: true };
  await tapSel(p, '#vn_home .item[data-a=continue]');
  await p.waitForTimeout(1500);
  return { end: await endInfo(p), inGame: await p.evaluate(() => window.VN.P.inGame), ch: await p.evaluate(() => window.VN.P.state && window.VN.P.state.ch) };
}
(async () => {
  const b = await H.chromium.launch();
  // 1) 章節完結
  {
    console.log('== 章節完結（' + MODE + '）');
    const p = await H.newPage(b, MODE); await H.boot(p);
    await H.startCh(p, 'ch1_01', null, true);
    const r = await H.play(p, H.makePolicy({}));
    ok(r.end.includes('chend'), '到達章節完結頁');
    const e0 = await endInfo(p);
    let s = await sfGet(p); ok(s.endScr && s.endScr.k === 'ch' && s.endScr.ch === 'ch1_01', '記下停在章節完結 ' + JSON.stringify(s.endScr));
    let c = await reloadContinue(p);
    ok(c.end && c.end.cls.includes('chend') && c.end.ttl === e0.ttl && !c.inGame, `重新整理後「繼續」回到章節完結頁（${c.end && c.end.ttl}）`);
    ok(c.end && /main/.test(c.end.next), '「下一章」可按');
    await tapSel(p, '.se_btn[data-a=home]'); await p.waitForSelector('#vn_home .item');
    await tapSel(p, '#vn_home .item[data-a=continue]'); await p.waitForTimeout(1200);
    let e = await endInfo(p); ok(e && e.cls.includes('chend'), '返回標題後再按「繼續」仍是章節完結頁');
    await tapSel(p, '.se_btn[data-a=pensieve]'); await p.waitForTimeout(800);
    await p.evaluate(async () => { const ui = await import('./engine/ui.js'); ui.closeOverlays && ui.closeOverlays(); });
    await p.reload(); await p.waitForSelector('#vn_home .item');
    await tapSel(p, '#vn_home .item[data-a=continue]'); await p.waitForTimeout(1200);
    e = await endInfo(p); ok(e && e.cls.includes('chend'), '進過儲思盆（沒選章）後「繼續」仍是章節完結頁');
    await tapSel(p, '.se_btn[data-a=next]');
    await p.waitForFunction(() => window.VN.P.inGame && window.VN.P.state.ch === 'ch1_02', null, { timeout: 15000 });
    await p.waitForTimeout(1500);
    s = await sfGet(p); ok(!s.endScr, '按「下一章」後清除完結畫面記錄');
    c = await reloadContinue(p);
    ok(!c.end && c.inGame && c.ch === 'ch1_02', `之後「繼續」回到第二章遊玩中（${c.ch}）`);
    // 讀檔清除記錄
    await p.evaluate(async () => { const c = await import('./engine/core.js'); c.sf.endScr = { k: 'ch', ch: 'ch1_01', end: null }; c.saveSf(); });
    const lr = await p.evaluate(async () => { const c = await import('./engine/core.js'); const P = await import('./engine/player.js'); const a = await c.db.get('snap', 'auto'); const r = await P.loadSnap(a); return { r, endScr: c.sf.endScr || null }; });
    ok(lr.r !== false && !lr.endScr, '讀檔會清除完結畫面記錄');
    ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
    await p.context().close();
  }
  // 2) 年級結算
  {
    console.log('== 年級結算（' + MODE + '）');
    const p = await H.newPage(b, MODE); await H.boot(p);
    await H.startCh(p, 'ch1_12', { bond: 100, c4_go: 1, c7_snape: 1, c8_stay: 1, c8_mirror: 1, c9_route: 1, c10_trust: 2, c10_team: 1, c10_end: 1, c10_tell: 1, c11_path: 1 });
    const r = await H.play(p, H.makePolicy({}));
    ok(r.end.includes('chend'), '到達第十二章完結頁');
    let c = await reloadContinue(p);
    ok(c.end && c.end.cls.includes('chend') && !c.inGame, '在章節完結頁離開 →「繼續」回到章節完結頁（不重播最後一句）');
    await tapSel(p, '.se_btn[data-a=next]'); await p.waitForTimeout(1200);
    const y0 = await endInfo(p); ok(y0 && y0.cls.includes('yrend'), `進入年級結算：${y0 && y0.ttl}`);
    const s = await sfGet(p); ok(s.endScr && s.endScr.k === 'yr', '記下停在年級結算 ' + JSON.stringify(s.endScr));
    c = await reloadContinue(p);
    ok(c.end && c.end.cls.includes('yrend') && c.end.ttl === y0.ttl && !c.inGame, `重新整理後「繼續」回到年級結算（${c.end && c.end.ttl}）`);
    await tapSel(p, '.se_btn[data-a=home]'); await p.waitForSelector('#vn_home .item');
    await tapSel(p, '#vn_home .item[data-a=continue]'); await p.waitForTimeout(1200);
    const y1 = await endInfo(p); ok(y1 && y1.cls.includes('yrend') && y1.ttl === y0.ttl, '返回標題後再按「繼續」仍是年級結算');
    ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
    await p.context().close();
  }
  // 3) 終結
  {
    console.log('== 終結（' + MODE + '）');
    const p = await H.newPage(b, MODE); await H.boot(p);
    await H.startCh(p, 'ch1_08', { bond: 70 });
    let fChoice = null, optsAt = null;
    const r = await H.play(p, H.makePolicy({ forceTerminal: 'c8_mirror' }), { onChoice: async (rec, idx, info) => { if (rec.fx.some((e) => e.k === 'c8_mirror' && e.v === 3)) { fChoice = info.f; optsAt = info.opts.map((o) => o.text); } } });
    ok(r.end.includes('term'), '到達終結畫面');
    const t0 = await endInfo(p);
    let c = await reloadContinue(p);
    ok(c.end && c.end.cls.includes('term') && c.end.ttl === t0.ttl && !c.inGame, `重新整理後「繼續」回到終結畫面（${c.end && c.end.ttl}）`);
    await tapSel(p, '.se_btn[data-a=home]'); await p.waitForSelector('#vn_home .item');
    await tapSel(p, '#vn_home .item[data-a=continue]'); await p.waitForTimeout(1200);
    let e = await endInfo(p); ok(e && e.cls.includes('term'), '返回標題後再按「繼續」仍是終結畫面');
    await tapSel(p, '.se_btn[data-a=rewind]');
    await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 });
    const st = await H.state(p); const shown = await p.$$eval('#choices.on .vn_opt', (es) => es.map((x) => x.textContent));
    ok(JSON.stringify(st.f) === JSON.stringify(fChoice) && JSON.stringify(shown) === JSON.stringify(optsAt), `重開後「回到上一個選擇」：選項與數值正確（bond ${st.f.bond}）`);
    const s = await sfGet(p); ok(!s.endScr, '回溯後清除終結畫面記錄');
    c = await reloadContinue(p);
    await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }).catch(() => {});
    const onChoice = await p.$('#choices.on .vn_opt');
    ok(!c.end && c.inGame && !!onChoice, '之後「繼續」停在那個選擇');
    // 終結 → 儲思盆選別章 → 記錄清除
    await p.evaluate(async () => { const c = await import('./engine/core.js'); c.sf.endScr = { k: 'term', ch: 'ch1_08', id: 'end_mirror' }; c.saveSf(); });
    await H.startCh(p, 'ch1_03'); await p.waitForTimeout(1500);
    const s2 = await sfGet(p); ok(!s2.endScr, '從儲思盆開始別的章節會清除記錄');
    ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
    await p.context().close();
  }
  // 4) 舊版記錄相容
  {
    console.log('== 舊版「繼續」記錄（' + MODE + '）');
    const p = await H.newPage(b, MODE); await H.boot(p);
    await p.evaluate(async () => { const c = await import('./engine/core.js'); c.sf.cont = 'ch1_02'; delete c.sf.endScr; c.sf.unlocked = { ch1_01: 1, ch1_02: 1 }; c.saveSf(); });
    await reloadContinue(p);
    const g = await p.waitForFunction(() => window.VN.P.inGame && window.VN.P.state.ch === 'ch1_02', null, { timeout: 15000 }).then(() => true).catch(() => false);
    ok(g, '舊存的章節編號仍能「繼續」');
    await p.context().close();
  }
  await b.close();
})();
