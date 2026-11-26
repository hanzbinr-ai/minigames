// Blackhole Throne: static game data (pure, no DOM). Shared by browser and Node.
(function (root, f) { const m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.NTData = m; })(typeof self !== 'undefined' ? self : this, function () {
const TITLE = 'Blackhole Throne'; // game title: change here only
const RES = ['metal', 'crystal', 'gas', 'energy'];
// planet type -> resource it produces
const PLANET = {
  rocky: { res: 'metal', name: 'Rocky world' },
  ice: { res: 'crystal', name: 'Ice world' },
  gas: { res: 'gas', name: 'Gas giant' },
  energy: { res: 'energy', name: 'Molten world' },
};
// size: 1 small .. 4 capital. pow = reactor power budget. spd = map units / second.
const HULLS = {
  corvette:   { name: 'Corvette',   cmd: 1, slots: 3, hp: 80,   ev: .3, spd: 8,   size: 1, pow: 6,  cost: { metal: 40, crystal: 10 }, time: 3 },
  frigate:    { name: 'Frigate',    cmd: 2, slots: 3, hp: 170,  ev: .22, spd: 7,   size: 2, pow: 8,  cost: { metal: 80, crystal: 20, gas: 10 }, time: 4, escort: true },
  destroyer:  { name: 'Destroyer',  cmd: 2, slots: 4, hp: 180,  ev: .2,  spd: 7.5, size: 2, pow: 12, cost: { metal: 90, crystal: 30, gas: 10 }, time: 4 },
  cruiser:    { name: 'Cruiser',    cmd: 4, slots: 6, hp: 330,  ev: .1,  spd: 6,   size: 3, pow: 16, cost: { metal: 180, crystal: 70, gas: 30 }, time: 7, aura: true, req: 'cruiser' },
  battleship: { name: 'Battleship', cmd: 8, slots: 8, hp: 700,  ev: .04, spd: 4.5, size: 4, pow: 26, cost: { metal: 360, crystal: 140, gas: 70, energy: 30 }, time: 12, req: 'battleship' },
  carrier:    { name: 'Carrier',    cmd: 8, slots: 6, hp: 600,  ev: .04, spd: 4.5, size: 4, pow: 22, cost: { metal: 340, crystal: 160, gas: 80, energy: 40 }, time: 12, req: 'carrier', bays: true },
  colony:     { name: 'Colony Ship', cmd: 2, slots: 0, hp: 120, ev: .1, spd: 5, size: 2, pow: 0, cost: { metal: 300, crystal: 200, gas: 100 }, time: 6, civ: 'colony' },
  constructor:{ name: 'Construction Ship', cmd: 2, slots: 0, hp: 120, ev: .1, spd: 5, size: 2, pow: 0, cost: { metal: 400, crystal: 150, gas: 150, energy: 100 }, time: 6, civ: 'starbase' },
  // not buildable
  leviathan:  { name: 'Void Leviathan', cmd: 16, slots: 8, hp: 2600, ev: .02, spd: 3, size: 4, pow: 99, cost: {}, time: 0, npc: true },
  kraken:     { name: 'Star Kraken', cmd: 12, slots: 8, hp: 1800, ev: .08, spd: 3.5, size: 4, pow: 99, cost: {}, time: 0, npc: true },
  turret:     { name: 'Defense Platform', cmd: 3, slots: 6, hp: 500, ev: 0, spd: 0, size: 3, pow: 99, cost: {}, time: 0, npc: true },
  sbcore:     { name: 'Star Base Core', cmd: 10, slots: 8, hp: 2200, ev: 0, spd: 0, size: 4, pow: 99, cost: {}, time: 0, npc: true },
};
// range: long fires from round 1, med from 2, short from 3, any = always (fighters)
const MODS = {
  laser:      { name: 'Laser', kind: 'w', dmg: 18, acc: .8,  range: 'med',  vs: { shield: .5, armor: 1.5 }, pow: 2, cost: { metal: 10, crystal: 12 } },
  laser2:     { name: 'Laser II', kind: 'w', dmg: 26, acc: .82, range: 'med', vs: { shield: .5, armor: 1.5 }, pow: 3, cost: { metal: 15, crystal: 20 }, req: 'laser2' },
  railgun:    { name: 'Railgun', kind: 'w', dmg: 20, acc: .75, range: 'med', vs: { shield: 1.5, armor: .75 }, pow: 3, cost: { metal: 16, gas: 6 } },
  railgun2:   { name: 'Railgun II', kind: 'w', dmg: 28, acc: .77, range: 'med', vs: { shield: 1.5, armor: .75 }, pow: 4, cost: { metal: 24, gas: 10 }, req: 'railgun2' },
  autocannon: { name: 'Autocannon', kind: 'w', dmg: 14, acc: .9, range: 'short', vs: { shield: 1, armor: 1 }, flak: 2, pow: 1, cost: { metal: 8 } },
  torpedo:    { name: 'Torpedo', kind: 'w', dmg: 45, acc: .72, range: 'med', vs: { shield: 1, armor: 1 }, torp: true, reload: 2, pow: 3, cost: { metal: 20, gas: 15 } },
  artillery:  { name: 'Artillery', kind: 'w', dmg: 60, acc: .75, range: 'long', vs: { shield: 1, armor: 1 }, big: true, minSize: 3, pow: 5, cost: { metal: 40, crystal: 20, gas: 10 } },
  fighters:   { name: 'Fighter Bay', kind: 'w', dmg: 18, acc: .85, range: 'any', vs: { shield: 1, armor: 1 }, fighter: true, shots: 3, bays: true, pow: 4, cost: { metal: 30, crystal: 20, energy: 10 } },
  shield:     { name: 'Shield', kind: 'd', shield: 60, pow: 3, cost: { crystal: 20, energy: 5 } },
  armor:      { name: 'Armor', kind: 'd', armor: 70, pow: 0, cost: { metal: 25 } },
  pd:         { name: 'Point Defense', kind: 'd', pd: .8, pow: 2, cost: { metal: 12, crystal: 8 } },
  taunt:      { name: 'Taunt Beacon', kind: 'd', taunt: 3, armor: 40, pow: 1, cost: { metal: 20, energy: 5 } },
  engine:     { name: 'Engine', kind: 'u', speed: .15, ev: .04, pow: 2, cost: { gas: 15 } },
  sensor:     { name: 'Sensor', kind: 'u', sensor: 15, acc: .05, pow: 1, cost: { crystal: 12 } },
  reactor:    { name: 'Reactor', kind: 'u', power: 6, pow: 0, cost: { energy: 25, metal: 10 } },
};
const SIZE_MULT = { 1: 1, 2: 1.5, 3: 2, 4: 3 }; // shield/armor modules scale with hull size
const TEMPLATES = [
  { id: 'raider', name: 'Raider', hull: 'corvette', mods: ['torpedo', 'autocannon', 'engine'] },
  { id: 'picket', name: 'Picket', hull: 'corvette', mods: ['laser', 'laser', 'engine'] },
  { id: 'escort', name: 'Escort', hull: 'frigate', mods: ['pd', 'autocannon', 'armor'] },
  { id: 'hunter', name: 'Hunter', hull: 'destroyer', mods: ['railgun', 'railgun', 'laser', 'shield'] },
  { id: 'warden', name: 'Warden', hull: 'destroyer', mods: ['autocannon', 'autocannon', 'pd', 'armor'] },
  { id: 'linecruiser', name: 'Line Cruiser', hull: 'cruiser', mods: ['laser', 'railgun', 'railgun', 'shield', 'armor', 'taunt'] },
  { id: 'dread', name: 'Dreadnought', hull: 'battleship', mods: ['artillery', 'artillery', 'railgun', 'laser', 'shield', 'shield', 'armor', 'reactor'] },
  { id: 'hive', name: 'Hive Carrier', hull: 'carrier', mods: ['fighters', 'fighters', 'pd', 'shield', 'armor', 'reactor'] },
  { id: 'colonyship', name: 'Colony Ship', hull: 'colony', mods: [] },
  { id: 'builder', name: 'Construction Ship', hull: 'constructor', mods: [] },
];
// NPC / defensive designs (compiled without research checks)
const NPC = [
  { id: 'void_leviathan', name: 'Void Leviathan', hull: 'leviathan', mods: ['artillery', 'artillery', 'torpedo', 'laser', 'laser', 'shield', 'armor', 'armor'] },
  { id: 'star_kraken', name: 'Star Kraken', hull: 'kraken', mods: ['autocannon', 'autocannon', 'autocannon', 'torpedo', 'railgun', 'armor', 'armor', 'pd'] },
  { id: 'turret', name: 'Defense Platform', hull: 'turret', mods: ['artillery', 'railgun', 'laser', 'pd', 'shield', 'armor'] },
  { id: 'sbcore', name: 'Star Base Core', hull: 'sbcore', mods: ['artillery', 'artillery', 'railgun', 'railgun', 'laser', 'laser', 'shield', 'armor'] },
];
// buildings on the home planet. prod = per second per level for mines
const BUILD = {
  hq: { name: 'HQ', desc: 'Raises colony cap, fleet command cap and other building limits.', cost: { metal: 200, crystal: 150, gas: 50 } },
  metal: { name: 'Metal Mine', res: 'metal', desc: 'Produces Metal.', cost: { metal: 60, crystal: 30 } },
  crystal: { name: 'Crystal Refinery', res: 'crystal', desc: 'Produces Crystal.', cost: { metal: 70, crystal: 20 } },
  gas: { name: 'Gas Extractor', res: 'gas', desc: 'Produces Gas.', cost: { metal: 70, crystal: 40 } },
  energy: { name: 'Fusion Plant', res: 'energy', desc: 'Produces Energy.', cost: { metal: 80, gas: 30 } },
  shipyard: { name: 'Shipyard', desc: 'Builds ships faster (-8% time per level).', cost: { metal: 150, crystal: 60, gas: 40 } },
  lab: { name: 'Research Lab', desc: 'Researches faster (-8% time per level).', cost: { metal: 100, crystal: 120 } },
  defense: { name: 'Orbital Defense', desc: 'One defense platform per level guards the home planet.', cost: { metal: 160, crystal: 60, energy: 40 } },
};
const RESEARCH = {
  cruiser: { name: 'Cruiser Hulls', cost: { metal: 300, crystal: 200 }, time: 10 },
  battleship: { name: 'Battleship Hulls', req: 'cruiser', cost: { metal: 700, crystal: 450, gas: 200 }, time: 16 },
  carrier: { name: 'Carrier Hulls', req: 'battleship', cost: { metal: 800, crystal: 600, energy: 300 }, time: 18 },
  laser2: { name: 'Laser II', cost: { crystal: 400, energy: 150 }, time: 10 },
  railgun2: { name: 'Railgun II', cost: { metal: 400, gas: 200 }, time: 10 },
  colony1: { name: 'Colonial Admin I (+1 colony)', cost: { metal: 300, crystal: 300 }, time: 10 },
  colony2: { name: 'Colonial Admin II (+1 colony)', req: 'colony1', cost: { metal: 700, crystal: 600, gas: 200 }, time: 16 },
  logistics: { name: 'Fleet Logistics (+8 command, +supply range)', cost: { metal: 400, gas: 250, energy: 150 }, time: 12 },
  warp: { name: 'Warp Retreat', cost: { crystal: 400, gas: 300, energy: 300 }, time: 14 },
  jammer: { name: 'Warp Jammer (Star Bases)', req: 'warp', cost: { crystal: 500, energy: 500 }, time: 14 },
};
const FACTIONS = [
  { id: 'player', name: 'You', color: '#4fc3f7', kind: 'player' },
  { id: 'ai1', name: 'Crimson Dominion', color: '#ef5350', kind: 'ai' },
  { id: 'ai2', name: 'Verdant Accord', color: '#66bb6a', kind: 'ai' },
  { id: 'ai3', name: 'Amber Syndicate', color: '#ffb300', kind: 'ai' },
  { id: 'pirates', name: 'Pirates', color: '#b0bec5', kind: 'pirate' },
  { id: 'monsters', name: 'Void Beasts', color: '#ce93d8', kind: 'monster' },
];
const CFG = {
  W: 200, H: 200, DT: 0.25, // seconds per tick
  supplyPlanet: 30, supplyBase: 35, supplyDebuff: .8, damagedDebuff: .75,
  warpLoss: .2, warpThreshold: .3, warpCooldown: 60, warpDamaged: 60, jamRange: 25,
  repairRate: .05, contact: 2.5, maxFleets: 4, starbaseCap: 2, raidFrac: .15, sbDrop: .5,
};
return { TITLE, RES, PLANET, HULLS, MODS, SIZE_MULT, TEMPLATES, NPC, BUILD, RESEARCH, FACTIONS, CFG };
});
