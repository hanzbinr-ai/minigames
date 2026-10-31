// Mini Heroes - static data tables. Edit numbers here to rebalance.
'use strict';
const RES = ['gold', 'wood', 'ore', 'gems'];
const RES_COL = {gold: '#f8b800', wood: '#a0522d', ore: '#9c9c9c', gems: '#d858f8'};

// ---------- Units: 6 factions x 7 tiers x (base + upgraded). Stats come from a tier template so value ~ cost. ----------
// ab = abilities (see ABIL). Neutral-only: Wolf, Troll (Goblin doubles as Stronghold tier 1).
const TIER_T = [ // att def hp dmg move cost growth
  [4, 3, 6, [1, 3], 3, 50, 14], [6, 6, 14, [2, 4], 3, 130, 9], [8, 6, 18, [3, 6], 3, 220, 7], [10, 9, 30, [6, 10], 4, 400, 5],
  [13, 12, 50, [10, 15], 4, 750, 3], [16, 15, 85, [15, 24], 4, 1350, 2], [20, 20, 170, [28, 42], 5, 2900, 1]];
const UNITS = {};
// [faction, tier, base, upgraded, base abilities, extra upgraded abilities, mods {att,def,hp,dmg,move,range,cost}, colour]
const UNIT_DEFS = [
  ['castle', 0, 'Peasant', 'Militia', ['Swarm'], ['Brace'], {}, '#c8a060'],
  ['castle', 1, 'Pikeman', 'Halberdier', ['Brace'], ['Cleave'], {def: 2}, '#9cb8e8'],
  ['castle', 2, 'Crossbowman', 'Arbalester', [], ['Shred'], {range: 6, def: -1}, '#58d854'],
  ['castle', 3, 'Griffin', 'Royal Griffin', ['Fly'], ['NoRetal'], {move: 2, hp: 0.9}, '#e8c050'],
  ['castle', 4, 'Swordsman', 'Crusader', ['Cleave'], ['Double'], {def: 2, move: -1}, '#3cbcfc'],
  ['castle', 5, 'Monk', 'Zealot', ['Heal'], ['Holy'], {range: 6, hp: 0.8}, '#fcfcfc'],
  ['castle', 6, 'Paladin', 'Champion', ['Charge', 'Holy'], ['Tough'], {move: 1}, '#f8b800'],
  ['necro', 0, 'Skeleton', 'Skeleton Warrior', ['Undead'], ['ShieldW'], {def: 1}, '#e0e0e0'],
  ['necro', 1, 'Zombie', 'Plague Zombie', ['Undead', 'Tough'], ['Plague'], {hp: 1.3, move: -1, att: -1}, '#7ca050'],
  ['necro', 2, 'Ghost', 'Spectre', ['Undead', 'Ethereal', 'Fly'], ['ManaSteal'], {move: 1, hp: 0.8}, '#a8a8fc'],
  ['necro', 3, 'Vampire', 'Vampire Lord', ['Undead', 'Fly', 'Drain'], ['NoRetal'], {move: 1}, '#a00030'],
  ['necro', 4, 'Lich', 'Archlich', ['Undead', 'Splash'], ['Fear'], {range: 6, hp: 0.8}, '#d858f8'],
  ['necro', 5, 'Wraith Knight', 'Dread Knight', ['Undead', 'Charge', 'Fear'], ['Cleave'], {move: 1}, '#e40058'],
  ['necro', 6, 'Bone Dragon', 'Ghost Dragon', ['Undead', 'Fly', 'Fear'], ['Ethereal'], {move: 1, att: -2, hp: 0.9}, '#d8d8c0'],
  ['sylvan', 0, 'Sprite', 'Faerie', ['Fly', 'NoRetal'], ['Blind'], {move: 2, hp: 0.6, def: -1}, '#a8f8a8'],
  ['sylvan', 1, 'Wolf Rider', 'Moon Rider', ['Charge'], ['Double'], {move: 2, def: -1}, '#8c8c9c'],
  ['sylvan', 2, 'Elf Archer', 'Grand Elf', ['Double'], ['Shred'], {range: 7, dmg: 0.6, hp: 0.8}, '#38b848'],
  ['sylvan', 3, 'Druid', 'Elder Druid', ['Heal'], ['ManaSteal'], {range: 6}, '#c8a878'],
  ['sylvan', 4, 'Unicorn', 'Silver Unicorn', ['Blind'], ['Tough'], {move: 1}, '#f0f0ff'],
  ['sylvan', 5, 'Treant', 'Ancient Treant', ['Tough', 'Regen'], ['Brace'], {move: -2, hp: 1.3, def: 4}, '#6c8c3c'],
  ['sylvan', 6, 'Green Dragon', 'Emerald Dragon', ['Fly', 'SpellImm'], ['Splash'], {move: 1}, '#20c040'],
  ['inferno', 0, 'Imp', 'Familiar', ['ManaSteal'], ['Swarm'], {move: 1, def: -1}, '#e05030'],
  ['inferno', 1, 'Hell Hound', 'Cerberus', ['Charge'], ['Double'], {move: 2, def: -1}, '#a03018'],
  ['inferno', 2, 'Succubus', 'Temptress', [], ['Plague'], {range: 6}, '#fc74b4'],
  ['inferno', 3, 'Demon', 'Horned Demon', ['Tough'], ['Cleave'], {hp: 1.1}, '#c02010'],
  ['inferno', 4, 'Efreet', 'Efreet Sultan', ['Fly', 'FireShield'], ['Double'], {move: 2}, '#fc9838'],
  ['inferno', 5, 'Pit Fiend', 'Pit Lord', ['Splash'], ['Fear'], {}, '#801010'],
  ['inferno', 6, 'Devil', 'Arch Devil', ['Teleport', 'NoRetal'], ['Fear'], {hp: 0.9}, '#e40030'],
  ['stronghold', 0, 'Goblin', 'Hobgoblin', ['Swarm'], ['Rage'], {cost: 0.8, def: -1, dmg: 1.1}, '#80c020'],
  ['stronghold', 1, 'Wolf Raider', 'Warg Raider', ['Charge'], ['Double'], {cost: 0.85, move: 2, def: -2, dmg: 1.15}, '#9c8c7c'],
  ['stronghold', 2, 'Orc Axeman', 'Orc Chieftain', ['Rage'], ['Cleave'], {cost: 0.85, def: -2, dmg: 1.2}, '#5c9c3c'],
  ['stronghold', 3, 'Ogre Shaman', 'Ogre Magi', ['Bloodlust'], ['Tough'], {cost: 0.85, def: -2, hp: 1.2}, '#c09060'],
  ['stronghold', 4, 'Roc', 'Thunderbird', ['Fly'], ['Splash'], {cost: 0.85, move: 2, def: -3, dmg: 1.15}, '#a06030'],
  ['stronghold', 5, 'Cyclops', 'Cyclops King', ['RockThrow'], ['Splash'], {cost: 0.85, range: 5, def: -3, dmg: 1.15}, '#c8a080'],
  ['stronghold', 6, 'Behemoth', 'Ancient Behemoth', ['Shred'], ['Cleave'], {cost: 0.85, def: -4, dmg: 1.25}, '#8c6c4c'],
  ['dwarf', 0, 'Miner', 'Foreman', ['Tough'], ['Swarm'], {move: -1, def: 2}, '#c08040'],
  ['dwarf', 1, 'Shieldbearer', 'Shieldguard', ['ShieldW', 'Brace'], ['Rune'], {move: -1, def: 4, dmg: 0.85}, '#a0a0b8'],
  ['dwarf', 2, 'Crossbow Engineer', 'Siege Engineer', ['ShieldW'], ['RockThrow'], {range: 6, move: -1, def: 2}, '#d0a050'],
  ['dwarf', 3, 'Runesmith', 'Runelord', ['Rune'], ['SpellImm'], {move: -1, def: 3}, '#58c8f8'],
  ['dwarf', 4, 'Bear Rider', 'Bear Lord', ['Charge', 'Tough'], ['Cleave'], {def: 2}, '#7c5030'],
  ['dwarf', 5, 'Steam Golem', 'Iron Golem', ['Machine', 'Tough'], ['SpellImm'], {move: -1, def: 4, hp: 1.1}, '#9c9cac'],
  ['dwarf', 6, 'Iron Dreadnought', 'Thunder Dreadnought', ['Machine', 'Splash'], ['Tough'], {range: 6, move: -2, def: 3}, '#606878'],
];
const FACTION_UNITS = {};
for (const [fac, tier, base, up, ab, ab2, m, col] of UNIT_DEFS) {
  const [att, def, hp, dmg, move, cost, growth] = TIER_T[tier];
  const mk = (name, isUp) => {
    const k = isUp ? 1 : 0, dm = (m.dmg || 1) * (1 + 0.2 * k);
    UNITS[name] = {fac, tier, up: isUp, base, upName: up, att: att + (m.att || 0) + 2 * k, def: Math.max(0, def + (m.def || 0) + 2 * k), hp: Math.round(hp * (m.hp || 1) * (1 + 0.2 * k)),
      dmg: [Math.max(1, Math.round(dmg[0] * dm)), Math.max(1, Math.round(dmg[1] * dm))], move: Math.max(1, move + (m.move || 0) + (isUp && tier % 2 ? 1 : 0)), range: m.range ? m.range + k : 0,
      ab: isUp ? [...ab, ...ab2] : ab.slice(), cost: Math.round(cost * (m.cost || 1) * (isUp ? 1.35 : 1) / 5) * 5, growth, col};
  };
  mk(base, false); mk(up, true);
  (FACTION_UNITS[fac] = FACTION_UNITS[fac] || [])[tier] = base;
}
UNITS.Wolf = {fac: null, tier: 1, att: 6, def: 4, hp: 10, dmg: [2, 5], move: 4, range: 0, ab: ['Swarm'], cost: 80, growth: 0, col: '#a0a0a0'};
UNITS.Troll = {fac: null, tier: 4, att: 14, def: 7, hp: 40, dmg: [10, 15], move: 4, range: 0, ab: ['Regen'], cost: 500, growth: 0, col: '#50a050'};
const ABIL = {
  Swarm: '+15% dmg per extra ally next to target', Cleave: '25% chance x1.3 dmg', Undead: 'Immune to Slow, Fear and Blind; no morale', Tough: 'Takes 15% less dmg',
  Regen: 'Heals top creature each round', Charge: '+10% dmg per tile moved this round', Fly: 'Flies over units, rocks and swamp', Double: 'Strikes twice', Triple: 'Shoots three times',
  NoRetal: 'Enemy cannot strike back', Drain: 'Heals 25% of damage dealt', Fear: 'Adjacent enemies 15% cower (skip attack)', Heal: 'End of round heals adjacent allies',
  Holy: '+10% morale chance for the whole side', Blind: 'Adjacent enemies miss 20%', SpellImm: 'Immune to enemy spells', Splash: 'Also hits enemies next to the target for 50%',
  Teleport: 'Attacks anywhere: jumps next to its target', ManaSteal: 'Steals 2 enemy mana each round', FireShield: 'Melee attackers take 20% back as fire',
  Rage: '+8% dmg each round (max +40%)', Bloodlust: 'Adjacent allies +15% melee dmg', RockThrow: 'Ignores walls; 35% chance to crack the wall it shoots over',
  Shred: 'Each hit: target -3 defense for the battle (max -9)', Machine: 'Immune to Fear, Blind and Drain heal; no morale', ShieldW: 'Takes 30% less from shots',
  Ethereal: '30% chance to ignore a melee hit', Brace: 'Immune to Charge bonus; +20% dmg vs flyers', Plague: 'Each hit: target -2 attack (max -4)', Rune: 'Adjacent allies +3 defense', Ranged: 'Shoots; half dmg if blocked or far',
};
const SKILL_DESC = ABIL;
const abText = u => (u.range ? ['Ranged'] : []).concat(u.ab).map(k => k).join(', ') || 'none';

