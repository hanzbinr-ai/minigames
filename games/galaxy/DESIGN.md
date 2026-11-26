# Blackhole Throne: design (v0.1.0 prototype)

Galaxy strategy in the style of Rise of Kingdoms with a Stellaris-lite ship designer. The title lives in one constant: `TITLE` in `data.js`.

## Architecture
- `data.js`: all numbers (hulls, modules, buildings, research, factions, config).
- `battle.js`: the design compiler (design → stat block, run once on save) and the 6-round battle.
- `sim.js`: the authoritative game state. It is pure (no DOM), deterministic from its seed (mulberry32 RNG kept in `state.rng`), and ticks at a fixed `dt` of 0.25 s. State is plain JSON. Every command goes through `act(state, owner, action)`.
- `ai.js`: the AI empire brain. It uses the same `act()` as the player.
- `sprites.js`, `render.js`, `ui.js`, `main.js`: the browser side (canvas, HUD, input, loop, localStorage save).
- Later: run `sim.js` on a Node WebSocket server and send it player `act()` messages. The client only renders.

## Map
- 200×200 units: 4 fixed home worlds (one for the player, three for AI empires) and about 40 planets. Rocky planets give Metal, ice planets Crystal, gas giants Gas, and molten planets Energy. There are also 18 asteroid fields to mine and a black hole in the centre (scenery for now).
- Neutrals: up to 4 pirate fleets roam and respawn. They hunt weaker fleets and sometimes raid undefended colonies. Two monsters (Void Leviathan and Star Kraken) roam slowly and drop big loot.

## Bases
| | Home world | Colony | Star Base |
|---|---|---|---|
| Where | fixed, never moves | free planet | empty space (not near planets) |
| Made by | start | Colony Ship | Construction Ship |
| Resources | buildings (2 + 2×level per second; Lv 0 = none) | +5/s of its planet type | none |
| Defeat | raided (15% of resources stolen), never captured | captured by empires (pirates only raid) | destroyed, never captured; drops 50% of stored supplies |
| Defense | 1 platform per Orbital Defense level | 1 platform | core (artillery/railgun/laser) + 2 platforms |
- Buildings: HQ, Metal Mine, Crystal Refinery, Gas Extractor, Fusion Plant, Shipyard, Research Lab, Orbital Defense. Upgrades run on short timers. Only one upgrade runs at a time.
- RoK-style progression (`data.js` `START_BLD`, `BUILD[b].unlock`, `BREQ`, `BMAX` 15; enforced in `sim.act` via `bldCheck`, which the UI also uses):
  - A new game starts with HQ, Metal Mine and Crystal Refinery at Lv 1. The rest unlock by HQ level: Gas Extractor at 2, Fusion Plant at 3, Shipyard at 4, Research Lab at 5, Orbital Defense at 6. An unlocked building is built from Lv 0 to 1 at its Lv 1 cost. At Lv 0 it gives nothing (no output, no speed bonus, no defense platforms).
  - No building may go above the HQ level.
  - HQ requirements (to reach level L): 2 metal 1 · 3 crystal 2 · 4 metal 3, gas 2 · 5 metal 4, energy 3 · 6 shipyard 4, crystal 5 · 7 metal 6, lab 5 · 8 crystal 7, defense 5 · 9 shipyard 8, gas 7 · 10 lab 9, energy 8 · 11 metal 10, defense 9 · 12 crystal 11, shipyard 10 · 13 lab 12, gas 11 · 14 energy 13, defense 12 · 15 shipyard 14, metal 14. Every requirement is at most L−1, so there is no deadlock (tested).
  - Other buildings: Shipyard 10 needs Lab 8, Lab 10 needs Fusion Plant 9, Orbital Defense 8 needs Shipyard 7.
  - Ships can still be built at Shipyard Lv 0 (base speed). Only the speed bonus needs the building.
- Colony cap = 1 + floor((HQ−1)/2), +1 each from Colonial Admin I and II.
- Star Base: up to 2. It works as a supply depot (send resources in, train ships there with depot supplies), repairs its garrison and launches fleets. With the Warp Jammer research it blocks enemy warps within 25 units.
- Supply range: 30 units around your planets and 35 around Star Bases (+10 with Logistics). Fleets outside it get −20% speed and −20% attack.

