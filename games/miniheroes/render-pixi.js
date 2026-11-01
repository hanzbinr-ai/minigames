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
  const DPR_CAP = 2; // render at most 2 device px per CSS px (phones are 3x): ~55% fewer pixels, visually identical
  let app = null, ok = false, failed = false, px = null, man = null;
  const stats = {map: 0, battle: 0, n: 0, res: 1};
  // painted unit portrait for DOM panels (works in canvas mode too: it is just a CSS sprite of the atlas)
  const pic = u => { const m = man && man.units[u]; if (!m) return null; const n = man.frames, r = man.rows[m.atlas];
    return `<i class="pu" title="${u}" style="background-image:url('${man.atlases[m.atlas]}');--n:${n};--r:${r};--y:${m.row}"></i>`; };
  window.MHR = {
    ready: () => ok, pic,
    mode: () => (ok ? 'pixi' : 'canvas'),
    label: () => (want() !== 'pixi' ? 'CANVAS' : ok ? 'PIXI' : failed || !glOK || !window.PIXI ? 'CANVAS (no WebGL)' : 'PIXI…'),
    map: () => ok && drawMap(),
    battle: (sx, sy) => ok && drawFight(sx, sy),
    stats, get app() { return app; }, atlases: {},
  };
  ACTIONS.renderer = () => { localStorage.setItem(KEY, want() === 'pixi' ? 'canvas' : 'pixi'); location.reload(); };
  const manP = fetch('art/units.json').then(r => r.json()).then(m => {
    m.frames = Object.values(m.anims).reduce((a, [o, n]) => Math.max(a, o + n), 0); m.rows = {};
    for (const u of Object.values(m.units)) m.rows[u.atlas] = Math.max(m.rows[u.atlas] || 0, u.row + 1);
    man = m; return m;
  }).catch(() => null);
  if (want() !== 'pixi' || !glOK || !window.PIXI) return;

  px = document.createElement('canvas'); px.id = 'px'; cv.after(px);
  const show = on => { px.style.visibility = on ? 'visible' : 'hidden'; cv.style.opacity = on ? '0' : ''; };
  const _title = renderTitle; renderTitle = function () { show(false); return _title(); };

  // ---- textures ----
  const cache = new WeakMap();
  const tex = c => { let t = cache.get(c); if (!t) { t = PIXI.Texture.from(c); t.source.scaleMode = 'nearest'; cache.set(c, t); } return t; };
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
      a.source = new PIXI.ImageSource({resource: img, scaleMode: 'linear', autoGenerateMipmaps: false}); a.frames = {};
      a.ready = true; lru.unshift(fac);
      while (lru.length > 3) { const old = lru.pop(), o = MHR.atlases[old]; delete MHR.atlases[old]; for (const f of Object.values(o.frames)) for (const t of Object.values(f).flat()) t.destroy(false); o.source.destroy(); }
    };
    img.onerror = () => { a.failed = true; }; img.src = man.atlases[fac];
    return null;
  }
  function framesOf(type) {
    const m = man && man.units[type]; if (!m) return null; const A = atlas(m.atlas); if (!A) return null;
    if (!A.frames[type]) { const fr = {}; for (const [k, [o, n]] of Object.entries(man.anims)) fr[k] = Array.from({length: n}, (_, i) => new PIXI.Texture({source: A.source, frame: new PIXI.Rectangle((o + i) * man.cell, m.row * man.cell, man.cell, man.cell)})); A.frames[type] = fr; }
    return A.frames[type];
  }

  // ---- scenes ----
  let root, M, W, water, land, things, dynS, fog, BS, bgS, units, fx, fgS, dyn, dctx, dynT, fgc, fgx, bgT, fgT, lastLayers = null, lastFog = -1;
  function build() {
    root = new PIXI.Container(); M = new PIXI.Container(); W = new PIXI.Container(); M.addChild(W);
    water = sprite(); land = sprite(); dynS = sprite(); things = new PIXI.Container(); things.sortableChildren = true; fog = sprite();
    W.addChild(water, land, dynS, things, fog);
    dyn = document.createElement('canvas'); dyn.width = dyn.height = 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT;
    BS = new PIXI.Container(); bgS = sprite(); units = new PIXI.Container(); fx = new PIXI.Container(); fgS = sprite(); BS.addChild(bgS, units, fx, fgS);
    fgc = document.createElement('canvas'); fgc.width = BLW; fgc.height = BLH; fgx = fgc.getContext('2d');
    bgT = tex(bcv); fgT = tex(fgc); bgS.texture = bgT; fgS.texture = fgT;
    root.addChild(M, BS); app.stage.addChild(root);
  }
  function fit() {
    const k = Math.min(1, DPR_CAP / CAM.dpr), w = Math.max(1, Math.round(CAM.w * k)), h = Math.max(1, Math.round(CAM.h * k));
    if (app.renderer.width !== w || app.renderer.height !== h) app.renderer.resize(w, h);
    root.scale.set(k); stats.res = k;
  }
  function frame(scene, bg) {
    M.visible = scene === M; BS.visible = scene === BS; app.renderer.background.color = bg;
    app.renderer.render(app.stage); show(true);
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
    if (layers !== lastLayers) { land.texture = tex(layers.land); fog.texture = tex(layers.fog); lastLayers = layers; lastFog = -1; }
    if (layers.fogN !== lastFog) { fog.texture.source.update(); lastFog = layers.fogN; }
    water.texture = tex(layers.water[Math.floor(clock * 3) % 4]);
    const V = viewRect();
    if (dyn.width < V.w || dyn.height < V.h) { dyn = document.createElement('canvas'); dyn.width = Math.ceil(V.w / 64) * 64; dyn.height = Math.ceil(V.h / 64) * 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT; }
    renderWorld({dyn: true, g: dctx, skipObj}); dynT.source.update(); dynS.position.set(V.x, V.y);
    const tx0 = V.x / TS - 3, ty0 = V.y / TS - 3, tx1 = (V.x + V.w) / TS + 3, ty1 = (V.y + V.h) / TS + 3, inV = (x, y) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
    const list = [], f4 = Math.floor(clock * 4);
    for (const o of G.objs) {
      if (!inV(o.x, o.y) || !skipObj(o)) continue; const X = o.x * TS, Y = o.y * TS, f = Math.floor(clock * 4 + o.id);
      if (o.kind === 'res') list.push([o.y, SPR.pile(o.res), X, Y]);
      else if (o.kind === 'chest') list.push([o.y, SPR.chest(), X, Y]);
      else if (o.kind === 'art') list.push([o.y, SPR.artifact(f % 3), X, Y - Math.round(Math.sin(clock * 3 + o.id) * 1.5)]);
      else if (o.kind === 'mine') list.push([o.y, SPR.mine(o.mine, o.owner, f4 % 2), X - 4, Y - 10]);
      else if (o.kind === 'grove') list.push([o.y, SPR.grove(o.owner, Math.floor(clock * 3) % 2), X - 4, Y - 10]);
      else if (o.kind === 'monster' && o.army.length) { const th = threatOf(o.army); list.push([o.y - 0.01, null, X, Y - 12, threatTex(th.c)]); list.push([o.y, SPR.unit(o.army[0].type, Math.floor(clock * 2 + o.id * 0.37) % 2, true), X - 4, Y - 9]); }
    }
    for (const t of G.towns) if (inV(t.x, t.y)) list.push([t.y + 0.1, SPR.town(t.faction, t.owner, f4 % 2), t.x * TS - 10, t.y * TS - 18]);
    for (const h of G.heroes) { const p = rp(h); if (!inV(p.x, p.y)) continue; const f = p.moving > 0.02 ? 1 + Math.floor(clock * 8) % 2 : 0, im = SPR.hero(h.owner, f, p.face < 0);
      if (p.moving <= 0.02 && townAt(h.x, h.y)) list.push([p.y + 0.2, im, Math.round(p.x * TS) + 3, Math.round(p.y * TS) + 1, null, 0.7]);
      else list.push([p.y + 0.2, im, Math.round(p.x * TS) - 2, Math.round(p.y * TS) - 6]); }
    pool(things, list.length, sprite).forEach((s, i) => { const e = list[i]; if (!e) return; s.texture = e[4] || tex(e[1]); s.position.set(e[2], e[3]); s.scale.set(e[5] || 1); s.zIndex = e[0]; });
    W.scale.set(CAM.z); W.position.set(Math.round(-CAM.x * CAM.z), Math.round(-CAM.y * CAM.z));
    frame(M, 0x05050c);
    stats.map = stats.map * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  // ---- battle ----
  const SH = 0.34; // 128px atlas cell -> ~43 logical px; a 24px cell holds the feet, figures stand taller like in Heroes 3
  const parts = [], seen = new Set();
  function burst(x, y, n, col, spd, life, up) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random()); parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up || 0), t: 0, life: life * (0.6 + Math.random() * 0.6), col, sz: 1 + Math.random() * 1.5}); } }
  function drawFight(sx, sy) {
    const t0 = performance.now(); fit();
    drawBattle(bctx, 'bg'); bgT.source.update();
    drawBattle(fgx, 'fgn'); fgT.source.update();
    const vis = B.units.filter(u => !u.gone && !(u.hidden && u.side === 'R') && (u.alive || u.deadAt == null || B.clock < u.deadAt + 0.9)).sort((a, b) => a.ry - b.ry);
    pool(units, vis.length, sprite).forEach((s, i) => {
      const u = vis[i]; if (!u) return;
      let X = BOX + u.rx * CW, Y = BOY + u.ry * CW - 4, f = Math.floor(clock * 2 + u.ph) % 2, flash = false, atk = -1, hit = -1, dirx = u.side === 'L' ? 1 : -1;
      for (const a of u.atk) { const k = (B.clock - a.at) / 0.3; if (k >= 0 && k <= 1) { f = 2; atk = k; const e = k < 0.6 ? k / 0.6 : (1 - k) / 0.4; X += a.dx * e * 9; Y += a.dy * e * 9; } }
      for (const h of u.hit) { const k = B.clock - h; if (k >= 0 && k < 0.3) { hit = k / 0.3; flash = Math.floor(k * 20) % 2 === 0; X -= dirx * Math.sin(Math.min(1, hit * 2) * Math.PI) * 3; }
        const key = u.id + '@' + h; if (k >= 0 && !seen.has(key)) { seen.add(key); burst(X + 12, BOY + u.ry * CW + 8, 7, 0xfcfcfc, 26, 0.35, 10); burst(X + 12, BOY + u.ry * CW + 10, 5, 0xe40058, 18, 0.45, 6); } }
      const dying = u.deadAt != null && B.clock >= u.deadAt, dk = dying ? Math.min(1, (B.clock - u.deadAt) / 0.9) : 0;
      if (dying && !seen.has(u.id + '#d' + u.deadAt)) { seen.add(u.id + '#d' + u.deadAt); burst(X + 12, BOY + u.ry * CW + 14, 16, 0xbcbcbc, 14, 0.9, 4); burst(X + 12, BOY + u.ry * CW + 6, 8, u.side === 'L' ? 0x3cbcfc : 0xfc4878, 10, 1.1, 18); }
      const sh = framesOf(u.type), left = u.side === 'R';
      s.alpha = u.hidden && !dying ? 0.45 + 0.1 * Math.sin(clock * 5) : 1; s.tint = 0xffffff;
      if (sh) {
        const fr = dying ? sh.death[Math.min(sh.death.length - 1, Math.floor(dk * sh.death.length))] : atk >= 0 ? sh.attack[Math.min(3, Math.floor(atk * 4))] : hit >= 0 ? sh.hit[Math.min(2, Math.floor(hit * 3))] : sh.idle[Math.floor(clock * 3 + u.ph * 4) % 4];
        s.texture = fr; s.roundPixels = false; s.anchor.set(0.5, man.base / man.cell); s.scale.set(left ? -SH : SH, SH);
        s.position.set(X + 12 + dirx * 2, BOY + u.ry * CW + 21 + (Y - (BOY + u.ry * CW - 4)));
        if (dying) s.alpha = 1 - Math.max(0, dk - 0.7) * 3.3;
      } else {
        s.texture = tex(flash ? SPR.unitFlash(u.type, f, left) : SPR.unitTeam(u.type, f, left, u.side === 'L' ? '#1c5cb0' : '#9c1840'));
        s.roundPixels = true; s.anchor.set(0, 0); s.scale.set(1); s.position.set(Math.round(X), Math.round(Y + dk * 6));
        if (dying) s.alpha = 1 - Math.min(1, dk * 1.5);
      }
    });
    // projectiles and particles as native sprites
    const live = [];
    for (const p of B.proj) { const k = (B.clock - p.at) / p.dur; if (k < 0 || k > 1) continue;
      const [x0, y0] = cellC(p.fx, p.fy), [x1, y1] = cellC(p.tx, p.ty), x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * (p.arc || 14) - 4;
      if (p.kind === 'arrow') { const a = Math.atan2(y1 - y0 - Math.cos(k * Math.PI) * (p.arc || 14) * Math.PI, x1 - x0); live.push([x, y, 9, 1.4, a, 0xc8a060]); live.push([x + Math.cos(a) * 4, y + Math.sin(a) * 4, 2.5, 2.2, a, 0xfcfcfc]); }
      else if (p.kind === 'boulder') { live.push([x, y, 6, 6, k * 9, 0x8c8c8c]); live.push([x - 1, y - 1, 3, 3, 0, 0xc8c8c8]); }
      else { const c = parseInt(String(p.col || '#fcfcfc').slice(1), 16); live.push([x, y, 5, 5, 0, c]); live.push([x, y, 2, 2, 0, 0xffffff]); if (Math.random() < 0.5) parts.push({x, y, vx: 0, vy: 0, t: 0, life: 0.25, col: c, sz: 1.5}); } }
    const dt = Math.min(0.05, (performance.now() - (drawFight.last || performance.now())) / 1000) * (B.phase === 'resolve' ? (UI.skip ? 0 : UI.bspeed || 1) : 1); drawFight.last = performance.now();
    for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 30 * dt; if (q.t >= q.life) parts.splice(i, 1); }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
    if (seen.size > 2000) seen.clear();
    const n = live.length + parts.length, dt0 = tex(dot);
    pool(fx, n, sprite).forEach((s, i) => { if (i >= n) return; s.texture = dt0; s.anchor.set(0.5); s.roundPixels = false;
      if (i < live.length) { const [x, y, w, h, a, c] = live[i]; s.position.set(x, y); s.width = w; s.height = h; s.rotation = a; s.tint = c; s.alpha = 1; }
      else { const q = parts[i - live.length]; s.position.set(q.x, q.y); s.width = s.height = q.sz; s.rotation = 0; s.tint = q.col; s.alpha = 1 - q.t / q.life; } });
    BS.scale.set(BV.s); BS.position.set(BV.ox + sx, BV.oy + sy);
    frame(BS, 0x10101e);
    stats.battle = stats.battle * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  (async () => {
    try {
      app = new PIXI.Application();
      await app.init({canvas: px, width: Math.max(1, cv.width), height: Math.max(1, cv.height), backgroundColor: 0x05050c, antialias: false, preference: 'webgl', autoStart: false, resolution: 1, autoDensity: false, powerPreference: 'high-performance'});
      app.ticker.stop(); build(); await manP; ok = true;
    } catch (e) { failed = true; ok = false; if (px) px.remove(); cv.style.opacity = ''; console.warn('Mini Heroes: Pixi renderer unavailable, using canvas', e); }
  })();
})();
