const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
async function tapEl(p, sel) { const e = typeof sel === 'string' ? await p.$(sel) : sel; const bx = await e.boundingBox(); if (p.mode === 'desktop') await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); else await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); }
const snapState = (p) => p.evaluate(() => { const P = window.VN.P; return { ch: P.state.ch, pc: P.pc, f: JSON.stringify(P.state.f), bg: P.state.stage.bg, ch2: JSON.stringify((P.state.stage.charas || []).map((c) => c.id + ':' + c.face)), cg: P.state.stage.cg || '', line: document.querySelector('#msg .txt') ? document.querySelector('#msg .txt').textContent : '', choices: [...document.querySelectorAll('#choices.on .vn_opt')].map((e) => e.textContent).join('|') }; });
async function advanceN(p, n) { for (let i = 0; i < n; i++) { if (await p.$('#choices.on')) return; const vp = p.viewportSize(); if (p.mode === 'desktop') await p.mouse.click(640, 250); else await p.touchscreen.tap(vp.width / 2, vp.height * 0.35); await p.waitForTimeout(350); } }
async function untilChoice(p, max = 400) { for (let i = 0; i < max && !(await p.$('#choices.on .vn_opt')); i++) { const vp = p.viewportSize(); if (p.mode === 'desktop') await p.mouse.click(640, 250); else await p.touchscreen.tap(vp.width / 2, vp.height * 0.35); await p.waitForTimeout(90); } await p.waitForTimeout(450); }
async function pick(p, i) { const e = (await p.$$('#choices.on .vn_opt'))[i]; await tapEl(p, e); await p.waitForFunction(() => !document.querySelector('#choices.on'), null, { timeout: 5000 }); }
async function saveTo(p, n) { await tapEl(p, 'button[data-act="save"]'); await p.waitForSelector('.vn_slot'); const slots = await p.$$('.vn_slot'); const had = !(await slots[n - 1].evaluate((e) => e.classList.contains('empty'))); await tapEl(p, slots[n - 1]); if (had) { await p.waitForSelector('#vn_confirm'); await tapEl(p, '#vn_confirm .vn_cf_yes'); } await p.waitForTimeout(800); await p.keyboard.press('Escape'); await p.waitForTimeout(400); }
async function loadFrom(p, n, fromHome) { if (fromHome) await p.evaluate(async () => (await import('./engine/screens.js')).openPanel('load')); else await tapEl(p, 'button[data-act="load"]'); await p.waitForSelector('.vn_slot'); await p.waitForTimeout(500); const slots = await p.$$('.vn_slot'); await tapEl(p, slots[n - 1]); await p.waitForFunction(() => window.VN.P.inGame && !document.querySelector('.vn_scr'), null, { timeout: 10000 }); await p.waitForTimeout(1500); }
const same = (a, b, keys) => keys.every((k) => a[k] === b[k]);
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p, { fastCfg: false });
  await p.evaluate(async () => { const c = await import('./engine/core.js'); c.cfg().text = 3; c.saveSf(); });
  const cfBtn = await p.evaluate(() => 0);
  await H.startCh(p, 'ch1_01', null, true);
  await untilChoice(p); await pick(p, 0); await advanceN(p, 4);
  const S1 = await snapState(p);
  await saveTo(p, 1);
  ok(true, `存入 No.01：${S1.ch} 第 ${S1.pc} 條指令、背景 ${S1.bg}、台詞「${S1.line.slice(0, 16)}…」`);
  await untilChoice(p); const S2c = await snapState(p);
  await saveTo(p, 2);
  await pick(p, 1); await advanceN(p, 6);
  const mid = await snapState(p);
  ok(mid.pc !== S1.pc, '繼續玩之後狀態已改變');
  await loadFrom(p, 1);
  const L1 = await snapState(p);
  ok(same(L1, S1, ['ch', 'pc', 'f', 'bg', 'ch2', 'line']), `讀 No.01：位置、數值、背景、立繪、台詞都和存檔時相同${same(L1, S1, ['ch', 'pc', 'f', 'bg', 'ch2', 'line']) ? '' : JSON.stringify({ L1, S1 })}`);
  await loadFrom(p, 2);
  const L2 = await snapState(p);
  ok(L2.choices === S2c.choices && L2.f === S2c.f && L2.pc === S2c.pc, `讀 No.02（停在選項上）：選項重新出現、數值相同（${L2.choices.split('|').length} 個選項）`);
  // 重新整理網頁：存檔仍在、讀取正確；自動存檔「繼續」
  await pick(p, 0); await advanceN(p, 3);
  const beforeReload = await snapState(p);
  await p.reload(); await p.waitForSelector('#vn_home .item');
  const hasCont = await p.evaluate(() => import('./engine/player.js').then((P) => P.hasContinue()));
  await p.evaluate(() => import('./engine/player.js').then((P) => P.doContinue()));
  await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 10000 }); await p.waitForTimeout(1500);
  const C = await snapState(p);
  ok(hasCont && same(C, beforeReload, ['ch', 'pc', 'f', 'bg', 'line']), `重新整理後「繼續」回到離開時那一句（第 ${C.pc} 條）`);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(600);
  await loadFrom(p, 1, true);
  const L1b = await snapState(p);
  ok(same(L1b, S1, ['ch', 'pc', 'f', 'bg', 'line']), '重新整理後從標題讀 No.01：內容正確');
  // 覆蓋與刪除
  await advanceN(p, 2); const S3 = await snapState(p); await saveTo(p, 1);
  await loadFrom(p, 2); await loadFrom(p, 1);
  ok(same(await snapState(p), S3, ['pc', 'f', 'line']), '覆蓋 No.01 後讀到的是新內容');
  await tapEl(p, 'button[data-act="load"]'); await p.waitForSelector('.vn_slot'); await p.waitForTimeout(400);
  await tapEl(p, (await p.$$('.vn_slot .del'))[1]); await p.waitForSelector('#vn_confirm');
  await tapEl(p, '#vn_confirm .vn_cf_yes'); await p.waitForTimeout(700);
  const empty2 = await p.$$eval('.vn_slot', (es) => es[1].classList.contains('empty'));
  ok(empty2, '刪除 No.02 後變成空格');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 跨章讀檔：在第三章讀第一章的存檔
  await H.startCh(p, 'ch1_03', { bond: 55 }); await p.waitForTimeout(3500); await advanceN(p, 3);
  await loadFrom(p, 1);
  const X = await snapState(p);
  ok(X.ch === 'ch1_01' && same(X, S3, ['pc', 'f', 'line']), '在第三章讀第一章的存檔：正確回到第一章');
  // 連點兩下讀檔：不會讀兩次或卡住
  await tapEl(p, 'button[data-act="load"]'); await p.waitForSelector('.vn_slot'); await p.waitForTimeout(400);
  const s1 = (await p.$$('.vn_slot'))[0]; await s1.click({ clickCount: 2 }).catch(() => {});
  await p.waitForTimeout(2500);
  const Y = await snapState(p);
  ok(same(Y, S3, ['pc', 'f']) && !(await p.$('.vn_scr')), '連點兩下讀檔：狀態正確，沒有卡住');
  // 略過中存檔
  await p.evaluate(async () => { const c = await import('./engine/core.js'); c.cfg().skipRead = 0; (await import('./engine/player.js')).setSkip(true); });
  await p.waitForTimeout(700);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(false))); await p.waitForTimeout(400);
  const Z = await snapState(p); await saveTo(p, 3); await advanceN(p, 3); await loadFrom(p, 3);
  ok(same(await snapState(p), Z, ['pc', 'f']), '略過之後存檔、讀檔正確');
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.join(' | '));
  await b.close();
})();
