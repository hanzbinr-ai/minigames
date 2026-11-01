// Mini Heroes - RENDER LAYER (PixiJS / WebGL). Draws the adventure map and battles on a GPU canvas stacked
// over #c. Game logic, input and DOM panels are untouched: #c still gets every pointer event (it just turns
// transparent). If WebGL is missing, Pixi fails to start, or MENU > GRAPHICS is CANVAS, the classic canvas
// renderer in game.js draws exactly as before.
// Units of all 6 factions (+ mythics) are painted WebP atlases (art/units-<faction>.webp, built by
// tools/miniheroes-art/build_atlas.py): one row per unit, frames idle 4 / attack 4 / hit 3 / death 5.
// Atlases load lazily (only the factions in the current battle) and at most 3 stay on the GPU.
'use strict';
(() => {
  const KEY = 'mh-renderer', want = () => localStorage.getItem(KEY) || 'pixi';
  const glOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  const LOWQ = () => localStorage.getItem('mh-quality') === 'low', DPR_CAP = 2; // render at most 2 device px per CSS px (phones are 3x): ~55% fewer pixels, visually identical
  let app = null, ok = false, failed = false, px = null, man = null;
  const stats = {map: 0, battle: 0, n: 0, res: 1};
  // painted unit portrait for DOM panels (works in canvas mode too: it is just a CSS sprite of the atlas)
  // pre-baked 96px portraits (art/units-<faction>-ui.webp, one row) shown at <= 52 CSS px: crisp, never upscaled
  const pic = u => { const m = man && man.units[u], ui = m && man.ui && man.ui[m.atlas]; if (!ui) return null;
    return `<i class="pu" title="${u}" style="background-image:url('${ui.src}');--n:${man.rows[m.atlas]};--x:${m.row}"></i>`; };
  window.MHR = {
    ready: () => ok, pic,
    mode: () => (ok ? 'pixi' : 'canvas'),
    label: () => (want() !== 'pixi' ? 'CANVAS' : ok ? 'PIXI' : failed || !glOK || !window.PIXI ? 'CANVAS (no WebGL)' : 'PIXI…'),
    map: () => ok && drawMap(),
    battle: (sx, sy) => ok && drawFight(sx, sy),
    stats, get app() { return app; }, atlases: {},
    debug: () => { if (!ok) return null; let mem = 0, n = 0; for (const src of SRCS) { if (src.destroyed) { SRCS.delete(src); continue; } mem += (src.pixelWidth || src.width) * (src.pixelHeight || src.height) * 4; }
      const cnt = c => { let k = 0; for (const ch of c.children) if (ch.visible && c.visible) k += (ch instanceof PIXI.Sprite ? 1 : 0) + cnt(ch); return k; }; n = cnt(app.stage);
      return {mem, sprites: n, atlases: Object.keys(MHR.atlases).filter(k => MHR.atlases[k].ready), res: stats.res, w: app.renderer.width, h: app.renderer.height, parts: parts.length}; }, paintField: () => ok && !!(MAPA && MAPA.field),
  };
  ACTIONS.renderer = () => { localStorage.setItem(KEY, want() === 'pixi' ? 'canvas' : 'pixi'); location.reload(); };
  const manP = fetch('art/units.json').then(r => r.json()).then(m => {
    m.frames = Object.values(m.anims).reduce((a, [o, n]) => Math.max(a, o + n), 0); m.rows = {};
    for (const u of Object.values(m.units)) m.rows[u.atlas] = Math.max(m.rows[u.atlas] || 0, u.row + 1);
    man = m; return m;
  }).catch(() => null);
  let MAPA = null; // painted map + battlefield art (art/map.json), Pixi mode only
  if (want() !== 'pixi' || !glOK || !window.PIXI) return;
  const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const mapP = fetch('art/map.json').then(r => r.json()).then(async m => {
    const [g, sp, f] = await Promise.all([img(m.ground), img(m.sprites), img(m.field)]); return {m, g, sp, f};
  }).catch(e => { console.warn('Mini Heroes: painted map art unavailable', e); return null; });

  px = document.createElement('canvas'); px.id = 'px'; cv.after(px);
  const show = on => { px.style.visibility = on ? 'visible' : 'hidden'; cv.style.opacity = on ? '0' : ''; };
  const _title = renderTitle; renderTitle = function () { show(false); return _title(); };

  // ---- textures ----
  const cache = new WeakMap();
  const SRCS = new Set(), reg = src => (SRCS.add(src), src);
  const tex = c => { let t = cache.get(c); if (!t) { t = PIXI.Texture.from(c); t.source.scaleMode = 'nearest'; reg(t.source); cache.set(c, t); } return t; };
  const pool = (cont, n, make) => { while (cont.children.length < n) cont.addChild(make()); const ch = cont.children; for (let i = 0; i < ch.length; i++) ch[i].visible = i < n; return ch; };
  const sprite = () => { const s = new PIXI.Sprite(); s.roundPixels = true; return s; };
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); return c; })();

  // lazy faction atlases (LRU of 3)
  const lru = [];
  function atlas(fac) {
    const A = MHR.atlases[fac]; if (A) { const i = lru.indexOf(fac); if (i > 0) { lru.splice(i, 1); lru.unshift(fac); } return A.ready ? A : null; }
    if (!man) return null;
    const a = MHR.atlases[fac] = {ready: false}, img = new Image();
    img.onload = () => {
      a.source = reg(new PIXI.ImageSource({resource: img, scaleMode: 'linear', autoGenerateMipmaps: false})); a.frames = {};
      a.ready = true; lru.unshift(fac);
      while (lru.length > 3) { const old = lru.pop(), o = MHR.atlases[old]; delete MHR.atlases[old]; for (const f of Object.values(o.frames)) for (const t of Object.values(f).flat()) if (t && t.destroy) t.destroy(false); o.source.destroy(); }
    };
    img.onerror = () => { a.failed = true; }; img.src = man.atlases[fac];
    return null;
  }
  function framesOf(type) {
    const m = man && man.units[type]; if (!m) return null; const A = atlas(m.atlas); if (!A) return null; const C = (man.cells && man.cells[m.atlas]) || man.cell;
    if (!A.frames[type]) { const fr = {cell: C}; for (const [k, [o, n]] of Object.entries(man.anims)) fr[k] = Array.from({length: n}, (_, i) => new PIXI.Texture({source: A.source, frame: new PIXI.Rectangle((o + i) * C, m.row * C, C, C)})); A.frames[type] = fr; }
    return A.frames[type];
  }

  // ---- scenes ----
  let fieldL, bgL, fgL, dimL, BH_, hdrBg, hdrS, hdrT, root, M, W, water, land, things, dynS, fog, BS, bgS, units, fx, fgS, dyn, dctx, dynT, fgc, fgx, bgT, fgT, lastLayers = null, lastFog = -1;
  function build() {
    root = new PIXI.Container(); M = new PIXI.Container(); W = new PIXI.Container(); M.addChild(W);
    water = sprite(); land = sprite(); dynS = sprite(); things = new PIXI.Container(); things.sortableChildren = true; fog = sprite();
    W.addChild(water, land, dynS, things, fog);
    dyn = document.createElement('canvas'); dyn.width = dyn.height = 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT;
    BS = new PIXI.Container(); fieldL = new PIXI.Container(); bgL = new PIXI.Container(); units = new PIXI.Container(); fx = new PIXI.Container(); fgL = new PIXI.Container(); dimL = new PIXI.Container(); BS.addChild(fieldL, bgL, units, fx, fgL, dimL);
    BH_ = new PIXI.Container(); hdrBg = sprite(); hdrS = sprite(); BH_.addChild(hdrBg, hdrS);
    fgc = document.createElement('canvas'); fgc.width = BLW; fgc.height = BLH; fgx = fgc.getContext('2d');
    bgT = tex(bcv); fgT = tex(fgc); hdrT = tex(hcv);
    root.addChild(M, BS, BH_); app.stage.addChild(root);
  }
  function fit() {
    const k = Math.min(1, (LOWQ() ? 1 : DPR_CAP) / CAM.dpr), w = Math.max(1, Math.round(CAM.w * k)), h = Math.max(1, Math.round(CAM.h * k));
    if (app.renderer.width !== w || app.renderer.height !== h) app.renderer.resize(w, h);
    root.scale.set(k); stats.res = k;
  }
  function frame(scene, bg) {
    M.visible = scene === M; BS.visible = BH_.visible = scene === BS; app.renderer.background.color = bg;
    app.renderer.render(app.stage); show(true);
  }

  // painted map art: terrain is baked once per map into a 2x canvas (soft blended textures + trees/rocks), objects
  // are sprites from one packed sheet baked at 3x their logical size, so nothing is ever upscaled at zoom 1-1.5
  const P2 = 2, OWN = {player: 0x2c7cf0, ai: 0xe40058};
  function setupMapArt(A) {
    const sp = reg(new PIXI.ImageSource({resource: A.sp, scaleMode: 'linear'})), fr = {};
    for (const [k, [x, y, w, h]] of Object.entries(A.m.frames)) fr[k] = new PIXI.Texture({source: sp, frame: new PIXI.Rectangle(x, y, w, h)});
    MAPA = {k: A.m.k, fr, img: A.sp, pos: A.m.frames, ground: A.g, field: new PIXI.Texture({source: reg(new PIXI.ImageSource({resource: A.f, scaleMode: 'linear'}))}), land: null, map: null, ui: {}};
  }
  const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function paintLand(map) {
    const H = map.length, Wd = map[0].length, T = TS * P2, c = document.createElement('canvas'); c.width = Wd * T; c.height = H * T; const g = c.getContext('2d');
    const pats = [0, 1, 2, 3].map(i => { const t = document.createElement('canvas'); t.width = t.height = 256; t.getContext('2d').drawImage(MAPA.ground, i * 256, 0, 256, 256, 0, 0, 256, 256); return g.createPattern(t, 'repeat'); });
    g.fillStyle = pats[0]; g.fillRect(0, 0, c.width, c.height);
    const L = document.createElement('canvas'); L.width = c.width; L.height = c.height; const lg = L.getContext('2d'), m = document.createElement('canvas'); m.width = Wd; m.height = H; const mg = m.getContext('2d');
    const layer = (pred, fill, tint) => {
      mg.clearRect(0, 0, Wd, H); mg.fillStyle = '#fff'; for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) if (pred(map[y][x])) mg.fillRect(x, y, 1, 1);
      lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, L.width, L.height); lg.imageSmoothingEnabled = true; lg.imageSmoothingQuality = 'high';
      lg.drawImage(m, 0, 0, L.width, L.height); lg.drawImage(m, 0, 0, L.width, L.height); // twice: firmer edges, still a soft half-tile blend
      lg.globalCompositeOperation = 'source-in'; lg.fillStyle = fill; lg.fillRect(0, 0, L.width, L.height);
      if (tint) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = tint; lg.fillRect(0, 0, L.width, L.height); }
      g.drawImage(L, 0, 0);
    };
    layer(t => t === 2, pats[0], 'rgba(10,50,10,.28)');      // forest floor
    layer(t => t === 1 || t === 3, pats[1]);                // rough + rocky ground
    layer(t => t === 5, pats[2]);                           // road
    layer(t => t === 4, pats[2], 'rgba(255,240,200,.25)');  // sandy shore under the water
    layer(t => t === 4, pats[3]); layer(t => t === 4, pats[3]);
    const put = (k, cx, by, sc) => { const [sx, sy, w, h] = MAPA.pos[k], f = P2 / MAPA.k * sc; g.drawImage(MAPA.img, sx, sy, w, h, Math.round(cx - w * f / 2), Math.round(by - h * f), Math.round(w * f), Math.round(h * f)); };
    for (let y = 0; y < H; y++) for (let x = 0; x < Wd; x++) {
      const t = map[y][x], X = x * T, Y = y * T;
      if (t === 2) { put('tree:' + Math.floor(hash(x, y, 1) * 4), X + T * (0.3 + hash(x, y, 2) * 0.15), Y + T * 0.62, 0.85 + hash(x, y, 3) * 0.2); put('tree:' + Math.floor(hash(x, y, 4) * 4), X + T * (0.6 + hash(x, y, 5) * 0.15), Y + T * 1.02, 0.9 + hash(x, y, 6) * 0.2); }
      else if (t === 3) put('rock:' + Math.floor(hash(x, y, 7) * 4), X + T * (0.45 + hash(x, y, 8) * 0.1), Y + T * 1.0, 1 + hash(x, y, 9) * 0.25);
    }
    return c;
  }
  function uiTex(type) { // map monsters: the pre-baked 96px portrait (tiny, every faction can stay resident)
    const m = man && man.units[type], u = m && man.ui && man.ui[m.atlas]; if (!u) return null; let A = MAPA.ui[m.atlas];
    if (!A) { A = MAPA.ui[m.atlas] = {}; img(u.src).then(i => { A.src = reg(new PIXI.ImageSource({resource: i, scaleMode: 'linear'})); A.t = {}; }).catch(() => {}); }
    if (!A.src) return null; return A.t[type] || (A.t[type] = new PIXI.Texture({source: A.src, frame: new PIXI.Rectangle(m.row * u.cell, 0, u.cell, u.cell)}));
  }

  // ---- adventure map: terrain + fog are big static textures; towns, heroes and map objects are y-sorted sprites;
  // only the path preview / selection / campaign specials still come from the canvas overlay ----
  const NATIVE = {res: 1, chest: 1, art: 1, mine: 1, grove: 1, monster: 1};
  const skipObj = o => NATIVE[o.kind] && !(o.shrine || o.haven || o.special);
  const badge = {};
  const threatTex = c => badge[c] || (badge[c] = tex((() => { const k = document.createElement('canvas'); k.width = 16; k.height = 22; const g = k.getContext('2d');
    g.fillStyle = c + '90'; g.fillRect(1, 18, 14, 3); g.fillRect(3, 21, 10, 1); g.fillStyle = '#000'; g.fillRect(9, 0, 9, 6); g.fillStyle = c; g.fillRect(10, 1, 7, 4); return k; })()));
  function drawMap() {
    const t0 = performance.now();
    ensureLayers(); clampCam(); fit();
    const PA = !!MAPA;
    if (PA && MAPA.map !== layers.map) { MAPA.land = tex(paintLand(layers.map)); MAPA.land.source.scaleMode = 'linear'; MAPA.map = layers.map; lastLayers = null; }
    if (layers !== lastLayers) { land.texture = PA ? MAPA.land : tex(layers.land); land.scale.set(PA ? 1 / P2 : 1); fog.texture = tex(layers.fog); if (PA) fog.texture.source.scaleMode = 'linear'; lastLayers = layers; lastFog = -1; }
    if (layers.fogN !== lastFog) { fog.texture.source.update(); lastFog = layers.fogN; }
    water.visible = !PA; if (!PA) water.texture = tex(layers.water[Math.floor(clock * 3) % 4]);
    const V = viewRect();
    if (dyn.width < V.w || dyn.height < V.h) { dyn = document.createElement('canvas'); dyn.width = Math.ceil(V.w / 64) * 64; dyn.height = Math.ceil(V.h / 64) * 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT; }
    renderWorld({dyn: true, g: dctx, skipObj}); dynT.source.update(); dynS.position.set(V.x, V.y);
    const tx0 = V.x / TS - 3, ty0 = V.y / TS - 3, tx1 = (V.x + V.w) / TS + 3, ty1 = (V.y + V.h) / TS + 3, inV = (x, y) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
    const list = [], f4 = Math.floor(clock * 4), F = PA && MAPA.fr, k = PA ? 1 / MAPA.k : 1;
    // e: {z, t: texture, x, y, ax, ay, s, fx (flip), w, h, tint}
    const P = (z, kk, x, y, o) => list.push(Object.assign({z, t: F[kk], x, y, ax: 0.5, ay: 1, s: k}, o));
    const flag = (z, x, y, owner) => { if (!owner) return; list.push({z: z + 0.001, t: tex(dot), x, y: y - 9, ax: 0, ay: 0, w: 1, h: 10, tint: 0x201810}); list.push({z: z + 0.002, t: tex(dot), x: x + 1, y: y - 9, ax: 0, ay: 0, w: 6, h: 4, tint: OWN[owner] || 0xbcbcbc}); };
    for (const o of G.objs) {
      if (!inV(o.x, o.y) || !skipObj(o)) continue; const X = o.x * TS, Y = o.y * TS, f = Math.floor(clock * 4 + o.id);
      if (PA) {
        if (o.kind === 'res') P(o.y, 'pile:' + o.res, X + 8, Y + 15);
        else if (o.kind === 'chest') P(o.y, 'chest', X + 8, Y + 15);
        else if (o.kind === 'art') P(o.y, 'art', X + 8, Y + 15 - Math.round(Math.sin(clock * 3 + o.id) * 1.5));
        else if (o.kind === 'mine') { P(o.y, 'mine:' + o.mine, X + 8, Y + 16); flag(o.y, X + 13, Y - 6, o.owner); }
        else if (o.kind === 'grove') { P(o.y, 'grove', X + 8, Y + 16); flag(o.y, X + 13, Y - 6, o.owner); }
        else if (o.kind === 'monster' && o.army.length) { const th = threatOf(o.army), ut = uiTex(o.army[0].type); list.push({z: o.y - 0.01, t: threatTex(th.c), x: X, y: Y - 12, ax: 0, ay: 0, s: 1});
          if (ut) { const b = Math.sin(clock * 2.5 + o.id) * 0.4; list.push({z: o.y, t: ut, x: X + 8, y: Y + 16 + b, ax: 0.5, ay: 93 / 96, s: 24 / 96, fx: true}); }
          else list.push({z: o.y, t: tex(SPR.unit(o.army[0].type, Math.floor(clock * 2 + o.id * 0.37) % 2, true)), x: X - 4, y: Y - 9, ax: 0, ay: 0, s: 1}); }
        continue;
      }
      if (o.kind === 'res') list.push({z: o.y, t: tex(SPR.pile(o.res)), x: X, y: Y});
      else if (o.kind === 'chest') list.push({z: o.y, t: tex(SPR.chest()), x: X, y: Y});
      else if (o.kind === 'art') list.push({z: o.y, t: tex(SPR.artifact(f % 3)), x: X, y: Y - Math.round(Math.sin(clock * 3 + o.id) * 1.5)});
      else if (o.kind === 'mine') list.push({z: o.y, t: tex(SPR.mine(o.mine, o.owner, f4 % 2)), x: X - 4, y: Y - 10});
      else if (o.kind === 'grove') list.push({z: o.y, t: tex(SPR.grove(o.owner, Math.floor(clock * 3) % 2)), x: X - 4, y: Y - 10});
      else if (o.kind === 'monster' && o.army.length) { const th = threatOf(o.army); list.push({z: o.y - 0.01, t: threatTex(th.c), x: X, y: Y - 12}); list.push({z: o.y, t: tex(SPR.unit(o.army[0].type, Math.floor(clock * 2 + o.id * 0.37) % 2, true)), x: X - 4, y: Y - 9}); }
    }
    for (const t of G.towns) if (inV(t.x, t.y)) {
      if (PA) { P(t.y + 0.1, 'town:' + t.faction, t.x * TS + 8, t.y * TS + 17); flag(t.y + 0.1, t.x * TS + 18, t.y * TS - 14, t.owner); }
      else list.push({z: t.y + 0.1, t: tex(SPR.town(t.faction, t.owner, f4 % 2)), x: t.x * TS - 10, y: t.y * TS - 18});
    }
    for (const h of G.heroes) { const p = rp(h); if (!inV(p.x, p.y)) continue; const mv = p.moving > 0.02, inTown = !mv && townAt(h.x, h.y);
      if (PA) { const bob = mv ? -Math.abs(Math.sin(clock * 12)) * 1.5 : 0;
        P(p.y + 0.2, 'hero:' + (h.owner === 'player' ? 'player' : 'ai'), Math.round(p.x * TS * 2) / 2 + (inTown ? 12 : 8), Math.round(p.y * TS * 2) / 2 + (inTown ? 16 : 15) + bob, {s: k * (inTown ? 0.7 : 1), fx: p.face < 0}); continue; }
      const f = mv ? 1 + Math.floor(clock * 8) % 2 : 0, im = SPR.hero(h.owner, f, p.face < 0);
      if (inTown) list.push({z: p.y + 0.2, t: tex(im), x: Math.round(p.x * TS) + 3, y: Math.round(p.y * TS) + 1, s: 0.7});
      else list.push({z: p.y + 0.2, t: tex(im), x: Math.round(p.x * TS) - 2, y: Math.round(p.y * TS) - 6}); }
    pool(things, list.length, sprite).forEach((s, i) => { const e = list[i]; if (!e) return; s.texture = e.t; s.anchor.set(e.ax || 0, e.ay || 0); s.position.set(e.x, e.y); s.zIndex = e.z; s.tint = e.tint || 0xffffff; s.roundPixels = !PA;
      if (e.w) { s.scale.set(1); s.width = e.w; s.height = e.h; } else { const sc = e.s || 1; s.scale.set(e.fx ? -sc : sc, sc); } });
    W.scale.set(CAM.z); W.position.set(Math.round(-CAM.x * CAM.z), Math.round(-CAM.y * CAM.z));
    frame(M, 0x05050c);
    stats.map = stats.map * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  // ---- battle ----
  // atlas cell -> logical px: 128px painted cells show at ~43px, Castle chibi 192px cells at 46px (bigger, still <2x downscale)
  const shOf = c => (c >= 192 ? 46 : 43.5) / c;
  const parts = [], seen = new Set();
  function burst(x, y, n, col, spd, life, up) { if (LOWQ()) n = Math.ceil(n * 0.4); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random()); parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), t: 0, life: life * (0.6 + Math.random() * 0.6), col, sz: 1 + Math.random() * 1.5}); } }
  function drawFight(sx, sy) {
    const t0 = performance.now(); fit(); const LQ = LOWQ(), ks = bandKs(), nk = ks.length;
    drawBattle(bctx, 'bg'); bgT.source.update();
    drawBattle(fgx, 'fgn'); fgT.source.update(); hdrT.source.update();
    const PF = MAPA && MAPA.field;
    // every layer is drawn once per wrapped copy (layer-major, so things crossing the seam overlap the next copy correctly)
    pool(fieldL, PF ? nk : 0, sprite).forEach((s, i) => { if (i >= nk || !PF) return; s.texture = MAPA.field; s.position.set(0, BOY + ks[i] * PER); s.width = BLW; s.height = PER; });
    pool(bgL, nk, sprite).forEach((s, i) => { if (i >= nk) return; s.texture = bgT; s.position.set(0, ks[i] * PER); });
    pool(fgL, nk, sprite).forEach((s, i) => { if (i >= nk) return; s.texture = fgT; s.position.set(0, ks[i] * PER); });
    const vis = B.units.filter(u => !u.gone && !(u.hidden && u.side === 'R') && (u.alive || u.deadAt == null || B.clock < u.deadAt + 0.9)).sort((a, b) => a.ry - b.ry), U = [];
    for (const u of vis) {
      let X = hxp(u.rx, u.ry), Y = hyp(u.ry) - 6, f = Math.floor(clock * 2 + u.ph) % 2, flash = false, atk = -1, hit = -1, dirx = u.side === 'L' ? 1 : -1; const FY = hyp(u.ry);
      for (const a of u.atk) { const k = (B.clock - a.at) / 0.3; if (k >= 0 && k <= 1) { f = 2; atk = k; const e = k < 0.6 ? k / 0.6 : (1 - k) / 0.4; X += a.dx * e * 9; Y += a.dy * e * 9; } }
      for (const h of u.hit) { const k = B.clock - h; if (k >= 0 && k < 0.3) { hit = k / 0.3; flash = Math.floor(k * 20) % 2 === 0; X -= dirx * Math.sin(Math.min(1, hit * 2) * Math.PI) * 3; }
        const key = u.id + '@' + h; if (k >= 0 && !seen.has(key)) { seen.add(key); burst(X + 12, FY + 6, 7, 0xfcfcfc, 26, 0.35, 10); burst(X + 12, FY + 8, 5, 0xe40058, 18, 0.45, 6); } }
      const dying = u.deadAt != null && B.clock >= u.deadAt, dk = dying ? Math.min(1, (B.clock - u.deadAt) / 0.9) : 0;
      if (dying && !seen.has(u.id + '#d' + u.deadAt)) { seen.add(u.id + '#d' + u.deadAt); burst(X + 12, FY + 12, 16, 0xbcbcbc, 14, 0.9, 4); burst(X + 12, FY + 4, 8, u.side === 'L' ? 0x3cbcfc : 0xfc4878, 10, 1.1, 18); }
      const sh = framesOf(u.type), left = u.side === 'R', e = {alpha: u.hidden && !dying ? 0.45 + 0.1 * Math.sin(clock * 5) : 1};
      if (sh) {
        const idle = LQ ? sh.idle[(Math.floor(clock * 1.5 + u.ph * 2) % 2) * 2] : sh.idle[Math.floor(clock * 3 + u.ph * 4) % 4], dn = sh.death.length;
        e.t = dying ? sh.death[LQ ? Math.min(dn - 1, Math.floor(dk * 3) * 2) : Math.min(dn - 1, Math.floor(dk * dn))] : atk >= 0 ? sh.attack[Math.min(3, Math.floor(atk * 4))] : hit >= 0 ? sh.hit[Math.min(2, Math.floor(hit * 3))] : idle;
        const SH = shOf(sh.cell); e.ax = 0.5; e.ay = man.base / man.cell; e.sx = left ? -SH : SH; e.sy = SH; e.x = X + 12 + dirx * 2; e.y = FY + RH - 2 + (Y - (FY - 6)); e.rp = false;
        if (dying) e.alpha = 1 - Math.max(0, dk - 0.7) * 3.3;
      } else {
        e.t = tex(flash ? SPR.unitFlash(u.type, f, left) : SPR.unitTeam(u.type, f, left, u.side === 'L' ? '#1c5cb0' : '#9c1840'));
        e.ax = e.ay = 0; e.sx = e.sy = 1; e.x = Math.round(X); e.y = Math.round(Y + dk * 6); e.rp = true;
        if (dying) e.alpha = 1 - Math.min(1, dk * 1.5);
      }
      U.push(e);
    }
    const nu = U.length;
    pool(units, nu * nk, sprite).forEach((s, i) => { if (i >= nu * nk) return; const e = U[i % nu], k = ks[Math.floor(i / nu)];
      s.texture = e.t; s.anchor.set(e.ax, e.ay); s.scale.set(e.sx, e.sy); s.position.set(e.x, e.y + k * PER); s.alpha = e.alpha; s.roundPixels = e.rp; s.tint = 0xffffff; });
    // projectiles (shortest way across the seam) and particles as native sprites
    const live = [];
    for (const p of B.proj) { const k = (B.clock - p.at) / p.dur; if (k < 0 || k > 1) continue;
      const [x0, y0] = cellC(p.fx, p.fy), [x1, y1] = cellC(p.tx, nearY(p.fy, p.ty)), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * (p.arc || 14) - 4;
      if (p.kind === 'arrow') { const a = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * (p.arc || 14) * Math.PI, x1 - x0); live.push([x, y, 9, 1.4, a, 0xc8a060]); live.push([x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.5, 2.2, a, 0xfcfcfc]); }
      else if (p.kind === 'boulder') { live.push([x, y, 6, 6, k * 9, 0x8c8c8c]); live.push([x - 1, y - 1, 3, 3, 0, 0xc8c8c8]); }
      else { const c = parseInt(String(p.col || '#fcfcfc').slice(1), 16); live.push([x, y, 5, 5, 0, c]); live.push([x, y, 2, 2, 0, 0xffffff]); if (!LQ && Math.random() < 0.5) parts.push({x, y, vx: 0, vy: 0, t: 0, life: 0.25, col: c, sz: 1.5}); } }
    const dt = Math.min(0.05, (performance.now() - (drawFight.last || performance.now())) / 1000) * (B.phase === 'resolve' ? (UI.skip ? 0 : UI.bspeed || 1) : 1); drawFight.last = performance.now();
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 30 * dt; if (q.t >= q.life) parts.splice(i, 1); }
    const PCAP = LQ ? 60 : 150; if (parts.length > PCAP) parts.splice(0, parts.length - PCAP); // never more than 150 live particles (60 on LOW)
    if (seen.size > 2000) seen.clear();
    const n = live.length + parts.length, dt0 = tex(dot);
    pool(fx, n * nk, sprite).forEach((s, i) => { if (i >= n * nk) return; const j = i % n, ko = ks[Math.floor(i / n)] * PER; s.texture = dt0; s.anchor.set(0.5); s.roundPixels = false;
      if (j < live.length) { const [x, y, w, h, a, c] = live[j]; s.position.set(x, y + ko); s.width = w; s.height = h; s.rotation = a; s.tint = c; s.alpha = 1; }
      else { const q = parts[j - live.length]; s.position.set(q.x, q.y + ko); s.width = s.height = q.sz; s.rotation = 0; s.tint = q.col; s.alpha = 1 - q.t / q.life; } });
    // dim the wrapped copies + mark the seam
    const dk = ks.filter(k => k);
    pool(dimL, dk.length + 2, sprite).forEach((s, i) => { if (i >= dk.length + 2) return; s.texture = dt0; s.anchor.set(0); s.rotation = 0;
      if (i < dk.length) { s.position.set(0, BOY + dk[i] * PER); s.width = BLW; s.height = PER; s.tint = 0x05050c; s.alpha = 0.4; }
      else { s.position.set(0, BOY + (i - dk.length) * PER - 0.5); s.width = BLW; s.height = 1; s.tint = 0xf8b800; s.alpha = 0.55; } });
    BS.scale.set(BV.s); BS.position.set(BV.ox + sx, BV.oy + sy);
    hdrBg.texture = dt0; hdrBg.tint = 0x10101e; hdrBg.position.set(0, 0); hdrBg.width = BV.aw; hdrBg.height = BV.hh;
    hdrS.texture = hdrT; hdrS.position.set(Math.round((BV.aw - BLW * BV.hs) / 2), 0); hdrS.scale.set(BV.hs);
    frame(BS, 0x10101e);
    stats.battle = stats.battle * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  (async () => {
    try {
      app = new PIXI.Application();
      await app.init({canvas: px, width: Math.max(1, cv.width), height: Math.max(1, cv.height), backgroundColor: 0x05050c, antialias: false, preference: 'webgl', autoStart: false, resolution: 1, autoDensity: false, powerPreference: 'high-performance'});
      app.ticker.stop(); build(); await manP; const A = await mapP; if (A) setupMapArt(A); ok = true;
    } catch (e) { failed = true; ok = false; if (px) px.remove(); cv.style.opacity = ''; console.warn('Mini Heroes: Pixi renderer unavailable, using canvas', e); }
  })();
})();
