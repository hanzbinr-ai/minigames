# Neutral monsters: painted art (Broz, 24 Nov 2026)

Hanz: map monster symbols for Wolf and the "giant" (Troll) are still the old pixel sprites (sprites.js L209-212 via SPR.unit on map, game.js:1528).
Goblin is already painted (stronghold row 0); Wolf and Troll have no entry in art/units.json.

Delivered sources (single figure on white, 1024x1024, same painted style as stronghold-base.jpg):
- tools/miniheroes-art/src/neutral-wolf.jpg  -> unit "Wolf" (faces right, snarling)
- tools/miniheroes-art/src/neutral-troll.jpg -> unit "Troll" (big, club) - keep it larger than Goblin/Wolf on map and in battle

For Code: please cut them like the mythic-<name>.jpg singles (cut_background + clean), bake into a small "neutral" atlas
(or append to stronghold), add Wolf/Troll to units.json so the map + battle use painted art, idle anim same as other units.
Suggested size vs Goblin (h 102): Wolf ~h 95 (wider), Troll ~h 165.
