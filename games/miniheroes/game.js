// Mini Heroes - logic + rendering. G = saved game state, UI = screen state, B = current battle.
'use strict';
let MW = 24, MH = 18; const TS = 16, BW = 10, BH = 7, CW = 24, BOX = 8, BOY = 28, BLW = 256, BLH = 200;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const SAVE_KEY = 'mh-save-v2';
let G = null, B = null;
const UI = {mode: 'title', preview: null, walk: null, ai: null, panel: null, levelQ: [], rpos: {}, fx: [], ret: 'map'};

// ---------- audio ----------
let AC = null, muted = localStorage.getItem('mh-mute') === '1';
function beep(f = 440, d = 0.08, type = 'square', v = 0.04) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
  } catch (e) {}
}
const tune = (fs, gap = 80) => fs.forEach((f, i) => setTimeout(() => beep(f, 0.09), i * gap));
const SFX = {
  step: () => beep(180, 0.03, 'triangle'), click: () => beep(520, 0.03), pick: () => tune([660, 880]),
  hit: () => beep(110, 0.12, 'sawtooth'), lvl: () => tune([523, 659, 784, 1046]), bad: () => beep(90, 0.2, 'triangle'),
  win: () => tune([392, 523, 659, 784, 1046], 110), lose: () => tune([392, 330, 262, 196], 160), magic: () => tune([900, 1200, 1500], 40),
};

// ---------- helpers ----------
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const objAt = (x, y) => G.objs.find(o => o.x === x && o.y === y);
const heroAt = (x, y) => G.heroes.find(h => h.x === x && h.y === y);
const townAt = (x, y) => G.towns.find(t => t.x === x && t.y === y);
const heroById = id => G.heroes.find(h => h.id === id);
const myHeroes = () => G.heroes.filter(h => h.owner === 'player');
const curHero = () => { const h = heroById(G.sel); return h && h.owner === 'player' ? h : myHeroes()[0]; };
const artBonus = (h, s) => h.arts.reduce((a, k) => a + (ARTIFACTS[k].stat === s ? ARTIFACTS[k].val : 0), 0);
const stat = (h, s) => h[s] + artBonus(h, s);
const skl = (h, k) => SKILLS[k].v[(h && h.sk && h.sk[k]) || 0];
const maxMp = h => Math.round((BASE_MP + artBonus(h, 'mp')) * (1 + skl(h, 'logistics') / 100 + techSum(h.owner, 'mp') / 100));
const maxMana = h => Math.round(stat(h, 'kn') * 10 * (1 + skl(h, 'wisdom') / 100 + (pol(h.owner, 'manafont') ? 0.2 : 0) + (ktal(h.owner, 'scholars') ? 0.1 : 0) + techSum(h.owner, 'mana') / 100));
const sight = h => 4 + skl(h, 'scouting') + (pol(h.owner, 'carto') ? 1 : 0);
const costText = c => RES.filter(r => c[r]).map(r => c[r] + ' ' + r).join(', ');
const canPay = (owner, c) => RES.every(r => (G.res[owner][r] || 0) >= (c[r] || 0));
const pay = (owner, c) => RES.forEach(r => G.res[owner][r] -= (c[r] || 0));
const armyText = a => a.map(s => s.count + ' ' + s.type).join(', ') || 'none';
const US = u => u.S || UNITS[u.type] || UNITS.Peasant;
const hasAb = (u, k) => US(u).ab.includes(k);
const countWord = n => { for (const [m, w] of COUNT_BANDS) if (n >= m) return w; return n < 10 ? String(n) : n < 20 ? '10-19' : n < 50 ? '20-49' : '50-99'; };
const countText = (n, exact) => exact ? String(n) : countWord(n);
const bandArmy = a => a.map(s => countWord(s.count) + ' ' + s.type).join(', ') || 'none';
const sizeWord = n => n < 5 ? 'A few' : n < 10 ? 'Several' : n < 20 ? 'A pack of' : n < 50 ? 'Lots of' : 'A horde of';
const calText = d => 'D' + ((d - 1) % 7 + 1) + ' W' + (Math.floor((d - 1) / 7) % 4 + 1) + ' M' + (Math.floor((d - 1) / 28) + 1);
let msgTimer = 0;
function msg(t) { $('msg').textContent = t; msgTimer = 4; }
function addUnits(army, type, n) {
  if (n <= 0) return true;
  const s = army.find(a => a.type === type);
  if (s) { s.count += n; return true; }
  if (army.length >= MAX_STACKS) return false;
  army.push({type, count: n}); return true;
}
function armyPower(army, h) {
  const b = h ? 1 + 0.05 * (stat(h, 'att') + stat(h, 'def')) : 1;
  return army.reduce((p, s) => { const u = US(s); return p + s.count * u.hp * (u.dmg[0] + u.dmg[1]) / 2 * (1 + (u.att + u.def) * 0.05); }, 0) * b;
}

// ---------- FACTION RESEARCH + TECH (per owner; fx data lives in TECH in data.js) ----------
const RS = o => G && G.rs && G.rs[o];
const mkRS = () => ({pts: 0, prog: 0, today: 0, total: 0, picks: {}, log: []});
const facOf = o => (G && G.kg && G.kg[o] && G.kg[o].faction) || null;
function techList(o) { const R = RS(o), f = facOf(o); if (!R || !f || !TECH[f]) return []; return TECH[f].map((lv, i) => lv.find(t => t.k === R.picks[i])).filter(Boolean); }
const techFx = (o, k) => techList(o).map(t => t.fx[k]).filter(v => v != null);
const techSum = (o, k) => techFx(o, k).reduce((a, b) => a + b, 0);
const techCap = (o, k) => techFx(o, 'cap').includes(k);
const heroSpec = h => h && h.fac && FACTIONS[h.fac] ? FACTIONS[h.fac].spec.k : null;
// Effective unit stats for an owner: base stats + that owner's faction techs (only for their own faction's creatures).
function effStats(o, type) {
  const b = UNITS[type] || UNITS.Peasant, S = {...b, dmg: b.dmg.slice(), ab: b.ab.slice()};
  if (!b.fac || facOf(o) !== b.fac) return S;
  let hp = 0, dm = 0;
  for (const u of techFx(o, 'u')) { if (u.tiers && !u.tiers.includes(b.tier)) continue; S.att += u.att || 0; S.def += u.def || 0; hp += u.hp || 0; dm += u.dmg || 0; S.move += u.move || 0; if (S.range) S.range += u.range || 0; (u.add || []).forEach(a => S.ab.includes(a) || S.ab.push(a)); }
  if (techCap(o, 'legion') && b.tier >= 5) { hp += 25; dm += 25; if (!S.ab.includes('SpellImm')) S.ab.push('SpellImm'); }
  if (techCap(o, 'wildhunt')) { S.move += 2; dm += 15; }
  S.hp = Math.max(1, Math.round(S.hp * (1 + hp / 100))); S.dmg = S.dmg.map(d => Math.max(1, Math.round(d * (1 + dm / 100)))); S.def = Math.max(0, S.def); S.move = Math.max(1, S.move);
  return S;
}
// Every research gain goes through here: tech bonus, then the daily cap.
function addRP(o, amt, why) {
  const R = RS(o); if (!R || !(amt > 0)) return 0;
  amt = Math.min(amt * (1 + techSum(o, 'rp') / 100), Math.max(0, RP_DAY_CAP - R.today));
  if (amt < 0.005) { if (o === 'player' && why) msg('Research cap reached today (' + RP_DAY_CAP + ' per day).'); return 0; }
  amt = Math.round(amt * 100) / 100; R.today += amt; R.prog += amt; R.total += amt;
  let got = 0; while (R.prog >= 0.999) { R.prog = Math.max(0, R.prog - 1); R.pts++; got++; }
  R.log.unshift({d: G.day, why, amt}); R.log.length = Math.min(R.log.length, 8);
  if (o === 'player') { if (got) celebrate('xp', '+' + got + ' RESEARCH POINT' + (got > 1 ? 'S' : '') + '!', why + ' · press TECH'); else msg('+' + amt + ' research: ' + why); }
  else aiTech();
  return amt;
}
function techState(o, i, k) {
  const R = RS(o); if (R.picks[i] === k) return 'have'; if (R.picks[i]) return 'other';
  if (i > 0 && !R.picks[i - 1]) return 'locked';
  return R.pts >= TECH_COST[i] ? 'open' : 'poor';
}
function pickTech(o, k) {
  const f = facOf(o), R = RS(o); if (!f || !R) return false;
  const i = TECH[f].findIndex(lv => lv.some(t => t.k === k)); if (i < 0 || techState(o, i, k) !== 'open') return false;
  R.pts -= TECH_COST[i]; R.picks[i] = k; return true;
}
function aiTech() {
  const f = facOf('ai'), R = RS('ai'); if (!f || !R) return;
  for (let i = 0; i < 6; i++) { if (R.picks[i]) continue; if (R.pts < TECH_COST[i]) break; const lv = TECH[f][i]; pickTech('ai', (i === 5 ? lv[0] : lv[Math.floor(Math.random() * 3)]).k); }
}
// battle research: compares the armies before and after (works for real, auto and fled battles)
function battleResearch(ctx, attWon) {
  if (!ctx.snap) return;
  const sum = a => { const m = {}; a.forEach(s => m[s.type] = (m[s.type] || 0) + s.count); return m; };
  const dead = side => { const b = sum(ctx.snap[side]), a = sum(ctx[side].arrs.flat()); return Object.keys(b).map(t => ({type: t, n: Math.max(0, b[t] - (a[t] || 0))})).filter(x => x.n); };
  const D = {att: dead('att'), def: dead('def')}, all = ctx.snap.att.concat(ctx.snap.def);
  const big = all.length >= 8 || all.reduce((s, x) => s + x.count, 0) >= 80;
  for (const side of ['att', 'def']) {
    const o = ctx[side].owner; if (!RS(o)) continue;
    const f = facOf(o), foe = side === 'att' ? 'def' : 'att', won = (side === 'att') === attWon, stronger = ctx.pow[foe] > ctx.pow[side] * 1.1;
    const cap = v => Math.min(RP_BATTLE_CAP, v);
    if (f === 'castle' && won) { const raw = Math.min(3, 1 + (D[side].length ? 0 : 1) + (stronger ? 1 : 0) + (big ? 1 : 0)); addRP(o, cap(raw * 0.35), 'Victory x' + raw + (D[side].length ? '' : ' flawless') + (stronger ? ' vs stronger' : '') + (big ? ' big battle' : '')); }
    if (f === 'necro') { const hp = D.att.concat(D.def).reduce((s, x) => s + x.n * UNITS[x.type].hp, 0); if (hp) addRP(o, cap(hp / 1500), D.att.concat(D.def).reduce((s, x) => s + x.n, 0) + ' creatures died'); }
    if (f === 'sylvan' && won && !D[side].length) addRP(o, 0.4, 'Flawless victory');
    if (f === 'stronghold' && D[foe].length) { const v = D[foe].reduce((s, x) => s + x.n * UNITS[x.type].cost, 0) / 3000 * (won && stronger ? 1.5 : 1); addRP(o, cap(v), 'Trophies: ' + D[foe].reduce((s, x) => s + x.n, 0) + ' killed' + (won && stronger ? ' (underdog x1.5)' : '')); }
    if (won && pol(o, 'plunder')) { const g = Math.round(D[foe].reduce((s, x) => s + x.n * UNITS[x.type].cost, 0) * 0.1); if (g) { G.res[o].gold += g; if (o === 'player') msg('Plunder: +' + g + ' gold'); } }
  }
}
function dailyResearch(o) {
  const f = facOf(o); if (!RS(o)) return;
  RS(o).today = 0;
  if (f === 'sylvan') {
    const near = G.heroes.filter(h => h.owner === o && DIRS8.some(([dx, dy]) => inMap(h.x + dx, h.y + dy) && G.map[h.y + dy][h.x + dx] === 2)).length;
    const groves = G.objs.filter(x => x.kind === 'grove' && x.owner === o).length;
    const v = near * 0.15 + groves * 0.2 * (pol(o, 'sacredwood') ? 2 : 1); if (v) addRP(o, v, (near ? near + ' hero(es) by the forest' : '') + (near && groves ? ', ' : '') + (groves ? groves + ' Sacred Grove(s)' : ''));
  }
  if (f === 'dwarf') { const v = savings(o); if (v > 0) addRP(o, 0.11 * Math.sqrt(v / 1000), 'Savings ' + v + ' gold value'); }
}
const savings = o => { const r = G.res[o]; return Math.round(r.gold + 250 * (r.wood + r.ore) + 500 * r.gems); };
// Inferno: Sacrificial Pit. kind: 'gold' (2500), 'res' (5 wood+5 ore), 'xp' (1000 xp of the visiting hero), 'troop' (a whole stack: value/2500)
function sacValue(o, kind, t, i) {
  const m = (1 + techSum(o, 'sac') / 100) * (pol(o, 'pact') ? 1.5 : 1), h = t && heroAt(t.x, t.y);
  if (kind === 'gold') return G.res[o].gold >= 2500 ? 0.8 * m : 0;
  if (kind === 'res') return G.res[o].wood >= 5 && G.res[o].ore >= 5 ? 0.8 * m : 0;
  if (kind === 'xp') return h && h.owner === o && h.xp - (h.lvl > 1 ? xpForLevel(h.lvl - 1) : 0) >= 1000 ? 0.8 * m : 0;
  if (kind === 'troop') { const a = h && h.owner === o ? h.army : t.garrison, s = a && a[i]; return s && a.length > 1 ? Math.min(RP_BATTLE_CAP, s.count * UNITS[s.type].cost / 2500) * m : 0; }
  return 0;
}
function sacrifice(o, t, kind, i) {
  if (!t.built.includes('pit')) return 0; const v = sacValue(o, kind, t, i); if (!v) return 0;
  if (RS(o).today >= RP_DAY_CAP - 0.01) { if (o === 'player') msg('The Pit is sated today (research cap).'); return 0; }
  const h = heroAt(t.x, t.y);
  if (kind === 'gold') G.res[o].gold -= 2500; else if (kind === 'res') { G.res[o].wood -= 5; G.res[o].ore -= 5; } else if (kind === 'xp') h.xp -= 1000;
  else { const a = h && h.owner === o ? h.army : t.garrison; a.splice(i, 1); }
  return addRP(o, v, 'Sacrifice: ' + ({gold: '2500 gold', res: '5 wood + 5 ore', xp: '1000 hero XP', troop: 'a creature stack'})[kind]);
}

// ---------- map generation (point-symmetric so both sides are fair) ----------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function flood(T, sx, sy) {
  const seen = T.map(r => r.map(() => false)), st = [[sx, sy]]; seen[sy][sx] = true;
  while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && !seen[ny][nx] && TERRAIN[T[ny][nx]].cost) { seen[ny][nx] = true; st.push([nx, ny]); } } }
  return seen;
}
let PT = {x: 2, y: 2}, ET = {x: MW - 3, y: MH - 3};
function setDims(map) { MW = map[0].length; MH = map.length; PT = {x: 2, y: 2}; ET = {x: MW - 3, y: MH - 3}; }
const DIFF = () => DIFFICULTY[(G && G.cfg && G.cfg.diff) || 'normal'] || DIFFICULTY.normal;
function genTerrain(seed) {
  for (let tries = 0; tries < 60; tries++) {
    const R = mulberry(seed + tries * 7919);
    const T = Array.from({length: MH}, () => Array(MW).fill(0));
    for (let i = 0, nb = Math.round(26 * MW * MH / 432); i < nb; i++) {
      const t = [1, 1, 2, 2, 2, 3, 4][Math.floor(R() * 7)];
      let x = Math.floor(R() * MW), y = Math.floor(R() * MH);
      for (let k = 0, n = 3 + Math.floor(R() * 6); k < n; k++) { if (inMap(x, y)) T[y][x] = t; x += Math.floor(R() * 3) - 1; y += Math.floor(R() * 3) - 1; }
    }
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (y * MW + x >= MW * MH / 2) T[y][x] = T[MH - 1 - y][MW - 1 - x];
    for (const c of [PT, ET]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inMap(c.x + dx, c.y + dy)) T[c.y + dy][c.x + dx] = 0;
    const seen = flood(T, PT.x, PT.y);
    if (!seen[ET.y][ET.x]) continue;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (TERRAIN[T[y][x]].cost && !seen[y][x]) T[y][x] = 2;
    return {T, R};
  }
  return {T: Array.from({length: MH}, () => Array(MW).fill(0)), R: mulberry(seed)};
}
function newGame(opts = {}) {
  const rf = f => FACTIONS[f] ? f : FACTION_KEYS[Math.floor(Math.random() * FACTION_KEYS.length)], pf = rf(opts.pf), af = rf(opts.af);
  const cfg = {pf, af, size: MAP_SIZES[opts.size] ? opts.size : 'M', diff: DIFFICULTY[opts.diff] ? opts.diff : 'normal', seed: Number.isFinite(opts.seed) ? opts.seed : Math.floor(Math.random() * 1e6), tutorial: false};
  const SZ = MAP_SIZES[cfg.size], D = DIFFICULTY[cfg.diff];
  MW = SZ.w; MH = SZ.h; PT = {x: 2, y: 2}; ET = {x: MW - 3, y: MH - 3};
  const {T, R} = genTerrain(cfg.seed);
  const rnd = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
  G = {v: 6, cfg, tut: null, rs: {player: mkRS(), ai: mkRS()}, day: 1, map: T, fog: T.map(r => r.map(() => 0)), objs: [], heroes: [], towns: [], sel: null, nid: 1, over: null,
    res: {player: {...D.player}, ai: {...D.ai}}};
  const k = MW / 24, sc = v => Math.max(2, Math.round(v * k)), rep = Math.max(1, Math.round(MW * MH / 480));
  const id = () => G.nid++;
  const mkTown = (c, owner, faction, name) => ({id: id(), x: c.x, y: c.y, owner, faction, name, built: ['dw1', 'dw2'], avail: {}, garrison: [], builtToday: false});
  G.towns.push(mkTown(PT, 'player', pf, FACTIONS[pf].town), mkTown(ET, 'ai', af, pf === af ? 'New ' + FACTIONS[af].town : FACTIONS[af].town));
  G.towns.forEach(t => FACTIONS[t.faction].units.slice(0, 2).forEach(u => t.avail[u] = UNITS[u].growth));
  const used = new Set();
  const dP = (x, y) => Math.max(Math.abs(x - PT.x), Math.abs(y - PT.y)), dE = (x, y) => Math.max(Math.abs(x - ET.x), Math.abs(y - ET.y));
  const free = (x, y) => inMap(x, y) && TERRAIN[T[y][x]].cost && dP(x, y) > 2 && dE(x, y) > 2 &&
    !DIRS8.concat([[0, 0]]).some(([dx, dy]) => used.has((x + dx) + ',' + (y + dy)));
  const put = o => { o.id = id(); used.add(o.x + ',' + o.y); G.objs.push(o); return o; };
  function pair(lo, hi, make, guard) {
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(R() * MW), y = Math.floor(R() * MH), mx = MW - 1 - x, my = MH - 1 - y;
      const d = dP(x, y);
      if (d < lo || d > hi || dP(x, y) > dE(x, y) || !free(x, y) || !free(mx, my) || (x === mx && y === my)) continue;
      const a = put(Object.assign({x, y}, make())), b = put(Object.assign({x: mx, y: my}, make()));
      if (guard) for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy, ox = mx - dx, oy = my - dy;
        if (inMap(nx, ny) && inMap(ox, oy) && TERRAIN[T[ny][nx]].cost && TERRAIN[T[oy][ox]].cost && !objAt(nx, ny) && !objAt(ox, oy) && dP(nx, ny) > 3 && dE(ox, oy) > 3) {
          const g = guard();
          put({x: nx, y: ny, kind: 'monster', army: [{...g}]}); put({x: ox, y: oy, kind: 'monster', army: [{...g}]});
          break;
        }
      }
      return [a, b];
    }
    return [];
  }
  const resPick = () => { const r = pick(['gold', 'wood', 'ore', 'wood', 'ore']); return {kind: 'res', res: r, amt: r === 'gold' ? rnd(5, 10) * 100 : rnd(4, 8)}; };
  const arts = Object.keys(ARTIFACTS).sort(() => R() - 0.5);
  for (let r = 0; r < rep; r++) {
  pair(3, sc(6), () => ({kind: 'mine', mine: 'wood', owner: null}));
  pair(3, sc(6), () => ({kind: 'mine', mine: 'ore', owner: null}));
  for (let i = 0; i < 3; i++) pair(3, sc(8), resPick);
  pair(3, sc(7), () => ({kind: 'chest'}));
  pair(7, sc(13), () => ({kind: 'mine', mine: 'gold', owner: null}), () => ({type: 'Wolf', count: rnd(10, 16)}));
  pair(7, sc(13), () => ({kind: 'mine', mine: 'gems', owner: null}), () => ({type: 'Goblin', count: rnd(18, 26)}));
  pair(6, sc(12), () => ({kind: 'chest'}), () => ({type: 'Goblin', count: rnd(8, 12)}));
  pair(6, sc(14), () => ({kind: 'res', res: 'gems', amt: rnd(3, 5)}));
  pair(4, sc(10), () => ({kind: 'grove', owner: null}), r % 2 ? () => ({type: 'Wolf', count: rnd(6, 10)}) : null);
  pair(8, sc(15), () => ({kind: 'art', art: arts[(r * 2) % arts.length]}), () => ({type: 'Troll', count: rnd(3, 5)}));
  pair(8, sc(15), () => ({kind: 'art', art: arts[(r * 2 + 1) % arts.length]}), () => ({type: 'Wolf', count: rnd(18, 24)}));
  pair(5, sc(12), resPick, () => ({type: 'Goblin', count: rnd(6, 10)}));
  }
  for (let i = 0, n = Math.round(MW * MH / 200); i < n; i++) pair(3, sc(14), i % 3 ? resPick : () => ({kind: 'chest'}), i % 2 ? () => ({type: pick(['Goblin', 'Wolf']), count: rnd(5, 12)}) : null);
  const startArmy = (f, k) => FACTIONS[f].units.slice(0, 2).map((u, i) => ({type: u, count: Math.max(1, Math.round((i ? 1000 : 1500) / UNITS[u].cost * k))}));
  G.heroes.push(mkHero('player', FACTIONS[pf].heroes[0], PT.x, PT.y, startArmy(pf, 1)));
  G.heroes.push(mkHero('ai', FACTIONS[af].heroes[pf === af ? 1 : 0], ET.x, ET.y, startArmy(af, 0.5 * D.aiArmy)));
  G.sel = G.heroes[0].id;
  revealAll();
}
function newTutorial() {
  const T = TUTORIAL_MAP.map(r => [...r].map(c => ({'.': 0, ',': 1, 'T': 2, '^': 3, '~': 4})[c]));
  setDims(T); ET = {x: 13, y: 9};
  G = {v: 6, cfg: {pf: 'castle', af: 'necro', size: 'T', diff: 'easy', seed: 0, tutorial: true}, tut: {step: 0}, rs: {player: mkRS(), ai: mkRS()}, day: 1, map: T, fog: T.map(r => r.map(() => 0)), objs: [], heroes: [], towns: [], sel: null, nid: 1, over: null,
    res: {player: {gold: 6000, wood: 15, ore: 15, gems: 4}, ai: {gold: 0, wood: 0, ore: 0, gems: 0}}};
  const id = () => G.nid++;
  G.towns.push({id: id(), x: PT.x, y: PT.y, owner: 'player', faction: 'castle', name: 'Castlegate', built: ['dw1', 'dw2'], avail: {Peasant: 14, Pikeman: 9}, garrison: [], builtToday: false});
  G.towns.push({id: id(), x: ET.x, y: ET.y, owner: 'ai', faction: 'necro', name: 'Bonehold', built: ['dw1', 'dw2', 'fort'], avail: {}, garrison: [{type: 'Skeleton', count: 12}], builtToday: false});
  for (const o of [{x: 5, y: 2, kind: 'res', res: 'gold', amt: 500}, {x: 4, y: 4, kind: 'mine', mine: 'wood', owner: null}, {x: 7, y: 2, kind: 'monster', army: [{type: 'Goblin', count: 6}]}, {x: 8, y: 1, kind: 'chest'}]) G.objs.push(Object.assign(o, {id: id()}));
  const h = mkHero('player', HERO_NAMES[0], PT.x, PT.y, [{type: 'Peasant', count: 20}, {type: 'Pikeman', count: 8}]);
  h.spells = ['arrow']; h.mana = 20; G.heroes.push(h); G.sel = h.id;
  revealAll();
}
function mkHero(owner, name, x, y, army) {
  return Object.assign(mkHero0(owner, name, x, y, army), {tal: {}, tp: 0});
}
function mkHero0(owner, name, x, y, army) {
  return {id: G.nid++, owner, fac: (G.towns.find(t => t.owner === owner) || {}).faction || (KG(owner) || {}).faction || 'castle', name, x, y, lvl: 1, xp: 0, att: 1, def: 1, sp: 1, kn: 1, mp: BASE_MP, mana: 10, spells: [], arts: [], army, sk: {...(START_SKILLS[name] || {})}};
}

// ---------- fog ----------
function reveal(x, y, r) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy) && dx * dx + dy * dy <= r * r + 1) G.fog[y + dy][x + dx] = 1; }
function revealAll() {
  myHeroes().forEach(h => reveal(h.x, h.y, sight(h)));
  G.towns.filter(t => t.owner === 'player').forEach(t => reveal(t.x, t.y, 5));
  G.objs.filter(o => (o.kind === 'mine' || o.kind === 'grove') && o.owner === 'player').forEach(o => reveal(o.x, o.y, 2));
}

