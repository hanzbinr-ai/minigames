# Mini Heroes — PROGRESS

Read this first every session. Update it before ending a task.

## SOP (Code + Broz)
- Code: code only (build, fix, test). No research.
- Broz: research, play guides, references only. Never edits code. Writes findings to NOTES/ as short text.
- Hand off through files (TASKS.md, NOTES/), not bot-to-bot chat.
- One chat per feature/task. One clear combined instruction. Short reports to Hanz.
- Images/videos: convert to text in NOTES/ unless the visual itself matters.

## Status (2026-11-22)
- Live: 1.5.5 (sw cache mg-v35-miniheroes-155), repo /workspace/minigames/portal, branch main. Not pushed.
- Done: hex battle 22x16 with top/bottom wrap, camera pan/pinch, DEBUG overlay, FPS 30/60, quality High/Low, particle cap 150.
- Done: Broz chibi units + upgrades for all 6 factions, painted map/battle/UI, home screen, faction grid (data-driven), talent/policy tap-for-detail, win/lose, event popups, siege, spell fx, fog, water.
- Done: MAIN MENU button on setup screens + in-game MENU with confirm.
- Done: Heroes 3-style luck in combat (1.5.2).
- Done: 1.5.4 painted fantasy UI theme (Mini Heroes only; portal style.css unchanged). Cinzel + Nunito self-hosted OFL woff2, navy-gold palette, parchment panels, rounded gold frames, image-rendering auto, Title Case chrome labels, canvas text uses Cinzel with a dark-brown stroke. Screenshots: /workspace/minigames/shots/theme-*.png
- Done: 1.5.5 theme polish from NOTES/theme-pass-154.md (items Code was asked to fix). Painted `units-*-ui.webp` portraits in faction pick / town dwellings / garrison (units.json loaded early, not gated on deferred Pixi). Hero portraits use Broz sheets (`art/heroes-ui.webp` + `heroes-extra-ui.webp` + `heroes.json`); paint list was NOTES/hero-portraits-needed.md. Fog edge is a feathered upsampled mask (Low quality = 2x, no blur). Battle grass uses battle-field.webp cover-cropped at uniform scale; obstacles scaled to CW*2.7. Home art extends down toward the buttons with a navy gradient fade (checked 360/412/460/desktop). "theme shot" was never in game source (screenshot-script leftover); no other debug leftovers found in msg/startGame. Screenshots: /workspace/minigames/shots/polish-*.png
- Done: 1.5.5 home layout follow-up — title-safe 180% art (full MINI HEROES + elf/necro), full-height blurred fill behind the buttons so there is no flat navy band; sw mg-v34-miniheroes-155. Shots: /workspace/minigames/shots/polish-home-*.png
- Done: Portrait home restack per Hanz — castle scene (`town-castle.webp`) behind the title, character lineup (`home-heroes.webp`) just above the buttons, blur fill removed. Dedicated castle/logo still needed from Broz: NOTES/home-castle-needed.md. SW mg-v35-miniheroes-155.
- Done: 1.5.3 home-menu icon crops. build_ui.py was slicing sheet 16 with a shared (button_x - 52, 34x34) box that sat too far right, so CONTINUE/NEW GAME/CAMPAIGN (and slightly DUEL) icons were clipped and showed the first letter of the label. Recropped from the painted icon centers ([92, 274, 461, 656, 832], y 510, 42x42) and regenerated home-i0..4.webp. In-game HUD uses resImg / .ico atlas, not these files.
- SW: skipWaiting + clients.claim were already in sw.js. The game page did not register the worker (only portal ads.js did), and neither path called registration.update() or reloaded on controllerchange — so a phone that only opens /games/miniheroes/ could keep a stale document (Hanz's screenshot still said v1.5.0). Game page now registers ../../sw.js, both paths call update(), and both reload once on controllerchange.
- Balance (hex sim, N=40, luck 0 because the sim clears hero skills/arts): 1.5.2 matches a 1.5.1 control within noise (early necro ~73%, sylvan ~25%). The 44-59% gate was already missed on current 1.5.1 (and on the Nov 1 hex-raw baseline). Luck itself does not change the sim. Full logs: /workspace/minigames/balance/runs/luck152-summary.txt
- Push only when Hanz says "push".

## Design decisions
- UI theme: painted fantasy (navy-gold + parchment, Cinzel/Nunito). Mini Heroes only; other portal games keep the retro theme until Hanz asks otherwise.
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
