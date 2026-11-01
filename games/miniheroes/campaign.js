// Mini Heroes - CAMPAIGN: 6 linked missions, hero carryover, start bonuses, stars, hard mode, diplomacy, mythical quest.
// Loaded after game.js; it wraps a few game.js functions (checkEnd, newDay, finishFight, fight, take, drawObj, tipFor).
'use strict';
const CAMP_KEY = 'mh-campaign';
// Tier-8 mythical creatures (one per player, quest reward only)
const MYTHIC = {castle: 'Archangel', necro: 'Lich King', sylvan: 'Phoenix', inferno: 'Arch Fiend', stronghold: 'Thunder Titan', dwarf: 'Forge Colossus'};
const MYTHIC_BASE = {castle: 'Champion', necro: 'Ghost Dragon', sylvan: 'Emerald Dragon', inferno: 'Arch Devil', stronghold: 'Ancient Behemoth', dwarf: 'Thunder Dreadnought'};
for (const f in MYTHIC) { const b = UNITS[MYTHIC_BASE[f]]; UNITS[MYTHIC[f]] = {...b, fac: f, tier: 7, up: true, upName: null, base: MYTHIC[f], att: b.att + 6, def: b.def + 6, hp: Math.round(b.hp * 1.8), dmg: b.dmg.map(d => Math.round(d * 1.5)), move: b.move + 1, ab: [...new Set([...b.ab, 'Fly', 'SpellImm'])], cost: 9000, growth: 0, col: '#fcfc54', mythic: 1}; }
SPR.mythicLook && SPR.mythicLook(MYTHIC_BASE, MYTHIC);
const SAY = (who, t) => ({who, t});
const MISSIONS = [
  {id: 1, name: "The Crown's Call", pf: 'castle', af: 'necro', size: 'S', seed: 1101, diff: 'easy', par: 12, obj: 'capture',
    goal: 'Capture the enemy town', start: [SAY('Queen Catherine', 'Roland, the dead stir in the east. Take back the border town!'), SAY('Roland', 'Flag the MINES first - they pay every day.'), SAY('Queen Catherine', 'In battle you PLAN every stack, then RESOLVE: shooters fire first, then moves, then melee. Pick a FORMATION before the fight.')],
    end: [SAY('Queen Catherine', 'Well done. But the undead lord is gathering an army...')]},
  {id: 2, name: 'Necropolis Rising', pf: 'castle', af: 'necro', size: 'M', seed: 2202, diff: 'normal', par: 20, obj: 'hero', limit: 30,
    goal: 'Defeat the undead hero', start: [SAY('Scout', 'The undead hero marches from his necropolis. Destroy him before day 30, or his plague spreads!')],
    end: [SAY('Roland', 'Their lord has fallen. Now to the elven woods - our ally is in danger.')]},
  {id: 3, name: 'The Sylvan Road', pf: 'sylvan', af: 'inferno', size: 'M', seed: 3303, diff: 'normal', par: 16, obj: 'escort', limit: 25,
    goal: 'Escort Elowen to the HAVEN', start: [SAY('Elowen', 'Demons hunt me, Roland! Get me to the haven (the glowing tile) alive.'), SAY('Roland', 'Monsters here may yield to a strong army - some will even join us.')],
    end: [SAY('Elowen', 'I am safe. The dwarves need gold and machines for the war ahead.')]},
  {id: 4, name: 'Under the Mountain', pf: 'dwarf', af: 'stronghold', size: 'M', seed: 4404, diff: 'easy', par: 40, obj: 'economy', gold: 50000,
    goal: 'Bank 50,000 gold and build Dwelling VII (war machines)', start: [SAY('Thane Brokk', 'War needs machines and gold. Fill the vault with 50,000 gold and build the Dreadnought Works (Dwelling VII).')],
    end: [SAY('Thane Brokk', 'The forges roar! Take our machines to the gates of hell.')]},
  {id: 5, name: 'Gates of Inferno', pf: 'castle', af: 'inferno', size: 'M', seed: 5505, diff: 'normal', par: 14, obj: 'capture', siege: 1,
    goal: 'Capture the demon fortress', start: [SAY('Roland', 'The demon fortress has walls and towers. Our catapult will breach them - strike the gate!')],
    end: [SAY('Queen Catherine', 'The gates are broken. One last war remains.')]},
  {id: 6, name: 'The Last Crown', pf: 'castle', af: 'necro', size: 'L', seed: 6606, diff: 'normal', par: 35, obj: 'capture', twoAI: 1, mythic: 1,
    goal: 'Capture BOTH enemy towns', start: [SAY('Queen Catherine', 'Necropolis and Stronghold have joined against us. Take both of their towns.'), SAY('Old Sage', 'Legends speak of three SHRINES. Visit them in order and a mythical creature will answer your call - only one ever.')],
    end: [SAY('Queen Catherine', 'The realm is whole again. Long live the heroes!')]},
];
const CP = () => { try { return Object.assign({unlocked: 1, stars: {}, carry: null, hard: false}, JSON.parse(localStorage.getItem(CAMP_KEY) || '{}')); } catch (e) { return {unlocked: 1, stars: {}, carry: null, hard: false}; } };
const saveCP = c => localStorage.setItem(CAMP_KEY, JSON.stringify(c));
const totalStars = c => Object.values(c.stars).reduce((a, b) => a + b, 0);
const hardUnlocked = c => totalStars(c) >= 12;
const MIS = id => MISSIONS.find(m => m.id === id);