// ---------- pathfinding (Dijkstra, 8 directions; objects/guarded tiles end a path) ----------
function guardOf(x, y) { return G.objs.find(o => o.kind === 'monster' && Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1); }
function stepCost(x, y, dx, dy, h) { let c = TERRAIN[G.map[y][x]].cost; if (h && c > 2) c = Math.max(2, c - skl(h, 'pathfinding') * 0.34); return Math.round(dx && dy ? c * 1.5 : c); }
function enterable(x, y, h, avoid) {
  if (!TERRAIN[G.map[y][x]].cost) return false;
  const o = objAt(x, y); if (o && o.kind === 'monster') return false;
  const oh = heroAt(x, y); if (oh && oh !== h && oh.owner === h.owner) return false;
  const t = townAt(x, y); if (t && t.owner === h.owner && oh && oh !== h) return false;
  if (avoid) { const g = guardOf(x, y); if (g && avoid(g)) return false; }
  return true;
}
const isTerminal = (x, y) => !!(objAt(x, y) || townAt(x, y) || heroAt(x, y) || guardOf(x, y));
function dijkstra(h, avoid) {
  const N = MW * MH, dist = new Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), s = h.y * MW + h.x;
  dist[s] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    const ux = u % MW, uy = (u / MW) | 0;
    if (u !== s && isTerminal(ux, uy)) continue;
    for (const [dx, dy] of DIRS8) {
      const nx = ux + dx, ny = uy + dy;
      if (!inMap(nx, ny) || !enterable(nx, ny, h, avoid)) continue;
      const v = ny * MW + nx, d = best + stepCost(nx, ny, dx, dy, h);
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  return {dist, prev};
}
function pathTo(dj, x, y) {
  let v = y * MW + x; if (dj.dist[v] === Infinity) return null;
  const p = []; while (dj.prev[v] >= 0) { p.unshift([v % MW, (v / MW) | 0]); v = dj.prev[v]; }
  return p;
}
function bestAdjacent(dj, o) {
  let best = null;
  for (const [dx, dy] of DIRS8) { const x = o.x + dx, y = o.y + dy; if (inMap(x, y) && dj.dist[y * MW + x] < (best ? dj.dist[best[1] * MW + best[0]] : Infinity)) best = [x, y]; }
  return best;
}

// ---------- map interaction ----------
function tapMap(tx, ty) {
  const h = curHero(); if (!h) { msg('No hero. Hire one at a Tavern.'); return; }
  const oh = heroAt(tx, ty);
  if (oh && oh.owner === 'player') {
    if (oh !== h) { G.sel = oh.id; UI.preview = null; msg(oh.name + ' selected'); SFX.click(); }
    else if (townAt(tx, ty)) openTown(townAt(tx, ty)); else openHero();
    return;
  }
  if (UI.preview && UI.preview.tx === tx && UI.preview.ty === ty) { startWalk(h, UI.preview.path); UI.preview = null; return; }
  if (!G.fog[ty][tx]) { msg('Unexplored land'); return; }
  const dj = dijkstra(h), o = objAt(tx, ty);
  let path = null;
  if (o && o.kind === 'monster') { const a = bestAdjacent(dj, o); path = a && pathTo(dj, a[0], a[1]); }
  else path = pathTo(dj, tx, ty);
  describeTile(tx, ty); if (UI.lastTap) showTip(tx, ty, UI.lastTap[0], UI.lastTap[1]);
  if (!path || !path.length) { SFX.bad(); UI.preview = null; return; }
  UI.preview = {tx, ty, path, cost: path.map(([x, y]) => dj.dist[y * MW + x])};
  const total = UI.preview.cost[UI.preview.cost.length - 1];
  $('msg').textContent += ' · ' + (total <= h.mp ? 'Tap again to go' : 'Needs ' + Math.ceil(total / maxMp(h)) + ' days');
}
function describeTile(x, y) {
  const o = objAt(x, y), t = townAt(x, y), h = heroAt(x, y);
  let s = TERRAIN[G.map[y][x]].name;
  if (t) s = t.name + ' (' + (t.owner === 'player' ? 'yours' : 'enemy') + ')';
  else if (h) s = 'Enemy hero ' + h.name + ': ' + bandArmy(h.army);
  else if (o) s = o.kind === 'monster' ? sizeWord(o.army[0].count) + ' ' + o.army[0].type + 's'
    : o.kind === 'mine' ? MINES[o.mine].name + ' (+' + MINES[o.mine].amt + ' ' + MINES[o.mine].res + '/day)' + (o.owner ? ' - ' + o.owner : '')
    : o.kind === 'grove' ? 'Sacred Grove' + (o.owner ? ' - ' + o.owner : '') : o.kind === 'res' ? o.amt + ' ' + o.res : o.kind === 'chest' ? 'Treasure chest' : 'Artifact: ' + ARTIFACTS[o.art].name;
  else if (guardOf(x, y)) s += ' (guarded)';
  msg(s);
}
function startWalk(h, path) { UI.walk = {id: h.id, path: path.slice(), t: 0}; }
function walkStep() {
  const w = UI.walk, h = heroById(w.id);
  if (!h || !w.path.length) { UI.walk = null; return; }
  const [nx, ny] = w.path[0], c = stepCost(nx, ny, nx - h.x, ny - h.y, h);
  if (h.mp < c) { msg(h.name + ' is out of movement. END DAY to continue.'); UI.walk = null; return; }
  h.mp -= c; h.x = nx; h.y = ny; w.path.shift(); SFX.step();
  reveal(h.x, h.y, sight(h));
  if (arrive(h) || !w.path.length) UI.walk = null;
}
// Called whenever any hero steps on a tile. Returns true if movement must stop.
function arrive(h) {
  const x = h.x, y = h.y, t = townAt(x, y), o = objAt(x, y), g = guardOf(x, y);
  const eh = G.heroes.find(e => e !== h && e.x === x && e.y === y && e.owner !== h.owner);
  if (t && t.owner !== h.owner) { fight(h, {town: t}, null); return true; }
  if (eh) { fight(h, {hero: eh}, () => arrive(h)); return true; }
  if (g) { fight(h, {monster: g}, () => arrive(h)); return true; }
  if (t) { visitTown(h, t); if (h.owner === 'player') openTown(t); return true; }
  if (o) { take(h, o); return true; }
  return false;
}
function take(h, o) {
  const me = h.owner === 'player', drop = () => G.objs.splice(G.objs.indexOf(o), 1);
  if (o.kind === 'res') { G.res[h.owner][o.res] += o.amt; drop(); if (me) { msg('Found ' + o.amt + ' ' + o.res); celebrate(o.res, '+' + o.amt + ' ' + o.res.toUpperCase() + '!', 'Picked up'); } }
  else if (o.kind === 'art') { h.arts.push(o.art); drop(); if (me) { msg(h.name + ' found ' + ARTIFACTS[o.art].name + '!'); celebrate('art', ARTIFACTS[o.art].name.toUpperCase() + '!', '+' + ARTIFACTS[o.art].val + ' ' + ARTIFACTS[o.art].stat); } }
  else if (o.kind === 'chest') {
    drop();
    if (me) { SFX.pick(); showPanel(() => `<h2>TREASURE CHEST</h2><p>Keep the gold or give it away for experience?</p>
      <div class="bar"><button class="btn y" data-a="chest" data-v="gold">1000 GOLD</button><button class="btn alt" data-a="chest" data-v="xp">750 XP</button></div>`, {chestHero: h.id, sticky: true}); }
    else if (h.lvl < 4) gainXp(h, 750); else G.res.ai.gold += 1000;
  } else if (o.kind === 'grove' && o.owner !== h.owner) {
    o.owner = h.owner;
    if (me) celebrate('wood', 'SACRED GROVE CLAIMED!', facOf('player') === 'sylvan' ? '+research every day' : 'Sylvan research site (denied to the enemy)');
  } else if (o.kind === 'mine' && o.owner !== h.owner) {
    const prev = o.owner; o.owner = h.owner;
    if (prev && prev !== h.owner && facOf(h.owner) === 'inferno') addRP(h.owner, 0.5, 'Razed an enemy ' + MINES[o.mine].name);
    if (me) { msg(MINES[o.mine].name + ' captured!'); celebrate(MINES[o.mine].res, MINES[o.mine].name.toUpperCase() + ' CAPTURED!', '+' + MINES[o.mine].amt + ' ' + MINES[o.mine].res + '/day'); reveal(o.x, o.y, 2); } else if (G.fog[o.y][o.x]) msg('Enemy captured a ' + MINES[o.mine].name + '!');
  }
}
function visitTown(h, t) {
  const levels = t.built.includes('guild2') ? 2 : t.built.includes('guild1') ? 1 : 0;
  if (levels) {
    const learnt = Object.keys(SPELLS).filter(k => SPELLS[k].lvl <= levels && !h.spells.includes(k));
    h.spells.push(...learnt); h.mana = maxMana(h);
    if (learnt.length && h.owner === 'player') msg(h.name + ' learned ' + learnt.map(k => SPELLS[k].name).join(', '));
  }
  if (h.owner === 'ai') aiVisit(h, t);
}
function gainXp(h, n) {
  h.xp += Math.round(n);
  while (h.xp >= xpForLevel(h.lvl)) {
    h.lvl++;
    h.tp = (h.tp || 0) + 1; h.tal = h.tal || {};
    if (h.owner === 'player') UI.levelQ.push(h.id);
    else { aiLearnTalent(h); h[pick(['att', 'def', 'att', 'sp', 'kn'])]++; const o = skillOffers(h)[0]; if (o) h.sk[o] = (h.sk[o] || 0) + 1; }
  }
}
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
function skillOffers(h) { // one upgrade + one new skill when possible (Heroes 3 style)
  const have = Object.keys(h.sk), up = shuffle(have.filter(k => h.sk[k] < 3)), fresh = have.length < MAX_SKILLS ? shuffle(Object.keys(SKILLS).filter(k => !h.sk[k])) : [];
  return [...new Set([...up.slice(0, 1), ...fresh, ...up])].slice(0, 2);
}
const STAT_NAMES = {att: 'ATTACK', def: 'DEFENSE', sp: 'SPELL POWER', kn: 'KNOWLEDGE'};
function nextLevelUp() {
  if (!UI.levelQ.length || UI.panel) return;
  const h = heroById(UI.levelQ.shift()); if (!h) return nextLevelUp();
  const prim = shuffle(['att', 'def', 'sp', 'kn']).slice(0, 2), sec = skillOffers(h), pickd = {p: null, s: sec.length ? null : '-'};
  SFX.lvl();
  showPanel(() => `<div class="hcard"><img src="${portraitImg(h)}" alt=""><h2>LEVEL UP! ${h.name} is now level ${h.lvl}</h2></div><p class="y">+1 TALENT POINT (spend it in HERO &gt; TACTICS TALENTS)</p>
    <h3>1. PRIMARY SKILL</h3><div class="bar">${prim.map(s => btn('+1 ' + STAT_NAMES[s], 'lvlp', s, pickd.p === s ? 'y' : 'alt')).join('')}</div>
    ${sec.length ? `<h3>2. SECONDARY SKILL</h3>` + sec.map(k => { const n = (h.sk[k] || 0) + 1; return `<div class="it"><div class="t">${SKILL_LVL[n]} ${SKILLS[k].name}<small>${SKILLS[k].desc(SKILLS[k].v[n])}</small></div>${btn(pickd.s === k ? 'CHOSEN' : 'PICK', 'lvls', k, pickd.s === k ? 'y' : 'alt')}</div>`; }).join('') : '<p>All skill slots are at Expert.</p>'}
    <div class="bar" style="margin-top:8px">${btn('CONFIRM', 'lvlok', '', 'g', !pickd.p || !pickd.s)}</div>`, {lvlHero: h.id, sticky: true, pick: pickd});
}

// ---------- day / week ----------
function income(owner) {
  let inc = {gold: 0, wood: 0, ore: 0, gems: 0};
  G.towns.filter(t => t.owner === owner).forEach(t => inc.gold += BASE_INCOME + (t.built.includes('hall') ? 500 : 0) + (t.built.includes('capitol') ? 500 : 0));
  G.heroes.filter(h => h.owner === owner).forEach(h => inc.gold += skl(h, 'estates'));
  const mineK = 1 + (facOf(owner) === 'dwarf' ? 0.25 : 0) + techSum(owner, 'mine') / 100;
  G.objs.filter(o => o.kind === 'mine' && o.owner === owner).forEach(o => inc[MINES[o.mine].res] += Math.floor(MINES[o.mine].amt * mineK));
  for (const i of techFx(owner, 'inc')) RES.forEach(r => inc[r] += i[r] || 0);
  G.heroes.filter(h => h.owner === owner && heroSpec(h) === 'banker').forEach(() => inc.gold += 250);
  if (pol(owner, 'sacredwood')) inc.wood += 3;
  if (pol(owner, 'guildhall')) { inc.ore += 2; inc.gems += 1; }
  if (pol(owner, 'lumber')) { inc.wood += 2; inc.ore += 2; }
  if (pol(owner, 'trade')) { inc.gems += 1; inc.gold += 250; }
  if (ktal(owner, 'mint')) inc.gold += 250;
  inc.gold = Math.round(inc.gold * (1 + (pol(owner, 'tax') ? 0.1 : 0) + (ktal(owner, 'bookkeeping') ? 0.05 : 0)));
  if (owner === 'ai') inc.gold = Math.round(inc.gold * DIFF().aiIncome);
  return inc;
}
function endDay() {
  if (UI.mode !== 'map' || UI.panel) return;
  UI.walk = null; UI.preview = null; UI.mode = 'aiturn';
  msg('Enemy turn...');
  G.towns.filter(t => t.owner === 'ai').forEach(aiTownTurn);
  UI.ai = {queue: G.heroes.filter(h => h.owner === 'ai').map(h => h.id), path: null, tries: 0, t: 0};
}
function newDay() {
  G.day++;
  for (const owner of ['player', 'ai']) dailyResearch(owner); // savings counted on what was banked at day end
  for (const owner of ['player', 'ai']) { const inc = income(owner); RES.forEach(r => G.res[owner][r] += inc[r]); }
  G.towns.forEach(t => t.builtToday = false);
  G.heroes.forEach(h => { h.mp = maxMp(h); h.mana = Math.min(maxMana(h), h.mana + 2 + (pol(h.owner, 'ley') ? 3 : 0)); });
  let note = 'Day ' + G.day + ' (' + calText(G.day) + ')';
  if ((G.day - 1) % 7 === 0) {
    G.towns.forEach(t => FACTIONS[t.faction].units.forEach((u, i) => {
      if (t.built.includes('dw' + (i + 1))) t.avail[u] = (t.avail[u] || 0) + growthOf(t, u);
    }));
    G.objs.filter(o => o.kind === 'monster').forEach(o => o.army[0].count = Math.ceil(o.army[0].count * 1.1));
    for (const o of ['player', 'ai']) if (KG(o)) { KG(o).kp += weeklyKP(o); KG(o).slots = KG(o).slots.slice(0, slotCount(o)); }
    aiKingdom();
    note = 'A new week begins! Creatures have grown, +' + weeklyKP('player') + ' Kingdom Point. Policies can be swapped today. ' + note;
    SFX.lvl();
  }
  revealAll();
  UI.mode = 'map';
  try { localStorage.setItem(SAVE_KEY + '-auto', JSON.stringify(G)); } catch (e) {}
  msg(note);
}

// ---------- town actions ----------
function canBuild(t, k) {
  const b = BUILDINGS[k];
  if (t.built.includes(k)) return 'Built';
  if (t.builtToday) return 'Already built today';
  const miss = b.req.filter(r => !t.built.includes(r));
  if (miss.length) return 'Needs ' + miss.map(r => BUILDINGS[r].name).join(', ');
  if (b.faction && b.faction !== t.faction) return FACTIONS[b.faction].name + ' only';
  if (!canPay(t.owner, bCost(t.owner, k))) return 'Not enough resources';
  return '';
}
function build(t, k) {
  if (canBuild(t, k)) return false;
  pay(t.owner, bCost(t.owner, k)); t.built.push(k); t.builtToday = true;
  if (t.owner === 'player' && G.tut) G.tut.built = true;
  const b = BUILDINGS[k];
  if (b.tier !== undefined) { const u = FACTIONS[t.faction].units[b.tier]; t.avail[u] = (t.avail[u] || 0) + UNITS[u].growth; }
  const h = heroAt(t.x, t.y); if (h && h.owner === t.owner) visitTown(h, t);
  return true;
}
const bCost = (o, k) => { const c = {...BUILDINGS[k].cost}; c.gold = Math.round((c.gold || 0) * (1 - techSum(o, 'bcost') / 100)); return c; };
function growthOf(t, u) {
  const U = UNITS[u], gs = techFx(t.owner, 'growth').filter(g => !g.tiers || g.tiers.includes(U.tier));
  const add = gs.reduce((s, g) => s + (g.add || 0), 0), pct = gs.reduce((s, g) => s + (g.pct || 0), 0);
  return Math.floor((U.growth * (t.built.includes('citadel') ? 1.5 : 1) + (pol(t.owner, 'conscript') ? 1 : 0) + add) * (1 + (ktal(t.owner, 'barracks') ? 0.1 : 0) + pct / 100));
}
function unitCost(o, u) {
  const U = UNITS[u], tc = techFx(o, 'tcost').filter(x => x.tiers.includes(U.tier)).reduce((s, x) => s + x.pct, 0);
  return Math.round(U.cost * (1 - (pol(o, 'warchest') ? 0.1 : 0) - (pol(o, 'warband') ? 0.15 : 0) - techSum(o, 'cost') / 100 - tc / 100));
}
const poolOf = u => UNITS[u].base || u; // upgraded creatures recruit from the base dwelling's stock
const canRecruitUp = (t, u) => !UNITS[u].up || t.built.includes('up' + (UNITS[u].tier + 1));
function upgradeCost(o, s) { const U = UNITS[s.type]; return U && !U.up && U.upName ? Math.max(0, (unitCost(o, U.upName) - unitCost(o, s.type)) * s.count) : 0; }
function upgradeStack(t, army, i) {
  const s = army[i], U = s && UNITS[s.type]; if (!U || U.up || !U.upName || U.fac !== t.faction || !t.built.includes('up' + (U.tier + 1))) return false;
  const c = upgradeCost(t.owner, s); if (G.res[t.owner].gold < c) return false;
  G.res[t.owner].gold -= c; const ex = army.find(a => a.type === U.upName);
  if (ex) { ex.count += s.count; army.splice(i, 1); } else s.type = U.upName; return true;
}
function recruitTarget(t) { const h = heroAt(t.x, t.y); return h && h.owner === t.owner ? h.army : t.garrison; }
function recruit(t, u, n) {
  if (!UNITS[u] || !canRecruitUp(t, u)) return 0;
  const P = poolOf(u);
  n = Math.min(n, t.avail[P] || 0, Math.floor(G.res[t.owner].gold / unitCost(t.owner, u)));
  if (n <= 0) return 0;
  if (!addUnits(recruitTarget(t), u, n)) return 0;
  t.avail[P] -= n; G.res[t.owner].gold -= n * unitCost(t.owner, u);
  if (t.owner === 'player' && G.tut) G.tut.recruited = true;
  return n;
}
function hire(t) {
  if (!t.built.includes('tavern') || heroAt(t.x, t.y) || G.res[t.owner].gold < HIRE_COST) return null;
  const names = [...FACTIONS[t.faction].heroes, ...ALL_HERO_NAMES], used = G.heroes.map(h => h.name), u0 = FACTIONS[t.faction].units[0], n0 = Math.max(5, Math.round(750 / UNITS[u0].cost));
  const fi = (G.fled || []).findIndex(f => f.owner === t.owner);
  const h = fi >= 0 ? Object.assign(G.fled.splice(fi, 1)[0], {x: t.x, y: t.y, id: G.nid++, army: [{type: u0, count: n0}]}) : mkHero(t.owner, names.find(n => !used.includes(n)) || 'Hero', t.x, t.y, [{type: u0, count: n0}]);
  h.fac = h.fac || t.faction;
  h.mp = maxMp(h);
  if (pol(t.owner, 'muster')) { const us = FACTIONS[t.faction].units; addUnits(h.army, us[0], 10); addUnits(h.army, us[1], 4); }
  if (ktal(t.owner, 'veterans')) h.att++;
  G.res[t.owner].gold -= HIRE_COST; G.heroes.push(h); visitTown(h, t);
  return h;
}

// ---------- battles on the map ----------
function sideOf(owner, hero, arrs, extra) { return Object.assign({owner, hero, arrs: arrs.filter(Boolean)}, extra || {}); }
function fight(h, target, after) {
  const att = sideOf(h.owner, h, [h.army]);
  let def;
  if (target.monster) def = sideOf('neutral', null, [target.monster.army], {monster: target.monster});
  else if (target.hero) def = sideOf(target.hero.owner, target.hero, [target.hero.army]);
  else { const t = target.town, th = G.heroes.find(e => e.x === t.x && e.y === t.y && e.owner === t.owner); def = sideOf(t.owner, th || null, [th && th.army, t.garrison], {town: t}); }
  const ctx = {att, def, after};
  ctx.snap = {att: att.arrs.flat().map(s => ({...s})), def: def.arrs.flat().map(s => ({...s}))}; ctx.pow = {att: armyPower(att.arrs.flat(), att.hero), def: armyPower(def.arrs.flat(), def.hero)};
  if (!def.arrs.some(a => a.length)) { finishFight(ctx, true, 0, 0); return; }
  if (att.owner !== 'player' && def.owner !== 'player') { autoBattle(ctx); return; }
  startBattle(ctx);
}
function autoBattle(ctx) {
  const all = s => s.arrs.flat(), tb = h => h ? 1.1 + 0.04 * Object.keys(h.tal || {}).length : 1, pa = armyPower(all(ctx.att), ctx.att.hero) * tb(ctx.att.hero), pd = armyPower(all(ctx.def), ctx.def.hero) * tb(ctx.def.hero);
  const attWon = pa >= pd * (0.85 + Math.random() * 0.3), [w, l] = attWon ? [ctx.att, ctx.def] : [ctx.def, ctx.att];
  const frac = Math.min(0.9, (attWon ? pd / pa : pa / pd) * 0.6), hp = a => a.reduce((s, x) => s + x.count * US(x).hp, 0);
  const lostHp = hp(all(l));
  w.arrs.forEach(a => { a.forEach(s => s.count = Math.ceil(s.count * (1 - frac))); a.splice(0, a.length, ...a.filter(s => s.count > 0)); });
  l.arrs.forEach(a => a.length = 0);
  finishFight(ctx, attWon, attWon ? lostHp : 0, attWon ? 0 : lostHp);
}
// xpA/xpD = enemy hit points killed by attacker/defender
function finishFight(ctx, attWon, xpA, xpD) {
  const {att, def} = ctx, [w, l] = attWon ? [att, def] : [def, att];
  const killedHp = attWon ? xpA : xpD;
  if (w.hero) gainXp(w.hero, killedHp * (pol(w.owner, 'drill') ? 1.25 : 1));
  battleResearch(ctx, attWon);
  const raisePct = (pol(w.owner, 'raisedead') ? 15 : 0) + techSum(w.owner, 'raise') + (heroSpec(w.hero) === 'necromancer' ? 8 : 0);
  if (w.hero && raisePct && killedHp > 0) { const n = Math.floor(killedHp * raisePct / 100 / UNITS.Skeleton.hp); if (n > 0 && addUnits(w.hero.army, 'Skeleton', n)) { G.lastRaised = n; if (w.owner === 'player') msg('Raise Dead: ' + n + ' Skeletons join ' + w.hero.name + '!'); } }
  if (l.hero) G.heroes.splice(G.heroes.indexOf(l.hero), 1);
  if (def.monster && attWon) G.objs.splice(G.objs.indexOf(def.monster), 1);
  if (def.town && attWon) {
    def.town.owner = att.owner; def.town.garrison = []; def.town.builtToday = true;
    if (facOf(att.owner) === 'inferno') addRP(att.owner, 1, 'Razed ' + def.town.name);
    msg((att.owner === 'player' ? 'You captured ' : 'The enemy captured ') + def.town.name + '!');
  }
  revealAll();
  if (checkEnd()) return;
  if (attWon && ctx.after && G.heroes.includes(att.hero)) ctx.after();
}
function checkEnd() {
  if (G.over) return true;
  const own = o => G.towns.some(t => t.owner === o), heroes = o => G.heroes.some(h => h.owner === o);
  let r = null;
  if (!own('ai')) r = 'win'; else if (!own('player') && !heroes('player')) r = 'lose';
  if (!r) return false;
  G.over = r; UI.mode = 'over'; UI.walk = null; UI.ai = null;
  localStorage.removeItem(SAVE_KEY + '-auto');
  r === 'win' ? SFX.win() : SFX.lose();
  showPanel(() => `<h2 style="color:${r === 'win' ? 'var(--green)' : 'var(--red)'}">${r === 'win' ? 'VICTORY!' : 'DEFEAT'}</h2>
    <p>${r === 'win' ? 'You captured the enemy town on day ' + G.day + '.' : 'You lost all your towns and heroes.'}</p>
    <div class="bar"><button class="btn g" data-a="new">NEW GAME</button></div>`, {sticky: true});
  return true;
}

