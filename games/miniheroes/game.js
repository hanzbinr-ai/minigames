// Mini Heroes - logic + rendering. G = saved game state, UI = screen state, B = current battle.
'use strict';
const MW = 24, MH = 18, TS = 16, BW = 10, BH = 7, CW = 24, BOX = 8, BOY = 28, BLW = 256, BLH = 200;
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
const maxMp = h => BASE_MP + artBonus(h, 'mp');
const maxMana = h => stat(h, 'kn') * 10;
const costText = c => RES.filter(r => c[r]).map(r => c[r] + ' ' + r).join(', ');
const canPay = (owner, c) => RES.every(r => (G.res[owner][r] || 0) >= (c[r] || 0));
const pay = (owner, c) => RES.forEach(r => G.res[owner][r] -= (c[r] || 0));
const armyText = a => a.map(s => s.count + ' ' + s.type).join(', ') || 'none';
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
  return army.reduce((p, s) => { const u = UNITS[s.type]; return p + s.count * u.hp * (u.dmg[0] + u.dmg[1]) / 2 * (1 + (u.att + u.def) * 0.05); }, 0) * b;
}

// ---------- map generation (point-symmetric so both sides are fair) ----------
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function flood(T, sx, sy) {
  const seen = T.map(r => r.map(() => false)), st = [[sx, sy]]; seen[sy][sx] = true;
  while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && !seen[ny][nx] && TERRAIN[T[ny][nx]].cost) { seen[ny][nx] = true; st.push([nx, ny]); } } }
  return seen;
}
const PT = {x: 2, y: 2}, ET = {x: MW - 3, y: MH - 3};
function genTerrain(seed) {
  for (let tries = 0; tries < 60; tries++) {
    const R = mulberry(seed + tries * 7919);
    const T = Array.from({length: MH}, () => Array(MW).fill(0));
    for (let i = 0; i < 26; i++) {
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
function newGame() {
  const {T, R} = genTerrain(Date.now() % 1e6);
  G = {v: 2, day: 1, map: T, fog: T.map(r => r.map(() => 0)), objs: [], heroes: [], towns: [], sel: null, nid: 1, over: null,
    res: {player: {gold: 5000, wood: 10, ore: 10, gems: 2}, ai: {gold: 5000, wood: 10, ore: 10, gems: 2}}};
  const id = () => G.nid++;
  const mkTown = (c, owner, faction, name) => ({id: id(), x: c.x, y: c.y, owner, faction, name, built: ['dw1', 'dw2'], avail: {}, garrison: [], builtToday: false});
  G.towns.push(mkTown(PT, 'player', 'castle', 'Castlegate'), mkTown(ET, 'ai', 'necro', 'Bonehold'));
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
  pair(3, 6, () => ({kind: 'mine', mine: 'wood', owner: null}));
  pair(3, 6, () => ({kind: 'mine', mine: 'ore', owner: null}));
  for (let i = 0; i < 3; i++) pair(3, 8, resPick);
  pair(3, 7, () => ({kind: 'chest'}));
  pair(7, 13, () => ({kind: 'mine', mine: 'gold', owner: null}), () => ({type: 'Wolf', count: rnd(10, 16)}));
  pair(7, 13, () => ({kind: 'mine', mine: 'gems', owner: null}), () => ({type: 'Goblin', count: rnd(18, 26)}));
  pair(6, 12, () => ({kind: 'chest'}), () => ({type: 'Goblin', count: rnd(8, 12)}));
  pair(6, 14, () => ({kind: 'res', res: 'gems', amt: rnd(3, 5)}));
  const arts = Object.keys(ARTIFACTS).sort(() => R() - 0.5);
  pair(8, 15, () => ({kind: 'art', art: arts[0]}), () => ({type: 'Troll', count: rnd(3, 5)}));
  pair(8, 15, () => ({kind: 'art', art: arts[1]}), () => ({type: 'Wolf', count: rnd(18, 24)}));
  pair(5, 12, resPick, () => ({type: 'Goblin', count: rnd(6, 10)}));
  G.heroes.push(mkHero('player', HERO_NAMES[0], PT.x, PT.y, [{type: 'Peasant', count: 30}, {type: 'Archer', count: 8}]));
  G.heroes.push(mkHero('ai', AI_NAMES[0], ET.x, ET.y, [{type: 'Skeleton', count: 14}, {type: 'Zombie', count: 3}]));
  G.sel = G.heroes[0].id;
  revealAll();
}
function mkHero(owner, name, x, y, army) {
  return {id: G.nid++, owner, name, x, y, lvl: 1, xp: 0, att: 1, def: 1, sp: 1, kn: 1, mp: BASE_MP, mana: 10, spells: [], arts: [], army};
}

// ---------- fog ----------
function reveal(x, y, r) { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy) && dx * dx + dy * dy <= r * r + 1) G.fog[y + dy][x + dx] = 1; }
function revealAll() {
  myHeroes().forEach(h => reveal(h.x, h.y, 4));
  G.towns.filter(t => t.owner === 'player').forEach(t => reveal(t.x, t.y, 5));
  G.objs.filter(o => o.kind === 'mine' && o.owner === 'player').forEach(o => reveal(o.x, o.y, 2));
}

// ---------- pathfinding (Dijkstra, 8 directions; objects/guarded tiles end a path) ----------
function guardOf(x, y) { return G.objs.find(o => o.kind === 'monster' && Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1); }
function stepCost(x, y, dx, dy) { const c = TERRAIN[G.map[y][x]].cost; return dx && dy ? Math.round(c * 1.5) : c; }
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
      const v = ny * MW + nx, d = best + stepCost(nx, ny, dx, dy);
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
  describeTile(tx, ty);
  if (!path || !path.length) { SFX.bad(); UI.preview = null; return; }
  UI.preview = {tx, ty, path, cost: path.map(([x, y]) => dj.dist[y * MW + x])};
  const total = UI.preview.cost[UI.preview.cost.length - 1];
  $('msg').textContent += ' · ' + (total <= h.mp ? 'Tap again to go' : 'Needs ' + Math.ceil(total / maxMp(h)) + ' days');
}
function describeTile(x, y) {
  const o = objAt(x, y), t = townAt(x, y), h = heroAt(x, y);
  let s = TERRAIN[G.map[y][x]].name;
  if (t) s = t.name + ' (' + (t.owner === 'player' ? 'yours' : 'enemy') + ')';
  else if (h) s = 'Enemy hero ' + h.name + ': ' + armyText(h.army);
  else if (o) s = o.kind === 'monster' ? sizeWord(o.army[0].count) + ' ' + o.army[0].type + 's'
    : o.kind === 'mine' ? MINES[o.mine].name + ' (+' + MINES[o.mine].amt + ' ' + MINES[o.mine].res + '/day)' + (o.owner ? ' - ' + o.owner : '')
    : o.kind === 'res' ? o.amt + ' ' + o.res : o.kind === 'chest' ? 'Treasure chest' : 'Artifact: ' + ARTIFACTS[o.art].name;
  else if (guardOf(x, y)) s += ' (guarded)';
  msg(s);
}
function startWalk(h, path) { UI.walk = {id: h.id, path: path.slice(), t: 0}; }
function walkStep() {
  const w = UI.walk, h = heroById(w.id);
  if (!h || !w.path.length) { UI.walk = null; return; }
  const [nx, ny] = w.path[0], c = stepCost(nx, ny, nx - h.x, ny - h.y);
  if (h.mp < c) { msg(h.name + ' is out of movement. END DAY to continue.'); UI.walk = null; return; }
  h.mp -= c; h.x = nx; h.y = ny; w.path.shift(); SFX.step();
  reveal(h.x, h.y, 4);
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
  if (o.kind === 'res') { G.res[h.owner][o.res] += o.amt; drop(); if (me) { msg('Found ' + o.amt + ' ' + o.res); SFX.pick(); } }
  else if (o.kind === 'art') { h.arts.push(o.art); drop(); if (me) { msg(h.name + ' found ' + ARTIFACTS[o.art].name + '!'); SFX.lvl(); } }
  else if (o.kind === 'chest') {
    drop();
    if (me) { SFX.pick(); showPanel(() => `<h2>TREASURE CHEST</h2><p>Keep the gold or give it away for experience?</p>
      <div class="bar"><button class="btn y" data-a="chest" data-v="gold">1000 GOLD</button><button class="btn alt" data-a="chest" data-v="xp">750 XP</button></div>`, {chestHero: h.id, sticky: true}); }
    else if (h.lvl < 4) gainXp(h, 750); else G.res.ai.gold += 1000;
  } else if (o.kind === 'mine' && o.owner !== h.owner) {
    o.owner = h.owner;
    if (me) { msg(MINES[o.mine].name + ' captured!'); SFX.pick(); reveal(o.x, o.y, 2); } else if (G.fog[o.y][o.x]) msg('Enemy captured a ' + MINES[o.mine].name + '!');
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
    if (h.owner === 'player') UI.levelQ.push(h.id);
    else h[pick(['att', 'def', 'att', 'sp', 'kn'])]++;
  }
}
function nextLevelUp() {
  if (!UI.levelQ.length || UI.panel) return;
  const h = heroById(UI.levelQ.shift()); if (!h) return nextLevelUp();
  const opts = ['att', 'def', 'sp', 'kn'].sort(() => Math.random() - 0.5).slice(0, 2), names = {att: 'ATTACK', def: 'DEFENSE', sp: 'SPELL POWER', kn: 'KNOWLEDGE'};
  SFX.lvl();
  showPanel(() => `<h2>LEVEL UP!</h2><p>${h.name} reached level ${h.lvl}. Choose a skill:</p>
    <div class="bar">${opts.map(s => `<button class="btn y" data-a="lvl" data-v="${s}">+1 ${names[s]}</button>`).join('')}</div>`, {lvlHero: h.id, sticky: true});
}

