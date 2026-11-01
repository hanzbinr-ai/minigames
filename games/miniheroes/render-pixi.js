// Mini Heroes - RENDER LAYER (PixiJS / WebGL). Draws the adventure map and battles on a GPU canvas stacked
// over #c. Game logic, input and DOM panels are untouched: #c still gets every pointer event (it just turns
// transparent), and if WebGL is missing, Pixi fails to start, or GRAPHICS is set to CANVAS in the menu,
// the classic canvas renderer in game.js keeps drawing exactly as before.
// Castle units use painted WebP sprite sheets (art/*.webp, built by art/build_atlas.py) with idle / attack /
// hit / death frames; every other sprite still comes from the procedural SPR canvases (uploaded once as textures).
'use strict';
(() => {
  const KEY = 'mh-renderer', want = () => localStorage.getItem(KEY) || 'pixi';
  const glOK = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  let app = null, ok = false, failed = false, px = null;
  const stats = {map: 0, battle: 0, n: 0};
  window.MHR = {
    ready: () => ok,
    mode: () => (ok ? 'pixi' : 'canvas'),
    label: () => (want() !== 'pixi' ? 'CANVAS' : ok ? 'PIXI' : failed || !glOK || !window.PIXI ? 'CANVAS (no WebGL)' : 'PIXI…'),
    map: () => ok && drawMap(),
    battle: (sx, sy) => ok && drawFight(sx, sy),
    stats, get app() { return app; }, sheets: null,
  };
  ACTIONS.renderer = () => { localStorage.setItem(KEY, want() === 'pixi' ? 'canvas' : 'pixi'); location.reload(); };
  if (want() !== 'pixi' || !glOK || !window.PIXI) return;

  px = document.createElement('canvas'); px.id = 'px'; cv.after(px);
  const show = on => { px.style.visibility = on ? 'visible' : 'hidden'; cv.style.opacity = on ? '0' : ''; };
  const _title = renderTitle; renderTitle = function () { show(false); return _title(); };

  // ---- textures ----
  const cache = new WeakMap();
  const tex = c => { let t = cache.get(c); if (!t) { t = PIXI.Texture.from(c); t.source.scaleMode = 'nearest'; cache.set(c, t); } return t; };
  const pool = (cont, n, make) => { while (cont.children.length < n) cont.addChild(make()); cont.children.forEach((s, i) => { s.visible = i < n; }); return cont.children; };
  const sprite = () => { const s = new PIXI.Sprite(); s.roundPixels = true; return s; };

  // ---- scenes ----
  let M, W, water, land, towns, dynS, heroes, fog, BS, bgS, units, fgS, dyn, dctx, dynT, fgc, fgx, bgT, fgT, lastLayers = null, lastFog = -1;
  function build() {
    M = new PIXI.Container(); W = new PIXI.Container(); M.addChild(W);
    water = sprite(); land = sprite(); towns = new PIXI.Container(); dynS = sprite(); heroes = new PIXI.Container(); fog = sprite();
    W.addChild(water, land, towns, dynS, heroes, fog);
    dyn = document.createElement('canvas'); dyn.width = dyn.height = 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT;
    BS = new PIXI.Container(); bgS = sprite(); units = new PIXI.Container(); fgS = sprite(); BS.addChild(bgS, units, fgS);
    fgc = document.createElement('canvas'); fgc.width = BLW; fgc.height = BLH; fgx = fgc.getContext('2d');
    bgT = tex(bcv); fgT = tex(fgc); bgS.texture = bgT; fgS.texture = fgT;
    app.stage.addChild(M, BS);
  }
  async function loadSheets() {
    const man = await (await fetch('art/castle.json')).json(), out = {};
    await Promise.all(Object.entries(man.units).map(([name, u]) => new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const source = new PIXI.ImageSource({resource: img, scaleMode: 'linear', autoGenerateMipmaps: true}), fr = {};
        for (const [a, [o, n]] of Object.entries(man.anims)) fr[a] = Array.from({length: n}, (_, i) => new PIXI.Texture({source, frame: new PIXI.Rectangle((o + i) * man.cell, 0, man.cell, man.cell)}));
        out[name] = fr; res();
      };
      img.onerror = () => res(); img.src = u.file;
    })));
    MHR.sheets = {man, units: out};
  }
  function fit() {
    if (app.renderer.width !== CAM.w || app.renderer.height !== CAM.h) app.renderer.resize(CAM.w, CAM.h);
  }
  function frame(scene, bg) {
    M.visible = scene === M; BS.visible = scene === BS; app.renderer.background.color = bg;
    app.renderer.render(app.stage); show(true);
  }

  // ---- adventure map ----
  function drawMap() {
    const t0 = performance.now();
    ensureLayers(); clampCam(); fit();
    if (layers !== lastLayers) { land.texture = tex(layers.land); fog.texture = tex(layers.fog); lastLayers = layers; lastFog = -1; }
    if (layers.fogN !== lastFog) { fog.texture.source.update(); lastFog = layers.fogN; }
    water.texture = tex(layers.water[Math.floor(clock * 3) % 4]);
    const V = viewRect();
    if (dyn.width < V.w || dyn.height < V.h) { // grow the overlay canvas (rare: zoom out / resize)
      dyn = document.createElement('canvas'); dyn.width = Math.ceil(V.w / 64) * 64; dyn.height = Math.ceil(V.h / 64) * 64; dctx = dyn.getContext('2d'); dynT = tex(dyn); dynS.texture = dynT;
    }
    renderWorld({dyn: true, g: dctx}); dynT.source.update(); dynS.position.set(V.x, V.y);
    const tx0 = V.x / TS - 3, ty0 = V.y / TS - 3, tx1 = (V.x + V.w) / TS + 3, ty1 = (V.y + V.h) / TS + 3, inV = (x, y) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
    const vt = G.towns.filter(t => inV(t.x, t.y));
    pool(towns, vt.length, sprite).forEach((s, i) => { const t = vt[i]; if (!t) return; s.texture = tex(SPR.town(t.faction, t.owner, Math.floor(clock * 4) % 2)); s.position.set(t.x * TS - 10, t.y * TS - 18); });
    const vh = G.heroes.filter(h => inV(rp(h).x, rp(h).y)).sort((a, b) => rp(a).y - rp(b).y);
    pool(heroes, vh.length, sprite).forEach((s, i) => {
      const h = vh[i]; if (!h) return; const p = rp(h), f = p.moving > 0.02 ? 1 + Math.floor(clock * 8) % 2 : 0, im = SPR.hero(h.owner, f, p.face < 0);
      s.texture = tex(im);
      if (p.moving <= 0.02 && townAt(h.x, h.y)) { s.scale.set(0.7); s.position.set(Math.round(p.x * TS) + 3, Math.round(p.y * TS) + 1); }
      else { s.scale.set(1); s.position.set(Math.round(p.x * TS) - 2, Math.round(p.y * TS) - 6); }
    });
    W.scale.set(CAM.z); W.position.set(Math.round(-CAM.x * CAM.z), Math.round(-CAM.y * CAM.z));
    frame(M, 0x05050c);
    stats.map = stats.map * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  // ---- battle ----
  const SH = 0.31; // 128px sheet frame -> ~40 logical px (one cell is 24): painted units stand a bit taller than their cell
  function drawFight(sx, sy) {
    const t0 = performance.now(); fit();
    drawBattle(bctx, 'bg'); bgT.source.update();
    drawBattle(fgx, 'fg'); fgT.source.update();
    const sheets = MHR.sheets && MHR.sheets.units;
    const vis = B.units.filter(u => !u.gone && !(u.hidden && u.side === 'R') && (u.alive || u.deadAt == null || B.clock < u.deadAt + 0.6)).sort((a, b) => a.ry - b.ry);
    pool(units, vis.length, sprite).forEach((s, i) => {
      const u = vis[i]; if (!u) return;
      let X = BOX + u.rx * CW, Y = BOY + u.ry * CW - 4, f = Math.floor(clock * 2 + u.ph) % 2, flash = false, atk = -1, hit = -1;
      for (const a of u.atk) { const k = (B.clock - a.at) / 0.3; if (k >= 0 && k <= 1) { f = 2; atk = k; const e = k < 0.6 ? k / 0.6 : (1 - k) / 0.4; X += a.dx * e * 9; Y += a.dy * e * 9; } }
      for (const h of u.hit) { const k = B.clock - h; if (k >= 0 && k < 0.22) { hit = k / 0.22; flash = Math.floor(k * 20) % 2 === 0; X += Math.floor(k * 40) % 2 ? 1 : -1; } }
      const dying = u.deadAt != null && B.clock >= u.deadAt, dk = dying ? Math.min(1, (B.clock - u.deadAt) / 0.6) : 0;
      const sh = sheets && sheets[u.type], left = u.side === 'R';
      s.alpha = u.hidden && !dying ? 0.45 + 0.1 * Math.sin(clock * 5) : 1;
      if (sh) { // painted sprite sheet: pick the animation from the same timing the canvas renderer uses
        const fr = dying ? sh.death[Math.min(3, Math.floor(dk * 4))] : atk >= 0 ? sh.attack[Math.min(3, Math.floor(atk * 4))] : hit >= 0 ? sh.hit[Math.min(2, Math.floor(hit * 3))] : sh.idle[Math.floor(clock * 3 + u.ph * 4) % 4];
        s.texture = fr; s.roundPixels = false; s.anchor.set(0.5, 124 / 128); s.scale.set(left ? -SH : SH, SH);
        s.position.set(X + 12, BOY + u.ry * CW + 20 + (Y - (BOY + u.ry * CW - 4)));
        if (dying) s.alpha = 1 - Math.max(0, dk - 0.6) * 2.5;
      } else {
        s.texture = tex(flash ? SPR.unitFlash(u.type, f, left) : SPR.unitTeam(u.type, f, left, u.side === 'L' ? '#1c5cb0' : '#9c1840'));
        s.roundPixels = true; s.anchor.set(0, 0); s.scale.set(1); s.position.set(Math.round(X), Math.round(Y + dk * 6));
        if (dying) s.alpha = 1 - dk;
      }
    });
    BS.scale.set(BV.s); BS.position.set(BV.ox + sx, BV.oy + sy);
    frame(BS, 0x10101e);
    stats.battle = stats.battle * 0.95 + (performance.now() - t0) * 0.05; stats.n++;
    return true;
  }

  (async () => {
    try {
      app = new PIXI.Application();
      await app.init({canvas: px, width: Math.max(1, cv.width), height: Math.max(1, cv.height), backgroundColor: 0x05050c, antialias: false, preference: 'webgl', autoStart: false, resolution: 1, autoDensity: false, powerPreference: 'high-performance'});
      app.ticker.stop(); build(); await loadSheets(); ok = true;
    } catch (e) { failed = true; ok = false; if (px) px.remove(); cv.style.opacity = ''; console.warn('Mini Heroes: Pixi renderer unavailable, using canvas', e); }
  })();
})();
