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
    if (res === 'gold') { // stacked coins + one loose coin
      for (let i = 0; i < 4; i++) { p(2, 11 - i * 2, 8, 2, i % 2 ? '#d89000' : a); p(3, 11 - i * 2, 2, 1, b); }
      p(2, 3, 8, 2, a); p(4, 3, 4, 1, '#fffbe0'); p(10, 9, 5, 5, a); p(11, 10, 3, 3, '#d89000'); p(12, 11, 1, 1, '#fffbe0');
    } else if (res === 'wood') { // two logs with ring ends
      for (const [y, x] of [[9, 1], [4, 3]]) { p(x, y, 10, 5, '#8b4a20'); p(x, y, 10, 1, '#c07038'); p(x + 9, y, 4, 5, '#e8b878'); p(x + 10, y + 1, 2, 3, '#c08040'); p(x + 11, y + 2, 1, 1, '#6c3c1c'); }
    } else if (res === 'ore') { // grey stone blocks with facets
      p(1, 8, 7, 6, '#8c8c8c'); p(1, 8, 7, 2, '#c8c8c8'); p(6, 9, 2, 5, '#5c5c5c');
      p(8, 6, 7, 8, '#9c9c9c'); p(8, 6, 7, 2, '#e0e0e0'); p(13, 7, 2, 7, '#6c6c6c'); p(4, 3, 6, 5, '#7c7c7c'); p(4, 3, 6, 1, '#bcbcbc'); p(9, 4, 1, 4, '#5c5c5c');
    } else { // cut gems
      const gem = (x, y, c, h) => { p(x + 2, y, 3, 1, h); p(x + 1, y + 1, 5, 2, c); p(x + 2, y + 1, 1, 1, '#fff'); p(x + 2, y + 3, 3, 1, c); p(x + 3, y + 4, 1, 1, c); };
      gem(1, 7, a, b); gem(8, 6, '#3cbcfc', '#a8e4fc'); gem(5, 2, '#e40058', '#fc9cb8'); gem(9, 11, '#58d854', '#b8f8b8');
    }
  })));
  const chest = () => memo('chest', () => outline(mk(T, T, p => { p(2, 6, 12, 8, '#8b4513'); p(2, 6, 12, 3, '#a85c24'); p(2, 9, 12, 1, '#f8b800'); p(7, 8, 2, 3, '#f8b800'); p(2, 6, 1, 8, '#f8b800'); p(13, 6, 1, 8, '#f8b800'); })));
  const artifact = f => memo('art' + f, () => mk(T, T, p => {
    const c = ['#fcfcfc', '#fce4a0', '#f8b800'][f % 3]; p(7, 2, 2, 12, '#f8b800'); p(3, 7, 10, 2, '#f8b800'); p(6, 6, 4, 4, '#fcfcfc');
    p(7 + (f % 2 ? 4 : -4), 3 + (f % 2 ? 0 : 8), 1, 1, c); p(7 + (f % 2 ? -5 : 5), 12 - (f % 2 ? 0 : 8), 1, 1, c); p(7, 7, 2, 2, '#e40058');
  }));
  const mine = (kind, owner, f) => memo('mine' + kind + owner + f, () => mk(T + 8, T + 10, (p, g) => {
    g.imageSmoothingEnabled = false;
    const base = outline(mk(T + 8, T + 10, q => {
      if (kind === 'wood') { // sawmill: plank hut + saw blade
        q(3, 12, 16, 12, '#8b5a2b'); for (let i = 0; i < 4; i++) q(3 + i * 4, 12, 1, 12, '#5a3a1a'); q(1, 9, 20, 4, '#6c3c1c'); q(8, 17, 5, 7, '#2a1a0a');
        const sx = 19, sy = 18; q(sx - 3, sy - 3, 7, 7, '#d0d0d0'); q(sx - 1, sy - 1, 3, 3, '#5c5c5c'); for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) q(sx + dx, sy + dy, 1, 1, '#ffffff');
      } else { // mine entrance in a rock with a cart full of its resource
        q(1, 10, 20, 14, '#6c6c6c'); q(3, 7, 15, 4, '#8c8c8c'); q(7, 14, 8, 10, '#141414'); q(7, 13, 8, 1, '#8b5a2b'); q(7, 13, 1, 11, '#8b5a2b'); q(14, 13, 1, 11, '#8b5a2b');
        q(15, 20, 8, 4, '#5a3a1a'); q(16, 23, 2, 2, '#303030'); q(21, 23, 2, 2, '#303030'); q(15, 18, 8, 2, RESC[kind][0]); q(17, 17, 2, 1, RESC[kind][1]);
      }
    }));
    g.drawImage(base, 0, 0);
    // signboard with the produced resource
    p(0, 0, 13, 12, '#000'); p(1, 1, 11, 10, '#e8d8b0'); p(6, 12, 1, 3, '#5a3a1a'); g.drawImage(pile(kind), 0, 0, T, T, 1, 0, 11, 11);
    const fc = owner === 'player' ? '#3cbcfc' : owner === 'ai' ? '#e40058' : '#a8a8a8';
    p(17, 0, 1, 10, '#202020'); p(18, 1, 5, 3, fc); p(18 + (f % 2), 4, 4, 1, fc);
  }));

  // ---------- units (24x24, facing right). frames: 0,1 idle, 2 attack ----------
  // Looks: humanoid params (skin/body/legs/head/hc/weapon/shield/robe/orb/mount/cape/wings/flame/small/big/ghost), or kind: beast | flyer | dragon | tank | tree.
  const H = (o) => o;
  const UNIT_LOOK = {
    Peasant: {skin: '#f0b890', body: '#9c6c3c', legs: '#5a3a1a', head: 'hat', hc: '#c8a060', weapon: 'fork'},
    Militia: {skin: '#f0b890', body: '#7c5c3c', legs: '#4a3a2a', head: 'helm', hc: '#8c7c6c', weapon: 'pike', shield: '#8b5a2b'},
    Pikeman: {skin: '#f0b890', body: '#8ca8d8', legs: '#5c6c8c', head: 'helm', hc: '#c8c8d8', weapon: 'pike'},
    Halberdier: {skin: '#f0b890', body: '#3c6cc8', legs: '#2c3c6c', head: 'plume', hc: '#e0e0f0', weapon: 'axe', trim: '#f8b800'},
    Crossbowman: {skin: '#f0b890', body: '#3c8c3c', legs: '#5a3a1a', head: 'hood', hc: '#2a6a2a', weapon: 'xbow'},
    Arbalester: {skin: '#f0b890', body: '#2c6cac', legs: '#3a2a1a', head: 'helm', hc: '#c8c8d8', weapon: 'xbow', trim: '#f8b800'},
    Griffin: {kind: 'flyer', col: '#d8a848', wing: '#b88838', head: 'eagle', hc: '#fcfcfc', beak: '#f8b800', quad: 1},
    'Royal Griffin': {kind: 'flyer', col: '#f0c860', wing: '#fcfcfc', head: 'eagle', hc: '#fcfcfc', beak: '#f8b800', quad: 1, crown: 1},
    Swordsman: {skin: '#f0b890', body: '#b8b8c8', legs: '#7c7c8c', head: 'helm', hc: '#d8d8e8', weapon: 'sword', shield: '#3cbcfc'},
    Crusader: {skin: '#f0b890', body: '#fcfcfc', legs: '#9c9cac', head: 'helm', hc: '#e8e8f8', weapon: 'sword', shield: '#e40058', trim: '#e40058', cape: '#e40058'},
    Monk: {skin: '#d89c6c', body: '#f0e0b0', legs: '#f0e0b0', head: 'bald', hc: '#d89c6c', weapon: 'staff', robe: 1, orb: '#fcfc54'},
    Zealot: {skin: '#d89c6c', body: '#f8b800', legs: '#f8b800', head: 'hood', hc: '#fcfcfc', weapon: 'staff', robe: 1, orb: '#fcfcfc', aura: '#fcfc54'},
    Paladin: {skin: '#f0b890', body: '#d8d8e8', legs: '#b8b8c8', head: 'plume', hc: '#d8d8e8', weapon: 'lance', mount: '#e8e0d0', mane: '#8c6c4c', cape: '#3cbcfc'},
    Champion: {skin: '#f0b890', body: '#f8d048', legs: '#d8b038', head: 'plume', hc: '#f8d048', weapon: 'lance', mount: '#fcfcfc', mane: '#f8b800', cape: '#e40058', aura: '#fcfc54'},
    Skeleton: {skin: '#e8e8d0', body: 'ribs', legs: '#e8e8d0', head: 'skull', hc: '#e8e8d0', weapon: 'sword', shield: '#7c5c3c'},
    'Skeleton Warrior': {skin: '#e8e8d0', body: 'ribs', legs: '#e8e8d0', head: 'helm', hc: '#5c5c6c', weapon: 'axe', shield: '#4c4c5c'},
    Zombie: {skin: '#8cb060', body: '#5a4a6a', legs: '#4a3a5a', head: 'zombie', hc: '#8cb060', weapon: 'claw'},
    'Plague Zombie': {skin: '#a0b040', body: '#4a5a2a', legs: '#3a4a2a', head: 'zombie', hc: '#a0b040', weapon: 'claw', aura: '#80d010'},
    Ghost: {skin: '#c8c8fc', body: '#8888d0', legs: null, head: 'hood', hc: '#6c6cb0', weapon: 'claw', robe: 1, ghost: 1},
    Spectre: {skin: '#a8fcd8', body: '#3c8c8c', legs: null, head: 'hood', hc: '#2c6c6c', weapon: 'scythe', robe: 1, ghost: 1, aura: '#58f8b8'},
    Vampire: {skin: '#e8d8d8', body: '#202028', legs: '#202028', head: 'vamp', hc: '#101018', weapon: 'claw', cape: '#a00030', eye: '#e40058'},
    'Vampire Lord': {skin: '#f0e0e8', body: '#3c0c1c', legs: '#202028', head: 'crown', hc: '#f8b800', weapon: 'sword', cape: '#e40058', eye: '#e40058', wings: '#3c0c1c'},
    Lich: {skin: '#e8e8d0', body: '#6c2c8c', legs: '#6c2c8c', head: 'crown', hc: '#f8b800', weapon: 'staff', robe: 1, orb: '#58f898'},
    Archlich: {skin: '#e8e8d0', body: '#2c0c4c', legs: '#2c0c4c', head: 'crown', hc: '#e40058', weapon: 'staff', robe: 1, orb: '#e40058', aura: '#d858f8'},
    'Wraith Knight': {skin: '#e8e8d0', body: '#3c3c4c', legs: '#2c2c3c', head: 'helm', hc: '#4c4c5c', weapon: 'lance', mount: '#2a2a2a', mane: '#e40058', cape: '#a00030', eye: '#e40058'},
    'Dread Knight': {skin: '#e8e8d0', body: '#1c1c2c', legs: '#101018', head: 'horns', hc: '#2c2c3c', weapon: 'sword', mount: '#3c1c3c', mane: '#58f898', cape: '#4c2c5c', eye: '#58f898'},
    'Bone Dragon': {kind: 'dragon', col: '#d8d8c0', dark: '#8c8c7c', wing: '#a8a898', bones: 1, eye: '#e40058'},
    'Ghost Dragon': {kind: 'dragon', col: '#a8c8e8', dark: '#6c88a8', wing: '#c8e0fc', bones: 1, eye: '#58f8f8', ghostly: 1},
    Sprite: {skin: '#f8d8b8', body: '#58d854', legs: '#38b848', head: 'elf', hc: '#f8b800', weapon: 'dart', small: 1, wings: '#c8fcfc'},
    Faerie: {skin: '#f8d8b8', body: '#d858f8', legs: '#a838c8', head: 'elf', hc: '#fcfcfc', weapon: 'dart', small: 1, wings: '#fcd8fc', aura: '#fcfcfc'},
    'Wolf Rider': {kind: 'beast', head: 'wolf', col: '#8c8c9c', dark: '#5c5c6c', rider: {skin: '#f8d8b8', body: '#38b848', hc: '#f8b800', head: 'elf', weapon: 'sword'}},
    'Moon Rider': {kind: 'beast', head: 'wolf', col: '#d8d8f0', dark: '#9c9cc0', rider: {skin: '#f8d8b8', body: '#3c3c9c', hc: '#fcfcfc', head: 'elf', weapon: 'pike'}},
    'Elf Archer': {skin: '#f8d8b8', body: '#38b848', legs: '#2a6a2a', head: 'elf', hc: '#f8b800', weapon: 'bow'},
    'Grand Elf': {skin: '#f8d8b8', body: '#20844c', legs: '#1a4a2a', head: 'elf', hc: '#fcfcfc', weapon: 'bow', cape: '#58d854', trim: '#f8b800'},
    Druid: {skin: '#d89c6c', body: '#8c6c3c', legs: '#8c6c3c', head: 'hood', hc: '#5c8c3c', weapon: 'staff', robe: 1, orb: '#58d854'},
    'Elder Druid': {skin: '#d89c6c', body: '#5c4c2c', legs: '#5c4c2c', head: 'antler', hc: '#e8d8b0', weapon: 'staff', robe: 1, orb: '#58f8f8', aura: '#58d854'},
    Unicorn: {kind: 'beast', head: 'horse', col: '#f0f0ff', dark: '#b8b8d8', mane: '#f8b8f8', horn: '#f8b800'},
    'Silver Unicorn': {kind: 'beast', head: 'horse', col: '#c8d0e0', dark: '#8890a8', mane: '#58f8f8', horn: '#fcfcfc', aura: '#fcfcfc'},
    Treant: {kind: 'tree', col: '#6c4c2c', leaf: '#3c8c2c'},
    'Ancient Treant': {kind: 'tree', col: '#4c3c2c', leaf: '#8cac3c', flower: '#f8b8f8'},
    'Green Dragon': {kind: 'dragon', col: '#20a040', dark: '#106020', wing: '#58d854', belly: '#c8e878', eye: '#f8b800'},
    'Emerald Dragon': {kind: 'dragon', col: '#10c088', dark: '#08805c', wing: '#58f8b8', belly: '#e0fcd0', eye: '#fcfcfc', crown: 1},
    Imp: {skin: '#e05030', body: '#c04020', legs: '#a03018', head: 'horns', hc: '#3a2a1a', weapon: 'fork', small: 1, eye: '#fcfc54'},
    Familiar: {skin: '#f07040', body: '#802010', legs: '#601808', head: 'horns', hc: '#f8b800', weapon: 'claw', small: 1, eye: '#fcfc54', wings: '#802010'},
    'Hell Hound': {kind: 'beast', head: 'hound', col: '#a03018', dark: '#601808', mane: '#fc9838'},
    Cerberus: {kind: 'beast', head: 'hound', col: '#702010', dark: '#401008', mane: '#fcfc54', heads: 3},
    Succubus: {skin: '#fc9cb8', body: '#a01848', legs: '#fc9cb8', head: 'horns', hc: '#202020', weapon: 'orbhand', orb: '#fc74b4', wings: '#601030'},
    Temptress: {skin: '#fcb8d8', body: '#3c0c3c', legs: '#fcb8d8', head: 'horns', hc: '#f8b800', weapon: 'orbhand', orb: '#d858f8', wings: '#a01848', aura: '#fc74b4'},
    Demon: {skin: '#c02010', body: '#a01808', legs: '#601008', head: 'horns', hc: '#e8e8d0', weapon: 'claw', big: 1, eye: '#fcfc54'},
    'Horned Demon': {skin: '#e03018', body: '#601008', legs: '#401008', head: 'horns', hc: '#fcfcfc', weapon: 'axe', big: 1, eye: '#fcfc54', trim: '#fc9838'},
    Efreet: {skin: '#fc9838', body: '#e05010', legs: null, head: 'bald', hc: '#fc9838', weapon: 'sword', flame: '#fcfc54', ghost: 1, eye: '#fcfcfc'},
    'Efreet Sultan': {skin: '#fcb848', body: '#a01010', legs: null, head: 'crown', hc: '#f8b800', weapon: 'sword', flame: '#fcfcfc', ghost: 1, eye: '#fcfcfc', aura: '#fc9838'},
    'Pit Fiend': {skin: '#801010', body: '#501010', legs: '#300808', head: 'horns', hc: '#3a2a1a', weapon: 'whip', big: 1, wings: '#401010', eye: '#fcfc54'},
    'Pit Lord': {skin: '#a01818', body: '#300808', legs: '#200404', head: 'horns', hc: '#fcfcfc', weapon: 'scythe', big: 1, wings: '#600808', eye: '#fcfcfc', aura: '#fc7430'},
    Devil: {skin: '#e40030', body: '#202020', legs: '#e40030', head: 'horns', hc: '#101018', weapon: 'fork', cape: '#101018', eye: '#fcfc54', wings: '#301010'},
    'Arch Devil': {skin: '#fc3050', body: '#101018', legs: '#fc3050', head: 'horns', hc: '#f8b800', weapon: 'fork', cape: '#e40030', eye: '#fcfcfc', wings: '#600010', crown: 1, aura: '#e40058'},
    Goblin: {skin: '#80c020', body: '#8b5a2b', legs: '#5a3a1a', head: 'goblin', hc: '#80c020', weapon: 'club', small: 1},
    Hobgoblin: {skin: '#c0a020', body: '#6c3c1c', legs: '#4a2a1a', head: 'goblin', hc: '#c0a020', weapon: 'axe', small: 1, shield: '#8b5a2b'},
    'Wolf Raider': {kind: 'beast', head: 'wolf', col: '#9c8c7c', dark: '#6c5c4c', rider: {skin: '#80c020', body: '#8b5a2b', hc: '#80c020', head: 'goblin', weapon: 'club'}},
    'Warg Raider': {kind: 'beast', head: 'wolf', col: '#4c3c3c', dark: '#2c1c1c', mane: '#e40058', rider: {skin: '#c0a020', body: '#5a2a1a', hc: '#c0a020', head: 'goblin', weapon: 'axe'}},
    'Orc Axeman': {skin: '#5c9c3c', body: '#6c4c2c', legs: '#4a3a1a', head: 'tusk', hc: '#202020', weapon: 'axe'},
    'Orc Chieftain': {skin: '#4c8c2c', body: '#8c1c1c', legs: '#4a2a1a', head: 'tusk', hc: '#f8b800', weapon: 'axe', shield: '#5a3a1a', trim: '#e8e8d0', cape: '#e40058'},
    'Ogre Shaman': {skin: '#c09060', body: '#5c3c8c', legs: '#4a3a1a', head: 'ogre', hc: '#3a2a1a', weapon: 'staff', orb: '#e40058', big: 1},
    'Ogre Magi': {skin: '#a07cc0', body: '#2c2c6c', legs: '#2c2c4c', head: 'ogre', hc: '#f8b800', weapon: 'staff', orb: '#58f8f8', big: 1, aura: '#d858f8'},
    Roc: {kind: 'flyer', col: '#a06030', wing: '#7c4c24', head: 'bird', hc: '#c08050', beak: '#f8b800', big: 1},
    Thunderbird: {kind: 'flyer', col: '#3c6cc8', wing: '#58a8fc', head: 'bird', hc: '#fcfcfc', beak: '#f8b800', big: 1, aura: '#fcfc54'},
    Cyclops: {skin: '#c8a080', body: '#6c4c2c', legs: '#4a3a1a', head: 'cyclops', hc: '#3a2a1a', weapon: 'rock', big: 1},
    'Cyclops King': {skin: '#b88870', body: '#8c1c1c', legs: '#4a2a1a', head: 'cyclops', hc: '#f8b800', weapon: 'rock', big: 1, crown: 1},
    Behemoth: {kind: 'beast', head: 'behemoth', col: '#8c6c4c', dark: '#5c4c2c', horn: '#e8e8d0', big: 1},
    'Ancient Behemoth': {kind: 'beast', head: 'behemoth', col: '#c8b8a0', dark: '#8c7c64', horn: '#f8b800', big: 1, mane: '#5c3c1c'},
    Miner: {skin: '#f0b890', body: '#8c6c3c', legs: '#4a3a2a', head: 'beard', hc: '#c08040', weapon: 'pick', small: 1, beard: '#c08040'},
    Foreman: {skin: '#f0b890', body: '#5c4c8c', legs: '#3a2a4a', head: 'beard', hc: '#f8b800', weapon: 'hammer', small: 1, beard: '#e8e8e8'},
    Shieldbearer: {skin: '#f0b890', body: '#a0a0b8', legs: '#5c5c6c', head: 'beard', hc: '#c8c8d8', weapon: 'axe', small: 1, beard: '#8b4513', shield: '#c8c8d8', bigshield: 1},
    Shieldguard: {skin: '#f0b890', body: '#58c8f8', legs: '#3c3c6c', head: 'beard', hc: '#f8b800', weapon: 'hammer', small: 1, beard: '#3a2a1a', shield: '#f8b800', bigshield: 1},
    'Crossbow Engineer': {skin: '#f0b890', body: '#d0a050', legs: '#5a3a1a', head: 'beard', hc: '#7c7c8c', weapon: 'xbow', small: 1, beard: '#e05030'},
    'Siege Engineer': {skin: '#f0b890', body: '#7c5c3c', legs: '#3a2a1a', head: 'beard', hc: '#f8b800', weapon: 'cannon', small: 1, beard: '#e8e8e8'},
    Runesmith: {skin: '#f0b890', body: '#3c6c9c', legs: '#2c3c5c', head: 'beard', hc: '#58c8f8', weapon: 'hammer', small: 1, beard: '#f8b800', aura: '#58c8f8'},
    Runelord: {skin: '#f0b890', body: '#1c2c5c', legs: '#101830', head: 'beard', hc: '#58f8f8', weapon: 'staff', orb: '#58f8f8', small: 1, beard: '#fcfcfc', aura: '#58f8f8', robe: 1},
    'Bear Rider': {kind: 'beast', head: 'bear', col: '#7c5030', dark: '#4c3018', big: 1, rider: {skin: '#f0b890', body: '#a0a0b8', hc: '#c8c8d8', head: 'beard', beard: '#8b4513', weapon: 'axe'}},
    'Bear Lord': {kind: 'beast', head: 'bear', col: '#e8e8f0', dark: '#a8a8c0', big: 1, rider: {skin: '#f0b890', body: '#f8b800', hc: '#f8b800', head: 'beard', beard: '#fcfcfc', weapon: 'hammer'}},
    'Steam Golem': {skin: '#9c9cac', body: '#7c7c8c', legs: '#5c5c6c', head: 'golem', hc: '#5c5c6c', weapon: 'fist', big: 1, eye: '#f8b800', steam: 1},
    'Iron Golem': {skin: '#6c7c8c', body: '#4c5c6c', legs: '#3c4c5c', head: 'golem', hc: '#3c4c5c', weapon: 'hammer', big: 1, eye: '#58f8f8', steam: 1, trim: '#f8b800'},
    'Iron Dreadnought': {kind: 'tank', col: '#606878', dark: '#3c4450', trim: '#d0a050'},
    'Thunder Dreadnought': {kind: 'tank', col: '#3c4c7c', dark: '#202c50', trim: '#58f8f8', twin: 1},
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
    if (L.wings) { if (f === 1) { p(3, 11 + oy, 6, 3, L.wings); p(2, 13 + oy, 4, 2, shade(L.wings)); } else { p(4, 4 + oy, 3, 8, L.wings); p(2, 2 + oy, 3, 6, shade(L.wings)); } }
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
    if (L.head === 'horns') { p(hx - 1, hy - 1, 2, 3, L.hc); p(hx + 5 + sc, hy - 1, 2, 3, L.hc); p(hx - 1, hy - 2, 1, 1, L.hc); p(hx + 6 + sc, hy - 2, 1, 1, L.hc); }
    if (L.head === 'elf') { p(hx, hy, 6, 2, L.hc); p(hx - 1, hy + 1, 2, 5, L.hc); p(hx + 6, hy + 2, 2, 1, L.skin); }
    if (L.head === 'tusk') { p(hx, hy, 6, 1, L.hc); p(hx + 4, hy + 6, 1, 2, '#fcfcfc'); p(hx + 6, hy + 6, 1, 2, '#fcfcfc'); }
    if (L.head === 'ogre') { p(hx, hy, 7, 2, L.hc); p(hx + 3, hy + 5, 4, 2, shade(L.skin)); p(hx + 5, hy + 6, 1, 2, '#fcfcfc'); }
    if (L.head === 'cyclops') { p(hx + 2, hy + 2, 3, 3, '#fcfcfc'); p(hx + 3, hy + 3, 1, 1, '#e40058'); p(hx, hy, 7, 1, L.hc); }
    if (L.head === 'beard') { p(hx - 1, hy - 1, 8, 3, L.hc); p(hx - 1, hy + 2, 1, 2, L.hc); p(hx + 1, hy + 5, 6, 4, L.beard); p(hx + 2, hy + 9, 4, 1, L.beard); }
    if (L.head === 'vamp') { p(hx, hy, 6, 2, L.hc); p(hx + 2, hy + 1, 1, 1, L.hc); p(hx + 4, hy + 6, 1, 1, '#fcfcfc'); }
    if (L.head === 'antler') { p(hx - 1, hy, 7, 3, '#5c8c3c'); p(hx, hy - 3, 1, 3, L.hc); p(hx - 1, hy - 4, 1, 1, L.hc); p(hx + 4, hy - 3, 1, 3, L.hc); p(hx + 5, hy - 4, 1, 1, L.hc); }
    if (L.head === 'golem') { p(hx - 1, hy, 8 + sc, 7, L.hc); p(hx + 1, hy + 3, 5, 1, '#101018'); p(hx + 3, hy + 3, 2, 1, L.eye); }
    if (L.crown) { p(hx, hy - 2, 6, 2, '#f8b800'); p(hx, hy - 3, 1, 1, '#f8b800'); p(hx + 5, hy - 3, 1, 1, '#f8b800'); }
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
    if (w === 'pike') { p(wx, wy - 12, 1, 17, '#8b5a2b'); p(wx - 1, wy - 14, 3, 2, '#d8d8e8'); p(wx, wy - 15, 1, 1, '#fcfcfc'); }
    if (w === 'axe') { p(wx, wy - 8, 1, 11, '#8b5a2b'); p(wx + 1, wy - 8, 3, 4, '#c8c8d8'); p(wx + 3, wy - 9, 1, 6, '#e8e8f8'); }
    if (w === 'xbow') { p(wx - 2, wy - 1, 6, 1, '#8b5a2b'); p(wx + 3, wy - 4, 1, 7, '#6c3c1c'); p(wx + 2, wy - 4, 1, 1, '#fcfcfc'); p(wx + 2, wy + 2, 1, 1, '#fcfcfc'); }
    if (w === 'hammer') { p(wx, wy - 7, 1, 10, '#8b5a2b'); p(wx - 2, wy - 10, 5, 4, '#9c9cac'); p(wx - 2, wy - 10, 5, 1, '#c8c8d8'); }
    if (w === 'pick') { p(wx, wy - 7, 1, 10, '#8b5a2b'); p(wx - 3, wy - 8, 7, 1, '#9c9cac'); p(wx - 3, wy - 7, 1, 1, '#9c9cac'); p(wx + 3, wy - 7, 1, 1, '#9c9cac'); }
    if (w === 'scythe') { p(wx, wy - 10, 1, 14, '#5a3a1a'); p(wx - 4, wy - 11, 5, 1, '#e8e8f8'); p(wx - 5, wy - 10, 2, 1, '#e8e8f8'); }
    if (w === 'whip') { for (let i = 0; i < 6; i++) p(wx + i, wy - 2 + Math.round(Math.sin(i + (atk ? 2 : 0)) * 2), 1, 1, '#fc9838'); }
    if (w === 'rock') { p(wx - 1, wy - 6, 5, 5, '#8c8c8c'); p(wx, wy - 6, 2, 1, '#c8c8c8'); }
    if (w === 'cannon') { p(wx - 3, wy - 2, 8, 3, '#3c3c4c'); p(wx + 4, wy - 3, 2, 5, '#202028'); }
    if (w === 'fist') { p(wx - 1, wy - 1, 4, 4, L.skin); p(wx, wy, 2, 2, shade(L.skin)); }
    if (w === 'dart') { p(wx, wy - 3, 1, 4, '#fcfcfc'); }
    if (w === 'orbhand') { p(wx, wy - 3, 3, 3, L.orb); p(wx + 1, wy - 3, 1, 1, '#fcfcfc'); }
    if (w === 'claw') { p(wx, wy - 1, 3, 1, L.skin); p(wx + 2, wy - 2, 1, 1, '#fcfcfc'); p(wx + 2, wy, 1, 1, '#fcfcfc'); }
    if (L.shield) { const bs = L.bigshield ? 3 : 0; p(tx - 2 - bs, 10 + oy, 4 + bs, 6 + bs, L.shield); p(tx - 1 - bs, 11 + oy, 2 + bs, 4 + bs, shade(L.shield)); }
    if (L.trim) { p(tx, 10 + oy, tw, 1, L.trim); p(tx + Math.floor(tw / 2), 10 + oy, 1, 6, L.trim); }
    if (L.flame) for (let i = 0; i < 4; i++) p(9 + i * 2, 18 + oy + ((i + f) % 2) * 2, 1, 3, L.flame);
    if (L.steam && f % 2) { p(tx + 1, 6 + oy, 2, 2, '#e8e8e8'); p(tx, 4 + oy, 1, 1, '#e8e8e8'); }
  }
  // generic quadruped (wolf/hound/horse/bear/behemoth), optional rider, horn, extra heads
  function beast(p, L, f) {
    const b = f === 1 ? 1 : 0, a = f === 2 ? 2 : 0, c = L.col, d = L.dark, big = L.big ? 1 : 0, s = f === 1 ? 1 : 0;
    const by = 11 + b - big * 2, bw = 13 + big * 3, bh = 6 + big * 3;
    p(3 + a - big, by, bw, bh, c); p(3 + a - big, by + bh - 1, bw, 1, d); p(a, by - 1, 4, 3, c); // body + tail
    const hx = 15 + a + big, hy = by - 4 - big;
    if (L.head === 'horse') { p(hx, hy - 2, 4, 8, c); p(hx + 2, hy - 3, 5, 4, c); p(hx + 5, hy, 2, 2, d); p(hx + 4, hy - 2, 1, 1, '#101018'); p(hx - 1, hy - 3, 2, 8, L.mane); p(1 + a, by, 3, 6, L.mane); }
    else if (L.head === 'bear') { p(hx - 1, hy, 8, 7, c); p(hx + 5, hy + 3, 3, 3, d); p(hx, hy - 1, 2, 2, c); p(hx + 4, hy + 1, 1, 1, '#101018'); p(hx + 7, hy + 3, 1, 1, '#101018'); }
    else if (L.head === 'behemoth') { p(hx - 2, hy, 9, 8, c); p(hx + 5, hy + 4, 3, 3, d); p(hx + 4, hy + 1, 1, 1, '#e40058'); p(hx + 6, hy + 6, 2, 2, '#fcfcfc'); p(hx - 1, hy - 3, 2, 4, L.horn); p(hx + 3, hy - 3, 2, 4, L.horn); if (L.mane) p(hx - 3, hy, 3, 9, L.mane); }
    else { const heads = L.heads || 1; for (let k = heads - 1; k >= 0; k--) { const ox = -k * 2, oy = -k * 3 + (k ? 1 : 0); p(hx + ox, hy + 1 + oy, 6, 6, k ? d : c); p(hx + 5 + ox, hy + 4 + oy, 3, 2, c); p(hx + 1 + ox, hy - 1 + oy, 2, 3, c); p(hx + 4 + ox, hy + 2 + oy, 1, 1, L.head === 'hound' ? '#fcfc54' : '#e40058'); p(hx + 6 + ox, hy + 6 + oy, 2, 1, '#fcfcfc'); } if (L.mane) for (let i = 0; i < 4; i++) p(hx - 2 + i * 2, hy - 1 + (i % 2) - f % 2, 1, 2, L.mane); }
    if (L.horn) { if (L.head === 'horse') { p(hx + 4, hy - 7, 1, 4, L.horn); p(hx + 5, hy - 8, 1, 2, L.horn); } }
    const ly = by + bh;
    p(4 - big, ly, 2 + big, 24 - ly - b, d); p(7 + s, ly, 2 + big, 24 - ly - b, c); p(14 - s + big, ly, 2 + big, 24 - ly - b, d); p(16 + a + big, ly - (a ? 1 : 0), 2 + big, 24 - ly - b, c);
    if (L.rider) { const R = L.rider, rx = 7 + a, ry = by - 9; p(rx, ry + 3, 5, 6, R.body); p(rx + 1, ry - 2, 5, 5, R.skin); p(rx + 4, ry, 1, 1, '#101018');
      if (R.head === 'elf') { p(rx, ry - 3, 6, 2, R.hc); p(rx - 1, ry - 1, 1, 2, R.skin); }
      else if (R.head === 'goblin') { p(rx - 1, ry, 1, 2, R.skin); p(rx + 6, ry, 1, 2, R.skin); p(rx + 4, ry, 1, 1, '#fc3c3c'); }
      else if (R.head === 'beard') { p(rx, ry - 3, 6, 2, R.hc); p(rx + 2, ry + 2, 4, 3, R.beard); }
      const wx = rx + 6 + a; if (R.weapon === 'sword') p(wx, ry - 2, 1, 7, '#e8e8f8'); else if (R.weapon === 'pike') p(wx, ry - 7, 1, 13, '#c8c8d8'); else if (R.weapon === 'axe') { p(wx, ry - 3, 1, 9, '#8b5a2b'); p(wx + 1, ry - 3, 2, 3, '#c8c8d8'); } else if (R.weapon === 'hammer') { p(wx, ry - 2, 1, 8, '#8b5a2b'); p(wx - 1, ry - 4, 3, 3, '#9c9cac'); } else { p(wx, ry - 4, 2, 7, '#8b5a2b'); p(wx - 1, ry - 6, 4, 3, '#6c3c1c'); }
    }
  }
  // birds and griffins: wings flap between frames
  function flyer(p, L, f) {
    const up = f === 0, a = f === 2 ? 2 : 0, big = L.big ? 1 : 0, c = L.col, w = L.wing;
    if (up) { p(5, 1, 3, 9, w); p(7, 3, 4, 7, w); p(9, 5, 3, 5, shade(w)); } else { p(2, 9, 10, 3, w); p(1, 12, 8, 2, shade(w)); }
    p(5 + a - big, 10 - big, 12 + big * 2, 6 + big, c); p(5 + a - big, 15, 12 + big * 2, 1, shade(c)); p(2 + a, 10, 4, 2, c); p(1 + a, 9, 2, 2, w); // body + tail
    const hx = 15 + a + big, hy = 5 - big;
    p(hx, hy, 6, 6, L.hc); p(hx + 6, hy + 2, 3, 2, L.beak); p(hx + 6, hy + 4, 2, 1, shade(L.beak)); p(hx + 4, hy + 2, 1, 1, '#101018'); p(hx - 1, hy + 4, 3, 7, L.hc);
    if (L.quad) { p(7, 16, 2, 7, shade(c)); p(10, 16, 2, 7, c); p(14, 16, 2, 7, shade(c)); p(16 + a, 16, 2, 7, L.beak); }
    else { p(9, 16, 1, 6, L.beak); p(13, 16, 1, 6, L.beak); p(8, 22, 3, 1, L.beak); p(12 + a, 22, 3, 1, L.beak); }
    if (up) { p(12, 0, 3, 10, w); p(14, 2, 3, 6, shade(w)); } else { p(10, 12, 10, 3, w); p(12, 15, 7, 2, shade(w)); }
    if (L.crown) { p(hx + 1, hy - 2, 4, 2, '#f8b800'); p(hx + 1, hy - 3, 1, 1, '#f8b800'); p(hx + 4, hy - 3, 1, 1, '#f8b800'); }
  }
  function dragon(p, L, f) {
    const up = f !== 1, a = f === 2 ? 2 : 0, c = L.col, d = L.dark, w = L.wing;
    if (up) { p(6, 0, 3, 10, w); p(8, 1, 6, 9, shade(w)); for (let i = 0; i < 3; i++) p(8 + i * 2, 1 + i, 1, 8, d); } else { p(2, 7, 13, 3, w); p(3, 10, 10, 2, shade(w)); }
    p(4 + a, 11, 14, 7, c); if (L.belly) p(6 + a, 16, 10, 2, L.belly); p(0, 10 + (f % 2), 5, 2, c); p(0, 8 + (f % 2), 2, 2, d);
    p(15 + a, 6, 3, 7, c); p(16 + a, 3, 7, 5, c); p(21 + a, 6, 3, 2, d); p(19 + a, 4, 1, 1, L.eye); p(17 + a, 1, 1, 3, d); p(20 + a, 1, 1, 3, d);
    if (f === 2) { p(22, 8, 2, 1, '#fc9838'); }
    if (L.bones) { for (let i = 0; i < 4; i++) p(6 + i * 3 + a, 12, 1, 5, d); p(17 + a, 4, 2, 2, '#101018'); }
    p(5, 18, 3, 6, d); p(9, 18, 3, 6, c); p(13, 18, 3, 6, d); p(16 + a, 18, 3, 6, c);
    if (up) { p(11, 0, 4, 9, w); p(13, 2, 3, 7, d); } else { p(11, 9, 11, 3, w); }
    if (L.crown) { p(17 + a, 0, 4, 1, '#f8b800'); }
  }
  function tank(p, L, f) {
    const c = L.col, d = L.dark, rec = f === 2 ? 1 : 0;
    p(1, 17, 22, 6, '#2c2c34'); for (let i = 0; i < 6; i++) p(2 + i * 4 + (f % 2), 18, 2, 4, '#5c5c6c');
    p(2, 10, 20, 8, c); p(2, 10, 20, 1, '#fcfcfc40'); p(2, 16, 20, 1, d); p(5, 12, 12, 1, L.trim);
    p(7 - rec, 5, 10, 6, c); p(8 - rec, 6, 3, 2, '#101018'); p(16 - rec, 7, 8, 2, d); p(22 - rec, 6, 2, 4, '#101018');
    if (L.twin) p(16 - rec, 4, 7, 2, d);
    p(4, 2 - (f % 2), 2, 5, d); p(3, 0 - (f % 2), 2, 2, '#c8c8c8');
    if (f === 2) { p(23, 6, 1, 3, '#fcfc54'); }
  }
  function treant(p, L, f) {
    const b = f === 1 ? 1 : 0, a = f === 2 ? 3 : 0;
    p(8, 8 + b, 8, 13, L.col); p(9, 8 + b, 1, 13, shade(L.col)); p(13, 11 + b, 1, 5, shade(L.col)); p(10, 12 + b, 1, 1, '#fcfc54'); p(13, 12 + b, 1, 1, '#fcfc54');
    p(6, 20, 4, 4, L.col); p(14, 20, 4, 4, L.col);
    p(4, 1 + b, 16, 8, L.leaf); p(2, 4 + b, 4, 4, L.leaf); p(18, 3 + b, 4, 5, L.leaf); p(7, 0 + b, 10, 2, shade(L.leaf));
    p(15 + a, 10 + b, 6, 2, L.col); p(19 + a, 8 + b, 2, 3, L.col); p(3, 11 + b, 5, 2, L.col);
    if (L.flower) for (let i = 0; i < 5; i++) p(5 + i * 3, 2 + (i % 2) * 3 + b, 1, 1, L.flower);
  }
  const unit = (type, f, left) => memo('u' + type + f + (left ? 'L' : ''), () => {
    if (left) return flip(unit(type, f, false));
    const L = UNIT_LOOK[type] || UNIT_LOOK.Peasant;
    const body = outline(mk(24, 24, p => L.kind === 'beast' ? beast(p, L, f) : L.kind === 'flyer' ? flyer(p, L, f) : L.kind === 'dragon' ? dragon(p, L, f) : L.kind === 'tank' ? tank(p, L, f) : L.kind === 'tree' ? treant(p, L, f) : L.quad ? wolf(p, f) : humanoid(p, L, f)));
    if (!L.aura && !L.ghostly) return body;
    return mk(24, 24, (p, g) => { if (L.ghostly) g.globalAlpha = 0.8; g.drawImage(body, 0, 0); g.globalAlpha = 1; if (L.aura) for (let i = 0; i < 6; i++) { const k = (i * 5 + f * 3) % 22; p(1 + k, 2 + ((i * 7 + f * 4) % 20), 1, 1, L.aura); } });
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
  const PAL = f => (FACTIONS[f] || FACTIONS.castle).pal;
  function emblem(q, f, x, y, P) {
    const e = P.emb;
    if (f === 'castle') { q(x + 1, y, 2, 6, e); q(x, y + 2, 4, 1, e); }
    else if (f === 'necro') { q(x, y + 1, 4, 3, e); q(x + 1, y + 2, 1, 1, '#101018'); q(x + 3, y + 2, 1, 1, '#101018'); q(x + 1, y + 4, 2, 1, e); }
    else if (f === 'sylvan') { q(x + 1, y, 2, 5, e); q(x, y + 1, 4, 2, e); q(x + 1, y + 5, 1, 1, '#5a3a1a'); }
    else if (f === 'inferno') { q(x + 1, y, 1, 2, e); q(x, y + 2, 4, 3, e); q(x + 1, y + 3, 2, 2, '#fcfc54'); }
    else if (f === 'stronghold') { q(x, y, 1, 4, e); q(x + 3, y, 1, 4, e); q(x + 1, y + 3, 2, 2, '#e8e8d0'); }
    else { q(x, y + 1, 4, 2, e); q(x + 1, y + 3, 2, 2, e); q(x - 1, y + 1, 1, 1, e); }
  }
  const town = (faction, owner, f) => memo('town' + faction + owner + f, () => {
    const P = PAL(faction), wall = P.wall, roof = P.roof, fc = owner === 'player' ? '#3cbcfc' : owner === 'ai' ? '#e40058' : '#a8a8a8';
    return mk(36, 34, (p, g) => {
      const b = outline(mk(36, 34, q => {
        if (faction === 'sylvan') { q(2, 20, 32, 12, wall); tree(q, 0, 8, 1); tree(q, 27, 8, 0); q(11, 10, 14, 12, wall); q(9, 3, 18, 8, roof); q(12, 0, 12, 4, '#38b848'); q(14, 23, 8, 9, '#3a2a1a'); emblem(q, faction, 16, 13, P); return; }
        if (faction === 'stronghold') { q(2, 18, 32, 14, wall); for (let i = 0; i < 8; i++) q(2 + i * 4, 13 + (i % 2) * 2, 2, 6, '#5c3c1c'); q(10, 8, 16, 12, wall); q(8, 4, 20, 5, roof); q(17, 0, 2, 5, '#e8e8d0'); q(14, 23, 8, 9, '#2a1a0a'); emblem(q, faction, 16, 11, P); return; }
        if (faction === 'dwarf') { q(0, 12, 36, 20, '#6c6c6c'); q(4, 8, 28, 5, '#8c8c8c'); q(10, 14, 16, 18, wall); q(12, 18, 12, 14, '#202028'); q(13, 17, 10, 1, P.emb); q(2, 4, 4, 9, '#5c5c6c'); q(30, 4, 4, 9, '#5c5c6c'); emblem(q, faction, 16, 9, P); return; }
        q(2, 18, 32, 14, wall); for (let i = 0; i < 6; i++) q(2 + i * 6, 15, 4, 3, wall);
        q(3, 22, 30, 1, shade(wall)); q(14, 23, 8, 9, '#3a2a1a'); q(15, 22, 6, 1, '#3a2a1a');
        q(11, 8, 14, 12, wall); q(10, 5, 16, 3, roof); q(12, 3, 12, 2, roof); q(15, 1, 6, 2, roof);
        q(14, 11, 2, 3, '#202040'); q(20, 11, 2, 3, '#202040');
        q(0, 10, 6, 22, wall); q(0, 7, 6, 3, roof); q(30, 10, 6, 22, wall); q(30, 7, 6, 3, roof);
        if (faction === 'inferno') { q(0, 3, 6, 4, roof); q(2, 0, 2, 3, roof); q(30, 3, 6, 4, roof); q(32, 0, 2, 3, roof); q(15, 23, 6, 3, '#fc7430'); }
        q(2, 14, 2, 3, '#202040'); q(32, 14, 2, 3, '#202040');
        emblem(q, faction, 16, 15, P);
      }));
      g.drawImage(b, 0, 4);
      p(17, 0, 1, 6, '#202020'); p(18, 0, 6, 3, fc); p(18 + (f % 2) * 2, 3, 4, 1, fc); p(24 - (f % 2), 1, 1, 1, fc);
    });
  });
  const grove = (owner, f) => memo('grove' + owner + f, () => mk(T + 8, T + 10, (p, g) => {
    const b = outline(mk(T + 8, T + 10, q => { q(2, 20, 20, 4, '#5c8c3c'); tree(q, 1, 8, 1); tree(q, 13, 8, 0); q(9, 12, 6, 10, '#a8a8b8'); q(8, 11, 8, 2, '#c8c8d8'); q(11, 14, 2, 2, '#58f898'); }));
    g.drawImage(b, 0, 0);
    p(10 + f, 6 - f, 1, 1, '#fcfc54'); p(15 - f, 9, 1, 1, '#58f898'); p(6, 4 + f, 1, 1, '#fcfcfc');
    const fc = owner === 'player' ? '#3cbcfc' : owner === 'ai' ? '#e40058' : '#a8a8a8'; p(19, 0, 1, 10, '#202020'); p(20, 1, 4, 3, fc);
  }));

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

  // ---------- terrain spells (24x24 battle tiles, 2 animation frames) ----------
  const terr = (k, f) => memo('terr' + k + f, () => mk(24, 24, p => {
    if (k === 'quagmire') { p(1, 3, 22, 19, '#2c4a2c'); p(3, 5, 18, 15, '#3c5c34'); p(5, 8, 14, 8, '#24402c'); for (let i = 0; i < 5; i++) p(3 + i * 4, 4 + (i % 2) * 15, 2, 3, '#6c8c3c'); p(7 + f * 6, 10 - f, 3, 3, '#5c7c4c'); p(14 - f * 5, 13 + f, 2, 2, '#7c9c5c'); p(4, 12, 1, 6, '#8cac4c'); p(19, 6, 1, 6, '#8cac4c'); }
    if (k === 'raise') { p(2, 14, 20, 8, '#6c4c2c'); p(5, 9, 14, 6, '#8c6c3c'); p(8, 5, 8, 5, '#a8845a'); p(10, 4, 4, 1, '#c8a878'); p(4, 21, 16, 1, '#3a2a1a'); p(6 + f, 12, 2, 1, '#5c3c1c'); p(15 - f, 17, 3, 1, '#5c3c1c'); p(9, 6, 2, 2, '#58a038'); }
    if (k === 'thorns') { for (let i = 0; i < 6; i++) { const x = 2 + i * 4, y = 6 + ((i * 7) % 11); p(x, y, 1, 14 - (i % 3) * 3, '#2c5c1c'); p(x - 1, y + 3, 3, 1, '#4c8c2c'); p(x + 1, y + 1 + f, 1, 1, '#e8e8b0'); p(x - 1, y + 6 - f, 1, 1, '#e8e8b0'); } p(3, 20, 18, 2, '#3c2c1c'); p(9 + f * 2, 9, 2, 2, '#c02040'); }
    if (k === 'fog') { for (let i = 0; i < 8; i++) p(((i * 9 + f * 3) % 20), 2 + i * 3, 10, 3, i % 2 ? '#d8d8e8' : '#b8b8d0'); }
  }));
  // ---------- town screen view: skyline showing what has been built ----------
  function townView(cv, t) {
    const w = 240, h = 96; cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const p = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    const P = PAL(t.faction), [sr, sg, sb] = P.sky;
    for (let y = 0; y < 64; y++) p(0, y, w, 1, `rgb(${Math.min(255, sr + y)},${Math.min(255, sg + y / 2)},${Math.max(0, Math.min(255, sb + y / 2))})`);
    p(190, 10, 14, 14, ['necro', 'inferno'].includes(t.faction) ? '#e8e8d0' : '#fcfc54');
    p(0, 60, w, 36, P.ground); for (let i = 0; i < 60; i++) p((i * 37) % w, 62 + (i * 13) % 34, 2, 1, shade(P.ground));
    if (t.faction === 'sylvan') for (let i = 0; i < 9; i++) { const tt = mk(10, 14, q => tree(q, 1, 1, i % 2)); g.drawImage(tt, i * 27, 44); }
    if (t.faction === 'inferno') for (let i = 0; i < 10; i++) p((i * 29) % w, 58 + (i % 3), 6, 2, '#fc7430');
    const wall = P.wall, roof = P.roof, B = k => t.built.includes(k);
    const bld = (x, bw, bh, rf, extra) => { const y = 66 - bh; p(x, y, bw, bh, wall); p(x - 1, y - 4, bw + 2, 4, rf); p(x + 1, y - 7, bw - 2, 3, rf); p(x + bw / 2 - 2, 66 - 8, 4, 8, '#3a2a1a'); if (extra) extra(x, y); };
    if (B('fort')) { p(4, 52, 232, 14, wall); for (let i = 0; i < 29; i++) p(4 + i * 8, 48, 5, 4, wall); }
    bld(104, 32, 34, roof, (x, y) => { p(x + 6, y + 8, 4, 6, '#202040'); p(x + 22, y + 8, 4, 6, '#202040'); const q = (a, b2, c, d, e) => p(a, b2, c, d, e); emblem(q, t.faction, x + 14, y + 4, P); });
    if (B('hall')) bld(140, 26, 26, '#f8b800');
    if (B('tavern')) bld(176, 22, 16, '#8b4513', (x, y) => p(x + 22, y + 4, 6, 4, '#f8b800'));
    if (B('market')) bld(204, 26, 12, '#e40058');
    if (B('pit')) { p(60, 60, 30, 6, '#101010'); p(62, 58, 26, 2, '#fc7430'); p(70 + (Math.floor(Date.now() / 300) % 3) * 4, 54, 2, 4, '#fcfc54'); }
    if (B('guild1')) bld(70, 16, 30, '#3c3cbc', (x, y) => { if (B('guild2')) { p(x + 2, y - 20, 12, 12, wall); p(x + 1, y - 24, 14, 4, '#d858f8'); } p(x + 6, y + 6, 4, 4, '#58f8f8'); });
    if (B('citadel')) { p(40, 22, 14, 44, wall); p(38, 18, 18, 4, roof); }
    const u = FACTIONS[t.faction].units;
    u.forEach((name, i) => { if (!B('dw' + (i + 1))) return; const up = B('up' + (i + 1)); p(6 + i * 33, 72, 28, 22, '#00000030'); if (up) p(6 + i * 33, 92, 28, 2, '#f8b800'); g.drawImage(unit(up ? UNITS[name].upName : name, 0, false), 8 + i * 33, 70); });
  }

  return {grove, terr, wall, tower, catapult, flip, T, landLayer, waterLayer, pile, chest, artifact, mine, unit, unitFlash, hero, town, portrait, field, boulder, townView};
})();
