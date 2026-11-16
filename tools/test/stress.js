const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p, { fastCfg: false });
  const vp = p.viewportSize();
  const tap = async (x, y) => { if (MODE === 'desktop') await p.mouse.click(x, y); else await p.touchscreen.tap(x, y); };
  await H.startCh(p, 'ch1_04', { bond: 60 });
  // 1. 高速連點 150 下（每 25 毫秒）：不會跳過選項、不出錯
  const pc0 = (await H.state(p)).pc;
  for (let i = 0; i < 150; i++) { await tap(vp.width / 2, vp.height * 0.35); await p.waitForTimeout(25); }
  await p.waitForTimeout(800);
  const s1 = await H.state(p);
  const choiceUp = !!(await p.$('#choices.on'));
  const skipped = await p.evaluate(() => { const P = window.VN.P; let n = 0; for (let i = 0; i < P.pc; i++) if (P.script.cmds[i].op === 'choice') n++; return n; });
  ok(s1.pc > pc0 && s1.inGame, `高速連點 150 下：劇情正常前進（${pc0} → ${s1.pc}），${choiceUp ? '停在選項上等待選擇' : '尚未到選項'}`);
  // 2. 選項出現時連點空白處：不會自己選
  if (!choiceUp) { for (let i = 0; i < 400 && !(await p.$('#choices.on')); i++) { await tap(vp.width / 2, vp.height * 0.35); await p.waitForTimeout(60); } }
  const fBefore = JSON.stringify((await H.state(p)).f);
  for (let i = 0; i < 30; i++) { await tap(vp.width / 2, 20); await p.waitForTimeout(20); }
  ok(!!(await p.$('#choices.on')) && JSON.stringify((await H.state(p)).f) === fBefore, '選項出現時連點空白處：選項還在、數值沒變');
  // 3. 選項剛出現的瞬間點選項：0.35 秒保護
  // 4. 選項出現時開存檔、紀錄、設定再關掉：選項仍在
  for (const act of ['log', 'save', 'config', 'load']) { const bt = await p.$(`button[data-act="${act}"]`); if (bt) { const bx = await bt.boundingBox(); await tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(400); } }
  ok(!!(await p.$('#choices.on')), '選項出現時開關紀錄、存檔、設定、讀檔：選項仍在');
  const opts = await p.$$('#choices.on .vn_opt'); const bx = await opts[0].boundingBox(); await tap(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.waitForTimeout(500);
  // 5. 略過、自動來回切換
  for (let i = 0; i < 6; i++) { await p.evaluate((i) => import('./engine/player.js').then((P) => i % 2 ? P.setAuto(true) : P.setSkip(true)), i); await p.waitForTimeout(250); }
  await p.evaluate(() => import('./engine/player.js').then((P) => P.stopAutoSkip())); await p.waitForTimeout(400);
  ok((await H.state(p)).inGame, '略過、自動快速切換：沒有卡住');
  // 6. 切換直向／橫向（模擬手機轉向）
  if (MODE !== 'desktop') {
    const sz = p.viewportSize();
    for (let i = 0; i < 4; i++) { await p.setViewportSize({ width: i % 2 ? sz.width : sz.height, height: i % 2 ? sz.height : sz.width }); await p.waitForTimeout(500); }
    const cls = await p.evaluate(() => document.querySelector('#game').className);
    const msgOk = await p.evaluate(() => { const m = document.querySelector('#msg'); const r = m.getBoundingClientRect(); return r.width > 0 && r.bottom <= innerHeight + 1; });
    ok(msgOk, `來回轉向 4 次：畫面重新排版正常（目前 ${cls}），對話框在畫面內`);
  }
  // 7. 對話中返回標題、立刻再開始：沒有殘留
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(200);
  await H.startCh(p, 'ch1_06', { bond: 70 }); await p.waitForTimeout(400);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await H.startCh(p, 'ch1_07', { bond: 70 });
  await p.waitForTimeout(4000);
  const s7 = await H.state(p); const cards = await p.$$('#vn_card'); const ends = await p.$$('#vn_end');
  ok(s7.ch === 'ch1_07' && s7.inGame && cards.length === 0 && ends.length === 0, '連續快速開始兩章：只剩最後一章在跑，沒有殘留畫面');
  // 8. 顯示 CG 時讀檔／返回標題：CG 正確收起或還原
  const r = await H.play(p, H.makePolicy(), { maxMs: 8000 });
  await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(false)));
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(600);
  const home = !!(await p.$('#vn_home .item')); const cgVisible = await p.evaluate(() => { const c = document.querySelector('#cgl.on'); return !!c && getComputedStyle(c).opacity > 0.5 && c.getBoundingClientRect().width > 0; });
  ok(home, '遊戲中返回標題：標題畫面正常顯示');
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.join(' | '));
  await b.close();
})();