// ---------- campaign menu ----------
function openCampaign() {
  const c = CP();
  showPanel(() => { const c = CP(); return `<h2>CAMPAIGN</h2><p>Stars: <b class="hl">${totalStars(c)}</b>/18 · Hard mode ${hardUnlocked(c) ? btn(c.hard ? 'HARD: ON' : 'HARD: OFF', 'chard', '', c.hard ? 'y' : 'alt') : '<span class="no">locked (12 stars)</span>'}</p>
    ${c.carry ? `<p>Hero: <b>${c.carry.name}</b> LV${c.carry.lvl} · ${Object.keys(c.carry.sk).map(k => SKILLS[k].name).join(', ') || 'no skills'}${c.carry.art ? ' · ' + ARTIFACTS[c.carry.art].name : ''}</p>` : ''}
    ${MISSIONS.map(m => { const st = c.stars[m.id] || 0, open = m.id <= c.unlocked; return `<div class="it"><div class="t">${m.id}. ${m.name} ${'★'.repeat(st)}${'☆'.repeat(3 - st)}<small>${m.goal}${m.limit ? ' (by day ' + m.limit + ')' : ''} · ${FACTIONS[m.pf].name} vs ${FACTIONS[m.af].name} · ${MAP_SIZES[m.size].name}</small></div>${btn(open ? 'PLAY' : 'LOCKED', 'cpick', m.id, open ? 'g' : 'alt', !open)}</div>`; }).join('')}
    <div class="bar" style="margin-top:8px">${btn('RESET CAMPAIGN', 'creset', '', 'alt')}${btn('BACK', G ? 'close' : 'new', '', 'alt')}</div>`; }, {sticky: !G});
}
function openBonus(id) {
  const m = MIS(id), f = m.pf, strong = FACTIONS[f].units[3];
  showPanel(() => `<h2>${m.id}. ${m.name.toUpperCase()}</h2><p>${m.goal}${m.limit ? ' before day ' + m.limit : ''}.</p><h3>CHOOSE A STARTING BONUS</h3>
    <div class="it"><div class="t">+4000 GOLD<small>Build and recruit faster</small></div>${btn('TAKE', 'cstart', id + ':gold', 'y')}</div>
    <div class="it"><div class="t">4 ${strong.toUpperCase()}<small>A strong stack joins your hero</small></div>${btn('TAKE', 'cstart', id + ':unit', 'y')}</div>
    <div class="it"><div class="t">ARTIFACT<small>A random artifact for your hero</small></div>${btn('TAKE', 'cstart', id + ':art', 'y')}</div>
    <div class="bar">${btn('BACK', 'campaign', '', 'alt')}</div>`, {sticky: !G});
}

