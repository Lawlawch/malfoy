const H = require('./h.js');
const MODE = process.argv[2] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await H.chromium.launch();
  const p = await H.newPage(b, MODE); await H.boot(p);
  const tapEl = async (sel) => { await p.waitForSelector(sel, { timeout: 8000 }); const e = await p.$(sel); const bx = await e.boundingBox(); if (p.mode === 'desktop') await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); else await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); };
  const tapXY = async (x, y) => { if (p.mode === 'desktop') await p.mouse.click(x, y); else await p.touchscreen.tap(x, y); };
  const sfx = async (fn) => { await p.evaluate(() => { window.VN_SFX = []; }); await fn(); await p.waitForTimeout(450); return p.evaluate(() => window.VN_SFX.slice()); };
  const info = () => p.evaluate(() => { const v = document.querySelector('#vn_cgview'); if (!v) return null; const f = v.querySelector('.fr'), i = v.querySelector('.img'); return { w: parseFloat(f.style.width), h: parseFloat(f.style.height), pos: i.style.backgroundPosition, bg: !!i.style.backgroundImage, tg: v.querySelector('.tg').textContent, land: document.querySelector('.land') != null }; });
  await tapEl('#vn_home .item[data-a=gallery]');
  await p.evaluate(() => { [...document.querySelectorAll('.vn_debug span')][0].click(); });   // 測試用：全部解鎖
  await p.waitForTimeout(400);
  let s = await sfx(() => tapEl('.vn_cg_item:not(.locked):not(.blank)'));
  await p.waitForTimeout(500);
  let a = await info();
  const r = a.w / a.h;
  ok(a && a.bg && (a.land ? Math.abs(r - 16 / 9) < 0.01 : Math.abs(r - 9 / 16) < 0.01) && a.tg === '原圖', `打開：遊戲畫面比例 ${a.w.toFixed(0)}×${a.h.toFixed(0)}，焦點 ${a.pos}，按鈕「${a.tg}」，音效 ${JSON.stringify(s)}`);
  s = await sfx(() => tapEl('#vn_cgview .tg')); await p.waitForTimeout(400); a = await info();
  ok(a.w === a.h && a.pos === '50% 50%' && a.tg === '遊戲畫面' && JSON.stringify(s) === '["ui_click"]', `按「原圖」：方框 ${a.w.toFixed(0)}×${a.h.toFixed(0)}，按鈕「${a.tg}」，音效 ${JSON.stringify(s)}`);
  await p.screenshot({ path: `out/cgv_${MODE}_orig.png` });
  s = await sfx(() => tapEl('#vn_cgview .tg')); await p.waitForTimeout(400); a = await info();
  ok(a.w !== a.h && a.tg === '原圖', '再按「遊戲畫面」切回');
  await p.screenshot({ path: `out/cgv_${MODE}_fill.png` });
  s = await sfx(() => tapEl('#vn_cgview .img'));
  ok(!!(await info()) && JSON.stringify(s) === '[]', `點圖片本身：不關閉、不出聲 ${JSON.stringify(s)}`);
  s = await sfx(() => tapEl('#vn_cgview .cap'));
  ok(!!(await info()) && JSON.stringify(s) === '[]', '點說明文字：不關閉、不出聲');
  const vb = await (await p.$('#vn_cgview')).boundingBox();
  s = await sfx(() => tapXY(vb.x + 10, vb.y + vb.height - 10));
  ok(!(await info()) && JSON.stringify(s) === '["ui_close"]', `點圖框外的暗處：關閉 ${JSON.stringify(s)}`);
  await tapEl('.vn_cg_item:not(.locked):not(.blank)'); await p.waitForTimeout(400);
  a = await info(); ok(a.tg === '原圖', '再打開：從遊戲畫面開始');
  s = await sfx(() => p.keyboard.press('Escape'));
  ok(!(await info()) && JSON.stringify(s) === '["ui_close"]' && !!(await p.$('.vn_gallery')), `Esc：只關 CG 檢視，圖鑑還在 ${JSON.stringify(s)}`);
  await tapEl('.vn_cg_item:not(.locked):not(.blank)'); await p.waitForTimeout(400);
  s = await sfx(() => tapEl('#vn_cgview .vn_close_btn'));
  ok(!(await info()) && JSON.stringify(s) === '["ui_close"]', '按 ✕ 關閉');
  // 轉向：開著 CG 檢視時旋轉
  if (MODE !== 'desktop') {
    await tapEl('.vn_cg_item:not(.locked):not(.blank)'); await p.waitForTimeout(400);
    const vp = p.viewportSize(); await p.setViewportSize({ width: vp.height, height: vp.width }); await p.waitForTimeout(800);
    a = await info(); const r2 = a.w / a.h;
    ok(a.land ? Math.abs(r2 - 16 / 9) < 0.01 : Math.abs(r2 - 9 / 16) < 0.01, `開著時轉向：圖框跟著變成${a.land ? '橫' : '直'}框 ${JSON.stringify(a)}`);
    await p.screenshot({ path: `out/cgv_${MODE}_rot.png` });
    const n = await p.evaluate(async () => { const c = await import('./engine/core.js'); return c.G.onResize.length; });
    await tapEl('#vn_cgview .vn_close_btn'); await p.setViewportSize(vp); await p.waitForTimeout(600);
    const n2 = await p.evaluate(async () => { const c = await import('./engine/core.js'); return c.G.onResize.length; });
    ok(n2 <= n - 1, `關閉後移除轉向監聽（${n} → ${n2}）`);
  }
  ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.slice(0, 3).join(' | '));
  await b.close();
})();
