// Mini Heroes - logic + rendering. G = saved game state, UI = screen state, B = current battle.
'use strict';
const MW = 24, MH = 18, TS = 20, BW = 10, BH = 7, CW = 44, BOX = 20, BOY = 40;
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
    round: 1, phase: 'plan', units: [], obst: new Set(), plans: {}, spell: {L: null, R: null}, sel: null, spellPick: null, log: ''};
  B.fort = ctx.def.town && ctx.def.town.built.includes('fort') ? (L === 'def' ? 'L' : 'R') : null;
  const rows = [3, 1, 5, 0, 6, 2, 4];
  for (const side of ['L', 'R']) {
    let i = 0;
    B.sides[side].arrs.forEach((arr, src) => arr.forEach(s => {
      if (i >= MAX_STACKS || s.count <= 0) return;
      const ranged = UNITS[s.type].range > 0, x = side === 'L' ? (ranged ? 0 : 1) : (ranged ? BW - 1 : BW - 2), y = rows[i++];
      B.units.push({id: side + i, side, type: s.type, count: s.count, start: s.count, tot: s.count * UNITS[s.type].hp, x, y, rx: x, ry: y, src, alive: true});
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
  if (s.k === 'arrow' || s.k === 'lightning') { const d = s.k === 'arrow' ? 10 + 10 * SP : 10 + 25 * SP; t.tot -= d; fx(t, '-' + d, '#d858f8'); }
  if (s.k === 'cure') { const v = Math.min(10 + 5 * SP, t.start * ut.hp - t.tot); t.tot += Math.max(0, v); fx(t, '+' + Math.max(0, v), '#58d854'); }
  if (s.k === 'haste') { t.haste = 1; fx(t, 'HASTE', '#3cbcfc'); }
  if (s.k === 'slow') { if (ut.skill === 'Undead') fx(t, 'IMMUNE', '#aaa'); else { t.slow = 1; fx(t, 'SLOW', '#f8b800'); } }
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
  const out = [];
  // 1. spells
  castSpell('L', out); castSpell('R', out);
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
    h.t.tot -= h.d; fx(h.t, '-' + h.d + (h.tags.length ? ' ' + h.tags[0] : ''), h.tags.includes('RETAL') ? '#f8b800' : '#fcfcfc');
  }
  if (hits.length) SFX.hit();
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
  if (!lAlive || !rAlive || B.round > 30) { setTimeout(() => endBattle(lAlive && !rAlive), 700); msg(B.log); return; }
  setTimeout(() => { if (B) { B.phase = 'plan'; B.sel = firstUnplanned(); msg('Round ' + B.round + ' - PLAN. ' + B.log); } }, 600);
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

// ---------- floating text (time-based) ----------
function fx(u, text, col) { UI.fx.push({x: u.x, y: u.y, text, col, t: 0, life: 1.2}); }

// ---------- rendering ----------
function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function text(s, x, y, c = '#fff', size = 8, align = 'center') { ctx.font = size + "px PS2P, monospace"; ctx.textAlign = align; ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = c; ctx.fillText(s, x, y); }
const ownerCol = o => o === 'player' ? '#3cbcfc' : o === 'ai' ? '#e40058' : '#7c7c7c';
function drawTile(x, y) {
  const t = G.map[y][x], T = TERRAIN[t], X = x * TS, Y = y * TS;
  px(X, Y, TS, TS, T.col);
  const s = (x * 7 + y * 13) % 5;
  px(X + 3 + s * 2, Y + 4 + s, 2, 2, T.dot); px(X + 13 - s, Y + 13 - s, 2, 2, T.dot);
  if (t === 2) { px(X + 6, Y + 3, 8, 10, '#0d4a0d'); px(X + 4, Y + 7, 12, 6, '#167016'); px(X + 9, Y + 13, 3, 5, '#5a3a1a'); }
  if (t === 3) { px(X + 3, Y + 10, 14, 8, '#5a5a5a'); px(X + 6, Y + 5, 8, 6, '#8c8c8c'); px(X + 8, Y + 4, 3, 2, '#fff'); }
  if (t === 4) { px(X + 4, Y + 7, 6, 2, '#6aa0ff'); px(X + 11, Y + 13, 5, 2, '#6aa0ff'); }
}
function drawObj(o) {
  const X = o.x * TS, Y = o.y * TS;
  if (o.kind === 'res') { const c = RES_COL[o.res]; px(X + 5, Y + 9, 10, 7, '#000'); px(X + 6, Y + 10, 8, 5, c); px(X + 8, Y + 7, 4, 3, c); }
  if (o.kind === 'chest') { px(X + 4, Y + 7, 12, 10, '#000'); px(X + 5, Y + 8, 10, 8, '#8b4513'); px(X + 5, Y + 11, 10, 1, '#f8b800'); px(X + 9, Y + 10, 2, 3, '#f8b800'); }
  if (o.kind === 'art') { px(X + 8, Y + 3, 4, 14, '#f8b800'); px(X + 3, Y + 8, 14, 4, '#f8b800'); px(X + 8, Y + 8, 4, 4, '#fff'); }
  if (o.kind === 'mine') {
    px(X + 2, Y + 6, 16, 12, '#000'); px(X + 3, Y + 7, 14, 10, '#5a4030'); px(X + 7, Y + 11, 6, 6, '#000'); px(X + 4, Y + 8, 4, 3, RES_COL[MINES[o.mine].res]);
    px(X + 15, Y + 1, 2, 8, '#000'); px(X + 17, Y + 1, 3, 4, ownerCol(o.owner));
  }
  if (o.kind === 'monster' && o.army.length) {
    const c = UNITS[o.army[0].type].col;
    px(X + 4, Y + 3, 12, 14, '#000'); px(X + 5, Y + 4, 10, 12, c); px(X + 7, Y + 7, 2, 2, '#e40058'); px(X + 11, Y + 7, 2, 2, '#e40058'); px(X + 7, Y + 12, 6, 2, '#000');
  }
}
function drawTown(t) {
  const X = t.x * TS, Y = t.y * TS, c = ownerCol(t.owner);
  px(X - 4, Y - 2, 28, 22, '#000'); px(X - 3, Y + 6, 26, 13, '#c8c8c8');
  for (let i = 0; i < 4; i++) px(X - 3 + i * 7, Y + 2, 5, 5, '#c8c8c8');
  px(X + 6, Y + 11, 8, 8, '#3a2a1a'); px(X + 8, Y - 8, 2, 10, '#000'); px(X + 10, Y - 8, 7, 5, c);
}
function drawHero(h, sel) {
  const p = UI.rpos[h.id] || (UI.rpos[h.id] = {x: h.x, y: h.y}), X = p.x * TS, Y = p.y * TS, c = ownerCol(h.owner);
  if (sel) { ctx.strokeStyle = '#f8b800'; ctx.lineWidth = 2; ctx.strokeRect(X + 1, Y + 1, TS - 2, TS - 2); }
  px(X + 3, Y + 10, 14, 7, '#000'); px(X + 4, Y + 11, 12, 5, '#8b5a2b'); px(X + 4, Y + 16, 2, 3, '#000'); px(X + 14, Y + 16, 2, 3, '#000');
  px(X + 7, Y + 2, 6, 9, '#000'); px(X + 8, Y + 3, 4, 7, c); px(X + 8, Y + 1, 4, 3, '#f8d8a8'); px(X + 13, Y + 0, 2, 12, '#fcfcfc');
}
function renderMap() {
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawTile(x, y);
  G.objs.forEach(drawObj); G.towns.forEach(drawTown);
  const sel = curHero();
  G.heroes.forEach(h => drawHero(h, h === sel));
  if (UI.preview && sel) UI.preview.path.forEach(([x, y], i) => {
    const ok = UI.preview.cost[i] <= sel.mp, last = i === UI.preview.path.length - 1;
    px(x * TS + (last ? 6 : 8), y * TS + (last ? 6 : 8), last ? 8 : 4, last ? 8 : 4, ok ? '#58d854' : '#e40058');
  });
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!G.fog[y][x]) px(x * TS, y * TS, TS, TS, '#05050c');
}
function renderBattle(dt) {
  px(0, 0, 480, 360, '#1c1c3a');
  text('ROUND ' + B.round + ' - ' + (B.phase === 'plan' ? 'PLAN PHASE' : 'RESOLVE'), 240, 16, B.phase === 'plan' ? '#f8b800' : '#58d854', 9);
  const hl = heroOf('L'), hr = heroOf('R');
  text(hl ? hl.name + ' MANA ' + hl.mana : 'GARRISON', BOX, 32, '#3cbcfc', 7, 'left');
  text(hr ? hr.name + ' MANA ' + hr.mana : (B.sides.R.monster ? 'NEUTRALS' : 'GARRISON'), 460, 32, '#e40058', 7, 'right');
  const selU = B.sel && uById(B.sel), r = selU && B.phase === 'plan' ? reach(selU, moveOf(selU)) : null;
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const X = BOX + x * CW, Y = BOY + y * CW;
    px(X, Y, CW, CW, '#000'); px(X + 1, Y + 1, CW - 2, CW - 2, (x + y) % 2 ? '#2d6a2d' : '#337a33');
    if (r && r.has(x + ',' + y) && !(x === selU.x && y === selU.y)) px(X + 1, Y + 1, CW - 2, CW - 2, '#58d85455');
    if (B.obst.has(x + ',' + y)) { px(X + 8, Y + 18, 28, 20, '#5a5a5a'); px(X + 13, Y + 10, 18, 10, '#8c8c8c'); }
  }
  for (const u of B.units) {
    if (!u.alive) continue;
    const k = 1 - Math.exp(-dt * 10); u.rx += (u.x - u.rx) * k; u.ry += (u.y - u.ry) * k;
    const X = BOX + u.rx * CW, Y = BOY + u.ry * CW, U = UNITS[u.type], sc = u.side === 'L' ? '#3cbcfc' : '#e40058';
    px(X + 6, Y + 4, 32, 30, '#000'); px(X + 8, Y + 6, 28, 26, U.col); px(X + 8, Y + 6, 28, 4, sc);
    px(X + (u.side === 'L' ? 26 : 12), Y + 14, 4, 4, '#000');
    text(u.type.slice(0, 3).toUpperCase(), X + 22, Y + 26, '#000', 7);
    px(X + 4, Y + 32, 36, 11, '#000'); text(String(u.count), X + 22, Y + 41, '#f8b800', 7);
  }
  if (B.phase === 'plan') {
    for (const id in B.plans) {
      const u = uById(id), p = B.plans[id]; if (!u || u.side !== 'L') continue;
      const ux = BOX + u.x * CW + 22, uy = BOY + u.y * CW + 20;
      if (p.t === 'def') { text('DEF', ux, uy - 10, '#f8b800', 7); continue; }
      const t = p.t === 'atk' ? uById(p.target) : p; if (!t) continue;
      ctx.strokeStyle = p.t === 'atk' ? '#e40058' : '#58d854'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(BOX + t.x * CW + 22, BOY + t.y * CW + 20); ctx.stroke();
      px(BOX + t.x * CW + 18, BOY + t.y * CW + 16, 8, 8, ctx.strokeStyle);
    }
    const s = B.spell.L && uById(B.spell.L.target);
    if (s) { ctx.strokeStyle = '#d858f8'; ctx.lineWidth = 3; ctx.strokeRect(BOX + s.x * CW + 2, BOY + s.y * CW + 2, CW - 4, CW - 4); }
    if (selU) { ctx.strokeStyle = '#f8b800'; ctx.lineWidth = 3; ctx.strokeRect(BOX + selU.x * CW + 1, BOY + selU.y * CW + 1, CW - 2, CW - 2); }
  }
}
function renderFx(dt) {
  UI.fx = UI.fx.filter(f => (f.t += dt) < f.life);
  if (UI.mode !== 'battle') return;
  for (const f of UI.fx) text(f.text, BOX + f.x * CW + 22, BOY + f.y * CW + 10 - f.t * 24, f.col, 8);
}
function renderTitle() {
  px(0, 0, 480, 360, '#0f0f1b');
  for (let i = 0; i < 24; i++) px((i * 53) % 480, (i * 97) % 200, 3, 3, '#fcfcfc');
  px(0, 250, 480, 110, '#2d7a2d');
  text('MINI HEROES', 240, 110, '#f8b800', 22); text('MIGHT, MAGIC & PLANS', 240, 140, '#3cbcfc', 9);
}
function updateHud() {
  if (!G) return;
  const r = G.res.player;
  $('res').innerHTML = RES.map(k => `<span class="r" style="background:${RES_COL[k]}"></span><b>${r[k]}</b>`).join(' ');
  $('cal').textContent = calText(G.day);
  const h = curHero();
  $('herobar').textContent = h ? `${h.name} LV${h.lvl} MOVE ${h.mp}/${maxMp(h)} MANA ${h.mana}/${maxMana(h)} ARMY ${h.army.reduce((s, a) => s + a.count, 0)}` : 'No hero';
}
function syncBars() {
  const b = UI.mode === 'battle';
  $('battlebar').style.display = b ? 'flex' : 'none';
  $('mapbar').style.display = b ? 'none' : 'flex';
  document.querySelectorAll('#mapbar .btn').forEach(e => e.disabled = UI.mode !== 'map');
}

// ---------- main loop (all timers use real elapsed time, so speed is frame-rate independent) ----------
let last = performance.now();
const STEP = 0.13;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (msgTimer > 0 && (msgTimer -= dt) <= 0 && UI.mode === 'map') $('msg').textContent = '';
  if (!UI.panel) {
    if (UI.walk && UI.mode === 'map') { UI.walk.t += dt; while (UI.walk && UI.walk.t >= STEP) { UI.walk.t -= STEP; walkStep(); } }
    if (UI.ai && UI.mode === 'aiturn') { UI.ai.t += dt; while (UI.ai && UI.mode === 'aiturn' && !UI.panel && UI.ai.t >= STEP * 0.7) { UI.ai.t -= STEP * 0.7; aiStep(); } }
    nextLevelUp();
  }
  if (G) for (const h of G.heroes) { const p = UI.rpos[h.id] || (UI.rpos[h.id] = {x: h.x, y: h.y}), k = 1 - Math.exp(-dt * 14); p.x += (h.x - p.x) * k; p.y += (h.y - p.y) * k; }
  if (UI.mode === 'title' || !G) renderTitle(); else if (UI.mode === 'battle' && B) renderBattle(dt); else renderMap();
  renderFx(dt);
  updateHud(); syncBars();
  requestAnimationFrame(loop);
}