// ---------- enemy AI ----------
function aiTownTurn(t) {
  if (G.cfg && G.cfg.tutorial) return;
  for (const k of AI_BUILD_ORDER) if (build(t, k)) break;
  if (t.built.includes('pit') && G.res.ai.gold > 7000 && RS('ai') && RS('ai').today < 0.5) sacrifice('ai', t, 'gold');
  const ai = G.heroes.filter(h => h.owner === 'ai');
  if (!ai.length || (ai.length < 2 && G.day > 10 && G.res.ai.gold > 6000)) hire(t);
  aiRecruit(t);
}
function aiRecruit(t) { FACTIONS[t.faction].units.slice().reverse().forEach(u => { const up = UNITS[u].upName; if (canRecruitUp(t, up)) recruit(t, up, 999); recruit(t, u, 999); }); }
function aiChoosePath(h) {
  const my = armyPower(h.army, h), avoid = g => armyPower(g.army) > my * 0.6, dj = dijkstra(h, avoid);
  const home = G.towns.find(t => t.owner === 'ai');
  let best = null, bestScore = 0;
  const consider = (x, y, val, adj) => {
    let tx = x, ty = y;
    if (adj) { const a = bestAdjacent(dj, {x, y}); if (!a) return; [tx, ty] = a; }
    const d = dj.dist[ty * MW + tx]; if (d === Infinity || d === 0) return;
    const s = val / (d + 6); if (s > bestScore) { bestScore = s; best = [tx, ty]; }
  };
  for (const o of G.objs) {
    if (o.kind === 'res') consider(o.x, o.y, o.res === 'gold' ? o.amt : o.amt * (o.res === 'gems' ? 250 : 120));
    else if (o.kind === 'chest') consider(o.x, o.y, 1000);
    else if (o.kind === 'art') consider(o.x, o.y, 1500);
    else if (o.kind === 'grove' && o.owner !== 'ai') consider(o.x, o.y, facOf('ai') === 'sylvan' ? 3000 : 800);
    else if (o.kind === 'mine' && o.owner !== 'ai') consider(o.x, o.y, o.mine === 'gold' ? 4000 : 2000);
    else if (o.kind === 'monster' && !avoid(o)) consider(o.x, o.y, 500, true);
  }
  const grace = G.day < DIFF().grace; // no attacks on the player early on (difficulty)
  for (const e of G.heroes) if (!grace && e.owner === 'player' && my > armyPower(e.army, e) * DIFF().attack) consider(e.x, e.y, 6000);
  for (const t of G.towns) if (!grace && t.owner === 'player') {
    const th = heroAt(t.x, t.y), dp = armyPower(t.garrison) + (th ? armyPower(th.army, th) : 0);
    if (my > dp * (t.built.includes('fort') ? 1.5 : 1.2) * DIFF().attack / 1.3) consider(t.x, t.y, 30000);
  }
  if (home && (home.x !== h.x || home.y !== h.y)) {
    const threat = G.heroes.some(e => e.owner === 'player' && Math.max(Math.abs(e.x - home.x), Math.abs(e.y - home.y)) < 7 && armyPower(e.army, e) > armyPower(home.garrison));
    const recruits = FACTIONS[home.faction].units.reduce((s, u) => s + (home.avail[u] || 0) * UNITS[u].cost, 0);
    consider(home.x, home.y, (threat ? 9000 : 0) + Math.min(recruits, G.res.ai.gold) * 0.8);
  }
  return best && pathTo(dj, best[0], best[1]);
}
function aiStep() {
  const A = UI.ai, h = heroById(A.queue[0]);
  const next = () => { A.queue.shift(); A.path = null; A.tries = 0; };
  if (!A.queue.length) { UI.ai = null; newDay(); return; }
  if (!h) { next(); return; }
  if (!A.path || !A.path.length) { if (A.tries++ > 3 || !(A.path = aiChoosePath(h))) { next(); return; } }
  const [nx, ny] = A.path[0], c = stepCost(nx, ny, nx - h.x, ny - h.y, h);
  if (h.mp < c) { next(); return; }
  h.mp -= c; h.x = nx; h.y = ny; A.path.shift();
  if (G.fog[ny][nx]) SFX.step();
  if (arrive(h)) A.path = null;
}
function aiVisit(h, t) {
  aiRecruit(t);
  const danger = G.heroes.some(e => e.owner === 'player' && Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) < 10);
  if (!danger) { t.garrison.forEach(s => addUnits(h.army, s.type, s.count)); t.garrison = t.garrison.filter(s => !h.army.some(a => a.type === s.type)); }
}

// ---------- tactical battle: PLAN phase then simultaneous RESOLVE phase ----------
function startBattle(ctx) {
  const L = ctx.def.owner === 'player' ? 'def' : 'att';
  B = {ctx, sides: {L: L === 'att' ? ctx.att : ctx.def, R: L === 'att' ? ctx.def : ctx.att}, attSide: L === 'att' ? 'L' : 'R',
    round: 1, phase: 'pre', terr: {}, noPlan: null, units: [], seed: rnd(1, 1e6), clock: 0, ev: [], proj: [], eff: [], obst: new Set(), plans: {}, spell: {L: null, R: null}, sel: null, spellPick: null, log: ''};
  B.fort = ctx.def.town && ctx.def.town.built.includes('fort') ? (L === 'def' ? 'L' : 'R') : null;
  const rows = [3, 1, 5, 0, 6, 2, 4];
  for (const side of ['L', 'R']) {
    let i = 0;
    B.sides[side].arrs.forEach((arr, src) => arr.forEach(s => {
      if (i >= MAX_STACKS || s.count <= 0) return;
      const ranged = UNITS[s.type].range > 0, x = side === 'L' ? (ranged ? 0 : 1) : (ranged ? BW - 1 : BW - 2), y = rows[i++];
      B.units.push({S: effStats(B.sides[side].owner, s.type), id: side + i, side, type: s.type, count: s.count, start: s.count, tot: s.count * effStats(B.sides[side].owner, s.type).hp, x, y, rx: x, ry: y, gx: x, gy: y, shown: s.count, ph: Math.random() * 2, atk: [], hit: [], deadAt: null, src, alive: true});
    }));
  }
  const town = ctx.def.town;
  if (town && town.built.includes('fort')) { // SIEGE: walls, gate, arrow towers vs catapult
    const def = L === 'def' ? 'L' : 'R', cit = town.built.includes('citadel') ? SIEGE.citadelBonus : 0;
    B.siege = {def, att: def === 'R' ? 'L' : 'R', x: def === 'R' ? 7 : 2, cat: {x: def === 'R' ? 0 : BW - 1, y: BH - 1}, target: null, cells: {},
      towers: cit ? [0, BH - 1] : [0], towerDmg: cit ? SIEGE.citadelTowerDmg : SIEGE.towerDmg, fire: [], shots: []};
    for (let y = 0; y < BH; y++) {
      const kind = y === 3 ? 'gate' : B.siege.towers.includes(y) ? 'tower' : 'wall', hp = (kind === 'gate' ? SIEGE.gateHp : SIEGE.wallHp) + cit;
      B.siege.cells[y] = {kind, hp, max: hp, shown: hp};
    }
    for (const u of B.units) while (wallBlocks(u.x, u.y, u.side) || B.units.some(o => o !== u && o.x === u.x && o.y === u.y)) { u.x += u.side === 'L' ? 1 : -1; u.rx = u.gx = u.x; }
  }
  for (let k = 0; k < 3; k++) { const x = rnd(3, 6), y = rnd(0, BH - 1); if (!uAt(x, y) && !(B.siege && Math.abs(x - B.siege.x) <= 1)) B.obst.add(x + ',' + y); }
  UI.ret = UI.mode === 'aiturn' ? 'aiturn' : 'map'; UI.mode = 'battle'; UI.walk = null; UI.preview = null; UI.preSel = null; UI.preTerr = null;
  B.tac = {L: {tactic: null, form: 'line', terrain: [], reveal: false, intel: 0}, R: {tactic: null, form: 'line', terrain: [], reveal: false, intel: 0}};
  B.tac.L.intel = intelOf('L'); B.tac.R.intel = intelOf('R');
  applyFormation('L', 'line'); setTactic('L', knownTactics(heroOf('L'))[0]); aiPre('R');
  msg((B.siege ? (B.siege.att === 'L' ? 'SIEGE! ' : 'SIEGE! Your walls defend you. ') : B.attSide === 'R' ? 'You are attacked! ' : 'Battle! ') + 'PRE-BATTLE: scout, formation, tactic and terrain, then FIGHT.');
  $('pre').dataset.sig = ''; syncBars(); SFX.hit(); B.sel = null;
}
const uAt = (x, y) => B.units.find(u => u.alive && u.x === x && u.y === y);
const uById = id => B.units.find(u => u.id === id);
const md = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const heroOf = side => B.sides[side].hero;
const moraleChance = side => { const o = B.sides[side].owner; return skl(heroOf(side), 'leadership') + (pol(o, 'crusade') ? 10 : 0) + techSum(o, 'morale') + (techCap(o, 'crusade') ? 50 : 0) + Math.min(20, 10 * B.units.filter(u => u.alive && u.side === side && hasAb(u, 'Holy')).length); };
const fearImm = u => hasAb(u, 'Undead') || hasAb(u, 'Machine') || techCap(B.sides[u.side].owner, 'crusade');
const ownerOfU = u => B.sides[u.side].owner;
const moveOf = u => u.slow ? 1 : Math.max(1, US(u).move + (u.haste ? 2 : 0) + (u.morale ? 1 : 0) + (tac(u.side, 'blitz') ? (hasTal(heroOf(u.side), 'grandblitz') ? 2 : 1) : 0) - (tac(otherSide(u.side), 'sabotage') ? 1 : 0));
function wallBlocks(x, y, side) {
  const S = B.siege; if (!S) return false;
  if (x === S.cat.x && y === S.cat.y) return true;
  if (x !== S.x) return false;
  const c = S.cells[y]; if (c.kind === 'tower') return true; if (c.hp <= 0) return false;
  return !(c.kind === 'gate' && side === S.def); // only defenders pass the gate
}
const free = (x, y, side) => x >= 0 && y >= 0 && x < BW && y < BH && !B.obst.has(x + ',' + y) && !uAt(x, y) && !wallBlocks(x, y, side);
const enemyNear = u => B.units.some(o => o.alive && o.side !== u.side && md(o, u) === 1);
const firstUnplanned = () => (B.units.find(u => u.alive && u.side === 'L' && !B.plans[u.id]) || {}).id || null;
function reach(u, mv) { // BFS: key -> {d, prev}
  const fly = hasAb(u, 'Fly');
  const m = new Map([[u.x + ',' + u.y, {d: 0, x: u.x, y: u.y, prev: null}]]), q = [m.get(u.x + ',' + u.y)];
  while (q.length) {
    const c = q.shift(); if (c.d >= mv) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy, k = x + ',' + y, d = c.d + (!fly && (terrAt(x, y) || {}).k === 'quagmire' ? 2 : 1);
      const pass = fly ? x >= 0 && y >= 0 && x < BW && y < BH && !(B.siege && x === B.siege.x && B.siege.cells[y].kind === 'tower') : free(x, y, u.side);
      if (d > mv || (m.has(k) && m.get(k).d <= d) || !pass) continue;
      const n = {d, x, y, prev: c}; m.set(k, n); q.push(n);
    }
  }
  if (fly) for (const [k, c] of m) if (c.d && !free(c.x, c.y, 'fly')) m.delete(k); // flyers pass over things but must land on a free tile
  return m;
}
function calcDmg(a, t, ranged) {
  const ua = US(a), ut = US(t), ha = heroOf(a.side), ht = heroOf(t.side);
  const oa = B.sides[a.side].owner, ot = B.sides[t.side].owner;
  const A = ua.att + (ha ? stat(ha, 'att') : 0) + (ktal(oa, 'warlord') ? 1 : 0) - (pol(ot, 'dread') ? 2 : 0) - techSum(ot, 'foeAtt') - (a.plague || 0) + (heroSpec(ha) === 'warchief' ? 1 : 0) + (pol(oa, 'hellforge') ? 1 : 0);
  let D = ut.def + (ht ? stat(ht, 'def') : 0) + (B.fort === t.side ? 3 : 0) - (t.shred || 0) + (heroSpec(ht) === 'bastion' ? 1 : 0) + (pol(ot, 'hellforge') ? 1 : 0) + (pol(ot, 'bulwark') ? 2 : 0);
  if (B.units.some(o => o.alive && o !== t && o.side === t.side && md(o, t) === 1 && hasAb(o, 'Rune'))) D += 3;
  if (tac(t.side, 'shieldwall')) { const sw = 3 + (hasTal(ht, 'bulwark') ? 2 : 0); if (hasTal(ht, 'phalanx')) D += sw + 5; else if (B.units.some(o => o.alive && o !== t && o.side === t.side && md(o, t) === 1)) D += sw; }
  if (tac(t.side, 'bloodlust')) D -= 2;
  if ((terrAt(t.x, t.y) || {}).k === 'raise') D += 3;
  if (pol(ot, 'divine')) D += 1;
  if (B.ctx.def.town && B.sides[t.side] === B.ctx.def) D += (pol(ot, 'fortify') ? 2 : 0) + (ktal(ot, 'garrisonlaw') ? 1 : 0);
  let d = a.count * (ua.dmg[0] + Math.random() * (ua.dmg[1] - ua.dmg[0]));
  d *= A >= D ? 1 + 0.05 * Math.min(60, A - D) : Math.max(0.3, 1 - 0.025 * (D - A));
  const tags = [];
  if (!ranged) {
    const dx = Math.sign(a.x - t.x), dy = Math.sign(a.y - t.y), back = uAt(t.x - dx, t.y - dy);
    if (back && back.side === a.side) { d *= 1.5; tags.push('FLANK'); }
  }
  if (hasAb(a, 'Swarm')) { const n = B.units.filter(o => o.alive && o !== a && o.side === a.side && md(o, t) === 1).length; d *= 1 + 0.15 * n; }
  if (hasAb(a, 'Cleave') && Math.random() < 0.25) { d *= 1.3; tags.push('CLEAVE'); }
  if (hasAb(a, 'Charge') && !hasAb(t, 'Brace')) d *= 1 + 0.1 * (a.moved || 0);
  if (hasAb(a, 'Brace') && hasAb(t, 'Fly')) d *= 1.2;
  if (hasAb(a, 'Rage')) d *= 1 + Math.min(0.4, 0.08 * (B.round - 1));
  if (!ranged && B.units.some(o => o.alive && o !== a && o.side === a.side && md(o, a) === 1 && hasAb(o, 'Bloodlust'))) d *= 1.15;
  if (ranged && hasAb(t, 'ShieldW')) d *= 0.7;
  if (ranged && pol(oa, 'huntlaw')) d *= 1.15;
  if (hasAb(t, 'Tough')) d *= 0.85;
  if (B.plans[t.id] && B.plans[t.id].t === 'def') d *= 0.7;
  d *= 1 + skl(ha, ranged ? 'archery' : 'offense') / 100;
  d *= 1 - skl(ht, 'armorer') / 100;
  if (a.morale) { d *= 1.2; tags.push('MORALE'); }
  if (tac(a.side, 'blitz')) d *= hasTal(ha, 'grandblitz') ? 1.25 : hasTal(ha, 'momentum') ? 1.2 : 1.1;
  if (tac(a.side, 'bloodlust') && !ranged) d *= 1.25;
  if (tac(a.side, 'volley') && ranged) d *= 1.3;
  if (tac(t.side, 'decoy') && ranged) d *= 0.75;
  if (tac(t.side, 'entrench') && !t.moved) d *= 0.8;
  if (ranged && md(a, t) > 1 && (terrAt(t.x, t.y) || {}).k === 'fog' && terrAt(t.x, t.y).side === t.side) { d *= 0.5; tags.push('FOG'); }
  if (a.hidden && tac(a.side, 'ambush')) { d *= 1.5; tags.unshift('AMBUSH'); }
  return {dmg: Math.max(1, Math.round(d)), tags};
}
function bestSpell(side) {
  const h = heroOf(side); if (!h) return null;
  const foes = B.units.filter(u => u.alive && u.side !== side), mine = B.units.filter(u => u.alive && u.side === side);
  const big = foes.sort((a, b) => b.tot * US(b).att - a.tot * US(a).att)[0];
  for (const k of ['lightning', 'arrow', 'cure', 'slow', 'haste']) {
    if (!h.spells.includes(k) || h.mana < SPELLS[k].mana) continue;
    if ((k === 'lightning' || k === 'arrow' || k === 'slow') && big && !hasAb(big, 'SpellImm') && !(k === 'slow' && hasAb(big, 'Undead'))) return {k, target: big.id};
    if (k === 'cure') { const hurt = mine.find(u => u.start * US(u).hp - u.tot > 10 + 5 * stat(h, 'sp')); if (hurt) return {k, target: hurt.id}; }
  }
  return null;
}
function planSide(side, onlyMissing) {
  const foes = () => B.units.filter(u => u.alive && u.side !== side && !u.hidden);
  for (const u of B.units) {
    if (!u.alive || u.side !== side || (onlyMissing && B.plans[u.id])) continue;
    const f = foes(); if (!f.length) break;
    let t;
    if (US(u).range && !enemyNear(u)) t = f.reduce((b, o) => (!b || o.tot * US(o).att > b.tot * US(b).att) ? o : b, null);
    else t = f.reduce((b, o) => (!b || md(u, o) < md(u, b)) ? o : b, null);
    B.plans[u.id] = {t: 'atk', target: t.id};
  }
  if (!B.spell[side] || !onlyMissing) B.spell[side] = B.spell[side] || bestSpell(side);
  if (B.siege && B.siege.att === side && !wallIntact(B.siege.target)) B.siege.target = autoWallTarget();
}
const wallIntact = y => y != null && B.siege.cells[y] && B.siege.cells[y].kind !== 'tower' && B.siege.cells[y].hp > 0;
function autoWallTarget() { const ys = [3, 2, 4, 1, 5, 6, 0].filter(wallIntact); return ys.length ? ys[0] : null; }
// Catapult fires together with spells, before any movement, so a breach can be used this round.
function siegeFire(out) {
  const S = B.siege; if (!S) return;
  const h = heroOf(S.att), shots = skl(h, 'ballistics') >= 30 ? 2 : 1;
  for (let i = 0; i < shots; i++) {
    const y = wallIntact(S.target) ? S.target : autoWallTarget(); if (y == null) break;
    const at = 0.1 + i * 0.4, c = S.cells[y], hit = Math.random() < SIEGE.catapultHit + skl(h, 'ballistics') / 100;
    S.fire.push(at); B.proj.push({at, dur: 0.45, fx: S.cat.x, fy: S.cat.y, tx: S.x, ty: y, kind: 'boulder', arc: 30});
    if (hit) { c.hp--; const hp = c.hp; later(at + 0.45, () => { c.shown = hp; SFX.hit(); }); fx({x: S.x, y}, hp <= 0 ? 'BREACH!' : 'HIT', '#f8b800', at + 0.45); out.push('Catapult hit the ' + c.kind + (hp <= 0 ? ' - destroyed' : '')); }
    else { fx({x: S.x, y}, 'MISS', '#bcbcbc', at + 0.45); out.push('Catapult missed'); }
  }
}
function castSpell(side, out) {
  const s = B.spell[side], h = heroOf(side); if (!s || !h) return;
  const sp = SPELLS[s.k], t = uById(s.target);
  if (!t || !t.alive || h.mana < sp.mana) return;
  h.mana -= sp.mana; const SP = stat(h, 'sp'), ut = US(t);
  if (sp.target === 'enemy' && hasAb(t, 'SpellImm')) { fx(t, 'IMMUNE', '#aaa', 0.4); out.push(t.type + ' resists ' + sp.name); return; }
  if (s.k === 'arrow' || s.k === 'lightning') { const d = Math.round((s.k === 'arrow' ? 10 + 10 * SP : 10 + 25 * SP) * (heroSpec(h) === 'pyre' ? 1.25 : 1)); t.tot -= d; fx(t, '-' + d, '#d858f8', 0.45); }
  if (s.k === 'cure') { const v = Math.min(10 + 5 * SP, t.start * ut.hp - t.tot); t.tot += Math.max(0, v); fx(t, '+' + Math.max(0, v), '#58d854', 0.4); }
  if (s.k === 'haste') { t.haste = 1; fx(t, 'HASTE', '#3cbcfc', 0.4); }
  if (s.k === 'slow') { if (hasAb(t, 'Undead')) fx(t, 'IMMUNE', '#aaa', 0.4); else { t.slow = 1; fx(t, 'SLOW', '#f8b800', 0.4); } }
  B.eff.push({k: s.k, side, tx: t.x, ty: t.y, at: 0.05}); later(0.05, SFX.magic);
  out.push(h.name + ' cast ' + sp.name);
  if (t.tot <= 0) t.alive = false;
  t.count = Math.max(0, Math.ceil(t.tot / ut.hp));
}
function moveAlong(u, cell) { // walk to a reached cell
  let c = cell, steps = 0; const path = []; while (c && c.prev) { steps++; path.push(c); c = c.prev; }
  u.x = cell.x; u.y = cell.y; u.moved = steps;
  for (const p of path) { const t = terrAt(p.x, p.y); if (t && t.k === 'thorns' && t.side !== u.side && !hasAb(u, 'Fly')) { const h = heroOf(t.side), d = (12 + 6 * (h ? stat(h, 'sp') : 0)) * (hasTal(h, 'brambles') ? 2 : 1); u.tot -= d; fx(u, '-' + d + ' THORNS', '#80d010', 0.6); B.thornHits = (B.thornHits || 0) + 1; if (u.tot <= 0) { u.tot = 0; u.alive = false; } u.count = Math.max(0, Math.ceil(u.tot / US(u).hp)); break; } }
}
// Round-start abilities: Mana Steal, Mana Leech tech, Gates of Hell portal.
function roundStartAbilities(out) {
  for (const side of ['L', 'R']) {
    const me = heroOf(side), foe = heroOf(otherSide(side)), o = B.sides[side].owner;
    const n = B.units.filter(u => u.alive && u.side === side && hasAb(u, 'ManaSteal')).length * 2 + techSum(o, 'manaRound');
    if (n && foe && foe.mana > 0) { const v = Math.min(foe.mana, n); foe.mana -= v; if (me) me.mana += Math.min(v, n); out.push((side === 'L' ? 'You' : 'Enemy') + ' drained ' + v + ' mana'); }
    if (techCap(o, 'gates')) {
      const cols = side === 'L' ? [0, 1, 2] : [BW - 1, BW - 2, BW - 3], spot = cols.flatMap(x => [3, 2, 4, 1, 5, 0, 6].map(y => ({x, y}))).find(c => free(c.x, c.y, side));
      if (spot) { const type = (me && me.lvl >= 5) ? 'Familiar' : 'Imp', count = 3 + 2 * B.round + (me ? me.lvl : 0), S = effStats(o, type);
        const u = {S, id: 'G' + side + B.round + '_' + B.units.length, side, type, count, start: count, tot: count * S.hp, x: spot.x, y: spot.y, rx: spot.x, ry: spot.y, gx: spot.x, gy: spot.y, shown: count, ph: 0, atk: [], hit: [], deadAt: null, src: -1, alive: true, summoned: 1};
        B.units.push(u); fx(u, 'GATES OF HELL!', '#fc7430', 0.3); out.push(count + ' ' + type + 's pour out of the portal'); }
    }
  }
}
function resolveRound() {
  if (!B || B.phase !== 'plan') return;
  if (B.noPlan !== 'R' || B.round > 1) planSide('R');
  if (B.noPlan && B.round === 1) { B.units.forEach(u => { if (u.side === B.noPlan) delete B.plans[u.id]; }); B.spell[B.noPlan] = null; }
  B.phase = 'resolve'; B.sel = null; B.spellPick = null;
  B.clock = 0; B.ev = []; B.proj = []; B.eff = []; UI.fx = [];
  B.units.forEach(u => { if (!u.alive) u.gone = true; u.atk = []; u.hit = []; });
  if (B.siege) { B.siege.fire = []; B.siege.shots = []; }
  const out = [];
  // 1. spells
  castSpell('L', out); castSpell('R', out); siegeFire(out);
  roundStartAbilities(out);
  for (const u of B.units) { const l = moraleChance(u.side); if (u.alive && !hasAb(u, 'Undead') && !hasAb(u, 'Machine') && l && Math.random() * 100 < l) { u.morale = 1; fx(u, 'MORALE!', '#58f8f8', 0.5); } }
  const afterSpell = B.units.map(u => [u, u.count, u.alive]);
  later(0.5, () => afterSpell.forEach(([u, c, a]) => { u.shown = c; if (!a && u.deadAt == null) u.deadAt = B.clock; }));
  // 2. movement, fastest first (ties random)
  const order = B.units.filter(u => u.alive).sort((a, b) => moveOf(b) - moveOf(a) || Math.random() - 0.5);
  for (const u of order) {
    const p = B.plans[u.id]; if (!p || !u.alive) continue;
    if (p.t === 'move') {
      const r = reach(u, moveOf(u)), c = r.get(p.x + ',' + p.y);
      if (c) moveAlong(u, c);
    } else if (p.t === 'atk') {
      const t = uById(p.target); if (!t || !t.alive || md(u, t) === 1) continue;
      if (US(u).range && !enemyNear(u)) continue;
      if (hasAb(u, 'Teleport')) { const c = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({x: t.x + dx, y: t.y + dy})).filter(c => free(c.x, c.y, u.side)).sort((p, q) => md(p, u) - md(q, u))[0]; if (c) { u.moved = md(c, u); u.x = c.x; u.y = c.y; fx(u, 'TELEPORT', '#e40058', 0.5); continue; } }
      let best = null;
      for (const c of reach(u, moveOf(u)).values()) { const score = md(c, t) * 10 + c.d; if (!best || score < best.s) best = {c, s: score}; }
      if (best) moveAlong(u, best.c);
    }
  }
  later(0.55, () => B.units.forEach(u => { u.gx = u.x; u.gy = u.y; }));
  // 3. attacks - all damage computed from the same snapshot, then applied together
  const hits = [];
  const strikes = u => hasAb(u, 'Triple') ? 3 : (hasAb(u, 'Double') || (B.round === 1 && techCap(ownerOfU(u), 'fury'))) ? 2 : 1;
  const adjFoeWith = (u, k) => B.units.some(o => o.alive && o.side !== u.side && md(o, u) === 1 && hasAb(o, k));
  const strike = (u, t, d, tags, melee, n) => { // one blow + its ability side effects (Ethereal, Fire Shield, Splash)
    if (melee && hasAb(t, 'Ethereal') && Math.random() < 0.3) { fx(t, 'PHASED', '#a8a8fc', 1.2 + n * 0.3); return; }
    hits.push({a: u, t, d, tags: n ? tags.concat('x' + (n + 1)) : tags, n});
    if (melee && hasAb(t, 'FireShield')) hits.push({a: t, t: u, d: Math.max(1, Math.round(d * 0.2)), tags: ['FIRE'], n});
    if (!n && hasAb(u, 'Splash')) B.units.filter(o => o.alive && o.side === t.side && o !== t && md(o, t) === 1).forEach(o => hits.push({a: u, t: o, d: Math.max(1, Math.round(d * 0.5)), tags: ['SPLASH'], n, splash: 1}));
  };
  for (const u of B.units) {
    const p = B.plans[u.id]; if (!u.alive || !p || p.t !== 'atk') continue;
    const t = uById(p.target); if (!t || !t.alive) continue;
    const ranged = US(u).range > 0, dist = md(u, t);
    if (!fearImm(u) && adjFoeWith(u, 'Fear') && Math.random() < 0.15) { fx(u, 'COWERS', '#a0a0a0', 1.0); out.push(u.type + ' cowers in fear'); continue; }
    if (!hasAb(u, 'Undead') && !hasAb(u, 'Machine') && adjFoeWith(u, 'Blind') && Math.random() < 0.2) { fx(u, 'BLINDED', '#fcfcfc', 1.0); out.push(u.type + ' is blinded'); continue; }
    if (ranged && dist > 1) {
      if (enemyNear(u)) { out.push(u.type + ' blocked'); continue; }
      const r = calcDmg(u, t, true); let d = r.dmg;
      if (dist > rangeOf(u)) d = Math.ceil(d / 2);
      const behindWall = B.siege && u.side === B.siege.att && (B.siege.def === 'R' ? t.x > B.siege.x : t.x < B.siege.x) && B.siege.cells[t.y].hp > 0;
      if (behindWall && hasAb(u, 'RockThrow')) { if (Math.random() < 0.35 && wallIntact(t.y)) { const c = B.siege.cells[t.y]; c.hp--; const hp = c.hp; later(1.4, () => { c.shown = hp; }); fx({x: B.siege.x, y: t.y}, hp <= 0 ? 'SMASHED!' : 'CRACK', '#f8b800', 1.4); out.push(u.type + ' cracked the ' + c.kind); } }
      else if (behindWall) { d = Math.ceil(d / 2); r.tags.push('WALL'); }
      for (let n = 0; n < strikes(u); n++) strike(u, t, d, r.tags, false, n);
    } else if (dist === 1) {
      const r = calcDmg(u, t, false); let d = ranged ? Math.ceil(r.dmg / 2) : r.dmg;
      for (let n = 0; n < strikes(u); n++) strike(u, t, d, r.tags, true, n);
      const noRet = hasAb(u, 'NoRetal') || techCap(ownerOfU(u), 'wildhunt') || (u.hidden && tac(u.side, 'ambush'));
      if (!t.retal && !noRet) { t.retal = true; const rr = calcDmg(t, u, false); strike(t, u, tac(t.side, 'riposte') ? rr.dmg : Math.ceil(rr.dmg / 2), ['RETAL'], true, 0); hits[hits.length - 1] && hits[hits.length - 1].a === t && (hits[hits.length - 1].ret = 1); }
    }
  }
  if (B.siege) for (const ty of B.siege.towers) { // arrow towers shoot in the same attack step
    const foes = B.units.filter(u => u.alive && u.side === B.siege.att); if (!foes.length) break;
    const t = foes.reduce((b, o) => !b || o.tot * US(o).att > b.tot * US(b).att ? o : b, null);
    hits.push({a: null, tower: ty, t, d: B.siege.towerDmg, tags: ['TOWER']});
  }
  B.lastHits = hits.map(h => ({a: h.a && h.a.id, t: h.t.id, d: h.d, tags: h.tags}));
  for (const u of B.units) if (u.hidden && B.plans[u.id] && B.plans[u.id].t !== 'def') { u.hidden = false; fx(u, 'AMBUSH!', '#d858f8', 0.9); }
  for (const h of hits) {
    h.t.tot -= h.d;
    if (h.a && h.d > 0) {
      if (hasAb(h.a, 'Drain') && !hasAb(h.t, 'Machine') && !hasAb(h.t, 'Undead')) h.a.tot = Math.min(h.a.start * US(h.a).hp, h.a.tot + Math.round(h.d * 0.25));
      if (hasAb(h.a, 'Shred') && !h.splash) h.t.shred = Math.min(9, (h.t.shred || 0) + 3);
      if (hasAb(h.a, 'Plague') && !h.splash) h.t.plague = Math.min(4, (h.t.plague || 0) + 2);
    }
    if (!h.a) { const at = 1.05, imp = 1.45; B.siege.shots.push({at, y: h.tower}); B.proj.push({at, dur: 0.4, fx: B.siege.x, fy: h.tower, tx: h.t.x, ty: h.t.y, kind: 'arrow'}); h.t.hit.push(imp); fx(h.t, '-' + h.d + ' TOWER', '#fc7460', imp); later(imp, SFX.hit); continue; }
    const ret = h.tags.includes('RETAL') || h.tags.includes('FIRE'), at = (ret ? 1.6 : 1.05) + (h.n || 0) * 0.3, shot = !ret && US(h.a).range > 0 && md(h.a, h.t) > 1, imp = at + (shot ? 0.35 : 0.15);
    h.a.atk.push({at, dx: shot ? 0 : Math.sign(h.t.x - h.a.x), dy: shot ? 0 : Math.sign(h.t.y - h.a.y)});
    if (shot) B.proj.push({at, dur: 0.35, fx: h.a.x, fy: h.a.y, tx: h.t.x, ty: h.t.y, kind: hasAb(h.a, 'RockThrow') || hasAb(h.a, 'Machine') ? 'boulder' : /bow|Elf|Engineer|Arbalest/.test(h.a.type) ? 'arrow' : 'orb', col: US(h.a).col});
    h.t.hit.push(imp); fx(h.t, '-' + h.d + (h.tags.length ? ' ' + h.tags[0] : ''), ret ? '#f8b800' : '#fcfcfc', imp);
    later(imp, SFX.hit);
  }
  for (const u of B.units) { // Heal: end of round, before deaths are counted
    if (!u.alive || u.tot <= 0 || !hasAb(u, 'Heal')) continue;
    for (const o of B.units) if (o.alive && o !== u && o.side === u.side && md(o, u) === 1 && o.tot > 0) { const mx = o.start * US(o).hp, v = Math.min(mx - o.tot, Math.max(5, Math.ceil(u.tot / US(u).hp) * 2)); if (v > 0) { o.tot += v; fx(o, '+' + v, '#58d854', 1.9); } }
  }
  for (const u of B.units) {
    if (!u.alive) continue;
    const hp = US(u).hp;
    if (u.tot <= 0 && techCap(ownerOfU(u), 'endless') && !u.rose && u.src >= 0) { u.rose = 1; u.tot = Math.ceil(u.start / 2) * hp; fx(u, 'RISES AGAIN!', '#d858f8', 2.0); out.push(u.type + ' rises (Endless Night)'); }
    if (u.tot <= 0) { u.alive = false; u.tot = 0; out.push(u.type + ' destroyed'); }
    else if (hasAb(u, 'Regen')) u.tot = Math.ceil(u.tot / hp) * hp;
    u.count = Math.ceil(u.tot / hp);
    u.retal = u.haste = u.slow = u.morale = 0; u.moved = 0;
  }
  B.plans = {}; B.spell = {L: null, R: null}; B.round++;
  B.log = hits.length + ' hits. ' + out.join('. ');
  const lAlive = B.units.some(u => u.alive && u.side === 'L'), rAlive = B.units.some(u => u.alive && u.side === 'R');
  const fin = B.units.map(u => [u, u.count, u.alive]);
  later(2.0, () => { fin.forEach(([u, c, a]) => { u.shown = c; if (!a && u.deadAt == null) u.deadAt = B.clock; }); msg(B.log); });
  if (!lAlive || !rAlive || B.round > 30) { later(2.8, () => endBattle(lAlive && !rAlive)); return; }
  later(2.5, () => { if (aiShouldRetreat()) { doRetreat('R'); return; } B.phase = 'plan'; B.sel = firstUnplanned(); msg('Round ' + B.round + ' - PLAN. ' + B.log); });
}
function endBattle(playerWon) {
  const ctx = B.ctx, killed = side => B.units.filter(u => u.side !== side).reduce((s, u) => s + Math.max(0, u.start * US(u).hp - u.tot), 0);
  for (const side of ['L', 'R']) {
    B.sides[side].arrs.forEach((arr, k) => { arr.length = 0; B.units.filter(u => u.alive && u.side === side && u.src === k).forEach(u => addUnits(arr, u.type, u.count)); });
  }
  const attWon = (B.attSide === 'L') === playerWon, xpL = killed('L'), xpR = killed('R');
  const xpA = B.attSide === 'L' ? xpL : xpR, xpD = B.attSide === 'L' ? xpR : xpL;
  const lost = B.units.filter(u => u.side === 'L' && u.start > u.count).map(u => (u.start - u.count) + ' ' + u.type).join(', ') || 'nothing';
  const myXp = (ctx.att.owner === 'player' ? ctx.att.hero && xpA : ctx.def.hero && xpD) || 0;
  B = null; UI.mode = UI.ret; syncBars();
  playerWon ? SFX.win() : SFX.lose();
  showPanel(() => `<h2 style="color:${playerWon ? 'var(--green)' : 'var(--red)'}">${playerWon ? 'VICTORY' : 'DEFEAT'}</h2>
    <p>You lost: ${lost}.</p>${playerWon && myXp ? '<p>Experience: +' + Math.round(myXp) + '</p>' : ''}
    <div class="bar"><button class="btn g" data-a="close">OK</button></div>`, {onClose: () => finishFight(ctx, attWon, xpA, xpD)});
}

