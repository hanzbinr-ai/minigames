# Blackhole Throne: progress

## Status (2026-11-26, v0.1.0)
Playable browser prototype, single player against 3 AI empires, pirates and 2 monsters. It is listed in the portal (`games.json` id `galaxy`) and cached by `sw.js` (cache `mg-v46-galaxy-017`).

## Planet city view (2026-11-26, unpushed)
- `surface.js` (`NTSurf`): RoK-style planet surface at the top of the Home sheet, plus a Colony sheet ("Open planet" on an owned colony's card). One small canvas, redrawn only when its signature changes (levels, queue, selection, countdown second, art arriving, size); it rides `U.refresh` so it pauses with the rAF loop when the tab is hidden.
- Buildings drawn in slots by stage (1: Lv1-4, 2: Lv5-9, 3: Lv10+), with a level badge and a scaffold + countdown/progress on the upgrading one. Tap a building to open its card; the Upgrade button is the same `{type:'upgrade'}` act() as the list. The list stays below as a fallback.
- Colonies have no buildings in the sim, so the colony view shows the ground for its type, the colony dome, and resource/garrison info.
- Art (Broz, spec locked): `art-src/surface/` holds surface-home/terran/arctic/molten/gas (1080×1440), bld-<id>-1..3 (512²), bld-scaffold and surface-layout.json (`{"hq":{"x":.5,"y":.55,"scale":1}}`, bottom-centre fractions; per-surface nesting or pixel values also accepted). Surfaces by planet: home→surface-home, rocky→terran, ice→arctic, energy→molten, gas→gas, else surface-home, else procedural. Lookup is `art/surface/` (baked WebP) then `art-src/surface/`. Building files are only probed once the layout json or surface-home exists, which keeps the 404 noise down.
- Bake: `python3 games/galaxy/tools/bake-surface.py` (surfaces 810 px wide, buildings 320 px, layout copied) writes `art/surface/*.webp`. Commit only `art/surface/`.
- HUD: compact chips (1.5k, +4) on one row with nowrap. Checked at 412 px and wider.
- Test: `/workspace/tmp/galaxy/surface-shots.js` (412×915@2.75, 915×412, 1280×800): HUD one row, tap building, upgrade, scaffold, stages, colony; screenshots in `/workspace/minigames/shots/galaxy-surface-*.png`.

## Building progression (2026-11-26, unpushed)
- RoK-style unlocks, HQ cap and one requirement table (`BREQ` in data.js, summarised in DESIGN.md). Enforced in `act()` with errors such as "Unlocks at HQ 4", "Max = HQ level (upgrade HQ)" and "Needs Metal Mine Lv 4".
- The UI list and the city-view card share one `bldItem()` that shows Locked / Not built / Lv, unmet requirements in red, and a disabled button. The city view draws empty plots with Broz's `bld-locked` blueprint (procedural ghost fallback), a "🔒 HQ N" or "＋ Build" pill, and no level badge.
- Old saves load unchanged. The AI saves for HQ and reaches HQ 5–6 in 20 minutes (test).

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
- City view: no pan or zoom inside the surface (the fit shows all 8 slots). Placeholder buildings are simple isometric boxes until Broz's art is baked. Colonies have no buildings in the sim yet.
- No offline progress: the sim only runs while the tab is open.
- The AI rarely attacks the player early (it waits about 4 minutes and only targets weak colonies), and it never uses custom designs or Star Bases.
- Repairs only happen for ships garrisoned at home or a Star Base (free). Colonies don't repair.
- Fleets that win sit idle where the battle happened. Aggressive fleets can chain-engage roaming pirates.
- Saves hold the last 40 battle reports (about 90–150 KB in localStorage).
- Missing optional art makes the alias loader request files that 404 (harmless, shows in the network log).
