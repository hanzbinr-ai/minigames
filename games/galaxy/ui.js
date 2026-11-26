// Blackhole Throne: HUD, selection card, modal sheets, designer and map input. Talks to the sim only via act().
(function () {
const S = self.NTSim, D = S.D, R = self.NTRender, $ = id => document.getElementById(id);
const ME = 'player', ICON = { metal: '⬢', crystal: '◆', gas: '●', energy: '⚡' }, RCOL = { metal: '#cfd8dc', crystal: '#80deea', gas: '#ffb74d', energy: '#fff176' };
const seen = new WeakSet();
const ui = { toasts: false, sel: null, fleet: null, mark: null, sheet: null, view: null, des: null, picks: {}, lastLog: 0, touchT: 0, G: null };
const st = () => ui.G.st;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = n => n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n) + '';
const fmtC = n => n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + 'k' : Math.floor(n) + ''; // HUD chips
const clock = t => { const s = Math.floor(t / S.TPS); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const secs = ticks => Math.max(0, Math.ceil(ticks / S.TPS)) + 's';
const costHtml = (c, res) => Object.keys(c).filter(r => c[r]).map(r => `<span class="${res && res[r] < c[r] ? 'no' : ''}">${ICON[r]}${fmt(c[r])}</span>`).join(' ');
const owner = id => st().emp[id];
const counts = (o, ships) => { const c = S.counts(st(), o, ships); return Object.keys(c).map(k => c[k] + ' ' + k).join(' · ') || 'none'; };
function act(a, quiet) { const r = S.act(st(), ME, a); if (!r.ok && !quiet) toast('⚠ ' + r.err); refresh(true); return r; }

// ---------- HUD ----------
function hud() {
  const e = owner(ME), pr = S.production(st(), ME);
  $('res').innerHTML = D.RES.map(r => `<span class="r" style="color:${RCOL[r]}" title="${r} ${Math.floor(e.res[r])} (+${pr[r]}/s)"><i>${ICON[r]}</i>${fmtC(e.res[r])}<small>+${fmtC(pr[r])}</small></span>`).join('');
  $('spd').textContent = ui.G.speed + '×';
  for (const l of st().log) if (!seen.has(l)) { seen.add(l); if (l.who === ME && ui.toasts) toast(l.msg, l.ref); }
}
function toast(msg, ref) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
  d.onclick = () => { if (ref && ref[0] === 'r') { openSheet('reports'); showReport(ref); } else if (ref) select(ref, true); d.remove(); };
  $('toasts').prepend(d); while ($('toasts').children.length > 3) $('toasts').lastChild.remove();
  setTimeout(() => d.remove(), 4500);
}

// ---------- selection card ----------
function select(id, center) {
  ui.sel = id; const o = id && S.byId(st(), id);
  if (o && o.id[0] === 'f' && o.owner === ME) ui.fleet = o.id;
  if (o && center) { const p = S.objPos(st(), o); R.cam.x = p.x; R.cam.y = p.y; }
  card();
}
function fleetLine(f) { const o = f.order, T = o.target && S.byId(st(), o.target); return { idle: 'Holding position', move: 'Moving', return: 'Returning to base', chase: 'Chasing ' + (T ? owner(T.owner).name : 'target'), attack: 'Attacking ' + (T ? owner(T.owner).name : 'target'), mine: 'Mining asteroids', colonize: 'Flying to colonize', starbase: 'Flying to build a Star Base' }[o.t] || o.t; }
function card() {
  const c = $('card'), G = st(), o = ui.sel && S.byId(G, ui.sel);
  if (!ui.sel) { c.classList.add('hidden'); return; }
  const myF = ui.fleet && S.byId(G, ui.fleet), fName = myF ? esc(myF.name) : '';
  const withF = (label, a) => myF && myF.id !== ui.sel && !S.civil(G, myF) ? `<button class="b" data-a='${JSON.stringify(Object.assign({ fleet: myF.id }, a))}'>${label} (${fName})</button>` : '';
  let h = '';
  if (ui.sel === 'space') {
    const m = ui.mark;
    h = `<h3>🌌 Deep space <span class="muted">${m.x.toFixed(0)}, ${m.y.toFixed(0)}</span><button class="ib x" data-x>✕</button></h3>
      <div class="muted">${S.inSupply(G, ME, m.x, m.y) ? '<span class="good">Inside your supply range</span>' : '<span class="warn">Outside supply: fleets get −20% speed/attack</span>'}</div>
      <div class="row">${myF && !S.civil(G, myF) ? `<button class="b" data-a='${JSON.stringify({ type: 'move', fleet: myF.id, x: m.x, y: m.y })}'>Move ${fName} here</button>` : ''}
      <button class="b alt" data-a='${JSON.stringify({ type: 'starbase', x: m.x, y: m.y })}'>🛰 Build Star Base here</button></div>`;
  } else if (!o) { ui.sel = null; c.classList.add('hidden'); return; }
  else if (o.id[0] === 'f') {
    const e = owner(o.owner), p = S.pos(G, o);
    h = `<h3><span style="color:${e.color}">●</span>${esc(o.name || 'Fleet')} <span class="muted">${esc(e.name)}</span><button class="ib x" data-x>✕</button></h3>
      <div>${counts(o.owner, o.ships)}</div><div class="muted">${fleetLine(o)} · speed ${S.fleetSpeed(G, o).toFixed(1)} · command ${S.cmdOf(G, o.owner, o.ships)}${o.owner === ME ? '/' + S.cmdCap(G, ME) : ''} · power ${S.power(G, o.owner, o.ships).toFixed(1)}</div>`;
    if (o.owner === ME) {
      const deb = [!o.supply && 'out of supply (−20%)', o.dmgUntil > G.tick && 'warp-damaged (−25%) ' + secs(o.dmgUntil - G.tick)].filter(Boolean).join(', ');
      const cargo = Object.keys(o.cargo).filter(r => o.cargo[r] >= 1).map(r => ICON[r] + fmt(o.cargo[r])).join(' ');
      h += (deb ? `<div class="warn">${deb}</div>` : '') + (cargo ? `<div class="muted">Cargo ${cargo}</div>` : '');
      if (!S.civil(G, o)) h += `<div class="row">${['aggressive', 'defensive', 'passive'].map(s => `<button class="chip ${o.stance === s ? 'on' : ''}" data-a='${JSON.stringify({ type: 'stance', fleet: o.id, stance: s })}'>${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>`;
      const warpOk = owner(ME).research.warp, cd = o.warpCd > G.tick ? ' ' + secs(o.warpCd - G.tick) : '';
      h += `<div class="row"><button class="b alt" data-a='${JSON.stringify({ type: 'stop', fleet: o.id })}'>■ Stop</button><button class="b alt" data-a='${JSON.stringify({ type: 'return', fleet: o.id })}'>⌂ Return</button>
        ${warpOk ? `<button class="b red" data-a='${JSON.stringify({ type: 'warp', fleet: o.id })}'>⚡ Warp${cd}</button><button class="b sm ${o.autoWarp ? 'on' : 'alt'}" data-a='${JSON.stringify({ type: 'autoWarp', fleet: o.id, on: !o.autoWarp })}'>Auto-warp at 30%: ${o.autoWarp ? 'ON' : 'OFF'}</button>` : '<span class="muted">Warp Retreat: research it</span>'}</div>
        <div class="muted" style="margin-top:6px">Tap the map to move (redirect anytime) · tap enemies to attack · asteroids to mine</div>`;
    } else h += `<div class="row">${withF('⚔ Attack', { type: 'chase', target: o.id })}</div>`;
  } else if (o.id[0] === 'p') {
    const e = o.owner && owner(o.owner), pt = D.PLANET[o.type];
    h = `<h3>${o.kind === 'home' ? '👑' : o.kind === 'colony' ? '🏙' : '🪐'} ${o.kind === 'home' ? 'Home world' : o.kind === 'colony' ? 'Colony · ' + pt.name : pt.name}${e ? ` <span style="color:${e.color}">${esc(e.name)}</span>` : ''}<button class="ib x" data-x>✕</button></h3>
      <div class="muted">${o.kind === 'home' ? 'Home world · fixed in place, cannot be captured (only raided)' : o.kind === 'colony' ? 'Colony · produces ' + ICON[pt.res] + ' ' + pt.res + ' +5/s · can be captured' : 'Unclaimed · would produce ' + ICON[pt.res] + ' ' + pt.res}</div>`;
    if (o.owner === ME) {
      h += `<div class="muted">Garrison: ${counts(ME, o.garrison)}</div><div class="row">${o.kind === 'home' ? '<button class="b" data-sheet="home">Open planet</button>' : `<button class="b" data-col="${o.id}">Open planet</button>`}<button class="b alt" data-sheet="fleets">🚀 Launch fleet</button></div>`;
    } else if (!o.owner) {
      const n = S.colonies(G, ME), cap = S.colonyCap(G, ME), ships = S.bases(G, ME).reduce((a, b) => a + b.garrison.filter(u => S.stat(G, ME, u.d).civ === 'colony').length, 0);
      h += `<div class="muted">Colonies ${n}/${cap} · colony ships ready: ${ships}</div><div class="row"><button class="b" data-a='${JSON.stringify({ type: 'colonize', planet: o.id })}'>🏙 Colonize</button>${myF ? `<button class="b alt" data-a='${JSON.stringify({ type: 'move', fleet: myF.id, x: o.x, y: o.y + o.r + 2 })}'>Move ${fName} here</button>` : ''}</div>`;
    } else h += `<div class="row">${withF(o.kind === 'home' ? '⚔ Raid' : '⚔ Attack', { type: 'attack', target: o.id })}</div>`;
  } else if (o.id[0] === 's') {
    const e = owner(o.owner), core = S.stat(G, o.owner, 'sbcore');
    h = `<h3>🛰 Star Base <span style="color:${e.color}">${esc(e.name)}</span><button class="ib x" data-x>✕</button></h3>
      <div class="muted">Hull ${Math.round(o.hp)}/${core.hp} · armor ${Math.round(o.ar)}/${core.armor}${o.jammer ? ' · Warp Jammer' : ''} · destroyed (not captured) if defeated</div>`;
    if (o.owner === ME) h += `<div class="muted">Supplies: ${D.RES.map(r => ICON[r] + fmt(o.store[r])).join(' ')} · garrison: ${counts(ME, o.garrison)}</div>
      <div class="row"><button class="b alt" data-a='${JSON.stringify({ type: 'deposit', base: o.id, amount: 200 })}'>Send 200 each to depot</button><button class="b alt" data-a='{"view":"sbtrain","base":"${o.id}"}'>Train ships here</button><button class="b alt" data-sheet="fleets">🚀 Launch</button></div>`;
    else h += `<div class="row">${withF('⚔ Attack', { type: 'attack', target: o.id })}</div>`;
  } else if (o.id[0] === 'a') {
    h = `<h3>☄ Asteroid field <span class="muted">${ICON[o.res]} ${o.res}</span><button class="ib x" data-x>✕</button></h3><div class="muted">${fmt(o.amount)} left · send a fleet to mine; it returns when the hold is full</div>
      <div class="row">${withF('⛏ Mine', { type: 'mine', target: o.id })}</div>`;
  }
  if (h !== ui.cardHtml) { ui.cardHtml = h; c.innerHTML = h; } c.classList.remove('hidden');
}

// ---------- sheets ----------
function openSheet(name, view) { document.body.classList.add('sheet-open'); ui.lastHtml = null; ui.sheet = name; ui.view = view || null; if (name === 'design' && !ui.des) ui.des = { hull: 'corvette', mods: [], name: 'New Design' }; $('sheet').classList.remove('hidden'); renderSheet(); bar(); }
function closeSheet() { document.body.classList.remove('sheet-open'); ui.sheet = null; $('sheet').classList.add('hidden'); bar(); }
function bar() { for (const b of document.querySelectorAll('#bar button')) b.classList.toggle('on', b.dataset.sheet === ui.sheet); }
function renderSheet() {
  if (!ui.sheet) return;
  const body = $('sh-body'), top = body.scrollTop, f = SHEETS[ui.sheet];
  const [title, html] = f(); $('sh-title').textContent = title;
  if (html !== ui.lastHtml) { ui.lastHtml = html; body.innerHTML = html; body.scrollTop = top; }
  SF.mount($('surf-slot')); surf();
  $('sh-back').classList.toggle('hidden', !ui.view);
}
const prog = (end, len) => `<div class="bar2"><i style="width:${Math.round(100 * (1 - (end - st().tick) / len))}%"></i></div>`;
const SHEETS = {
  home() {
    const G = st(), e = owner(ME), home = S.byId(G, e.home);
    let h = `<div id="surf-slot" class="surf-slot"></div>${bldCard(e)}<div class="muted">HQ ${e.bld.hq} · colonies ${S.colonies(G, ME)}/${S.colonyCap(G, ME)} · fleet command cap ${S.cmdCap(G, ME)} · Star Bases ${G.starbases.filter(s => s.owner === ME).length}/${D.CFG.starbaseCap}</div><h4>Buildings</h4>`;
    for (const b in D.BUILD) {
      const B = D.BUILD[b], busy = e.bq && e.bq.b === b, c = S.buildCost(e, b);
      h += `<div class="it${ui.bsel === b ? ' on' : ''}"><div class="t">${B.name} <span class="muted">Lv ${e.bld[b]}</span><span class="sp"></span>${busy ? secs(e.bq.end - G.tick) : `<button class="b sm" ${e.bq ? 'disabled' : ''} data-a='${JSON.stringify({ type: 'upgrade', b })}'>Upgrade · ${S.buildTime(e, b)}s</button>`}</div>
        <div class="muted">${B.desc}${B.res ? ` Now +${2 + 2 * e.bld[b]}/s.` : ''}</div>${busy ? prog(e.bq.end, e.bq.len) : `<div class="cost">${costHtml(c, e.res)}</div>`}</div>`;
    }
    h += shipyard(home);
    return ['🪐 Home planet', h];
  },
  colony() {
    const G = st(), p = ui.col && S.byId(G, ui.col);
    if (!p || p.owner !== ME) { setTimeout(closeSheet); return ['🏙 Colony', '<div class="muted">This colony is no longer yours.</div>']; }
    const pt = D.PLANET[p.type];
    return ['🏙 Colony · ' + pt.name, `<div id="surf-slot" class="surf-slot"></div><div class="it"><div class="t">${ICON[pt.res]} Produces ${pt.res} +5/s</div>
      <div class="muted">Colonies have no buildings yet: they produce their planet's resource and can be captured. Keep a garrison here.</div>
      <div class="muted" style="margin-top:4px">Garrison: ${counts(ME, p.garrison)}</div><div class="row"><button class="b alt" data-a='{"focus":"${p.id}"}'>Show on map</button><button class="b alt" data-sheet="fleets">🚀 Launch fleet</button></div></div>`];
  },
  fleets() {
    const G = st(); let h = '<h4>Fleets in space</h4>';
    const mine = G.fleets.filter(f => f.owner === ME);
    if (!mine.length) h += '<div class="muted">No fleets out. Launch one from a base below.</div>';
    for (const f of mine) h += `<div class="it"><div class="t">${esc(f.name)}<span class="sp"></span><button class="b sm" data-a='{"focus":"${f.id}"}'>Select</button></div><div class="muted">${counts(ME, f.ships)} · ${fleetLine(f)}</div></div>`;
    for (const b of S.bases(G, ME)) {
      const war = b.garrison.filter(u => !S.stat(G, ME, u.d).civ), civ = b.garrison.length - war.length;
      if (!b.garrison.length) continue;
      const by = {}; for (const u of war) by[u.d] = (by[u.d] || 0) + 1;
      const picks = ui.picks[b.id] = ui.picks[b.id] || {};
      let cmd = 0; for (const d in by) { if (picks[d] === undefined || picks[d] > by[d]) picks[d] = by[d]; cmd += picks[d] * S.stat(G, ME, d).cmd; }
      h += `<h4>${b.id[0] === 's' ? 'Star Base' : b.kind === 'home' ? 'Home planet' : 'Colony'} garrison</h4><div class="it">`;
      for (const d in by) h += `<div class="t" style="margin:4px 0">${esc(owner(ME).designs[d].name)} <span class="muted">${S.stat(G, ME, d).cmd} cmd</span><span class="sp"></span><span class="step"><button data-pick='["${b.id}","${d}",-1]'>−</button><b>${picks[d]}</b>/${by[d]}<button data-pick='["${b.id}","${d}",1]'>+</button></span></div>`;
      if (civ) h += `<div class="muted">${civ} civilian ship(s): tap a free planet → Colonize, or empty space → Build Star Base</div>`;
      if (war.length) h += `<div class="row"><span class="muted" style="align-self:center">Command ${cmd}/${S.cmdCap(G, ME)}</span><button class="b" data-a='${JSON.stringify({ type: 'launch', base: b.id, picks })}'>🚀 Launch</button></div>`;
      h += '</div>';
    }
    return ['🚀 Fleets', h];
  },
  design() { return ['🛠 Ship designer', designer()]; },
  research() {
    const G = st(), e = owner(ME); let h = `<div class="muted">One project at a time. Lab level ${e.bld.lab} speeds research.</div>`;
    for (const k in D.RESEARCH) {
      const r = D.RESEARCH[k], done = e.research[k], busy = e.rq && e.rq.id === k, locked = r.req && !e.research[r.req];
      h += `<div class="it"><div class="t">${done ? '✅' : locked ? '🔒' : '🔬'} ${r.name}<span class="sp"></span>${done ? '' : busy ? secs(e.rq.end - G.tick) : `<button class="b sm" ${e.rq || locked ? 'disabled' : ''} data-a='${JSON.stringify({ type: 'research', id: k })}'>Research · ${r.time}s</button>`}</div>
        ${busy ? prog(e.rq.end, e.rq.len) : done ? '' : `<div class="cost">${locked ? 'Requires ' + D.RESEARCH[r.req].name + ' · ' : ''}${costHtml(r.cost, e.res)}</div>`}</div>`;
    }
    return ['🔬 Research', h];
  },
  reports() {
    if (ui.view && ui.view.rep) return reportView(ui.view.rep);
    const G = st(), list = G.reports.filter(r => r.a.owner === ME || r.b.owner === ME).reverse();
    let h = list.length ? '' : '<div class="muted">No battles yet. Fight pirates to earn loot!</div>';
    for (const r of list) { const won = owner(r.winner === 'A' ? r.a.owner : r.b.owner).id === ME;
      h += `<div class="it" data-rep="${r.id}" style="cursor:pointer"><div class="t"><span class="${won ? 'good' : 'bad'}">${won ? 'Victory' : 'Defeat'}</span><span class="sp"></span><span class="muted">${clock(r.tick)}</span></div><div class="muted">${esc(r.outcome)}</div></div>`; }
    return ['📜 Battle reports', h];
  },
  menu() {
    const G = st();
    return ['☰ Menu', `<div class="it"><div class="t">Game speed<span class="sp"></span>${[1, 2, 4, 8].map(s => `<button class="chip ${ui.G.speed === s ? 'on' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div></div>
      <div class="row"><button class="b" data-cmd="save">💾 Save now</button><button class="b red" data-cmd="new">✦ New game</button><a class="b alt" href="../../" style="text-decoration:none">◀ Portal</a></div>
      <h4>How to play</h4><div class="muted" style="line-height:1.5">• Drag to pan, pinch or scroll to zoom, tap to select.<br>• Your home planet never moves and can't be captured, only raided. Upgrade mines for income.<br>• Build a Colony Ship, then tap a free planet → Colonize. Colonies produce their planet's resource and can be captured.<br>• Construction Ship → tap empty space → Star Base: a military depot with turrets, repairs and supply range.<br>• Outside supply range fleets lose 20% speed and attack.<br>• Select a fleet, then tap anywhere to move — redirect any time. Tap an enemy to attack or chase.<br>• Design ships: lasers beat armor, railguns beat shields, torpedoes skip shields but get shot down by point defense. Mix hull classes for a formation bonus.</div>
      <p class="muted">${D.TITLE} v${ui.G.version} · game time ${clock(G.tick)} · seed ${G.seed}</p>`];
  },
  sbtrain() { const sb = S.byId(st(), ui.view && ui.view.base); return ['🛰 Star Base shipyard', sb ? `<div class="muted">Paid from the depot's supplies: ${D.RES.map(r => ICON[r] + fmt(sb.store[r])).join(' ')}</div>` + shipyard(sb) : 'Star Base lost'];
  },
};
// planet surface (city view): the canvas lives in surface.js; taps select a building, the card reuses the same upgrade action
const SF = self.NTSurf;
function bldCard(e) {
  const b = ui.bsel, G = st();
  if (!b) return '<div class="muted surf-hint">Tap a building to upgrade it.</div>';
  const B = D.BUILD[b], busy = e.bq && e.bq.b === b, c = S.buildCost(e, b);
  return `<div class="it bsel"><div class="t">${B.name} <span class="muted">Lv ${e.bld[b]}</span><span class="sp"></span>${busy ? secs(e.bq.end - G.tick) : `<button class="b sm" ${e.bq ? 'disabled' : ''} data-a='${JSON.stringify({ type: 'upgrade', b })}'>Upgrade · ${S.buildTime(e, b)}s</button>`}<button class="ib x sm" data-bsel="">✕</button></div>
    <div class="muted">${B.desc}${B.res ? ` Now +${2 + 2 * e.bld[b]}/s.` : ''}${e.bq && !busy ? ' Builders busy: ' + D.BUILD[e.bq.b].name + ' ' + secs(e.bq.end - G.tick) : ''}</div>${busy ? prog(e.bq.end, e.bq.len) : `<div class="cost">${costHtml(c, e.res)}</div>`}</div>`;
}
function surf() {
  if (ui.sheet !== 'home' && ui.sheet !== 'colony') return;
  const G = st(), e = owner(ME);
  if (ui.sheet === 'home') SF.update({ key: 'home', blds: e.bld, bq: e.bq, tick: G.tick, tps: S.TPS, sel: ui.bsel });
  else { const p = S.byId(G, ui.col); if (p) SF.update({ key: SF.surfKey(p.kind, p.type), blds: null, bq: null, tick: G.tick, tps: S.TPS, sel: null }); }
}
SF.view.onTap = b => { ui.bsel = b; ui.touchT = 0; ui.lastHtml = null; renderSheet(); };
function shipyard(base) {
  const G = st(), e = owner(ME), wallet = base.id[0] === 's' ? base.store : e.res;
  let h = '<h4>Shipyard</h4>';
  e.sq.forEach((q, i) => { if (q.base === base.id) h += `<div class="it"><div class="t">⏳ ${esc(e.designs[q.d].name)} ×${q.n}<span class="sp"></span>${q.end ? secs(q.end - G.tick) : 'queued'}<button class="b sm alt" data-a='${JSON.stringify({ type: 'cancelQueue', i })}'>✕</button></div></div>`; });
  for (const d of Object.values(e.designs)) {
    if (d.npc) continue; const h0 = D.HULLS[d.hull], lock = h0.req && !e.research[h0.req];
    h += `<div class="it"><div class="t">${esc(d.name)} <span class="muted">${h0.name}${lock ? ' 🔒' : ''}</span><span class="sp"></span>
      <button class="b sm" ${lock ? 'disabled' : ''} data-a='${JSON.stringify({ type: 'build', design: d.id, n: 1, base: base.id })}'>+1</button><button class="b sm alt" ${lock ? 'disabled' : ''} data-a='${JSON.stringify({ type: 'build', design: d.id, n: 5, base: base.id })}'>+5</button></div>
      <div class="cost">${costHtml(d.s.cost, wallet)} · ${d.s.cmd} cmd · ${d.s.time}s</div></div>`;
  }
  return h;
}
// ---------- ship designer ----------
function modAllowed(id, h, e) { const m = D.MODS[id]; if (m.bays && !h.bays) return 'Carrier only'; if (m.minSize && h.size < m.minSize) return 'Cruiser+'; if (m.req && !e.research[m.req]) return 'Research'; return ''; }
function designer() {
  const G = st(), e = owner(ME), d = ui.des, h = D.HULLS[d.hull];
  let x = '<h4>Hull</h4><div class="chips">';
  for (const k in D.HULLS) { const H = D.HULLS[k]; if (H.npc || H.civ) continue; const lock = H.req && !e.research[H.req];
    x += `<button class="chip ${d.hull === k ? 'on' : ''}" ${lock ? 'disabled' : ''} data-hull="${k}">${H.name}${lock ? ' 🔒' : ''} <span class="muted">${H.cmd}cmd·${H.slots}sl</span></button>`; }
  x += `</div><h4>Modules (${d.mods.filter(Boolean).length}/${h.slots} slots)</h4><div class="slots">`;
  for (let i = 0; i < h.slots; i++) {
    x += `<select data-slot="${i}"><option value="">— empty —</option>`;
    for (const k in D.MODS) { const why = modAllowed(k, h, e), M = D.MODS[k]; x += `<option value="${k}" ${d.mods[i] === k ? 'selected' : ''} ${why ? 'disabled' : ''}>${M.name} (${M.pow || 0}⚡)${why ? ' · ' + why : ''}</option>`; }
    x += '</select>';
  }
  const c = S.BT.compile({ name: d.name, hull: d.hull, mods: d.mods.filter(Boolean) }, e.research), s = c.s || S.BT.compile({ hull: d.hull, mods: d.mods.filter(Boolean) }, e.research, true).s;
  x += `</div><div class="stats">
    <span>Power <b class="${s.used > s.power ? 'bad' : ''}">${s.used}/${s.power}</b></span><span>Hull <b>${s.hp}</b></span><span>Armor <b>${Math.round(s.armor)}</b></span><span>Shield <b>${Math.round(s.shield)}</b></span>
    <span>Evasion <b>${Math.round(s.ev * 100)}%</b></span><span>Speed <b>${s.spd}</b></span><span>Sensor <b>${s.sensor}</b></span><span>Point def. <b>${Math.round(s.pd * 100)}%</b></span>
    <span>Command <b>${s.cmd}</b></span><span>Build <b>${s.time}s</b></span>${s.taunt ? `<span>Taunt <b>×${1 + s.taunt}</b></span>` : ''}${s.escort ? '<span><b>Escort</b> screen</span>' : ''}${s.aura ? '<span><b>Command aura</b></span>' : ''}</div>
    <div class="muted" style="margin-top:6px">Weapons: ${s.weapons.map(w => `${w.name} <i>${w.range}</i> ${w.dmg}${w.shots > 1 ? '×' + w.shots : ''}`).join(', ') || 'none'}</div>
    <div class="cost">Cost ${costHtml(s.cost, e.res)}</div>${c.ok ? '' : `<div class="bad">⚠ ${esc(c.err)}</div>`}
    <div class="row"><input id="dname" value="${esc(d.name)}" maxlength="24" style="flex:1;min-width:120px;background:#0f1a2b;border:1px solid #34465f;border-radius:8px;padding:7px;color:inherit;font:inherit">
    <button class="b" data-cmd="saveDesign" ${c.ok ? '' : 'disabled'}>💾 Save</button><button class="b alt" data-cmd="saveBuild" ${c.ok ? '' : 'disabled'}>Save + build 1</button></div>
    <h4>Designs & templates</h4>`;
  for (const v of Object.values(e.designs)) { if (v.npc || D.HULLS[v.hull].civ) continue; x += `<div class="it"><div class="t">${esc(v.name)} <span class="muted">${D.HULLS[v.hull].name}${v.tpl ? ' · template' : ''}</span><span class="sp"></span><button class="b sm alt" data-load="${v.id}">Edit</button></div><div class="muted">${v.mods.map(m => D.MODS[m].name).join(', ')}</div></div>`; }
  return x;
}
function reportView(id) {
  const r = st().reports.find(x => x.id === id); if (!r) return ['Report', 'Report expired'];
  const side = (s, i) => `<div class="it"><div class="t"><span style="color:${owner(s.owner).color}">●</span>${esc(s.name)}<span class="sp"></span><span class="${(r.winner === 'A') === (i === 0) ? 'good' : 'bad'}">${(r.winner === 'A') === (i === 0) ? 'Won' : 'Lost'}</span></div>
    <div class="muted">Before: ${Object.keys(s.before).map(k => s.before[k] + ' ' + k).join(', ')}<br>After: ${Object.keys(s.after).map(k => s.after[k] + ' ' + k).join(', ') || 'nothing left'}<br>Strength lost ${Math.round(s.lost * 100)}%${r.formation && r.formation[i] ? ' · formation bonus active' : ''}</div></div>`;
  let h = `<div class="muted">${esc(r.outcome)} · at ${r.x}, ${r.y}</div>` + side(r.a, 0) + side(r.b, 1) + '<h4>Rounds</h4><table><tr><th>#</th><th>Side</th><th>Shots</th><th>Hits</th><th>Shot down</th><th>Dmg shield/armor/hull</th><th>Kills</th></tr>';
  for (const rd of r.rounds) rd.sides.forEach((s, i) => { h += `<tr><td>${i ? '' : rd.r}</td><td style="color:${owner(i ? r.b.owner : r.a.owner).color}">${i ? 'B' : 'A'}</td><td>${s.shots}</td><td>${s.hits}</td><td>${s.intercepted}</td><td>${s.dmg.shield}/${s.dmg.armor}/${s.dmg.hull}</td><td>${s.kills.length ? s.kills.length + ' (' + [...new Set(s.kills)].join(', ') + ')' : ''}</td></tr>`; });
  h += '</table>' + (r.rounds.some(x => x.note) ? `<p class="warn">${r.rounds.filter(x => x.note).map(x => 'Round ' + x.r + ': ' + esc(x.note)).join('<br>')}</p>` : '') +
    '<p class="muted">Long-range weapons fire from round 1, medium from 2, short from 3. Fighters ignore range.</p>';
  return ['📜 Battle report', h];
}
function showReport(id) { ui.view = { rep: id }; renderSheet(); $('sh-body').scrollTop = 0; }

// ---------- clicks (event delegation) ----------
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-a],[data-sheet],[data-x],[data-cmd],[data-speed],[data-hull],[data-load],[data-pick],[data-rep],[data-col],[data-bsel]'); if (!t) return;
  const ds = t.dataset;
  if (ds.sheet !== undefined) { ui.sheet === ds.sheet ? closeSheet() : openSheet(ds.sheet); return; }
  if (ds.col) { ui.col = ds.col; ui.sheet = null; openSheet('colony'); return; }
  if (ds.bsel !== undefined) { ui.bsel = ds.bsel || null; ui.lastHtml = null; renderSheet(); return; }
  if (ds.x !== undefined) { ui.sel = null; ui.mark = null; card(); return; }
  if (ds.rep) { showReport(ds.rep); return; }
  if (ds.speed) { ui.G.speed = +ds.speed; renderSheet(); hud(); return; }
  if (ds.hull) { ui.des.hull = ds.hull; ui.des.mods = ui.des.mods.slice(0, D.HULLS[ds.hull].slots); renderSheet(); return; }
  if (ds.load) { const d = owner(ME).designs[ds.load]; ui.des = { id: d.tpl ? null : d.id, hull: d.hull, mods: d.mods.slice(), name: d.tpl ? d.name + ' Mk2' : d.name }; renderSheet(); $('sh-body').scrollTop = 0; return; }
  if (ds.pick) { const [b, d, k] = JSON.parse(ds.pick), p = ui.picks[b]; p[d] = Math.max(0, (p[d] || 0) + k); renderSheet(); return; }
  if (ds.cmd) return cmd(ds.cmd);
  if (ds.a) {
    const a = JSON.parse(ds.a);
    if (a.focus) { closeSheet(); select(a.focus, true); return; }
    if (a.view) { openSheet(a.view, { base: a.base }); return; }
    const r = act(a);
    if (r.ok && a.type === 'launch') { closeSheet(); select(r.id, true); toast('Fleet launched: tap the map to send it'); }
    if (r.ok && (a.type === 'colonize' || a.type === 'starbase')) { select(r.id); toast(a.type === 'colonize' ? 'Colony ship on its way' : 'Construction ship on its way'); }
    if (r.ok && a.type === 'move') { ui.mark = { x: a.x, y: a.y }; select(a.fleet); }
    if (r.ok && (a.type === 'chase' || a.type === 'attack' || a.type === 'mine')) select(a.fleet);
  }
});
document.addEventListener('change', ev => {
  const s = ev.target.closest('select[data-slot]'); if (!s) return;
  ui.des.mods[+s.dataset.slot] = s.value || null; ui.des.name = ($('dname') || {}).value || ui.des.name; renderSheet();
});
function cmd(c) {
  if (c === 'save') { ui.G.save(); toast('Game saved'); }
  if (c === 'new') { if (confirm('Start a new galaxy? Your current game will be lost.')) ui.G.newGame(); }
  if (c === 'saveDesign' || c === 'saveBuild') {
    ui.des.name = $('dname').value.trim() || 'Design';
    const r = act({ type: 'saveDesign', design: { id: ui.des.id, name: ui.des.name, hull: ui.des.hull, mods: ui.des.mods.filter(Boolean) } });
    if (r.ok) { ui.des.id = r.id; toast('Design saved: ' + ui.des.name); if (c === 'saveBuild') act({ type: 'build', design: r.id, n: 1 }); renderSheet(); }
  }
}
$('sh-x').onclick = closeSheet;
$('sh-back').onclick = () => { ui.view = null; renderSheet(); };
$('spd').onclick = () => { const v = [1, 2, 4, 8]; ui.G.speed = v[(v.indexOf(ui.G.speed) + 1) % v.length]; hud(); };
for (const id of ['sheet', 'card']) $(id).addEventListener('pointerdown', () => { ui.touchT = performance.now(); });

// ---------- map input: drag pan, pinch/wheel zoom, tap select ----------
function tap(sx, sy) {
  const G = st(), { obj, wx, wy } = R.pick(G, sx, sy), myF = ui.fleet && S.byId(G, ui.fleet), selIsMyFleet = myF && ui.sel === myF.id;
  if (obj) { select(obj.id); return; }
  ui.mark = { x: Math.max(2, Math.min(198, wx)), y: Math.max(2, Math.min(198, wy)) };
  if (selIsMyFleet && !S.civil(G, myF)) { act({ type: 'move', fleet: myF.id, x: ui.mark.x, y: ui.mark.y }); card(); return; }
  select('space');
}
function bindMap(cv) {
  const pts = new Map(); let downAt = 0, moved = 0, pinch = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { downAt = performance.now(); moved = 0; } pinch = null; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); R.cam.x -= dx / R.unit(); R.cam.y -= dy / R.unit(); }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) { const [wx, wy] = R.toWorld(mx, my); R.cam.z *= d / pinch.d; R.clampCam(); const [nx, ny] = R.toWorld(mx, my); R.cam.x += wx - nx; R.cam.y += wy - ny; R.cam.x -= (mx - pinch.mx) / R.unit(); R.cam.y -= (my - pinch.my) / R.unit(); }
      pinch = { d, mx, my }; moved = 99;
    }
    R.clampCam();
  });
  const up = e => { const had = pts.delete(e.pointerId); if (had && !pts.size && moved < 10 && performance.now() - downAt < 500) tap(e.clientX, e.clientY); if (pts.size < 2) pinch = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = R.toWorld(e.clientX, e.clientY); R.cam.z *= Math.exp(-e.deltaY * .0015); R.clampCam(); const [nx, ny] = R.toWorld(e.clientX, e.clientY); R.cam.x += wx - nx; R.cam.y += wy - ny; R.clampCam(); }, { passive: false });
}
// periodic refresh; skip sheet re-render right after a touch so buttons don't vanish under the finger
let lastSheet = 0;
function refresh(force) {
  hud();
  const now = performance.now();
  if (ui.sel && (force || now - ui.touchT > 600)) card();
  if (ui.sheet && ui.sheet !== 'design' && (force || (now - lastSheet > 1000 && now - ui.touchT > 600))) { lastSheet = now; renderSheet(); }
  else surf();
}
function markSeen(showLast) { const L = st().log; L.forEach((l, i) => { if (!(showLast && i === L.length - 1)) seen.add(l); }); ui.toasts = true; }
self.NTUI = { ui, markSeen, init(G) { ui.G = G; bindMap($('map')); }, refresh, select, openSheet, closeSheet, showReport, toast, tap, card };
})();
