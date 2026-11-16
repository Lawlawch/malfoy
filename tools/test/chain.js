const H = require('./h.js'); const fs = require('fs');
const ROOT = require('path').join(__dirname, '../../story/') ;
const MODE = process.argv[2] || 'desktop', OUT = process.argv[3], WHICH = process.argv[4] || 'ABCDRR', RW_P = Number(process.argv[5] || 0);
const POL = {
  A: ['同行線（真結局）', { targets: { c4_go: 1, c7_snape: 1, c8_mirror: 1, c10_trust: 2, c10_team: 1, c10_tell: 1, c9_route: 1 } }, '綠色的學院盃'],
  B: ['守候 A', { targets: { c4_go: 1, c7_snape: 1, c8_mirror: 1, c10_trust: 2, c10_team: 1, c10_tell: 2, c9_route: 1 } }, '紅與綠之間'],
  C: ['守候 B', { targets: { c9_route: 1, c10_trust: 1 } }, '隔著人群的約定'],
  D: ['決裂線', { targets: { c9_route: 2 } }, '三個人的歸途'],
  R: ['隨機', { mode: 'random' }, null],
};
const lines = {}; const src = (ch) => (lines[ch] = lines[ch] || fs.readFileSync(ROOT + ch + '.txt', 'utf8').split('\n'));
function evalCond(text, f) {   // 獨立的條件判斷（不經過引擎）
  const t = text.replace(/^@(if|elif)\s+/, '').trim();
  return t.split(/\s+or\s+/).some((part) => part.split(/\s+and\s+/).every((cmp) => {
    const m = cmp.trim().match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(-?\d+)$/); if (!m) throw new Error('看不懂的條件 ' + cmp);
    const a = Number(f[m[1]] || 0), b = Number(m[3]);
    return { '==': a === b, '!=': a !== b, '>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b }[m[2]];
  }));
}
(async () => {
  const b = await H.chromium.launch();
  for (const k of WHICH) {
    const [name, pol, expect] = POL[k];
    const p = await H.newPage(b, MODE); await H.boot(p);
    await H.startCh(p, 'ch1_01', null, true);
    const policy = H.makePolicy(pol);
    const issues = [], gates = {}, chosen = [], rewound = new Set(), perf = [];
    let rwN = 0, rwAtChoice = 0;
    const tapEl = async (sel) => { const e = await p.$(sel); if (!e) return false; if (p.mode === 'desktop') await e.click({ force: true }); else { const bx = await e.boundingBox(); await p.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2); } return true; };
    const onChoice = async (rec, idx, info) => {
      const key = info.ch + ':' + info.line;
      if (!RW_P || rewound.has(key) || Math.random() > RW_P) return;
      rewound.add(key);
      const toNext = Math.random() < 0.4;
      await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(true)));
      const t1 = Date.now();
      while (Date.now() - t1 < (toNext ? 6000 : 350)) { if (await p.$('#choices.on .vn_opt') || await p.$('#vn_end')) break; await p.waitForTimeout(50); }
      await p.evaluate(() => import('./engine/player.js').then((P) => P.setSkip(false)));
      await p.waitForTimeout(300);
      if (await p.$('#vn_end') || !(await p.evaluate(() => window.VN.P.inGame))) return;
      const atChoice = !!(await p.$('#choices.on .vn_opt'));
      const off = await p.$eval('#vn_toolbar [data-act=rewind]', (e) => e.classList.contains('off'));
      if (off) { issues.push(`回溯按鈕不應是灰色：${key}（${atChoice ? '停在下一個選項' : '台詞中'}）`); return; }
      await tapEl('#vn_toolbar [data-act=rewind]');
      await p.waitForSelector('.vn_cf_yes', { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(250);
      await tapEl('.vn_cf_yes');
      const okc = await p.waitForFunction((ln) => { const P = window.VN.P; return document.querySelector('#choices.on .vn_opt') && P.script.cmds[P.pc] && P.script.cmds[P.pc].line === ln; }, info.line, { timeout: 10000 }).then(() => true).catch(() => false);
      if (!okc) { issues.push(`回溯後沒有回到 ${key} 的選項`); return; }
      await p.waitForTimeout(300);
      const st = await p.evaluate(() => ({ f: JSON.parse(JSON.stringify(window.VN.P.state.f)), opts: [...document.querySelectorAll('#choices.on .vn_opt')].map((e) => e.textContent), off: document.querySelector('#vn_toolbar [data-act=rewind]').classList.contains('off') }));
      if (JSON.stringify(st.f) !== JSON.stringify(info.f)) issues.push(`回溯後數值不同：${key} ${JSON.stringify(info.f)} → ${JSON.stringify(st.f)}`);
      if (JSON.stringify(st.opts) !== JSON.stringify(info.opts.map((o) => o.text))) issues.push(`回溯後選項不同：${key}`);
      if (!st.off) issues.push(`回溯後按鈕應為灰色：${key}`);
      rwN++; if (atChoice) rwAtChoice++;
    };
    let nChoices = 0, bondOk = 0, ending = null, chs = 0;
    for (let guard = 0; guard < 14; guard++) {
      const r = await H.play(p, policy, { maxMs: 900000, onChoice });
      for (const c of r.log) {
        nChoices++; chosen.push(c.ch.slice(-2) + ':' + c.picked);
        if (c.bondAfter === c.bondExp) bondOk++; else issues.push(`羈絆沒照選項變化：${c.ch} 第 ${c.line} 行「${c.picked}」 ${c.bondBefore}→${c.bondAfter}（應為 ${c.bondExp}）`);
        if (!c.shownOk) issues.push(`畫面上的選項和劇本不同：${c.ch} 第 ${c.line} 行`);
        if (/^「/.test(c.picked) && c.next && c.next.sp && /哈利/.test(JSON.stringify(c.next.sp)) && c.next.text.replace(/[……]/g, '') !== c.picked.replace(/[……]/g, '') && !c.next.text.includes(c.picked.slice(1, 6))) issues.push(`選項與接下來的台詞不一致？${c.ch} 第 ${c.line} 行「${c.picked}」→ ${c.next.text}`);
      }
      // 條件判斷：引擎結果與獨立判斷比對
      const tr = await p.evaluate(() => { const t = window.VN_TRACE || []; window.VN_TRACE = []; return t; });
      for (const t of tr) {
        const L = src(t.ch)[t.line - 1]; let mine;
        try { mine = evalCond(L, t.f); } catch (e) { issues.push(`${t.ch} 第 ${t.line} 行：${e.message}`); continue; }
        if (mine !== t.r) issues.push(`條件判斷錯誤：${t.ch} 第 ${t.line} 行「${L}」 引擎=${t.r} 應為=${mine}（bond ${t.f.bond}）`);
        if (/bond/.test(L)) { const key = t.ch + ':' + t.line + ' ' + L.trim(); gates[key] = gates[key] || new Set(); gates[key].add(`${t.r ? '成立' : '不成立'}(bond ${t.f.bond})`); }
      }
      if (r.end.includes('chend') || r.end.includes('yrend')) {
        perf.push(await p.evaluate(() => { const P = window.VN.P; const lt = window.__lt || []; window.__lt = []; return { ch: P.state && P.state.ch, nodes: document.getElementsByTagName('*').length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, lt: lt.length, ltMax: lt.reduce((m, x) => Math.max(m, x[0]), 0), lt300: lt.filter((x) => x[0] >= 300).length }; }));
      }
      if (r.end.includes('chend')) {
        chs++;
        const st = await p.evaluate(async () => { const c = await import('./engine/core.js'); const P = window.VN.P; const i = c.story.chapters.findIndex((x) => x.id === P.state.ch); const nx = c.story.chapters[i + 1]; return { ch: P.state.ch, f: JSON.parse(JSON.stringify(P.state.f)), next: nx && nx.id, saved: nx && c.sf.chStart[nx.id], done: !!c.sf.done[P.state.ch], unlocked: nx && !!c.sf.unlocked[nx.id] }; });
        if (!st.done || (st.next && !st.unlocked)) issues.push(`${st.ch} 完成後沒有標記已讀或沒解鎖下一章`);
        if (st.next && JSON.stringify(st.saved) !== JSON.stringify(st.f)) issues.push(`${st.ch} → ${st.next}：記下的開始數值和結束時不同`);
        await (await p.$('.se_btn[data-a=next]')).click();
        await p.waitForTimeout(500);
        if (await p.$('#vn_end.yrend')) continue;
        await p.waitForFunction(() => window.VN.P.inGame, null, { timeout: 20000 });
        const cs = await p.evaluate(() => JSON.stringify(window.VN.P.state.chstart));
        if (cs !== JSON.stringify(st.f)) issues.push(`${st.next} 開始時的數值和 ${st.ch} 結束時不同`);
        continue;
      }
      if (r.end.includes('yrend') && !r.end.includes('term')) {
        await p.waitForTimeout(800);
        ending = await p.evaluate(() => ({ tag: document.querySelector('#vn_end .etag').textContent, ttl: document.querySelector('#vn_end .ettl').textContent, line: document.querySelector('#vn_end .eline').textContent, f: JSON.parse(JSON.stringify(window.VN.P.state.f)) }));
        if (OUT) await p.screenshot({ path: `${OUT}/chain_${MODE}_${k}.png` });
        break;
      }
      issues.push('非預期的結束：' + r.end); break;
    }
    console.log(`== ${name}（${MODE}）：完成 ${chs} 章、${nChoices} 個選擇，羈絆正確 ${bondOk}/${nChoices}`);
    console.log(`   結局：${ending ? ending.tag + '／' + ending.ttl : '沒有到達'}${expect ? (ending && ending.ttl === expect ? '  ✓ 符合預期' : '  ✗ 預期 ' + expect) : ''}｜最終羈絆 ${ending && ending.f.bond}`);
    console.log('   關鍵旗標：' + (ending ? ['c4_go', 'c7_snape', 'c8_stay', 'c8_mirror', 'c9_route', 'c10_trust', 'c10_team', 'c10_end', 'c10_tell', 'c11_path'].map((x) => x + '=' + ending.f[x]).join(' ') : ''));
    console.log('   羈絆門檻：' + Object.entries(gates).map(([g, v]) => g.replace(/^ch1_/, '') + ' → ' + [...v].join('、')).join('\n             '));
    if (RW_P) console.log(`   回溯：${rwN} 次（其中停在下一個選項上回溯 ${rwAtChoice} 次），每次都檢查選項、數值、按鈕狀態`);
    console.log('   效能（每章完結時）：' + perf.map((x) => `${(x.ch || '').slice(-2)} 節點${x.nodes} 記憶體${x.heap}MB 長任務${x.lt}（最長${x.ltMax}ms、≥300ms ${x.lt300}）`).join('\n                     '));
    console.log(issues.length ? '   ✗ 問題：\n     ' + issues.join('\n     ') : '   ✓ 沒有發現問題');
    if (p.errs.length) console.log('   ✗ 錯誤：' + p.errs.join(' | ')); else console.log('   ✓ 沒有錯誤／缺圖');
    fs.writeFileSync(`${OUT}/chain_${MODE}_${k}_choices.txt`, chosen.join('\n'));
    await p.context().close();
  }
  await b.close();
})();
