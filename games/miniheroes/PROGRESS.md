# Mini Heroes — PROGRESS

Read this first every session. Update it before ending a task.

## SOP (Code + Broz)
- Code: code only (build, fix, test). No research.
- Broz: research, play guides, references only. Never edits code. Writes findings to NOTES/ as short text.
- Hand off through files (TASKS.md, NOTES/), not bot-to-bot chat.
- One chat per feature/task. One clear combined instruction. Short reports to Hanz.
- Images/videos: convert to text in NOTES/ unless the visual itself matters.

## Status (2026-11-22)
- Live: 1.5.2 (sw cache mg-v30-miniheroes-152), repo /workspace/minigames/portal, branch main. Not pushed.
- Done: hex battle 22x16 with top/bottom wrap, camera pan/pinch, DEBUG overlay, FPS 30/60, quality High/Low, particle cap 150.
- Done: Broz chibi units + upgrades for all 6 factions, painted map/battle/UI, home screen, faction grid (data-driven), talent/policy tap-for-detail, win/lose, event popups, siege, spell fx, fog, water.
- Done: MAIN MENU button on setup screens + in-game MENU with confirm.
- Done: Heroes 3-style luck in combat (1.5.2).
- Balance (hex sim, N=40, luck 0 because the sim clears hero skills/arts): 1.5.2 matches a 1.5.1 control within noise (early necro ~73%, sylvan ~25%). The 44-59% gate was already missed on current 1.5.1 (and on the Nov 1 hex-raw baseline). Luck itself does not change the sim. Full logs: /workspace/minigames/balance/runs/luck152-summary.txt
- Push only when Hanz says "push".

## Design decisions
- Art must match unit names in data.js UNIT_DEFS: see NOTES/units.md before drawing anything.
- WebP transparent, 256px per unit, one sheet per faction, T1-T7 order + T8; upgrade sheets separate.
- T8: Castle Archangel, Necro Lich King, Sylvan Phoenix, Inferno Arch Fiend, Stronghold Thunder Titan, Dwarf Mountain King.
- Ranged fire first; attacker strikes first, defender retaliates once per round; random damage ranges, morale, luck.
- Luck: each living stack has luck -3..+3 (default 0). Sources: Luck secondary skill (Basic/Advanced/Expert = +1/+2/+3) and the Four-Leaf Clover artifact (+1). Both use existing skill/artifact hooks; no new map objects. After the random damage roll, positive luck has luck/24 chance of LUCKY (damage x2); negative luck has the same chance of Unlucky (damage x0.5). Applies to ranged, melee and retaliation. Undead and Machine stacks are immune (same as morale). Floating text LUCKY! (gold-green) / Unlucky (grey) plus a battle log line, same fx path as MORALE! (no extra particles). Luck and morale are shown on the hero panel/HUD and on stack inspect in battle.
- Upgraded unit costs same as base; upgrade buildings pricier; town shows only upgraded tier once built.
- Mobile budget: only battling factions' atlases loaded, <200 MB, 30 fps default.
- Next faction planned: Mage (later patch).

## To-do
- see TASKS.md