// ---------- panels ----------
function showPanel(fn, opts = {}) { UI.panel = Object.assign({fn}, opts); $('pbox').innerHTML = fn(); $('panel').classList.add('show'); }
function refreshPanel() { if (UI.panel) $('pbox').innerHTML = UI.panel.fn(); }
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
    if (!own) return `<h2>${t.name}</h2><p>Enemy town. Garrison: ${armyText(t.garrison)}</p>${btn('CLOSE', 'close', '', 'g')}`;
    let s = `<h2>${t.name.toUpperCase()}</h2><p>Income per day: ${costText(inc) || '0'}${t.builtToday ? '<br><span class="no">Already built today</span>' : ''}</p><h3>BUILD</h3>`;
    for (const k in BUILDINGS) {
      if (t.built.includes(k)) continue;
      const b = BUILDINGS[k], why = canBuild(t, k), desc = b.tier !== undefined ? 'Recruit ' + units[b.tier] : b.desc;
      s += `<div class="it"><div class="t">${b.name}<small>${desc} · ${costText(b.cost)}${why ? ` · <span class="no">${why}</span>` : ''}</small></div>${btn('BUILD', 'build', k, 'g', why)}</div>`;
    }
    s += `<h3>RECRUIT (to ${h ? h.name : 'garrison'})</h3>`;
    units.forEach((u, i) => {
      if (!t.built.includes('dw' + (i + 1))) return;
      const U = UNITS[u], n = t.avail[u] || 0, aff = Math.min(n, Math.floor(G.res.player.gold / U.cost));
      s += `<div class="it"><div class="t">${u} x${n}<small>${U.cost}g · ATK ${U.att} DEF ${U.def} HP ${U.hp} DMG ${U.dmg.join('-')} MOVE ${U.move}${U.range ? ' RANGE ' + U.range : ''} · ${U.skill}</small></div>${btn('+1', 'buy', u + ':1', 'alt', !aff)}${btn('ALL ' + aff, 'buy', u + ':999', 'y', !aff)}</div>`;
    });
    s += `<h3>ARMY</h3>`;
    if (h) h.army.forEach((a, i) => s += `<div class="it"><div class="t">${h.name}: ${a.count} ${a.type}</div>${btn('TO GARRISON', 'togar', i, 'alt', t.garrison.length >= MAX_STACKS && !t.garrison.some(g => g.type === a.type) || h.army.length < 2)}</div>`);
    t.garrison.forEach((a, i) => s += `<div class="it"><div class="t">Garrison: ${a.count} ${a.type}</div>${btn('TO HERO', 'tohero', i, 'alt', !h)}</div>`);
    if (!h && !t.garrison.length) s += '<p>No hero or garrison here.</p>';
    if (t.built.includes('tavern')) s += `<h3>TAVERN</h3><div class="it"><div class="t">Hire a hero<small>${HIRE_COST} gold, comes with 15 ${units[0]}s</small></div>${btn('HIRE', 'hire', '', 'g', h || G.res.player.gold < HIRE_COST)}</div>`;
    if (t.built.includes('guild1')) s += `<h3>MAGE GUILD</h3><p>${Object.keys(SPELLS).filter(k => SPELLS[k].lvl <= (t.built.includes('guild2') ? 2 : 1)).map(k => SPELLS[k].name + ' (' + SPELLS[k].mana + ' mana): ' + SPELLS[k].desc).join('<br>')}<br>Heroes visiting learn these and refill mana.</p>`;
    if (t.built.includes('market')) s += `<h3>MARKETPLACE</h3>` + ['wood', 'ore', 'gems'].map(r => `<div class="it"><div class="t">${r}<small>Buy 1 for ${r === 'gems' ? 500 : 250}g, sell 1 for ${r === 'gems' ? 100 : 50}g</small></div>${btn('BUY', 'trade', r + ':buy')}${btn('SELL', 'trade', r + ':sell', 'y', !G.res.player[r])}</div>`).join('');
    return s + `<div class="bar" style="margin-top:10px">${btn('CLOSE', 'close', '', 'g')}</div>`;
  }, {town: t.id});
}
function openHero() {
  const h = curHero(); if (!h) { msg('No hero'); return; }
  showPanel(() => `<h2>${h.name.toUpperCase()} - LEVEL ${h.lvl}</h2>
    <p>XP ${h.xp} / ${xpForLevel(h.lvl)}<br>ATTACK ${stat(h, 'att')} · DEFENSE ${stat(h, 'def')}<br>SPELL POWER ${stat(h, 'sp')} · KNOWLEDGE ${stat(h, 'kn')}<br>
    MOVE ${h.mp}/${maxMp(h)} · MANA ${h.mana}/${maxMana(h)}</p>
    <h3>ARTIFACTS</h3><p>${h.arts.map(k => ARTIFACTS[k].name + ' (+' + ARTIFACTS[k].val + ' ' + ARTIFACTS[k].stat + ')').join('<br>') || 'None'}</p>
    <h3>SPELLS</h3><p>${h.spells.map(k => SPELLS[k].name + ' - ' + SPELLS[k].desc).join('<br>') || 'None. Build a Mage Guild and visit it.'}</p>
    <h3>ARMY</h3>${h.army.map(a => `<div class="it"><div class="t">${a.count} ${a.type}<small>${SKILL_DESC[UNITS[a.type].skill]}</small></div></div>`).join('')}
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
  new: () => { UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = []; newGame(); UI.mode = 'map'; msg('Day 1. Tap a tile to plan a path, tap again to move.'); },
  cast: k => { closePanel(); if (!B) return; if (!k) { B.spell.L = null; B.spellPick = null; msg('No spell this round'); } else { B.spellPick = k; msg('Tap a target for ' + SPELLS[k].name); SFX.magic(); } },
  endday: () => endDay(), town: () => { const h = curHero(), t = (h && townAt(h.x, h.y) && townAt(h.x, h.y).owner === 'player') ? townAt(h.x, h.y) : G.towns.find(t => t.owner === 'player'); t ? openTown(t) : msg('You have no town!'); },
  hero: () => openHero(), menu: () => openMenu(),
  next: () => { const hs = myHeroes(); if (!hs.length) return; const i = hs.indexOf(curHero()); G.sel = hs[(i + 1) % hs.length].id; UI.preview = null; msg(curHero().name + ' selected'); },
  resolve: () => resolveRound(), spell: () => B && B.phase === 'plan' && openSpells(),
  auto: () => { if (B && B.phase === 'plan') { planSide('L', true); B.sel = null; msg('All stacks planned. Press RESOLVE.'); } },
  binfo: () => openMenu(),
};
function loadGame(key) {
  try { const g = JSON.parse(localStorage.getItem(key)); if (!g || g.v !== 2) throw 0; G = g; } catch (e) { msg('No valid save'); return; }
  UI.panel = null; $('panel').classList.remove('show'); B = null; UI.ai = null; UI.walk = null; UI.preview = null; UI.rpos = {}; UI.levelQ = [];
  UI.mode = G.over ? 'over' : 'map'; msg('Game loaded - ' + calText(G.day));
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
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left) * cv.width / r.width, my = (e.clientY - r.top) * cv.height / r.height;
  if (UI.panel) return;
  if (UI.mode === 'title') { openMenu(); return; }
  if (UI.mode === 'map') tapMap(Math.floor(mx / TS), Math.floor(my / TS));
  else if (UI.mode === 'battle' && B) battleTap(mx, my);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closePanel(); return; }
  if (UI.panel) return;
  if (UI.mode === 'battle') { if (e.key === 'Enter' || e.key === ' ') resolveRound(); if (e.key === 'a') ACTIONS.auto(); if (e.key === 's') ACTIONS.spell(); return; }
  if (UI.mode !== 'map') return;
  const k = e.key.toLowerCase(), d = {arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]}[k];
  const h = curHero();
  if (d && h && !UI.walk) { e.preventDefault(); const nx = h.x + d[0], ny = h.y + d[1]; if (inMap(nx, ny) && enterable(nx, ny, h)) startWalk(h, [[nx, ny]]); }
  else if (k === 'enter' && UI.preview && h) { startWalk(h, UI.preview.path); UI.preview = null; }
  else if (k === 'e') endDay(); else if (k === 't') ACTIONS.town(); else if (k === 'h') openHero(); else if (k === 'n') ACTIONS.next(); else if (k === 'm') openMenu();
});
$('mute').onclick = e => { e.stopPropagation(); muted = !muted; localStorage.setItem('mh-mute', muted ? '1' : '0'); $('mute').textContent = muted ? 'MUTE' : 'SND'; };
$('mute').textContent = muted ? 'MUTE' : 'SND';
window.MHX = {get G() { return G; }, get B() { return B; }, UI, ACTIONS, tapMap, battleTap, endDay, resolveRound}; // test hook
openMenu();
requestAnimationFrame(loop);