// ---------- day / week ----------
function income(owner) {
  let inc = {gold: 0, wood: 0, ore: 0, gems: 0};
  G.towns.filter(t => t.owner === owner).forEach(t => inc.gold += BASE_INCOME + (t.built.includes('hall') ? 500 : 0));
  G.objs.filter(o => o.kind === 'mine' && o.owner === owner).forEach(o => inc[MINES[o.mine].res] += MINES[o.mine].amt);
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
  for (const owner of ['player', 'ai']) { const inc = income(owner); RES.forEach(r => G.res[owner][r] += inc[r]); }
  G.towns.forEach(t => t.builtToday = false);
  G.heroes.forEach(h => { h.mp = maxMp(h); h.mana = Math.min(maxMana(h), h.mana + 2); });
  let note = 'Day ' + G.day + ' (' + calText(G.day) + ')';
  if ((G.day - 1) % 7 === 0) {
    G.towns.forEach(t => FACTIONS[t.faction].units.forEach((u, i) => {
      if (t.built.includes('dw' + (i + 1))) t.avail[u] = (t.avail[u] || 0) + Math.floor(UNITS[u].growth * (t.built.includes('citadel') ? 1.5 : 1));
    }));
    G.objs.filter(o => o.kind === 'monster').forEach(o => o.army[0].count = Math.ceil(o.army[0].count * 1.1));
    note = 'A new week begins! Creatures have grown. ' + note;
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
  if (!canPay(t.owner, b.cost)) return 'Not enough resources';
  return '';
}
function build(t, k) {
  if (canBuild(t, k)) return false;
  pay(t.owner, BUILDINGS[k].cost); t.built.push(k); t.builtToday = true;
  const b = BUILDINGS[k];
  if (b.tier !== undefined) { const u = FACTIONS[t.faction].units[b.tier]; t.avail[u] = (t.avail[u] || 0) + UNITS[u].growth; }
  const h = heroAt(t.x, t.y); if (h && h.owner === t.owner) visitTown(h, t);
  return true;
}
function recruitTarget(t) { const h = heroAt(t.x, t.y); return h && h.owner === t.owner ? h.army : t.garrison; }
function recruit(t, u, n) {
  n = Math.min(n, t.avail[u] || 0, Math.floor(G.res[t.owner].gold / UNITS[u].cost));
  if (n <= 0) return 0;
  if (!addUnits(recruitTarget(t), u, n)) return 0;
  t.avail[u] -= n; G.res[t.owner].gold -= n * UNITS[u].cost;
  return n;
}
function hire(t) {
  if (!t.built.includes('tavern') || heroAt(t.x, t.y) || G.res[t.owner].gold < HIRE_COST) return null;
  const names = t.owner === 'player' ? HERO_NAMES : AI_NAMES, used = G.heroes.map(h => h.name);
  const h = mkHero(t.owner, names.find(n => !used.includes(n)) || 'Hero', t.x, t.y, [{type: FACTIONS[t.faction].units[0], count: 15}]);
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
  if (!def.arrs.some(a => a.length)) { finishFight(ctx, true, 0, 0); return; }
  if (att.owner !== 'player' && def.owner !== 'player') { autoBattle(ctx); return; }
  startBattle(ctx);
}
function autoBattle(ctx) {
  const all = s => s.arrs.flat(), pa = armyPower(all(ctx.att), ctx.att.hero), pd = armyPower(all(ctx.def), ctx.def.hero);
  const attWon = pa >= pd * (0.85 + Math.random() * 0.3), [w, l] = attWon ? [ctx.att, ctx.def] : [ctx.def, ctx.att];
  const frac = Math.min(0.9, (attWon ? pd / pa : pa / pd) * 0.6), hp = a => a.reduce((s, x) => s + x.count * UNITS[x.type].hp, 0);
  const lostHp = hp(all(l));
  w.arrs.forEach(a => { a.forEach(s => s.count = Math.ceil(s.count * (1 - frac))); a.splice(0, a.length, ...a.filter(s => s.count > 0)); });
  l.arrs.forEach(a => a.length = 0);
  finishFight(ctx, attWon, attWon ? lostHp : 0, attWon ? 0 : lostHp);
}
// xpA/xpD = enemy hit points killed by attacker/defender
function finishFight(ctx, attWon, xpA, xpD) {
  const {att, def} = ctx, [w, l] = attWon ? [att, def] : [def, att];
  if (w.hero) gainXp(w.hero, attWon ? xpA : xpD);
  if (l.hero) G.heroes.splice(G.heroes.indexOf(l.hero), 1);
  if (def.monster && attWon) G.objs.splice(G.objs.indexOf(def.monster), 1);
  if (def.town && attWon) {
    def.town.owner = att.owner; def.town.garrison = []; def.town.builtToday = true;
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
  for (const k of AI_BUILD_ORDER) if (build(t, k)) break;
  const ai = G.heroes.filter(h => h.owner === 'ai');
  if (!ai.length || (ai.length < 2 && G.day > 10 && G.res.ai.gold > 6000)) hire(t);
  FACTIONS[t.faction].units.slice().reverse().forEach(u => recruit(t, u, 999));
}
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
    else if (o.kind === 'mine' && o.owner !== 'ai') consider(o.x, o.y, o.mine === 'gold' ? 4000 : 2000);
    else if (o.kind === 'monster' && !avoid(o)) consider(o.x, o.y, 500, true);
  }
  const grace = G.day < 8; // no attacks on the player during week 1
  for (const e of G.heroes) if (!grace && e.owner === 'player' && my > armyPower(e.army, e) * 1.3) consider(e.x, e.y, 6000);
  for (const t of G.towns) if (!grace && t.owner === 'player') {
    const th = heroAt(t.x, t.y), dp = armyPower(t.garrison) + (th ? armyPower(th.army, th) : 0);
    if (my > dp * (t.built.includes('fort') ? 1.5 : 1.2)) consider(t.x, t.y, 30000);
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
  const [nx, ny] = A.path[0], c = stepCost(nx, ny, nx - h.x, ny - h.y);
  if (h.mp < c) { next(); return; }
  h.mp -= c; h.x = nx; h.y = ny; A.path.shift();
  if (G.fog[ny][nx]) SFX.step();
  if (arrive(h)) A.path = null;
}
function aiVisit(h, t) {
  FACTIONS[t.faction].units.slice().reverse().forEach(u => recruit(t, u, 999));
  const danger = G.heroes.some(e => e.owner === 'player' && Math.max(Math.abs(e.x - t.x), Math.abs(e.y - t.y)) < 10);
  if (!danger) { t.garrison.forEach(s => addUnits(h.army, s.type, s.count)); t.garrison = t.garrison.filter(s => !h.army.some(a => a.type === s.type)); }
}

// ---------- tactical battle: PLAN phase then simultaneous RESOLVE phase ----------
function startBattle(ctx) {
  const L = ctx.def.owner === 'player' ? 'def' : 'att';
  B = {ctx, sides: {L: L === 'att' ? ctx.att : ctx.def, R: L === 'att' ? ctx.def : ctx.att}, attSide: L === 'att' ? 'L' : 'R',
    round: 1, phase: 'plan', units: [], seed: rnd(1, 1e6), clock: 0, ev: [], proj: [], eff: [], obst: new Set(), plans: {}, spell: {L: null, R: null}, sel: null, spellPick: null, log: ''};
  B.fort = ctx.def.town && ctx.def.town.built.includes('fort') ? (L === 'def' ? 'L' : 'R') : null;
  const rows = [3, 1, 5, 0, 6, 2, 4];
  for (const side of ['L', 'R']) {
    let i = 0;
    B.sides[side].arrs.forEach((arr, src) => arr.forEach(s => {
      if (i >= MAX_STACKS || s.count <= 0) return;
      const ranged = UNITS[s.type].range > 0, x = side === 'L' ? (ranged ? 0 : 1) : (ranged ? BW - 1 : BW - 2), y = rows[i++];
      B.units.push({id: side + i, side, type: s.type, count: s.count, start: s.count, tot: s.count * UNITS[s.type].hp, x, y, rx: x, ry: y, gx: x, gy: y, shown: s.count, ph: Math.random() * 2, atk: [], hit: [], deadAt: null, src, alive: true});
    }));
  }
  for (let k = 0; k < 3; k++) { const x = rnd(3, 6), y = rnd(0, BH - 1); if (!uAt(x, y)) B.obst.add(x + ',' + y); }
  UI.ret = UI.mode === 'aiturn' ? 'aiturn' : 'map'; UI.mode = 'battle'; UI.walk = null; UI.preview = null;
  msg((B.attSide === 'R' ? 'You are attacked! ' : 'Battle! ') + 'Foe: ' + armyText(B.units.filter(u => u.side === 'R')) + '. PLAN your moves.');
  syncBars(); SFX.hit();
  B.sel = firstUnplanned();
}
const uAt = (x, y) => B.units.find(u => u.alive && u.x === x && u.y === y);
const uById = id => B.units.find(u => u.id === id);
const md = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const heroOf = side => B.sides[side].hero;
const moveOf = u => u.slow ? 1 : UNITS[u.type].move + (u.haste ? 2 : 0);
const free = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH && !B.obst.has(x + ',' + y) && !uAt(x, y);
const enemyNear = u => B.units.some(o => o.alive && o.side !== u.side && md(o, u) === 1);
const firstUnplanned = () => (B.units.find(u => u.alive && u.side === 'L' && !B.plans[u.id]) || {}).id || null;
function reach(u, mv) { // BFS: key -> {d, prev}
  const m = new Map([[u.x + ',' + u.y, {d: 0, x: u.x, y: u.y, prev: null}]]), q = [m.get(u.x + ',' + u.y)];
  while (q.length) {
    const c = q.shift(); if (c.d >= mv) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx, y = c.y + dy, k = x + ',' + y;
      if (m.has(k) || !free(x, y)) continue;
      const n = {d: c.d + 1, x, y, prev: c}; m.set(k, n); q.push(n);
    }
  }
  return m;
}
function calcDmg(a, t, ranged) {
  const ua = UNITS[a.type], ut = UNITS[t.type], ha = heroOf(a.side), ht = heroOf(t.side);
  const A = ua.att + (ha ? stat(ha, 'att') : 0), D = ut.def + (ht ? stat(ht, 'def') : 0) + (B.fort === t.side ? 3 : 0);
  let d = a.count * (ua.dmg[0] + Math.random() * (ua.dmg[1] - ua.dmg[0]));
  d *= A >= D ? 1 + 0.05 * Math.min(60, A - D) : Math.max(0.3, 1 - 0.025 * (D - A));
  const tags = [];
  if (!ranged) {
    const dx = Math.sign(a.x - t.x), dy = Math.sign(a.y - t.y), back = uAt(t.x - dx, t.y - dy);
    if (back && back.side === a.side) { d *= 1.5; tags.push('FLANK'); }
  }
  if (ua.skill === 'Swarm') { const n = B.units.filter(o => o.alive && o !== a && o.side === a.side && md(o, t) === 1).length; d *= 1 + 0.15 * n; }
  if (ua.skill === 'Cleave' && Math.random() < 0.25) { d *= 1.3; tags.push('CLEAVE'); }
  if (ua.skill === 'Charge') d *= 1 + 0.1 * (a.moved || 0);
  if (ut.skill === 'Tough') d *= 0.85;
  if (B.plans[t.id] && B.plans[t.id].t === 'def') d *= 0.7;
  return {dmg: Math.max(1, Math.round(d)), tags};
}
function bestSpell(side) {
  const h = heroOf(side); if (!h) return null;
  const foes = B.units.filter(u => u.alive && u.side !== side), mine = B.units.filter(u => u.alive && u.side === side);
  const big = foes.sort((a, b) => b.tot * UNITS[b.type].att - a.tot * UNITS[a.type].att)[0];
  for (const k of ['lightning', 'arrow', 'cure', 'slow', 'haste']) {
    if (!h.spells.includes(k) || h.mana < SPELLS[k].mana) continue;
    if ((k === 'lightning' || k === 'arrow' || k === 'slow') && big && !(k === 'slow' && UNITS[big.type].skill === 'Undead')) return {k, target: big.id};
    if (k === 'cure') { const hurt = mine.find(u => u.start * UNITS[u.type].hp - u.tot > 10 + 5 * stat(h, 'sp')); if (hurt) return {k, target: hurt.id}; }
  }
  return null;
}
function planSide(side, onlyMissing) {
  const foes = () => B.units.filter(u => u.alive && u.side !== side);
  for (const u of B.units) {
    if (!u.alive || u.side !== side || (onlyMissing && B.plans[u.id])) continue;
    const f = foes(); if (!f.length) break;
    let t;
    if (UNITS[u.type].range && !enemyNear(u)) t = f.reduce((b, o) => (!b || o.tot * UNITS[o.type].att > b.tot * UNITS[b.type].att) ? o : b, null);
    else t = f.reduce((b, o) => (!b || md(u, o) < md(u, b)) ? o : b, null);
    B.plans[u.id] = {t: 'atk', target: t.id};
  }
  if (!B.spell[side] || !onlyMissing) B.spell[side] = B.spell[side] || bestSpell(side);
}
function castSpell(side, out) {
  const s = B.spell[side], h = heroOf(side); if (!s || !h) return;
  const sp = SPELLS[s.k], t = uById(s.target);
  if (!t || !t.alive || h.mana < sp.mana) return;
  h.mana -= sp.mana; const SP = stat(h, 'sp'), ut = UNITS[t.type];
  if (s.k === 'arrow' || s.k === 'lightning') { const d = s.k === 'arrow' ? 10 + 10 * SP : 10 + 25 * SP; t.tot -= d; fx(t, '-' + d, '#d858f8', 0.45); }
  if (s.k === 'cure') { const v = Math.min(10 + 5 * SP, t.start * ut.hp - t.tot); t.tot += Math.max(0, v); fx(t, '+' + Math.max(0, v), '#58d854', 0.4); }
  if (s.k === 'haste') { t.haste = 1; fx(t, 'HASTE', '#3cbcfc', 0.4); }
  if (s.k === 'slow') { if (ut.skill === 'Undead') fx(t, 'IMMUNE', '#aaa', 0.4); else { t.slow = 1; fx(t, 'SLOW', '#f8b800', 0.4); } }
  B.eff.push({k: s.k, side, tx: t.x, ty: t.y, at: 0.05}); later(0.05, SFX.magic);
  out.push(h.name + ' cast ' + sp.name);
  if (t.tot <= 0) t.alive = false;
  t.count = Math.max(0, Math.ceil(t.tot / ut.hp));
}
function moveAlong(u, cell) { // walk to a reached cell
  let c = cell, steps = 0; while (c && c.prev) { steps++; c = c.prev; }
  u.x = cell.x; u.y = cell.y; u.moved = steps;
}
function resolveRound() {
  if (!B || B.phase !== 'plan') return;
  planSide('R'); B.phase = 'resolve'; B.sel = null; B.spellPick = null;
  B.clock = 0; B.ev = []; B.proj = []; B.eff = []; UI.fx = [];
  B.units.forEach(u => { if (!u.alive) u.gone = true; u.atk = []; u.hit = []; });
  const out = [];
  // 1. spells
  castSpell('L', out); castSpell('R', out);
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
      if (UNITS[u.type].range && !enemyNear(u)) continue;
      let best = null;
      for (const c of reach(u, moveOf(u)).values()) { const score = md(c, t) * 10 + c.d; if (!best || score < best.s) best = {c, s: score}; }
      if (best) moveAlong(u, best.c);
    }
  }
  later(0.55, () => B.units.forEach(u => { u.gx = u.x; u.gy = u.y; }));
  // 3. attacks - all damage computed from the same snapshot, then applied together
  const hits = [];
  for (const u of B.units) {
    const p = B.plans[u.id]; if (!u.alive || !p || p.t !== 'atk') continue;
    const t = uById(p.target); if (!t || !t.alive) continue;
    const ranged = UNITS[u.type].range > 0, dist = md(u, t);
    if (ranged && dist > 1) {
      if (enemyNear(u)) { out.push(u.type + ' blocked'); continue; }
      const r = calcDmg(u, t, true); let d = r.dmg;
      if (dist > UNITS[u.type].range) d = Math.ceil(d / 2);
      hits.push({a: u, t, d, tags: r.tags});
    } else if (dist === 1) {
      const r = calcDmg(u, t, false); let d = ranged ? Math.ceil(r.dmg / 2) : r.dmg;
      hits.push({a: u, t, d, tags: r.tags});
      if (!t.retal) { t.retal = true; const rr = calcDmg(t, u, false); hits.push({a: t, t: u, d: Math.ceil(rr.dmg / 2), tags: ['RETAL']}); }
    }
  }
  for (const h of hits) {
    h.t.tot -= h.d;
    const ret = h.tags.includes('RETAL'), at = ret ? 1.6 : 1.05, shot = !ret && UNITS[h.a.type].range > 0 && md(h.a, h.t) > 1, imp = at + (shot ? 0.35 : 0.15);
    h.a.atk.push({at, dx: shot ? 0 : Math.sign(h.t.x - h.a.x), dy: shot ? 0 : Math.sign(h.t.y - h.a.y)});
    if (shot) B.proj.push({at, dur: 0.35, fx: h.a.x, fy: h.a.y, tx: h.t.x, ty: h.t.y, kind: h.a.type === 'Archer' ? 'arrow' : 'orb', col: UNITS[h.a.type].col});
    h.t.hit.push(imp); fx(h.t, '-' + h.d + (h.tags.length ? ' ' + h.tags[0] : ''), ret ? '#f8b800' : '#fcfcfc', imp);
    later(imp, SFX.hit);
  }
  for (const u of B.units) {
    if (!u.alive) continue;
    const hp = UNITS[u.type].hp;
    if (u.tot <= 0) { u.alive = false; u.tot = 0; out.push(u.type + ' destroyed'); }
    else if (UNITS[u.type].skill === 'Regen') u.tot = Math.ceil(u.tot / hp) * hp;
    u.count = Math.ceil(u.tot / hp);
    u.retal = u.haste = u.slow = 0; u.moved = 0;
  }
  B.plans = {}; B.spell = {L: null, R: null}; B.round++;
  B.log = hits.length + ' hits. ' + out.join('. ');
  const lAlive = B.units.some(u => u.alive && u.side === 'L'), rAlive = B.units.some(u => u.alive && u.side === 'R');
  const fin = B.units.map(u => [u, u.count, u.alive]);
  later(2.0, () => { fin.forEach(([u, c, a]) => { u.shown = c; if (!a && u.deadAt == null) u.deadAt = B.clock; }); msg(B.log); });
  if (!lAlive || !rAlive || B.round > 30) { later(2.8, () => endBattle(lAlive && !rAlive)); return; }
  later(2.5, () => { B.phase = 'plan'; B.sel = firstUnplanned(); msg('Round ' + B.round + ' - PLAN. ' + B.log); });
}
function endBattle(playerWon) {
  const ctx = B.ctx, killed = side => B.units.filter(u => u.side !== side).reduce((s, u) => s + Math.max(0, u.start * UNITS[u.type].hp - u.tot), 0);
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

// ---------- floating text & battle timeline (all driven by elapsed seconds) ----------
function fx(u, text, col, delay = 0) { UI.fx.push({x: u.x, y: u.y, text, col, t: -delay, life: 1.1}); }
function later(at, fn) { B.ev.push({at, fn}); B.ev.sort((a, b) => a.at - b.at); }

// ---------- view, camera, zoom ----------
const WW = MW * TS, WH = MH * TS;
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
  else if (o.kind === 'mine') g.drawImage(SPR.mine(o.mine, o.owner, Math.floor(clock * 4) % 2), X - 2, Y - 6);
  else if (o.kind === 'monster' && o.army.length) g.drawImage(SPR.unit(o.army[0].type, Math.floor(clock * 2 + o.id * 0.37) % 2, true), X - 4, Y - 9);
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
  G.objs.forEach(o => o.kind === 'mine' ? dot(o.x, o.y, ownerCol(o.owner), 4) : o.kind === 'monster' ? dot(o.x, o.y, '#fc7460') : dot(o.x, o.y, '#f8b800'));
  G.towns.forEach(t => { g.fillStyle = '#000'; g.fillRect(t.x * s - 3, t.y * s - 3, 10, 10); g.fillStyle = ownerCol(t.owner); g.fillRect(t.x * s - 2, t.y * s - 2, 8, 8); });
  G.heroes.forEach(h => dot(h.x, h.y, h.owner === 'player' ? '#fcfcfc' : '#e40058', 4));
  g.strokeStyle = '#f8b800'; g.lineWidth = 1; g.strokeRect(CAM.x / TS * s + 0.5, CAM.y / TS * s + 0.5, CAM.w / CAM.z / TS * s - 1, CAM.h / CAM.z / TS * s - 1);
}

