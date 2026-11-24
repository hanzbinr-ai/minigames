# Mini Heroes — PROGRESS

Read this first every session. Update it before ending a task.

## SOP (Code + Broz)
- Code: code only (build, fix, test). No research.
- Broz: research, play guides, references only. Never edits code. Writes findings to NOTES/ as short text.
- Hand off through files (TASKS.md, NOTES/), not bot-to-bot chat.
- One chat per feature/task. One clear combined instruction. Short reports to Hanz.
- Images/videos: convert to text in NOTES/ unless the visual itself matters.

## Status (2026-11-23)
- Live (GitHub Pages): 81c0c70 (1.6.0, sw mg-v36-miniheroes-160). Local, NOT pushed: 1.6.1 map HUD (sw mg-v37-miniheroes-161) — waiting for Hanz to say "push".
- Done: 1.6.1 map HUD doesn't hide the map (Hanz: castle/heroes covered by the hero name panel on Redmi Note 14). Start is always (2,2), so the camera clamp (x,y >= 0) parked the castle under the chip.
  - Hero chip compact (32px portrait, small bars, 60% bg, ~111x50 vs 149x82). Tap = collapse to portrait + thin bars (localStorage mh-chip-min); Hero button opens the hero. Chip goes 30% + click-through while the selected hero is drawn under it (chipFade).
  - Camera: hudIns() measures chip (top), zoom buttons (right), minimap (bottom); clampCam lets the map edge scroll to the free-area edge, centerOn targets the free area's centre (select/next/center/walk/AI/start; first HUD frame re-centres). Zoom buttons 32px.
  - Shots: shots/before-map-{461x1024,390x844,360x800,1280x800}{,-br}.png vs shots/after-map-*.png, shots/after-chip-{min,fade}-461x1024.png. Hero/town under HUD after: 0 in all (before: castle sprite under the chip at start, hero at bottom-right fully under the minimap).
- Done: 1.6.0 Mage faction (7th faction, Hanz approved "Ok neh gas"). Spec: NOTES/mage-faction-draft.md, art notes: NOTES/mage-style.md.
  - data.js: 7 UNIT_DEFS (Gremlin→Master Gremlin … Giant→Storm Giant) + `upRange` mod (only the upgrade shoots: Master Gremlin range 5). FACTIONS.mage (town Starhold, heroes Solmyr/Josephine, spec Leyline +2 SP), Library building (1000g + 2 gems), policies codex/constructs, AI_POLICY_PREF, TECH.mage (m1a..m6c, capstone ARCANUM), START_SKILLS, tavern extras Astral/Iona/Cyra.
  - game.js: Leyline in stat(h,'sp'); Library `study()` = 2 gems → 0.5 RP (town + tech panel, AI studies when gems > 4); spells cast in battle +0.2 RP each (battle cap); ARCANUM +15% Mage dmg after a spell that battle; Codex = Guild 1 also teaches Lightning Bolt; Living Constructs = Machines +2 def.
  - campaign.js: Archon (T8) from Storm Giant. Faction pickers, duel, random AI and neutral towns pick Mage via FACTION_KEYS. No new campaign mission.
  - Art: build_atlas.py now takes `ONLY=mage` (rebuilds one faction, merges units.json, leaves towns/other atlases alone) and `cc_figs` (splits a lineup by alpha blobs; Gremlin's ball and the Gargoyle wing overlap in x). Archon read from src/mythic-archon.jpg, scaled against mythic.jpg. Output art/units-mage.webp 3072x2880 + units-mage-ui.webp 1440x96. Tech icons: Broz painted tal_mage_0..5 into art/icons.webp row y=320 (x 576..896); cells in ui-art-data.js, generic fallback removed. build_ui.py carries those 6 cells over from the existing icons.webp on rebuild (asserts 89 source icons first).
  - Home: portrait uses art/home-castle.webp (top 64%) + art/home-logo.webp (img, replaces the CSS title), home-heroes.webp at 1280/445 with 7 heroes; desktop uses Broz's 1280x720 home.webp (logo baked in). Version label v1.6.0.
  - Balance: Mage at draft costs won only 8-18% → Mage-only HEX_TUNE [0.85, 0.92, 0.89]. N=40: Mage early 45.6% / mid 65.6% / late 50.6%. Other factions untouched. balance/runs/mage160-summary.txt
  - Shots: /workspace/minigames/shots/mage-*.png
  - Battle portrait fix (pre-existing since <=1.5.5, reproduced at 22a0404): the battlefield is a landscape cylinder (556x336, rows wrap), so on a portrait phone zoom z=1 (fit width, the pinch-out minimum) showed ~3.2 dimmed stacked copies and the default z (capped 2.4) still ~1.35 copies. battleView() now has zMin = zoom where one band fills the height; z is clamped to [zMin, max(4, 1.6*zMin)] and on narrow screens the camera opens on your own army (left). Portrait now shows ~30% of the field width, pan sideways; desktop unchanged (z~1, whole field). Shots: shots/wt22a-battle-* (before) and shots/mage160fix-battle-* (after).

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
- Mage added in 1.6.0 (T8 Archon). Next faction: none planned.

## To-do
- see TASKS.md

## 1.6.2 (24 Nov 2026, local, not pushed)
- Phone landscape (orientation:landscape, max-height<500): slim one-row top bar, action buttons in a right column (map + battle), smaller left message. New Rotate button (touch only) = fullscreen + lock landscape, tap again to unlock.
- Neutral Wolf + Troll painted (Broz src/neutral-*.jpg); build_atlas.py bakes a "neutral" atlas (ONLY=neutral), atlas code moved into bake(). Map + battle verified (shots/neutral-*).
- Map monster icons ~half size (13/96, was 24/96), threat flag moved down; route preview is a solid line (black outline, green in reach, red past MP) instead of dots.
- Battle: zoom out down to z=1 (whole field); while the field is shorter than the view only one copy is drawn, centred, no vertical scroll. Portrait opens on the whole field. Shots: shots/v162-*.
- Battle obstacles drawn as linear Pixi sprites from battle-props.webp (were baked into the 1x bg canvas and upscaled nearest -> looked pixel on phones). Art was already painted.
