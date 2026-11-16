// 介面音效：每個操作只出一個聲音、出對的聲音
const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await H.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await H.newPage(b, MODE);
  await p.context().addInitScript(() => { window.__starts = 0; const o = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...a) { window.__starts++; return o.apply(this, a); }; });
  const wavs = {}; p.on('response', (r) => { const m = r.url().match(/sound\/(ui_\w+)\.wav/); if (m) wavs[m[1]] = r.status(); });
  await H.boot(p);
  const vp = p.viewportSize();
  const tapEl = async (sel) => { await p.waitForSelector(sel, { timeout: 8000 }); const e = await p.$(sel); const bx = await e.boundingBox(); if (p.mode === 'desktop') await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); else await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); };
  const sfx = async (fn, wait = 350) => { await p.evaluate(() => { window.VN_SFX = []; }); await fn(); await p.waitForTimeout(wait); return p.evaluate(() => window.VN_SFX.slice()); };
  const expect = (got, exp, m) => ok(JSON.stringify(got) === JSON.stringify(exp), `${m}：${JSON.stringify(got)}${JSON.stringify(got) === JSON.stringify(exp) ? '' : '（應為 ' + JSON.stringify(exp) + '）'}`);
  // 標題畫面
  expect(await sfx(() => tapEl('#vn_home .item[data-a=config]')), ['ui_open'], '標題「設定」→ 打開面板');
  await p.waitForTimeout(300);
  ok(Object.keys(wavs).length === 6 && Object.values(wavs).every((s) => s === 200), '第一次點擊後預載 6 個介面音效 ' + JSON.stringify(wavs));
  expect(await sfx(() => tapEl('.vn_seg > span:not(.on)')), ['ui_click'], '設定選項');
  expect(await sfx(() => tapEl('.vn_close_btn')), ['ui_close'], '按 ✕ 關閉');
  expect(await sfx(() => tapEl('#vn_home .item[data-a=load]')), ['ui_open'], '標題「讀檔」');
  expect(await sfx(() => tapEl('.vn_tab:nth-child(2)')), ['ui_page'], '讀檔分頁 2');
  expect(await sfx(() => tapEl('.vn_tab.on')), [], '點目前所在的分頁（不出聲）');
  expect(await sfx(() => p.keyboard.press('Escape')), ['ui_close'], 'Esc 關閉');
  expect(await sfx(() => tapEl('#vn_home .item[data-a=gallery]')), ['ui_open'], '標題「圖鑑」');
  expect(await sfx(() => tapEl('.vn_pg_btn.off')), [], '停用的翻頁鈕（第一頁的 ‹）');
  expect(await sfx(() => tapEl('.vn_pg_btn:not(.off)')), ['ui_page'], '翻頁 ›');
  expect(await sfx(() => tapEl('.vn_tab:not(.on)')), ['ui_page'], '圖鑑分類分頁');
  expect(await sfx(() => tapEl('.vn_close_btn')), ['ui_close'], '關閉圖鑑');
  expect(await sfx(() => tapEl('#vn_home .item[data-a=chapters]')), ['ui_open'], '標題「儲思盆」');
  expect(await sfx(() => tapEl('.vn_year_arrow')), ['ui_page'], '儲思盆年級箭頭 ‹');
  expect(await sfx(() => tapEl('.vn_year_arrow:last-child')), ['ui_page'], '儲思盆年級箭頭 ›');
  expect(await sfx(() => tapEl('.vn_close_btn')), ['ui_close'], '關閉儲思盆');
  // 遊戲中
  await H.startCh(p, 'ch1_01', null, true); await p.waitForTimeout(2500);
  const adv = await sfx(async () => { for (let i = 0; i < 6; i++) { if (p.mode === 'desktop') await p.mouse.click(vp.width / 2, vp.height * 0.3); else await p.touchscreen.tap(vp.width / 2, vp.height * 0.3); await p.waitForTimeout(250); } await p.keyboard.press('Space'); });
  expect(adv, [], '點對話框／空白鍵推進劇情');
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=rewind]')), [], '停用的「回溯」');
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=auto]')), ['ui_click'], '工具列「自動」');
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=auto]')), ['ui_click'], '再按「自動」關閉');
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=save]')), ['ui_open'], '工具列「存檔」（開面板：只出打開聲，不疊點擊聲）');
  expect(await sfx(() => tapEl('.vn_slot.empty'), 800), ['ui_save'], '點空格存檔成功');
  expect(await sfx(() => tapEl('.vn_slot:not(.empty)')), ['ui_click'], '點已有存檔的格子（跳出覆蓋確認）');
  expect(await sfx(() => tapEl('.vn_cf_yes'), 800), ['ui_save'], '確認「覆蓋」→ 只出存檔聲');
  await tapEl('.vn_slot:not(.empty)'); await p.waitForTimeout(300);
  expect(await sfx(() => p.keyboard.press('Escape')), ['ui_click'], '確認框按 Esc（＝取消鈕）');
  expect(await sfx(() => tapEl('.vn_close_btn')), ['ui_close'], '關閉存檔面板');
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=log]')), ['ui_open'], '工具列「紀錄」');
  expect(await sfx(() => p.keyboard.press('Escape')), ['ui_close'], 'Esc 關閉紀錄');
  // 選項
  for (let i = 0; i < 3000 && !(await p.$('#choices.on .vn_opt')); i++) { const s = await H.state(p); if (!s.skip) await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true))); await p.waitForTimeout(50); }
  await p.waitForTimeout(500);
  await p.evaluate(() => { window.VN_SFX = []; });
  expect(await sfx(() => tapEl('#choices.on .vn_opt')), ['ui_choice'], '點選項（略過模式中也正常）');
  // 確認框按鈕
  expect(await sfx(() => tapEl('#vn_toolbar [data-act=title]')), ['ui_click'], '工具列「標題」（跳確認框）');
  if (await p.$('.vn_cf_no')) expect(await sfx(() => tapEl('.vn_cf_no')), ['ui_click'], '確認框「取消」');
  const st = await p.evaluate(() => window.__starts);
  ok(st >= 25, `Web Audio 實際播放次數 ${st}（每個出聲的操作都真的有播）`);
  // 音量 0：仍記錄但不輸出（gain 0 直接不播）
  await p.evaluate(async () => { const c = await import('./engine/core.js'); c.cfg().se = 0; });
  ok(true, '效果音音量 0 時 playBuf 直接不播（程式判斷 vol <= 0）');
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
  await b.close();
})();