// ---------- mission setup ----------
function campFree(x, y) { return inMap(x, y) && TERRAIN[G.map[y][x]].cost && !objAt(x, y) && !townAt(x, y) && !heroAt(x, y) && !guardOf(x, y); }
function campSpot(x0, y0, r = 6) { for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (campFree(x0 + dx, y0 + dy)) return {x: x0 + dx, y: y0 + dy}; return null; }
function startMission(id, bonus) {
  const m = MIS(id), c = CP();
  startGame(() => newGame({pf: m.pf, af: m.af, size: m.size, diff: c.hard ? 'hard' : m.diff, seed: m.seed}), 'Mission ' + id + ': ' + m.name);
  const me = G.heroes.find(h => h.owner === 'player'), foe = G.heroes.find(h => h.owner === 'ai');
  G.camp = {id, bonus, lost: 0, start: armyValue(me.army), obj: m.obj, limit: m.limit || 0};
  if (c.carry) { const k = c.carry; Object.assign(me, {name: k.name, lvl: k.lvl, xp: k.xp, att: k.att, def: k.def, sp: k.sp, kn: k.kn, sk: {...k.sk}, arts: k.art ? [k.art] : [], tal: {}, tp: Math.max(0, k.lvl - 1)}); me.mana = maxMana(me); }
  if (bonus === 'gold') G.res.player.gold += 4000;
  if (bonus === 'unit') addUnits(me.army, FACTIONS[m.pf].units[3], 4);
  if (bonus === 'art') { const a = Object.keys(ARTIFACTS).filter(k => !me.arts.includes(k)); me.arts.push(a[(m.seed + id) % a.length]); }
  G.camp.start = armyValue(me.army);
  const home = G.towns.find(t => t.owner === 'player'), et = G.towns.find(t => t.owner === 'ai');
  if (id === 1) { foe.army = [{type: FACTIONS[m.af].units[0], count: 8}]; G.res.ai.gold = 500; }
  if (id === 2) { foe.name = 'Lord Haart'; foe.army = foe.army.map(s => ({...s, count: s.count * 2})); G.camp.target = foe.id; }
  if (id === 3) { const s = campSpot(home.x + 1, home.y + 1); const e = mkHero('player', 'Elowen', s.x, s.y, [{type: 'Sprite', count: 6}]); G.heroes.push(e); G.camp.escort = e.id;
    const hv = campSpot(MW - 4, 3, 8); G.objs.push({id: G.nid++, x: hv.x, y: hv.y, kind: 'haven'}); G.camp.haven = {x: hv.x, y: hv.y}; }
  if (id === 4) G.res.player.gold += 6000;
  if (id === 5) { et.built = [...new Set([...et.built, 'fort', 'citadel', 'tavern', 'dw3', 'dw4', 'dw5', 'hall'])]; et.garrison = FACTIONS[m.af].units.slice(0, 5).map((u, i) => ({type: u, count: Math.round([30, 16, 10, 6, 3][i])}));
    me.army = FACTIONS[m.pf].units.slice(0, 5).map((u, i) => ({type: u, count: Math.round([60, 30, 20, 12, 6][i])})); addUnits(me.army, FACTIONS[m.pf].units[3], bonus === 'unit' ? 4 : 0); G.camp.start = armyValue(me.army); foe.army = foe.army.map(s => ({...s, count: Math.ceil(s.count / 2)})); }
  if (id === 6) {
    const n = G.towns.find(t => t.owner === 'neutral' && Math.abs(t.x - et.x) + Math.abs(t.y - et.y) < MW) || G.towns.find(t => t.owner === 'neutral');
    if (n) { n.owner = 'ai'; n.faction = 'stronghold'; n.name = 'Krag Hold'; n.garrison = FACTIONS.stronghold.units.slice(0, 3).map((u, i) => ({type: u, count: [20, 10, 6][i]})); n.built = ['dw1', 'dw2', 'dw3', 'tavern'];
      const s = campSpot(n.x, n.y + 1) || campSpot(n.x, n.y); if (s) G.heroes.push(mkHero('ai', 'Kragh', s.x, s.y, [{type: 'Goblin', count: 30}, {type: 'Orc Axeman', count: 8}])); }
    const pts = [[0.3, 0.15], [0.15, 0.55], [0.55, 0.45]].map(([fx, fy]) => campSpot(Math.round(MW * fx), Math.round(MH * fy), 8));
    pts.forEach((p, i) => p && G.objs.push({id: G.nid++, x: p.x, y: p.y, kind: 'shrine', step: i + 1}));
    G.camp.shrine = 0;
  }
  revealAll(); layers = null; hudSig = ''; syncBars();
  dialog(m.start, () => msg('OBJECTIVE: ' + m.goal + (m.limit ? ' (by day ' + m.limit + ')' : '')));
}
const armyValue = a => (a || []).reduce((s, x) => s + x.count * ((UNITS[x.type] || {}).cost || 0), 0);