// Factions: research rule (rp), palette for towns, hero specialty, names.
const FACTIONS = {
  castle:     {name: 'Castle',     col: '#3cbcfc', town: 'Castlegate', heroes: ['Roland', 'Lyra'],   spec: {k: 'bastion', name: 'Bastion', desc: 'All stacks +1 defense'},
    pal: {wall: '#c8c8c8', roof: '#c84c0c', sky: [60, 120, 220], ground: '#3c9c3c', emb: '#f8b800'}, rp: 'Decisive victories: win 1, +1 no losses, +1 vs stronger army, +1 big battle (max 3 per battle)'},
  necro:      {name: 'Necropolis', col: '#e40058', town: 'Bonehold',   heroes: ['Sandro', 'Vidomina'], spec: {k: 'necromancer', name: 'Necromancer', desc: 'Raises 8% of enemy HP killed as Skeletons'},
    pal: {wall: '#6c6c7c', roof: '#4c2c5c', sky: [40, 20, 60], ground: '#3c4c3c', emb: '#e8e8d0'}, rp: 'Death: every creature that dies in your battles (both sides, weighted by tier)'},
  sylvan:     {name: 'Sylvan',     col: '#58d854', town: 'Elderglade', heroes: ['Sylva', 'Alaron'],  spec: {k: 'ranger', name: 'Ranger', desc: 'Shooters +1 range'},
    pal: {wall: '#a8b878', roof: '#2c7a2c', sky: [80, 150, 200], ground: '#2d7a2d', emb: '#58f898'}, rp: 'Nature: days ending next to a forest, Sacred Groves you own, flawless wins'},
  inferno:    {name: 'Inferno',    col: '#fc7430', town: 'Ashspire',   heroes: ['Xeron', 'Calid'],   spec: {k: 'pyre', name: 'Pyromancer', desc: 'Damage spells +25%'},
    pal: {wall: '#5c3030', roof: '#a01808', sky: [90, 20, 10], ground: '#4c2c1c', emb: '#fc9838'}, rp: 'Corruption: sacrifice at the Sacrificial Pit, raze enemy mines and towns you capture'},
  stronghold: {name: 'Stronghold', col: '#c8a040', town: 'Gorkamp',    heroes: ['Tarnum', 'Crag'],   spec: {k: 'warchief', name: 'Warchief', desc: 'All stacks +1 attack'},
    pal: {wall: '#8c6c4c', roof: '#5c3c1c', sky: [180, 120, 60], ground: '#8c7a3c', emb: '#e40058'}, rp: 'Trophies: enemy creatures you kill (higher tier = more), x1.5 for underdog wins'},
  dwarf:      {name: 'Dwarf',      col: '#d0a050', town: 'Ironhold',   heroes: ['Gareth', 'Mira'],   spec: {k: 'banker', name: 'Banker', desc: '+250 gold per day'},
    pal: {wall: '#7c7468', roof: '#3c4c6c', sky: [70, 80, 110], ground: '#6c6c5c', emb: '#58c8f8'}, rp: 'Savings: gold + resources banked at the end of each day (more = better, with diminishing returns)'},
};
for (const f in FACTIONS) FACTIONS[f].units = FACTION_UNITS[f];
const FACTION_KEYS = Object.keys(FACTIONS);

