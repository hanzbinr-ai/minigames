// Blackhole Throne: AI empire brain (pure). Uses the same act() entry point as the player.
(function (root, f) { const m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.NTAI = m; })(typeof self !== 'undefined' ? self : this, function () {
const BLD_ORDER = ['metal', 'crystal', 'hq', 'gas', 'energy', 'shipyard', 'defense', 'lab'];
const RES_ORDER = ['cruiser', 'colony1', 'railgun2', 'laser2', 'warp', 'battleship', 'logistics', 'colony2', 'jammer', 'carrier'];
function think(st, e, X) {
  const id = e.id, home = X.byId(st, e.home);
  if (!home || home.owner !== id) return;
  const r = () => X.rand(st);
  // economy: cheapest useful upgrade
  if (!e.bq) for (const b of BLD_ORDER.slice().sort((a, c) => e.bld[a] - e.bld[c])) if (X.act(st, id, { type: 'upgrade', b }).ok) break;
  if (!e.rq) for (const k of RES_ORDER) if (!e.research[k] && X.act(st, id, { type: 'research', id: k }).ok) break;
  // colonies
  const freeCap = X.colonyCap(st, id) - X.colonies(st, id) - X.pendingCivil(st, id, 'colonize');
  const hasColShip = home.garrison.some(u => X.stat(st, id, u.d).civ === 'colony') || e.sq.some(q => q.d === 'colonyship');
  if (freeCap > 0 && !hasColShip && st.tick > 40) X.act(st, id, { type: 'build', design: 'colonyship', n: 1 });
  if (freeCap > 0 && home.garrison.some(u => X.stat(st, id, u.d).civ === 'colony')) {
    const free = st.planets.filter(p => !p.owner && !st.fleets.some(f => f.order.target === p.id)).sort((a, b) => X.dist(a, home) - X.dist(b, home));
    if (free[0]) X.act(st, id, { type: 'colonize', planet: free[0].id });
  }
  // warships: keep the queue short, pick a mixed composition
  if (e.sq.length < 2) {
    const pool = ['raider', 'escort', 'hunter', 'warden', 'picket'];
    if (e.research.cruiser) pool.push('linecruiser', 'linecruiser');
    if (e.research.battleship) pool.push('dread');
    X.act(st, id, { type: 'build', design: pool[(r() * pool.length) | 0], n: 2 });
  }
  // fleets in space with nothing to do go home
  const mine = st.fleets.filter(f => f.owner === id);
  for (const f of mine) if (f.order.t === 'idle' && !X.civil(st, f)) X.act(st, id, { type: 'return', fleet: f.id });
  // send out a fleet now and then
  const warCmd = X.cmdOf(st, id, home.garrison.filter(u => !X.stat(st, id, u.d).civ));
  if (warCmd >= 14 && mine.filter(f => !X.civil(st, f)).length < 2 && r() < .5) {
    const res = X.act(st, id, { type: 'launch', base: home.id });
    if (!res.ok) return;
    const f = X.byId(st, res.id), myPow = X.power(st, id, f.ships);
    const targets = [];
    for (const g of st.fleets) if (g.owner === 'pirates' && X.power(st, g.owner, g.ships) < myPow) targets.push({ id: g.id, w: 3, d: X.dist(X.pos(st, g), home) });
    if (st.tick > 4 * 60 * 4) for (const p of st.planets) if (p.owner && p.owner !== id && p.kind === 'colony' && X.cmdOf(st, p.owner, p.garrison) < myPow) targets.push({ id: p.id, w: p.owner === 'player' ? 1 : 2, d: X.dist(p, home) });
    for (const s of st.starbases) if (s.owner !== id && st.tick > 6 * 60 * 4) targets.push({ id: s.id, w: 1, d: X.dist(s, home) });
    targets.sort((a, b) => a.d / a.w - b.d / b.w);
    if (targets[0] && targets[0].d < 120) X.act(st, id, { type: targets[0].id[0] === 'f' ? 'chase' : 'attack', fleet: f.id, target: targets[0].id });
    else { const ast = st.asteroids.filter(a => a.amount > 0).sort((a, b) => X.dist(a, home) - X.dist(b, home))[0]; if (ast) X.act(st, id, { type: 'mine', fleet: f.id, target: ast.id }); }
  }
}
return { think };
});
