// 卡頓測試：CPU 降速 4 倍（模擬手機），正常點擊遊玩，記錄畫面停頓（兩幀間隔 >120ms）與當時在做什麼
const H = require('./h.js');
const MODE = process.argv[2] || 'iphone-port', RATE = Number(process.argv[3] || 4), CHS = (process.argv[4] || 'ch1_01,ch1_07,ch1_11').split(',');
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE);
  const cdp = await p.context().newCDPSession(p);
  await H.boot(p, { fastCfg: false });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await p.evaluate(() => {
    window.__gaps = []; let last = performance.now();
    const what = () => { try { const P = window.VN && window.VN.P; if (!P || !P.script) return document.querySelector('.vn_overlay, #vn_panel') ? 'panel' : 'home'; const c = P.script.cmds[P.pc]; return (c ? c.op + (c.name ? ':' + c.name : c.id ? ':' + c.id : '') : '') + '@' + (c && c.line); } catch (e) { return '?'; } };
    const loop = (t) => { const d = t - last; if (d > 120) window.__gaps.push({ d: Math.round(d), at: what(), t: Math.round(t) }); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const vp = p.viewportSize();
  const tap = async (x, y) => { if (p.mode === 'desktop') await p.mouse.click(x, y); else await p.touchscreen.tap(x, y); };
  const results = [];
  for (const ch of CHS) {
    await H.startCh(p, ch, { bond: 60 });
    await p.waitForTimeout(2500);
    const lat = [];
    for (let i = 0; i < 70; i++) {
      if (await p.$('#vn_end')) break;
      if (await p.$('#choices.on .vn_opt')) { await p.waitForTimeout(400); const e = await p.$('#choices.on .vn_opt'); const bx = await e.boundingBox(); await tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(500); continue; }
      const before = await p.evaluate(() => window.VN.P.pc);
      const t0 = Date.now();
      await tap(vp.width / 2, vp.height * 0.3);
      // 點一下：打字中→補完；已補完→下一句。量「點下到畫面有反應」
      await p.waitForFunction((b) => window.VN.P.pc !== b || !document.querySelector('span.h'), before, { timeout: 5000 }).catch(() => {});
      lat.push(Date.now() - t0);
      await p.waitForTimeout(250);
    }
    lat.sort((a, b) => a - b);
    results.push(`${ch}：點擊反應 中位數 ${lat[Math.floor(lat.length / 2)]}ms、最慢 ${lat[lat.length - 1]}ms（${lat.length} 次）`);
  }
  // 面板開啟速度
  const panels = ['save', 'load', 'config', 'log'];
  for (const a of panels) {
    const t0 = Date.now();
    await p.evaluate((a) => import('./engine/screens.js').then((S) => (a === 'log' ? import('./engine/ui.js').then((u) => u.openLog()) : S.openPanel(a))), a);
    await p.waitForSelector('.vn_overlay, #vn_log.on, #vn_log', { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(50);
    results.push(`面板 ${a}：${Date.now() - t0}ms 出現`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    await p.evaluate(() => import('./engine/ui.js').then((u) => u.closeOverlays && u.closeOverlays()));
    await p.waitForTimeout(300);
  }
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(800);
  for (const a of ['chapters', 'gallery', 'load']) {
    const t0 = Date.now();
    await p.evaluate((a) => import('./engine/screens.js').then((S) => S.openPanel(a)), a);
    await p.waitForSelector('.vn_overlay', { timeout: 5000 }).catch(() => {});
    results.push(`標題畫面 ${a}：${Date.now() - t0}ms 出現`);
    await p.waitForTimeout(600);
    await p.evaluate(() => import('./engine/ui.js').then((u) => u.closeOverlays && u.closeOverlays())); await p.waitForTimeout(300);
  }
  const gaps = await p.evaluate(() => window.__gaps);
  const big = gaps.filter((g) => g.d >= 250);
  console.log(`== 卡頓測試（${MODE}，CPU 慢 ${RATE} 倍）`);
  results.forEach((r) => console.log('  ' + r));
  console.log(`  畫面停頓 >120ms：${gaps.length} 次；≥250ms：${big.length} 次`);
  const by = {}; for (const g of gaps) { const k = g.at.replace(/@\d+$/, ''); (by[k] = by[k] || []).push(g.d); }
  for (const [k, v] of Object.entries(by).sort((a, b) => Math.max(...b[1]) - Math.max(...a[1])).slice(0, 15)) console.log(`    ${k}：${v.length} 次，最長 ${Math.max(...v)}ms`);
  console.log('  錯誤：' + (p.errs.length ? p.errs.slice(0, 5).join(' | ') : '無'));
  await b.close();
})();