// ---------- PRE-BATTLE: intel, formation, tactic, terrain spells (everything lasts the whole battle) ----------
const otherSide = s => s === 'L' ? 'R' : 'L';
const hasTal = (h, k) => !!(h && h.tal && h.tal[k]);
const ALL_TAL = () => Object.values(TALENTS).flat();
const knownTactics = h => Object.keys(TACTICS).filter(k => TACTICS[k].base || ALL_TAL().some(t => t.unlock === k && hasTal(h, t.k)));
function talentState(h, br, i) {
  const t = TALENTS[br][i]; if (hasTal(h, t.k)) return 'have';
  return (i === 0 || hasTal(h, TALENTS[br][i - 1].k)) && (h.tp || 0) > 0 ? 'open' : 'locked';
}
function learnTalent(h, k) {
  for (const br in TALENTS) { const i = TALENTS[br].findIndex(t => t.k === k); if (i >= 0 && talentState(h, br, i) === 'open') { h.tal[k] = 1; h.tp--; return true; } }
  return false;
}
function aiLearnTalent(h) { const brs = shuffle(Object.keys(TALENTS)); for (const br of brs) { const i = TALENTS[br].findIndex((t, j) => talentState(h, br, j) === 'open'); if (i >= 0) { learnTalent(h, TALENTS[br][i].k); return; } } }
const baseIntel = h => !h ? 0 : Math.min(2, (h.sk && h.sk.scouting ? (h.sk.scouting >= 3 ? 2 : 1) : 0) + (hasTal(h, 'spymaster') ? 1 : 0) + (ktal(h.owner, 'seers') ? 1 : 0));
const intelOf = side => Math.min(2, baseIntel(heroOf(side)) + (B.tac[side].reveal ? 1 : 0));
const terrCost = (h, k) => Math.max(1, TERRAIN_SPELLS[k].mana - (hasTal(h, 'geomancer') ? 2 : 0) - (k === 'fog' && hasTal(h, 'mist') ? 2 : 0) - (pol(h.owner, 'tithe') ? 1 : 0) - (ktal(h.owner, 'archmage') ? 1 : 0));
const revealCost = h => hasTal(h, 'mist') ? 0 : REVEAL.mana - (pol(h.owner, 'tithe') ? 1 : 0);
const terrAt = (x, y) => B && B.terr && B.terr[x + ',' + y];
function blunted(side) {
  const T = B.tac[side], t = T.tactic, o = B.tac[otherSide(side)].tactic, h = heroOf(side); if (!t) return false;
  if ((t === 'blitz' && hasTal(h, 'grandblitz')) || (t === 'shieldwall' && hasTal(h, 'phalanx'))) return false;
  if (t === 'ambush' && hasTal(h, 'perfect')) return false;
  if (o && TACTICS[o].beats.includes(t)) return true;
  return t === 'ambush' && B.tac[otherSide(side)].intel >= 2;
}
const tac = (side, k) => !!(B && B.tac && B.tac[side].tactic === k && !blunted(side));
const rangeOf = u => US(u).range ? US(u).range + (heroSpec(heroOf(u.side)) === 'ranger' ? 1 : 0) + (tac(u.side, 'volley') ? 1 : 0) + ((terrAt(u.x, u.y) || {}).k === 'raise' ? 2 : 0) : 0;
// deploy zone = own first 2 columns
const deployCols = side => side === 'L' ? [1, 0] : [BW - 2, BW - 1];
const inDeploy = (side, x, y) => deployCols(side).includes(x) && y >= 0 && y < BH && !wallBlocks(x, y, side) && !B.obst.has(x + ',' + y);
const FORM_SLOTS = {
  line:   {m: ['F3', 'F1', 'F5', 'F2', 'F4', 'F0', 'F6'], r: ['B3', 'B2', 'B4', 'B1', 'B5', 'B0', 'B6']},
  wedge:  {m: ['F3', 'B2', 'B4', 'B1', 'B5', 'B0', 'B6'], r: ['B3', 'F2', 'F4', 'F1', 'F5', 'F0', 'F6']},
  turtle: {m: ['F3', 'F2', 'F4', 'B1', 'B5', 'F1', 'F5'], r: ['B3', 'B2', 'B4', 'B0', 'B6', 'F0', 'F6']},
};
function applyFormation(side, kind) {
  const [F, Bk] = deployCols(side), us = B.units.filter(u => u.alive && u.side === side), taken = new Set();
  const all = [...FORM_SLOTS[kind].m, ...FORM_SLOTS[kind].r].map(s => [s[0] === 'F' ? F : Bk, +s[1]]);
  const put = (u, pref) => { for (const [x, y] of [...pref, ...all]) { const k = x + ',' + y; if (!taken.has(k) && inDeploy(side, x, y)) { taken.add(k); u.x = u.rx = u.gx = x; u.y = u.ry = u.gy = y; return; } } };
  const slots = l => l.map(s => [s[0] === 'F' ? F : Bk, +s[1]]);
  us.filter(u => !US(u).range).forEach(u => put(u, slots(FORM_SLOTS[kind].m)));
  us.filter(u => US(u).range).forEach(u => put(u, slots(FORM_SLOTS[kind].r)));
  B.tac[side].form = kind;
}
function placeTerrain(side, k, x, y) {
  const h = heroOf(side); if (!h || h.mana < terrCost(h, k)) return false;
  const cells = TERRAIN_SPELLS[k].cells.map(([dx, dy]) => [x + dx, y + dy]).filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < BW && cy < BH && !(B.siege && cx === B.siege.x) && !(B.siege && cx === B.siege.cat.x && cy === B.siege.cat.y));
  if (!cells.length) return false;
  h.mana -= terrCost(h, k); cells.forEach(([cx, cy]) => { if (k !== 'raise' || !B.obst.has(cx + ',' + cy)) B.terr[cx + ',' + cy] = {k, side}; });
  B.tac[side].terrain.push({k, x, y, cost: terrCost(h, k)}); return true;
}
function clearTerrain(side) {
  const h = heroOf(side); for (const t of B.tac[side].terrain) if (h) h.mana += t.cost;
  for (const key in B.terr) if (B.terr[key].side === side) delete B.terr[key];
  B.tac[side].terrain = [];
}
function setTactic(side, k) {
  const T = B.tac[side]; T.tactic = k;
  B.units.forEach(u => { if (u.side === side) u.hidden = false; });
  if (k === 'ambush') B.units.filter(u => u.alive && u.side === side).sort((a, b) => (US(a).range - US(b).range) || (b.tot - a.tot)).slice(0, 2).forEach(u => u.hidden = true);
}
// AI: picks tactic by army make-up; with Intel 2 it also counters the foe's tactic.
function aiTactic(side) {
  const h = heroOf(side), foe = otherSide(side), mine = B.units.filter(u => u.alive && u.side === side), them = B.units.filter(u => u.alive && u.side === foe);
  const share = (l, f) => l.length ? l.filter(f).length / l.length : 0, myR = share(mine, u => US(u).range), foeR = share(them, u => US(u).range);
  const foeFast = share(them, u => US(u).move >= 4), seen = B.tac[side].intel >= 2 ? B.tac[foe].tactic : null;
  const base = {blitz: 1.5 + (1 - myR), bloodlust: 1.2 + 1.5 * (1 - myR), volley: 0.5 + 3 * myR, shieldwall: 1.4 + (1 - foeR), riposte: 1 + (1 - foeR), entrench: 0.8 + 2 * myR,
    ambush: mine.length >= 3 ? 1.6 : 0.5, sabotage: 0.8 + 2 * foeFast, decoy: 0.6 + 3 * foeR};
  let best = null, bs = -99;
  for (const k of knownTactics(h)) {
    let s = base[k] + Math.random() * 0.3;
    if (seen) { if (TACTICS[k].beats.includes(seen)) s += 5; if (TACTICS[seen].beats.includes(k)) s -= 5; if (k === 'ambush') s -= 3; }
    if (k === 'ambush' && B.tac[foe].intel >= 2 && !hasTal(h, 'perfect')) s -= 4; // it knows it would be seen through
    if (s > bs) { bs = s; best = k; }
  }
  return best;
}
function aiPre(side) {
  const T = B.tac[side], h = heroOf(side), foe = otherSide(side), them = B.units.filter(u => u.alive && u.side === foe), mine = B.units.filter(u => u.alive && u.side === side);
  const foeR = them.filter(u => US(u).range).length / Math.max(1, them.length), myR = mine.filter(u => US(u).range).length / Math.max(1, mine.length);
  if (h && h.mana >= revealCost(h) && baseIntel(h) < 2 && h.mana > 12) { h.mana -= revealCost(h); T.reveal = true; T.intel = intelOf(side); }
  applyFormation(side, foeR > 0.5 ? 'wedge' : myR > 0.4 ? 'turtle' : 'line');
  setTactic(side, aiTactic(side));
  if (!h) return;
  const dir = side === 'R' ? -1 : 1, [F] = deployCols(side), budget = () => h.mana - 10;
  const tryT = (k, x, y) => budget() >= terrCost(h, k) && placeTerrain(side, k, x, y);
  if (foeR > 0.3) tryT('fog', side === 'R' ? BW - 1 : 1, 3);
  if (foeR < 0.7) tryT('thorns', F + dir * 3, 3);
  const shooter = mine.find(u => US(u).range); if (shooter) tryT('raise', shooter.x, shooter.y);
  if (foeR < 0.5) tryT('quagmire', F + dir * 4, 3);
}
function aiAdapt(side) { // at FIGHT: an Intel-2 AI sees the player's final tactic and may switch
  if (B.tac[side].intel < 2 || !B.tac[otherSide(side)].tactic) return false;
  const old = B.tac[side].tactic, k = aiTactic(side); if (k === old) return false;
  setTactic(side, k); return true;
}
function startFight() {
  if (!B || B.phase !== 'pre') return;
  for (const s of ['L', 'R']) B.tac[s].intel = intelOf(s);
  const adapted = aiAdapt('R');
  for (const s of ['L', 'R']) { if (!tac(s, 'ambush')) B.units.forEach(u => { if (u.side === s) u.hidden = false; }); if (tac(s, 'ambush') && hasTal(heroOf(s), 'perfect')) B.noPlan = otherSide(s); }
  B.phase = 'plan'; B.sel = firstUnplanned(); $('pre').style.display = 'none'; UI.preSel = null; UI.preTerr = null;
  const tn = s => B.tac[s].tactic ? TACTICS[B.tac[s].tactic].name + (blunted(s) ? ' (blunted)' : '') : 'none';
  msg('FIGHT! Your tactic: ' + tn('L') + '. Enemy: ' + (B.tac.L.intel >= 2 ? tn('R') + (adapted ? ' - they adapted to you!' : '') : 'unknown') + (B.noPlan === 'L' ? ' AMBUSHED: you cannot act in round 1!' : '') + ' PLAN your moves.');
  SFX.hit();
}
const rough = n => countWord(n);
function renderPre() {
  const el = $('pre'); if (!B || B.phase !== 'pre') { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = 'block';
  const h = heroOf('L'), T = B.tac.L, E = B.tac.R, iv = intelOf('L'), known = knownTactics(h), foes = B.units.filter(u => u.side === 'R' && u.alive);
  const sig = JSON.stringify([T, E.tactic, E.terrain.length, iv, h && h.mana, UI.preSel, UI.preTerr, B.units.map(u => [u.x, u.y, u.hidden])]);
  if (sig === el.dataset.sig) return; el.dataset.sig = sig;
  const tb = k => { const t = TACTICS[k], ok = known.includes(k); return btn((ok ? '' : 'LOCKED ') + t.name, ok ? 'ptac' : 'nop', k, T.tactic === k ? 'y' : 'alt', !ok).replace('<button ', `<button title="${t.name}: ${t.desc}${t.beats.length ? '. Blunts ' + t.beats.map(b => TACTICS[b].name).join(', ') : ''}" `); };
  let s = `<h2>PRE-BATTLE${B.siege ? ' - SIEGE' : ''}</h2>
    <h3>1. SCOUT - INTEL ${iv}</h3><p>${INTEL_DESC[iv]}.<br>${foes.map(u => countText(u.count, iv >= 1) + ' ' + u.type).join(', ')}${iv >= 2 ? `<br><b class="hl">Enemy tactic: ${E.tactic ? TACTICS[E.tactic].name : 'none'}</b><br><b class="hl">Enemy terrain: ${E.terrain.map(t => TERRAIN_SPELLS[t.k].name).join(', ') || 'none'}</b>${KG(B.sides.R.owner) ? `<br><b class="hl">Enemy kingdom: ${KG(B.sides.R.owner).slots.map(k => POLICIES[k].name).join(', ') || 'no policies'}</b>` : ''}` : '<br>Enemy tactic: ???'}</p>
    ${h && iv < 2 && !T.reveal ? `<div class="bar">${btn('REVEAL (' + revealCost(h) + ' mana)', 'preveal', '', 'p', h.mana < revealCost(h))}</div>` : ''}
    <h3>2. FORMATION</h3>${FORMATIONS.map(f => `<div class="it form">${formDiagram(f)}<div class="t"><b>${f.toUpperCase()}</b>${T.form === f ? ' <b class="ok">CHOSEN</b>' : ''}<small>${FORM_INFO[f].d} ${FORM_INFO[f].good}</small></div>${btn(T.form === f ? 'SET' : 'USE', 'pform', f, T.form === f ? 'y' : 'alt')}</div>`).join('')}<p><span class="dz"></span> <b>Your deploy zone</b> (tap unit, then tap tile; or drag). <i class="fdia"><i class="m"></i></i> melee <i class="fdia"><i class="r"></i></i> shooter</p>
    <h3>3. TACTIC (whole battle)</h3>${Object.keys(DOCTRINES).map(d => `<div class="bar"><b style="color:${DOCTRINES[d].col};width:64px">${DOCTRINES[d].name.toUpperCase()}</b>${Object.keys(TACTICS).filter(k => TACTICS[k].doc === d).map(tb).join('')}</div>`).join('')}
    <p>${T.tactic ? TACTICS[T.tactic].name + ': ' + TACTICS[T.tactic].desc + (TACTICS[T.tactic].beats.length ? '. Blunts ' + TACTICS[T.tactic].beats.map(k => TACTICS[k].name).join(', ') : '') : 'No tactic chosen.'}</p>`;
  if (T.tactic === 'ambush') s += `<p>Hidden (max 2): ${B.units.filter(u => u.side === 'L' && u.alive).map(u => btn((u.hidden ? 'HIDDEN ' : '') + u.type, 'phide', u.id, u.hidden ? 'p' : 'alt')).join('')}</p>`;
  s += `<h3>4. TERRAIN SPELLS ${h ? '(mana ' + h.mana + ')' : ''}</h3>${h ? `<div class="bar">${Object.keys(TERRAIN_SPELLS).map(k => btn(TERRAIN_SPELLS[k].name + ' ' + terrCost(h, k), 'pterr', k, UI.preTerr === k ? 'y' : 'p', h.mana < terrCost(h, k)).replace('<button ', `<button title="${TERRAIN_SPELLS[k].name}: ${TERRAIN_SPELLS[k].desc}" `)).join('')}${T.terrain.length ? btn('CLEAR', 'pclear', '', 'alt') : ''}</div>
    <details class="hlp"><summary>? What do tactics and terrain spells do</summary>${Object.keys(TACTICS).map(k => `<div><b>${TACTICS[k].name}</b> (${DOCTRINES[TACTICS[k].doc].name}): ${TACTICS[k].desc}${TACTICS[k].beats.length ? '. Blunts ' + TACTICS[k].beats.map(b => TACTICS[b].name).join(', ') : ''}</div>`).join('')}${Object.keys(TERRAIN_SPELLS).map(k => `<div><b>${TERRAIN_SPELLS[k].name}</b> (terrain): ${TERRAIN_SPELLS[k].desc}</div>`).join('')}</details>
    <p>${UI.preTerr ? 'Tap the field to place ' + TERRAIN_SPELLS[UI.preTerr].name + ': ' + TERRAIN_SPELLS[UI.preTerr].desc : 'Placed: ' + (T.terrain.map(t => TERRAIN_SPELLS[t.k].name).join(', ') || 'none') + '. Lasts the whole battle.'}</p>` : '<p>No hero - no spells.</p>'}
    <div class="bar fbar"><button class="btn g" data-a="pfight" style="flex:1">FIGHT!</button></div>`;
  el.innerHTML = s;
}
function preTap(gx, gy) {
  if (UI.preTerr) { const k = UI.preTerr; if (placeTerrain('L', k, gx, gy)) { SFX.magic(); msg(TERRAIN_SPELLS[k].name + ' placed'); UI.preTerr = null; } else { SFX.bad(); msg('Cannot place there'); } return; }
  const u = uAt(gx, gy), s = UI.preSel && uById(UI.preSel);
  if (u && u.side === 'L') { if (s && s !== u) { const [x, y] = [s.x, s.y]; moveUnitTo(s, u.x, u.y); moveUnitTo(u, x, y); UI.preSel = null; SFX.click(); } else { UI.preSel = s === u ? null : u.id; SFX.click(); } return; }
  if (s && !u && inDeploy('L', gx, gy)) { moveUnitTo(s, gx, gy); UI.preSel = null; SFX.click(); return; }
  if (u) { msg(countText(u.count, B.tac.L.intel || intelOf('L')) + ' ' + u.type + ' · ' + abText(US(u))); return; }
  if (s) { msg('Place stacks inside the blue zone'); SFX.bad(); }
}
function preDrag(ax, ay, bx, by) { const u = uAt(ax, ay); if (!u || u.side !== 'L') return; UI.preSel = u.id; preTap(bx, by); }
function moveUnitTo(u, x, y) { u.x = u.gx = x; u.y = u.gy = y; }

// ---------- KINGDOM: policies + kingdom talents (per owner, apply to all heroes and towns) ----------
const KG = o => G && G.kg && G.kg[o];
const pol = (o, k) => !!(KG(o) && KG(o).slots.includes(k));
const ktal = (o, k) => !!(KG(o) && KG(o).tal[k]);
const isWeekStart = () => (G.day - 1) % 7 === 0;
function mkKingdom(owner) { const t = G.towns.find(t => t.owner === owner); return {faction: t ? t.faction : (owner === 'player' ? 'castle' : 'necro'), slots: [], kp: 1, tal: {}, kpWeek: 0}; }
function slotCount(o) {
  const k = KG(o); if (!k) return 0;
  const extra = (ktal(o, 'goldenage') ? 1 : 0) + (ktal(o, 'astral') ? 1 : 0);
  return Math.min(MAX_SLOTS + extra, BASE_SLOTS + (G.towns.some(t => t.owner === o && t.built.includes('capitol')) ? 1 : 0) + (G.day >= 29 ? 1 : 0) + extra);
}
function policyOK(o, k) { const p = POLICIES[k], K = KG(o); if (!p || !K) return 'No kingdom'; if (p.faction && p.faction !== K.faction) return FACTIONS[p.faction].name + ' only'; if (p.unlock && !ktal(o, p.unlock)) return 'Needs talent ' + ALL_KT().find(t => t.k === p.unlock).name; return ''; }
const swapCost = o => ktal(o, 'treasury') ? POLICY_SWAP_COST / 2 : POLICY_SWAP_COST;
// slot i: empty -> free any time; filled -> only on Day 1 of a week, for gold
function setPolicy(o, i, k) {
  const K = KG(o); if (!K || i >= slotCount(o)) return 'No such slot';
  if (k && K.slots.includes(k)) return 'Already active';
  if (k) { const why = policyOK(o, k); if (why) return why; }
  const cur = K.slots[i];
  if (cur) { if (!isWeekStart()) return 'Swap only on Day 1 of a week'; if (G.res[o].gold < swapCost(o)) return 'Need ' + swapCost(o) + ' gold'; G.res[o].gold -= swapCost(o); }
  if (k) K.slots[i] = k; else K.slots.splice(i, 1);
  K.slots = K.slots.filter(Boolean); return '';
}
const ALL_KT = () => Object.values(KTALENTS).flat();
function ktState(o, br, i) { const K = KG(o), t = KTALENTS[br][i]; if (K.tal[t.k]) return 'have'; return (i === 0 || K.tal[KTALENTS[br][i - 1].k]) && K.kp > 0 ? 'open' : 'locked'; }
function learnKT(o, k) { const K = KG(o); for (const br in KTALENTS) { const i = KTALENTS[br].findIndex(t => t.k === k); if (i >= 0 && ktState(o, br, i) === 'open') { K.tal[k] = 1; K.kp--; return true; } } return false; }
function weeklyKP(o) { const mines = G.objs.filter(x => x.kind === 'mine' && x.owner === o).length; return 1 + Math.floor(mines / 3); }
function aiKingdom() {
  const o = 'ai', K = KG(o); if (!K) return;
  const order = ['economy', 'military', 'arcane'];
  for (let guard = 0; K.kp > 0 && guard < 20; guard++) { let done = false; for (const br of order) { const i = KTALENTS[br].findIndex((t, j) => ktState(o, br, j) === 'open'); if (i >= 0) { learnKT(o, KTALENTS[br][i].k); done = true; break; } } if (!done) break; }
  for (const k of [...AI_POLICY_PREF[K.faction] || [], ...Object.keys(POLICIES)]) { if (K.slots.length >= slotCount(o)) break; if (!K.slots.includes(k) && !policyOK(o, k)) K.slots.push(k); }
}
const policyIcons = o => (KG(o) ? KG(o).slots : []).map(k => `<i class="pi" style="background:${POLICY_CATS[POLICIES[k].cat].col}" title="${POLICIES[k].name}: ${POLICIES[k].desc}">${POLICIES[k].icon}</i>`).join('');
const canSeeEnemyKingdom = () => G.heroes.some(h => h.owner === 'player' && h.sk && h.sk.scouting);
function openKingdom() {
  if (!G || !KG('player')) return;
  UI.kslot = UI.kslot ?? null;
  showPanel(() => {
    const o = 'player', K = KG(o), n = slotCount(o), wk = isWeekStart();
    let s = `<div class="thead"><h2>KINGDOM - ${FACTIONS[K.faction].name.toUpperCase()}</h2>${btn('CLOSE', 'close', '', 'g')}</div><div class="kg">
      <p>Policies apply to every hero and town. Slots ${n}: 2 base${G.towns.some(t => t.owner === o && t.built.includes('capitol')) ? ' +1 Capitol' : ' (+1 with a Capitol)'}${G.day >= 29 ? ' +1 Month 2' : ' (+1 from Month 2)'}${ktal(o, 'goldenage') || ktal(o, 'astral') ? ' +talent' : ''}.
      Empty slots fill free. Swapping a policy costs ${swapCost(o)} gold and is only allowed on Day 1 of a week ${wk ? '<b class="ok">(today!)</b>' : '<b class="no">(not today)</b>'}.</p>
      <h3>POLICY SLOTS</h3><div class="kslots">${Array.from({length: n}, (_, i) => { const k = K.slots[i], p = k && POLICIES[k]; return `<button class="btn kslot ${UI.kslot === i ? 'y' : 'alt'}" data-a="kslot" data-v="${i}">${p ? `<i class="pi" style="background:${POLICY_CATS[p.cat].col}">${p.icon}</i>${p.name}` : 'EMPTY SLOT'}</button>`; }).join('')}</div>
      <p>${UI.kslot != null ? 'Slot ' + (UI.kslot + 1) + ' selected: pick a policy below.' : 'Tap a slot, then a policy.'}</p>
      <div class="cols3">${Object.keys(POLICY_CATS).map(c => `<div><h3 style="color:${POLICY_CATS[c].col}">${POLICY_CATS[c].name.toUpperCase()}</h3>${Object.keys(POLICIES).filter(k => POLICIES[k].cat === c).map(k => { const p = POLICIES[k], why = policyOK(o, k), on = K.slots.includes(k); return `<div class="it"><div class="t">${p.name}${on ? ' <b class="ok">ACTIVE</b>' : ''}<small>${p.desc}${why ? ' · <span class="no">' + why + '</span>' : ''}</small></div>${btn('SET', 'kpol', k, 'y', !!why || on || UI.kslot == null)}</div>`; }).join('')}</div>`).join('')}</div>
      <h3>KINGDOM TALENTS (${K.kp} point${K.kp === 1 ? '' : 's'} · +${weeklyKP(o)} next week: 1 + 1 per 3 mines)</h3><div class="tal">${Object.keys(KTALENTS).map(br => `<div><b style="color:${POLICY_CATS[br].col}">${POLICY_CATS[br].name.toUpperCase()}</b>${KTALENTS[br].map((t, i) => { const st = ktState(o, br, i); return `<button class="btn sb ${st === 'have' ? 'g' : st === 'open' ? 'y' : 'alt'}${t.cap ? ' ult' : ''}" data-a="ktal" data-v="${t.k}" ${st !== 'open' ? 'disabled' : ''}>${t.name}<small>${t.desc}</small></button>`; }).join('')}</div>`).join('')}</div>`;
    if (canSeeEnemyKingdom() && KG('ai')) s += `<h3>ENEMY KINGDOM (your scouts report)</h3><p>${KG('ai').slots.map(k => POLICIES[k].name).join(', ') || 'No policies'}</p>`;
    return s + '</div>';
  }, {full: true, kingdom: true});
}

// ---------- RETREAT / SURRENDER / BRIBE (plan phase only) ----------
const RES_VALUE = {wood: 250, ore: 250, gems: 500}; // gold-equivalent per unit (= market buy price)
const stackValue = us => us.reduce((s, u) => s + u.count * (US(u).cost || 50), 0);
function surrenderPrice() { // vs enemy hero: half your remaining army value; vs neutrals (bribe): their remaining value
  const neutral = !!B.sides.R.monster, L = B.units.filter(u => u.alive && u.side === 'L'), R = B.units.filter(u => u.alive && u.side === 'R');
  return Math.max(100, Math.round((neutral ? stackValue(R) : stackValue(L) * 0.5) / 50) * 50);
}
// payment plans: gold only, resources only (wood/ore/gems at RES_VALUE), or a mix (all gold you can, rest in resources)
function payPlans(owner, price) {
  const R = G.res[owner], resPart = need => { const pay = {wood: 0, ore: 0, gems: 0}; let left = need;
    for (const r of ['gems', 'ore', 'wood']) { const n = Math.min(R[r], Math.floor(left / RES_VALUE[r])); pay[r] = n; left -= n * RES_VALUE[r]; }
    for (const r of ['wood', 'ore', 'gems']) if (left > 0 && R[r] > pay[r]) { pay[r]++; left -= RES_VALUE[r]; }
    return left > 0 ? null : pay; };
  const res = resPart(price), g = Math.min(R.gold, price), mixR = resPart(price - g);
  return {gold: R.gold >= price ? {gold: price} : null, res: res ? res : null, mix: mixR && g < price && g > 0 ? Object.assign({gold: g}, mixR) : null};
}
const planText = p => Object.keys(p).filter(k => p[k]).map(k => p[k] + ' ' + k).join(' + ');
function fleeInfo() {
  const h = heroOf('L'), neutral = !!B.sides.R.monster, siegeDef = B.siege && B.siege.def === 'L';
  const home = h && G.towns.filter(t => t.owner === 'player' && t !== B.ctx.def.town && !heroAt(t.x, t.y)).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  return {h, neutral, home, canRetreat: !!h, canSurrender: !!h && !siegeDef && (neutral || !!home), why: !h ? 'No hero to flee with' : siegeDef ? 'Cannot surrender a town under siege' : !neutral && !home ? 'No free town to flee to' : ''};
}
function openFlee() {
  if (!B || B.phase !== 'plan') return;
  const f = fleeInfo(), price = surrenderPrice(), plans = payPlans('player', price);
  showPanel(() => `<h2>LEAVE THE BATTLE?</h2>
    <h3>RETREAT</h3><p>${f.h ? f.h.name + ' flees. <span class="no">Your whole army is lost.</span> The hero (level, skills and talents kept) can be rehired at any of your Taverns.' : 'No hero.'}</p>
    <div class="bar">${btn('CONFIRM RETREAT', 'retreat', '', 'y', !f.canRetreat)}</div>
    <h3>${f.neutral ? 'BRIBE THE NEUTRALS' : 'SURRENDER'}</h3><p>${f.neutral ? 'Pay them to leave the map. Your army stays fully intact; no experience.' : 'Pay the enemy. Your army stays fully intact and ' + (f.h ? f.h.name : 'the hero') + ' goes to ' + (f.home ? f.home.name : 'a town') + '.'}<br>
    Price: <b class="hl">${price} gold</b> (or resources: wood/ore ${RES_VALUE.wood}g each, gems ${RES_VALUE.gems}g each).${f.why && !f.canSurrender ? '<br><span class="no">' + f.why + '</span>' : ''}</p>
    ${[['gold', 'PAY GOLD'], ['res', 'PAY RESOURCES'], ['mix', 'PAY MIX']].map(([k, l]) => `<div class="it"><div class="t">${l}<small>${plans[k] ? planText(plans[k]) : '<span class="no">Cannot afford</span>'}</small></div>${btn('PAY', 'surrender', k, 'g', !plans[k] || !f.canSurrender)}</div>`).join('')}
    <div class="bar" style="margin-top:8px">${btn('CANCEL', 'close', '', 'alt')}</div>`);
}
function syncArmies() { for (const side of ['L', 'R']) B.sides[side].arrs.forEach((arr, k) => { arr.length = 0; B.units.filter(u => u.alive && u.side === side && u.src === k).forEach(u => addUnits(arr, u.type, u.count)); }); }
function leaveBattle() { B = null; UI.mode = UI.ret; $('pre').style.display = 'none'; syncBars(); }
function doRetreat(side) {
  const ctx = B.ctx, h = heroOf(side), playerSide = side === 'L';
  B.units.filter(u => u.side === side).forEach(u => { u.alive = false; u.tot = 0; u.count = 0; });
  const killed = s => B.units.filter(u => u.side !== s).reduce((a, u) => a + Math.max(0, u.start * US(u).hp - u.tot), 0);
  const otherSideKey = otherSide(side), xpW = killed(otherSideKey);
  syncArmies();
  const winnerIsAtt = (B.attSide === otherSideKey);
  if (h) { G.fled = G.fled || []; G.fled.push(Object.assign(JSON.parse(JSON.stringify(h)), {army: []})); }
  leaveBattle();
  if (playerSide) { SFX.lose(); msg(h.name + ' retreated! The army is lost. Rehire ' + h.name + ' at a Tavern.'); finishFight(ctx, winnerIsAtt, winnerIsAtt ? xpW : 0, winnerIsAtt ? 0 : xpW); }
  else { SFX.win(); showPanel(() => `<h2 style="color:var(--green)">THE ENEMY RETREATS!</h2><p>${h.name} fled the battlefield and left the army behind.</p><div class="bar"><button class="btn g" data-a="close">OK</button></div>`, {onClose: () => finishFight(ctx, winnerIsAtt, winnerIsAtt ? xpW : 0, winnerIsAtt ? 0 : xpW)}); }
}
function doSurrender(kind) {
  const f = fleeInfo(); if (!f.canSurrender) return false;
  const plan = payPlans('player', surrenderPrice())[kind]; if (!plan) return false;
  for (const r in plan) G.res.player[r] -= plan[r];
  const ctx = B.ctx; syncArmies(); leaveBattle(); SFX.pick();
  if (f.neutral) { G.objs.splice(G.objs.indexOf(ctx.def.monster), 1); msg('Bribed! The neutrals leave. Paid ' + planText(plan) + '.'); if (ctx.after && G.heroes.includes(ctx.att.hero)) ctx.after(); }
  else { f.h.x = f.home.x; f.h.y = f.home.y; UI.rpos[f.h.id] = null; delete UI.rpos[f.h.id]; f.h.mp = 0; revealAll(); msg('Surrendered. Paid ' + planText(plan) + '. ' + f.h.name + ' returns to ' + f.home.name + ' with the army.'); }
  G.lastSurrender = {kind, plan}; return true;
}
function aiShouldRetreat() { // AI hero flees when hopeless (keeps the hero, loses the army)
  if (!B || !heroOf('R') || B.sides.R.owner !== 'ai' || B.round < 2) return false;
  const pw = s => armyPower(B.units.filter(u => u.alive && u.side === s).map(u => ({type: u.type, count: u.count})), heroOf(s));
  return pw('R') < pw('L') * 0.2;
}
// ---------- tooltips for map objects (hover on desktop, tap on phone) ----------
const PLURAL = {Wolf: 'Wolves', Goblin: 'Goblins', Troll: 'Trolls'};
const band = n => countWord(n);
function threatOf(army) {
  const me = curHero(), mine = me ? armyPower(me.army, me) : 1, r = armyPower(army) / Math.max(1, mine);
  return r < 0.5 ? {t: 'EASY', c: '#58d854'} : r < 1.3 ? {t: 'EVEN', c: '#f8b800'} : {t: 'DEADLY', c: '#e40058'};
}
const ownerName = o => o === 'player' ? 'You' : o === 'ai' ? 'Enemy' : 'Nobody';
function tipFor(x, y) {
  if (!inMap(x, y) || !G.fog[y][x]) return null;
  const o = objAt(x, y), t = townAt(x, y), h = heroAt(x, y);
  if (t) return {title: t.name, lines: ['Owner: ' + ownerName(t.owner), FACTIONS[t.faction].name + ' town', t.owner !== 'player' ? 'Garrison: ' + bandArmy(t.garrison) : '']};
  if (h) return {title: h.name + ' (hero)', lines: ['Owner: ' + ownerName(h.owner), h.owner === 'player' ? armyText(h.army) : 'Army: ' + h.army.map(s => band(s.count) + ' ' + s.type).join(', ')]};
  if (!o) return null;
  if (o.kind === 'mine') { const m = MINES[o.mine]; return {title: m.name, icon: o.mine, lines: ['Produces +' + m.amt + ' ' + m.res + ' per day', 'Owner: ' + ownerName(o.owner)]}; }
  if (o.kind === 'res') return {title: o.amt + ' ' + o.res.toUpperCase(), icon: o.res, lines: ['Walk here to pick it up']};
  if (o.kind === 'grove') return {title: 'Sacred Grove', lines: ['Owner: ' + ownerName(o.owner), 'Sylvan research: +0.2 per day while owned', 'Walk here to claim it']};
  if (o.kind === 'chest') return {title: 'Treasure chest', lines: ['1000 gold or 750 experience']};
  if (o.kind === 'art') return {title: ARTIFACTS[o.art].name, lines: ['Artifact: +' + ARTIFACTS[o.art].val + ' ' + ARTIFACTS[o.art].stat]};
  if (o.kind === 'monster') { const s = o.army[0], th = threatOf(o.army), sw = sizeWord(s.count).replace(/^A /, ''); return {title: sw[0].toUpperCase() + sw.slice(1) + ' ' + (PLURAL[s.type] || s.type + 's') + ' (' + band(s.count) + ')', lines: ['Neutral · ' + (US(s).ab.map(k => ABIL[k]).join('; ') || 'no abilities')], threat: th}; }
}
function showTip(x, y, cx, cy) {
  const el = $('tip'), tp = tipFor(x, y); if (!tp) { el.style.display = 'none'; return; }
  el.innerHTML = `<b>${tp.icon ? `<img src="${resImg(MINES[tp.icon] ? MINES[tp.icon].res : tp.icon)}" alt="">` : ''}${tp.title}</b>${tp.lines.map(l => '<div>' + l + '</div>').join('')}${tp.threat ? `<div class="thr" style="background:${tp.threat.c}">THREAT: ${tp.threat.t}</div>` : ''}`;
  el.style.display = 'block'; const r = $('view').getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
  el.style.left = Math.max(4, Math.min(r.width - w - 4, cx - r.left - w / 2)) + 'px'; el.style.top = Math.max(4, cy - r.top - hh - 18) + 'px';
  UI.tipT = 2.2;
}
// ---------- center-screen celebrations (non-blocking queue, ~1.5s each) ----------
const CELE_COL = {gold: ['#f8b800', '#fce4a0'], wood: ['#a0522d', '#d88850'], ore: ['#9c9c9c', '#e0e0e0'], gems: ['#d858f8', '#fcb8fc'], art: ['#fcfcfc', '#f8b800'], xp: ['#3cbcfc', '#a8e4fc']};
const JINGLE = {gold: [784, 988, 1175, 1568], wood: [392, 523, 659], ore: [330, 440, 554, 659], gems: [880, 1109, 1319, 1760], art: [523, 659, 784, 1047, 1319], xp: [440, 554, 659, 880]};
function celebrate(kind, text, sub) { UI.celeQ = UI.celeQ || []; UI.celeQ.push({kind, text, sub}); if (!UI.cele) nextCele(); }
function nextCele() {
  const el = $('cele'), c = UI.celeQ.shift(); if (!c) { UI.cele = null; el.style.display = 'none'; return; }
  UI.cele = {t: 0, c}; UI.celeLog = (UI.celeLog || []).concat(c.text);
  const [a, b] = CELE_COL[c.kind] || CELE_COL.gold, icon = RES.includes(c.kind) ? `<img src="${resImg(c.kind)}" alt="">` : '';
  let parts = ''; for (let i = 0; i < 18; i++) { const ang = i / 18 * Math.PI * 2, d = 70 + (i % 3) * 30; parts += `<i class="${c.kind === 'gold' ? 'coin' : 'spk'}" style="--dx:${Math.round(Math.cos(ang) * d)}px;--dy:${Math.round(Math.sin(ang) * d)}px;background:${i % 2 ? a : b};animation-delay:${(i % 4) * 0.05}s"></i>`; }
  el.innerHTML = `<div class="cbox" style="--a:${a}">${icon}<b>${c.text}</b>${c.sub ? '<small>' + c.sub + '</small>' : ''}</div>${parts}`;
  el.style.display = 'flex'; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  tune(JINGLE[c.kind] || JINGLE.gold, 70);
}
function celeTick(dt) { if (UI.cele && (UI.cele.t += dt) >= 1.5) nextCele(); if (UI.tipT > 0 && (UI.tipT -= dt) <= 0) $('tip').style.display = 'none'; }
// ---------- marketplace bulk trade ----------
const MKT0 = {wood: {buy: 250, sell: 50}, ore: {buy: 250, sell: 50}, gems: {buy: 500, sell: 100}};
const MKT = new Proxy({}, {get: (o, r) => { const b = MKT0[r]; if (!b) return undefined; const dw = facOf('player') === 'dwarf', tc = techSum('player', 'mkt') > 0; return {buy: Math.round(b.buy * (dw ? 0.8 : 1) * (tc ? 0.85 : 1)), sell: Math.round(b.sell * (dw ? 1.5 : 1) * (tc ? 1.5 : 1))}; }});
const mktMax = (r, m) => m === 'buy' ? Math.floor(G.res.player.gold / MKT[r].buy) : G.res.player[r];
function mktState(r) { UI.mkt = UI.mkt || {}; return UI.mkt[r] || (UI.mkt[r] = {m: 'buy', q: 1}); }
function mktClamp(r) { const s = mktState(r), mx = mktMax(r, s.m); s.q = Math.max(0, Math.min(mx, s.q | 0)); if (s.q === 0 && mx > 0) s.q = 1; return s; }
function tradeBulk(r) { const s = mktClamp(r), R = G.res.player, n = s.q; if (!n) return 0;
  if (s.m === 'buy') { R.gold -= n * MKT[r].buy; R[r] += n; } else { R[r] -= n; R.gold += n * MKT[r].sell; } return n; }
function marketHtml() {
  return `<h3>MARKETPLACE</h3>` + ['wood', 'ore', 'gems'].map(r => { const s = mktClamp(r), R = G.res.player, mx = mktMax(r, s.m), M = MKT[r], buy = s.m === 'buy';
    const after = buy ? `${R.gold - s.q * M.buy} gold, ${R[r] + s.q} ${r}` : `${R.gold + s.q * M.sell} gold, ${R[r] - s.q} ${r}`;
    return `<div class="mkt"><div class="bar"><img src="${resImg(r)}" alt=""><b>${r.toUpperCase()}</b> (have ${R[r]}) ${btn('BUY', 'mmode', r + ':buy', buy ? 'y' : 'alt')}${btn('SELL', 'mmode', r + ':sell', buy ? 'alt' : 'y')}<small>Rate: buy 1 = ${M.buy}g · sell 1 = ${M.sell}g</small></div>
      <div class="bar">${btn('-', 'mq', r + ':-1')}<input type="range" min="0" max="${mx}" value="${s.q}" data-r="${r}" class="mrange"${mx ? '' : ' disabled'}>${btn('+', 'mq', r + ':1')}${btn('x1', 'mset', r + ':1')}${btn('x5', 'mset', r + ':5')}${btn('x10', 'mset', r + ':10')}${btn('MAX', 'mset', r + ':max')}</div>
      <div class="bar"><span class="mprev">${buy ? 'Buy' : 'Sell'} <b class="hl">${s.q}</b> ${r} ${buy ? 'for ' : 'for +'}<b class="hl">${s.q * (buy ? M.buy : M.sell)}</b> gold → you will have ${after}</span>${btn(buy ? 'BUY ' + s.q : 'SELL ' + s.q, 'mdo', r, 'g', !s.q)}</div></div>`; }).join('');
}
const resBar = () => { const inc = income('player'); return `<div class="tres">${RES.map(k => `<span><img src="${resImg(k)}" alt="${k}"><b>${G.res.player[k]}</b><small>+${inc[k]}/day</small></span>`).join('')}</div>`; };
// formation presets explained
const FORM_INFO = {
  line:   {d: 'Melee in front, shooters behind, spread over all rows.', good: 'Good all-round; covers every lane.', g: ['.M', 'RM', '.M', 'RM', '.M']},
  wedge:  {d: 'One strong melee tip in the middle, the rest close behind.', good: 'Good for rushing enemy shooters.', g: ['..', 'M.', 'RM', 'M.', '..']},
  turtle: {d: 'Tight block: melee walls around shooters in the center.', good: 'Good vs fast melee; allies stay adjacent (Shield Wall).', g: ['M.', 'RM', 'RM', 'RM', 'M.']},
};
const formDiagram = f => `<span class="fdia">${FORM_INFO[f].g.map(row => row.split('').map(c => `<i class="${c === 'M' ? 'm' : c === 'R' ? 'r' : ''}"></i>`).join('')).join('<br>')}</span>`;

// ---------- floating text & battle timeline (all driven by elapsed seconds) ----------
function fx(u, text, col, delay = 0) { UI.fx.push({x: u.x, y: u.y, text, col, t: -delay, life: 1.1}); }
function later(at, fn) { B.ev.push({at, fn}); B.ev.sort((a, b) => a.at - b.at); }

// ---------- view, camera, zoom ----------
let WW = MW * TS, WH = MH * TS;
const world = document.createElement('canvas'); world.width = WW; world.height = WH; const wctx = world.getContext('2d');
const bcv = document.createElement('canvas'); bcv.width = BLW; bcv.height = BLH; const bctx = bcv.getContext('2d');
const CAM = {x: 0, y: 0, z: 0, dpr: 1, w: 1, h: 1, target: null};
let layers = null, clock = 0, BV = {s: 1, ox: 0, oy: 0};
function fitCanvas() {
  const dpr = Math.min(3, window.devicePixelRatio || 1), r = $('view').getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  CAM.dpr = dpr; CAM.w = w; CAM.h = h;
  if (!CAM.z) { CAM.z = clampZoom(Math.max(Math.round((matchMedia('(pointer:coarse)').matches ? 44 : 40) * dpr / TS), Math.ceil(Math.max(w / WW, h / WH)))); const h0 = G && curHero(); if (h0) centerOn(h0.x, h0.y, true); }
  CAM.z = clampZoom(CAM.z);
}
const zoomRange = () => [Math.max(1, Math.floor(Math.min(CAM.w / WW, CAM.h / WH))), Math.max(2, Math.round(96 * CAM.dpr / TS))];
function clampZoom(z) { const [a, b] = zoomRange(); return Math.max(a, Math.min(b, Math.round(z))); }
function clampCam() {
  const vw = CAM.w / CAM.z, vh = CAM.h / CAM.z;
  CAM.x = vw >= WW ? (WW - vw) / 2 : Math.max(0, Math.min(WW - vw, CAM.x));
  CAM.y = vh >= WH ? (WH - vh) / 2 : Math.max(0, Math.min(WH - vh, CAM.y));
}
function centerOn(x, y, snap) {
  const t = {x: x * TS + TS / 2 - CAM.w / CAM.z / 2, y: y * TS + TS / 2 - CAM.h / CAM.z / 2};
  if (snap) { CAM.x = t.x; CAM.y = t.y; CAM.target = null; clampCam(); } else CAM.target = t;
}
function setZoom(z, sx = CAM.w / 2, sy = CAM.h / 2) {
  const nz = clampZoom(z); if (nz === CAM.z) return;
  const wx = CAM.x + sx / CAM.z, wy = CAM.y + sy / CAM.z;
  CAM.z = nz; CAM.x = wx - sx / nz; CAM.y = wy - sy / nz; CAM.target = null; clampCam();
}

// ---------- adventure map rendering (drawn at 16px/tile, then scaled by an integer zoom) ----------
function ensureLayers() {
  if (!layers || layers.map !== G.map) { WW = MW * TS; WH = MH * TS; world.width = WW; world.height = WH; $('mini').width = MW * 4; $('mini').height = MH * 4; }
  if (!layers || layers.map !== G.map) layers = {map: G.map, land: SPR.landLayer(G.map), water: [0, 1, 2, 3].map(f => SPR.waterLayer(G.map, f)), fog: document.createElement('canvas'), fogN: -1};
  const n = G.fog.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0);
  if (n !== layers.fogN) { layers.fogN = n; drawFog(layers.fog); }
}
function drawFog(c) {
  c.width = WW; c.height = WH; const g = c.getContext('2d'); g.fillStyle = '#05050c';
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!G.fog[y][x]) { g.fillRect(x * TS, y * TS, TS, TS); continue; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || G.fog[ny][nx]) continue;
      for (let i = 0; i < TS; i++) for (let d = 0; d < 4; d++) if ((i + d) % 2 === 0 && (d < 2 || (i + d) % 4 === 0)) {
        g.fillRect(dx === 1 ? x * TS + TS - 1 - d : dx === -1 ? x * TS + d : x * TS + i, dy === 1 ? y * TS + TS - 1 - d : dy === -1 ? y * TS + d : y * TS + i, 1, 1);
      }
    }
  }
}
const rp = h => UI.rpos[h.id] || (UI.rpos[h.id] = {x: h.x, y: h.y, face: 1, moving: 0});
const spark = (g, x, y) => { g.fillStyle = '#fcfcfc'; g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); };
function drawObj(g, o) {
  const X = o.x * TS, Y = o.y * TS, f = Math.floor(clock * 4 + o.id);
  if (o.kind === 'res') { g.drawImage(SPR.pile(o.res), X, Y); if (o.res !== 'wood' && f % 9 === 0) spark(g, X + 4 + o.id % 8, Y + 7); }
  else if (o.kind === 'chest') { g.drawImage(SPR.chest(), X, Y); if (f % 7 === 0) spark(g, X + 12, Y + 5); }
  else if (o.kind === 'art') g.drawImage(SPR.artifact(f % 3), X, Y - Math.round(Math.sin(clock * 3 + o.id) * 1.5));
  else if (o.kind === 'mine') g.drawImage(SPR.mine(o.mine, o.owner, Math.floor(clock * 4) % 2), X - 4, Y - 10);
  else if (o.kind === 'grove') g.drawImage(SPR.grove(o.owner, Math.floor(clock * 3) % 2), X - 4, Y - 10);
  else if (o.kind === 'monster' && o.army.length) { const th = threatOf(o.army); g.fillStyle = th.c + '90'; g.fillRect(X + 1, Y + 12, 14, 3); g.fillRect(X + 3, Y + 15, 10, 1); g.fillStyle = '#000'; g.fillRect(X + 9, Y - 12, 9, 6); g.fillStyle = th.c; g.fillRect(X + 10, Y - 11, 7, 4); g.fillStyle = '#000'; g.fillRect(X + 12, Y - 10, 3, 2); }
  if (o.kind === 'monster' && o.army.length) g.drawImage(SPR.unit(o.army[0].type, Math.floor(clock * 2 + o.id * 0.37) % 2, true), X - 4, Y - 9);
}
function renderWorld() {
  ensureLayers();
  const g = wctx, sel = curHero(); g.imageSmoothingEnabled = false;
  g.drawImage(layers.water[Math.floor(clock * 3) % 4], 0, 0); g.drawImage(layers.land, 0, 0);
  if (UI.preview && sel) UI.preview.path.forEach(([x, y], i) => {
    const ok = UI.preview.cost[i] <= sel.mp, last = i === UI.preview.path.length - 1, X = x * TS, Y = y * TS, c = ok ? '#58d854' : '#e40058';
    g.fillStyle = '#000';
    if (last) { for (let k = 0; k < 6; k++) { g.fillRect(X + 4 + k, Y + 4 + k, 3, 3); g.fillRect(X + 9 - k, Y + 4 + k, 3, 3); } g.fillStyle = c; for (let k = 0; k < 6; k++) { g.fillRect(X + 5 + k, Y + 5 + k, 1, 1); g.fillRect(X + 10 - k, Y + 5 + k, 1, 1); } }
    else { const pulse = (Math.floor(clock * 10) - i) % 6 === 0 ? 1 : 0; g.fillRect(X + 6 - pulse, Y + 6 - pulse, 4 + pulse * 2, 4 + pulse * 2); g.fillStyle = c; g.fillRect(X + 7 - pulse, Y + 7 - pulse, 2 + pulse * 2, 2 + pulse * 2); }
  });
  if (sel && UI.mode === 'map') {
    const p = rp(sel), X = Math.round(p.x * TS), Y = Math.round(p.y * TS), k = Math.floor(clock * 3) % 2;
    g.fillStyle = '#f8b800';
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [TS - 1, 0, -1, 1], [0, TS - 1, 1, -1], [TS - 1, TS - 1, -1, -1]]) { g.fillRect(X + cx - k * sx + Math.min(0, sx * 3), Y + cy - k * sy, 4, 1); g.fillRect(X + cx - k * sx, Y + cy - k * sy + Math.min(0, sy * 3), 1, 4); }
  }
  const items = [];
  G.objs.forEach(o => items.push([o.y, () => drawObj(g, o)]));
  G.towns.forEach(t => items.push([t.y + 0.1, () => g.drawImage(SPR.town(t.faction, t.owner, Math.floor(clock * 4) % 2), t.x * TS - 10, t.y * TS - 18)]));
  G.heroes.forEach(h => items.push([rp(h).y + 0.2, () => { const p = rp(h), f = p.moving > 0.02 ? 1 + Math.floor(clock * 8) % 2 : 0; g.drawImage(SPR.hero(h.owner, f, p.face < 0), Math.round(p.x * TS) - 2, Math.round(p.y * TS) - 6); }]));
  items.sort((a, b) => a[0] - b[0]).forEach(i => i[1]());
  const tt = tutTile();
  if (tt) { const k = Math.floor(clock * 4) % 2; g.strokeStyle = k ? '#f8b800' : '#fcfcfc'; g.lineWidth = 1; g.strokeRect(tt[0] * TS - 1.5 - k, tt[1] * TS - 1.5 - k, TS + 3 + 2 * k, TS + 3 + 2 * k); }
  g.drawImage(layers.fog, 0, 0);
}
function renderMapScreen() {
  renderWorld(); clampCam();
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#05050c'; ctx.fillRect(0, 0, CAM.w, CAM.h);
  ctx.drawImage(world, Math.round(-CAM.x * CAM.z), Math.round(-CAM.y * CAM.z), WW * CAM.z, WH * CAM.z);
}
let miniT = 0;
function renderMini(dt) {
  if ((miniT -= dt) > 0 || !G) return; miniT = 0.2;
  const m = $('mini'); if (!m.offsetParent) return;
  const g = m.getContext('2d'), s = 4;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { g.fillStyle = G.fog[y][x] ? TERRAIN[G.map[y][x]].col : '#000'; g.fillRect(x * s, y * s, s, s); }
  const dot = (x, y, c, n = 2) => { if (!G.fog[y][x]) return; g.fillStyle = c; g.fillRect(x * s + (s - n) / 2, y * s + (s - n) / 2, n, n); };
  G.objs.forEach(o => o.kind === 'mine' || o.kind === 'grove' ? dot(o.x, o.y, ownerCol(o.owner), 4) : o.kind === 'monster' ? dot(o.x, o.y, '#fc7460') : dot(o.x, o.y, '#f8b800'));
  G.towns.forEach(t => { g.fillStyle = '#000'; g.fillRect(t.x * s - 3, t.y * s - 3, 10, 10); g.fillStyle = ownerCol(t.owner); g.fillRect(t.x * s - 2, t.y * s - 2, 8, 8); });
  G.heroes.forEach(h => dot(h.x, h.y, h.owner === 'player' ? '#fcfcfc' : '#e40058', 4));
  g.strokeStyle = '#f8b800'; g.lineWidth = 1; g.strokeRect(CAM.x / TS * s + 0.5, CAM.y / TS * s + 0.5, CAM.w / CAM.z / TS * s - 1, CAM.h / CAM.z / TS * s - 1);
}

