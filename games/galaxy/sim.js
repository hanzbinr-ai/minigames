// Blackhole Throne: authoritative simulation. Pure: no DOM, deterministic from seed, fixed dt ticks,
// state is plain JSON. Runs in the browser now and can run unchanged on a Node server later.
(function (root, f) {
  const req = typeof require === 'function';
  const m = f(req ? require('./data.js') : root.NTData, req ? require('./battle.js') : root.NTBattle, req ? require('./ai.js') : root.NTAI);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.NTSim = m;
})(typeof self !== 'undefined' ? self : this, function (D, BT, AI) {
const C = D.CFG, DT = C.DT, TPS = Math.round(1 / DT);
const sec = s => Math.round(s * TPS);

function rand(st) { // mulberry32, state kept in st.rng
  let t = (st.rng = (st.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const R = st => () => rand(st);
const nid = (st, p) => p + (st.nextId++);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const afford = (res, c) => Object.keys(c).every(r => (res[r] || 0) >= c[r]);
const pay = (res, c) => { for (const r in c) res[r] -= c[r]; };
const scale = (c, k) => { const o = {}; for (const r in c) o[r] = Math.round(c[r] * k); return o; };
const log = (st, who, msg, ref) => { st.log.push({ t: st.tick, who, msg, ref }); if (st.log.length > 60) st.log.shift(); };

// ---------- setup ----------
function newGame(seed) {
  seed = (seed >>> 0) || 1;
  const st = { v: 1, seed, rng: seed, tick: 0, nextId: 1, planets: [], asteroids: [], starbases: [], fleets: [], emp: {}, reports: [], log: [],
    hazards: [{ id: 'h1', type: 'blackhole', x: 100, y: 100, r: 7 }] }; // black hole: scenery for now
  const homes = { player: [35, 165], ai1: [165, 165], ai2: [165, 35], ai3: [35, 35] };
  for (const fa of D.FACTIONS) {
    const e = st.emp[fa.id] = { id: fa.id, name: fa.name, color: fa.color, kind: fa.kind, res: { metal: 1500, crystal: 1200, gas: 800, energy: 800 },
      bld: { hq: 1, metal: 1, crystal: 1, gas: 1, energy: 1, shipyard: 1, lab: 1, defense: 1 }, research: {}, bq: null, rq: null, sq: [], designs: {}, home: null, ai: { next: 0, mood: 0 } };
    for (const t of D.TEMPLATES) e.designs[t.id] = { id: t.id, name: t.name, hull: t.hull, mods: t.mods.slice(), tpl: true, s: BT.compile(t, null, true).s };
    for (const t of D.NPC) e.designs[t.id] = { id: t.id, name: t.name, hull: t.hull, mods: t.mods.slice(), npc: true, s: BT.compile(t, null, true).s };
    if (homes[fa.id]) {
      const [x, y] = homes[fa.id];
      const p = { id: nid(st, 'p'), x, y, type: 'rocky', r: 4.5, owner: fa.id, kind: 'home', garrison: [] };
      st.planets.push(p); e.home = p.id;
      for (const [d, n] of [['raider', 4], ['escort', 2], ['hunter', 2], ['warden', 1]]) for (let i = 0; i < n; i++) p.garrison.push(mkShip(e, d));
    }
  }
  const types = Object.keys(D.PLANET), ok = (x, y, m) => Math.hypot(x - 100, y - 100) > 18 && st.planets.every(p => Math.hypot(p.x - x, p.y - y) > m) && st.asteroids.every(a => Math.hypot(a.x - x, a.y - y) > 8);
  let tries = 0;
  while (st.planets.length < 40 && tries++ < 5000) {
    const x = 10 + rand(st) * 180, y = 10 + rand(st) * 180;
    if (!ok(x, y, 14)) continue;
    st.planets.push({ id: nid(st, 'p'), x: +x.toFixed(1), y: +y.toFixed(1), type: types[(rand(st) * 4) | 0], r: +(2.2 + rand(st) * 1.6).toFixed(2), owner: null, kind: null, garrison: [] });
  }
  tries = 0;
  while (st.asteroids.length < 18 && tries++ < 5000) {
    const x = 8 + rand(st) * 184, y = 8 + rand(st) * 184;
    if (!ok(x, y, 9)) continue;
    st.asteroids.push({ id: nid(st, 'a'), x: +x.toFixed(1), y: +y.toFixed(1), res: D.RES[(rand(st) * 4) | 0], amount: 3000 });
  }
  for (let i = 0; i < 4; i++) spawnPirates(st);
  spawnMonster(st, 'void_leviathan', 100, 125);
  spawnMonster(st, 'star_kraken', 100 + (rand(st) - .5) * 60, 60 + rand(st) * 80);
  log(st, 'player', 'Welcome, Commander. Your home world is fixed in place: grow by colonizing.');
  return st;
}
function mkShip(e, d) { const s = e.designs[d].s; return { d, hp: s.hp, ar: s.armor }; }
function newFleet(st, owner, x, y, ships, extra) {
  const f = Object.assign({ id: nid(st, 'f'), owner, ships, x0: x, y0: y, x1: x, y1: y, t0: st.tick, spd: 0, order: { t: 'idle' },
    stance: 'aggressive', autoWarp: true, warpCd: 0, dmgUntil: 0, cargo: {}, noEngage: 0, supply: true }, extra || {});
  f.spd = fleetSpeed(st, f);
  st.fleets.push(f); return f;
}
function spawnPirates(st) {
  const comps = [[['raider', 3], ['picket', 2]], [['hunter', 2], ['raider', 2]], [['escort', 1], ['raider', 4]], [['hunter', 3], ['escort', 1]]];
  const comp = comps[(rand(st) * comps.length) | 0], e = st.emp.pirates, ships = [];
  for (const [d, n] of comp) for (let i = 0; i < n; i++) ships.push(mkShip(e, d));
  newFleet(st, 'pirates', 60 + rand(st) * 80, 60 + rand(st) * 80, ships, { name: 'Pirate Raiders' });
}
function spawnMonster(st, d, x, y) { newFleet(st, 'monsters', x, y, [mkShip(st.emp.monsters, d)], { name: st.emp.monsters.designs[d].name, stance: 'defensive' }); }

// ---------- queries ----------
const stat = (st, owner, d) => st.emp[owner].designs[d].s;
const isEmpire = owner => owner && /^(player|ai\d)$/.test(owner);
const hostile = (a, b) => a !== b;
function bases(st, owner) { return st.planets.filter(p => p.owner === owner).concat(st.starbases.filter(s => s.owner === owner)); }
function byId(st, id) {
  if (!id) return null;
  const k = id[0], arr = k === 'p' ? st.planets : k === 'f' ? st.fleets : k === 's' ? st.starbases : k === 'a' ? st.asteroids : null;
  return arr ? arr.find(o => o.id === id) || null : null;
}
function pos(st, f, t) {
  t = t === undefined ? st.tick : t;
  const dx = f.x1 - f.x0, dy = f.y1 - f.y0, d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: f.x0, y: f.y0, done: true };
  const s = Math.min(d, f.spd * Math.max(0, t - f.t0) * DT);
  return { x: f.x0 + dx * s / d, y: f.y0 + dy * s / d, done: s >= d - 1e-6 };
}
function objPos(st, o) { return o.id[0] === 'f' ? pos(st, o) : o; }
function supplyRange(st, owner, kind) { return (kind === 'sb' ? C.supplyBase : C.supplyPlanet) + (st.emp[owner] && st.emp[owner].research.logistics ? 10 : 0); }
function inSupply(st, owner, x, y) {
  if (!isEmpire(owner)) return true;
  for (const p of st.planets) if (p.owner === owner && Math.hypot(p.x - x, p.y - y) <= supplyRange(st, owner)) return true;
  for (const s of st.starbases) if (s.owner === owner && Math.hypot(s.x - x, s.y - y) <= supplyRange(st, owner, 'sb')) return true;
  return false;
}
function fleetSpeed(st, f) {
  if (!f.ships.length) return 0;
  let v = Math.min(...f.ships.map(u => stat(st, f.owner, u.d).spd));
  if (!f.supply) v *= C.supplyDebuff;
  if (f.dmgUntil > st.tick) v *= C.damagedDebuff;
  return +v.toFixed(3);
}
function fleetAtk(st, f) { return (f.supply ? 1 : C.supplyDebuff) * (f.dmgUntil > st.tick ? C.damagedDebuff : 1); }
function fleetSensor(st, f) { return Math.max(0, ...f.ships.map(u => stat(st, f.owner, u.d).sensor)); }
function cmdOf(st, owner, ships) { return ships.reduce((a, u) => a + stat(st, owner, u.d).cmd, 0); }
function power(st, owner, ships) { return ships.reduce((a, u) => { const s = stat(st, owner, u.d); return a + s.cmd * (u.hp + u.ar) / (s.hp + s.armor || 1); }, 0); }
function cmdCap(st, owner) { const e = st.emp[owner]; return 16 + 4 * (e.bld.hq - 1) + (e.research.logistics ? 8 : 0); }
function colonyCap(st, owner) { const e = st.emp[owner]; return 1 + Math.floor((e.bld.hq - 1) / 2) + (e.research.colony1 ? 1 : 0) + (e.research.colony2 ? 1 : 0); }
function colonies(st, owner) { return st.planets.filter(p => p.owner === owner && p.kind === 'colony').length; }
function pendingCivil(st, owner, t) { return st.fleets.filter(f => f.owner === owner && f.order.t === t).length; }
function production(st, owner) {
  const e = st.emp[owner], out = { metal: 0, crystal: 0, gas: 0, energy: 0 };
  if (!e.home) return out;
  for (const r of D.RES) out[r] = 2 + 2 * e.bld[r];
  for (const p of st.planets) if (p.owner === owner && p.kind === 'colony') out[D.PLANET[p.type].res] += 5;
  return out;
}
function buildCost(e, b) { return scale(D.BUILD[b].cost, Math.pow(1.6, e.bld[b] - 1)); }
function buildTime(e, b) { return 4 + 3 * e.bld[b]; }
function canWarp(st, f) {
  const e = st.emp[f.owner];
  if (!e || !e.research.warp || f.warpCd > st.tick) return false;
  const p = pos(st, f);
  return !st.starbases.some(s => s.owner !== f.owner && s.jammer && Math.hypot(s.x - p.x, s.y - p.y) <= C.jamRange);
}
function nearestBase(st, owner, x, y) {
  let best = null, bd = 1e9;
  for (const b of bases(st, owner)) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
  return best;
}

// ---------- movement (server-light: from,to,startTick,speed) ----------
function reanchor(st, f, x, y) { const p = pos(st, f); f.x0 = p.x; f.y0 = p.y; f.x1 = x; f.y1 = y; f.t0 = st.tick; f.spd = fleetSpeed(st, f); }
function setOrder(st, f, order, x, y) { f.order = order; const p = pos(st, f); reanchor(st, f, x === undefined ? p.x : x, y === undefined ? p.y : y); }

// ---------- actions (player and AI use the same entry point) ----------
function act(st, owner, a) {
  const e = st.emp[owner]; if (!e) return err('No empire');
  const F = a.fleet ? byId(st, a.fleet) : null;
  if (a.fleet && (!F || F.owner !== owner)) return err('Not your fleet');
  switch (a.type) {
    case 'upgrade': {
      const b = a.b; if (!D.BUILD[b]) return err('Unknown building');
      if (e.bq) return err('Builders busy');
      if (b !== 'hq' && e.bld[b] >= e.bld.hq + 1) return err('Upgrade HQ first');
      if (e.bld[b] >= 15) return err('Max level');
      const c = buildCost(e, b); if (!afford(e.res, c)) return err('Not enough resources');
      pay(e.res, c); e.bq = { b, end: st.tick + sec(buildTime(e, b)), len: sec(buildTime(e, b)) }; return ok();
    }
    case 'research': {
      const r = D.RESEARCH[a.id]; if (!r) return err('Unknown research');
      if (e.rq) return err('Lab busy'); if (e.research[a.id]) return err('Done already');
      if (r.req && !e.research[r.req]) return err('Requires ' + D.RESEARCH[r.req].name);
      if (!afford(e.res, r.cost)) return err('Not enough resources');
      pay(e.res, r.cost); const t = sec(r.time * Math.pow(.92, e.bld.lab - 1)); e.rq = { id: a.id, end: st.tick + t, len: t }; return ok();
    }
    case 'saveDesign': {
      const c = BT.compile(a.design, e.research); if (!c.ok) return err(c.err);
      const id = a.design.id && e.designs[a.design.id] && !e.designs[a.design.id].tpl ? a.design.id : nid(st, 'd');
      e.designs[id] = { id, name: (a.design.name || 'Design').slice(0, 24), hull: a.design.hull, mods: a.design.mods.slice(), s: c.s };
      return ok({ id });
    }
    case 'build': {
      const d = e.designs[a.design]; if (!d || d.npc) return err('Unknown design');
      const h = D.HULLS[d.hull]; if (h.req && !e.research[h.req]) return err(h.name + ' needs research');
      if (d.mods.some(m => D.MODS[m].req && !e.research[D.MODS[m].req])) return err('Design uses locked modules');
      const base = byId(st, a.base || e.home); if (!base || base.owner !== owner || (base.kind !== 'home' && base.id[0] !== 's')) return err('Ships are built at home or a Star Base');
      const n = Math.max(1, Math.min(20, a.n | 0 || 1)), c = scale(d.s.cost, n), wallet = base.id[0] === 's' ? base.store : e.res;
      if (!afford(wallet, c)) return err(base.id[0] === 's' ? 'Star Base supplies too low' : 'Not enough resources');
      pay(wallet, c); e.sq.push({ d: d.id, n, base: base.id, end: 0 }); return ok();
    }
    case 'launch': { // a.base, a.picks {designId:count} (or all)
      const base = byId(st, a.base); if (!base || base.owner !== owner) return err('Not your base');
      if (st.fleets.filter(f => f.owner === owner && !civil(st, f)).length >= C.maxFleets) return err('Fleet limit reached (' + C.maxFleets + ')');
      const ships = [], cap = cmdCap(st, owner); let cmd = 0;
      const want = Object.assign({}, a.picks || {});
      for (const u of base.garrison.slice()) {
        const s = stat(st, owner, u.d); if (s.civ) continue;
        if (a.picks && !(want[u.d] > 0)) continue;
        if (cmd + s.cmd > cap) continue;
        cmd += s.cmd; ships.push(u); base.garrison.splice(base.garrison.indexOf(u), 1); if (a.picks) want[u.d]--;
      }
      if (!ships.length) return err('No warships available');
      const f = newFleet(st, owner, base.x, base.y, ships, { name: a.name || 'Fleet ' + (st.fleets.filter(x => x.owner === owner).length + 1), stance: a.stance || 'aggressive' });
      return ok({ id: f.id });
    }
    case 'move': if (!F) return err('No fleet'); setOrder(st, F, { t: 'move' }, clampX(a.x), clampX(a.y)); return ok();
    case 'stop': if (!F) return err('No fleet'); setOrder(st, F, { t: 'idle' }); return ok();
    case 'return': { if (!F) return err('No fleet'); const p = pos(st, F), b = nearestBase(st, owner, p.x, p.y); if (!b) return err('No base');
      setOrder(st, F, { t: 'return', target: b.id }, b.x, b.y); return ok(); }
    case 'attack': case 'chase': {
      if (!F) return err('No fleet'); const T = byId(st, a.target); if (!T || T.owner === owner || !T.owner) return err('Invalid target');
      if (civil(st, F)) return err('Civilian ships cannot attack');
      const p = objPos(st, T); setOrder(st, F, { t: T.id[0] === 'f' ? 'chase' : 'attack', target: T.id }, p.x, p.y); return ok();
    }
    case 'mine': { if (!F) return err('No fleet'); const A = byId(st, a.target); if (!A || A.id[0] !== 'a') return err('Not an asteroid field');
      setOrder(st, F, { t: 'mine', target: A.id }, A.x, A.y); return ok(); }
    case 'stance': if (!F || !['aggressive', 'defensive', 'passive'].includes(a.stance)) return err('Bad stance'); F.stance = a.stance; return ok();
    case 'autoWarp': if (!F) return err('No fleet'); F.autoWarp = !!a.on; return ok();
    case 'warp': if (!F) return err('No fleet'); if (!e.research.warp) return err('Research Warp Retreat first');
      if (!canWarp(st, F)) return err(F.warpCd > st.tick ? 'Warp drive cooling down' : 'Warp is jammed nearby'); warp(st, F, 'manual'); return ok();
    case 'colonize': {
      const P = byId(st, a.planet); if (!P || P.id[0] !== 'p' || P.owner) return err('Planet is not free');
      if (colonies(st, owner) + pendingCivil(st, owner, 'colonize') >= colonyCap(st, owner)) return err('Colony cap reached (upgrade HQ or research)');
      const got = takeCivil(st, owner, 'colony'); if (!got) return err('Build a Colony Ship at the Shipyard first');
      const f = newFleet(st, owner, got.base.x, got.base.y, [got.ship], { name: 'Colony Ship', stance: 'passive' });
      setOrder(st, f, { t: 'colonize', target: P.id }, P.x, P.y); return ok({ id: f.id });
    }
    case 'starbase': {
      const x = clampX(a.x), y = clampX(a.y);
      if (st.starbases.filter(s => s.owner === owner).length + pendingCivil(st, owner, 'starbase') >= C.starbaseCap) return err('Star Base limit reached (' + C.starbaseCap + ')');
      if (st.planets.some(p => Math.hypot(p.x - x, p.y - y) < 8) || st.starbases.some(s => Math.hypot(s.x - x, s.y - y) < 12)) return err('Too close to a planet or Star Base (build in empty space)');
      const got = takeCivil(st, owner, 'starbase'); if (!got) return err('Build a Construction Ship at the Shipyard first');
      const f = newFleet(st, owner, got.base.x, got.base.y, [got.ship], { name: 'Construction Ship', stance: 'passive' });
      setOrder(st, f, { t: 'starbase', x, y }, x, y); return ok({ id: f.id });
    }
    case 'deposit': { // move resources from treasury into a star base depot
      const S = byId(st, a.base); if (!S || S.id[0] !== 's' || S.owner !== owner) return err('Not your Star Base');
      const amt = a.amount || 200, c = {}; for (const r of D.RES) c[r] = Math.min(amt, Math.floor(e.res[r]));
      pay(e.res, c); for (const r in c) S.store[r] += c[r]; return ok();
    }
    case 'cancelQueue': { const q = e.sq[a.i]; if (!q) return err('Nothing queued'); e.sq.splice(a.i, 1);
      const refund = scale(e.designs[q.d].s.cost, q.n * .8), b = byId(st, q.base); const w = b && b.id[0] === 's' ? b.store : e.res; for (const r in refund) w[r] += refund[r]; return ok(); }
  }
  return err('Unknown action');
}
const ok = x => Object.assign({ ok: true }, x || {});
const err = m => ({ ok: false, err: m });
const clampX = v => Math.max(2, Math.min(C.W - 2, +v || 0));
function civil(st, f) { return f.ships.length > 0 && f.ships.every(u => stat(st, f.owner, u.d).civ); }
function takeCivil(st, owner, kind) {
  for (const b of bases(st, owner)) for (const u of b.garrison) if (stat(st, owner, u.d).civ === kind) { b.garrison.splice(b.garrison.indexOf(u), 1); return { base: b, ship: u }; }
  return null;
}

// ---------- tick ----------
function step(st) {
  st.tick++;
  const t = st.tick;
  for (const id in st.emp) {
    const e = st.emp[id];
    if (e.home) { const pr = production(st, id); for (const r of D.RES) e.res[r] += pr[r] * DT; }
    if (e.bq && t >= e.bq.end) { e.bld[e.bq.b]++; if (id === 'player') log(st, id, D.BUILD[e.bq.b].name + ' reached level ' + e.bld[e.bq.b]); e.bq = null; }
    if (e.rq && t >= e.rq.end) { e.research[e.rq.id] = true; if (id === 'player') log(st, id, 'Research complete: ' + D.RESEARCH[e.rq.id].name); e.rq = null; }
    const q = e.sq[0];
    if (q) {
      const base = byId(st, q.base);
      if (!base || base.owner !== id) e.sq.shift();
      else if (!q.end) q.end = t + sec(e.designs[q.d].s.time * Math.pow(.92, e.bld.shipyard - 1));
      else if (t >= q.end) { base.garrison.push(mkShip(e, q.d)); q.n--; q.end = 0; if (q.n <= 0) { e.sq.shift(); if (id === 'player') log(st, id, e.designs[q.d].name + ' ready at ' + baseName(st, base)); } }
    }
  }
  if (t % TPS === 0) repairGarrisons(st);
  for (const f of st.fleets.slice()) if (st.fleets.includes(f)) fleetTick(st, f);
  if (t % sec(1) === 0) npcTick(st);
  for (const id of ['ai1', 'ai2', 'ai3']) { const e = st.emp[id]; if (e.home && t >= e.ai.next) { e.ai.next = t + sec(6); AI.think(st, e, API); } }
}
function baseName(st, b) { return b.id[0] === 's' ? 'Star Base' : b.kind === 'home' ? 'home planet' : 'colony'; }
function repairGarrisons(st) {
  for (const b of st.planets.concat(st.starbases)) if (b.owner && b.kind !== 'colony') for (const u of b.garrison) {
    const s = stat(st, b.owner, u.d); u.hp = Math.min(s.hp, u.hp + s.hp * C.repairRate); u.ar = Math.min(s.armor, u.ar + s.armor * C.repairRate);
  }
}
function fleetTick(st, f) {
  const t = st.tick, p = pos(st, f);
  if (!f.ships.length) return removeFleet(st, f);
  // supply & debuff changes alter speed: re-anchor so position stays continuous
  const sup = inSupply(st, f.owner, p.x, p.y);
  if (sup !== f.supply) f.supply = sup;
  const v = fleetSpeed(st, f); if (Math.abs(v - f.spd) > 1e-6) reanchor(st, f, f.x1, f.y1);
  const o = f.order;
  if (o.t === 'chase' || o.t === 'attack') {
    const T = byId(st, o.target);
    if (!T || T.owner === f.owner || !T.owner) { setOrder(st, f, { t: 'idle' }); return; }
    const tp = objPos(st, T);
    if (o.t === 'chase' && t % 2 === 0) reanchor(st, f, tp.x, tp.y);
    if (Math.hypot(tp.x - p.x, tp.y - p.y) <= C.contact + (T.r || 0)) {
      if (T.id[0] === 'f') fleetBattle(st, f, T); else baseBattle(st, f, T);
    }
    return;
  }
  if (o.t === 'mine') {
    const A = byId(st, o.target); if (!A || A.amount <= 0) return goHome(st, f);
    if (!p.done) return;
    const cap = cmdOf(st, f.owner, f.ships) * 60, have = Object.values(f.cargo).reduce((a, b) => a + b, 0);
    const take = Math.min(A.amount, cap - have, f.ships.length * 4 * DT);
    if (take <= 0) return goHome(st, f);
    A.amount -= take; f.cargo[A.res] = (f.cargo[A.res] || 0) + take; return;
  }
  if (p.done && (o.t === 'return' || o.t === 'colonize' || o.t === 'starbase')) return arrive(st, f);
  if (p.done && o.t === 'move') { // a move that ends on an asteroid field starts mining instead of idling there
    const A = !civil(st, f) && st.asteroids.find(a => a.amount > 0 && Math.hypot(a.x - p.x, a.y - p.y) < 3);
    f.order = A ? { t: 'mine', target: A.id } : { t: 'idle' }; if (A) return;
  }
  // stances
  if (t % 2 || f.noEngage > t || civil(st, f)) return;
  const sens = fleetSensor(st, f);
  if (f.stance === 'aggressive' && (o.t === 'idle' || o.t === 'move' || (o.t === 'return' && !isEmpire(f.owner)))) {
    let best = null, bd = sens;
    for (const g of st.fleets) {
      if (g === f || !hostile(g.owner, f.owner) || g.noEngage > t) continue;
      if (f.owner === 'pirates' && power(st, g.owner, g.ships) > .8 * power(st, f.owner, f.ships) && !civil(st, g)) continue; // pirates hunt weak prey
      if (f.owner === 'monsters' && g.owner === 'monsters') continue;
      const d = dist(p, pos(st, g)); if (d < bd) { bd = d; best = g; }
    }
    if (best) { const bp = pos(st, best); setOrder(st, f, { t: 'chase', target: best.id, prev: o.t === 'move' ? { x: f.x1, y: f.y1 } : null }, bp.x, bp.y); }
  } else if (f.stance === 'passive' && o.t !== 'return') {
    const threat = st.fleets.find(g => hostile(g.owner, f.owner) && g.order.target === f.id && dist(p, pos(st, g)) < sens);
    if (threat) goHome(st, f);
  }
}
function goHome(st, f) {
  const p = pos(st, f), b = nearestBase(st, f.owner, p.x, p.y);
  if (!b) { f.order = { t: 'idle' }; return; }
  setOrder(st, f, { t: 'return', target: b.id }, b.x, b.y);
}
function arrive(st, f) {
  const o = f.order, e = st.emp[f.owner];
  if (o.t === 'return') {
    const b = byId(st, o.target);
    if (!b || b.owner !== f.owner) return goHome(st, f);
    b.garrison.push(...f.ships);
    const wallet = b.id[0] === 's' ? b.store : e.res;
    for (const r in f.cargo) wallet[r] = (wallet[r] || 0) + f.cargo[r];
    removeFleet(st, f); return;
  }
  if (o.t === 'colonize') {
    const P = byId(st, o.target);
    if (!P || P.owner || colonies(st, f.owner) >= colonyCap(st, f.owner)) { if (f.owner === 'player') log(st, 'player', 'Colonization failed: planet taken or cap reached'); return goHome(st, f); }
    P.owner = f.owner; P.kind = 'colony'; P.garrison = [];
    if (f.owner === 'player') log(st, 'player', 'New colony founded on a ' + D.PLANET[P.type].name, P.id);
    removeFleet(st, f); return;
  }
  if (o.t === 'starbase') {
    const sb = { id: nid(st, 's'), owner: f.owner, x: o.x, y: o.y, r: 3, hp: 0, ar: 0, store: { metal: 0, crystal: 0, gas: 0, energy: 0 }, garrison: [], jammer: !!e.research.jammer };
    const core = stat(st, f.owner, 'sbcore'); sb.hp = core.hp; sb.ar = core.armor;
    st.starbases.push(sb);
    if (f.owner === 'player') log(st, 'player', 'Star Base online', sb.id);
    removeFleet(st, f);
  }
}
function removeFleet(st, f) { const i = st.fleets.indexOf(f); if (i >= 0) st.fleets.splice(i, 1); }

// ---------- combat ----------
function sideOf(st, label, owner, entries, atk, warpAt) {
  return { name: label, owner, atk, warpAt, ships: entries.map(x => ({ st: stat(st, owner, x.d), hp: x.hp, ar: x.ar, ref: x })) };
}
function counts(st, owner, ships) { const c = {}; for (const u of ships) { const n = stat(st, owner, u.d).name; c[n] = (c[n] || 0) + 1; } return c; }
function writeBack(side) { for (const u of side.ships) { u.ref.hp = Math.max(0, u.hp); u.ref.ar = Math.max(0, u.ar); } }
function label(st, owner, thing) { return st.emp[owner].name + (thing ? ' · ' + thing : ''); }
function report(st, A, B, res, where, outcome, aBefore, bBefore) {
  const r = { id: nid(st, 'r'), tick: st.tick, x: +where.x.toFixed(1), y: +where.y.toFixed(1), a: { owner: A.owner, name: A.name, before: aBefore, after: counts(st, A.owner, A.ships.filter(u => u.hp > 0).map(u => u.ref)), lost: res.lostA },
    b: { owner: B.owner, name: B.name, before: bBefore, after: counts(st, B.owner, B.ships.filter(u => u.hp > 0).map(u => u.ref)), lost: res.lostB }, winner: res.winner, rounds: res.rounds, outcome, formation: res.formation };
  st.reports.push(r); if (st.reports.length > 40) st.reports.shift();
  if (A.owner === 'player' || B.owner === 'player') log(st, 'player', 'Battle: ' + outcome, r.id);
  return r;
}
function fleetBattle(st, f, g) {
  const pf = pos(st, f);
  const A = sideOf(st, label(st, f.owner, f.name), f.owner, f.ships, fleetAtk(st, f), f.autoWarp && canWarp(st, f) ? C.warpThreshold : 0);
  const B = sideOf(st, label(st, g.owner, g.name), g.owner, g.ships, fleetAtk(st, g), g.autoWarp && canWarp(st, g) ? C.warpThreshold : 0);
  const aB = counts(st, f.owner, f.ships), bB = counts(st, g.owner, g.ships);
  const res = BT.fight(R(st), A, B);
  writeBack(A); writeBack(B);
  f.ships = f.ships.filter(u => u.hp > 0); g.ships = g.ships.filter(u => u.hp > 0);
  const win = res.winner === 'A' ? f : g, lose = win === f ? g : f, lw = win === f ? res.warped.B : res.warped.A;
  let outcome = st.emp[win.owner].name + ' won';
  if (!lose.ships.length) { outcome += ', ' + st.emp[lose.owner].name + ' fleet destroyed'; loot(st, win, lose); removeFleet(st, lose); }
  else if (lw) { warp(st, lose, 'auto'); outcome += ', ' + st.emp[lose.owner].name + ' warped out'; }
  else { lose.noEngage = st.tick + sec(10); if (isEmpire(lose.owner)) goHome(st, lose); else setOrder(st, lose, { t: 'move' }, clampX(pos(st, lose).x + (rand(st) - .5) * 40), clampX(pos(st, lose).y + (rand(st) - .5) * 40)); outcome += ', ' + st.emp[lose.owner].name + ' retreated'; }
  if (!win.ships.length) removeFleet(st, win);
  else { win.noEngage = st.tick + sec(2); const pv = win.order.prev; setOrder(st, win, pv ? { t: 'move' } : { t: 'idle' }, pv ? pv.x : undefined, pv ? pv.y : undefined); }
  return report(st, A, B, res, pf, outcome, aB, bB);
}
function loot(st, win, lose) {
  if (lose.owner === 'pirates' || lose.owner === 'monsters') {
    const k = lose.owner === 'monsters' ? 600 : 120;
    for (const r of D.RES) win.cargo[r] = (win.cargo[r] || 0) + k;
  }
  for (const r in lose.cargo) win.cargo[r] = (win.cargo[r] || 0) + lose.cargo[r];
}
function defenders(st, b) {
  const list = b.garrison.filter(u => !stat(st, b.owner, u.d).civ).slice();
  const e = st.emp[b.owner], tur = stat(st, b.owner, 'turret');
  const n = b.kind === 'home' ? e.bld.defense : b.kind === 'colony' ? 1 : 2;
  const turrets = []; for (let i = 0; i < n; i++) turrets.push({ d: 'turret', hp: tur.hp, ar: tur.armor, turret: true });
  const core = b.id[0] === 's' ? [{ d: 'sbcore', hp: b.hp, ar: b.ar, core: true }] : [];
  return core.concat(turrets, list);
}
function baseBattle(st, f, b) {
  const defs = defenders(st, b);
  const A = sideOf(st, label(st, f.owner, f.name), f.owner, f.ships, fleetAtk(st, f), f.autoWarp && canWarp(st, f) ? C.warpThreshold : 0);
  const B = sideOf(st, label(st, b.owner, baseName(st, b)), b.owner, defs, 1, 0);
  const aB = counts(st, f.owner, f.ships), bB = counts(st, b.owner, defs);
  const res = BT.fight(R(st), A, B);
  writeBack(A); writeBack(B);
  f.ships = f.ships.filter(u => u.hp > 0);
  b.garrison = b.garrison.filter(u => u.hp > 0);
  const core = defs.find(u => u.core); if (core) { b.hp = core.hp; b.ar = core.ar; }
  const e = st.emp[b.owner], fo = st.emp[f.owner].name, bo = e.name;
  let outcome;
  if (res.winner === 'A' && f.ships.length) {
    if (b.id[0] === 's') { // star bases are destroyed, never captured; part of the stored supplies drop
      for (const r of D.RES) f.cargo[r] = (f.cargo[r] || 0) + Math.floor(b.store[r] * C.sbDrop);
      st.starbases.splice(st.starbases.indexOf(b), 1); outcome = fo + ' destroyed a ' + bo + ' Star Base';
    } else if (b.kind === 'colony' && isEmpire(f.owner) && (!b.garrison.length || !core)) {
      b.owner = f.owner; b.garrison = []; outcome = fo + ' captured a ' + bo + ' colony';
    } else { // home planets (and colonies hit by pirates) can only be raided
      const cap = cmdOf(st, f.owner, f.ships) * 60;
      for (const r of D.RES) { const k = Math.min(Math.floor(e.res[r] * C.raidFrac), cap / 4); e.res[r] -= k; f.cargo[r] = (f.cargo[r] || 0) + k; }
      outcome = fo + ' raided the ' + bo + ' ' + baseName(st, b);
    }
    f.noEngage = st.tick + sec(3);
    if (isEmpire(f.owner)) goHome(st, f); else setOrder(st, f, { t: 'idle' });
  } else {
    outcome = bo + ' ' + baseName(st, b) + ' held against ' + fo;
    if (!f.ships.length) removeFleet(st, f);
    else if (res.warped.A) warp(st, f, 'auto');
    else { f.noEngage = st.tick + sec(10); if (isEmpire(f.owner)) goHome(st, f); else setOrder(st, f, { t: 'idle' }); }
  }
  return report(st, A, B, res, b, outcome, aB, bB);
}
// Warp Retreat: lose ~20% of ships, jump to nearest own base, damaged debuff, cooldown
function warp(st, f, why) {
  const p = pos(st, f), b = nearestBase(st, f.owner, p.x, p.y);
  const n = f.ships.length, lose = n > 1 ? Math.max(1, Math.round(n * C.warpLoss)) : 0;
  for (let i = 0; i < lose; i++) f.ships.splice((rand(st) * f.ships.length) | 0, 1);
  f.warpCd = st.tick + sec(C.warpCooldown); f.dmgUntil = st.tick + sec(C.warpDamaged); f.noEngage = st.tick + sec(5);
  const to = b || p;
  f.x0 = f.x1 = to.x + 3; f.y0 = f.y1 = to.y + 3; f.t0 = st.tick; f.order = { t: 'idle' }; f.spd = fleetSpeed(st, f);
  if (f.owner === 'player') log(st, 'player', f.name + ' warped to safety (' + why + '), lost ' + lose + ' ships', f.id);
  return lose;
}

// ---------- pirates & monsters ----------
function npcTick(st) {
  const t = st.tick;
  for (const f of st.fleets) {
    if (isEmpire(f.owner) || f.order.t !== 'idle' || f.noEngage > t + sec(5)) continue;
    if (rand(st) < (f.owner === 'monsters' ? .03 : .15)) {
      const p = pos(st, f);
      setOrder(st, f, { t: 'move' }, clampX(p.x + (rand(st) - .5) * 60), clampX(p.y + (rand(st) - .5) * 60));
    }
  }
  // occasionally pirates raid a weakly defended colony
  if (t % sec(45) === 0) {
    const pir = st.fleets.filter(f => f.owner === 'pirates' && f.order.t !== 'attack');
    const cols = st.planets.filter(p => p.kind === 'colony' && !p.garrison.length);
    if (pir.length && cols.length) { const f = pir[(rand(st) * pir.length) | 0], c = cols[(rand(st) * cols.length) | 0];
      if (dist(pos(st, f), c) < 70) setOrder(st, f, { t: 'attack', target: c.id }, c.x, c.y); }
  }
  if (t % sec(40) === 0 && st.fleets.filter(f => f.owner === 'pirates').length < 4) spawnPirates(st);
}

const API = { act, pos, byId, bases, colonies, colonyCap, cmdCap, cmdOf, power, nearestBase, stat, buildCost, afford, rand, civil, dist, pendingCivil, production };
function save(st) { return JSON.stringify(st); }
function load(s) { const st = JSON.parse(s); if (!st || st.v !== 1) throw new Error('bad save'); return st; }
return Object.assign({ D, BT, DT, TPS, sec, newGame, step, save, load, fleetSpeed, fleetSensor, inSupply, supplyRange, canWarp, warp, fleetBattle, baseBattle, newFleet, mkShip, buildTime, isEmpire, objPos, counts }, API);
});
