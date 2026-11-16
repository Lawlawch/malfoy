// 一步回溯：工具列「回溯」
const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
async function tap(p, sel) {
  await p.waitForSelector(sel, { timeout: 10000 }); await p.waitForTimeout(350);
  const e = await p.$(sel);
  if (p.mode === 'desktop') await e.click({ force: true }); else { const b = await e.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
}
const btnOff = (p) => p.$eval('#vn_toolbar [data-act=rewind]', (e) => e.classList.contains('off'));
const opts = (p) => p.$$eval('#choices.on .vn_opt', (es) => es.map((e) => e.textContent));
async function toChoice(p) {
  for (let i = 0; i < 4000; i++) {
    if (await p.$('#choices.on .vn_opt')) { await p.waitForTimeout(400); return true; }
    if (await p.$('#vn_end')) return false;
    const s = await H.state(p); if (s.inGame && !s.skip) await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true)));
    await p.waitForTimeout(60);
  }
  return false;
}
async function pick(p, i) { const els = await p.$$('#choices.on .vn_opt'); if (p.mode === 'desktop') await els[i].click(); else { const b = await els[i].boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } await p.waitForFunction(() => !document.querySelector('#choices.on')); await p.waitForTimeout(300); }
async function stepLines(p, n) { for (let i = 0; i < n; i++) { await p.evaluate(() => import('./engine/player.js').then((P) => { P.advance(); P.advance(); })); await p.waitForTimeout(120); } }
async function doRewind(p, yes = true) { await tap(p, '#vn_toolbar [data-act=rewind]'); await tap(p, yes ? '.vn_cf_yes' : '.vn_cf_no'); if (yes) await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await p.waitForTimeout(500); }
const choiceInfo = (p) => p.evaluate(() => { const P = window.VN.P; return { pc: P.pc, f: JSON.parse(JSON.stringify(P.state.f)) }; });
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p);
  await H.startCh(p, 'ch1_01', null, true); await p.waitForTimeout(2500);
  ok(await btnOff(p), '章節開頭沒有選擇：「回溯」是灰色');
  const pc0 = (await H.state(p)).pc;
  await tap(p, '#vn_toolbar [data-act=rewind]'); await p.waitForTimeout(400);
  ok(!(await p.$('#vn_confirm')) && (await H.state(p)).pc === pc0, '灰色時按下：只提示，不跳確認框、不改位置');
  await toChoice(p);
  const c1 = await choiceInfo(p), o1 = await opts(p);
  ok(await btnOff(p), '停在本章第一個選項：「回溯」是灰色（前面沒有選擇）');
  await pick(p, 0); await stepLines(p, 3);
  ok(!(await btnOff(p)), '選了之後在台詞中：「回溯」可按');
  const before = await H.state(p);
  await doRewind(p, false);
  const after = await H.state(p);
  ok(after.pc === before.pc && JSON.stringify(after.f) === JSON.stringify(before.f) && !(await p.$('#choices.on')), '按「取消」：什麼都不變');
  await doRewind(p, true);
  let st = await choiceInfo(p);
  ok(st.pc === c1.pc && JSON.stringify(st.f) === JSON.stringify(c1.f) && JSON.stringify(await opts(p)) === JSON.stringify(o1), `回溯：回到第一個選擇，選項與數值相同（bond ${st.f.bond}）`);
  ok(await btnOff(p), '回溯後（只退一步）：「回溯」變灰色');
  // 改選另一個，羈絆照新選項計算
  const fx = await p.evaluate(() => { const P = window.VN.P; return P.script.cmds[P.pc].opts.map((o) => o.fx); });
  const alt = o1.length > 1 ? 1 : 0;
  await pick(p, alt);
  const d = H.bondDelta(fx[alt]); const exp = d.set !== null ? d.set : Math.max(0, Math.min(100, (c1.f.bond || 0) + d.d));
  ok((await H.state(p)).f.bond === exp, `回溯後改選另一項：羈絆 ${(await H.state(p)).f.bond}（應為 ${exp}）`);
  // 第二個選項：停在選項上回溯 → 回到第一個
  const c1b = await choiceInfo(p); // 位置在選項後
  await toChoice(p);
  const c2 = await choiceInfo(p), o2 = await opts(p);
  ok(!(await btnOff(p)), '停在第二個選項上：「回溯」可按');
  await doRewind(p, true);
  st = await choiceInfo(p);
  ok(st.pc === c1.pc && JSON.stringify(st.f) === JSON.stringify(c1.f), '停在選項上回溯：回到前一個選擇（第一個）');
  ok(await btnOff(p), '之後「回溯」變灰色');
  // 走到第二個選項之後幾句，存檔、重新整理、繼續、回溯
  await pick(p, 0); await toChoice(p);
  const c2b = await choiceInfo(p), o2b = await opts(p);
  await pick(p, 0); await stepLines(p, 3);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(false)));
  const save = await p.evaluate(async () => { const P = await import('./engine/player.js'); await new Promise((r) => setTimeout(r, 300)); return await P.makeSave(); });
  await p.reload(); await p.waitForSelector('#vn_home .item');
  await tap(p, '#vn_home .item[data-a=continue]'); await p.waitForFunction(() => window.VN.P.inGame); await p.waitForTimeout(1500);
  ok(!(await btnOff(p)), '重新整理後「繼續」：「回溯」可按');
  await doRewind(p, true);
  st = await choiceInfo(p);
  ok(st.pc === c2b.pc && JSON.stringify(st.f) === JSON.stringify(c2b.f) && JSON.stringify(await opts(p)) === JSON.stringify(o2b), '重新整理後回溯：回到正確的選擇');
  // 讀手動存檔後回溯
  await p.evaluate(async (s) => { const P = await import('./engine/player.js'); P.quitToTitle(); await P.loadSnap(s.snap); }, save);
  await p.waitForFunction(() => window.VN.P.inGame); await p.waitForTimeout(1200);
  ok(!(await btnOff(p)), '讀手動存檔後：「回溯」可按');
  await doRewind(p, true);
  st = await choiceInfo(p);
  ok(st.pc === c2b.pc && JSON.stringify(st.f) === JSON.stringify(c2b.f), '讀檔後回溯：回到正確的選擇');
  // 略過中按回溯
  await pick(p, 0);
  await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true))); await p.waitForTimeout(150);
  if (!(await p.$('#choices.on'))) {
    await tap(p, '#vn_toolbar [data-act=rewind]');
    const sk = (await H.state(p)).skip;
    await tap(p, '.vn_cf_yes'); await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await p.waitForTimeout(400);
    ok(!sk && (await choiceInfo(p)).pc === c2b.pc, '略過中按「回溯」：先停下略過，回溯正確');
  }
  // 連點回溯＋確認
  await pick(p, 0); await stepLines(p, 2);
  await tap(p, '#vn_toolbar [data-act=rewind]'); await p.waitForTimeout(300);
  const yes = await p.$('.vn_cf_yes'); await yes.click(); await yes.click().catch(() => {});
  await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await p.waitForTimeout(800);
  ok((await choiceInfo(p)).pc === c2b.pc && (await p.$$('#choices.on .vn_opt')).length === o2b.length, '連點確認：狀態正確，沒有卡住');
  // 新的一章：不能退回上一章
  await H.startCh(p, 'ch1_02'); await p.waitForTimeout(2500);
  ok(await btnOff(p), '進入下一章開頭：「回溯」是灰色（不會退回上一章）');
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
  await p.context().close();
  // 終結後回到上一個選擇：不能再回溯
  {
    const q = await H.newPage(b, MODE); await H.boot(q);
    await H.startCh(q, 'ch1_08', { bond: 70 });
    const r = await H.play(q, H.makePolicy({ forceTerminal: 'c8_mirror' }));
    ok(r.end.includes('term'), '第八章到達終結');
    await tap(q, '.se_btn[data-a=rewind]'); await q.waitForSelector('#choices.on .vn_opt', { timeout: 10000 }); await q.waitForTimeout(600);
    ok(await btnOff(q), '終結→回到上一個選擇後：「回溯」是灰色（已用掉一步）');
    ok(q.errs.length === 0, '沒有錯誤 ' + q.errs.slice(0, 3).join(' | '));
    await q.context().close();
  }
  await b.close();
})();