// ---------- battle rendering (256x202 logical canvas, integer scaled) ----------
function txt(g, s, x, y, col, align = 'center') { g.font = '8px PS2P, monospace'; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y); }
function smallTxt(g, s, x, y, col, align) { g.save(); g.translate(x, y); g.scale(0.62, 0.62); txt(g, s, 0, 0, col, align); g.restore(); }
function dotLine(g, x0, y0, x1, y1, col) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
const cellC = (x, y) => [BOX + x * CW + CW / 2, BOY + y * CW + CW / 2];
function drawBattle(g) {
  g.imageSmoothingEnabled = false;
  g.drawImage(SPR.field(BLW, BLH, CW, B.seed), 0, 0);
  g.fillStyle = '#10102a'; g.fillRect(0, 0, BLW, BOY - 3); g.fillStyle = '#000'; g.fillRect(0, BOY - 3, BLW, 2);
  txt(g, B.phase === 'pre' ? 'PRE-BATTLE' : 'ROUND ' + (B.phase === 'plan' ? B.round : B.round - 1) + ' - ' + (B.phase === 'plan' ? 'PLAN' : 'RESOLVE'), BLW / 2, 10, B.phase === 'resolve' ? '#58d854' : '#f8b800');
  const hl = heroOf('L'), hr = heroOf('R');
  txt(g, hl ? hl.name + ' ' + hl.mana + 'MP' : 'GARRISON', 3, 20, '#3cbcfc', 'left');
  txt(g, hr ? hr.name : (B.sides.R.monster ? 'NEUTRALS' : 'GARRISON'), BLW - 3, 20, '#e40058', 'right');
  const tl = s => { const t = B.tac[s].tactic; if (s === 'R' && B.tac.L.intel < 2) return '???'; return t ? TACTICS[t].name.toUpperCase() + (blunted(s) ? '-X' : '') : '-'; };
  smallTxt(g, tl('L'), 3, 8, blunted('L') ? '#888' : '#f8b800', 'left'); smallTxt(g, tl('R'), BLW - 3, 8, blunted('R') ? '#888' : '#f8b800', 'right');
  g.fillStyle = '#00000030';
  for (let x = 0; x <= BW; x++) g.fillRect(BOX + x * CW, BOY, 1, BH * CW);
  for (let y = 0; y <= BH; y++) g.fillRect(BOX, BOY + y * CW, BW * CW, 1);
  const selU = B.sel && uById(B.sel), r = selU && B.phase === 'plan' ? reach(selU, moveOf(selU)) : null;
  if (r) { g.fillStyle = '#fcfc5438'; for (const c of r.values()) if (c.d) g.fillRect(BOX + c.x * CW + 1, BOY + c.y * CW + 1, CW - 1, CW - 1); }
  const seeTerr = t => t.side === 'L' || B.phase !== 'pre' || B.tac.L.intel >= 2, fr = Math.floor(clock * 2) % 2;
  for (const key in B.terr) { const t = B.terr[key], [x, y] = key.split(',').map(Number); if (t.k !== 'fog' && seeTerr(t)) g.drawImage(SPR.terr(t.k, fr), BOX + x * CW, BOY + y * CW); }
  if (B.phase === 'pre') {
    const a = 0.16 + 0.08 * Math.sin(clock * 4); g.fillStyle = `rgba(60,188,252,${a})`;
    for (const x of deployCols('L')) for (let y = 0; y < BH; y++) if (inDeploy('L', x, y)) g.fillRect(BOX + x * CW + 1, BOY + y * CW + 1, CW - 1, CW - 1);
    g.fillStyle = '#000a'; g.fillRect(BOX, BOY + BH * CW - 9, CW * 2, 9); smallTxt(g, 'YOUR DEPLOY', BOX + CW, BOY + BH * CW - 2, '#3cbcfc', 'center');
    if (UI.preTerr) { g.fillStyle = '#d858f820'; g.fillRect(BOX, BOY, BW * CW, BH * CW); }
    const su = UI.preSel && uById(UI.preSel); if (su) { g.strokeStyle = '#f8b800'; g.lineWidth = 1; g.strokeRect(BOX + su.x * CW + 0.5, BOY + su.y * CW + 0.5, CW - 1, CW - 1); }
  }
  for (const k of B.obst) { const [x, y] = k.split(',').map(Number); g.drawImage(SPR.boulder(), BOX + x * CW, BOY + y * CW); }
  if (B.siege) {
    const S = B.siege, necro = ['necro', 'inferno', 'dwarf'].includes(B.ctx.def.town.faction);
    for (let y = 0; y < BH; y++) {
      const c = S.cells[y], X = BOX + S.x * CW, Y = BOY + y * CW;
      if (c.kind === 'tower') { const sh = S.shots.some(s => s.y === y && B.clock >= s.at && B.clock < s.at + 0.25); g.drawImage(SPR.tower(necro, sh ? 1 : 0), X, Y - 12); continue; }
      g.drawImage(SPR.wall(c.kind, c.shown <= 0 ? 2 : c.shown < c.max ? 1 : 0, necro), X, Y);
      if (c.shown > 0) { g.fillStyle = '#000'; g.fillRect(X + 4, Y + CW - 3, 16, 3); g.fillStyle = '#58d854'; g.fillRect(X + 5, Y + CW - 2, Math.round(14 * c.shown / c.max), 1); }
    }
    const fired = S.fire.some(t => B.clock >= t && B.clock < t + 0.3), cimg = SPR.catapult(fired ? 1 : 0);
    g.drawImage(S.att === 'L' ? cimg : SPR.flip(cimg), BOX + S.cat.x * CW, BOY + S.cat.y * CW);
    if (B.phase === 'plan' && S.att === 'L' && wallIntact(S.target)) { const k = Math.floor(clock * 4) % 2, [cx, cy] = cellC(S.x, S.target); g.fillStyle = k ? '#f8b800' : '#e40058'; g.fillRect(cx - 7, cy, 5, 1); g.fillRect(cx + 3, cy, 5, 1); g.fillRect(cx, cy - 7, 1, 5); g.fillRect(cx, cy + 3, 1, 5); }
  }
  if (B.phase === 'plan') {
    for (const id in B.plans) {
      const u = uById(id), p = B.plans[id]; if (!u || u.side !== 'L' || p.t === 'def') continue;
      const t = p.t === 'atk' ? uById(p.target) : p; if (!t) continue;
      const [x0, y0] = cellC(u.x, u.y), [x1, y1] = cellC(t.x, t.y); dotLine(g, x0, y0, x1, y1, p.t === 'atk' ? '#e40058' : '#58d854');
    }
  }
  const vis = B.units.filter(u => !u.gone && !(u.hidden && u.side === 'R') && (u.alive || u.deadAt == null || B.clock < u.deadAt + 0.6)).sort((a, b) => a.ry - b.ry);
  for (const u of vis) {
    let X = BOX + u.rx * CW, Y = BOY + u.ry * CW - 4, f = Math.floor(clock * 2 + u.ph) % 2, flash = false;
    for (const a of u.atk) { const k = (B.clock - a.at) / 0.3; if (k >= 0 && k <= 1) { f = 2; X += a.dx * Math.sin(k * Math.PI) * 7; Y += a.dy * Math.sin(k * Math.PI) * 7; } }
    for (const h of u.hit) { const k = B.clock - h; if (k >= 0 && k < 0.22) { flash = Math.floor(k * 20) % 2 === 0; X += Math.floor(k * 40) % 2 ? 1 : -1; } }
    const dying = u.deadAt != null && B.clock >= u.deadAt;
    if (dying) { const k = Math.min(1, (B.clock - u.deadAt) / 0.6); g.globalAlpha = 1 - k; Y += k * 6; }
    else if (u.hidden) g.globalAlpha = 0.45 + 0.1 * Math.sin(clock * 5);
    g.fillStyle = '#00000050'; g.fillRect(Math.round(X) + 5, BOY + u.ry * CW + 19, 14, 2); g.fillRect(Math.round(X) + 7, BOY + u.ry * CW + 21, 10, 1);
    g.drawImage((flash ? SPR.unitFlash : SPR.unit)(u.type, f, u.side === 'R'), Math.round(X), Math.round(Y));
    g.globalAlpha = 1;
    if (!dying) {
      const s = u.side === 'R' && !(B.tac.L.intel >= 1) ? rough(u.shown) : String(u.shown), w = s.length * 6 + 3, bx = Math.round(X) + (u.side === 'L' ? CW - w : 0), by = BOY + u.ry * CW + CW - 8;
      g.fillStyle = '#000'; g.fillRect(bx, by, w, 9); g.fillStyle = u.side === 'L' ? '#2050c0' : '#a00030'; g.fillRect(bx + 1, by + 1, w - 2, 7);
      g.font = '8px PS2P, monospace'; g.textAlign = 'left'; g.fillStyle = '#fcfcfc'; g.save(); g.translate(bx + 2, by + 8); g.scale(0.75, 0.875); g.fillText(s, 0, 0); g.restore();
      if (B.phase === 'plan' && B.plans[u.id] && B.plans[u.id].t === 'def' && u.side === 'L') { g.fillStyle = '#000'; g.fillRect(X + 1, Y + 3, 7, 8); g.fillStyle = '#f8b800'; g.fillRect(X + 2, Y + 4, 5, 5); g.fillRect(X + 3, Y + 9, 3, 1); }
    }
  }
  for (const p of B.proj) {
    const k = (B.clock - p.at) / p.dur; if (k < 0 || k > 1) continue;
    const [x0, y0] = cellC(p.fx, p.fy), [x1, y1] = cellC(p.tx, p.ty), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * (p.arc || 14) - 4;
    if (p.kind === 'arrow') { const a = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * 14 * Math.PI, x1 - x0); for (let i = 0; i < 9; i++) { g.fillStyle = i < 2 ? '#fcfcfc' : i > 6 ? '#e40058' : '#c8a060'; g.fillRect(Math.round(x - Math.cos(a) * i), Math.round(y - Math.sin(a) * i), i < 2 ? 2 : 1, i < 2 ? 2 : 1); } }
    else if (p.kind === 'boulder') { g.fillStyle = '#000'; g.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); g.fillStyle = '#8c8c8c'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); g.fillStyle = '#c8c8c8'; g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 1); }
    else { g.fillStyle = '#000'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); g.fillStyle = p.col; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); g.fillStyle = '#fcfcfc'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  for (const key in B.terr) { const t = B.terr[key], [x, y] = key.split(',').map(Number); if (t.k === 'fog' && seeTerr(t)) { g.globalAlpha = 0.42; g.drawImage(SPR.terr('fog', fr), BOX + x * CW, BOY + y * CW); g.globalAlpha = 1; } }
  for (const e of B.eff) drawSpellFx(g, e);
  for (const f of UI.fx) if (f.t >= 0) { const [x, y] = cellC(f.x, f.y); txt(g, f.text, x, y - 10 - Math.round(f.t * 16), f.col); }
  if (B.phase === 'plan') {
    const s = B.spell.L && uById(B.spell.L.target);
    if (s) { const k = Math.floor(clock * 4) % 2; g.strokeStyle = '#d858f8'; g.lineWidth = 1; g.strokeRect(BOX + s.x * CW + 1.5 - k, BOY + s.y * CW + 1.5 - k, CW - 3 + k * 2, CW - 3 + k * 2); }
    if (selU) { const k = Math.floor(clock * 4) % 2; g.fillStyle = '#f8b800'; const X = BOX + selU.x * CW, Y = BOY + selU.y * CW; for (const [cx, cy] of [[0, 0], [CW - 5, 0], [0, CW - 1], [CW - 5, CW - 1]]) g.fillRect(X + cx - k + (cx ? 2 * k : 0), Y + cy, 5, 1); for (const [cx, cy] of [[0, 0], [CW - 1, 0], [0, CW - 5], [CW - 1, CW - 5]]) g.fillRect(X + cx, Y + cy - k + (cy ? 2 * k : 0), 1, 5); }
  }
}
function drawSpellFx(g, e) {
  const k = (B.clock - e.at) / 0.6; if (k < 0 || k > 1) return;
  const [x, y] = cellC(e.tx, e.ty);
  if (e.k === 'arrow') { const sx = e.side === 'L' ? 0 : BLW, px = sx + (x - sx) * Math.min(1, k * 1.6), py = BOY + (y - BOY) * Math.min(1, k * 1.6); g.fillStyle = '#d858f8'; g.fillRect(px - 2, py - 2, 5, 5); g.fillStyle = '#fcfcfc'; g.fillRect(px - 1, py - 1, 3, 3); if (k > 0.6) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = (k - 0.6) * 30; g.fillStyle = '#d858f8'; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2); } }
  if (e.k === 'lightning' && k < 0.7) { let lx = x + 6, ly = 0; g.fillStyle = Math.floor(k * 20) % 2 ? '#fcfcfc' : '#fcfc54'; while (ly < y) { const nx = lx + (((ly * 7) % 9) - 4), ny = ly + 6; dotLine(g, lx, ly, nx, ny, g.fillStyle); lx = nx; ly = ny; } }
  if (e.k === 'cure') for (let i = 0; i < 6; i++) { const px = x - 9 + i * 4, py = y + 8 - k * 24 - (i % 3) * 4; g.fillStyle = '#58d854'; g.fillRect(px, py - 1, 1, 3); g.fillRect(px - 1, py, 3, 1); }
  if (e.k === 'haste') for (let i = 0; i < 4; i++) { g.fillStyle = '#3cbcfc'; g.fillRect(x - 14 + ((k * 40 + i * 9) % 28), y - 8 + i * 5, 6, 1); }
  if (e.k === 'slow') { const r = Math.round(14 * (1 - k)) + 3; g.strokeStyle = '#f8b800'; g.lineWidth = 1; g.strokeRect(x - r + 0.5, y - r + 0.5, r * 2, r * 2); }
}
function renderBattleScreen() {
  drawBattle(bctx);
  const pe = $('pre'), pre = B.phase === 'pre' && pe.style.display !== 'none', wide = pre && innerWidth >= 900, pw = wide ? pe.offsetWidth * CAM.dpr : 0, ph = pre && !wide ? pe.offsetHeight * CAM.dpr : 0;
  const aw = CAM.w - pw, ah = CAM.h - ph, s = Math.max(1, Math.floor(Math.min(aw / BLW, ah / BLH)));
  BV = {s, ox: Math.floor((aw - BLW * s) / 2), oy: Math.max(0, Math.floor((ah - BLH * s) / 2))};
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#10101e'; ctx.fillRect(0, 0, CAM.w, CAM.h);
  ctx.drawImage(bcv, BV.ox, BV.oy, BLW * s, BLH * s);
}
function renderTitle() {
  const g = bctx; g.imageSmoothingEnabled = false;
  g.drawImage(SPR.field(BLW, BLH, CW, 99), 0, 0);
  for (let y = 0; y < 90; y++) { g.fillStyle = `rgb(${20 + y / 3},${20 + y / 2},${60 + y})`; g.fillRect(0, y, BLW, 1); }
  for (let i = 0; i < 30; i++) { if ((Math.floor(clock * 2) + i) % 5) { g.fillStyle = '#fcfcfc'; g.fillRect((i * 53) % BLW, (i * 29) % 80, 1, 1); } }
  const fi = Math.floor(Math.max(0, clock) / 4) % FACTION_KEYS.length, fa = FACTION_KEYS[fi], fb = FACTION_KEYS[(fi + 1) % FACTION_KEYS.length];
  g.drawImage(SPR.town(fa, 'player', Math.floor(clock * 4) % 2), 20, 64); g.drawImage(SPR.town(fb, 'ai', Math.floor(clock * 4) % 2), BLW - 56, 64);
  [0, 2, 4, 6].map(i => FACTIONS[fa].units[i]).forEach((u, i) => g.drawImage(SPR.unit(u, Math.floor(clock * 2 + i * 0.5) % 2, false), 6 + i * 26, 118 + (i % 2) * 14));
  [0, 2, 4, 6].map(i => FACTIONS[fb].units[i]).forEach((u, i) => g.drawImage(SPR.unit(u, Math.floor(clock * 2 + i * 0.5) % 2, true), BLW - 30 - i * 26, 118 + (i % 2) * 14));
  txt(g, FACTIONS[fa].name.toUpperCase() + ' VS ' + FACTIONS[fb].name.toUpperCase(), BLW / 2, 112, '#fcfcfc');
  txt(g, 'MINI HEROES', BLW / 2, 40, '#f8b800'); txt(g, 'MIGHT, MAGIC & PLANS', BLW / 2, 54, '#3cbcfc');
  const s = Math.max(1, Math.floor(Math.min(CAM.w / BLW, CAM.h / BLH)));
  BV = {s, ox: Math.floor((CAM.w - BLW * s) / 2), oy: Math.floor((CAM.h - BLH * s) / 2)};
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#0f0f1b'; ctx.fillRect(0, 0, CAM.w, CAM.h); ctx.drawImage(bcv, BV.ox, BV.oy, BLW * s, BLH * s);
}
const ownerCol = o => o === 'player' ? '#3cbcfc' : o === 'ai' ? '#e40058' : '#a8a8a8';

