// Headless sim tests: node games/galaxy/test-sim.js
const S = require('./sim.js'), B = S.BT, D = S.D;
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
const ALL = { cruiser: 1, battleship: 1, carrier: 1, laser2: 1, railgun2: 1, warp: 1, jammer: 1 };
const T = {}; for (const t of D.TEMPLATES) T[t.id] = B.compile(t, ALL).s;
const cost = list => list.reduce((a, [id, n]) => a + Object.values(T[id].cost).reduce((x, y) => x + y, 0) * n, 0);
const mk = (list, tab = T) => { const s = []; for (const [id, n] of list) for (let i = 0; i < n; i++) s.push({ st: tab[id], hp: tab[id].hp, ar: tab[id].armor }); return s; };
const rng = seed => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// 1. battleship spam vs mixed fleet of equal command points / similar cost
{
  const spam = [['dread', 4]], mix = [['raider', 8], ['escort', 4], ['linecruiser', 4]];
  let wins = 0; const N = 40;
  for (let i = 0; i < N; i++) { const r = rng(i + 1), a = { name: 'spam', ships: mk(spam) }, b = { name: 'mix', ships: mk(mix) };
    const res = i % 2 ? B.fight(r, a, b) : B.fight(r, b, a); if ((i % 2 ? res.winner === 'B' : res.winner === 'A')) wins++; }
  console.log(`  spam cost ${cost(spam)} (32 cmd) vs mixed cost ${cost(mix)} (32 cmd): mixed won ${wins}/${N}`);
  ok(cost(mix) <= cost(spam) && wins >= N * .8, 'mixed fleet beats equal-command battleship spam (>=80%)');
  const sw = [['raider', 32]]; let sWins = 0;
  for (let i = 0; i < N; i++) { const res = B.fight(rng(100 + i), { name: 'swarm', ships: mk(sw) }, { name: 'spam', ships: mk(spam) }); if (res.winner === 'A') sWins++; }
  console.log(`  corvette torpedo swarm vs battleships: swarm won ${sWins}/${N}`);
  ok(sWins >= N * .8, 'torpedo corvette swarm counters battleship spam');
  const anti = [['warden', 8], ['escort', 4], ['linecruiser', 2]]; let aWins = 0;
  for (let i = 0; i < N; i++) { const res = B.fight(rng(200 + i), { name: 'anti', ships: mk(anti) }, { name: 'swarm', ships: mk(sw) }); if (res.winner === 'A') aWins++; }
  console.log(`  flak/PD screen vs corvette swarm: screen won ${aWins}/${N}`);
  ok(aWins >= N * .8, 'flak + point-defense fleet counters the corvette swarm');
}
// 2. weapon counters: laser vs armor, railgun vs shield
{
  const X = {}; const c = d => (X[d.id] = B.compile(d, ALL, true).s);
  c({ id: 'las', hull: 'destroyer', mods: ['laser', 'laser', 'laser'] });
  c({ id: 'rail', hull: 'destroyer', mods: ['railgun', 'railgun', 'railgun'] });
  c({ id: 'armorBrick', hull: 'cruiser', mods: ['armor', 'armor', 'armor', 'armor'] });
  c({ id: 'shieldBrick', hull: 'cruiser', mods: ['shield', 'shield', 'shield', 'shield'] });
  const dmg = (att, def) => { let tot = 0; for (let i = 0; i < 20; i++) { const d = mk([[def, 3]], X); const r = B.fight(rng(300 + i), { name: 'a', ships: mk([[att, 6]], X) }, { name: 'd', ships: d });
    tot += r.rounds.reduce((a, x) => a + x.sides[0].dmg.shield + x.sides[0].dmg.armor + x.sides[0].dmg.hull, 0); } return Math.round(tot / 20); };
  const la = dmg('las', 'armorBrick'), ra = dmg('rail', 'armorBrick'), ls = dmg('las', 'shieldBrick'), rs = dmg('rail', 'shieldBrick');
  console.log(`  avg damage dealt: laser->armor ${la}, railgun->armor ${ra}, laser->shield ${ls}, railgun->shield ${rs}`);
  ok(la > ra * 1.4, 'laser beats railgun against armor');
  ok(rs > ls * 1.6, 'railgun beats laser against shields');
}
// 3. redirect mid-flight keeps position continuous
{
  const st = S.newGame(7), home = S.byId(st, st.emp.player.home);
  const L = S.act(st, 'player', { type: 'launch', base: home.id }); ok(L.ok, 'launch fleet from home planet');
  const f = S.byId(st, L.id);
  S.act(st, 'player', { type: 'stance', fleet: f.id, stance: 'passive' });
  S.act(st, 'player', { type: 'move', fleet: f.id, x: home.x + 40, y: home.y });
  for (let i = 0; i < 12; i++) S.step(st);
  const before = S.pos(st, f);
  S.act(st, 'player', { type: 'move', fleet: f.id, x: home.x, y: home.y - 40 });
  const after = S.pos(st, f);
  S.step(st); const next = S.pos(st, f);
  const jump = Math.hypot(after.x - before.x, after.y - before.y);
  console.log(`  pos before redirect (${before.x.toFixed(2)},${before.y.toFixed(2)}) after (${after.x.toFixed(2)},${after.y.toFixed(2)}) next tick (${next.x.toFixed(2)},${next.y.toFixed(2)})`);
  ok(before.x > home.x + 5 && jump < 1e-9, 'redirect does not teleport the fleet');
  ok(next.y < after.y && Math.abs(next.x - after.x) < Math.abs(next.y - after.y), 'fleet heads to the new destination after redirect');
  // supply debuff: far from any own base the fleet slows down
  const inS = S.fleetSpeed(st, f); f.x0 = f.x1 = 100; f.y0 = f.y1 = 60; f.t0 = st.tick; S.step(st);
  ok(!f.supply && f.spd < inS, `out of supply fleet slows (${inS} -> ${f.spd})`);
  // chase moving target
  const g = S.newFleet(st, 'pirates', 110, 60, [S.mkShip(st.emp.pirates, 'raider')]);
  S.act(st, 'pirates', { type: 'move', fleet: g.id, x: 150, y: 60 });
  S.act(st, 'player', { type: 'chase', fleet: f.id, target: g.id });
  let fought = false; for (let i = 0; i < 400 && !fought; i++) { const n = st.reports.length; S.step(st); fought = st.reports.length > n; }
  ok(fought, 'chase order catches a moving enemy fleet and starts a battle');
}
// 4. warp retreat losses, debuff, cooldown and jammer
{
  const st = S.newGame(9), e = st.emp.player; e.research.warp = true;
  const f = S.newFleet(st, 'player', 100, 40, Array.from({ length: 10 }, () => S.mkShip(e, 'hunter')));
  const r = S.act(st, 'player', { type: 'warp', fleet: f.id });
  const home = S.byId(st, e.home), p = S.pos(st, f);
  console.log(`  warp: ${r.ok}, ships 10 -> ${f.ships.length}, now ${S.dist(p, home).toFixed(1)} from home, speed debuffed ${f.dmgUntil > st.tick}`);
  ok(r.ok && f.ships.length === 8 && S.dist(p, home) < 6 && f.dmgUntil > st.tick, 'warp retreat jumps home, loses 20%, damaged debuff');
  ok(!S.act(st, 'player', { type: 'warp', fleet: f.id }).ok, 'warp has a cooldown');
  const g = S.newFleet(st, 'player', 100, 40, [S.mkShip(e, 'hunter'), S.mkShip(e, 'hunter')]);
  st.starbases.push({ id: 's999', owner: 'ai1', x: 105, y: 40, r: 3, hp: 100, ar: 0, store: { metal: 0, crystal: 0, gas: 0, energy: 0 }, garrison: [], jammer: true });
  ok(!S.act(st, 'player', { type: 'warp', fleet: g.id }).ok, 'enemy Star Base Warp Jammer blocks warp nearby');
  // auto warp inside a losing battle
  const weak = S.newFleet(st, 'player', 60, 150, Array.from({ length: 6 }, () => S.mkShip(e, 'picket')));
  const big = S.newFleet(st, 'ai2', 62, 150, Array.from({ length: 6 }, () => S.mkShip(st.emp.ai2, 'hunter')));
  const rep = S.fleetBattle(st, big, weak);
  console.log(`  auto-warp battle: ${rep.outcome}; rounds ${rep.rounds.length}`);
  ok(/warped out|destroyed/.test(rep.outcome), 'losing fleet with auto-warp escapes (or dies before threshold)');
}
// 5. colony capture
{
  const st = S.newGame(11), e = st.emp.player;
  const col = st.planets.find(p => !p.owner); col.owner = 'ai1'; col.kind = 'colony';
  const f = S.newFleet(st, 'player', col.x + 1, col.y, Array.from({ length: 6 }, () => S.mkShip(e, 'hunter')).concat(Array.from({ length: 4 }, () => S.mkShip(e, 'raider'))));
  S.act(st, 'player', { type: 'attack', fleet: f.id, target: col.id });
  S.step(st);
  const rep = st.reports[st.reports.length - 1];
  console.log('  ' + (rep ? rep.outcome : 'no battle'));
  ok(col.owner === 'player' && col.kind === 'colony', 'empire fleet captures an undefended enemy colony');
  const home = S.byId(st, st.emp.ai2.home), before = st.emp.ai2.res.metal;
  st.emp.ai2.bld.defense = 0; home.garrison = [];
  const g = S.newFleet(st, 'player', home.x + 1, home.y, Array.from({ length: 6 }, () => S.mkShip(e, 'hunter')));
  S.act(st, 'player', { type: 'attack', fleet: g.id, target: home.id }); S.step(st);
  ok(home.owner === 'ai2' && st.emp.ai2.res.metal < before && g.cargo.metal > 0, 'home planets are raided, never captured');
}
// 6. star base destruction drops stored supplies
{
  const st = S.newGame(13), e = st.emp.player; e.res.metal = 5000;
  const home = S.byId(st, e.home);
  home.garrison.push(S.mkShip(e, 'builder'));
  const r = S.act(st, 'player', { type: 'starbase', x: home.x + 20, y: home.y - 25 }); ok(r.ok, 'construction ship dispatched');
  for (let i = 0; i < 400 && !st.starbases.length; i++) S.step(st);
  const sb = st.starbases[0]; ok(!!sb, 'star base built in empty space');
  S.act(st, 'player', { type: 'deposit', base: sb.id, amount: 400 });
  const stored = sb.store.metal;
  const atk = S.newFleet(st, 'ai1', sb.x + 1, sb.y, Array.from({ length: 10 }, () => S.mkShip(st.emp.ai1, 'raider')).concat(Array.from({ length: 6 }, () => S.mkShip(st.emp.ai1, 'hunter'))));
  let rep = null;
  for (let k = 0; k < 6 && st.starbases.includes(sb); k++) { // keep reinforcing until the base falls
    atk.ships.push(...Array.from({ length: 8 }, () => S.mkShip(st.emp.ai1, 'hunter'))); atk.x0 = atk.x1 = sb.x + 1; atk.y0 = atk.y1 = sb.y; atk.t0 = st.tick; atk.dmgUntil = 0;
    rep = S.baseBattle(st, atk, sb);
  }
  console.log(`  ${rep.outcome}; attacker cargo metal ${Math.floor(atk.cargo.metal || 0)} of stored ${stored}`);
  ok(!st.starbases.includes(sb) && atk.cargo.metal === Math.floor(stored * .5), 'star base destroyed (not captured), 50% supplies dropped');
}
// 7. determinism + JSON state
{
  const a = S.newGame(5), b = S.newGame(5);
  for (let i = 0; i < 2400; i++) { S.step(a); S.step(b); }
  ok(S.save(a) === S.save(b), 'same seed -> identical state after 10 game minutes');
  ok(JSON.stringify(S.load(S.save(a))) === S.save(a), 'state round-trips through JSON');
  console.log(`  10 min: ${a.reports.length} battles, colonies ${a.planets.filter(p => p.kind === 'colony').length}, fleets ${a.fleets.length}`);
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