// ---------- objectives ----------
function campObjText() {
  if (!G || !G.camp) return '';
  const m = MIS(G.camp.id), lim = m.limit ? ' · DAY ' + G.day + '/' + m.limit : ' · DAY ' + G.day;
  let p = '';
  if (m.obj === 'economy') { const t = G.towns.find(t => t.owner === 'player'); p = ' · GOLD ' + G.res.player.gold + '/' + m.gold + ' · DW VII ' + (t && t.built.includes('dw7') ? '✔' : '✘'); }
  if (m.obj === 'escort') { const e = heroById(G.camp.escort); p = e ? ' · ELOWEN ALIVE' : ''; }
  if (m.obj === 'capture') p = ' · ENEMY TOWNS ' + G.towns.filter(t => t.owner === 'ai').length;
  if (m.mythic) p += ' · SHRINES ' + (G.camp.shrine || 0) + '/3' + (G.camp.mythicGot ? ' ✦' : '');
  return 'M' + m.id + ': ' + m.goal.toUpperCase() + p + lim + ' | LOSE: ' + (m.obj === 'escort' ? 'Elowen dies, ' : '') + (m.limit ? 'day ' + (m.limit + 1) + ', ' : '') + 'all heroes & towns lost';
}
function campEval() {
  const m = MIS(G.camp.id), own = o => G.towns.some(t => t.owner === o), heroes = o => G.heroes.some(h => h.owner === o);
  if (!own('player') && !heroes('player')) return 'lose';
  if (m.obj === 'escort' && !heroById(G.camp.escort)) return 'lose';
  if (m.obj === 'capture' && !own('ai')) return 'win';
  if (m.obj === 'hero' && !G.heroes.some(h => h.id === G.camp.target)) return 'win';
  if (m.obj === 'escort' && G.camp.escorted) return 'win';
  if (m.obj === 'economy') { const t = G.towns.find(t => t.owner === 'player'); if (G.res.player.gold >= m.gold && t && t.built.includes('dw7')) return 'win'; }
  if (m.limit && G.day > m.limit) return 'lose';
  return null;
}
const _checkEnd = checkEnd;
checkEnd = function () {
  if (!G || !G.camp) return _checkEnd();
  if (G.over) return true;
  const r = campEval(); if (!r) return false;
  campFinish(r); return true;
};
function campStars() {
  const m = MIS(G.camp.id), me = G.heroes.filter(h => h.owner === 'player'), now = me.reduce((s, h) => s + armyValue(h.army), 0);
  const lossRate = G.camp.lost / Math.max(1, G.camp.lost + now);
  return {stars: 1 + (G.day <= m.par ? 1 : 0) + (lossRate < 0.25 ? 1 : 0), lossRate, day: G.day};
}
function campFinish(r) {
  G.over = r; UI.mode = 'over'; UI.walk = null; UI.ai = null; const m = MIS(G.camp.id);
  r === 'win' ? SFX.win() : SFX.lose();
  if (r === 'lose') { showPanel(() => `<h2 style="color:var(--red)">MISSION FAILED</h2><p>${m.name}: ${m.goal} was not achieved.</p><div class="bar">${btn('RETRY', 'cpick', m.id, 'y')}${btn('CAMPAIGN', 'campaign', '', 'alt')}</div>`, {sticky: true}); return; }
  const s = campStars(), c = CP(); c.stars[m.id] = Math.max(c.stars[m.id] || 0, s.stars); c.unlocked = Math.max(c.unlocked, Math.min(MISSIONS.length, m.id + 1)); if (m.id === MISSIONS.length) c.done = true; saveCP(c);
  G.camp.result = s;
  const h = G.heroes.find(x => x.owner === 'player' && x.id !== G.camp.escort) || G.heroes.find(x => x.owner === 'player');
  UI.keep = Object.keys(h.sk).slice(0, 3); UI.keepHero = h;
  dialog(m.end, () => openCarry());
}
function openCarry() {
  const h = UI.keepHero, m = MIS(G.camp.id), s = G.camp.result, best = h.arts.slice().sort((a, b) => ARTIFACTS[b].val - ARTIFACTS[a].val)[0];
  showPanel(() => `<h2 style="color:var(--green)">MISSION COMPLETE ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)}</h2>
    <p>Day ${s.day} (par ${m.par}) · losses ${Math.round(s.lossRate * 100)}% (under 25% = star)</p>
    <h3>${h.name} CARRIES OVER</h3><p>Level ${h.lvl}, stats and the best artifact${best ? ' (<b>' + ARTIFACTS[best].name + '</b>)' : ''}. The army does not. Keep up to 3 skills:</p>
    <div class="bar">${Object.keys(h.sk).map(k => btn((UI.keep.includes(k) ? '✔ ' : '') + SKILLS[k].name, 'ckeep', k, UI.keep.includes(k) ? 'g' : 'alt')).join('') || 'No skills yet.'}</div>
    <div class="bar" style="margin-top:8px">${m.id < MISSIONS.length ? btn('NEXT MISSION', 'cnext', m.id + 1, 'y') : ''}${btn('CAMPAIGN MENU', 'cdone', '', 'alt')}</div>`, {sticky: true});
}
function saveCarry() {
  const h = UI.keepHero, c = CP(), best = h.arts.slice().sort((a, b) => ARTIFACTS[b].val - ARTIFACTS[a].val)[0], sk = {};
  UI.keep.forEach(k => sk[k] = h.sk[k]);
  c.carry = {name: h.name, lvl: h.lvl, xp: h.xp, att: h.att, def: h.def, sp: h.sp, kn: h.kn, sk, art: best || null}; saveCP(c);
}

