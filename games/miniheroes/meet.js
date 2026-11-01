// Mini Heroes - HERO MEETING (Heroes 3 style): troop transfer, artifacts, spell sharing (Wisdom/Scholar), Scholar teaching.
// Also used for town garrison <-> visiting hero. Wraps tapMap / walkStep from game.js.
'use strict';
const adj8 = (a, b) => a !== b && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
const weekOf = () => Math.floor((G.day - 1) / 7);
// side = {name, arr, hero|null}
function openMeet(a, b) { UI.meet = {L: {name: a.name, arr: a.army, hero: a}, R: {name: b.name, arr: b.army, hero: b}, sel: null, n: 0, log: shareSpells(a, b)}; showMeet(); }
function openGarrison(t) { const h = heroAt(t.x, t.y); if (!h) return; UI.meet = {L: {name: h.name, arr: h.army, hero: h}, R: {name: t.name + ' GARRISON', arr: t.garrison, hero: null}, sel: null, n: 0, log: [], town: t.id}; showMeet(); }
const spellCap = h => Math.max(h.sk.wisdom || 0, h.sk.scholar || 0);
function shareSpells(a, b) { // either hero with Wisdom/Scholar lets the pair pool spells up to (skill level + 1)
  const cap = Math.max(spellCap(a), spellCap(b)); if (!cap) return [];
  const out = [], lim = cap + 1;
  for (const [from, to] of [[a, b], [b, a]]) for (const k of from.spells) if (!to.spells.includes(k) && SPELLS[k].lvl <= lim) { to.spells.push(k); out.push(to.name + ' learned ' + SPELLS[k].name); }
  return out;
}
const pairKey = (a, b) => [a.id, b.id].sort().join('-');
function teachable(t, s) { // t = teacher (needs Scholar), s = student
  if (!t.sk.scholar || !s) return [];
  G.teach = G.teach || {}; if (G.teach[pairKey(t, s)] === weekOf()) return [];
  if (Object.keys(s.sk).length >= MAX_SKILLS) return [];
  return Object.keys(t.sk).filter(k => !s.sk[k]);
}
function teach(t, s, k) {
  if (!teachable(t, s).includes(k)) return false;
  s.sk[k] = Math.min(t.sk[k], t.sk.scholar); G.teach[pairKey(t, s)] = weekOf(); return true;
}
function slotHtml(side, key) {
  const M = UI.meet;
  return `<div class="msl">${Array.from({length: MAX_STACKS}, (_, i) => { const a = side.arr[i], sel = M.sel && M.sel.side === key && M.sel.i === i;
    return `<button class="${sel ? 'sel' : M.sel ? 'tgt' : ''}" data-a="mslot" data-v="${key}:${i}" title="${a ? a.count + ' ' + a.type : 'empty'}">${a ? `<img src="${unitImg(a.type)}" alt="${a.type}"><s>${a.count}</s>` : ''}</button>`; }).join('')}</div>`;
}
function heroCol(side, other, key) {
  const h = side.hero; let s = `<h3>${side.name.toUpperCase()}${h ? ' LV' + h.lvl : ''}</h3>${slotHtml(side, key)}`;
  if (h && other.hero) {
    s += `<h3>ARTIFACTS</h3><div class="mart">${h.arts.map((k, i) => btn(ARTIFACTS[k].name + ' →', 'mart', key + ':' + i, 'alt')).join('') || '<small>none</small>'}</div>`;
    s += `<h3>SPELLS</h3><small>${h.spells.map(k => SPELLS[k].name).join(', ') || 'none'}</small>`;
    s += `<h3>SKILLS</h3><small>${Object.keys(h.sk).map(k => SKILLS[k].name + ' ' + 'I'.repeat(h.sk[k])).join(', ') || 'none'}</small>`;
    const tk = teachable(h, other.hero);
    if (h.sk.scholar) s += `<div class="mart">${tk.length ? tk.map(k => btn('TEACH ' + SKILLS[k].name, 'mteach', key + ':' + k, 'p')).join('') : '<small>' + (G.teach && G.teach[pairKey(h, other.hero)] === weekOf() ? 'Already taught this week' : 'Nothing to teach') + '</small>'}</div>`;
  }
  return s;
}
function showMeet() {
  const M = UI.meet, sel = M.sel && M[M.sel.side].arr[M.sel.i];
  showPanel(() => { const M = UI.meet, sel = M.sel && M[M.sel.side].arr[M.sel.i]; return `<h2>${M.town ? 'GARRISON EXCHANGE' : 'HERO MEETING'}</h2>
    <p>${sel ? `Selected <b class="hl">${sel.type}</b>. Move <b id="mcntv">${M.n}</b> of ${sel.count}: <input id="mcnt" type="range" min="1" max="${sel.count}" value="${M.n}"> then tap a slot (empty = move, same unit = merge, other = swap).` : 'Tap a stack, then tap a slot. Each hero keeps at least 1 stack.'}</p>
    ${M.log.length ? '<p class="ok">' + M.log.join('<br>') + '</p>' : ''}
    <div class="mt"><div>${heroCol(M.L, M.R, 'L')}</div><div>${heroCol(M.R, M.L, 'R')}</div></div>
    <div class="bar" style="margin-top:8px">${sel ? btn('CANCEL', 'mcancel', '', 'alt') : ''}${btn('DONE', 'mdone', '', 'g')}</div>`; }, {sticky: true, after: () => { const r = $('mcnt'); if (r) r.oninput = () => { UI.meet.n = +r.value; $('mcntv').textContent = r.value; }; }});
}
// core transfer: n creatures from (fs, fi) to (ts, ti)
function meetMove(fs, fi, ts, ti, n) {
  const M = UI.meet, F = M[fs], T = M[ts], a = F.arr[fi]; if (!a) return 'empty';
  if (fs === ts && fi === ti) return 'same';
  n = Math.max(1, Math.min(a.count, n || a.count));
  const b = T.arr[ti];
  if (b && b.type !== a.type) { // swap whole stacks
    if (fs === ts) { [F.arr[fi], F.arr[ti]] = [b, a]; return 'swap'; }
    if (n < a.count) return 'split onto a different unit';
    F.arr[fi] = b; T.arr[ti] = a; return 'swap';
  }
  const leaving = n === a.count, stacks = F.arr.filter(Boolean).length;
  if (fs !== ts && leaving && F.hero && stacks <= 1) return 'keep 1 stack';
  if (b) b.count += n; else { if (ti >= T.arr.length) T.arr.length = ti; T.arr[ti] = {type: a.type, count: n}; }
  a.count -= n; if (!a.count) F.arr[fi] = undefined;
  for (const s of [F, T]) { const keep = s.arr.filter(Boolean); s.arr.length = 0; s.arr.push(...keep); }
  return 'ok';
}
const _tapMap = tapMap;
tapMap = function (tx, ty) {
  const h = curHero(), oh = h && heroAt(tx, ty);
  if (h && oh && oh.owner === 'player' && oh !== h && !townAt(tx, ty)) { // a hero standing in a town is selected instead (tap again: HERO / TOWN)
    if (adj8(h, oh)) { openMeet(h, oh); return; }
    if (UI.preview && UI.preview.tx === tx && UI.preview.ty === ty) { startWalk(h, UI.preview.path); UI.walk.meet = oh.id; UI.preview = null; return; }
    const dj = dijkstra(h), a = bestAdjacent(dj, oh), path = a && pathTo(dj, a[0], a[1]);
    if (!path || !path.length) { G.sel = oh.id; UI.preview = null; msg(oh.name + ' selected'); return; }
    UI.preview = {tx, ty, path, cost: path.map(([x, y]) => dj.dist[y * MW + x])}; msg('Meet ' + oh.name + ': tap again to go (NEXT selects heroes)'); return;
  }
  return _tapMap(tx, ty);
};
const _walkStep = walkStep;
walkStep = function () {
  const w = UI.walk, meet = w && w.meet;
  _walkStep();
  if (meet && !UI.walk && !UI.panel && !B) { const h = heroById(w.id), o = heroById(meet); if (h && o && adj8(h, o)) openMeet(h, o); }
};
Object.assign(ACTIONS, {
  mgar: v => openGarrison(G.towns.find(t => t.id === +v)),
  mslot: v => { const M = UI.meet, [k, i] = v.split(':'), idx = +i;
    if (!M.sel) { const a = M[k].arr[idx]; if (!a) return; M.sel = {side: k, i: idx}; M.n = a.count; refreshPanel(); return; }
    const r = meetMove(M.sel.side, M.sel.i, k, idx, M.n); M.sel = null; if (r !== 'ok' && r !== 'swap' && r !== 'same') { msg('Cannot: ' + r); SFX.bad(); } else SFX.pick(); refreshPanel(); },
  mcancel: () => { UI.meet.sel = null; refreshPanel(); },
  mart: v => { const M = UI.meet, [k, i] = v.split(':'), F = M[k].hero, T = M[k === 'L' ? 'R' : 'L'].hero; if (!F || !T) return; T.arts.push(F.arts.splice(+i, 1)[0]); SFX.pick(); refreshPanel(); },
  mteach: v => { const M = UI.meet, [k, sk] = v.split(':'), t = M[k].hero, s = M[k === 'L' ? 'R' : 'L'].hero; if (teach(t, s, sk)) { M.log.push(s.name + ' learned ' + SKILLS[sk].name + ' from ' + t.name); SFX.lvl(); } refreshPanel(); },
  mdone: () => { const t = UI.meet && UI.meet.town; UI.meet = null; if (UI.panel) UI.panel.sticky = false; closePanel(); hudSig = ''; if (t) openTown(G.towns.find(x => x.id === t)); },
});
MHX.tapMap = tapMap;
window.MEET = {openMeet, openGarrison, meetMove, shareSpells, teachable, teach, get M() { return UI.meet; }}; // test hook
