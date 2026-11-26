// Blackhole Throne: ship design compiler + 6-round battle simulation (pure, no DOM).
(function (root, f) { const D = typeof require === 'function' ? require('./data.js') : root.NTData; const m = f(D); if (typeof module === 'object' && module.exports) module.exports = m; else root.NTBattle = m; })(typeof self !== 'undefined' ? self : this, function (D) {
const RANGE_ROUND = { long: 1, med: 2, short: 3, any: 1 };

// Validate a design ({name,hull,mods}) and compile it into a flat stat block. Returns {ok,err,s}.
function compile(des, research, npc) {
  const h = D.HULLS[des.hull];
  if (!h) return { ok: false, err: 'Unknown hull' };
  if (!npc && h.npc) return { ok: false, err: 'Hull not buildable' };
  if (!npc && h.req && !(research && research[h.req])) return { ok: false, err: h.name + ' needs research' };
  const mods = des.mods || [];
  if (mods.length > h.slots) return { ok: false, err: 'Too many modules (' + h.slots + ' slots)' };
  const sm = D.SIZE_MULT[h.size];
  const s = { name: des.name || h.name, hull: des.hull, size: h.size, cmd: h.cmd, hp: h.hp, armor: 0, shield: 0, regen: .25,
    ev: h.ev, acc: 0, spd: h.spd, sensor: 20, pd: 0, taunt: 0, power: h.pow, used: 0, weapons: [],
    escort: !!h.escort, aura: !!h.aura, civ: h.civ || null, cost: Object.assign({}, h.cost), time: h.time };
  let spdMul = 1;
  for (const id of mods) {
    const m = D.MODS[id];
    if (!m) return { ok: false, err: 'Unknown module ' + id };
    if (!npc && m.req && !(research && research[m.req])) return { ok: false, err: m.name + ' needs research' };
    if (m.bays && !h.bays && !npc) return { ok: false, err: 'Fighter Bays need a Carrier hull' };
    if (m.minSize && h.size < m.minSize && !npc) return { ok: false, err: m.name + ' needs Cruiser or larger' };
    s.used += m.pow || 0;
    if (m.power) s.power += m.power;
    if (m.kind === 'w') s.weapons.push({ id, name: m.name, dmg: m.dmg, acc: m.acc, range: m.range, vs: m.vs, torp: !!m.torp, fighter: !!m.fighter, big: !!m.big, flak: m.flak || 1, reload: m.reload || 1, shots: m.shots || 1 });
    if (m.shield) s.shield += m.shield * sm;
    if (m.armor) s.armor += m.armor * sm;
    if (m.pd) s.pd += m.pd;
    if (m.taunt) s.taunt += m.taunt;
    if (m.speed) spdMul += m.speed;
    if (m.kind === 'u' && m.ev) s.ev += m.ev;
    if (m.sensor) s.sensor += m.sensor;
    if (m.kind === 'u' && m.acc) s.acc += m.acc;
    for (const r in m.cost) s.cost[r] = (s.cost[r] || 0) + m.cost[r];
  }
  if (!npc && s.used > s.power) return { ok: false, err: 'Not enough power (' + s.used + '/' + s.power + ')' };
  s.spd = +(s.spd * spdMul).toFixed(2);
  s.ev = +s.ev.toFixed(3);
  s.time = Math.round(h.time + mods.length * .5);
  return { ok: true, s };
}

// strength: remaining fraction of effective hp weighted by command points
function strength(ships) { let v = 0; for (const u of ships) if (u.hp > 0) v += u.st.cmd * (u.hp + u.ar) / (u.st.hp + u.st.armor || 1); return v; }

function applyDamage(t, dmg, w, acc) {
  let rem = dmg;
  if (!w.torp && t.sh > 0) { const m = w.vs.shield, eff = rem * m, d = Math.min(t.sh, eff); t.sh -= d; acc.shield += d; rem = (eff - d) / m; }
  if (rem > 0 && t.ar > 0) { const m = w.vs.armor, eff = rem * m, d = Math.min(t.ar, eff); t.ar -= d; acc.armor += d; rem = (eff - d) / m; }
  if (rem > 0) { t.hp -= rem; acc.hull += rem; }
}

function prep(side) {
  const alive = side.ships.filter(u => u.hp > 0);
  const classes = new Set(alive.filter(u => !u.st.civ).map(u => u.st.hull)).size;
  side.formation = classes >= 3;
  side.aura = alive.some(u => u.st.aura);
  for (const u of alive) {
    u.sh = u.st.shield;
    const small = u.st.size <= 2;
    u.accB = u.st.acc + (side.formation ? .1 : 0) + (side.aura && small ? .05 : 0);
    u.evB = u.st.ev * (side.formation ? 1.1 : 1) + (side.aura && small ? .03 : 0);
  }
}

function pick(rand, pool) {
  let tot = 0; for (const t of pool) tot += 1 + t.st.taunt;
  let r = rand() * tot;
  for (const t of pool) { r -= 1 + t.st.taunt; if (r <= 0) return t; }
  return pool[pool.length - 1];
}

// A, B: {name, ships:[{st,hp,ar}], atk (damage mult), warpAt (fraction or 0)}
// Mutates ship hp/ar. Returns {rounds, winner:'A'|'B', lostA, lostB, warped}
function fight(rand, A, B) {
  prep(A); prep(B);
  const s0 = [strength(A.ships), strength(B.ships)];
  const rounds = []; const warped = { A: false, B: false };
  for (let r = 1; r <= 6; r++) {
    const log = { r, sides: [0, 1].map(() => ({ shots: 0, hits: 0, intercepted: 0, dmg: { shield: 0, armor: 0, hull: 0 }, kills: [] })) };
    const snap = [A.ships.filter(u => u.hp > 0), B.ships.filter(u => u.hp > 0)];
    [[A, B, 0], [B, A, 1]].forEach(([att, def, i]) => {
      const L = log.sides[i], shooters = snap[i], defs = snap[1 - i];
      if (!defs.length) return;
      const pdSum = defs.reduce((a, u) => a + u.st.pd, 0), intercept = Math.min(.75, pdSum / defs.length);
      for (const u of shooters) for (const w of u.st.weapons) {
        const first = RANGE_ROUND[w.range];
        if (r < first || (r - first) % w.reload) continue;
        for (let k = 0; k < w.shots; k++) {
          let pool = def.ships.filter(t => t.hp > 0);
          if (!pool.length) return;
          L.shots++;
          if ((w.torp || w.fighter || w.range === 'short') && pool.some(t => t.st.escort)) {
            const screened = pool.filter(t => t.st.size <= 2); if (screened.length) pool = screened;
          }
          const t = pick(rand, pool);
          if ((w.torp || w.fighter) && rand() < intercept * (w.fighter ? .6 : 1)) { L.intercepted++; continue; }
          const track = (w.torp || w.fighter) ? 0 : Math.max(0, u.st.size - t.st.size) * .08 * (w.big ? 1.5 : 1);
          const p = Math.max(.05, Math.min(.95, w.acc + u.accB - t.evB - track));
          if (rand() >= p) continue;
          L.hits++;
          const dmg = w.dmg * (att.atk || 1) * (w.torp ? 1 + .25 * (t.st.size - 1) : 1) * (t.st.size === 1 ? w.flak : 1);
          applyDamage(t, dmg, w, L.dmg);
          if (t.hp <= 0 && !t.dead) { t.dead = true; t.hp = 0; L.kills.push(t.st.name); }
        }
      }
    });
    for (const sd of [A, B]) for (const u of sd.ships) if (u.hp > 0) u.sh = Math.min(u.st.shield, u.sh + u.st.shield * u.st.regen);
    for (const L of log.sides) for (const k in L.dmg) L.dmg[k] = Math.round(L.dmg[k]);
    log.left = [A.ships.filter(u => u.hp > 0).length, B.ships.filter(u => u.hp > 0).length];
    rounds.push(log);
    if (!log.left[0] || !log.left[1]) break;
    if (A.warpAt && strength(A.ships) / s0[0] <= A.warpAt) { warped.A = true; log.note = A.name + ' warped out'; break; }
    if (B.warpAt && strength(B.ships) / s0[1] <= B.warpAt) { warped.B = true; log.note = B.name + ' warped out'; break; }
  }
  const lostA = s0[0] ? 1 - strength(A.ships) / s0[0] : 1, lostB = s0[1] ? 1 - strength(B.ships) / s0[1] : 1;
  const aliveA = A.ships.some(u => u.hp > 0), aliveB = B.ships.some(u => u.hp > 0);
  let winner;
  if (!aliveA && !aliveB) winner = 'B';
  else if (!aliveA || warped.A) winner = 'B';
  else if (!aliveB || warped.B) winner = 'A';
  else winner = lostA > lostB ? 'B' : 'A'; // side that lost more retreats; tie favours attacker? no: defender holds
  if (aliveA && aliveB && !warped.A && !warped.B && lostA === lostB) winner = 'B';
  return { rounds, winner, lostA: +lostA.toFixed(3), lostB: +lostB.toFixed(3), warped, formation: [A.formation, B.formation] };
}
return { compile, fight, strength };
});
