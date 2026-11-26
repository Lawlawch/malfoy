const H = require('./h.js');
const OUT = process.argv[2], MODE = process.argv[3] || 'desktop';
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
const CASES = [
  ['第五章 路線A 三頭犬', 'ch1_05', { bond: 60, c4_go: 1 }, 'c5_fluffy', 'ch1_06', 'end_ward', '缺席的一年'],
  ['第五章 路線B 三頭犬', 'ch1_05', { bond: 60, c4_go: 2 }, 'c5_fluffy', 'ch1_06', 'end_ward', '缺席的一年'],
  ['第六章 山怪', 'ch1_06', { bond: 70, c5_broom: 1 }, 'c6_troll', 'ch1_07', 'end_ward', '缺席的一年'],
  ['第八章 第二晚自己去', 'ch1_08', { bond: 70 }, 'c8_mirror', 'ch1_09', 'end_mirror', '沉淪鏡中'],
  ['第十章 馬份組', 'ch1_10', { bond: 88, c9_route: 1, c9_ask: 1 }, 'c10_shadow', 'ch1_11', 'end_death', '沒有活下來的男孩', { c10_trust: 2, c10_team: 1 }],
  ['第十章 妙麗組', 'ch1_10', { bond: 60, c9_route: 1 }, 'c10_shadow', 'ch1_11', 'end_death', '沒有活下來的男孩', { c10_team: 2 }],
  ['第十章 奈威組', 'ch1_10', { bond: 60, c9_route: 1 }, 'c10_shadow', 'ch1_11', 'end_death', '沒有活下來的男孩', { c10_team: 3 }],
  ['第十章 潘西組', 'ch1_10', { bond: 40, c9_route: 2 }, 'c10_shadow', 'ch1_11', 'end_death', '沒有活下來的男孩', { c10_team: 1 }],
  ['第十一章 丟出魔法石', 'ch1_11', { bond: 92, c10_end: 1, c10_tell: 1, c10_trust: 2, c8_mirror: 1 }, 'c11_fight', 'ch1_12', 'end_death', '沒有活下來的男孩'],
];
const only = process.argv[4];
(async () => {
  const b = await H.chromium.launch();
  for (const [name, ch, flags, term, next, endId, title, targets] of CASES) {
    if (only && !name.includes(only)) continue;
    console.log('== ' + name + '（' + MODE + '）');
    const p = await H.newPage(b, MODE); await H.boot(p);
    const before = await p.evaluate(async (next) => { const c = await import('./engine/core.js'); c.sf.unlocked = c.sf.unlocked || {}; delete c.sf.unlocked[next]; if (c.sf.chStart) delete c.sf.chStart[next]; c.sf.head = 0; c.saveSf(); return { head: c.sf.head }; }, next);
    await H.startCh(p, ch, flags);
    let fChoice = null, optsAt = null, termIdx = -1, saved = false;
    const r = await H.play(p, H.makePolicy({ forceTerminal: term, targets: targets || {} }), {
      onChoice: async (rec, idx, info) => {
        if (rec.fx.some((e) => e.k === term && H.TERMINAL_FX[term] === e.v)) {
          fChoice = info.f; optsAt = info.opts.map((o) => o.text); termIdx = idx;
          if (name.includes('山怪')) {   // 在終結分支裡手動存檔，之後讀回來測試回溯
            await p.waitForTimeout(300);
            saved = await p.evaluate(async () => { const P = await import('./engine/player.js'); P.setSkip(false); await new Promise((r) => setTimeout(r, 300)); const s = await P.makeSave(); window.__save = s; return !!(s && s.snap.lc); });
          }
        }
      }
    });
    ok(r.end.includes('term'), `觸發終結頁面（${r.end}）`);
    if (!r.end.includes('term')) { console.log(r.log.map((x) => x.picked)); await p.context().close(); continue; }
    await p.waitForTimeout(1200);
    if (OUT) await p.screenshot({ path: `${OUT}/term_${MODE}_${ch}_${name.slice(-4)}.png` });
    const info = await p.evaluate(async ([next, endId]) => {
      const c = await import('./engine/core.js'); const e = document.querySelector('#vn_end'); const P = window.VN.P;
      const a = await c.db.get('snap', 'auto');
      const inView = [...e.querySelectorAll('.se_btn')].every((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
      return { ttl: e.querySelector('.ettl').textContent, tag: e.querySelector('.etag').textContent, head: e.querySelector('.head').textContent.trim(), line: e.querySelector('.eline').textContent, btns: [...e.querySelectorAll('.se_btn')].map((x) => x.dataset.a), inView,
        unlockedNext: !!c.sf.unlocked[next], chStartNext: !!(c.sf.chStart && c.sf.chStart[next]), head2: c.sf.head, done: !!(c.sf.done && c.sf.done[P.state.ch]), cont: c.sf.cont || null, ending: !!(c.sf.endings && c.sf.endings[endId]),
        endY: Object.keys(P.state.f).filter((k) => /^end_y/.test(k)), autoOp: a && P.script.cmds[a.pc].op, autoF: a && a.f };
    }, [next, endId]);
    ok(info.ttl === title && info.tag === '終結', `終結頁標題：${info.tag}／${info.ttl}`);
    ok(info.line.length > 0 && info.head.includes('第'), `語句與章節：${info.head}｜${info.line.replace(/\n/g, '／')}`);
    ok(info.btns.join() === 'home,pensieve,rewind' && info.inView, `按鈕：返回標題、儲思盆、回到上一個選擇（全在畫面內 ${info.inView}）`);
    ok(!info.unlockedNext && !info.chStartNext && info.head2 === +ch.slice(-2) && !info.done && !info.cont, `沒有解鎖下一章（unlocked ${info.unlockedNext}、chStart ${info.chStartNext}、時間線停在第 ${info.head2} 章、已讀 ${info.done}、繼續 ${info.cont}）`);
    ok(info.ending && info.endY.length === 0, `圖鑑解鎖 ${endId}、沒寫年級結局旗標`);
    ok(info.autoOp === 'choice' && JSON.stringify(info.autoF) === JSON.stringify(fChoice), '自動存檔改回觸發終結的選擇，數值與選擇前相同');
    // 回到上一個選擇
    await (await p.$('.se_btn[data-a=rewind]')).click();
    await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 });
    const st = await H.state(p);
    const shown = await p.$$eval('#choices.on .vn_opt', (es) => es.map((e) => e.textContent));
    ok(JSON.stringify(st.f) === JSON.stringify(fChoice) && JSON.stringify(shown) === JSON.stringify(optsAt), `回到上一個選擇：選項重新出現、旗標與羈絆回到選擇前（bond ${st.f.bond}）`);
    // 改選別的，把這一章玩完
    const r2 = await H.play(p, H.makePolicy({ targets: targets || {} }));
    const fin = await p.evaluate(async ([next, term]) => { const c = await import('./engine/core.js'); return { unlocked: !!c.sf.unlocked[next], hasTerm: c.sf.chStart && c.sf.chStart[next] && c.sf.chStart[next][term], f: c.sf.chStart && c.sf.chStart[next] }; }, [next, term]);
    ok(r2.end.includes('chend') && fin.unlocked && fin.hasTerm !== H.TERMINAL_FX[term], `改選後正常玩完：下一章解鎖，旗標 ${term}=${fin.hasTerm}（不是終結值）`);
    if (name.includes('山怪')) {
      ok(saved, '終結分支中途的手動存檔帶有「最近一次選擇」');
      await p.evaluate(() => import('./engine/player.js').then((P) => P.quitToTitle())); await p.waitForTimeout(800);
      await p.evaluate(() => import('./engine/player.js').then((P) => P.loadSnap(window.__save.snap)));
      await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 10000 });
      const r3 = await H.play(p, () => 0);
      ok(r3.end.includes('term'), '讀回分支中途的存檔：照樣走到終結頁面');
      await (await p.$('.se_btn[data-a=rewind]')).click();
      await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 });
      const st2 = await H.state(p);
      ok(JSON.stringify(st2.f) === JSON.stringify(fChoice), '讀檔後的終結也能回到正確的選擇');
    }
    if (name.includes('路線A')) {   // 終結後重新整理網頁：「繼續」回到選擇前
      await (await p.$('.se_btn[data-a=home]'))?.click().catch(() => {});
      await H.startCh(p, ch, flags);
      await H.play(p, H.makePolicy({ forceTerminal: term }));
      await p.reload(); await p.waitForSelector('#vn_home .item');
      const cont = await p.evaluate(async () => { const P = await import('./engine/player.js'); return P.hasContinue(); });
      await p.evaluate(async () => { const P = await import('./engine/player.js'); P.doContinue(); });
      await p.waitForSelector('#vn_end.term .se_btn[data-a=rewind]', { timeout: 10000 });
      await p.waitForTimeout(500); await (await p.$('.se_btn[data-a=rewind]')).click();
      await p.waitForSelector('#choices.on .vn_opt', { timeout: 10000 });
      const st3 = await H.state(p);
      ok(cont && JSON.stringify(st3.f) === JSON.stringify(fChoice), '終結後重新整理網頁：「繼續」回到終結畫面，再按「回到上一個選擇」回到正確的選擇');
    }
    ok(p.errs.length === 0, '沒有錯誤 ' + p.errs.join(' | '));
    await p.context().close();
  }
  // 圖鑑：結局分頁多三格、一般 CG 不重複
  const p = await H.newPage(b, MODE); await H.boot(p);
  await p.evaluate(async () => { const c = await import('./engine/core.js'); c.sf.endings = { end_ward: 1, end_death: 1 }; c.sf.cgsSeen = { cg_end_ward: 1 }; c.saveSf(); (await import('./engine/screens.js')).openPanel('gallery'); });
  await p.waitForTimeout(800);
  const normalPages = await p.$eval('.vn_pg_no', (e) => e.textContent);
  const normalNames = await p.evaluate(async () => { const c = await import('./engine/core.js'); return c.story.cgs.normal.length; });
  await p.locator('.vn_tab').nth(1).click(); await p.waitForTimeout(500);
  let names = await p.$$eval('.vn_cg_item .nm', (es) => es.map((e) => e.textContent));
  await p.locator('.vn_pg_btn').nth(1).click(); await p.waitForTimeout(500);
  names = names.concat(await p.$$eval('.vn_cg_item .nm', (es) => es.map((e) => e.textContent)));
  if (OUT) await p.screenshot({ path: `${OUT}/gallery_end_${MODE}.png` });
  ok(normalPages === '1 / 7', `一般 CG 頁數 ${normalPages}（story.js 共 ${normalNames} 項，終結圖不重複列出）`);
  ok(names.join('|').includes('#905 終結：缺席的一年') && names.join('|').includes('#906 終結：沒有活下來的男孩') && names.join('|').includes('#907 ？？？'), '結局 CG：' + names.filter((x) => x.trim()).join('、'));
  await b.close();
})();