// Building tree. dw1..dw7 creature dwellings, up1..up7 upgrade them. pit = Inferno only.
const BUILDINGS = {
  fort:    {name: 'Fort',          cost: {gold: 1000, wood: 5, ore: 5},           req: [],                 desc: 'Defenders get +3 defense'},
  tavern:  {name: 'Tavern',        cost: {gold: 500, wood: 5},                    req: [],                 desc: 'Hire a 2nd hero (2500 gold)'},
  hall:    {name: 'Town Hall',     cost: {gold: 2500},                            req: ['tavern'],         desc: '+500 gold per day'},
  capitol: {name: 'Capitol',       cost: {gold: 5000, wood: 5, ore: 5, gems: 2}, req: ['hall'],         desc: '+500 more gold per day, +1 kingdom policy slot'},
  market:  {name: 'Marketplace',   cost: {gold: 500, wood: 5},                    req: [],                 desc: 'Trade resources'},
  citadel: {name: 'Citadel',       cost: {gold: 2500, ore: 5},                    req: ['fort'],           desc: '+50% creature growth'},
  guild1:  {name: 'Mage Guild 1',  cost: {gold: 2000, wood: 5, ore: 5},           req: [],                 desc: 'Teaches level 1 spells'},
  guild2:  {name: 'Mage Guild 2',  cost: {gold: 1000, wood: 4, ore: 4, gems: 4},  req: ['guild1'],         desc: 'Teaches level 2 spells'},
  pit:     {name: 'Sacrificial Pit', cost: {gold: 1000, ore: 5},                  req: [], faction: 'inferno', desc: 'Sacrifice troops, resources or hero experience for research'},
  dw1: {name: 'Dwelling I',   cost: {gold: 300},                              req: [],                  tier: 0},
  dw2: {name: 'Dwelling II',  cost: {gold: 800, ore: 5},                      req: ['dw1'],             tier: 1},
  dw3: {name: 'Dwelling III', cost: {gold: 1200, wood: 5, ore: 5},            req: ['dw2', 'fort'],     tier: 2},
  dw4: {name: 'Dwelling IV',  cost: {gold: 1800, wood: 5, ore: 5, gems: 1},   req: ['dw3'],             tier: 3},
  dw5: {name: 'Dwelling V',   cost: {gold: 2500, wood: 5, ore: 8, gems: 2},   req: ['dw4', 'guild1'],   tier: 4},
  dw6: {name: 'Dwelling VI',  cost: {gold: 3500, wood: 8, ore: 8, gems: 4},   req: ['dw5', 'citadel'],  tier: 5},
  dw7: {name: 'Dwelling VII', cost: {gold: 6000, wood: 10, ore: 10, gems: 8}, req: ['dw6', 'hall'],     tier: 6},
};
for (let i = 1; i <= 7; i++) BUILDINGS['up' + i] = {name: 'Upgrade ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i - 1], cost: {gold: 400 + i * 500, wood: 2 + i, ore: 2 + i, gems: i > 3 ? i - 3 : 0}, req: ['dw' + i], upTier: i - 1};
const AI_BUILD_ORDER = ['dw2', 'tavern', 'fort', 'dw3', 'up1', 'hall', 'dw4', 'guild1', 'up2', 'pit', 'dw5', 'citadel', 'up3', 'capitol', 'dw6', 'up4', 'guild2', 'up5', 'dw7', 'up6', 'up7', 'market'];

// Spells are cast in the PLAN phase and take effect first in the RESOLVE phase.
const SPELLS = {
  arrow:     {name: 'Magic Arrow',    lvl: 1, mana: 5,  target: 'enemy', desc: '10 + 10xSP damage'},
  cure:      {name: 'Cure',           lvl: 1, mana: 6,  target: 'ally',  desc: 'Heal 10 + 5xSP hp'},
  haste:     {name: 'Haste',          lvl: 1, mana: 6,  target: 'ally',  desc: '+2 move this round'},
  lightning: {name: 'Lightning Bolt', lvl: 2, mana: 10, target: 'enemy', desc: '10 + 25xSP damage'},
  slow:      {name: 'Slow',           lvl: 2, mana: 6,  target: 'enemy', desc: 'Move 1 this round'},
};

const ARTIFACTS = {
  sword:  {name: 'Sword of Valor',  stat: 'att', val: 2},
  shield: {name: 'Shield of Oak',   stat: 'def', val: 2},
  orb:    {name: 'Orb of Sparks',   stat: 'sp',  val: 2},
  tome:   {name: 'Tome of Lore',    stat: 'kn',  val: 2},
  boots:  {name: 'Boots of Speed',  stat: 'mp',  val: 6},
};

const MINES = {
  gold: {name: 'Gold Mine', res: 'gold', amt: 1000},
  wood: {name: 'Sawmill',   res: 'wood', amt: 2},
  ore:  {name: 'Ore Pit',   res: 'ore',  amt: 2},
  gems: {name: 'Gem Mine',  res: 'gems', amt: 1},
};

// terrain: cost = movement points per straight step (diagonal x1.5), 0 = blocked
const TERRAIN = [
  {name: 'Grass', cost: 2, col: '#2d7a2d', dot: '#3c9c3c'},
  {name: 'Rough', cost: 3, col: '#8c7a3c', dot: '#a8945a'},
  {name: 'Trees', cost: 0, col: '#1e5a1e', dot: '#0d3a0d'},
  {name: 'Rocks', cost: 0, col: '#6a6a6a', dot: '#4a4a4a'},
  {name: 'Water', cost: 0, col: '#2050c0', dot: '#3c78e0'},
];

const HERO_NAMES = ['Roland', 'Lyra', 'Gareth', 'Sylva', 'Tarnum', 'Mira'];
const AI_NAMES = ['Sandro', 'Vidomina', 'Thant', 'Moandor'];
const ALL_HERO_NAMES = [...new Set(Object.values(FACTIONS).flatMap(f => f.heroes).concat(HERO_NAMES, AI_NAMES, ['Thant', 'Moandor', 'Elysia', 'Brann', 'Korg', 'Nyx']))];
const BASE_MP = 20, BASE_INCOME = 500, HIRE_COST = 2500, MAX_STACKS = 7;
const xpForLevel = l => 250 * l * (l + 1); // xp needed to reach level l+1

// Secondary skills: level 1..3 = Basic / Advanced / Expert. v = value per level.
const SKILL_LVL = ['', 'Basic', 'Advanced', 'Expert'];
const MAX_SKILLS = 8;
const SKILLS = {
  logistics:   {name: 'Logistics',   v: [0, 10, 20, 30],   desc: v => '+' + v + '% movement points'},
  pathfinding: {name: 'Pathfinding', v: [0, 1, 2, 3],      desc: v => 'Rough terrain penalty -' + Math.round(v * 33) + '%'},
  scouting:    {name: 'Scouting',    v: [0, 1, 2, 3],      desc: v => '+' + v + ' sight radius'},
  estates:     {name: 'Estates',     v: [0, 125, 250, 500],desc: v => '+' + v + ' gold per day'},
  wisdom:      {name: 'Wisdom',      v: [0, 20, 40, 60],   desc: v => '+' + v + '% max mana'},
  archery:     {name: 'Archery',     v: [0, 10, 25, 50],   desc: v => '+' + v + '% ranged damage'},
  offense:     {name: 'Offense',     v: [0, 10, 20, 30],   desc: v => '+' + v + '% melee damage'},
  armorer:     {name: 'Armorer',     v: [0, 5, 10, 15],    desc: v => '-' + v + '% damage taken'},
  leadership:  {name: 'Leadership',  v: [0, 10, 20, 30],   desc: v => v + '% chance per stack each RESOLVE: MORALE (+1 move, +20% dmg)'},
  ballistics:  {name: 'Ballistics',  v: [0, 10, 20, 30],   desc: v => 'Catapult +' + v + '% hit chance' + (v >= 30 ? ', fires twice' : '')},
};
const START_SKILLS = {Roland: {leadership: 1, archery: 1}, Lyra: {wisdom: 1, scouting: 1}, Gareth: {offense: 1, armorer: 1}, Sylva: {logistics: 1, pathfinding: 1},
  Tarnum: {offense: 1, ballistics: 1}, Mira: {estates: 1, wisdom: 1}, Sandro: {wisdom: 1, armorer: 1}, Vidomina: {offense: 1, logistics: 1}, Thant: {armorer: 1, leadership: 1}, Moandor: {archery: 1, scouting: 1},
  Alaron: {archery: 1, pathfinding: 1}, Xeron: {offense: 1, wisdom: 1}, Calid: {wisdom: 1, scouting: 1}, Crag: {offense: 1, leadership: 1}};

// Random map setup
const MAP_SIZES = {S: {w: 20, h: 15, name: 'Small'}, M: {w: 28, h: 20, name: 'Medium'}, L: {w: 36, h: 26, name: 'Large'}};
const DIFFICULTY = {
  easy:   {name: 'Easy',   player: {gold: 7500, wood: 15, ore: 15, gems: 4}, ai: {gold: 3000, wood: 5, ore: 5, gems: 0},   grace: 14, attack: 1.6, aiArmy: 0.7, aiIncome: 0.8},
  normal: {name: 'Normal', player: {gold: 5000, wood: 10, ore: 10, gems: 2}, ai: {gold: 5000, wood: 10, ore: 10, gems: 2}, grace: 8,  attack: 1.3, aiArmy: 1,   aiIncome: 1},
  hard:   {name: 'Hard',   player: {gold: 3000, wood: 5, ore: 5, gems: 1},   ai: {gold: 8000, wood: 15, ore: 15, gems: 4}, grace: 4,  attack: 1.1, aiArmy: 1.5, aiIncome: 1.25},
};
// Siege: towers shoot in RESOLVE (attack step), catapult fires with spells (before moves).
const SIEGE = {wallHp: 2, gateHp: 2, citadelBonus: 1, towerDmg: 30, citadelTowerDmg: 45, catapultHit: 0.7};

// Fixed tutorial map (16x12). . grass , rough T trees ^ rocks ~ water
const TUTORIAL_MAP = [
  '..............~~',
  '..............~~',
  '...........T..~~',
  '..TT...,,,.....~',
  '..T....,,,....^^',
  '.......,,.......',
  '~~~.............',
  '~~~~...TT.......',
  '~~~.....T....^..',
  '..............^.',
  '.^^.............',
  '................',
];

// ---------- Pre-battle: tactics, terrain spells, intel, talents (all last the WHOLE battle) ----------
// Doctrines hold 3 tactics each. 'base' tactics are always known, others unlock via talents.
// beats: tactics this one blunts (the blunted tactic gives no bonus for the whole battle).
const DOCTRINES = {offense: {name: 'Offense', col: '#e40058'}, defense: {name: 'Defense', col: '#3cbcfc'}, trickery: {name: 'Trickery', col: '#d858f8'}};
const TACTICS = {
  blitz:      {doc: 'offense',  name: 'Blitz',       base: true, beats: ['sabotage'],   desc: '+1 move and +10% damage for all your stacks'},
  bloodlust:  {doc: 'offense',  name: 'Bloodlust',   beats: ['decoy'],                  desc: '+25% melee damage, but -2 defense'},
  volley:     {doc: 'offense',  name: 'Volley',      beats: ['riposte'],                desc: 'Shooters +30% damage and +1 range'},
  shieldwall: {doc: 'defense',  name: 'Shield Wall', base: true, beats: ['blitz'],      desc: '+3 defense to stacks next to an ally'},
  riposte:    {doc: 'defense',  name: 'Riposte',     beats: ['bloodlust'],              desc: 'Retaliation hits at full damage'},
  entrench:   {doc: 'defense',  name: 'Entrench',    beats: ['ambush'],                 desc: 'Stacks that did not move take -20% damage'},
  ambush:     {doc: 'trickery', name: 'Ambush',      base: true, beats: [],             desc: 'Up to 2 stacks hidden until they act; first strike +50% and no retaliation. Seen through by Intel 2'},
  sabotage:   {doc: 'trickery', name: 'Sabotage',    beats: ['shieldwall'],             desc: 'Enemy stacks -1 move'},
  decoy:      {doc: 'trickery', name: 'Decoys',      beats: ['volley'],                 desc: 'Enemy shooters deal -25% damage'},
};
// Terrain spells: cast in the pre-battle screen, permanent for this battle. cells = shape offsets around the tapped tile.
const TERRAIN_SPELLS = {
  quagmire: {name: 'Quagmire',   mana: 4, cells: [[0, -1], [0, 0], [0, 1]], desc: 'Swamp: entering a tile costs 2 move (both sides)'},
  raise:    {name: 'Raise Earth', mana: 4, cells: [[0, 0]], desc: 'Hill: stack on it +3 defense, shooters +2 range'},
  fog:      {name: 'Fog',        mana: 5, cells: [[-1, -1], [0, -1], [-1, 0], [0, 0], [-1, 1], [0, 1]], desc: 'Your stacks in fog take -50% from enemy shots at range'},
  thorns:   {name: 'Thorns',     mana: 5, cells: [[0, -1], [0, 0], [0, 1]], desc: 'Enemies entering take 12 + 6xSP damage'},
};
const REVEAL = {name: 'Reveal', mana: 3, desc: '+1 Intel for this battle'};
const INTEL_DESC = ['Rough counts only', 'Exact units and counts', 'Exact counts + enemy tactic and terrain spells'];
// Talent tree: 3 branches x 4 tiers + ultimate (tier 5). 1 point per level; a tier needs the one before it.
const TALENTS = {
  offense: [
    {k: 'drill',     name: 'Drill',       desc: 'Unlock Bloodlust tactic', unlock: 'bloodlust'},
    {k: 'momentum',  name: 'Momentum',    desc: 'Blitz: +10% more damage'},
    {k: 'marksmen',  name: 'Marksmen',    desc: 'Unlock Volley tactic', unlock: 'volley'},
    {k: 'brambles',  name: 'Bramble Lore', desc: 'Thorns deal double damage'},
    {k: 'grandblitz', name: 'GRAND BLITZ', ult: true, desc: 'Blitz: +2 move, +25% damage, cannot be blunted'},
  ],
  defense: [
    {k: 'parry',     name: 'Parry Drill', desc: 'Unlock Riposte tactic', unlock: 'riposte'},
    {k: 'bulwark',   name: 'Bulwark',     desc: 'Shield Wall: +2 more defense'},
    {k: 'trenches',  name: 'Trenches',    desc: 'Unlock Entrench tactic', unlock: 'entrench'},
    {k: 'geomancer', name: 'Geomancer',   desc: 'Terrain spells cost 2 less mana'},
    {k: 'phalanx',   name: 'IRON PHALANX', ult: true, desc: 'Shield Wall: all stacks +5 defense, cannot be blunted'},
  ],
  trickery: [
    {k: 'saboteur',  name: 'Saboteur',    desc: 'Unlock Sabotage tactic', unlock: 'sabotage'},
    {k: 'spymaster', name: 'Spymaster',   desc: '+1 Intel in every battle'},
    {k: 'decoys',    name: 'Decoy Craft', desc: 'Unlock Decoys tactic', unlock: 'decoy'},
    {k: 'mist',      name: 'Mist Weaver', desc: 'Fog costs 2 less and Reveal is free'},
    {k: 'perfect',   name: 'PERFECT AMBUSH', ult: true, desc: 'Ambush cannot be seen through; enemy cannot plan round 1'},
  ],
};
const FORMATIONS = ['line', 'wedge', 'turtle'];

// ---------- Kingdom layer: policies + kingdom talents (map level, per owner) ----------
const POLICY_CATS = {economy: {name: 'Economy', col: '#f8b800'}, military: {name: 'Military', col: '#e40058'}, arcane: {name: 'Arcane', col: '#d858f8'}};
// faction: only that faction may use it. unlock: needs that kingdom talent.
const POLICIES = {
  tax:       {cat: 'economy',  name: 'Tax Reform',      icon: 'TAX', desc: '+10% gold income'},
  lumber:    {cat: 'economy',  name: 'Lumber Rights',   icon: 'LUM', desc: '+2 wood and +2 ore per day'},
  trade:     {cat: 'economy',  name: 'Trade Guilds',    icon: 'TRD', unlock: 'charter', desc: '+1 gems per day, +250 gold per day'},
  warchest:  {cat: 'economy',  name: 'War Chest',       icon: 'WAR', desc: 'Creatures cost 10% less'},
  conscript: {cat: 'military', name: 'Conscription',    icon: 'CON', desc: '+1 weekly growth per dwelling'},
  muster:    {cat: 'military', name: 'Veteran Muster',  icon: 'MUS', desc: 'New heroes start with +10 basic and +4 tier-2 troops'},
  fortify:   {cat: 'military', name: 'Fortify',         icon: 'FOR', desc: 'Town defenders +2 defense'},
  drill:     {cat: 'military', name: 'Drill Sergeants', icon: 'DRL', unlock: 'sergeants', desc: '+25% battle experience'},
  manafont:  {cat: 'arcane',   name: 'Mana Font',       icon: 'MAN', desc: '+20% max mana'},
  tithe:     {cat: 'arcane',   name: 'Spell Tithe',     icon: 'TTH', desc: 'Terrain spells and Reveal cost 1 less'},
  carto:     {cat: 'arcane',   name: 'Cartographers',   icon: 'MAP', desc: '+1 hero sight radius'},
  ley:       {cat: 'arcane',   name: 'Ley Lines',       icon: 'LEY', unlock: 'leylore', desc: '+3 mana regen per day'},
  crusade:   {cat: 'military', name: 'Holy Crusade',    icon: 'CRU', faction: 'castle', desc: 'Castle: +1 morale (+10% morale chance each round)'},
  divine:    {cat: 'arcane',   name: 'Divine Favor',    icon: 'DIV', faction: 'castle', desc: 'Castle: all your battle stacks +1 defense'},
  raisedead: {cat: 'arcane',   name: 'Raise Dead',      icon: 'RAI', faction: 'necro', desc: 'Necropolis: 15% of enemy HP killed rises as Skeletons after a won battle'},
  dread:     {cat: 'military', name: 'Dread Aura',      icon: 'DRE', faction: 'necro', desc: 'Necropolis: enemy stacks -2 attack'},
  sacredwood:{cat: 'economy',  name: 'Sacred Wood',     icon: 'SAC', faction: 'sylvan', desc: 'Sylvan: +3 wood per day, Sacred Groves give double research'},
  huntlaw:   {cat: 'military', name: 'Hunting Law',     icon: 'HUN', faction: 'sylvan', desc: 'Sylvan: shooters +15% damage'},
  hellforge: {cat: 'military', name: 'Hellforge',       icon: 'HEL', faction: 'inferno', desc: 'Inferno: all your battle stacks +1 attack and +1 defense'},
  pact:      {cat: 'arcane',   name: 'Infernal Pact',   icon: 'PAC', faction: 'inferno', desc: 'Inferno: sacrifices give +50% research'},
  warband:   {cat: 'military', name: 'Warband',         icon: 'WBD', faction: 'stronghold', desc: 'Stronghold: creatures cost 15% less'},
  plunder:   {cat: 'economy',  name: 'Plunder',         icon: 'PLU', faction: 'stronghold', desc: 'Stronghold: won battles loot 10% of enemy army value as gold'},
  guildhall: {cat: 'economy',  name: 'Merchant Guild',  icon: 'MER', faction: 'dwarf', desc: 'Dwarf: +2 ore and +1 gems per day'},
  bulwark:   {cat: 'military', name: 'Stone Bulwark',   icon: 'BUL', faction: 'dwarf', desc: 'Dwarf: all your battle stacks +2 defense'},
};
const POLICY_SWAP_COST = 1000, BASE_SLOTS = 2, MAX_SLOTS = 4;
// Kingdom talents: 3 branches x 4 tiers + capstone. Kingdom Points: 1 per week + 1 per 3 mines owned.
const KTALENTS = {
  economy: [
    {k: 'bookkeeping', name: 'Bookkeeping',   desc: '+5% gold income'},
    {k: 'charter',     name: 'Guild Charter', desc: 'Unlock Trade Guilds policy'},
    {k: 'treasury',    name: 'Treasury',      desc: 'Policy swaps cost half'},
    {k: 'mint',        name: 'Royal Mint',    desc: '+250 gold per day'},
    {k: 'goldenage',   name: 'GOLDEN AGE', cap: true, desc: '+1 policy slot (max 5)'},
  ],
  military: [
    {k: 'barracks',    name: 'Barracks',      desc: '+10% weekly growth'},
    {k: 'sergeants',   name: 'Sergeants',     desc: 'Unlock Drill Sergeants policy'},
    {k: 'veterans',    name: 'Veterans',      desc: 'New heroes +1 attack'},
    {k: 'garrisonlaw', name: 'Garrison Law',  desc: 'Town defenders +1 defense'},
    {k: 'warlord',     name: 'WARLORD', cap: true, desc: 'All your battle stacks +1 attack'},
  ],
  arcane: [
    {k: 'scholars',    name: 'Scholars',      desc: '+10% max mana'},
    {k: 'leylore',     name: 'Ley Lore',      desc: 'Unlock Ley Lines policy'},
    {k: 'seers',       name: 'Seers',         desc: '+1 Intel in every battle'},
    {k: 'archmage',    name: 'Archmage',      desc: 'Terrain spells cost 1 less'},
    {k: 'astral',      name: 'ASTRAL THRONE', cap: true, desc: '+1 policy slot (max 5)'},
  ],
};
const AI_POLICY_PREF = {castle: ['tax', 'conscript', 'crusade', 'warchest', 'divine', 'manafont'], necro: ['tax', 'raisedead', 'conscript', 'dread', 'warchest', 'manafont'],
  sylvan: ['tax', 'huntlaw', 'conscript', 'sacredwood', 'warchest'], inferno: ['tax', 'hellforge', 'conscript', 'pact', 'warchest'], stronghold: ['warband', 'tax', 'conscript', 'plunder', 'warchest'], dwarf: ['tax', 'bulwark', 'guildhall', 'conscript', 'warchest']};

// ---------- Faction research + tech trees ----------
// One shared scale: about 1 point per 2-3 days of normal play. A day can bank at most RP_DAY_CAP points; one battle at most RP_BATTLE_CAP.
const RP_DAY_CAP = 1.5, RP_BATTLE_CAP = 1.2;
const TECH_COST = [1, 2, 3, 5, 7, 10];
const TECH_LV_NAME = ['Town', 'Town', 'Units', 'Units', 'Battle', 'Battle'];
// fx keys: inc{res}, growth{tiers?,add,pct}, cost(pct), tcost{tiers,pct}, bcost(pct), rp(pct), mana(pct), mp(pct), morale(+%), raise(pct), sac(pct), mine(pct), mkt(1),
//          foeAtt(n), manaRound(n), u{tiers?,att,def,hp(pct),dmg(pct),move,range,add[]}, cap(key)
const TECH = {
  castle: [
    [{k: 'c1a', name: 'Royal Taxes', desc: '+300 gold per day', fx: {inc: {gold: 300}}}, {k: 'c1b', name: 'Peasant Levy', desc: 'Tier 1-2 +4 weekly growth', fx: {growth: {tiers: [0, 1], add: 4}}}, {k: 'c1c', name: 'Stonemasons', desc: 'Buildings cost 15% less gold', fx: {bcost: 15}}],
    [{k: 'c2a', name: 'Barracks Drill', desc: '+15% growth for all dwellings', fx: {growth: {pct: 15}}}, {k: 'c2b', name: 'Chapel Tithes', desc: '+1 gems per day, +10% max mana', fx: {inc: {gems: 1}, mana: 10}}, {k: 'c2c', name: 'Quartermaster', desc: 'Creatures cost 10% less', fx: {cost: 10}}],
    [{k: 'c3a', name: 'Tempered Pikes', desc: 'Pikemen & Crossbowmen +2 att +2 def', fx: {u: {tiers: [1, 2], att: 2, def: 2}}}, {k: 'c3b', name: 'Griffin Aerie', desc: 'Griffins +20% HP, +1 move', fx: {u: {tiers: [3], hp: 20, move: 1}}}, {k: 'c3c', name: 'Steel Bolts', desc: 'Crossbowmen +20% dmg, +1 range', fx: {u: {tiers: [2], dmg: 20, range: 1}}}],
    [{k: 'c4a', name: 'Plate Armor', desc: 'Swordsmen & Paladins +4 defense', fx: {u: {tiers: [4, 6], def: 4}}}, {k: 'c4b', name: 'Holy Doctrine', desc: 'Monks +20% dmg and HP', fx: {u: {tiers: [5], dmg: 20, hp: 20}}}, {k: 'c4c', name: 'Veteran Blades', desc: 'Swordsmen +3 att, +15% dmg', fx: {u: {tiers: [4], att: 3, dmg: 15}}}],
    [{k: 'c5a', name: 'Banners', desc: '+15% morale chance in battle', fx: {morale: 15}}, {k: 'c5b', name: 'Shield Doctrine', desc: 'All stacks +2 defense', fx: {u: {def: 2}}}, {k: 'c5c', name: 'Righteous Fury', desc: 'All stacks +8% damage', fx: {u: {dmg: 8}}}],
    [{k: 'c6a', name: 'CRUSADE', desc: 'Morale +50% chance every round; immune to Fear', fx: {cap: 'crusade'}}, {k: 'c6b', name: 'Divine Bastion', desc: 'All stacks +15% HP, +2 def', fx: {u: {hp: 15, def: 2}}}, {k: 'c6c', name: 'Royal Guard', desc: 'Monks & Paladins +4 att +4 def +15% dmg', fx: {u: {tiers: [5, 6], att: 4, def: 4, dmg: 15}}}],
  ],
  necro: [
    [{k: 'n1a', name: 'Grave Robbers', desc: '+200 gold, +1 ore per day', fx: {inc: {gold: 200, ore: 1}}}, {k: 'n1b', name: 'Bone Pit', desc: 'Skeletons +6 weekly growth', fx: {growth: {tiers: [0], add: 6}}}, {k: 'n1c', name: 'Ossuary', desc: 'Buildings cost 15% less gold', fx: {bcost: 15}}],
    [{k: 'n2a', name: 'Necromancy', desc: 'Raise +10% of enemy HP killed as Skeletons', fx: {raise: 10}}, {k: 'n2b', name: 'Dark Rituals', desc: '+20% max mana', fx: {mana: 20}}, {k: 'n2c', name: 'Corpse Carts', desc: '+15% growth for all dwellings', fx: {growth: {pct: 15}}}],
    [{k: 'n3a', name: 'Plague', desc: 'Zombies gain Plague, +15% HP', fx: {u: {tiers: [1], hp: 15, add: ['Plague']}}}, {k: 'n3b', name: 'Vampiric Kiss', desc: 'Vampires +20% dmg', fx: {u: {tiers: [3], dmg: 20}}}, {k: 'n3c', name: 'Soul Forge', desc: 'Tier 1-3 +2 att +2 def', fx: {u: {tiers: [0, 1, 2], att: 2, def: 2}}}],
    [{k: 'n4a', name: 'Phylactery', desc: 'Liches +30% HP, +1 range', fx: {u: {tiers: [4], hp: 30, range: 1}}}, {k: 'n4b', name: 'Death Knights', desc: 'Wraith Knights +3 att, +15% dmg', fx: {u: {tiers: [5], att: 3, dmg: 15}}}, {k: 'n4c', name: 'Dragon Bones', desc: 'Bone Dragons +4 def, +15% HP', fx: {u: {tiers: [6], def: 4, hp: 15}}}],
    [{k: 'n5a', name: 'Dread Presence', desc: 'Enemy stacks -2 attack', fx: {foeAtt: 2}}, {k: 'n5b', name: 'Chill Touch', desc: 'All stacks +8% damage', fx: {u: {dmg: 8}}}, {k: 'n5c', name: 'Grave Cold', desc: 'All stacks +2 defense', fx: {u: {def: 2}}}],
    [{k: 'n6a', name: 'ENDLESS NIGHT', desc: 'Each of your stacks rises once at half strength when destroyed', fx: {cap: 'endless'}}, {k: 'n6b', name: 'Lord of Bones', desc: 'Raise +20% of enemy HP killed', fx: {raise: 20}}, {k: 'n6c', name: 'Unholy Might', desc: 'All stacks +2 att, +10% HP', fx: {u: {att: 2, hp: 10}}}],
  ],
  sylvan: [
    [{k: 's1a', name: 'Grove Keepers', desc: '+2 wood, +150 gold per day', fx: {inc: {wood: 2, gold: 150}}}, {k: 's1b', name: 'Ancient Groves', desc: 'Tier 1-3 +2 weekly growth', fx: {growth: {tiers: [0, 1, 2], add: 2}}}, {k: 's1c', name: 'Living Halls', desc: 'Buildings cost 15% less gold', fx: {bcost: 15}}],
    [{k: 's2a', name: 'Nature Bond', desc: '+25% research gain', fx: {rp: 25}}, {k: 's2b', name: 'Moonwells', desc: '+20% max mana', fx: {mana: 20}}, {k: 's2c', name: 'Wild Growth', desc: '+15% growth for all dwellings', fx: {growth: {pct: 15}}}],
    [{k: 's3a', name: 'Elven Bowcraft', desc: 'Elf Archers +1 range, +15% dmg', fx: {u: {tiers: [2], range: 1, dmg: 15}}}, {k: 's3b', name: 'Pathfinders', desc: 'Wolf Riders +1 move, +2 att', fx: {u: {tiers: [1], move: 1, att: 2}}}, {k: 's3c', name: 'Fey Wings', desc: 'Sprites +30% HP, +2 att', fx: {u: {tiers: [0], hp: 30, att: 2}}}],
    [{k: 's4a', name: 'Druid Circle', desc: 'Druids +20% dmg and HP', fx: {u: {tiers: [3], dmg: 20, hp: 20}}}, {k: 's4b', name: 'Unicorn Grace', desc: 'Unicorns +3 def, +20% HP', fx: {u: {tiers: [4], def: 3, hp: 20}}}, {k: 's4c', name: 'Heartwood', desc: 'Treants +30% HP, +2 def', fx: {u: {tiers: [5], hp: 30, def: 2}}}],
    [{k: 's5a', name: "Hunter's Mark", desc: 'Elf Archers & Druids +15% dmg', fx: {u: {tiers: [2, 3], dmg: 15}}}, {k: 's5b', name: 'Swift Feet', desc: 'All stacks +1 move', fx: {u: {move: 1}}}, {k: 's5c', name: 'Thornskin', desc: 'All stacks +2 defense', fx: {u: {def: 2}}}],
    [{k: 's6a', name: 'WILD HUNT', desc: 'All stacks +2 move and +15% dmg; enemies never strike back', fx: {cap: 'wildhunt'}}, {k: 's6b', name: 'Dragon Pact', desc: 'Green Dragons +5 att, +20% dmg and HP', fx: {u: {tiers: [6], att: 5, dmg: 20, hp: 20}}}, {k: 's6c', name: 'Elven Volley', desc: 'Elf Archers shoot 3 times', fx: {u: {tiers: [2], add: ['Triple']}}}],
  ],
  inferno: [
    [{k: 'i1a', name: 'Brimstone Mines', desc: '+2 ore, +1 gems per day', fx: {inc: {ore: 2, gems: 1}}}, {k: 'i1b', name: 'Imp Warrens', desc: 'Imps +6 weekly growth', fx: {growth: {tiers: [0], add: 6}}}, {k: 'i1c', name: 'Infernal Forges', desc: 'Buildings cost 15% less gold', fx: {bcost: 15}}],
    [{k: 'i2a', name: 'Blood Altar', desc: 'Sacrifices give +50% research', fx: {sac: 50}}, {k: 'i2b', name: 'Hellgate Spawn', desc: '+15% growth for all dwellings', fx: {growth: {pct: 15}}}, {k: 'i2c', name: 'Dark Bargain', desc: 'Creatures cost 10% less', fx: {cost: 10}}],
    [{k: 'i3a', name: 'Hellfire', desc: 'Pit Fiends +20% dmg', fx: {u: {tiers: [5], dmg: 20}}}, {k: 'i3b', name: 'Cerberus Breeding', desc: 'Hell Hounds +3 att, +1 move', fx: {u: {tiers: [1], att: 3, move: 1}}}, {k: 'i3c', name: 'Siren Song', desc: 'Succubi +1 range, +15% dmg', fx: {u: {tiers: [2], range: 1, dmg: 15}}}],
    [{k: 'i4a', name: 'Demonic Armor', desc: 'Demons +4 def, +20% HP', fx: {u: {tiers: [3], def: 4, hp: 20}}}, {k: 'i4b', name: 'Efreet Flames', desc: 'Efreets +20% dmg', fx: {u: {tiers: [4], dmg: 20}}}, {k: 'i4c', name: "Devil's Due", desc: 'Devils +4 att, +15% dmg', fx: {u: {tiers: [6], att: 4, dmg: 15}}}],
    [{k: 'i5a', name: 'Infernal Rage', desc: 'All stacks +10% damage', fx: {u: {dmg: 10}}}, {k: 'i5b', name: 'Brimstone Skin', desc: 'All stacks +2 defense', fx: {u: {def: 2}}}, {k: 'i5c', name: 'Demonic Pact', desc: 'All stacks -10% HP but +20% damage', fx: {u: {hp: -10, dmg: 20}}}],
    [{k: 'i6a', name: 'GATES OF HELL', desc: 'Every round a free stack of Imps (or Familiars) pours out of a portal', fx: {cap: 'gates'}}, {k: 'i6b', name: 'Mana Leech', desc: 'Enemy hero loses 3 mana every round', fx: {manaRound: 3}}, {k: 'i6c', name: 'Arch Fiends', desc: 'Pit Fiends & Devils +4 att, +15% HP', fx: {u: {tiers: [5, 6], att: 4, hp: 15}}}],
  ],
  stronghold: [
    [{k: 'o1a', name: 'Raiding Parties', desc: '+250 gold per day', fx: {inc: {gold: 250}}}, {k: 'o1b', name: 'Fighting Pits', desc: 'Tier 1-2 +4 weekly growth', fx: {growth: {tiers: [0, 1], add: 4}}}, {k: 'o1c', name: 'Mud Huts', desc: 'Buildings cost 20% less gold', fx: {bcost: 20}}],
    [{k: 'o2a', name: 'War Drums', desc: 'Heroes +15% map movement', fx: {mp: 15}}, {k: 'o2b', name: 'Cheap Blades', desc: 'Creatures cost 12% less', fx: {cost: 12}}, {k: 'o2c', name: 'Trophy Hall', desc: '+25% research gain', fx: {rp: 25}}],
    [{k: 'o3a', name: 'Axe Masters', desc: 'Orc Axemen +3 att, +15% dmg', fx: {u: {tiers: [2], att: 3, dmg: 15}}}, {k: 'o3b', name: 'Warg Pens', desc: 'Wolf Raiders +1 move, +20% HP', fx: {u: {tiers: [1], move: 1, hp: 20}}}, {k: 'o3c', name: 'Shaman Totems', desc: 'Ogre Shamans +25% HP, +2 def', fx: {u: {tiers: [3], hp: 25, def: 2}}}],
    [{k: 'o4a', name: 'Beast Taming', desc: 'Rocs & Behemoths cost 20% less', fx: {tcost: {tiers: [4, 6], pct: 20}}}, {k: 'o4b', name: 'Cyclops Boulders', desc: 'Cyclops +20% dmg, +1 range', fx: {u: {tiers: [5], dmg: 20, range: 1}}}, {k: 'o4c', name: 'Thick Hide', desc: 'Behemoths +4 def, +15% HP', fx: {u: {tiers: [6], def: 4, hp: 15}}}],
    [{k: 'o5a', name: 'Blood Rage', desc: 'All stacks +10% damage', fx: {u: {dmg: 10}}}, {k: 'o5b', name: 'Berserkers', desc: 'All stacks +3 att, -1 def', fx: {u: {att: 3, def: -1}}}, {k: 'o5c', name: 'Horde Tactics', desc: 'Tier 1-3 +20% HP', fx: {u: {tiers: [0, 1, 2], hp: 20}}}],
    [{k: 'o6a', name: "WARLORD'S FURY", desc: 'In round 1 every stack strikes twice', fx: {cap: 'fury'}}, {k: 'o6b', name: 'Titan Strength', desc: 'Cyclops & Behemoths +5 att, +20% dmg', fx: {u: {tiers: [5, 6], att: 5, dmg: 20}}}, {k: 'o6c', name: 'Endless Horde', desc: '+30% growth for all dwellings', fx: {growth: {pct: 30}}}],
  ],
  dwarf: [
    [{k: 'd1a', name: 'Deep Mines', desc: 'Mines produce +50%', fx: {mine: 50}}, {k: 'd1b', name: 'Guild Bank', desc: '+300 gold per day', fx: {inc: {gold: 300}}}, {k: 'd1c', name: 'Stone Halls', desc: 'Buildings cost 20% less gold', fx: {bcost: 20}}],
    [{k: 'd2a', name: 'Trade Charter', desc: 'Even better market rates', fx: {mkt: 1}}, {k: 'd2b', name: 'Compound Interest', desc: '+25% research gain', fx: {rp: 25}}, {k: 'd2c', name: 'Forge Works', desc: '+15% growth for all dwellings', fx: {growth: {pct: 15}}}],
    [{k: 'd3a', name: 'Runeforging', desc: 'Miners, Shieldbearers, Runesmiths +2 att +2 def', fx: {u: {tiers: [0, 1, 3], att: 2, def: 2}}}, {k: 'd3b', name: 'Heavy Bolts', desc: 'Crossbow Engineers +20% dmg, +1 range', fx: {u: {tiers: [2], dmg: 20, range: 1}}}, {k: 'd3c', name: 'Bear Armor', desc: 'Bear Riders +3 def, +20% HP', fx: {u: {tiers: [4], def: 3, hp: 20}}}],
    [{k: 'd4a', name: 'Steam Power', desc: 'Steam Golems +1 move, +15% dmg', fx: {u: {tiers: [5], move: 1, dmg: 15}}}, {k: 'd4b', name: 'Dreadnought Plating', desc: 'Dreadnoughts +4 def, +15% HP', fx: {u: {tiers: [6], def: 4, hp: 15}}}, {k: 'd4c', name: 'Master Runes', desc: 'Runesmiths +25% HP, +20% dmg', fx: {u: {tiers: [3], hp: 25, dmg: 20}}}],
    [{k: 'd5a', name: 'Shield Line', desc: 'All stacks +3 defense', fx: {u: {def: 3}}}, {k: 'd5b', name: 'Gunpowder', desc: 'Crossbow Engineers & Dreadnoughts +20% dmg', fx: {u: {tiers: [2, 6], dmg: 20}}}, {k: 'd5c', name: 'Iron Discipline', desc: '+15% morale chance in battle', fx: {morale: 15}}],
    [{k: 'd6a', name: 'IRON LEGION', desc: 'Golems & Dreadnoughts immune to spells, +25% HP and dmg', fx: {cap: 'legion'}}, {k: 'd6b', name: 'Mountain Hold', desc: 'All stacks +15% HP', fx: {u: {hp: 15}}}, {k: 'd6c', name: 'Golden Hoard', desc: '+1000 gold per day', fx: {inc: {gold: 1000}}}],
  ],
};
// Count words for armies seen with low intel.
const COUNT_BANDS = [[1000, 'Legion'], [500, 'Swarm'], [250, 'Throng'], [100, 'Horde']];
const OLD_UNIT_NAMES = {Archer: 'Crossbowman', Cavalier: 'Paladin', Wight: 'Ghost', BlackKnight: 'Wraith Knight'};
