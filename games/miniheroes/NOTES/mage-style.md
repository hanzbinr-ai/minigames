# Mage faction — style (Broz)

- Town: `art/town-mage.webp` 960×540, same painted style/angle as town-castle. Snowy mountain plateau, white-marble spires with glowing crystal tops, central wizard tower, library dome, observatory, two golem statues at the gate, rune circles on the plaza, floating books and rock islands, aurora sky.
- Palette: arcane blue #3A4FC8, violet #7B4FD6, crystal glow #9FD8FF, marble #E8E6F0, gold trim #D4A84A, navy shadows #141E3C.
- Units (pending NOTES/mage-faction-draft.md): chibi like other factions; robes in blue/violet with gold trim, golems in marble/brass with blue crystal cores.

## Delivered by Broz (2026-11-22), per NOTES/mage-faction-draft.md
- Sources (1280×720, white bg, chibi, T1–T7 left→right):
  - `tools/miniheroes-art/src/mage-base.jpg`: Gremlin, Stone Gargoyle, Stone Golem, Mage, Djinn, Naga, Giant
  - `tools/miniheroes-art/src/mage-up.jpg`: Master Gremlin, Obsidian Gargoyle, Marble Golem, Arch Mage, Elder Djinn, Naga Queen, Storm Giant
  - `tools/miniheroes-art/src/mythic-archon.jpg`: Archon alone (painted style like mythic.jpg). Code: crop/append it to mythic.jpg or read it separately.
  - `tools/miniheroes-art/src/town/mage.jpg`: town source (baked art/town-mage.webp already there)
- Heroes: `art/heroes-ui.webp` now 384×1344 (row 6: Solmyr col 0, Josephine col 1). `art/heroes-extra-ui.webp` now 1728×192 (Astral col 6, Iona col 7, Cyra col 8). `art/heroes/{Solmyr,Josephine,Astral,Iona,Cyra}.webp`. `art/heroes.json` updated. Backups: /workspace/tmp/mage-bak/.
- Not done yet: the 7th Mage character in home-heroes.webp / home.webp. Atlas + UI strip are baked by Code's build_atlas.py.
- Home (2026-11-22): `art/home.webp` repainted with 7 heroes (Mage wizard between lich and orc). NOTE size is now **1280×720** (was 1280×587); Code please check desktop cover crop. `art/home-heroes.webp` re-cut from it, now **1280×445** (was 1280×367, taller so heads are not cut), top 50px faded. Source `tools/miniheroes-art/src/home-7.jpg`. Old files in /workspace/tmp/mage-bak/.
