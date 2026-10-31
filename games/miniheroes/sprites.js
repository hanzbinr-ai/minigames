// Mini Heroes - pixel-art sprites generated in code (no external assets).
// Every sprite is drawn once into a small canvas and cached; the game draws them at integer zoom.
'use strict';
const SPR = (() => {
  const T = 16, cache = new Map();
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); fn((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g); return c; };
  const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // 1px dark outline around any sprite = the classic readable pixel-art look
  function outline(src, col = '#101018') {
    return mk(src.width, src.height, (p, g) => {
      const sil = mk(src.width, src.height, (q, h) => { h.drawImage(src, 0, 0); h.globalCompositeOperation = 'source-in'; h.fillStyle = col; h.fillRect(0, 0, src.width, src.height); });
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(sil, dx, dy);
      g.drawImage(src, 0, 0);
    });
  }
  const flip = src => mk(src.width, src.height, (p, g) => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
  const tint = (src, col) => mk(src.width, src.height, (p, g) => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, src.width, src.height); });

  // ---------- terrain ----------
  function speckle(p, r, base, cols, n) { p(0, 0, T, T, base); for (let i = 0; i < n; i++) p(Math.floor(r() * T), Math.floor(r() * T), 1, 1, cols[Math.floor(r() * cols.length)]); }
  const grass = v => memo('g' + v, () => mk(T, T, p => {
    const r = rng(v * 31 + 7); speckle(p, r, '#3c9c3c', ['#2d8a2d', '#58b858', '#4aaa4a'], 26);
    for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 13); p(x, y + 1, 1, 2, '#2d7a2d'); p(x + 1, y, 1, 3, '#2d7a2d'); }
    if (v === 2) { p(4, 5, 1, 1, '#fcfc54'); p(11, 11, 1, 1, '#fc7460'); p(9, 3, 1, 1, '#fcfcfc'); }
  }));
  const dirt = v => memo('d' + v, () => mk(T, T, p => {
    const r = rng(v * 17 + 3); speckle(p, r, '#b09858', ['#987c40', '#c8b070', '#a08848'], 30);
    for (let i = 0; i < 2; i++) { const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11); p(x, y, 2, 1, '#7c7c7c'); p(x, y + 1, 2, 1, '#545454'); }
  }));
  function tree(p, x, y, dark) {
    p(x + 3, y + 9, 2, 4, '#6c3c1c');
    p(x + 1, y + 6, 6, 4, dark ? '#0d5a1d' : '#167a26'); p(x + 2, y + 3, 4, 4, dark ? '#167a26' : '#20942c'); p(x + 3, y, 2, 4, '#28a838');
    p(x + 2, y + 4, 1, 1, '#58d854'); p(x + 1, y + 7, 1, 1, '#38b848');
  }
  const trees = v => memo('t' + v, () => mk(T, T, (p, g) => {
    g.drawImage(grass(v % 3), 0, 0);
    const t = mk(T, T, q => { if (v % 2) { tree(q, 0, 1, 1); tree(q, 8, 3, 0); } else { tree(q, 4, 0, 0); tree(q, 1, 3, 1); tree(q, 9, 2, 1); } });
    g.drawImage(outline(t, '#0a2a0a'), 0, 0);
  }));
  const rocks = v => memo('r' + v, () => mk(T, T, (p, g) => {
    g.drawImage(dirt(v % 3), 0, 0);
    const m = mk(T, T, q => {
      const o = v % 2 ? 0 : 2;
      for (let i = 0; i < 7; i++) q(7 - i + o, 4 + i, 2 + i * 2, 1, i < 2 ? '#fcfcfc' : i % 2 ? '#8c8c8c' : '#9c9c9c');
      q(8 + o, 7, 1, 7, '#646464'); q(10 + o, 9, 4, 5, '#6c6c6c'); q(1, 12, 5, 3, '#7c7c7c'); q(2, 11, 3, 1, '#9c9c9c');
    });
    g.drawImage(outline(m, '#202020'), 0, 0);
  }));
  const water = f => memo('w' + f, () => mk(T, T, p => {
    p(0, 0, T, T, '#2050c0');
    for (let i = 0; i < 4; i++) { const x = (i * 5 + f * 2) % T, y = (i * 4 + 2) % T; p(x, y, 4, 1, '#3c78e0'); p((x + 1) % T, y + 1, 2, 1, '#6ca0fc'); }
  }));
  // tile variants: 0 grass, 1 rough, 2 trees, 3 rocks, 4 water
  function terrainTile(t, x, y) { const v = (x * 7 + y * 13 + (x * y) % 5) % 3; return t === 0 ? grass(v) : t === 1 ? dirt(v) : t === 2 ? trees(v + ((x + y) % 2) * 3) : t === 3 ? rocks(v + (x % 2) * 3) : null; }

  // Static land layer (water left transparent) with edge transitions and shores.
  function landLayer(map) {
    const H = map.length, W = map[0].length;
    return mk(W * T, H * T, (p, g) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = terrainTile(map[y][x], x, y); if (s) g.drawImage(s, x * T, y * T); }
      const at = (x, y) => (y < 0 || x < 0 || y >= H || x >= W) ? -1 : map[y][x];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = map[y][x], X = x * T, Y = y * T;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = at(x + dx, y + dy); if (n < 0 || n === t) continue;
          const edge = (col, depth, every) => { for (let i = 0; i < T; i++) for (let d = 0; d < depth; d++) if ((i + d * 2 + x + y) % every === 0) {
            const px = dx === 1 ? X + T - 1 - d : dx === -1 ? X + d : X + i, py = dy === 1 ? Y + T - 1 - d : dy === -1 ? Y + d : Y + i; p(px, py, 1, 1, col); } };
          if (n === 4 && t !== 4) { edge('#e8d890', 2, 1); edge('#fcfcfc', 1, 3); }               // sandy shore + foam
          else if (t === 0 && n === 1) edge('#a89050', 2, 2);                                       // grass -> dirt dither
          else if (t === 1 && n === 0) edge('#4aa04a', 1, 3);
        }
      }
    });
  }
  const waterLayer = (map, f) => mk(map[0].length * T, map.length * T, (p, g) => { for (let y = 0; y < map.length; y++) for (let x = 0; x < map[0].length; x++) if (map[y][x] === 4) g.drawImage(water((f + x + y * 2) % 4), x * T, y * T); });

  // ---------- map objects ----------
  const RESC = {gold: ['#f8b800', '#fce4a0'], wood: ['#a0522d', '#d88850'], ore: ['#7c7c7c', '#bcbcbc'], gems: ['#d858f8', '#fcb8fc']};
  const pile = res => memo('pile' + res, () => outline(mk(T, T, p => {
    const [a, b] = RESC[res];
    if (res === 'wood') { for (let i = 0; i < 3; i++) { p(2 + i, 10 - i * 3, 11, 3, a); p(2 + i, 10 - i * 3, 2, 3, b); p(12 + i, 10 - i * 3, 1, 3, '#6c3c1c'); } }
    else if (res === 'gems') { p(4, 8, 4, 5, a); p(5, 7, 2, 1, b); p(9, 6, 4, 7, a); p(10, 5, 2, 1, b); p(10, 7, 1, 3, b); p(6, 11, 6, 3, '#9c38c0'); }
    else { p(3, 10, 10, 4, a); p(4, 7, 8, 3, a); p(6, 5, 4, 2, a); p(5, 8, 2, 1, b); p(8, 6, 1, 1, b); p(10, 11, 2, 1, b); }
  })));
  const chest = () => memo('chest', () => outline(mk(T, T, p => { p(2, 6, 12, 8, '#8b4513'); p(2, 6, 12, 3, '#a85c24'); p(2, 9, 12, 1, '#f8b800'); p(7, 8, 2, 3, '#f8b800'); p(2, 6, 1, 8, '#f8b800'); p(13, 6, 1, 8, '#f8b800'); })));
  const artifact = f => memo('art' + f, () => mk(T, T, p => {
    const c = ['#fcfcfc', '#fce4a0', '#f8b800'][f % 3]; p(7, 2, 2, 12, '#f8b800'); p(3, 7, 10, 2, '#f8b800'); p(6, 6, 4, 4, '#fcfcfc');
    p(7 + (f % 2 ? 4 : -4), 3 + (f % 2 ? 0 : 8), 1, 1, c); p(7 + (f % 2 ? -5 : 5), 12 - (f % 2 ? 0 : 8), 1, 1, c); p(7, 7, 2, 2, '#e40058');
  }));
  const mine = (kind, owner, f) => memo('mine' + kind + owner + f, () => mk(T + 4, T + 6, (p, g) => {
    const base = outline(mk(T + 4, T + 6, q => {
      if (kind === 'wood') { q(2, 10, 15, 9, '#8b5a2b'); for (let i = 0; i < 4; i++) q(2 + i * 4, 10, 1, 9, '#5a3a1a'); q(1, 8, 17, 3, '#6c3c1c'); q(7, 13, 5, 6, '#2a1a0a'); q(15, 4, 3, 4, '#bcbcbc'); }
      else { q(1, 9, 17, 10, '#6c6c6c'); q(3, 7, 13, 3, '#8c8c8c'); q(6, 12, 7, 7, '#1a1a1a'); q(6, 11, 7, 1, '#8b5a2b'); q(6, 11, 1, 8, '#8b5a2b'); q(12, 11, 1, 8, '#8b5a2b'); q(3, 16, 3, 3, RESC[kind][0]); q(4, 16, 1, 1, RESC[kind][1]); }
    }));
    g.drawImage(base, 0, 0);
    const fc = owner === 'player' ? '#3cbcfc' : owner === 'ai' ? '#e40058' : '#a8a8a8';
    p(15, 0, 1, 9, '#202020'); p(16, 1, 4, 3, fc); p(16 + (f % 2), 4, 3, 1, fc);
  }));

  // ---------- units (24x24, facing right). frames: 0,1 idle, 2 attack ----------
  const UNIT_LOOK = {
    Peasant: {skin: '#f0b890', body: '#9c6c3c', legs: '#5a3a1a', head: 'hat', hc: '#c8a060', weapon: 'fork'},
    Archer: {skin: '#f0b890', body: '#3c8c3c', legs: '#5a3a1a', head: 'hood', hc: '#2a6a2a', weapon: 'bow'},
    Swordsman: {skin: '#f0b890', body: '#b8b8c8', legs: '#7c7c8c', head: 'helm', hc: '#d8d8e8', weapon: 'sword', shield: '#3cbcfc'},
    Monk: {skin: '#d89c6c', body: '#f0e0b0', legs: '#f0e0b0', head: 'bald', hc: '#d89c6c', weapon: 'staff', robe: 1, orb: '#fcfc54'},
    Cavalier: {skin: '#f0b890', body: '#d8d8e8', legs: '#b8b8c8', head: 'plume', hc: '#d8d8e8', weapon: 'lance', mount: '#e8e0d0', mane: '#8c6c4c', cape: '#3cbcfc'},
    Skeleton: {skin: '#e8e8d0', body: 'ribs', legs: '#e8e8d0', head: 'skull', hc: '#e8e8d0', weapon: 'sword', shield: '#7c5c3c'},
    Zombie: {skin: '#8cb060', body: '#5a4a6a', legs: '#4a3a5a', head: 'zombie', hc: '#8cb060', weapon: 'claw'},
    Wight: {skin: '#c8c8fc', body: '#5050a0', legs: null, head: 'hood', hc: '#3c3c80', weapon: 'claw', robe: 1, ghost: 1},
    Lich: {skin: '#e8e8d0', body: '#6c2c8c', legs: '#6c2c8c', head: 'crown', hc: '#f8b800', weapon: 'staff', robe: 1, orb: '#58f898'},
    BlackKnight: {skin: '#e8e8d0', body: '#3c3c4c', legs: '#2c2c3c', head: 'helm', hc: '#4c4c5c', weapon: 'lance', mount: '#2a2a2a', mane: '#e40058', cape: '#a00030', eye: '#e40058'},
    Goblin: {skin: '#80c020', body: '#8b5a2b', legs: '#5a3a1a', head: 'goblin', hc: '#80c020', weapon: 'club', small: 1},
    Troll: {skin: '#7c9c7c', body: '#5c7c5c', legs: '#4c6c4c', head: 'troll', hc: '#7c9c7c', weapon: 'club', big: 1},
    Wolf: {quad: 1, body: '#8c8c9c', dark: '#5c5c6c'},
  };
  function wolf(p, f) {
    const b = f === 1 ? 1 : 0, a = f === 2 ? 2 : 0;
    p(4 + a, 11 + b, 13, 6, '#8c8c9c'); p(4 + a, 16 + b, 13, 1, '#6c6c7c'); p(0 + a, 9 + b, 5, 3, '#8c8c9c'); p(0 + a, 8 + b, 2, 1, '#8c8c9c');
    p(15 + a, 8 + b, 6, 6, '#9c9cac'); p(20 + a, 11 + b, 3, 2, '#9c9cac'); p(16 + a, 6 + b, 2, 3, '#8c8c9c'); p(19 + a, 9 + b, 1, 1, '#e40058'); p(21 + a, 13 + b, 2, 1, '#fcfcfc');
    const s = f === 1 ? 1 : 0; p(5, 17 + b, 2, 6 - b, '#6c6c7c'); p(8 + s, 17 + b, 2, 6 - b, '#7c7c8c'); p(13, 17 + b, 2, 6 - b, '#6c6c7c'); p(16 - s + a, 17 + b, 2, 6 - b, '#7c7c8c');
  }
  function horse(p, L, f) {
    const s = f === 1 ? 1 : 0, c = L.mount, d = shade(c);
    p(3, 12, 15, 6, c); p(3, 17, 15, 1, d); p(16, 6, 4, 7, c); p(18, 5, 5, 4, c); p(21, 8, 2, 2, d); p(19, 6, 1, 1, L.eye || '#101018');
    p(15, 5, 2, 7, L.mane); p(1, 12, 3, 6, L.mane);
    p(4 + s, 18, 2, 6, d); p(7, 18, 2, 6, c); p(13 - s, 18, 2, 6, d); p(16 + (f === 2 ? 2 : 0), 18 - (f === 2 ? 2 : 0), 2, 6, c);
  }
  function shade(hex) { const n = parseInt(hex.slice(1), 16), k = 0.7; return '#' + [16, 8, 0].map(s => Math.floor(((n >> s) & 255) * k).toString(16).padStart(2, '0')).join(''); }
  function humanoid(p, L, f) {
    const b = f === 1 ? 1 : 0, atk = f === 2, sc = L.big ? 1 : 0, ox = L.small ? 1 : 0;
    let oy = L.mount ? -7 : 0; oy += b + (L.small ? 3 : 0) - sc * 2;
    if (L.mount) horse(p, L, f);
    if (L.cape) p(6, 9 + oy, 3, 8, L.cape);
    // legs
    if (!L.mount && L.legs) { const s = f === 1 ? 1 : 0; p(9 + ox - sc, 17 + oy, 2 + sc, 6 - b + sc, L.legs); p(13 - ox, 17 + oy, 2 + sc, 6 - b + sc, L.legs); p(8 + ox - sc, 22 - (L.small ? 0 : 0), 3 + sc, 1, '#3a2a1a'); p(13 - ox, 22, 3 + sc, 1, '#3a2a1a'); }
    if (L.ghost) { p(8, 17 + oy, 8, 3, L.body); p(9 + (f % 2), 20 + oy, 2, 2, L.body); p(13 - (f % 2), 20 + oy, 2, 2, L.body); }
    // torso
    const tw = 8 + sc * 2 - ox * 2, tx = 8 - sc + ox;
    if (L.body === 'ribs') { p(tx + 2, 10 + oy, tw - 4, 7, '#e8e8d0'); for (let i = 0; i < 3; i++) p(tx + 2, 11 + oy + i * 2, tw - 4, 1, '#7c7c6c'); p(tx + 3, 10 + oy, 1, 7, '#e8e8d0'); }
    else { p(tx, 10 + oy, tw, 7, L.body); p(tx, 10 + oy, 1, 7, shade(L.body)); if (L.robe) p(tx - 1, 15 + oy, tw + 2, L.mount ? 3 : 7, L.body); p(tx, 15 + oy, tw, 1, shade(L.body)); }
    // head
    const hx = 9 - sc + ox, hy = 3 + oy - sc;
    p(hx, hy + 1, 6 + sc, 6 + sc, L.skin); p(hx + 4 + sc, hy + 3, 1, 1, L.eye || '#101018'); p(hx + 4 + sc, hy + 5 + sc, 2, 1, shade(L.skin));
    if (L.head === 'hat') { p(hx - 1, hy, 8, 2, L.hc); p(hx + 1, hy - 1, 4, 1, L.hc); }
    if (L.head === 'hood') { p(hx - 1, hy, 7, 3, L.hc); p(hx - 1, hy, 2, 7, L.hc); }
    if (L.head === 'helm' || L.head === 'plume') { p(hx - 1, hy, 8, 3, L.hc); p(hx + 3, hy + 3, 4, 1, '#101018'); p(hx - 1, hy + 3, 2, 3, L.hc); if (L.head === 'plume') p(hx + 1, hy - 3, 2, 3, '#e40058'); }
    if (L.head === 'bald') p(hx + 1, hy + 1, 3, 1, shade(L.skin));
    if (L.head === 'skull') { p(hx + 3, hy + 3, 2, 2, '#101018'); p(hx + 1, hy + 6, 4, 1, '#7c7c6c'); }
    if (L.head === 'crown') { p(hx + 3, hy + 3, 2, 2, '#58f898'); p(hx, hy - 1, 6, 2, L.hc); p(hx, hy - 2, 1, 1, L.hc); p(hx + 3, hy - 2, 1, 1, L.hc); p(hx + 5, hy - 2, 1, 1, L.hc); }
    if (L.head === 'zombie') { p(hx + 1, hy + 1, 2, 2, '#5a7c3c'); p(hx + 4, hy + 3, 1, 1, '#fcfc54'); }
    if (L.head === 'goblin') { p(hx - 2, hy + 2, 2, 2, L.skin); p(hx + 6, hy + 2, 2, 2, L.skin); p(hx + 4, hy + 3, 1, 1, '#fc3c3c'); }
    if (L.head === 'troll') { p(hx + 1, hy, 5, 1, '#5c7c5c'); p(hx + 5, hy + 6, 1, 2, '#fcfcfc'); }
    // arm + weapon (front side = right)
    const ax = tx + tw, ay = 11 + oy, reach = atk ? 3 : 0;
    p(ax - 1 + reach, ay, 2, 4, L.skin === '#e8e8d0' ? '#e8e8d0' : L.body === 'ribs' ? '#e8e8d0' : L.body);
    p(ax + reach, ay + 3, 2, 2, L.skin);
    const w = L.weapon, wx = ax + reach + 1, wy = ay + 3;
    if (w === 'sword') { p(wx, wy - 7, 1, 7, '#e8e8f8'); p(wx + 1, wy - 7, 1, 6, '#a8a8b8'); p(wx - 1, wy - 1, 4, 1, '#f8b800'); }
    if (w === 'fork') { p(wx, wy - 9, 1, 13, '#8b5a2b'); p(wx - 1, wy - 11, 1, 3, '#bcbcbc'); p(wx + 1, wy - 11, 1, 3, '#bcbcbc'); p(wx, wy - 11, 1, 2, '#bcbcbc'); }
    if (w === 'bow') { p(wx + 1, wy - 6, 1, 2, '#8b5a2b'); p(wx + 2, wy - 4, 1, 8, '#8b5a2b'); p(wx + 1, wy + 4, 1, 2, '#8b5a2b'); p(wx + (atk ? 0 : 1), wy - 5, 1, 10, '#fcfcfc'); }
    if (w === 'staff') { p(wx, wy - 10, 1, 15, '#8b5a2b'); p(wx - 1, wy - 12, 3, 3, L.orb); p(wx, wy - 12, 1, 1, '#fcfcfc'); }
    if (w === 'lance') { p(wx - 4, wy - 1, 10 + reach, 1, '#c8c8d8'); p(wx + 6 + reach, wy - 2, 2, 3, '#fcfcfc'); p(wx - 3, wy - 2, 2, 3, '#f8b800'); }
    if (w === 'club') { p(wx, wy - 6, 2, 8, '#8b5a2b'); p(wx - 1, wy - 9, 4, 4, '#6c3c1c'); }
    if (w === 'claw') { p(wx, wy - 1, 3, 1, L.skin); p(wx + 2, wy - 2, 1, 1, '#fcfcfc'); p(wx + 2, wy, 1, 1, '#fcfcfc'); }
    if (L.shield) { p(tx - 2, 11 + oy, 4, 6, L.shield); p(tx - 1, 12 + oy, 2, 4, shade(L.shield)); }
  }
  const unit = (type, f, left) => memo('u' + type + f + (left ? 'L' : ''), () => {
    if (left) return flip(unit(type, f, false));
    const L = UNIT_LOOK[type] || UNIT_LOOK.Peasant;
    return outline(mk(24, 24, p => L.quad ? wolf(p, f) : humanoid(p, L, f)));
  });
  const unitFlash = (type, f, left) => memo('uf' + type + f + (left ? 'L' : ''), () => tint(unit(type, f, left), '#fcfcfc'));

  // ---------- hero on horseback (map, 16x16 + overflow) ----------
  const hero = (owner, f, left) => memo('h' + owner + f + (left ? 'L' : ''), () => {
    if (left) return flip(hero(owner, f, false));
    const c = owner === 'player' ? '#3cbcfc' : '#e40058';
    return outline(mk(20, 20, p => {
      const s = f % 2;
      p(3, 10, 11, 5, '#8b5a2b'); p(12, 6, 3, 6, '#8b5a2b'); p(13, 5, 5, 3, '#8b5a2b'); p(16, 7, 2, 1, '#5a3a1a'); p(11, 5, 2, 5, '#3a2a1a'); p(1, 10, 3, 5, '#3a2a1a');
      p(4 + s * 2, 15, 2, 5, '#5a3a1a'); p(7, 15, 2, 5 - s, '#6c4c2c'); p(10 - s * 2, 15, 2, 5, '#5a3a1a'); p(12, 15 - s, 2, 5, '#6c4c2c');
      p(6, 4, 5, 7, c); p(6, 10, 5, 2, shade(c)); p(7, 0, 4, 4, '#f0b890'); p(7, 0, 4, 1, '#f8b800'); p(9, 2, 1, 1, '#101018');
      p(4, 4, 2, 8, shade(c)); p(11, 0, 1, 11, '#5a3a1a'); p(12, 0, 4, 3, c); p(12, 3, 2, 1, c);
    }));
  });

  // ---------- town (32x28) ----------
  const town = (faction, owner, f) => memo('town' + faction + owner + f, () => {
    const necro = faction === 'necro', wall = necro ? '#6c6c7c' : '#c8c8c8', roof = necro ? '#4c2c5c' : '#c84c0c', fc = owner === 'player' ? '#3cbcfc' : owner === 'ai' ? '#e40058' : '#a8a8a8';
    return mk(36, 34, (p, g) => {
      const b = outline(mk(36, 34, q => {
        q(2, 18, 32, 14, wall); for (let i = 0; i < 6; i++) q(2 + i * 6, 15, 4, 3, wall);
        q(3, 22, 30, 1, shade(wall)); q(14, 23, 8, 9, '#3a2a1a'); q(15, 22, 6, 1, '#3a2a1a');
        q(11, 8, 14, 12, wall); q(10, 5, 16, 3, roof); q(12, 3, 12, 2, roof); q(15, 1, 6, 2, roof);
        q(14, 11, 2, 3, '#202040'); q(20, 11, 2, 3, '#202040');
        q(0, 10, 6, 22, wall); q(0, 7, 6, 3, roof); q(30, 10, 6, 22, wall); q(30, 7, 6, 3, roof);
        q(2, 14, 2, 3, '#202040'); q(32, 14, 2, 3, '#202040');
        if (necro) { q(16, 16, 4, 3, '#e8e8d0'); q(17, 17, 1, 1, '#101018'); q(19, 17, 1, 1, '#101018'); }
      }));
      g.drawImage(b, 0, 4);
      p(17, 0, 1, 6, '#202020'); p(18, 0, 6, 3, fc); p(18 + (f % 2) * 2, 3, 4, 1, fc); p(24 - (f % 2), 1, 1, 1, fc);
    });
  });

  // ---------- portrait (32x32) from a name ----------
  const portrait = (name, owner) => memo('pt' + name, () => {
    const r = rng([...name].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const skin = ['#f0b890', '#d89c6c', '#a86c3c', '#f8d8b8'][Math.floor(r() * 4)], hair = ['#3a2a1a', '#f8b800', '#8b4513', '#e8e8e8', '#202020'][Math.floor(r() * 5)];
    const c = owner === 'player' ? '#3cbcfc' : '#e40058';
    return mk(32, 32, p => {
      p(0, 0, 32, 32, '#2c2c5c'); for (let i = 0; i < 8; i++) p(i * 4, 0, 2, 32, '#34346c');
      p(4, 24, 24, 8, c); p(4, 24, 24, 2, shade(c)); p(12, 22, 8, 4, skin);
      p(9, 6, 14, 17, skin); p(9, 4, 14, 5, hair); p(7, 6, 3, 12, hair); p(22, 6, 3, 10, hair);
      p(12, 12, 3, 2, '#fcfcfc'); p(18, 12, 3, 2, '#fcfcfc'); p(13, 12, 2, 2, '#202040'); p(19, 12, 2, 2, '#202040');
      p(11, 10, 4, 1, hair); p(18, 10, 4, 1, hair); p(15, 14, 2, 4, shade(skin)); p(13, 19, 6, 1, '#a04040');
      if (r() < 0.5) { p(11, 18, 10, 4, hair); p(13, 19, 6, 1, '#a04040'); }
      if (r() < 0.4) { p(8, 2, 16, 4, '#d8d8e8'); p(15, 0, 2, 3, '#e40058'); }
    });
  });

  // ---------- battlefield background ----------
  const field = (w, h, cell, seed) => memo('field' + seed, () => mk(w, h, p => {
    const r = rng(seed); p(0, 0, w, h, '#3c8c34');
    for (let i = 0; i < w * h / 12; i++) p(Math.floor(r() * w), Math.floor(r() * h), 1, 1, ['#348028', '#4c9c3c', '#2c7020'][Math.floor(r() * 3)]);
    for (let i = 0; i < 18; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); p(x, y, 1, 2, '#58b848'); p(x + 1, y - 1, 1, 3, '#58b848'); }
  }));
  const boulder = () => memo('boulder', () => outline(mk(24, 24, p => { p(3, 10, 18, 12, '#7c7c7c'); p(6, 6, 12, 6, '#9c9c9c'); p(8, 7, 4, 2, '#c8c8c8'); p(3, 19, 18, 3, '#5c5c5c'); p(15, 12, 3, 6, '#6c6c6c'); })));


  // ---------- siege: wall segments (state 0 intact, 1 cracked, 2 rubble), gate, tower, catapult ----------
  const wall = (kind, state, necro) => memo('wall' + kind + state + necro, () => {
    const st = necro ? '#7c7c8c' : '#b8b0a0', dk = necro ? '#4c4c5c' : '#7c7468', lt = necro ? '#9c9cac' : '#d8d0c0';
    if (state === 2) return outline(mk(24, 24, p => { p(2, 16, 8, 6, st); p(9, 18, 7, 4, dk); p(14, 14, 8, 8, st); p(5, 13, 5, 4, lt); p(16, 12, 3, 3, lt); p(11, 15, 3, 3, dk); }));
    return outline(mk(24, 24, p => {
      if (kind === 'gate') {
        p(1, 2, 22, 22, st); p(1, 2, 22, 2, lt); for (let i = 0; i < 4; i++) p(1 + i * 6, 0, 4, 3, st);
        p(5, 7, 14, 17, state ? '#5a3a1a' : '#8b5a2b'); p(5, 7, 14, 1, '#3a2a1a'); for (let i = 0; i < 3; i++) p(6 + i * 5, 8, 1, 16, '#5a3a1a');
        p(5, 12, 14, 1, '#4c4c4c'); p(5, 19, 14, 1, '#4c4c4c'); if (state) { p(9, 9, 2, 6, '#1a1a1a'); p(12, 14, 3, 5, '#1a1a1a'); }
        return;
      }
      p(3, 3, 18, 21, st); for (let i = 0; i < 3; i++) p(3 + i * 7, 0, 4, 4, st);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) p(3 + x * 6 + (y % 2) * 3, 5 + y * 4, 5, 1, dk);
      p(3, 3, 18, 1, lt);
      if (state) { p(8, 6, 1, 4, '#1a1a1a'); p(9, 9, 1, 4, '#1a1a1a'); p(10, 12, 2, 1, '#1a1a1a'); p(15, 14, 1, 5, '#1a1a1a'); p(14, 18, 1, 3, '#1a1a1a'); }
    }));
  });
  const tower = (necro, f) => memo('tower' + necro + f, () => {
    const st = necro ? '#7c7c8c' : '#b8b0a0', dk = necro ? '#4c4c5c' : '#7c7468', rf = necro ? '#4c2c5c' : '#c84c0c';
    return outline(mk(24, 36, p => {
      p(3, 12, 18, 24, st); for (let y = 0; y < 6; y++) p(3 + (y % 2) * 4, 15 + y * 4, 14, 1, dk);
      p(1, 8, 22, 5, st); for (let i = 0; i < 4; i++) p(1 + i * 6, 5, 4, 3, st);
      p(10, 16, 4, 6, '#101018'); if (f) { p(11, 17, 2, 3, '#f8b800'); }
      p(4, 0, 16, 6, rf); p(8, -1, 8, 2, rf);
    }));
  });
  const catapult = f => memo('cata' + f, () => outline(mk(24, 24, p => {
    p(2, 16, 20, 3, '#8b5a2b'); p(3, 19, 4, 4, '#5a3a1a'); p(17, 19, 4, 4, '#5a3a1a'); p(4, 20, 2, 2, '#bcbcbc'); p(18, 20, 2, 2, '#bcbcbc');
    p(10, 9, 3, 8, '#6c3c1c');
    if (f) { for (let i = 0; i < 9; i++) p(11 + Math.round(i * 0.3), 9 - i, 2, 1, '#a0522d'); p(13, 0, 4, 3, '#5a3a1a'); }
    else { for (let i = 0; i < 10; i++) p(11 - i, 10 + Math.round(i * 0.5), 2, 1, '#a0522d'); p(0, 14, 4, 3, '#5a3a1a'); p(1, 12, 3, 3, '#8c8c8c'); }
  })));

  // ---------- town screen view: skyline showing what has been built ----------
  function townView(cv, t) {
    const w = 240, h = 96; cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const p = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    const necro = t.faction === 'necro';
    for (let y = 0; y < 64; y++) p(0, y, w, 1, necro ? `rgb(${40 + y},${20 + y / 2},${60 + y})` : `rgb(${60 + y},${120 + y},${220 - y})`);
    p(190, 10, 14, 14, necro ? '#e8e8d0' : '#fcfc54');
    p(0, 60, w, 36, necro ? '#3c4c3c' : '#3c9c3c'); for (let i = 0; i < 60; i++) p((i * 37) % w, 62 + (i * 13) % 34, 2, 1, necro ? '#2c3c2c' : '#58b858');
    const wall = necro ? '#6c6c7c' : '#c8c8c8', roof = necro ? '#4c2c5c' : '#c84c0c', B = k => t.built.includes(k);
    const bld = (x, bw, bh, rf, extra) => { const y = 66 - bh; p(x, y, bw, bh, wall); p(x - 1, y - 4, bw + 2, 4, rf); p(x + 1, y - 7, bw - 2, 3, rf); p(x + bw / 2 - 2, 66 - 8, 4, 8, '#3a2a1a'); if (extra) extra(x, y); };
    if (B('fort')) { p(4, 52, 232, 14, wall); for (let i = 0; i < 29; i++) p(4 + i * 8, 48, 5, 4, wall); }
    bld(104, 32, 34, roof, (x, y) => { p(x + 6, y + 8, 4, 6, '#202040'); p(x + 22, y + 8, 4, 6, '#202040'); });
    if (B('hall')) bld(140, 26, 26, '#f8b800');
    if (B('tavern')) bld(176, 22, 16, '#8b4513', (x, y) => p(x + 22, y + 4, 6, 4, '#f8b800'));
    if (B('market')) bld(204, 26, 12, '#e40058');
    if (B('guild1')) bld(70, 16, 30, '#3c3cbc', (x, y) => { if (B('guild2')) { p(x + 2, y - 20, 12, 12, wall); p(x + 1, y - 24, 14, 4, '#d858f8'); } p(x + 6, y + 6, 4, 4, '#58f8f8'); });
    if (B('citadel')) { p(40, 22, 14, 44, wall); p(38, 18, 18, 4, roof); }
    ['dw1', 'dw2', 'dw3', 'dw4', 'dw5'].forEach((k, i) => { if (!B(k)) return; const x = 8 + i * 22 + (i > 1 ? 38 : 0) + (i > 2 ? 60 : 0); if (i < 2 || i > 2) bld(i < 2 ? 8 + i * 22 : 140 + (i - 3) * 50 + 32, 16, 12 + i * 3, shade(roof)); else bld(56, 12, 18, shade(roof)); });
    const u = FACTIONS[t.faction].units;
    u.forEach((name, i) => { if (B('dw' + (i + 1))) g.drawImage(unit(name, 0, false), 10 + i * 46, 70); });
  }

  return {wall, tower, catapult, flip, T, landLayer, waterLayer, pile, chest, artifact, mine, unit, unitFlash, hero, town, portrait, field, boulder, townView};
})();
