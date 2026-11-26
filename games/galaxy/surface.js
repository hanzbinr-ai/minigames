// Blackhole Throne: planet "city view" (RoK style). One small canvas, redrawn only when its state signature changes
// (levels, queue, selection, a countdown second, art arriving, size). Painted art from Broz is optional: surfaces,
// buildings by stage and scaffold come from art/surface/ (baked) or art-src/surface/, else procedural placeholders.
(function () {
const SPR = self.SPR, BIDS = ['hq', 'metal', 'crystal', 'gas', 'energy', 'shipyard', 'lab', 'defense'];
const SURF = ['home', 'terran', 'arctic', 'molten', 'gas'], TYPE2SURF = { rocky: 'terran', ice: 'arctic', energy: 'molten', gas: 'gas' };
const stage = lv => lv >= 10 ? 3 : lv >= 5 ? 2 : 1;
// default slots: bottom-centre of each building as 0-1 fractions of the background (portrait 3:4)
const DEF = { lab: { x: .28, y: .4 }, defense: { x: .72, y: .4 }, hq: { x: .5, y: .53, scale: 1.2 }, metal: { x: .2, y: .6 }, crystal: { x: .8, y: .6 },
  gas: { x: .3, y: .75 }, energy: { x: .7, y: .75 }, shipyard: { x: .5, y: .86 } };
const BW = .24; // building sprite width as a fraction of background width (times slot scale)
for (const k of SURF) SPR.define('surf-' + k, ['surface/surface-' + k].concat(k === 'home' ? ['surface/surface', 'surface/surface-bg', 'surface/planet-surface'] : []));
for (const b of BIDS) for (let s = 1; s <= 3; s++) SPR.define(`bld-${b}-${s}`, [`surface/bld-${b}-${s}`, `surface/${b}-${s}`, `surface/${b}-lv${s}`, `surface/bld-${b}-lv${s}`]);
SPR.define('bld-scaffold', ['surface/bld-scaffold', 'surface/scaffold']);
SPR.define('bld-locked', ['surface/bld-locked', 'surface/locked', 'surface/bld-blueprint']); // blueprint hologram for empty plots

// ---------- art discovery: layout json first; only probe building files when some surface art exists ----------
let layoutRaw = null, artOn = null, ver = 0;
const bump = () => { ver++; };
async function discover() {
  for (const d of ['art/surface/', 'art-src/surface/']) {
    try { const r = await fetch(d + 'surface-layout.json', { cache: 'no-cache' }); if (r.ok) { layoutRaw = await r.json(); break; } } catch (e) {}
  }
  const home = await SPR.ready('surf-home');
  artOn = !!(layoutRaw || home); bump();
  if (!artOn) return;
  for (const k of SURF) SPR.ready('surf-' + k).then(bump);
  SPR.ready('bld-scaffold').then(bump); SPR.ready('bld-locked').then(bump);
  for (const b of BIDS) for (let s = 1; s <= 3; s++) SPR.ready(`bld-${b}-${s}`).then(bump);
}
let discovering = null;
const img = id => artOn ? SPR.img(id) : null;

// layout.json, read defensively: {hq:{x,y,scale}} | {buildings:{..}} | {slots:[{id,x,y}]} | per-surface {home:{hq:..}} or {surfaces:{home:..}};
// x/y are fractions 0-1, or pixels of the background when > 1 (uses raw.width/height or the image size).
function layoutFor(key, bw, bh) {
  const raw = layoutRaw, out = {};
  const pick = o => o && typeof o === 'object' && (Array.isArray(o) ? o.some(v => v && BIDS.includes(v.id)) : BIDS.some(b => b in o)) ? o : null;
  const src = raw && (pick(raw[key]) || pick(raw.surfaces && raw.surfaces[key]) || pick(raw.home) || pick(raw.surfaces && raw.surfaces.home) || pick(raw.buildings) || pick(raw.slots) || pick(raw.layout) || pick(raw));
  const W = (raw && (raw.width || raw.w)) || bw, H = (raw && (raw.height || raw.h)) || bh;
  for (const b of BIDS) {
    let v = src && (Array.isArray(src) ? src.find(o => o && o.id === b) : src[b]);
    if (Array.isArray(v)) v = { x: v[0], y: v[1], scale: v[2] };
    if (v && isFinite(v.x) && isFinite(v.y)) out[b] = { x: v.x > 1.5 ? v.x / W : +v.x, y: v.y > 1.5 ? v.y / H : +v.y, scale: isFinite(v.scale) ? +v.scale : isFinite(v.s) ? +v.s : 1 };
    else out[b] = Object.assign({ scale: 1 }, DEF[b]);
  }
  return out;
}

// ---------- procedural placeholders (cached canvases) ----------
const CACHE = {};
function cached(k, w, h, draw) { if (CACHE[k]) return CACHE[k]; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return (CACHE[k] = c); }
const GROUND = { home: ['#2e6b4f', '#1d4a3a', '#7fbf8f'], terran: ['#4f7a3a', '#2f4f25', '#a5c97f'], arctic: ['#b8d8e8', '#6f9fbf', '#f2fbff'], molten: ['#4a2a22', '#2a1512', '#ff7043'], gas: ['#3a3f55', '#23273a', '#ffb74d'] };
function bgCanvas(key, slots) {
  return cached('bg-' + key + (slots ? '-p' : ''), 540, 720, (g, w, h) => {
    const [a, b, hi] = GROUND[key] || GROUND.home;
    const sky = g.createLinearGradient(0, 0, 0, h * .3); sky.addColorStop(0, '#05060d'); sky.addColorStop(1, key === 'molten' ? '#3a1410' : key === 'gas' ? '#2a1d3a' : '#10233a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { g.globalAlpha = .3 + (i % 5) * .12; g.fillRect((i * 97) % w, (i * 53) % (h * .22), 1.5, 1.5); } g.globalAlpha = 1;
    if (key === 'gas') { // floating platform over cloud bands
      g.fillStyle = '#ffb74d22'; for (let i = 0; i < 6; i++) g.fillRect(0, h * (.3 + i * .12), w, h * .04);
      g.fillStyle = b; g.beginPath(); g.moveTo(w * .5, h * .24); g.lineTo(w * .98, h * .58); g.lineTo(w * .5, h * .95); g.lineTo(w * .02, h * .58); g.closePath(); g.fill();
      g.strokeStyle = hi + '88'; g.lineWidth = 3; g.stroke();
    } else {
      const gr = g.createLinearGradient(0, h * .22, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, h * .26); g.quadraticCurveTo(w * .5, h * .19, w, h * .26); g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = hi + '22'; for (let i = 0; i < 70; i++) { g.beginPath(); g.ellipse((i * 131) % w, h * .3 + (i * 71) % (h * .7), 6 + i % 9, 3 + i % 4, 0, 0, 7); g.fill(); }
    }
    // isometric grid + pads
    g.strokeStyle = hi + '1c'; g.lineWidth = 1;
    for (let i = -12; i < 24; i++) { g.beginPath(); g.moveTo(i * 60, h * .28); g.lineTo(i * 60 + h, h * .28 + h / 2); g.stroke(); g.beginPath(); g.moveTo(i * 60, h * .28); g.lineTo(i * 60 - h, h * .28 + h / 2); g.stroke(); }
    for (const k in slots) { const s = slots[k], pw = w * BW * s.scale * .55; g.fillStyle = '#0006'; g.beginPath(); g.ellipse(s.x * w, s.y * h - pw * .12, pw, pw * .42, 0, 0, 7); g.fill(); g.strokeStyle = hi + '66'; g.lineWidth = 2; g.stroke(); }
  });
}
const BCOL = { hq: '#4fc3f7', metal: '#b0bec5', crystal: '#80deea', gas: '#ffb74d', energy: '#fff176', shipyard: '#90caf9', lab: '#ce93d8', defense: '#ef9a9a' };
function prism(g, cx, by, w, hgt, top, side) { // isometric box: bottom-centre (cx,by), width w, height hgt
  const d = w * .25;
  g.fillStyle = side; g.beginPath(); g.moveTo(cx - w / 2, by - d); g.lineTo(cx, by); g.lineTo(cx, by - hgt); g.lineTo(cx - w / 2, by - d - hgt); g.fill();
  g.fillStyle = shade(side, -.25); g.beginPath(); g.moveTo(cx + w / 2, by - d); g.lineTo(cx, by); g.lineTo(cx, by - hgt); g.lineTo(cx + w / 2, by - d - hgt); g.fill();
  g.fillStyle = top; g.beginPath(); g.moveTo(cx, by - hgt); g.lineTo(cx + w / 2, by - d - hgt); g.lineTo(cx, by - 2 * d - hgt); g.lineTo(cx - w / 2, by - d - hgt); g.fill();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c * (1 + k)))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); }
