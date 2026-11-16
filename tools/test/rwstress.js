// 回溯壓力測試：回溯後連點、Esc、快速反覆選擇與回溯、回溯後立刻返回標題
const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
const tapXY = async (p, x, y) => { if (p.mode === 'desktop') await p.mouse.click(x, y); else await p.touchscreen.tap(x, y); };
async function tap(p, sel, wait = 300) { await p.waitForSelector(sel, { timeout: 10000 }); await p.waitForTimeout(wait); const b = await (await p.$(sel)).boundingBox(); await tapXY(p, b.x + b.width / 2, b.y + b.height / 2); }
async function toChoice(p) { for (let i = 0; i < 3000; i++) { if (await p.$('#choices.on .vn_opt')) { await p.waitForTimeout(350); return true; } const s = await H.state(p); if (s.inGame && !s.skip) await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true))); await p.waitForTimeout(50); } return false; }
const info = (p) => p.evaluate(() => { const P = window.VN.P; return { pc: P.pc, line: P.script.cmds[P.pc] && P.script.cmds[P.pc].line, f: JSON.stringify(P.state.f), boxes: document.querySelectorAll('#choices.on').length, opts: document.querySelectorAll('#choices.on .vn_opt').length }; });
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p);
  const vp = p.viewportSize();
  await H.startCh(p, 'ch1_03', { bond: 50 }); await p.waitForTimeout(2000);
  await toChoice(p); const c1 = await info(p);
  await tap(p, '#choices.on .vn_opt'); await p.waitForTimeout(400);
  await toChoice(p); const c2 = await info(p);
  // 1) 回溯後連點 40 下＋空白鍵
  await tap(p, '#vn_toolbar [data-act=rewind]'); await tap(p, '.vn_cf_yes', 200);
  for (let i = 0; i < 40; i++) { await tapXY(p, vp.width / 2, vp.height * 0.3); if (i % 5 === 0) await p.keyboard.press('Space'); await p.waitForTimeout(15); }
  await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await p.waitForTimeout(500);
  let s = await info(p);
  ok(s.line === c1.line && s.f === c1.f && s.boxes === 1, `回溯後立刻連點 40 下＋空白鍵：停在正確選項，只有一組選項（第 ${s.line} 行）`);
  // 2) 確認框按 Esc
  await tap(p, '#choices.on .vn_opt'); await p.waitForTimeout(300);
  await toChoice(p); const before = await info(p);
  await tap(p, '#vn_toolbar [data-act=rewind]'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const cfOpen = !!(await p.$('#vn_confirm'));
  if (cfOpen) await tap(p, '.vn_cf_no', 100);
  s = await info(p);
  ok(s.line === before.line && s.f === before.f, `確認框按 Esc／取消：位置與數值不變（確認框${cfOpen ? '需按取消關閉' : '已用 Esc 關閉'}）`);
  // 3) 快速反覆「選擇→回溯」20 次
  let bad = 0;
  for (let k = 0; k < 20; k++) {
    const cur = await info(p);
    await tap(p, '#choices.on .vn_opt', 120);
    const gone = await p.waitForFunction(() => !document.querySelector('#choices.on'), null, { timeout: 3000 }).then(() => true).catch(() => false);
    if (!gone) { await tap(p, '#choices.on .vn_opt', 200); await p.waitForFunction(() => !document.querySelector('#choices.on'), null, { timeout: 3000 }); }
    await tap(p, '#vn_toolbar [data-act=rewind]', 60); await tap(p, '.vn_cf_yes', 80);
    const back = await p.waitForFunction((ln) => { const P = window.VN.P; return document.querySelector('#choices.on .vn_opt') && P.script.cmds[P.pc] && P.script.cmds[P.pc].line === ln; }, cur.line, { timeout: 8000 }).then(() => true).catch(() => false);
    const now = await info(p);
    if (!back || now.f !== cur.f || now.boxes !== 1) bad++;
  }
  ok(bad === 0, `快速反覆「選擇→回溯」20 次：每次都回到同一個選項、數值相同（失敗 ${bad} 次）`);
  // 4) 回溯中途返回標題，再繼續
  await tap(p, '#choices.on .vn_opt'); await p.waitForTimeout(300);
  const target = await p.evaluate(() => window.VN.P.lastChoice && window.VN.P.lastChoice.pc);
  await tap(p, '#vn_toolbar [data-act=rewind]'); await tap(p, '.vn_cf_yes', 100);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle()));
  await p.waitForSelector('#vn_home .item'); await p.waitForTimeout(500);
  await tap(p, '#vn_home .item[data-a=continue]');
  await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 10000 }); await p.waitForTimeout(1500);
  s = await info(p);
  ok(!!(await p.$('#choices.on .vn_opt')) && s.pc === target, '回溯途中返回標題 →「繼續」停在回溯到的選項');
  // 5) 回溯後立刻存檔，讀回來按鈕狀態正確
  const sv = await p.evaluate(async () => { const P = await import('./engine/player.js'); const s = await P.makeSave(); return s; });
  await p.evaluate(async (sv) => { const P = await import('./engine/player.js'); await P.loadSnap(sv.snap); }, sv);
  await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await p.waitForTimeout(500);
  const off = await p.$eval('#vn_toolbar [data-act=rewind]', (e) => e.classList.contains('off'));
  ok(off, '回溯後立刻存檔、讀回：按鈕仍是灰色（只退一步）');
  await tap(p, '#choices.on .vn_opt'); await p.waitForTimeout(500);
  ok(!(await p.$eval('#vn_toolbar [data-act=rewind]', (e) => e.classList.contains('off'))), '之後再選一次：按鈕恢復可按');
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
  await b.close();
})();