// ---------- battle rendering (256x202 logical canvas, integer scaled) ----------
function txt(g, s, x, y, col, align = 'center') { g.font = '8px PS2P, monospace'; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = col; g.fillText(s, x, y); }
function dotLine(g, x0, y0, x1, y1, col) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
const cellC = (x, y) => [BOX + x * CW + CW / 2, BOY + y * CW + CW / 2];
function drawBattle(g) {
  g.imageSmoothingEnabled = false;
  g.drawImage(SPR.field(BLW, BLH, CW, B.seed), 0, 0);
  g.fillStyle = '#10102a'; g.fillRect(0, 0, BLW, BOY - 3); g.fillStyle = '#000'; g.fillRect(0, BOY - 3, BLW, 2);
  txt(g, 'ROUND ' + (B.phase === 'plan' ? B.round : B.round - 1) + ' - ' + (B.phase === 'plan' ? 'PLAN' : 'RESOLVE'), BLW / 2, 10, B.phase === 'plan' ? '#f8b800' : '#58d854');
  const hl = heroOf('L'), hr = heroOf('R');
  txt(g, hl ? hl.name + ' ' + hl.mana + 'MP' : 'GARRISON', 3, 20, '#3cbcfc', 'left');
  txt(g, hr ? hr.name : (B.sides.R.monster ? 'NEUTRALS' : 'GARRISON'), BLW - 3, 20, '#e40058', 'right');
  g.fillStyle = '#00000030';
  for (let x = 0; x <= BW; x++) g.fillRect(BOX + x * CW, BOY, 1, BH * CW);
  for (let y = 0; y <= BH; y++) g.fillRect(BOX, BOY + y * CW, BW * CW, 1);
  const selU = B.sel && uById(B.sel), r = selU && B.phase === 'plan' ? reach(selU, moveOf(selU)) : null;
  if (r) { g.fillStyle = '#fcfc5438'; for (const c of r.values()) if (c.d) g.fillRect(BOX + c.x * CW + 1, BOY + c.y * CW + 1, CW - 1, CW - 1); }
  for (const k of B.obst) { const [x, y] = k.split(',').map(Number); g.drawImage(SPR.boulder(), BOX + x * CW, BOY + y * CW); }
  if (B.phase === 'plan') {
    for (const id in B.plans) {
      const u = uById(id), p = B.plans[id]; if (!u || u.side !== 'L' || p.t === 'def') continue;
      const t = p.t === 'atk' ? uById(p.target) : p; if (!t) continue;
      const [x0, y0] = cellC(u.x, u.y), [x1, y1] = cellC(t.x, t.y); dotLine(g, x0, y0, x1, y1, p.t === 'atk' ? '#e40058' : '#58d854');
    }
  }
  const vis = B.units.filter(u => !u.gone && (u.alive || u.deadAt == null || B.clock < u.deadAt + 0.6)).sort((a, b) => a.ry - b.ry);
  for (const u of vis) {
    let X = BOX + u.rx * CW, Y = BOY + u.ry * CW - 4, f = Math.floor(clock * 2 + u.ph) % 2, flash = false;
    for (const a of u.atk) { const k = (B.clock - a.at) / 0.3; if (k >= 0 && k <= 1) { f = 2; X += a.dx * Math.sin(k * Math.PI) * 7; Y += a.dy * Math.sin(k * Math.PI) * 7; } }
    for (const h of u.hit) { const k = B.clock - h; if (k >= 0 && k < 0.22) { flash = Math.floor(k * 20) % 2 === 0; X += Math.floor(k * 40) % 2 ? 1 : -1; } }
    const dying = u.deadAt != null && B.clock >= u.deadAt;
    if (dying) { const k = Math.min(1, (B.clock - u.deadAt) / 0.6); g.globalAlpha = 1 - k; Y += k * 6; }
    g.fillStyle = '#00000050'; g.fillRect(Math.round(X) + 5, BOY + u.ry * CW + 19, 14, 2); g.fillRect(Math.round(X) + 7, BOY + u.ry * CW + 21, 10, 1);
    g.drawImage((flash ? SPR.unitFlash : SPR.unit)(u.type, f, u.side === 'R'), Math.round(X), Math.round(Y));
    g.globalAlpha = 1;
    if (!dying) {
      const s = String(u.shown), w = s.length * 6 + 3, bx = Math.round(X) + (u.side === 'L' ? CW - w : 0), by = BOY + u.ry * CW + CW - 8;
      g.fillStyle = '#000'; g.fillRect(bx, by, w, 9); g.fillStyle = u.side === 'L' ? '#2050c0' : '#a00030'; g.fillRect(bx + 1, by + 1, w - 2, 7);
      g.font = '8px PS2P, monospace'; g.textAlign = 'left'; g.fillStyle = '#fcfcfc'; g.save(); g.translate(bx + 2, by + 8); g.scale(0.75, 0.875); g.fillText(s, 0, 0); g.restore();
      if (B.phase === 'plan' && B.plans[u.id] && B.plans[u.id].t === 'def' && u.side === 'L') { g.fillStyle = '#000'; g.fillRect(X + 1, Y + 3, 7, 8); g.fillStyle = '#f8b800'; g.fillRect(X + 2, Y + 4, 5, 5); g.fillRect(X + 3, Y + 9, 3, 1); }
    }
  }
  for (const p of B.proj) {
    const k = (B.clock - p.at) / p.dur; if (k < 0 || k > 1) continue;
    const [x0, y0] = cellC(p.fx, p.fy), [x1, y1] = cellC(p.tx, p.ty), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 14 - 4;
    if (p.kind === 'arrow') { const a = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * 14 * Math.PI, x1 - x0); for (let i = 0; i < 9; i++) { g.fillStyle = i < 2 ? '#fcfcfc' : i > 6 ? '#e40058' : '#c8a060'; g.fillRect(Math.round(x - Math.cos(a) * i), Math.round(y - Math.sin(a) * i), i < 2 ? 2 : 1, i < 2 ? 2 : 1); } }
    else { g.fillStyle = '#000'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); g.fillStyle = p.col; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); g.fillStyle = '#fcfcfc'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
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
  const s = Math.max(1, Math.floor(Math.min(CAM.w / BLW, CAM.h / BLH)));
  BV = {s, ox: Math.floor((CAM.w - BLW * s) / 2), oy: Math.floor((CAM.h - BLH * s) / 2)};
  ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#10101e'; ctx.fillRect(0, 0, CAM.w, CAM.h);
  ctx.drawImage(bcv, BV.ox, BV.oy, BLW * s, BLH * s);
}
function renderTitle() {
  const g = bctx; g.imageSmoothingEnabled = false;
  g.drawImage(SPR.field(BLW, BLH, CW, 99), 0, 0);
  for (let y = 0; y < 90; y++) { g.fillStyle = `rgb(${20 + y / 3},${20 + y / 2},${60 + y})`; g.fillRect(0, y, BLW, 1); }
  for (let i = 0; i < 30; i++) { if ((Math.floor(clock * 2) + i) % 5) { g.fillStyle = '#fcfcfc'; g.fillRect((i * 53) % BLW, (i * 29) % 80, 1, 1); } }
  g.drawImage(SPR.town('castle', 'player', Math.floor(clock * 4) % 2), 20, 64); g.drawImage(SPR.town('necro', 'ai', Math.floor(clock * 4) % 2), BLW - 56, 64);
  ['Peasant', 'Archer', 'Swordsman', 'Monk', 'Cavalier'].forEach((u, i) => g.drawImage(SPR.unit(u, Math.floor(clock * 2 + i * 0.5) % 2, false), 8 + i * 22, 120 + (i % 2) * 12));
  ['Skeleton', 'Zombie', 'Wight', 'Lich', 'BlackKnight'].forEach((u, i) => g.drawImage(SPR.unit(u, Math.floor(clock * 2 + i * 0.5) % 2, true), BLW - 32 - i * 22, 120 + (i % 2) * 12));
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
  const sig = JSON.stringify([r, G.day, h && [h.id, h.mp, h.mana, h.lvl, h.xp, h.att, h.def, h.sp, h.kn, h.army, h.arts.length], myHeroes().map(x => x.id + x.name), G.towns.map(t => t.owner), UI.mode]);
  if (sig === hudSig) return; hudSig = sig;
  const inc = income('player');
  $('res').innerHTML = RES.map(k => `<span title="${k} +${inc[k]}/day"><img src="${resImg(k)}" alt="${k}"><b>${r[k]}</b></span>`).join('');
  $('cal').textContent = 'DAY ' + ((G.day - 1) % 7 + 1) + ' WEEK ' + (Math.floor((G.day - 1) / 7) % 4 + 1) + ' MONTH ' + (Math.floor((G.day - 1) / 28) + 1);
  $('chip').innerHTML = h ? `<img src="${portraitImg(h)}" alt=""><div class="bars"><b>${h.name} LV${h.lvl}</b>MOVE ${meter(h.mp, maxMp(h), '#58d854')}MANA ${meter(h.mana, maxMana(h), '#3cbcfc')}</div>` : '<b>NO HERO</b>';
  $('sideinfo').innerHTML = h ? `<div class="hcard"><img src="${portraitImg(h)}" alt="" data-a="hero"><div><b>${h.name}</b><br>LEVEL ${h.lvl}<br>XP ${h.xp}/${xpForLevel(h.lvl)}${meter(h.xp, xpForLevel(h.lvl), '#f8b800')}</div></div>
    <div class="stats"><div>ATK<b>${stat(h, 'att')}</b></div><div>DEF<b>${stat(h, 'def')}</b></div><div>POW<b>${stat(h, 'sp')}</b></div><div>KNO<b>${stat(h, 'kn')}</b></div></div>
    <div>MOVE ${h.mp}/${maxMp(h)} ${meter(h.mp, maxMp(h), '#58d854')}MANA ${h.mana}/${maxMana(h)} ${meter(h.mana, maxMana(h), '#3cbcfc')}</div>
    <div class="slots">${Array.from({length: MAX_STACKS}, (_, i) => { const a = h.army[i]; return `<div class="slot" title="${a ? a.count + ' ' + a.type : ''}">${a ? `<img src="${unitImg(a.type)}" alt=""><s>${a.count}</s>` : ''}</div>`; }).join('')}</div>
    ${h.arts.length ? '<div>ARTIFACTS: ' + h.arts.map(k => ARTIFACTS[k].name).join(', ') + '</div>' : ''}` : '<b>No hero. Hire one at a Tavern.</b>';
  $('sidelists').innerHTML = `<h4>HEROES</h4>${myHeroes().map(x => `<button class="btn ${x === h ? 'y' : 'alt'}" data-a="selhero" data-v="${x.id}">${x.name} LV${x.lvl} (${x.mp} MOVE)</button>`).join('') || '-'}
    <h4>TOWNS</h4>${G.towns.filter(t => t.owner === 'player').map(t => `<button class="btn alt" data-a="opentown" data-v="${t.id}">${t.name}</button>`).join('') || '-'}`;
}
function syncBars() {
  const b = UI.mode === 'battle';
  $('battlebar').style.display = b ? 'contents' : 'none';
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
  renderMini(dt); updateHud(); syncBars();
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
    const head = `<div class="thead"><h2>${t.name.toUpperCase()}</h2>${btn('CLOSE', 'close', '', 'g')}</div><canvas class="tview" id="tview"></canvas>`;
    if (!own) return head + `<div class="cols"><p>Enemy town. Garrison: ${armyText(t.garrison)}</p></div>`;
    let s = head + `<div class="cols"><div><p>Income per day: ${costText(inc) || '0'}${t.builtToday ? '<br><span class="no">Already built today</span>' : ''}</p><h3>BUILD</h3>`;
    for (const k in BUILDINGS) {
      if (t.built.includes(k)) continue;
      const b = BUILDINGS[k], why = canBuild(t, k), desc = b.tier !== undefined ? 'Recruit ' + units[b.tier] : b.desc;
      s += `<div class="it"><div class="t">${b.name}<small>${desc} · ${costText(b.cost)}${why ? ` · <span class="no">${why}</span>` : ''}</small></div>${btn('BUILD', 'build', k, 'g', why)}</div>`;
    }
    s += `</div><div><h3>RECRUIT (to ${h ? h.name : 'garrison'})</h3>`;
    units.forEach((u, i) => {
      if (!t.built.includes('dw' + (i + 1))) return;
      const U = UNITS[u], n = t.avail[u] || 0, aff = Math.min(n, Math.floor(G.res.player.gold / U.cost));
      s += `<div class="it"><img src="${unitImg(u)}" alt=""><div class="t">${u} x${n}<small>${U.cost}g · ATK ${U.att} DEF ${U.def} HP ${U.hp} DMG ${U.dmg.join('-')} MOVE ${U.move}${U.range ? ' RANGE ' + U.range : ''} · ${U.skill}</small></div>${btn('+1', 'buy', u + ':1', 'alt', !aff)}${btn('ALL ' + aff, 'buy', u + ':999', 'y', !aff)}</div>`;
    });
    s += `<h3>ARMY</h3>`;
    if (h) h.army.forEach((a, i) => s += `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">${h.name}: ${a.count} ${a.type}</div>${btn('TO GARRISON', 'togar', i, 'alt', t.garrison.length >= MAX_STACKS && !t.garrison.some(g => g.type === a.type) || h.army.length < 2)}</div>`);
    t.garrison.forEach((a, i) => s += `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">Garrison: ${a.count} ${a.type}</div>${btn('TO HERO', 'tohero', i, 'alt', !h)}</div>`);
    if (!h && !t.garrison.length) s += '<p>No hero or garrison here.</p>';
    if (t.built.includes('tavern')) s += `<h3>TAVERN</h3><div class="it"><div class="t">Hire a hero<small>${HIRE_COST} gold, comes with 15 ${units[0]}s</small></div>${btn('HIRE', 'hire', '', 'g', h || G.res.player.gold < HIRE_COST)}</div>`;
    if (t.built.includes('guild1')) s += `<h3>MAGE GUILD</h3><p>${Object.keys(SPELLS).filter(k => SPELLS[k].lvl <= (t.built.includes('guild2') ? 2 : 1)).map(k => SPELLS[k].name + ' (' + SPELLS[k].mana + ' mana): ' + SPELLS[k].desc).join('<br>')}<br>Heroes visiting learn these and refill mana.</p>`;
    if (t.built.includes('market')) s += `<h3>MARKETPLACE</h3>` + ['wood', 'ore', 'gems'].map(r => `<div class="it"><div class="t">${r}<small>Buy 1 for ${r === 'gems' ? 500 : 250}g, sell 1 for ${r === 'gems' ? 100 : 50}g</small></div>${btn('BUY', 'trade', r + ':buy')}${btn('SELL', 'trade', r + ':sell', 'y', !G.res.player[r])}</div>`).join('');
    return s + `</div></div>`;
  }, {town: t.id, full: true, after: () => { const c = $('tview'); if (c) SPR.townView(c, t); }});
}
function openHero() {
  const h = curHero(); if (!h) { msg('No hero'); return; }
  showPanel(() => `<div class="hcard"><img src="${portraitImg(h)}" alt=""><h2>${h.name.toUpperCase()} - LEVEL ${h.lvl}</h2></div>
    <p>XP ${h.xp} / ${xpForLevel(h.lvl)}<br>ATTACK ${stat(h, 'att')} · DEFENSE ${stat(h, 'def')}<br>SPELL POWER ${stat(h, 'sp')} · KNOWLEDGE ${stat(h, 'kn')}<br>
    MOVE ${h.mp}/${maxMp(h)} · MANA ${h.mana}/${maxMana(h)}</p>
    <h3>ARTIFACTS</h3><p>${h.arts.map(k => ARTIFACTS[k].name + ' (+' + ARTIFACTS[k].val + ' ' + ARTIFACTS[k].stat + ')').join('<br>') || 'None'}</p>
    <h3>SPELLS</h3><p>${h.spells.map(k => SPELLS[k].name + ' - ' + SPELLS[k].desc).join('<br>') || 'None. Build a Mage Guild and visit it.'}</p>
    <h3>ARMY</h3>${h.army.map(a => `<div class="it"><img src="${unitImg(a.type)}" alt=""><div class="t">${a.count} ${a.type}<small>${SKILL_DESC[UNITS[a.type].skill]}</small></div></div>`).join('')}
    <div class="bar" style="margin-top:10px">${btn('CLOSE', 'close', '', 'g')}</div>`);
}
function openMenu() {
  const has = !!localStorage.getItem(SAVE_KEY), auto = !!localStorage.getItem(SAVE_KEY + '-auto');
  showPanel(() => `<h2>MENU</h2><div class="bar">${btn('SAVE', 'save', '', 'g', !G || UI.mode !== 'map')}${btn('LOAD', 'load', '', 'alt', !has)}${btn('LOAD AUTOSAVE', 'loadauto', '', 'alt', !auto)}${btn('NEW GAME', 'new', '', 'y')}${G ? btn('CLOSE', 'close', '', 'g') : ''}</div>
    <h3>HOW TO PLAY</h3><p>Explore, grab resources, flag mines and grow your army. Build dwellings in town; creatures grow each week (day 1 of every week).
    Capture the enemy town to win. Lose all towns and heroes and you lose.</p>
    <h3>BATTLE</h3><p>PLAN: tap your stack, then tap an empty tile (move), an enemy (attack) or the stack again (defend). Cast one spell per round with SPELL.
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
  trade: v => { const [r, m] = v.split(':'), buy = r === 'gems' ? 500 : 250, sell = r === 'gems' ? 100 : 50, R = G.res.player;
    if (m === 'buy' && R.gold >= buy) { R.gold -= buy; R[r]++; } else if (m === 'sell' && R[r] > 0) { R[r]--; R.gold += sell; } refreshPanel(); },
  chest: v => { const h = heroById(UI.panel.chestHero); if (v === 'gold') G.res.player.gold += 1000; else if (h) gainXp(h, 750); UI.panel.sticky = false; closePanel(); },
  lvl: s => { const h = heroById(UI.panel.lvlHero); if (h) { h[s]++; if (s === 'kn') h.mana += 10; } UI.panel.sticky = false; closePanel(); },
  save: () => { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); msg('Game saved'); SFX.pick(); closePanel(); },
  load: () => loadGame(SAVE_KEY), loadauto: () => loadGame(SAVE_KEY + '-auto'),
  new: () => { UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = []; newGame(); CAM.z = 0; hudSig = ''; UI.mode = 'map'; msg('Day 1. Tap a tile to plan a path, tap again to move.'); },
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
  opentown: id => openTown(G.towns.find(t => t.id === +id)),
};
function loadGame(key) {
  try { const g = JSON.parse(localStorage.getItem(key)); if (!g || g.v !== 2) throw 0; G = g; } catch (e) { msg('No valid save'); return; }
  UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = [];
  UI.mode = G.over ? 'over' : 'map'; msg('Game loaded - ' + calText(G.day)); CAM.z = 0; hudSig = '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  SFX.click(); const f = ACTIONS[b.dataset.a]; if (f) f(b.dataset.v);
});
$('panel').addEventListener('click', e => { if (e.target.id === 'panel') closePanel(); });
function battleTap(mx, my) {
  if (B.phase !== 'plan') return;
  const gx = Math.floor((mx - BOX) / CW), gy = Math.floor((my - BOY) / CW);
  if (gx < 0 || gy < 0 || gx >= BW || gy >= BH) return;
  const u = uAt(gx, gy);
  if (B.spellPick) {
    const sp = SPELLS[B.spellPick];
    if (u && (sp.target === 'enemy') === (u.side === 'R')) { B.spell.L = {k: B.spellPick, target: u.id}; msg(sp.name + ' on ' + u.type + ' planned'); }
    else msg('Not a valid target');
    B.spellPick = null; return;
  }
  const s = B.sel && uById(B.sel);
  if (!s) {
    if (u && u.side === 'L') { B.sel = u.id; SFX.click(); }
    else if (u) { const U = UNITS[u.type]; msg(`${u.count} ${u.type}: ATK ${U.att} DEF ${U.def} HP ${U.hp} MOVE ${U.move}${U.range ? ' RANGED' : ''} · ${SKILL_DESC[U.skill]}`); }
    return;
  }
  if (u && u === s) { B.plans[s.id] = {t: 'def'}; msg(s.type + ' will DEFEND (-30% dmg taken)'); }
  else if (u && u.side === 'L') { B.sel = u.id; SFX.click(); return; }
  else if (u) { B.plans[s.id] = {t: 'atk', target: u.id}; msg(s.type + (UNITS[s.type].range ? ' will SHOOT ' : ' will ATTACK ') + u.type); }
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
  if (ptrs.size === 1) drag = {moved: false}; else if (ptrs.size === 2) drag = {moved: true, pinch: pinchDist(), z: CAM.z};
});
cv.addEventListener('pointermove', e => {
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
  if (!ptrs.size) drag = null;
}
cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);
cv.addEventListener('wheel', e => { e.preventDefault(); if (UI.mode === 'battle' || UI.mode === 'title') return; const r = cv.getBoundingClientRect(); setZoom(CAM.z + (e.deltaY < 0 ? 1 : -1), (e.clientX - r.left) * CAM.dpr, (e.clientY - r.top) * CAM.dpr); }, {passive: false});
function tapAt(cx, cy) {
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
  if (UI.mode === 'battle') { if (e.key === 'Enter' || e.key === ' ') resolveRound(); if (e.key === 'a') ACTIONS.auto(); if (e.key === 's') ACTIONS.spell(); return; }
  if (e.key === '+' || e.key === '=') { setZoom(CAM.z + 1); return; } if (e.key === '-') { setZoom(CAM.z - 1); return; }
  if (UI.mode !== 'map') return;
  const k = e.key.toLowerCase(), d = {arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]}[k];
  const h = curHero();
  if (d && h && !UI.walk) { e.preventDefault(); const nx = h.x + d[0], ny = h.y + d[1]; if (inMap(nx, ny) && enterable(nx, ny, h)) startWalk(h, [[nx, ny]]); }
  else if (k === 'enter' && UI.preview && h) { startWalk(h, UI.preview.path); UI.preview = null; }
  else if (k === 'e') endDay(); else if (k === 't') ACTIONS.town(); else if (k === 'h') openHero(); else if (k === 'n') ACTIONS.next(); else if (k === 'm') openMenu();
});
$('mute').onclick = e => { e.stopPropagation(); muted = !muted; localStorage.setItem('mh-mute', muted ? '1' : '0'); $('mute').textContent = muted ? 'MUTE' : 'SND'; };
$('mute').textContent = muted ? 'MUTE' : 'SND';
window.MHX = {get G() { return G; }, get B() { return B; }, UI, CAM, ACTIONS, tapMap, battleTap, endDay, resolveRound, cell: (x, y) => [BOX + x * CW + CW / 2, BOY + y * CW + CW / 2], tileToClient: (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + ((x * TS + TS / 2 - CAM.x) * CAM.z) / CAM.dpr, r.top + ((y * TS + TS / 2 - CAM.y) * CAM.z) / CAM.dpr]; }}; // test hook
openMenu();
requestAnimationFrame(loop);