// ---------- HUD (top resources, side panel on desktop, hero chip on phones) ----------
const imgCache = {};
const imgURL = (k, f) => imgCache[k] || (imgCache[k] = f().toDataURL());
const unitImg = t => imgURL('u' + t, () => SPR.unit(t, 0, false));
const portraitImg = h => imgURL('p' + h.name, () => SPR.portrait(h.name, h.owner));
const resImg = r => imgURL('r' + r, () => SPR.pile(r));
let hudSig = '';
function meter(v, m, c) { return `<div class="meter"><i style="width:${Math.max(0, Math.min(100, v / Math.max(1, m) * 100))}%;background:${c}"></i></div>`; }
function updateHud() {
  if (!G) return;
  const h = curHero(), r = G.res.player;
  const sig = JSON.stringify([G.rs && G.rs.player, r, G.day, h && [h.id, h.mp, h.mana, h.lvl, h.xp, h.att, h.def, h.sp, h.kn, h.army, h.arts.length, h.sk], G.kg && G.kg.player.slots, myHeroes().map(x => x.id + x.name), G.towns.map(t => t.owner), UI.mode]);
  if (sig === hudSig) return; hudSig = sig;
  const inc = income('player');
  $('res').innerHTML = RES.map(k => `<span title="${k} +${inc[k]}/day"><img src="${resImg(k)}" alt="${k}"><b>${r[k]}</b></span>`).join('');
  $('pol').innerHTML = policyIcons('player');
  const R = RS('player'), tb = document.querySelector('[data-a=tech]'); if (tb && R) tb.textContent = 'TECH' + (R.pts ? ' (' + R.pts + ')' : '');
  $('cal').textContent = 'DAY ' + ((G.day - 1) % 7 + 1) + ' WEEK ' + (Math.floor((G.day - 1) / 7) % 4 + 1) + ' MONTH ' + (Math.floor((G.day - 1) / 28) + 1);
  $('chip').innerHTML = h ? `<img src="${portraitImg(h)}" alt=""><div class="bars"><b>${h.name} LV${h.lvl}</b>MOVE ${meter(h.mp, maxMp(h), '#58d854')}MANA ${meter(h.mana, maxMana(h), '#3cbcfc')}</div>` : '<b>NO HERO</b>';
  $('sideinfo').innerHTML = h ? `<div class="hcard"><img src="${portraitImg(h)}" alt="" data-a="hero"><div><b>${h.name}</b><br>LEVEL ${h.lvl}<br>XP ${h.xp}/${xpForLevel(h.lvl)}${meter(h.xp, xpForLevel(h.lvl), '#f8b800')}</div></div>
    ${RS('player') && facOf('player') ? `<div class="rpbar">${FACTIONS[facOf('player')].name.toUpperCase()} RESEARCH: <b>${RS('player').pts}</b> pt · ${Math.round(RS('player').prog * 100)}% ${meter(RS('player').prog, 1, FACTIONS[facOf('player')].col)}</div>` : ''}
    <div class="stats"><div>ATK<b>${stat(h, 'att')}</b></div><div>DEF<b>${stat(h, 'def')}</b></div><div>POW<b>${stat(h, 'sp')}</b></div><div>KNO<b>${stat(h, 'kn')}</b></div></div>
    <div>MOVE ${h.mp}/${maxMp(h)} ${meter(h.mp, maxMp(h), '#58d854')}MANA ${h.mana}/${maxMana(h)} ${meter(h.mana, maxMana(h), '#3cbcfc')}</div>
    <div class="slots">${Array.from({length: MAX_STACKS}, (_, i) => { const a = h.army[i]; return `<div class="slot" title="${a ? a.count + ' ' + a.type : ''}">${a ? `<img src="${unitImg(a.type)}" alt=""><s>${a.count}</s>` : ''}</div>`; }).join('')}</div>
    <div class="skl">${Array.from({length: MAX_SKILLS}, (_, i) => { const k = Object.keys(h.sk)[i]; return k ? `<span title="${SKILL_LVL[h.sk[k]]} ${SKILLS[k].name}: ${SKILLS[k].desc(skl(h, k))}">${SKILLS[k].name.slice(0, 5).toUpperCase()}<i>${'I'.repeat(h.sk[k])}</i></span>` : '<span class="e">-</span>'; }).join('')}</div>
    ${h.arts.length ? '<div>ARTIFACTS: ' + h.arts.map(k => ARTIFACTS[k].name).join(', ') + '</div>' : ''}` : '<b>No hero. Hire one at a Tavern.</b>';
  $('sidelists').innerHTML = `<h4>HEROES</h4>${myHeroes().map(x => `<button class="btn ${x === h ? 'y' : 'alt'}" data-a="selhero" data-v="${x.id}">${x.name} LV${x.lvl} (${x.mp} MOVE)</button>`).join('') || '-'}
    <h4>TOWNS</h4>${G.towns.filter(t => t.owner === 'player').map(t => `<button class="btn alt" data-a="opentown" data-v="${t.id}">${t.name}</button>`).join('') || '-'}`;
}
function syncBars() {
  const b = UI.mode === 'battle';
  $('battlebar').style.display = b ? 'contents' : 'none';
  document.querySelectorAll('#battlebar .btn').forEach(e => e.disabled = !!(b && B && B.phase === 'pre' && e.dataset.a !== 'binfo'));
  $('mapbar').style.display = b ? 'none' : 'contents';
  $('zoom').style.display = b || UI.mode === 'title' ? 'none' : 'flex';
  $('chip').style.visibility = b || UI.mode === 'title' ? 'hidden' : 'visible';
  document.querySelectorAll('#mapbar .btn').forEach(e => e.disabled = UI.mode !== 'map');
}

