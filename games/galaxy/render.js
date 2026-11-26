// Blackhole Throne: canvas renderer + camera. Reads sim state, never mutates it.
(function () {
const S = self.NTSim, D = S.D, SPR = self.SPR;
const cam = { x: 35, y: 150, z: 1 }; // world center + zoom (1 = ~70 units across the short side)
let cv, g, W = 0, H = 0, dpr = 1, stars = null;
function init(canvas) { cv = canvas; g = cv.getContext('2d'); resize(); }
function resize() {
  dpr = Math.min(2, self.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); stars = null;
}
const unit = () => Math.min(W, H) / 70 * cam.z; // pixels per world unit
const toScreen = (x, y) => [(x - cam.x) * unit() + W / 2, (y - cam.y) * unit() + H / 2];
const toWorld = (sx, sy) => [(sx - W / 2) / unit() + cam.x, (sy - H / 2) / unit() + cam.y];
function clampCam() { cam.z = Math.max(.35, Math.min(5, cam.z)); cam.x = Math.max(0, Math.min(D.CFG.W, cam.x)); cam.y = Math.max(0, Math.min(D.CFG.H, cam.y)); }
function starfield() {
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const s = c.getContext('2d');
  const bg = s.createRadialGradient(c.width * .3, c.height * .3, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height));
  bg.addColorStop(0, '#141a33'); bg.addColorStop(1, '#05060d'); s.fillStyle = bg; s.fillRect(0, 0, c.width, c.height);
  let seed = 99; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++) { s.globalAlpha = .3 + r() * .7; s.fillStyle = r() < .2 ? '#bbdefb' : '#fff'; s.fillRect(r() * c.width, r() * c.height, r() * 1.6 * dpr + .5, r() * 1.6 * dpr + .5); }
  return c;
}
const onScreen = (sx, sy, m) => sx > -m && sy > -m && sx < W + m && sy < H + m;
function fleetHull(st, f) { let best = null; for (const u of f.ships) { const s = S.stat(st, f.owner, u.d); if (!best || s.size > best.size) best = s; } return best; }
function draw(st, ui, t, alpha) {
  if (!stars) stars = starfield();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!SPR.drawBackground(g, cv.width, cv.height, cam.x * 6 * dpr, cam.y * 6 * dpr)) g.drawImage(stars, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const u = unit(), tick = st.tick + alpha, me = 'player';
  // grid
  g.strokeStyle = '#ffffff0d'; g.lineWidth = 1;
  for (let x = 0; x <= D.CFG.W; x += 20) { const [a] = toScreen(x, 0); if (a > -2 && a < W + 2) { g.beginPath(); g.moveTo(a, toScreen(0, 0)[1]); g.lineTo(a, toScreen(0, D.CFG.H)[1]); g.stroke(); } }
  for (let y = 0; y <= D.CFG.H; y += 20) { const [, b] = toScreen(0, y); if (b > -2 && b < H + 2) { g.beginPath(); g.moveTo(toScreen(0, 0)[0], b); g.lineTo(toScreen(D.CFG.W, 0)[0], b); g.stroke(); } }
  // supply range of my bases
  g.fillStyle = '#4fc3f70a'; g.strokeStyle = '#4fc3f733'; g.setLineDash([6, 6]);
  for (const b of S.bases(st, me)) { const [x, y] = toScreen(b.x, b.y), r = S.supplyRange(st, me, b.id[0] === 's' ? 'sb' : 'p') * u; if (!onScreen(x, y, r)) continue; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
  g.setLineDash([]);
  for (const h of st.hazards || []) { const [x, y] = toScreen(h.x, h.y); if (onScreen(x, y, h.r * u * 2)) SPR.drawBlackhole(g, x, y, h.r * u, t); }
  for (const a of st.asteroids) { const [x, y] = toScreen(a.x, a.y); if (!onScreen(x, y, 30) || a.amount <= 0) continue; SPR.drawAsteroids(g, x, y, 2.2 * u, a.res, +a.id.slice(1) % 3); }
  for (const p of st.planets) {
    const [x, y] = toScreen(p.x, p.y), r = p.r * u; if (!onScreen(x, y, r * 2)) continue;
    SPR.drawPlanet(g, p.type, p.kind === 'home', x, y, r);
    if (p.owner) { g.strokeStyle = st.emp[p.owner].color; g.lineWidth = p.kind === 'home' ? 3 : 2; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.stroke();
      if (p.kind === 'colony' && !SPR.drawColonyDome(g, x, y, r)) { g.fillStyle = st.emp[p.owner].color; g.beginPath(); g.arc(x, y - r * .7, Math.max(2.5, r * .25), Math.PI, 0); g.fill(); } }
    if (cam.z > .7 || p.kind === 'home') label(p.kind === 'home' ? st.emp[p.owner].name : D.PLANET[p.type].name, x, y + r + 12, p.owner ? st.emp[p.owner].color : '#9fb3c8');
  }
  for (const s of st.starbases) { const [x, y] = toScreen(s.x, s.y); if (onScreen(x, y, 40)) SPR.drawStarbase(g, x, y, 2.6 * u, st.emp[s.owner].color, t); }
  // fleets
  for (const f of st.fleets) {
    const p = S.pos(st, f, tick), [x, y] = toScreen(p.x, p.y);
    if (!onScreen(x, y, 60) && f.id !== ui.sel) continue;
    const col = st.emp[f.owner].color, mine = f.owner === me;
    if (f.order.t !== 'idle' && (mine || f.id === ui.sel)) { const [tx, ty] = toScreen(f.x1, f.y1); g.strokeStyle = col + '99'; g.setLineDash([4, 5]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]); }
    if (f.order.t === 'mine' && p.done) { drawMiner(st, f, x, y, u, col, f.id === ui.sel, t); continue; }
    const hull = fleetHull(st, f), size = Math.max(6, Math.min(18, (hull ? hull.size : 1) * .9 * u + 4));
    const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0) || -Math.PI / 2;
    g.fillStyle = col + '33'; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, size * 1.25, 0, 7); g.fill(); g.stroke();
    if (f.owner === 'monsters') SPR.drawMonster(g, f.ships[0].d, x, y, size, t);
    else SPR.drawShip(g, hull ? hull.hull : 'corvette', x, y, size, ang, col, f.owner === 'pirates');
    if (f.id === ui.sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, size * 1.25 + 5 + Math.sin(t * 5) * 1.5, 0, 7); g.stroke(); }
    if (f.order.t === 'mine' && Object.keys(f.cargo).length) label('⛏', x + size + 6, y - size, '#fff');
    label('' + f.ships.length, x + size + 2, y + size + 2, col, 'left');
  }
  const sel = ui.sel && S.byId(st, ui.sel);
  if (sel && sel.id[0] !== 'f') { const p = S.objPos(st, sel), [x, y] = toScreen(p.x, p.y), r = ((sel.r || 2.5) + 2) * u; g.strokeStyle = '#fff'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.setLineDash([]); }
  if (ui.mark) { const [x, y] = toScreen(ui.mark.x, ui.mark.y); g.strokeStyle = '#ffffffcc'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8, y); g.lineTo(x + 8, y); g.moveTo(x, y - 8); g.lineTo(x, y + 8); g.stroke(); }
}
// RoK-style gatherer: the fleet sits inside the field; the field gets the owner's ring, a hold-progress arc and a flag badge
function drawMiner(st, f, x, y, u, col, sel, t) {
  const r = 2.2 * u * 1.25 + 4, cap = S.cmdOf(st, f.owner, f.ships) * 60, have = Object.values(f.cargo).reduce((a, b) => a + b, 0), k = cap ? Math.min(1, have / cap) : 0;
  g.lineWidth = 3; g.strokeStyle = '#0008'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + k * 6.283); g.stroke();
  const bx = x, by = y - r - 9; g.fillStyle = col; g.beginPath(); g.arc(bx, by, 8, 0, 7); g.fill(); g.strokeStyle = '#000a'; g.lineWidth = 1.5; g.stroke();
  g.beginPath(); g.moveTo(bx, by + 8); g.lineTo(bx, by + 13); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
  label('⛏', bx, by + 4, '#fff'); label(f.ships.length + '', x + r + 2, y + r, col, 'left');
  if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 5 + Math.sin(t * 5) * 1.5, 0, 7); g.stroke(); }
}
function label(txt, x, y, col, align) { g.font = '600 11px system-ui,sans-serif'; g.textAlign = align || 'center'; g.lineWidth = 3; g.strokeStyle = '#000a'; g.strokeText(txt, x, y); g.fillStyle = col; g.fillText(txt, x, y); }
// hit test in world units with a finger-sized tolerance
function pick(st, sx, sy) {
  const [wx, wy] = toWorld(sx, sy), tol = 22 / unit(); let best = null, bd = 1e9;
  const test = (o, x, y, r) => { const d = Math.hypot(x - wx, y - wy) - (r || 0); if (d < tol && d < bd) { bd = d; best = o; } };
  for (const f of st.fleets) { const p = S.pos(st, f); test(f, p.x, p.y, 0); }
  if (best) return { obj: best, wx, wy };
  for (const p of st.planets) test(p, p.x, p.y, p.r);
  for (const s of st.starbases) test(s, s.x, s.y, 2.5);
  for (const a of st.asteroids) if (a.amount > 0) test(a, a.x, a.y, 1.5);
  return { obj: best, wx, wy };
}
self.NTRender = { cam, init, resize, draw, pick, toWorld, toScreen, clampCam, unit: () => unit() };
})();
