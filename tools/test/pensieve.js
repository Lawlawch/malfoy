const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
async function tapEl(p, e) { if (typeof e === 'string') e = await p.$(e); const bx = await e.boundingBox(); if (p.mode === 'desktop') await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); else await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); }
const rows = (p) => p.evaluate(async () => { (await import('./engine/screens.js')).openPanel('chapters'); await new Promise((r) => setTimeout(r, 700)); const r = [...document.querySelectorAll('.vn_ch_row')].slice(0, 5).map((e) => e.classList.contains('locked') ? '鎖' : (e.querySelector('.done') ? '已讀' : '開')); return r; });
const closePanel = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
const sfGet = (p) => p.evaluate(async () => { const c = await import('./engine/core.js'); return JSON.parse(JSON.stringify({ chStart: c.sf.chStart || {}, done: c.sf.done || {}, unlocked: c.sf.unlocked || {}, cgs: c.sf.cgsSeen || {}, head: c.sf.head })); });
async function pickChapter(p, n) {   // 從儲思盆點第 n 章（有確認框就按開始）
  await p.evaluate(async () => (await import('./engine/screens.js')).openPanel('chapters')); await p.waitForTimeout(700);
  const r = (await p.$$('.vn_ch_row'))[n - 1]; await tapEl(p, r); await p.waitForTimeout(500);
  let note = null;
  if (await p.$('#vn_confirm')) { note = await p.$eval('#vn_confirm .vn_cf_sub', (e) => e.textContent).catch(() => ''); await tapEl(p, '#vn_confirm .vn_cf_yes'); }
  await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 15000 });
  return note;
}
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p);
  await H.startCh(p, 'ch1_01', null, true);
  // 第一章中途
  const half = await H.play(p, H.makePolicy(), { maxMs: 3500 });
  await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(false)));
  let s = await sfGet(p);
  const midRows = await rows(p); await closePanel(p);
  ok(midRows[0] === '開' && midRows[1] === '鎖', `第一章玩到一半：第一章可選但未讀（${midRows[0]}）、第二章上鎖（${midRows[1]}）`);
  ok(!!s.cgs.cg_robeshop, '看過的 CG（長袍店的初遇）已在圖鑑解鎖');
  // 第一章玩完（策略一：羈絆最大）
  const r1 = await H.play(p, H.makePolicy());
  const F1 = (await H.state(p)).f;
  s = await sfGet(p);
  const endRows = await rows(p); await closePanel(p);
  ok(r1.end.includes('chend') && endRows[0] === '已讀' && endRows[1] === '開' && endRows[2] === '鎖', `第一章完成：第一章已讀、第二章解鎖未讀、第三章上鎖（${endRows.slice(0, 3).join('、')}）`);
  ok(JSON.stringify(s.chStart.ch1_02) === JSON.stringify(F1), `第二章的開始數值＝第一章結束時（羈絆 ${F1.bond}）`);
  // 第二章玩完 → 第三章
  await (await p.$('.se_btn[data-a=next]')).click(); await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 15000 });
  const st2 = await H.state(p);
  ok(JSON.stringify(st2.f) === JSON.stringify(F1), '按「下一章」進入第二章：沿用第一章結束時的數值');
  await H.play(p, H.makePolicy());
  const F3start = (await H.state(p)).f;
  await (await p.$('.se_btn[data-a=home]')).click(); await p.waitForTimeout(600);
  // 重玩第一章（策略二：隨機），玩完後第二章的開始數值要更新
  const note1 = await pickChapter(p, 1);
  const r1b = await H.play(p, H.makePolicy({ mode: 'random' }));
  const F1b = (await H.state(p)).f;
  s = await sfGet(p);
  ok(JSON.stringify(s.chStart.ch1_02) === JSON.stringify(F1b), `重玩第一章後，第二章的開始數值更新為最近一次（羈絆 ${F1.bond} → ${F1b.bond}，選擇 ${r1b.log.map((x) => x.picked.slice(0, 6)).join('／')}）`);
  ok(JSON.stringify(s.chStart.ch1_03) === JSON.stringify(F3start), '第三章仍保留上一次抵達時的數值（舊時間線）');
  await (await p.$('.se_btn[data-a=home]')).click(); await p.waitForTimeout(600);
  // 從儲思盆選第二章：用最近一次的數值
  await pickChapter(p, 2);
  const st2b = await H.state(p);
  ok(JSON.stringify(st2b.f) === JSON.stringify(F1b), `儲思盆選第二章：數值與旗標＝最近一次抵達第二章時（羈絆 ${st2b.f.bond}）`);
  // 第二章中途改了數值後離開，再選第二章：仍用抵達時的數值
  const half2 = await H.play(p, H.makePolicy({ mode: 'random' }), { maxMs: 6000 });
  await p.evaluate(() => import('./engine/player.js').then((P) => { P.setSkip(false); P.quitToTitle(); })); await p.waitForTimeout(600);
  await pickChapter(p, 2);
  const st2c = await H.state(p);
  ok(JSON.stringify(st2c.f) === JSON.stringify(F1b), `第二章中途離開（選了 ${half2.log.length} 個選項）再選第二章：仍是抵達時的數值`);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(600);
  // 從儲思盆選第三章（比目前時間線後面）：提示沿用先前的進度，並用第三章上次抵達時的數值
  const note3 = await pickChapter(p, 3);
  const st3 = await H.state(p);
  ok(/沿用先前的進度/.test(note3 || '') && JSON.stringify(st3.f) === JSON.stringify(F3start), `選第三章：提示「${(note3 || '').split('\n')[0]}」，數值＝上一次抵達第三章時（羈絆 ${st3.f.bond}）`);
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.join(' | '));
  await b.close();
})();
