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
const AI_BUILD_ORDER = ['dw2', 'tavern', 'fort', 'dw3', 'hall', 'guild1', 'citadel', 'dw4', 'guild2', 'dw5', 'market'];

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