function bldCanvas(id, st) {
  return cached(`b-${id}-${st}`, 256, 256, (g, n) => {
    const c = BCOL[id] || '#90a4ae', cx = n / 2, by = n * .92, base = n * (.62 + st * .1), side = shade(c, -.35), hs = [0, .22, .32, .44][st];
    prism(g, cx, by, base, n * .06, '#37474f', '#263238'); // pad
    const y0 = by - n * .06;
    prism(g, cx, y0, base * .78, n * hs, shade(c, .15), side);
    const top = y0 - n * hs - base * .78 * .25;
    g.fillStyle = c; g.strokeStyle = c; g.lineWidth = n * .025;
    if (id === 'hq') { prism(g, cx, top + n * .02, base * .38, n * (.12 + st * .06), shade(c, .3), side); g.beginPath(); g.moveTo(cx, top - n * (.1 + st * .06)); g.lineTo(cx, top - n * (.2 + st * .07)); g.stroke(); }
    else if (id === 'lab' || id === 'energy') { g.fillStyle = shade(c, .2); g.beginPath(); g.ellipse(cx, top + n * .02, base * .26, base * .26, 0, Math.PI, 0); g.fill(); if (id === 'energy') { g.fillStyle = '#fffde7'; g.beginPath(); g.arc(cx, top - base * .1, n * .03 * st, 0, 7); g.fill(); } }
    else if (id === 'crystal') for (let i = 0; i < st + 1; i++) { const x = cx + (i - st / 2) * n * .08; g.beginPath(); g.moveTo(x - n * .03, top + n * .04); g.lineTo(x, top - n * (.12 + .05 * st)); g.lineTo(x + n * .03, top + n * .04); g.fill(); }
    else if (id === 'gas') for (let i = 0; i < st; i++) { g.fillStyle = shade(c, .1 * i); g.beginPath(); g.ellipse(cx + (i - (st - 1) / 2) * n * .11, top - n * .03, n * .05, n * .08, 0, 0, 7); g.fill(); }
    else if (id === 'metal') { g.beginPath(); g.moveTo(cx - n * .08, top + n * .03); g.lineTo(cx, top - n * (.14 + .04 * st)); g.lineTo(cx + n * .08, top + n * .03); g.stroke(); }
    else if (id === 'shipyard') { g.beginPath(); g.moveTo(cx - base * .3, top + n * .03); g.lineTo(cx - base * .3, top - n * (.15 + .04 * st)); g.lineTo(cx + base * .25, top - n * (.15 + .04 * st)); g.stroke(); }
    else if (id === 'defense') { g.fillStyle = shade(c, .1); g.beginPath(); g.arc(cx, top, n * .06, Math.PI, 0); g.fill(); g.beginPath(); g.moveTo(cx, top - n * .03); g.lineTo(cx + n * (.12 + .03 * st), top - n * (.1 + .02 * st)); g.stroke(); }
    if (st > 1) { g.fillStyle = '#fff9'; for (let i = 0; i < st * 3; i++) g.fillRect(cx - base * .32 + (i % 6) * base * .1, y0 - n * hs * (.3 + .25 * Math.floor(i / 6)), n * .02, n * .03); }
  });
}
function scaffoldCanvas() {
  return cached('scaf', 256, 256, (g, n) => {
    g.strokeStyle = '#ffb300'; g.lineWidth = n * .018;
    for (let i = 0; i < 4; i++) { const x = n * (.2 + i * .2); g.beginPath(); g.moveTo(x, n * .9); g.lineTo(x, n * .32); g.stroke(); }
    for (let j = 0; j < 4; j++) { const y = n * (.85 - j * .16); g.beginPath(); g.moveTo(n * .18, y); g.lineTo(n * .82, y); g.stroke(); g.beginPath(); g.moveTo(n * .2, y); g.lineTo(n * .4, y - n * .16); g.stroke(); }
    g.strokeStyle = '#90a4ae'; g.beginPath(); g.moveTo(n * .8, n * .32); g.lineTo(n * .8, n * .1); g.lineTo(n * .45, n * .1); g.stroke();
  });
}

