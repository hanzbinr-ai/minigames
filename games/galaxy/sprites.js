// Blackhole Throne: single sprite lookup. Painted art (Broz) is optional: each id lists file-name aliases and the
// first file that loads wins; anything missing falls back to procedural canvas art. Ship art faces up (nose = -y).
(function () {
const DIRS = ['art/', 'art-src/'], EXT = ['.webp', '.png', '.jpg'];
const ALIAS = {
  'planet-rocky': ['planet-terran', 'terran', 'planet-jungle', 'jungle', 'planet-forest', 'forest'],
  'planet-ice': ['planet-arctic', 'arctic', 'planet-ice', 'ice'],
  'planet-energy': ['planet-molten', 'molten', 'planet-lava', 'lava'],
  'planet-gas': ['planet-gas', 'gas', 'planet-gas-giant', 'gas-giant'],
  'planet-home': ['planet-home', 'home'],
  'star-white': ['star-white', 'white-star'],
  'blackhole': ['blackhole-core', 'blackhole'],
  'monster-void_leviathan': ['void-leviathan', 'void-leech', 'monster-void-leviathan'],
  'monster-star_kraken': ['star-kraken', 'space-kraken', 'monster-star-kraken'],
  'starbase': ['starbase', 'star-base'],
  'asteroid-0': ['asteroid-1', 'asteroid'], 'asteroid-1': ['asteroid-2', 'asteroid'], 'asteroid-2': ['asteroid-3', 'asteroid'],
  'pirate-small': ['pirate-raider'], 'pirate-large': ['pirate-cruiser'], 'colony-dome': ['colony-dome'], 'throne': ['throne-station'],
  'bg': ['bg-galaxy'],
  'logo': ['logo-blackhole-throne'],
  'logo-icon': ['logo-icon'],
};
for (const h of ['corvette', 'frigate', 'destroyer', 'cruiser', 'battleship', 'carrier', 'colony', 'constructor']) ALIAS['ship-' + h] = ['ship-' + h];
const IMG = {}, PENDING = {}, XALIAS = {}; // XALIAS: lazily probed ids (not preloaded), e.g. planet-surface art
function define(id, names) { if (!ALIAS[id]) XALIAS[id] = names; }
const tryLoad = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
async function resolve(id) {
  for (const a of ALIAS[id] || XALIAS[id] || [id]) for (const d of DIRS) for (const e of EXT) { const i = await tryLoad(d + a + e); if (i) return (IMG[id] = i); }
  return (IMG[id] = null);
}
function img(id) { if (!(id in IMG) && !PENDING[id]) PENDING[id] = resolve(id); return IMG[id] || null; }
function ready(id) { img(id); return PENDING[id] || Promise.resolve(IMG[id] || null); }
function preload() { return Promise.all(Object.keys(ALIAS).map(ready)); }

// ---------- procedural fallbacks (cached per id+size) ----------
const CACHE = {};
const PLANET_COL = { rocky: ['#d9b38c', '#8d6e63', '#4e342e'], ice: ['#e0f7ff', '#81d4fa', '#1e5f8a'], gas: ['#ffe0b2', '#f4a261', '#7a3e1d'], energy: ['#ffd54f', '#ff5722', '#5d1a0b'], home: ['#b9f6ca', '#26a69a', '#0b3d3a'] };
function cached(key, px, draw) {
  const k = key + '@' + px; if (CACHE[k]) return CACHE[k];
  const c = document.createElement('canvas'); c.width = c.height = px; draw(c.getContext('2d'), px); return (CACHE[k] = c);
}
function planetCanvas(type, px) {
  return cached('pl-' + type, px, (g, n) => {
    const [a, b, c] = PLANET_COL[type] || PLANET_COL.rocky, r = n * .34, cx = n / 2;
    const glow = g.createRadialGradient(cx, cx, r * .8, cx, cx, n / 2); glow.addColorStop(0, b + 'aa'); glow.addColorStop(1, b + '00');
    g.fillStyle = glow; g.fillRect(0, 0, n, n);
    const body = g.createRadialGradient(cx - r * .35, cx - r * .35, r * .1, cx, cx, r); body.addColorStop(0, a); body.addColorStop(.6, b); body.addColorStop(1, c);
    g.fillStyle = body; g.beginPath(); g.arc(cx, cx, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cx, r, 0, 7); g.clip(); g.globalAlpha = .25; g.fillStyle = c;
    if (type === 'gas') for (let i = -3; i <= 3; i++) g.fillRect(cx - r, cx + i * r * .28, 2 * r, r * .1);
    else for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + Math.cos(i * 2.1) * r * .5, cx + Math.sin(i * 1.7) * r * .5, r * (.1 + (i % 3) * .06), 0, 7); g.fill(); }
    g.restore();
  });
}
function blackholeCanvas(px) {
  return cached('bh', px, (g, n) => {
    const cx = n / 2;
    const disk = g.createRadialGradient(cx, cx, n * .12, cx, cx, n * .5);
    disk.addColorStop(0, '#000'); disk.addColorStop(.25, '#ffcc80'); disk.addColorStop(.4, '#ff7043cc'); disk.addColorStop(.7, '#7e57c255'); disk.addColorStop(1, '#00000000');
    g.fillStyle = disk; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#fff3e0aa'; g.lineWidth = n * .012;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx, cx, n * (.2 + i * .05), i, i + 2.2); g.stroke(); }
    g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cx, n * .14, 0, 7); g.fill();
  });
}
// ship silhouettes by hull class, drawn nose-up in a unit box
const HULL_PATH = {
  corvette: [[0, -1], [.6, .8], [0, .45], [-.6, .8]],
  frigate: [[0, -1], [.55, 0], [0, .9], [-.55, 0]],
  destroyer: [[0, -1], [.35, -.2], [.45, .9], [-.45, .9], [-.35, -.2]],
  cruiser: [[0, -1], [.5, -.3], [.6, .6], [.25, .95], [-.25, .95], [-.6, .6], [-.5, -.3]],
  battleship: [[0, -1], [.7, -.4], [.8, .7], [.4, 1], [-.4, 1], [-.8, .7], [-.7, -.4]],
  carrier: [[-.4, -1], [.4, -1], [.75, -.3], [.75, .9], [-.75, .9], [-.75, -.3]],
  colony: [[0, -1], [.6, -.2], [.6, .8], [-.6, .8], [-.6, -.2]],
  constructor: [[-.6, -.8], [.6, -.8], [.8, .8], [-.8, .8]],
};
function tinted(im, color) { // cached copy of a neutral sprite washed with the faction colour
  const k = 'tint' + im.src + color; if (CACHE[k]) return CACHE[k];
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
  g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .28; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (CACHE[k] = c);
}
function drawShip(g, hull, x, y, size, ang, color, pirate) {
  const im = pirate ? img(hull === 'corvette' ? 'pirate-small' : 'pirate-large') || img('ship-' + hull) : img('ship-' + hull);
  if (pirate && im) { g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2); const k = size * 2.2 / Math.max(im.width, im.height); g.drawImage(im, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k); g.restore(); return; }
  g.save(); g.translate(x, y); g.rotate(ang + Math.PI / 2);
  if (im) { const k = size * 2.2 / Math.max(im.width, im.height), t = tinted(im, color); g.drawImage(t, -im.width * k / 2, -im.height * k / 2, im.width * k, im.height * k); }
  else {
    const p = HULL_PATH[hull] || HULL_PATH.corvette;
    g.beginPath(); p.forEach(([a, b], i) => i ? g.lineTo(a * size, b * size) : g.moveTo(a * size, b * size)); g.closePath();
    g.fillStyle = '#0d1420'; g.fill(); g.lineWidth = Math.max(1.5, size * .18); g.strokeStyle = color; g.stroke();
    g.fillStyle = color; g.beginPath(); g.arc(0, size * .2, size * .18, 0, 7); g.fill();
  }
  g.restore();
}
function drawMonster(g, id, x, y, size, t) {
  const im = img('monster-' + id);
  if (im) { const k = size * 2.4 / Math.max(im.width, im.height); g.drawImage(im, x - im.width * k / 2, y - im.height * k / 2, im.width * k, im.height * k); return; }
  g.save(); g.translate(x, y);
  const col = id === 'star_kraken' ? '#f48fb1' : '#b388ff';
  g.strokeStyle = col; g.lineWidth = size * .14; g.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + Math.sin(t * 1.5 + i) * .2; g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(Math.cos(a + .4) * size * .9, Math.sin(a + .4) * size * .9, Math.cos(a) * size * 1.3, Math.sin(a) * size * 1.3); g.stroke(); }
  const b = g.createRadialGradient(0, 0, 0, 0, 0, size * .7); b.addColorStop(0, '#fff'); b.addColorStop(.3, col); b.addColorStop(1, '#311b92');
  g.fillStyle = b; g.beginPath(); g.arc(0, 0, size * .7, 0, 7); g.fill();
  g.restore();
}
function drawPlanet(g, type, home, x, y, r) {
  const im = img(home ? 'planet-home' : 'planet-' + type) || (home ? img('planet-' + type) : null);
  if (im) { const s = r * 2.3; g.drawImage(im, x - s / 2, y - s / 2, s, s); return; }
  const px = Math.max(16, Math.min(256, 2 ** Math.ceil(Math.log2(r * 3)))), c = planetCanvas(home ? 'home' : type, px), s = r / .34;
  g.drawImage(c, x - s / 2, y - s / 2, s, s);
}
function drawBlackhole(g, x, y, r, t) {
  const im = img('blackhole'), s = r * 2.6;
  g.save(); g.translate(x, y); g.rotate(t * .08); // slow accretion-disk spin (only called when on screen)
  if (im) g.drawImage(im, -s / 2, -s / 2, s, s); else g.drawImage(blackholeCanvas(256), -s / 2, -s / 2, s, s);
  g.restore();
  const th = img('throne'); if (th) { const a = t * .05, d = r * 2.2, s2 = r * .9; g.drawImage(th, x + Math.cos(a) * d - s2 / 2, y + Math.sin(a) * d - s2 / 2, s2, s2); }
}
function drawColonyDome(g, x, y, r) { const im = img('colony-dome'); if (!im) return false; const s = r * .9; g.drawImage(im, x - s / 2, y - r * .95 - s / 2, s, s); return true; }
let bgPat = null;
function drawBackground(g, w, h, ox, oy) { // painted nebula tile with slow parallax; returns false if not loaded
  const im = img('bg'); if (!im) return false;
  if (!bgPat) bgPat = g.createPattern(im, 'repeat');
  g.save(); g.fillStyle = bgPat; const m = new DOMMatrix().translateSelf(-ox, -oy).scaleSelf(.6, .6); bgPat.setTransform(m); g.fillRect(0, 0, w, h); g.restore(); return true;
}
function drawStarbase(g, x, y, r, color, t) {
  const im = img('starbase');
  if (im) { const s = r * 2.6; g.drawImage(im, x - s / 2, y - s / 2, s, s); }
  else {
    g.save(); g.translate(x, y); g.rotate(t * .2);
    g.strokeStyle = '#90a4ae'; g.lineWidth = r * .35; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    g.strokeStyle = color; g.lineWidth = r * .12; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    g.fillStyle = '#cfd8dc';
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-r * .12, -r * 1.55, r * .24, r * .5); }
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, r * .35, 0, 7); g.fill();
    g.restore();
  }
}
function drawAsteroids(g, x, y, r, res, v) {
  const im = img('asteroid-' + (v || 0)), tint = { metal: '#bcaaa4', crystal: '#80deea', gas: '#ffcc80', energy: '#fff176' }[res];
  if (im) { const s = r * 2.4; g.drawImage(im, x - s / 2, y - s / 2, s, s); }
  else { g.fillStyle = '#607d8b'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + Math.cos(i * 2.4) * r * .6 * (i % 3 + 1) / 3, y + Math.sin(i * 2.4) * r * .6 * (i % 3 + 1) / 3, r * (.18 + (i % 2) * .1), 0, 7); g.fill(); } }
  g.fillStyle = tint; g.beginPath(); g.arc(x, y, r * .2, 0, 7); g.fill();
}
self.SPR = { ALIAS, define, img, ready, preload, drawBackground, drawColonyDome, drawShip, drawMonster, drawPlanet, drawBlackhole, drawStarbase, drawAsteroids, HULL_PATH };
})();