// ---------- wraps: day limit, losses, diplomacy, quest objects ----------
const _newDay = newDay;
newDay = function () { _newDay(); if (G && G.camp && !G.over) checkEnd(); };
const _finishFight = finishFight;
finishFight = function (ctx, attWon, xpA, xpD) {
  if (G && G.camp && ctx.snap) for (const side of ['att', 'def']) if (ctx[side].owner === 'player') G.camp.lost += Math.max(0, armyValue(ctx.snap[side]) - armyValue(ctx[side].arrs.flat()));
  return _finishFight(ctx, attWon, xpA, xpD);
};
const _fight = fight;
fight = function (h, target, after) {
  if (G && G.camp && h.owner === 'player' && target.monster && !target.monster.dipl) {
    const r = armyPower(h.army, h) / Math.max(1, armyPower(target.monster.army)), o = target.monster, s = o.army[0];
    const rolled = ((o.id * 7919 + G.day) % 100) / 100; // deterministic per monster+day
    if (r >= 4 && rolled < 0.6 && h.army.length < MAX_STACKS) { UI.dip = {h, o, after, join: true}; showPanel(() => `<h2>DIPLOMACY</h2><p>The ${s.count} ${s.type} are awed by your army and offer to <b class="hl">JOIN</b> you for free.</p><div class="bar">${btn('ACCEPT', 'dipyes', '', 'g')}${btn('FIGHT', 'dipfight', '', 'alt')}</div>`, {sticky: true}); return; }
    if (r >= 2.5) { UI.dip = {h, o, after, join: false}; showPanel(() => `<h2>DIPLOMACY</h2><p>The ${s.count} ${s.type} fear you and offer to <b class="hl">FLEE</b>.</p><div class="bar">${btn('LET THEM GO', 'dipyes', '', 'g')}${btn('FIGHT', 'dipfight', '', 'alt')}</div>`, {sticky: true}); return; }
  }
  return _fight(h, target, after);
};
function dipResolve(accept) {
  const d = UI.dip; UI.dip = null; UI.panel = null; $('panel').classList.remove('show'); if (!d) return;
  if (!accept) { d.o.dipl = 1; _fight(d.h, {monster: d.o}, d.after); return; }
  if (d.join) addUnits(d.h.army, d.o.army[0].type, d.o.army[0].count);
  G.objs.splice(G.objs.indexOf(d.o), 1); msg(d.join ? 'The ' + d.o.army[0].type + ' joined your army!' : 'The monsters fled.'); SFX.pick();
  if (d.after) d.after();
}
const _take = take;
take = function (h, o) {
  if (o.kind === 'haven') { if (h.id === G.camp.escort) { G.camp.escorted = 1; celebrate('art', 'ELOWEN IS SAFE!', 'Escort complete'); checkEnd(); } else if (h.owner === 'player') msg('Only Elowen needs the haven.'); return; }
  if (o.kind === 'shrine') {
    if (h.owner !== 'player') return;
    if (o.step !== (G.camp.shrine || 0) + 1) { msg('The shrine is silent. Shrine ' + ((G.camp.shrine || 0) + 1) + ' must be woken first.'); return; }
    G.camp.shrine = o.step; G.objs.splice(G.objs.indexOf(o), 1); celebrate('art', 'SHRINE ' + o.step + '/3', o.step < 3 ? 'The seal weakens...' : 'A mythical lair opens near your town!'); SFX.lvl();
    if (o.step === 3) { const t = G.towns.find(t => t.owner === 'player') || h, s = campSpot(t.x + 2, t.y + 1, 8); if (s) G.objs.push({id: G.nid++, x: s.x, y: s.y, kind: 'lair'}); }
    return;
  }
  if (o.kind === 'lair') {
    if (h.owner !== 'player' || G.camp.mythicGot) return;
    const f = facOf('player') || h.fac, u = MYTHIC[f] || MYTHIC.castle;
    if (h.army.length >= MAX_STACKS && !h.army.some(a => a.type === u)) { msg('Free an army slot to take the mythical creature.'); return; }
    addUnits(h.army, u, 1); G.camp.mythicGot = 1; G.objs.splice(G.objs.indexOf(o), 1); celebrate('art', u.toUpperCase() + '!', 'Tier VIII mythical creature joins you'); SFX.win(); return;
  }
  return _take(h, o);
};
const _drawObj = drawObj;
drawObj = function (g, o) {
  if (o.kind === 'haven' || o.kind === 'shrine' || o.kind === 'lair') {
    const X = o.x * TS, Y = o.y * TS, k = Math.sin(clock * 4 + o.id) * 0.5 + 0.5, col = o.kind === 'haven' ? '#58f8f8' : o.kind === 'lair' ? '#fcfc54' : '#d858f8';
    g.fillStyle = '#000'; g.fillRect(X + 2, Y + 10, 12, 5); g.fillStyle = '#6a6a7a'; g.fillRect(X + 3, Y + 11, 10, 3);
    if (o.kind === 'shrine') { g.fillStyle = '#000'; g.fillRect(X + 5, Y - 2, 6, 13); g.fillStyle = '#9c9cac'; g.fillRect(X + 6, Y - 1, 4, 11); g.fillStyle = col; g.fillRect(X + 7, Y + 1, 2, 2); txtTiny(g, String(o.step), X + 8, Y + 9); }
    else { g.globalAlpha = 0.5 + 0.5 * k; g.fillStyle = col; g.fillRect(X + 4, Y - 4 + Math.round(k * 2), 8, 14); g.fillStyle = '#fcfcfc'; g.fillRect(X + 7, Y - 2, 2, 10); g.globalAlpha = 1; }
    return;
  }
  return _drawObj(g, o);
};
function txtTiny(g, s, x, y) { g.fillStyle = '#000'; g.font = '6px monospace'; g.textAlign = 'center'; g.fillText(s, x, y); }
const _tipFor = tipFor;
tipFor = function (x, y) {
  const o = objAt(x, y);
  if (o && o.kind === 'haven') return {title: 'Haven', lines: ['Bring Elowen here to win']};
  if (o && o.kind === 'shrine') return {title: 'Shrine ' + o.step + ' of 3', lines: ['Visit the shrines in order', 'to call a mythical creature']};
  if (o && o.kind === 'lair') return {title: 'Mythical Lair', lines: ['A tier VIII creature waits here (one per player)']};
  return _tipFor(x, y);
};