// ---------- main loop (all timers use real elapsed time, so speed is frame-rate independent) ----------
let last = performance.now();
const STEP = 0.13;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
  fitCanvas();
  if (msgTimer > 0 && (msgTimer -= dt) <= 0 && UI.mode === 'map') $('msg').textContent = '';
  if (!UI.panel) {
    if (UI.walk && UI.mode === 'map') { UI.walk.t += dt; while (UI.walk && UI.walk.t >= STEP) { UI.walk.t -= STEP; walkStep(); } }
    if (UI.ai && UI.mode === 'aiturn') { UI.ai.t += dt; while (UI.ai && UI.mode === 'aiturn' && !UI.panel && UI.ai.t >= STEP * 0.7) { UI.ai.t -= STEP * 0.7; aiStep(); } }
    nextLevelUp();
  }
  if (B) { B.clock += dt; while (B && B.ev.length && B.ev[0].at <= B.clock) B.ev.shift().fn(); }
  if (B) for (const u of B.units) { const k = 1 - Math.exp(-dt * 9); u.rx += (u.gx - u.rx) * k; u.ry += (u.gy - u.ry) * k; }
  UI.fx = UI.fx.filter(f => (f.t += dt) < f.life);
  if (G) {
    const spd = dt / STEP * 1.05;
    for (const h of G.heroes) {
      const p = rp(h), dx = h.x - p.x, dy = h.y - p.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.01) p.face = Math.sign(dx);
      if (d > 3 || d <= spd) { p.x = h.x; p.y = h.y; } else { p.x += dx / d * spd; p.y += dy / d * spd; }
      p.moving = d;
    }
    const w = UI.walk && heroById(UI.walk.id), ah = UI.mode === 'aiturn' && UI.ai && heroById(UI.ai.queue[0]);
    if (w) centerOn(rp(w).x, rp(w).y);
    else if (ah && G.fog[ah.y][ah.x]) centerOn(rp(ah).x, rp(ah).y);
    if (CAM.target) { const k = 1 - Math.exp(-dt * 6); CAM.x += (CAM.target.x - CAM.x) * k; CAM.y += (CAM.target.y - CAM.y) * k; clampCam(); if (Math.abs(CAM.target.x - CAM.x) + Math.abs(CAM.target.y - CAM.y) < 0.5) CAM.target = null; }
  }
  if (UI.mode === 'title' || !G) renderTitle(); else if (UI.mode === 'battle' && B) renderBattleScreen(); else renderMapScreen();
  celeTick(dt); renderPre(); tutTick(); renderMini(dt); updateHud(); syncBars();
  requestAnimationFrame(loop);
}