## Fleets
- They launch only from your own bases (home, colony or Star Base). Command cap = 16 + 4×(HQ−1), +8 with Logistics. At most 4 fleets.
- Movement keeps only `from, to, startTick, speed`. Position = from + direction × speed × elapsed. A redirect re-anchors at the current position, so a fleet can be redirected, stopped, returned or set to chase at any time. Speed changes (supply, damage) re-anchor too.
- Orders: move, stop, return (merge into the nearest base and unload cargo), chase or attack (follows a moving target), mine (fills the hold, then returns), colonize, build a Star Base.
- Stance: **Aggressive** auto-chases hostile fleets inside sensor range. **Defensive** only fights when attacked. **Passive** runs home when a hostile is coming for it.
- Fleet speed = slowest ship.
- **Warp Retreat** (research): manual, or automatic when strength drops to 30% or less mid-battle. The fleet jumps to the nearest own base, loses 20% of its ships (at least 1), takes a −25% speed/attack "damaged" debuff for 60 s and has a 60 s cooldown. Enemy Star Base jammers block it.

## Ship designer
- Hulls (command points / slots / power): Corvette 1/3/6 (fast, 30% evasion), Frigate 2/3/8 (escort), Destroyer 2/4/12, Cruiser 4/6/16 (command aura, research), Battleship 8/8/26 (slow, 4% evasion, research), Carrier 8/6/22 (fighter bays, research).
- Weapons: Laser (×1.5 vs armor, ×0.5 vs shield), Railgun (×1.5 vs shield, ×0.75 vs armor), Autocannon (short range, ×2 vs corvettes), Torpedo (medium range, ignores shields, +25% per target size step, fires every other round, can be shot down by point defense), Artillery (long range, Cruiser+, big gun), Fighter Bay (carrier only, 3 shots, ignores range, can be shot down by point defense at 60% efficiency). Laser II and Railgun II come from research.
- Defense: Shield (regens 25% per round; the module value scales with hull size), Armor, Point Defense, Taunt Beacon (draws fire, adds armor).
- Utility: Engine (+15% speed, +4% evasion), Sensor (+15 detection range, +5% accuracy), Reactor (+6 power).
- Total module power cannot exceed the reactor budget. Designs compile into a stat block once on save. Templates ship for every hull.

## Battle (6 rounds, resolved instantly)
1. Range bands: long-range weapons fire from round 1, medium from round 2, short from round 3. Fighters fire every round.
2. Hit chance = weapon accuracy + bonuses − target evasion − tracking penalty. The tracking penalty is 8% per size step the shooter is larger than its target, ×1.5 for big guns. Hit chance is clamped to 5–95%.
3. Damage goes through shield, then armor, then hull, using each weapon's multiplier per layer. Torpedoes skip shields.
4. Target choice is weighted, and Taunt raises the weight. While enemy escorts (frigates) are alive, torpedoes, fighters and short-range guns can only hit ships of size 2 or smaller.
5. Formation bonus: 3 or more hull classes give +0.10 accuracy and ×1.1 evasion. A cruiser gives small hulls +5% accuracy and +3% evasion.
6. After 6 rounds with both sides alive, the side that lost the larger share of its strength retreats. The report records shots, hits, shot-down torpedoes and fighters, damage per layer and kills for every round.
- Measured balance (`test-sim.js`, 40 runs each): mixed 32-cmd fleet vs 4 battleships → mixed wins 40/40. Torpedo-corvette swarm beats battleships, flak/PD screen beats the swarm, and battleships beat the flak screen.

## Research
Cruiser → Battleship → Carrier hulls, Laser II, Railgun II, Colonial Admin I/II, Fleet Logistics, Warp Retreat → Warp Jammer.

## AI
Every 6 s each AI upgrades HQ when it can (and saves for it when only the cost blocks it, building warships only if its home guard is thin), otherwise its lowest-level allowed building; researches down a fixed list, builds mixed ships, colonizes the nearest free planet and launches fleets to hunt weaker pirates. After about 4 minutes it also attacks weak colonies (and later Star Bases); otherwise it mines asteroids.
