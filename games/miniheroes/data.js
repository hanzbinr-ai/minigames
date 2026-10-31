// Mini Heroes - static data tables. Edit numbers here to rebalance.
'use strict';
const RES = ['gold', 'wood', 'ore', 'gems'];
const RES_COL = {gold: '#f8b800', wood: '#a0522d', ore: '#9c9c9c', gems: '#d858f8'};

// move = battle tiles per round, range>0 = shooter (tiles), growth = per week
const UNITS = {
  Peasant:     {att: 1,  def: 1,  hp: 3,   dmg: [1, 1],   move: 3, range: 0, skill: 'Swarm',  cost: 15,   growth: 14, col: '#c8a060'},
  Archer:      {att: 6,  def: 3,  hp: 10,  dmg: [2, 3],   move: 3, range: 6, skill: 'Ranged', cost: 100,  growth: 9,  col: '#58d854'},
  Swordsman:   {att: 10, def: 12, hp: 35,  dmg: [6, 9],   move: 3, range: 0, skill: 'Cleave', cost: 300,  growth: 5,  col: '#3cbcfc'},
  Monk:        {att: 12, def: 7,  hp: 30,  dmg: [10, 12], move: 3, range: 6, skill: 'Ranged', cost: 400,  growth: 3,  col: '#fcfcfc'},
  Cavalier:    {att: 15, def: 15, hp: 100, dmg: [15, 25], move: 5, range: 0, skill: 'Charge', cost: 1000, growth: 2,  col: '#f8b800'},
  Skeleton:    {att: 5,  def: 4,  hp: 6,   dmg: [1, 3],   move: 3, range: 0, skill: 'Undead', cost: 60,   growth: 12, col: '#e0e0e0'},
  Zombie:      {att: 5,  def: 5,  hp: 20,  dmg: [2, 3],   move: 2, range: 0, skill: 'Tough',  cost: 125,  growth: 8,  col: '#7ca050'},
  Wight:       {att: 7,  def: 7,  hp: 18,  dmg: [3, 5],   move: 4, range: 0, skill: 'Regen',  cost: 200,  growth: 7,  col: '#8888ff'},
  Lich:        {att: 13, def: 10, hp: 30,  dmg: [11, 13], move: 3, range: 6, skill: 'Ranged', cost: 550,  growth: 3,  col: '#d858f8'},
  BlackKnight: {att: 16, def: 16, hp: 120, dmg: [15, 30], move: 5, range: 0, skill: 'Charge', cost: 1200, growth: 2,  col: '#e40058'},
  Goblin:      {att: 4,  def: 2,  hp: 5,   dmg: [1, 2],   move: 4, range: 0, skill: 'Swarm',  cost: 40,   growth: 0,  col: '#80d010'},
  Wolf:        {att: 6,  def: 4,  hp: 10,  dmg: [2, 5],   move: 5, range: 0, skill: 'Swarm',  cost: 80,   growth: 0,  col: '#a0a0a0'},
  Troll:       {att: 14, def: 7,  hp: 40,  dmg: [10, 15], move: 4, range: 0, skill: 'Regen',  cost: 500,  growth: 0,  col: '#50a050'},
};
const SKILL_DESC = {
  Swarm: '+15% dmg per extra ally next to target', Ranged: 'Shoots; half dmg if blocked or far',
  Cleave: '25% chance x1.3 dmg', Undead: 'Immune to Slow', Tough: 'Takes 15% less dmg',
  Regen: 'Heals top creature each round', Charge: '+10% dmg per tile moved this round',
};

const FACTIONS = {
  castle: {name: 'Castle', col: '#3cbcfc', units: ['Peasant', 'Archer', 'Swordsman', 'Monk', 'Cavalier']},
  necro:  {name: 'Necropolis', col: '#e40058', units: ['Skeleton', 'Zombie', 'Wight', 'Lich', 'BlackKnight']},
};

// Building tree. dw1..dw5 are creature dwellings (unit comes from faction tier).
const BUILDINGS = {
  fort:    {name: 'Fort',          cost: {gold: 1000, wood: 5, ore: 5},           req: [],                 desc: 'Defenders get +3 defense'},
  tavern:  {name: 'Tavern',        cost: {gold: 500, wood: 5},                    req: [],                 desc: 'Hire a 2nd hero (2500 gold)'},
  hall:    {name: 'Town Hall',     cost: {gold: 2500},                            req: ['tavern'],         desc: '+500 gold per day'},
  capitol: {name: 'Capitol',       cost: {gold: 5000, wood: 5, ore: 5, gems: 2}, req: ['hall'],         desc: '+500 more gold per day, +1 kingdom policy slot'},
  market:  {name: 'Marketplace',   cost: {gold: 500, wood: 5},                    req: [],                 desc: 'Trade resources'},
  citadel: {name: 'Citadel',       cost: {gold: 2500, ore: 5},                    req: ['fort'],           desc: '+50% creature growth'},
  guild1:  {name: 'Mage Guild 1',  cost: {gold: 2000, wood: 5, ore: 5},           req: [],                 desc: 'Teaches level 1 spells'},
  guild2:  {name: 'Mage Guild 2',  cost: {gold: 1000, wood: 4, ore: 4, gems: 4},  req: ['guild1'],         desc: 'Teaches level 2 spells'},
  dw1:     {name: 'Dwelling I',    cost: {gold: 300},                             req: [],                 tier: 0},
  dw2:     {name: 'Dwelling II',   cost: {gold: 1000, ore: 5},                    req: ['dw1'],            tier: 1},
  dw3:     {name: 'Dwelling III',  cost: {gold: 1500, wood: 5, ore: 5},           req: ['dw2', 'fort'],    tier: 2},
  dw4:     {name: 'Dwelling IV',   cost: {gold: 2000, wood: 5, ore: 5, gems: 2},  req: ['dw3', 'guild1'],  tier: 3},
  dw5:     {name: 'Dwelling V',    cost: {gold: 4000, wood: 10, ore: 10, gems: 5},req: ['dw4', 'citadel'], tier: 4},
};
const AI_BUILD_ORDER = ['dw2', 'tavern', 'fort', 'dw3', 'hall', 'guild1', 'citadel', 'capitol', 'dw4', 'guild2', 'dw5', 'market'];

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
  Tarnum: {offense: 1, ballistics: 1}, Mira: {estates: 1, wisdom: 1}, Sandro: {wisdom: 1, armorer: 1}, Vidomina: {offense: 1, logistics: 1}, Thant: {armorer: 1, leadership: 1}, Moandor: {archery: 1, scouting: 1}};

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
const AI_POLICY_PREF = {castle: ['tax', 'conscript', 'crusade', 'warchest', 'divine', 'manafont'], necro: ['tax', 'raisedead', 'conscript', 'dread', 'warchest', 'manafont']};