// ---------- panels ----------
function showPanel(fn, opts = {}) {
  UI.panel = Object.assign({fn}, opts); const box = $('pbox');
  box.className = 'pbox' + (opts.full ? ' full' : ''); box.innerHTML = fn(); box.scrollTop = 0; $('panel').classList.add('show');
  if (opts.after) opts.after();
}
function refreshPanel() { if (!UI.panel) return; const box = $('pbox'), st = box.scrollTop; box.innerHTML = UI.panel.fn(); box.scrollTop = st; if (UI.panel.after) UI.panel.after(); }
function closePanel() {
  if (!UI.panel || UI.panel.sticky) return;
  const cb = UI.panel.onClose; UI.panel = null; $('panel').classList.remove('show');
  if (cb) cb();
}
const btn = (label, a, v, cls = 'alt', dis) => `<button class="btn sb ${cls}" data-a="${a}" data-v="${v ?? ''}" ${dis ? 'disabled' : ''}>${label}</button>`;
function openTown(t) {
  if (!t) return;
  showPanel(() => {
    const own = t.owner === 'player', h = heroAt(t.x, t.y), units = FACTIONS[t.faction].units, inc = income('player');
    const head = `<div class="thead"><h2>${t.name.toUpperCase()}</h2>${btn('CLOSE', 'close', '', 'g')}</div>${resBar()}<canvas class="tview" id="tview"></canvas>`;
    if (!own) return head + `<div class="cols"><p>Enemy ${FACTIONS[t.faction].name} town. Garrison: ${bandArmy(t.garrison)}</p>${canSeeEnemyKingdom() && KG(t.owner) ? `<p>Scouts report kingdom policies: ${KG(t.owner).slots.map(k => POLICIES[k].name).join(', ') || 'none'}</p>` : '<p>Learn Scouting to see their kingdom policies.</p>'}</div>`;
    let s = head + `<div class="cols"><div><p>Income per day: ${costText(inc) || '0'}${t.builtToday ? '<br><span class="no">Already built today</span>' : ''}</p><h3>BUILD</h3>`;
    for (const k in BUILDINGS) {
      if (t.built.includes(k)) continue;
      const b = BUILDINGS[k]; if (b.faction && b.faction !== t.faction) continue;
      const why = canBuild(t, k), desc = b.tier !== undefined ? 'Recruit tier ' + (b.tier + 1) + ': ' + units[b.tier] : b.upTier !== undefined ? 'Upgrade ' + units[b.upTier] + ' → ' + UNITS[units[b.upTier]].upName : b.desc;
      s += `<div class="it">${b.tier !== undefined || b.upTier !== undefined ? `<img src="${unitImg(b.tier !== undefined ? units[b.tier] : UNITS[units[b.upTier]].upName)}" alt="">` : ''}<div class="t">${b.name}<small>${desc} · ${costText(bCost(t.owner, k))}${why ? ` · <span class="no">${why}</span>` : ''}</small></div>${btn('BUILD', 'build', k, 'g', why)}</div>`;
    }
    s += `</div><div><h3>RECRUIT (to ${h ? h.name : 'garrison'})</h3>`;
    units.forEach((b0, i) => {
      if (!t.built.includes('dw' + (i + 1))) return;
      const n = t.avail[b0] || 0;
      for (const u of [b0, UNITS[b0].upName]) {
        if (!canRecruitUp(t, u)) continue;
        const U = effStats('player', u), aff = Math.min(n, Math.floor(G.res.player.gold / unitCost('player', u)));
        s += `<div class="it"><img src="${unitImg(u)}" alt=""><div class="t">T${i + 1}${UNITS[u].up ? '+' : ''} ${u} x${n}<small>${unitCost('player', u)}g · ATK ${U.att} DEF ${U.def} HP ${U.hp} DMG ${U.dmg.join('-')} MOVE ${U.move}${U.range ? ' RANGE ' + U.range : ''} · ${abText(U)}</small></div>${btn('+1', 'buy', u + ':1', 'alt', !aff)}${btn('ALL ' + aff, 'buy', u + ':999', 'y', !aff)}</div>`;
      }
    });
    s += `<h3>ARMY</h3>`;
    const upB = (arr, i, w) => { const a = arr[i], U = UNITS[a.type]; if (!U || U.up || !U.upName || U.fac !== t.faction || !t.built.includes('up' + (U.tier + 1))) return ''; const c = upgradeCost('player', a); return btn('UPG ' + c + 'g', 'upg', w + ':' + i, 'p', G.res.player.gold < c); };
    if (h) h.army.forEach((a, i) => s += `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">${h.name}: ${a.count} ${a.type}</div>${upB(h.army, i, 'h')}${btn('TO GARRISON', 'togar', i, 'alt', t.garrison.length >= MAX_STACKS && !t.garrison.some(g => g.type === a.type) || h.army.length < 2)}</div>`);
    t.garrison.forEach((a, i) => s += `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">Garrison: ${a.count} ${a.type}</div>${upB(t.garrison, i, 'g')}${btn('TO HERO', 'tohero', i, 'alt', !h)}</div>`);
    if (!h && !t.garrison.length) s += '<p>No hero or garrison here.</p>';
    if (t.built.includes('tavern')) s += `<h3>TAVERN</h3><div class="it"><div class="t">Hire a hero<small>${HIRE_COST} gold, comes with 15 ${units[0]}s${(G.fled || []).some(f => f.owner === 'player') ? ' · next: ' + G.fled.find(f => f.owner === 'player').name + ' (retreated, LV' + G.fled.find(f => f.owner === 'player').lvl + ')' : ''}</small></div>${btn('HIRE', 'hire', '', 'g', h || G.res.player.gold < HIRE_COST)}</div>`;
    if (t.built.includes('guild1')) s += `<h3>MAGE GUILD</h3><p>${Object.keys(SPELLS).filter(k => SPELLS[k].lvl <= (t.built.includes('guild2') ? 2 : 1)).map(k => SPELLS[k].name + ' (' + SPELLS[k].mana + ' mana): ' + SPELLS[k].desc).join('<br>')}<br>Heroes visiting learn these and refill mana.</p>`;
    if (t.built.includes('market')) s += marketHtml();
    if (t.built.includes('pit')) s += pitHtml(t);
    return s + `</div></div>`;
  }, {town: t.id, full: true, after: () => { const c = $('tview'); if (c) SPR.townView(c, t); }});
}
function openHero() {
  const h = curHero(); if (!h) { msg('No hero'); return; }
  showPanel(() => `<div class="hcard"><img src="${portraitImg(h)}" alt=""><h2>${h.name.toUpperCase()} - LEVEL ${h.lvl}</h2></div><p class="y">${FACTIONS[h.fac] ? FACTIONS[h.fac].name + ' hero · specialty ' + FACTIONS[h.fac].spec.name + ': ' + FACTIONS[h.fac].spec.desc : ''}</p>
    <p>XP ${h.xp} / ${xpForLevel(h.lvl)}<br>ATTACK ${stat(h, 'att')} · DEFENSE ${stat(h, 'def')}<br>SPELL POWER ${stat(h, 'sp')} · KNOWLEDGE ${stat(h, 'kn')}<br>
    MOVE ${h.mp}/${maxMp(h)} · MANA ${h.mana}/${maxMana(h)}</p>
    <h3>SECONDARY SKILLS (${Object.keys(h.sk).length}/${MAX_SKILLS})</h3>${Object.keys(h.sk).map(k => `<div class="it"><div class="t">${SKILL_LVL[h.sk[k]]} ${SKILLS[k].name}<small>${SKILLS[k].desc(skl(h, k))}</small></div></div>`).join('') || '<p>None yet. Gain levels to learn skills.</p>'}
    <h3>TACTICS TALENTS (${h.tp || 0} point${h.tp === 1 ? '' : 's'})</h3><div class="tal">${Object.keys(TALENTS).map(br => `<div><b style="color:${DOCTRINES[br].col}">${DOCTRINES[br].name.toUpperCase()}</b>${TALENTS[br].map((t, i) => { const st = talentState(h, br, i); return `<button class="btn sb ${st === 'have' ? 'g' : st === 'open' ? 'y' : 'alt'}${t.ult ? ' ult' : ''}" data-a="tal" data-v="${t.k}" ${st !== 'open' ? 'disabled' : ''} title="${t.desc}">${t.name}<small>${t.desc}</small></button>`; }).join('')}</div>`).join('')}</div>
    <p>Tactics known: ${knownTactics(h).map(k => TACTICS[k].name).join(', ')}</p>
    <h3>ARTIFACTS</h3><p>${h.arts.map(k => ARTIFACTS[k].name + ' (+' + ARTIFACTS[k].val + ' ' + ARTIFACTS[k].stat + ')').join('<br>') || 'None'}</p>
    <h3>SPELLS</h3><p>${h.spells.map(k => SPELLS[k].name + ' - ' + SPELLS[k].desc).join('<br>') || 'None. Build a Mage Guild and visit it.'}</p>
    <h3>ARMY</h3>${h.army.map(a => `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">${a.count} ${a.type}<small>${abText(effStats(h.owner, a.type))}</small></div></div>`).join('')}
    <div class="bar" style="margin-top:10px">${btn('CLOSE', 'close', '', 'g')}</div>`);
}
// ---------- TECH panel: faction research points + 6-level tree ----------
function rpStatus(o) {
  const f = facOf(o);
  if (f === 'sylvan') { const near = G.heroes.filter(h => h.owner === o && DIRS8.some(([dx, dy]) => inMap(h.x + dx, h.y + dy) && G.map[h.y + dy][h.x + dx] === 2)).length, gr = G.objs.filter(x => x.kind === 'grove' && x.owner === o).length; return `Tonight: ${near} hero(es) next to a forest (+0.15 each), ${gr} Sacred Grove(s) (+0.2 each${pol(o, 'sacredwood') ? ', doubled' : ''}). Flawless wins +0.4.`; }
  if (f === 'dwarf') { const v = savings(o); return `Banked now: ${v} gold value → about +${(0.11 * Math.sqrt(v / 1000)).toFixed(2)} tonight. Spending lowers it; wood/ore count 250, gems 500.`; }
  if (f === 'castle') return 'Per won battle: 0.35 per star (max 3 stars = 1.05). Stars: win, no losses, enemy stronger, 8+ stacks or 80+ creatures.';
  if (f === 'necro') return 'Per battle: total HP of every creature that died (both sides) / 1500, max ' + RP_BATTLE_CAP + '.';
  if (f === 'stronghold') return 'Per battle: gold value of enemy creatures killed / 3000 (max ' + RP_BATTLE_CAP + '), x1.5 when you win against a stronger army.';
  if (f === 'inferno') return 'Sacrifice in the Sacrificial Pit (town): 2500 gold, 5 wood+5 ore or 1000 hero XP = 0.8 each, a creature stack = value/2500. Capturing an enemy mine +0.5, an enemy town +1.';
  return '';
}
function pitHtml(t) {
  const o = t.owner, h = heroAt(t.x, t.y), arr = h && h.owner === o ? h.army : t.garrison, R = RS(o);
  return `<h3>SACRIFICIAL PIT</h3><p>Research today ${R.today.toFixed(2)} / ${RP_DAY_CAP}.</p>` +
    [['gold', '2500 GOLD'], ['res', '5 WOOD + 5 ORE'], ['xp', '1000 HERO XP' + (h ? ' (' + h.name + ')' : ' (needs a hero here)')]].map(([k, l]) => { const v = sacValue(o, k, t); return `<div class="it"><div class="t">${l}<small>${v ? '+' + v.toFixed(2) + ' research' : '<span class="no">Not available</span>'}</small></div>${btn('SACRIFICE', 'sac', k, 'p', !v)}</div>`; }).join('') +
    arr.map((a, i) => { const v = sacValue(o, 'troop', t, i); return `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">${a.count} ${a.type}<small>${v ? '+' + v.toFixed(2) + ' research (stack is lost)' : '<span class="no">Keep at least one stack</span>'}</small></div>${btn('SACRIFICE', 'sac', 'troop:' + i, 'p', !v)}</div>`; }).join('');
}
function openTech() {
  if (!G || !RS('player') || !facOf('player')) return;
  showPanel(() => {
    const o = 'player', f = facOf(o), F = FACTIONS[f], R = RS(o);
    let s = `<div class="thead"><h2>${F.name.toUpperCase()} TECH</h2>${btn('CLOSE', 'close', '', 'g')}</div><div class="kg">
      <div class="rp"><b>${R.pts}</b> research point${R.pts === 1 ? '' : 's'} · next point ${Math.round(R.prog * 100)}% ${meter(R.prog, 1, F.col)}<small>Today ${R.today.toFixed(2)} / ${RP_DAY_CAP} (daily cap)</small></div>
      <h3>HOW ${F.name.toUpperCase()} RESEARCHES</h3><p><b class="hl">${F.rp}</b><br>${rpStatus(o)}</p>
      ${R.log.length ? '<p><small>Recent: ' + R.log.map(l => 'D' + l.d + ' +' + l.amt + ' ' + l.why).join(' · ') + '</small></p>' : ''}
      <h3>TECH TREE - pick ONE of three per level, in order</h3>`;
    TECH[f].forEach((lv, i) => {
      s += `<div class="tl"><b>L${i + 1} ${TECH_LV_NAME[i].toUpperCase()}<small>${TECH_COST[i]} pt${TECH_COST[i] > 1 ? 's' : ''}</small></b><div class="tch">${lv.map(t => { const st = techState(o, i, t.k); return `<button class="btn sb ${st === 'have' ? 'g' : st === 'open' ? 'y' : 'alt'}${i === 5 && t.fx.cap ? ' ult' : ''}" data-a="ptech" data-v="${t.k}" ${st !== 'open' ? 'disabled' : ''}>${st === 'have' ? '✔ ' : ''}${t.name}<small>${t.desc}</small></button>`; }).join('')}</div></div>`;
    });
    if (canSeeEnemyKingdom() && RS('ai')) s += `<h3>ENEMY RESEARCH (${FACTIONS[facOf('ai')].name})</h3><p>${techList('ai').map(t => t.name).join(', ') || 'Nothing yet'}</p>`;
    const pt = G.towns.find(t => t.owner === o && t.built.includes('pit')); if (pt) s += pitHtml(pt); else if (f === 'inferno') s += '<p>Build a Sacrificial Pit in town to sacrifice.</p>';
    return s + '</div>';
  }, {full: true, tech: true, town: (G.towns.find(t => t.owner === 'player' && t.built.includes('pit')) || {}).id});
}
function openMenu() {
  const has = !!localStorage.getItem(SAVE_KEY), auto = !!localStorage.getItem(SAVE_KEY + '-auto');
  showPanel(() => `<h2>MENU</h2><div class="bar">${btn('SAVE', 'save', '', 'g', !G || UI.mode !== 'map')}${btn('LOAD', 'load', '', 'alt', !has)}${btn('LOAD AUTOSAVE', 'loadauto', '', 'alt', !auto)}${btn('NEW GAME', 'new', '', 'y')}${btn('TUTORIAL', 'tutorial', '', 'p')}${G ? btn('CLOSE', 'close', '', 'g') : ''}</div>
    <h3>HOW TO PLAY</h3><p>Explore, grab resources, flag mines and grow your army. Build dwellings in town; creatures grow each week (day 1 of every week).
    Capture the enemy town to win. Lose all towns and heroes and you lose.</p>
    <h3>BATTLE</h3><p>PLAN: tap your stack, then tap an empty tile (move), an enemy (attack) or the stack again (defend). Cast one spell per round with SPELL.
    PRE-BATTLE (before round 1): scout (Intel 0-2), set your formation, pick one tactic and cast terrain spells. All of these last the whole battle.
    RESOLVE: spells, then moves (fastest first), then all attacks hit at the same time. Melee targets strike back at half damage. Attacking from the opposite side of an ally = FLANK x1.5.</p>`, {sticky: !G});
}
function openSpells() {
  const h = heroOf('L');
  if (!h || !h.spells.length) { msg('Your side has no spells.'); return; }
  showPanel(() => `<h2>CAST A SPELL</h2><p>Mana ${h.mana}. Pick a spell, then tap a target. It takes effect first in RESOLVE.</p>` +
    h.spells.map(k => `<div class="it"><div class="t">${SPELLS[k].name} (${SPELLS[k].mana})<small>${SPELLS[k].desc} · target ${SPELLS[k].target}</small></div>${btn('CAST', 'cast', k, 'p', h.mana < SPELLS[k].mana)}</div>`).join('') +
    `<div class="bar" style="margin-top:8px">${btn('NO SPELL', 'cast', '', 'alt')}${btn('CLOSE', 'close', '', 'g')}</div>`);
}

// ---------- input ----------
const ACTIONS = {
  close: () => closePanel(),
  build: k => { const t = G.towns.find(t => t.id === UI.panel.town); if (build(t, k)) { SFX.pick(); msg(BUILDINGS[k].name + ' built!'); } refreshPanel(); },
  buy: v => { const [u, n] = v.split(':'), t = G.towns.find(t => t.id === UI.panel.town), got = recruit(t, u, +n); if (got) { SFX.pick(); msg('Recruited ' + got + ' ' + u); } else { SFX.bad(); msg('Cannot recruit (gold, stock or 7 stacks max)'); } refreshPanel(); },
  togar: i => { const t = G.towns.find(t => t.id === UI.panel.town), h = heroAt(t.x, t.y), s = h.army[i]; if (h.army.length > 1 && addUnits(t.garrison, s.type, s.count)) h.army.splice(i, 1); refreshPanel(); },
  tohero: i => { const t = G.towns.find(t => t.id === UI.panel.town), h = heroAt(t.x, t.y), s = t.garrison[i]; if (h && addUnits(h.army, s.type, s.count)) t.garrison.splice(i, 1); refreshPanel(); },
  hire: () => { const t = G.towns.find(t => t.id === UI.panel.town), h = hire(t); if (h) { G.sel = h.id; SFX.lvl(); msg(h.name + ' joins you!'); } refreshPanel(); },
  mmode: v => { const [r, m] = v.split(':'); mktState(r).m = m; mktClamp(r); refreshPanel(); },
  mq: v => { const [r, d] = v.split(':'); mktState(r).q += +d; mktClamp(r); refreshPanel(); },
  mset: v => { const [r, n] = v.split(':'), st = mktState(r); st.q = n === 'max' ? mktMax(r, st.m) : +n; mktClamp(r); refreshPanel(); },
  mdo: r => { const n = tradeBulk(r); if (n) { SFX.pick(); msg('Traded ' + n + ' ' + r); hudSig = ''; } refreshPanel(); },
  flee: () => openFlee(),
  retreat: () => { if (!B || B.phase !== 'plan') return; UI.panel = null; $('panel').classList.remove('show'); doRetreat('L'); },
  surrender: k => { if (!B) return; UI.panel = null; $('panel').classList.remove('show'); if (!doSurrender(k)) msg('Cannot pay that'); },
  trade: v => { const [r, m] = v.split(':'), buy = r === 'gems' ? 500 : 250, sell = r === 'gems' ? 100 : 50, R = G.res.player;
    if (m === 'buy' && R.gold >= buy) { R.gold -= buy; R[r]++; } else if (m === 'sell' && R[r] > 0) { R[r]--; R.gold += sell; } refreshPanel(); },
  chest: v => { const h = heroById(UI.panel.chestHero); if (v === 'gold') { G.res.player.gold += 1000; celebrate('gold', '+1000 GOLD!', 'Treasure chest'); } else if (h) { gainXp(h, 750); celebrate('xp', '+750 EXPERIENCE!', 'Treasure chest'); } UI.panel.sticky = false; closePanel(); },
  lvlp: s => { UI.panel.pick.p = s; refreshPanel(); },
  lvls: k => { UI.panel.pick.s = k; refreshPanel(); },
  lvlok: () => { const h = heroById(UI.panel.lvlHero), pk = UI.panel.pick; if (!pk.p || !pk.s) return; if (h) { h[pk.p]++; if (pk.p === 'kn') h.mana += 10; if (pk.s !== '-') h.sk[pk.s] = (h.sk[pk.s] || 0) + 1; } UI.panel.sticky = false; closePanel(); },
  save: () => { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); msg('Game saved'); SFX.pick(); closePanel(); },
  load: () => loadGame(SAVE_KEY), loadauto: () => loadGame(SAVE_KEY + '-auto'),
  new: () => { if (!localStorage.getItem('mh-tut-done')) ACTIONS.tutorial(); else openSetup(); },
  setup: () => openSetup(),
  tutorial: () => startGame(() => newTutorial(), 'Tutorial: follow the yellow box.'),
  setsize: v => { UI.setup.size = v; refreshPanel(); }, setdiff: v => { UI.setup.diff = v; refreshPanel(); },
  rseed: () => { UI.setup.seed = Math.floor(Math.random() * 1e6); refreshPanel(); },
  start: () => { const v = parseInt(($('seed') || {}).value, 10); const rf = f => FACTIONS[f] ? f : pick(FACTION_KEYS), o = {...UI.setup, seed: Number.isFinite(v) ? v : UI.setup.seed}; o.pf = rf(o.pf); o.af = rf(o.af); startGame(() => newGame(o), 'Day 1 - ' + FACTIONS[o.pf].name + ' vs ' + FACTIONS[o.af].name + ', ' + MAP_SIZES[o.size].name + ' map, ' + DIFFICULTY[o.diff].name + ', seed ' + o.seed + '. TECH shows how you earn research.'); },
  tutskip: () => { localStorage.setItem('mh-tut-done', '1'); if (G) G.tut = null; $('tut').style.display = 'none'; openSetup(); },
  tutdone: () => { localStorage.setItem('mh-tut-done', '1'); if (G) G.tut = null; $('tut').style.display = 'none'; openSetup(); },
  cast: k => { closePanel(); if (!B) return; if (!k) { B.spell.L = null; B.spellPick = null; msg('No spell this round'); } else { B.spellPick = k; msg('Tap a target for ' + SPELLS[k].name); SFX.magic(); } },
  endday: () => endDay(), town: () => { const h = curHero(), t = (h && townAt(h.x, h.y) && townAt(h.x, h.y).owner === 'player') ? townAt(h.x, h.y) : G.towns.find(t => t.owner === 'player'); t ? openTown(t) : msg('You have no town!'); },
  hero: () => openHero(), menu: () => openMenu(),
  next: () => { const hs = myHeroes(); if (!hs.length) return; const i = hs.indexOf(curHero()); G.sel = hs[(i + 1) % hs.length].id; UI.preview = null; msg(curHero().name + ' selected'); centerOn(curHero().x, curHero().y); },
  resolve: () => resolveRound(), spell: () => B && B.phase === 'plan' && openSpells(),
  auto: () => { if (B && B.phase === 'plan') { planSide('L', true); B.sel = null; msg('All stacks planned. Press RESOLVE.'); } },
  binfo: () => openMenu(),
  zin: () => setZoom(CAM.z + 1), zout: () => setZoom(CAM.z - 1),
  center: () => { const h = curHero(); if (h) centerOn(h.x, h.y); },
  selhero: id => { G.sel = +id; UI.preview = null; const h = curHero(); if (h) centerOn(h.x, h.y); },
  pfight: () => startFight(), nop: () => {},
  ptac: k => { if (B && B.phase === 'pre') { setTactic('L', k); SFX.click(); } },
  pform: f => { if (B && B.phase === 'pre') { applyFormation('L', f); SFX.click(); } },
  phide: id => { const u = B && uById(id); if (!u) return; if (u.hidden) u.hidden = false; else if (B.units.filter(o => o.side === 'L' && o.hidden).length < 2) u.hidden = true; else msg('Max 2 hidden stacks'); },
  pterr: k => { UI.preTerr = UI.preTerr === k ? null : k; if (UI.preTerr) msg('Tap the field to place ' + TERRAIN_SPELLS[k].name); },
  pclear: () => { clearTerrain('L'); UI.preTerr = null; },
  preveal: () => { const h = heroOf('L'); if (h && h.mana >= revealCost(h) && !B.tac.L.reveal) { h.mana -= revealCost(h); B.tac.L.reveal = true; B.tac.L.intel = intelOf('L'); SFX.magic(); msg('Reveal! Intel ' + B.tac.L.intel); } },
  tal: k => { const h = curHero(); if (h && learnTalent(h, k)) { SFX.lvl(); msg(ALL_TAL().find(t => t.k === k).name + ' learned!'); } refreshPanel(); },
  kingdom: () => G && UI.mode === 'map' && openKingdom(),
  kslot: i => { UI.kslot = UI.kslot === +i ? null : +i; refreshPanel(); },
  kpol: k => { if (UI.kslot == null) return; const why = setPolicy('player', UI.kslot, k); if (why) { msg(why); SFX.bad(); } else { msg(POLICIES[k].name + ' enacted'); SFX.pick(); UI.kslot = null; } hudSig = ''; refreshPanel(); },
  ktal: k => { if (learnKT('player', k)) { SFX.lvl(); msg(ALL_KT().find(t => t.k === k).name + ' learned'); } refreshPanel(); },
  opentown: id => openTown(G.towns.find(t => t.id === +id)),
  tech: () => G && UI.mode === 'map' && openTech(),
  ptech: k => { if (pickTech('player', k)) { SFX.lvl(); const t = TECH[facOf('player')].flat().find(x => x.k === k); celebrate('xp', t.name.toUpperCase() + '!', t.desc); hudSig = ''; } refreshPanel(); },
  upg: v => { const [w, i] = v.split(':'), t = G.towns.find(t => t.id === UI.panel.town), h = heroAt(t.x, t.y), arr = w === 'h' ? h.army : t.garrison; if (upgradeStack(t, arr, +i)) { SFX.pick(); msg('Upgraded to ' + arr[Math.min(+i, arr.length - 1)].type); hudSig = ''; } else SFX.bad(); refreshPanel(); },
  sac: v => { const t = G.towns.find(t => t.id === UI.panel.town); if (!t) return; const [k, i] = v.split(':'); if (sacrifice('player', t, k, +i)) SFX.magic(); else SFX.bad(); hudSig = ''; refreshPanel(); },
  setpf: v => { UI.setup.pf = v; refreshPanel(); }, setaf: v => { UI.setup.af = v; refreshPanel(); },
};
// v0.2 saves (v:2) -> v3: add map config, tutorial state and hero skills
function migrate(g) {
  if (g.v === 2) { g.v = 3; g.cfg = {size: 'M', diff: 'normal', seed: null, tutorial: false}; g.tut = null; }
  if (g.v === 3) g.v = 4;
  if (g.v === 4) { g.v = 5; G = g; g.kg = {player: mkKingdom('player'), ai: mkKingdom('ai')}; }
  if (g.v === 5) { // v0.7: 6 factions, 7 tiers + upgrades, research. Old saves stay Castle vs Necropolis.
    g.v = 6; const rn = t => OLD_UNIT_NAMES[t] || t, fixA = a => a && a.forEach(s => s.type = rn(s.type));
    g.heroes.forEach(h => { fixA(h.army); h.fac = h.fac || (h.owner === 'player' ? 'castle' : 'necro'); }); (g.fled || []).forEach(h => fixA(h.army));
    g.towns.forEach(t => { fixA(t.garrison); const av = {}; for (const k in t.avail) av[rn(k)] = (av[rn(k)] || 0) + t.avail[k]; t.avail = av; });
    g.objs.forEach(o => o.kind === 'monster' && fixA(o.army));
    g.cfg.pf = g.cfg.pf || 'castle'; g.cfg.af = g.cfg.af || 'necro'; g.rs = {player: mkRS(), ai: mkRS()};
  }
  g.heroes.forEach(h => { h.sk = h.sk || {}; if (!h.tal) { h.tal = {}; h.tp = Math.max(0, h.lvl - 1); } });
  setDims(g.map); layers = null;
  return g;
}
function startGame(fn, note) {
  UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = []; UI.fx = [];
  fn(); if (!G.rs) G.rs = {player: mkRS(), ai: mkRS()}; if (!G.kg) { G.kg = {player: mkKingdom('player'), ai: mkKingdom('ai')}; if (!G.cfg.tutorial) aiKingdom(); } layers = null; CAM.z = 0; UI.kslot = null; hudSig = ''; UI.mode = 'map'; msg(note || '');
}
function openSetup() {
  UI.setup = UI.setup || {size: 'M', diff: 'normal', seed: Math.floor(Math.random() * 1e6), pf: 'castle', af: 'random'};
  UI.setup.pf = UI.setup.pf || 'castle'; UI.setup.af = UI.setup.af || 'random';
  const S = UI.setup;
  const fbtns = (cur, a) => [...FACTION_KEYS, 'random'].map(k => btn(k === 'random' ? 'RANDOM' : FACTIONS[k].name, a, k, cur === k ? 'y' : 'alt')).join('');
  const finfo = k => k === 'random' ? '<p>Random faction.</p>' : `<div class="fi"><div class="fu">${FACTIONS[k].units.map(u => `<img src="${unitImg(u)}" alt="${u}" title="${u}: ${abText(UNITS[u])}">`).join('')}</div><p><b style="color:${FACTIONS[k].col}">${FACTIONS[k].name}</b> · hero specialty <b>${FACTIONS[k].spec.name}</b>: ${FACTIONS[k].spec.desc}<br>Research: ${FACTIONS[k].rp}</p></div>`;
  showPanel(() => `<h2>NEW GAME</h2><h3>YOUR FACTION</h3><div class="bar">${fbtns(S.pf, 'setpf')}</div>${finfo(S.pf)}<h3>ENEMY FACTION</h3><div class="bar">${fbtns(S.af, 'setaf')}</div>${finfo(S.af)}<h3>MAP SIZE</h3><div class="bar">${Object.keys(MAP_SIZES).map(k => btn(MAP_SIZES[k].name + ' ' + MAP_SIZES[k].w + 'x' + MAP_SIZES[k].h, 'setsize', k, S.size === k ? 'y' : 'alt')).join('')}</div>
    <h3>DIFFICULTY</h3><div class="bar">${Object.keys(DIFFICULTY).map(k => btn(DIFFICULTY[k].name, 'setdiff', k, S.diff === k ? 'y' : 'alt')).join('')}</div>
    <p>${S.diff === 'easy' ? 'More starting resources, slower and weaker enemy.' : S.diff === 'hard' ? 'Less gold for you, a rich and aggressive enemy.' : 'Even start for both sides.'}</p>
    <h3>SEED</h3><div class="bar"><input id="seed" inputmode="numeric" value="${S.seed}" style="font:inherit;font-size:11px;width:120px;padding:8px;border:3px solid #000;background:#0f0f1b;color:#fff">${btn('RANDOM', 'rseed', '', 'alt')}</div>
    <p>Same seed + size = same map. Both sides get a mirrored, fair layout; every town and mine is reachable.</p>
    <div class="bar" style="margin-top:8px">${btn('START', 'start', '', 'g')}${btn('TUTORIAL', 'tutorial', '', 'p')}${G ? btn('BACK', 'menu', '', 'alt') : ''}</div>`, {sticky: !G});
}
// ---------- tutorial: each step completes when the game state shows the player did it ----------
const objOf = k => G.objs.find(o => o.kind === k);
const TUT = [
  {t: 'Tap the GOLD pile once to see the path, then tap it again to walk there and pick it up.', tile: () => objOf('res'), done: () => !objOf('res')},
  {t: 'Mines pay every day. Walk onto the SAWMILL to put your flag on it.', tile: () => objOf('mine'), done: () => G.objs.some(o => o.kind === 'mine' && o.owner === 'player')},
  {t: 'Press TOWN (or tap your castle) and BUILD something - the Tavern is cheap.', tile: () => G.towns[0], done: () => G.tut.built},
  {t: 'Still in town: press ALL next to Peasants to RECRUIT them.', done: () => G.tut.recruited},
  {t: 'Close the town and walk next to the GOBLINS to start a battle.', tile: () => objOf('monster'), done: () => !!B},
  {t: 'PRE-BATTLE: pick a FORMATION and a TACTIC (try Blitz), optionally cast a terrain spell, then press FIGHT!', done: () => !B || B.phase !== 'pre'},
  {t: 'PLAN phase: tap one of your stacks (left), then tap a Goblin to plan an attack.', done: () => !B || Object.keys(B.plans).length > 0},
  {t: 'Press SPELL, choose Magic Arrow, then tap a Goblin. Spells hit first in RESOLVE.', done: () => !B || !!B.spell.L || B.round > 1},
  {t: 'Press RESOLVE: spells, then all moves, then every attack lands at the same time!', done: () => !B || B.round > 1},
  {t: 'Keep planning (AUTO fills in the rest) and RESOLVE until you win.', done: () => !B && !UI.panel && !objOf('monster')},
  {t: 'Press END DAY. Your resources come in each morning, creatures grow each week.', done: () => G.day >= 2},
  {t: 'Tutorial complete! On a random map pick one of 6 factions. Each earns RESEARCH its own way: open TECH (key R) to see how, and spend points on its 6-level tech tree. Capture the enemy town to win.', final: true},
];
function tutTile() { if (!G || !G.tut || UI.mode === 'battle') return null; const s = TUT[G.tut.step], o = s && s.tile && s.tile(); return o ? [o.x, o.y] : null; }
let tutShown = -1;
function tutTick() {
  const el = $('tut');
  if (!G || !G.tut || G.over) { if (el.style.display !== 'none') el.style.display = 'none'; tutShown = -1; return; }
  const s = TUT[G.tut.step];
  if (s && !s.final && s.done()) { G.tut.step++; SFX.pick(); return; }
  if (tutShown !== G.tut.step) {
    tutShown = G.tut.step; el.style.display = 'block';
    el.innerHTML = `<b>TUTORIAL ${G.tut.step + 1}/${TUT.length}</b> ${s.t}<div>${s.final ? btn('NEW GAME', 'tutdone', '', 'g') : btn('SKIP', 'tutskip', '', 'alt')}</div>`;
  }
}
function loadGame(key) {
  try { const g = JSON.parse(localStorage.getItem(key)); if (!g || ![2, 3, 4, 5, 6].includes(g.v)) throw 0; G = migrate(g); } catch (e) { msg('No valid save'); return; }
  UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = [];
  UI.mode = G.over ? 'over' : 'map'; msg('Game loaded - ' + calText(G.day)); CAM.z = 0; hudSig = ''; tutShown = -1;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  SFX.click(); const f = ACTIONS[b.dataset.a]; if (f) f(b.dataset.v);
});
for (const ev of ['input', 'change']) document.addEventListener(ev, e => { const r = e.target.dataset && e.target.dataset.r; if (r && e.target.classList.contains('mrange')) { mktState(r).q = +e.target.value; mktClamp(r); if (ev === 'change') refreshPanel(); else { const m = e.target.closest('.mkt').querySelector('.mprev b'); if (m) m.textContent = mktState(r).q; } } });
$('panel').addEventListener('click', e => { if (e.target.id === 'panel') closePanel(); });
function battleTap(mx, my) {
  const gx = Math.floor((mx - BOX) / CW), gy = Math.floor((my - BOY) / CW);
  if (gx < 0 || gy < 0 || gx >= BW || gy >= BH) return;
  if (B.phase === 'pre') { preTap(gx, gy); return; }
  if (B.phase !== 'plan') return;
  const u0 = uAt(gx, gy), u = u0 && u0.hidden && u0.side === 'R' ? null : u0;
  if (B.siege && gx === B.siege.x && B.siege.att === 'L' && !B.spellPick) {
    if (wallIntact(gy)) { B.siege.target = gy; msg('Catapult will fire at the ' + B.siege.cells[gy].kind + ' (row ' + (gy + 1) + ')'); SFX.click(); }
    else msg(B.siege.cells[gy].kind === 'tower' ? 'Towers cannot be targeted' : 'Already destroyed');
    return;
  }
  if (B.spellPick) {
    const sp = SPELLS[B.spellPick];
    if (u && (sp.target === 'enemy') === (u.side === 'R')) { B.spell.L = {k: B.spellPick, target: u.id}; msg(sp.name + ' on ' + u.type + ' planned'); }
    else msg('Not a valid target');
    B.spellPick = null; return;
  }
  const s = B.sel && uById(B.sel);
  if (!s) {
    if (u && u.side === 'L') { B.sel = u.id; SFX.click(); }
    else if (u) { const U = US(u); msg(`${countText(u.count, u.side === 'L' || B.tac.L.intel >= 1)} ${u.type}: ATK ${U.att} DEF ${U.def} HP ${U.hp} MOVE ${U.move}${U.range ? ' RANGE ' + U.range : ''} · ${U.ab.map(k => k + ': ' + ABIL[k]).join('; ') || 'no abilities'}`); }
    return;
  }
  if (u && u === s) { B.plans[s.id] = {t: 'def'}; msg(s.type + ' will DEFEND (-30% dmg taken)'); }
  else if (u && u.side === 'L') { B.sel = u.id; SFX.click(); return; }
  else if (u) { B.plans[s.id] = {t: 'atk', target: u.id}; msg(s.type + (US(s).range ? ' will SHOOT ' : ' will ATTACK ') + u.type); }
  else if (reach(s, moveOf(s)).has(gx + ',' + gy)) { B.plans[s.id] = {t: 'move', x: gx, y: gy}; msg(s.type + ' will MOVE'); }
  else { msg('Too far (move ' + moveOf(s) + ')'); SFX.bad(); return; }
  SFX.click(); B.sel = firstUnplanned();
  if (!B.sel) msg('All stacks planned. Press RESOLVE.');
}
// pointer: tap = select/plan, drag = pan, pinch / wheel = zoom
const ptrs = new Map(); let drag = null;
const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY});
  if (ptrs.size === 1) drag = {moved: false, sx: e.clientX, sy: e.clientY}; else if (ptrs.size === 2) drag = {moved: true, pinch: pinchDist(), z: CAM.z};
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && !ptrs.size && (UI.mode === 'map' || UI.mode === 'aiturn') && G && !UI.panel) { const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * CAM.dpr, sy = (e.clientY - r.top) * CAM.dpr, tx = Math.floor((CAM.x + sx / CAM.z) / TS), ty = Math.floor((CAM.y + sy / CAM.z) / TS); const k = tx + ',' + ty; if (k !== UI.hoverK) { UI.hoverK = k; showTip(tx, ty, e.clientX, e.clientY); } else UI.tipT = 2.2; }
  const p = ptrs.get(e.pointerId); if (!p || !drag) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  const panOK = UI.mode === 'map' || UI.mode === 'aiturn' || UI.mode === 'over';
  if (drag.pinch && ptrs.size === 2) {
    const r = cv.getBoundingClientRect(), [a, b] = [...ptrs.values()];
    if (panOK) setZoom(drag.z * pinchDist() / drag.pinch, ((a.x + b.x) / 2 - r.left) * CAM.dpr, ((a.y + b.y) / 2 - r.top) * CAM.dpr);
  } else if (ptrs.size === 1) {
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) drag.moved = true;
    if (drag.moved && panOK) { CAM.x -= dx * CAM.dpr / CAM.z; CAM.y -= dy * CAM.dpr / CAM.z; CAM.target = null; clampCam(); }
  }
});
function ptrEnd(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (e.type === 'pointerup' && drag && !drag.moved && !ptrs.size) tapAt(e.clientX, e.clientY);
  else if (e.type === 'pointerup' && drag && drag.moved && !drag.pinch && UI.mode === 'battle' && B && B.phase === 'pre') { const a = toCell(drag.sx, drag.sy), b = toCell(e.clientX, e.clientY); if (a && b) preDrag(a[0], a[1], b[0], b[1]); }
  if (!ptrs.size) drag = null;
}
cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);
cv.addEventListener('wheel', e => { e.preventDefault(); if (UI.mode === 'battle' || UI.mode === 'title') return; const r = cv.getBoundingClientRect(); setZoom(CAM.z + (e.deltaY < 0 ? 1 : -1), (e.clientX - r.left) * CAM.dpr, (e.clientY - r.top) * CAM.dpr); }, {passive: false});
function toCell(cx, cy) { const r = cv.getBoundingClientRect(), mx = ((cx - r.left) * CAM.dpr - BV.ox) / BV.s, my = ((cy - r.top) * CAM.dpr - BV.oy) / BV.s, gx = Math.floor((mx - BOX) / CW), gy = Math.floor((my - BOY) / CW); return gx >= 0 && gy >= 0 && gx < BW && gy < BH ? [gx, gy] : null; }
function tapAt(cx, cy) {
  UI.lastTap = [cx, cy];
  if (UI.panel) return;
  const r = cv.getBoundingClientRect(), sx = (cx - r.left) * CAM.dpr, sy = (cy - r.top) * CAM.dpr;
  if (UI.mode === 'title' || !G) { openMenu(); return; }
  if (UI.mode === 'map') { const tx = Math.floor((CAM.x + sx / CAM.z) / TS), ty = Math.floor((CAM.y + sy / CAM.z) / TS); if (inMap(tx, ty)) tapMap(tx, ty); }
  else if (UI.mode === 'battle' && B) battleTap((sx - BV.ox) / BV.s, (sy - BV.oy) / BV.s);
}
$('mini').addEventListener('click', e => { const r = e.target.getBoundingClientRect(); centerOn(Math.floor((e.clientX - r.left) / r.width * MW), Math.floor((e.clientY - r.top) / r.height * MH)); });
$('fs').onclick = e => { e.stopPropagation(); const d = document; if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen(); else { const el = d.documentElement; (el.requestFullscreen || el.webkitRequestFullscreen || (() => msg('Fullscreen not supported'))).call(el); } };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanel(); return; }
  if (UI.panel) return;
  if (UI.mode === 'battle' && B && B.phase === 'pre') { if (e.key === 'Enter') startFight(); return; }
  if (UI.mode === 'battle') { if (e.key === 'Enter' || e.key === ' ') resolveRound(); if (e.key === 'a') ACTIONS.auto(); if (e.key === 's') ACTIONS.spell(); return; }
  if (e.key === '+' || e.key === '=') { setZoom(CAM.z + 1); return; } if (e.key === '-') { setZoom(CAM.z - 1); return; }
  if (UI.mode !== 'map') return;
  const k = e.key.toLowerCase(), d = {arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]}[k];
  const h = curHero();
  if (d && h && !UI.walk) { e.preventDefault(); const nx = h.x + d[0], ny = h.y + d[1]; if (inMap(nx, ny) && enterable(nx, ny, h)) startWalk(h, [[nx, ny]]); }
  else if (k === 'enter' && UI.preview && h) { startWalk(h, UI.preview.path); UI.preview = null; }
  else if (k === 'e') endDay(); else if (k === 't') ACTIONS.town(); else if (k === 'h') openHero(); else if (k === 'n') ACTIONS.next(); else if (k === 'm') openMenu(); else if (k === 'k') ACTIONS.kingdom(); else if (k === 'r') ACTIONS.tech();
});
$('mute').onclick = e => { e.stopPropagation(); muted = !muted; localStorage.setItem('mh-mute', muted ? '1' : '0'); $('mute').textContent = muted ? 'MUTE' : 'SND'; };
$('mute').textContent = muted ? 'MUTE' : 'SND';
window.MHX = {addRP, pickTech, effStats, techList, techState, countWord, countText, recruit, build, sacrifice, sacValue, upgradeStack, newGame, openTech, openTown, RS, facOf, savings, dailyResearch, bCost, startBattle, get UNITS() { return UNITS; }, take, tipFor, threatOf, surrenderPrice, payPlans, doRetreat, doSurrender, openFlee, tradeBulk, mktState, mktMax, celebrate, objAt, moraleChance, get G() { return G; }, get B() { return B; }, setPolicy, slotCount, income, learnKT, growthOf, unitCost, newDay, hire, finishFight, KG, pol, maxMana, fight, startFight, tac, blunted, moveOf, calcDmg, intelOf, knownTactics, learnTalent, reach, uById, loadGame, applyFormation, placeTerrain, curHero, gainXp, flood, get PT() { return PT; }, get ET() { return ET; }, battleToClient: (lx, ly) => { const r = cv.getBoundingClientRect(); return [r.left + (BV.ox + lx * BV.s) / CAM.dpr, r.top + (BV.oy + ly * BV.s) / CAM.dpr]; }, UI, CAM, ACTIONS, tapMap, battleTap, endDay, resolveRound, cell: (x, y) => [BOX + x * CW + CW / 2, BOY + y * CW + CW / 2], tileToClient: (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + ((x * TS + TS / 2 - CAM.x) * CAM.z) / CAM.dpr, r.top + ((y * TS + TS / 2 - CAM.y) * CAM.z) / CAM.dpr]; }}; // test hook
openMenu();
requestAnimationFrame(loop);