// ---------- the view ----------
const cv = document.createElement('canvas'); cv.id = 'surf'; cv.className = 'surf';
const V = { key: 'home', blds: null, bq: null, tick: 0, tps: 4, sel: null, onTap: null, sig: '', hits: [] };
function draw() {
  const W = Math.round(cv.clientWidth), H = Math.round(cv.clientHeight); if (!W || !H) return;
  const dpr = Math.min(2, devicePixelRatio || 1), bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const bgImg = img('surf-' + V.key) || img('surf-home');
  const iw = bgImg ? bgImg.naturalWidth : 540, ih = bgImg ? bgImg.naturalHeight : 720;
  const slots = layoutFor(V.key, iw, ih);
  const bg = bgImg || bgCanvas(V.key, V.blds ? slots : null);
  // fit the building band (cover when it already fits); shift so it stays centred, clamped while the bg covers that axis
  const xs = BIDS.map(b => slots[b].x), ys = BIDS.map(b => slots[b].y), bwf = BW * 1.3;
  const bx0 = Math.min(...xs) - bwf / 2, bx1 = Math.max(...xs) + bwf / 2, by0 = Math.min(...ys) - bwf * iw / ih, by1 = Math.max(...ys) + .05;
  const s = Math.min(Math.max(W / iw, H / ih), W / ((bx1 - bx0) * iw), H / ((by1 - by0) * ih)), dw = iw * s, dh = ih * s;
  const cx = (bx0 + bx1) / 2, cyf = V.blds ? (by0 + by1) / 2 : .6;
  const ox = dw >= W ? Math.max(W - dw, Math.min(0, W / 2 - cx * dw)) : (W - dw) / 2, oy = dh >= H ? Math.max(H - dh, Math.min(0, H / 2 - cyf * dh)) : (H - dh) / 2;
  if (dw < W || dh < H) { // wide/short canvas (landscape): blurred, dimmed backdrop + soft edges instead of bars
    const lo = cached('lo-' + V.key + (bgImg ? 'a' : ''), 24, 32, (q, w, h) => q.drawImage(bg, 0, 0, w, h)), cs = Math.max(W / 24, H / 32);
    g.imageSmoothingQuality = 'high'; g.drawImage(lo, (W - 24 * cs) / 2, (H - 32 * cs) / 2, 24 * cs, 32 * cs); g.fillStyle = '#05060d88'; g.fillRect(0, 0, W, H);
  }
  g.drawImage(bg, ox, oy, dw, dh);
  if (dw < W) for (const [x0, x1] of [[ox, ox + 24], [ox + dw, ox + dw - 24]]) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#05060d88'); gr.addColorStop(1, '#05060d00'); g.fillStyle = gr; g.fillRect(Math.min(x0, x1), oy, 24, dh); }
  if (!V.blds) { const dome = SPR.img('colony-dome'), sl = slots.hq, w = dw * .34, x = ox + sl.x * dw, y = oy + sl.y * dh; if (dome) g.drawImage(dome, x - w / 2, y - w * .85, w, w); }
  V.hits = [];
  if (V.blds) {
    const order = BIDS.slice().sort((a, b) => slots[a].y - slots[b].y);
    for (const b of order) {
      const sl = slots[b], lv = V.blds[b] || 0, st = stage(Math.max(1, lv)), w = dw * BW * sl.scale, x = ox + sl.x * dw, y = oy + sl.y * dh;
      const busy = V.bq && V.bq.b === b, need = V.unlock ? V.unlock(b) : 0, locked = need > (V.hq || 1);
      const im = img(`bld-${b}-${st}`) || img(`bld-${b}-1`);
      let src = im || bldCanvas(b, st), h = w * src.height / src.width;
      if (V.sel === b) { g.save(); g.fillStyle = '#4fc3f733'; g.strokeStyle = '#4fc3f7'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - w * .08, w * .5, w * .2, 0, 0, 7); g.fill(); g.stroke(); g.restore(); }
      if (lv > 0) g.drawImage(src, x - w / 2, y - h, w, h);
      else { // empty plot: blueprint hologram (Broz) or a faint ghost of stage 1, then a lock + HQ label or a Build marker
        const bp = img('bld-locked');
        if (bp) { src = bp; h = w * bp.height / bp.width; g.globalAlpha = locked ? .45 : .35; g.drawImage(bp, x - w / 2, y - h, w, h); }
        else { g.globalAlpha = locked ? .16 : .3; g.drawImage(src, x - w / 2, y - h, w, h); g.globalAlpha = 1;
          g.setLineDash([5, 4]); g.strokeStyle = locked ? '#90a4aeaa' : '#a5d6a7cc'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y - w * .1, w * .42, w * .17, 0, 0, 7); g.stroke(); g.setLineDash([]); }
        g.globalAlpha = 1;
        if (!busy) {
          const label = locked ? '🔒 HQ ' + need : '＋ Build', ty = y - h * .5;
          g.font = '700 11px system-ui,sans-serif'; const tw = g.measureText(label).width + 14;
          g.fillStyle = locked ? '#05060dd9' : '#1b5e20e6'; rr(g, x - tw / 2, ty - 11, tw, 22, 11); g.fill();
          g.strokeStyle = locked ? '#90a4ae' : '#81c784'; g.lineWidth = 1.2; g.stroke();
          g.fillStyle = locked ? '#cfd8dc' : '#e8f5e9'; g.textAlign = 'center'; g.fillText(label, x, ty + 4);
        }
      }
      if (busy) {
        const sc = img('bld-scaffold') || scaffoldCanvas(), sh = w * sc.height / sc.width; g.globalAlpha = .9; g.drawImage(sc, x - w / 2, y - sh, w, sh); g.globalAlpha = 1;
        const left = Math.max(0, Math.ceil((V.bq.end - V.tick) / V.tps)), p = 1 - (V.bq.end - V.tick) / V.bq.len, bwid = Math.max(54, w * .7), ty = y - h - 4;
        g.fillStyle = '#05060dd9'; rr(g, x - bwid / 2, ty - 20, bwid, 20, 6); g.fill();
        g.fillStyle = '#4fc3f7'; g.fillRect(x - bwid / 2 + 3, ty - 5, (bwid - 6) * Math.max(0, Math.min(1, p)), 3);
        g.fillStyle = '#fff'; g.font = '600 11px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('⏳ ' + left + 's', x, ty - 8);
      }
      V.hits.push({ b, x0: x - w * .45, x1: x + w * .45, y0: y - h * .95, y1: y + 4 });
      if (!lv) continue;
      // level badge
      const bx = x + w * .3, by2 = y - w * .12; g.fillStyle = V.sel === b ? '#1b3a5e' : '#0b1322e6'; g.strokeStyle = '#ffd54f'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(bx, by2, 10, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#ffd54f'; g.font = '700 11px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(lv, bx, by2 + 4);
    }
  }
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = V.hits.length - 1; i >= 0; i--) { const h = V.hits[i]; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) { V.onTap && V.onTap(h.b); return; } }
  V.onTap && V.onTap(null);
});
// state: { key, blds (null for colonies), bq, tick, tps, sel }. Cheap: only redraws when the signature changes.
function update(state) {
  if (!discovering) discovering = discover();
  Object.assign(V, state);
  if (!cv.isConnected || document.hidden) return;
  const left = V.bq ? Math.ceil((V.bq.end - V.tick) / V.tps) : '';
  const sig = [V.key, V.blds ? BIDS.map(b => V.blds[b]).join() : '-', V.bq ? V.bq.b + left : '', V.sel, ver, cv.clientWidth, cv.clientHeight].join('|');
  if (sig !== V.sig) { V.sig = sig; draw(); }
}
function mount(slot) { if (slot && cv.parentNode !== slot) { slot.appendChild(cv); V.sig = ''; } }
const surfKey = (kind, type) => kind === 'home' ? 'home' : TYPE2SURF[type] || 'home';
self.NTSurf = { mount, update, surfKey, stage, canvas: cv, view: V, layoutFor, get art() { return artOn; } };
})();