// ---------- 8-bit dialog boxes ----------
function dialog(lines, done) {
  const el = $('dlg'); let i = 0;
  const show = () => { if (i >= lines.length) { el.style.display = 'none'; UI.dlg = null; done && done(); return; } const l = lines[i]; el.querySelector('b').textContent = l.who; el.querySelector('p').textContent = l.t; el.querySelector('i').textContent = (i + 1) + '/' + lines.length; };
  UI.dlg = {next: () => { i++; show(); }, skip: () => { i = lines.length; show(); }};
  el.style.display = 'flex'; show();
}

// ---------- actions + HUD ----------
Object.assign(ACTIONS, {
  campaign: () => openCampaign(), cpick: v => openBonus(+v), chard: () => { const c = CP(); c.hard = !c.hard; saveCP(c); refreshPanel(); },
  creset: () => { localStorage.removeItem(CAMP_KEY); refreshPanel(); },
  cstart: v => { const [id, b] = v.split(':'); startMission(+id, b); },
  ckeep: k => { const i = UI.keep.indexOf(k); if (i >= 0) UI.keep.splice(i, 1); else if (UI.keep.length < 3) UI.keep.push(k); refreshPanel(); },
  cnext: v => { saveCarry(); openBonus(+v); }, cdone: () => { saveCarry(); openCampaign(); },
  dipyes: () => dipResolve(true), dipfight: () => dipResolve(false),
  dnext: () => UI.dlg && UI.dlg.next(), dskip: () => UI.dlg && UI.dlg.skip(),
});
setInterval(() => {
  const el = $('obj'); if (!el) return;
  const show = G && G.camp && (UI.mode === 'map' || UI.mode === 'aiturn' || UI.mode === 'over');
  el.style.display = show ? 'block' : 'none'; if (show) { const t = campObjText(); if (el.textContent !== t) el.textContent = t; }
  if (G && G.camp && !G.over && UI.mode === 'map' && !UI.panel && !B) checkEnd();
}, 400);
window.CMP = {MISSIONS, MYTHIC, CP, saveCP, startMission, campEval, campObjText, campStars, openCampaign, openCarry, saveCarry, dialog, get UI() { return UI; }}; // test hook
