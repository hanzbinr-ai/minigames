# Blackhole Throne: progress

## Status (2026-11-26, v0.1.0)
Playable browser prototype, single player against 3 AI empires, pirates and 2 monsters. It is listed in the portal (`games.json` id `galaxy`) and cached by `sw.js` (cache `mg-v39-galaxy-010`).

## Decisions
- The sim is pure and deterministic (`sim.js`, `battle.js`, `ai.js`, `data.js`; fixed dt 0.25 s; JSON state) so it can move to a Node WebSocket server unchanged.
- Battles resolve instantly in 6 rounds with a stored per-round report (server-light). There is no real-time combat animation yet.
- Lasers beat armor and railguns beat shields (agreed in the room, same as Stellaris).
- Art: `sprites.js` is the only sprite lookup. Every id has a list of file-name aliases (checked in `art/`, then `art-src/`; `.png`, `.webp`, `.jpg`), and the first file that loads wins. Missing art falls back to procedural drawings. Planet types map to art as: rocky→terran, ice→arctic, energy→molten, gas→gas, home→planet-home. Neutral ship hulls get a faction-colour wash; pirate sprites are not tinted. The black-hole disk rotates slowly and is only drawn when on screen.
- Title lockup `art-src/logo-blackhole-throne.png` and favicon `art-src/logo-icon.png` are used when present, with a text title and portal icon as fallback.
- Timers are short for testing: buildings 4 + 3×level seconds, research 10–18 s, ships 3–16 s. Speed control 1×/2×/4×/8×.

## Tests
- `node games/galaxy/test-sim.js`: headless sim checks (balance counters, laser/railgun counters, redirect continuity, supply debuff, chase, warp losses/cooldown/jammer, colony capture, raid-only home, Star Base destruction drop, determinism, JSON round-trip).
- Browser harness (outside the repo): `/workspace/tmp/galaxy/shots.js` (puppeteer) at 461×1024@2, 915×412@2 and 1280×800. It checks touch pan/pinch, mouse drag/wheel, tap select, upgrade, designer save, mid-flight redirect by tap, battle report, save/continue, and the portal listing.

## To-do
- Online: Node WebSocket server running `sim.js`, accounts, a server-side clock (offline progress).
- Federations or alliances, rallies, shared Star Base defense.
- Carrier/fighter tuning. Corvette swarms are strong; watch the meta.
- Real cargo convoys to Star Bases (deposit is instant right now).
- Battle animation or replay of the report, sound, tutorial.
- Use more of Broz's art (stars, extra planet looks, pirate base, crystal swarm, throne-station placement).

## Known issues / gaps
- No offline progress: the sim only runs while the tab is open.
- The AI rarely attacks the player early (it waits about 4 minutes and only targets weak colonies), and it never uses custom designs or Star Bases.
- Repairs only happen for ships garrisoned at home or a Star Base (free). Colonies don't repair.
- Fleets that win sit idle where the battle happened. Aggressive fleets can chain-engage roaming pirates.
- Saves hold the last 40 battle reports (about 90–150 KB in localStorage).
- Missing optional art makes the alias loader request files that 404 (harmless, shows in the network log).
