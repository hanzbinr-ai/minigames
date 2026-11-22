# Hero portraits needed (Mini Heroes 1.5.5)

Painted unit UI sheets (`art/units-*-ui.webp`) exist. Painted hero portraits were delivered 2026-11-22 and wired in 1.5.5 from the sheets + `art/heroes.json` (runtime does not fetch the 18 individual files). Procedural `SPR.portrait` remains a fallback for unknown names.

## Spec

- Format: transparent WebP, painted fantasy (navy-gold UI, not pixel art).
- Cell size: **192×192 px** (3× the 64 CSS px hero card, sharp on 3× phone screens).
- Crop: bust / head-and-shoulders, slight 3/4 toward camera, readable at 40 px.
- Official sheet (preferred): `art/heroes-ui.webp`
  - 2 columns (the two official heroes of a faction) × 6 faction rows
  - Sheet size: **384×1152**
  - Row order matches `FACTIONS` in `data.js` (castle, necro, sylvan, inferno, stronghold, dwarf)
- Extras strip: `art/heroes-extra-ui.webp`, **1152×192** (one row of six, left to right)
- Manifest: `art/heroes.json`

```json
{
  "cell": 192,
  "cols": 2,
  "src": "art/heroes-ui.webp",
  "heroes": {
    "Roland": {"row": 0, "col": 0},
    "Lyra": {"row": 0, "col": 1}
  }
}
```

Individual files are also fine: `art/heroes/<Name>.webp` at 192×192, same names as below.

## Official faction heroes (paint first)

| Name | Faction | Sheet row, col | Filename if separate |
|---|---|---|---|
| Roland | Castle | 0, 0 | art/heroes/Roland.webp |
| Lyra | Castle | 0, 1 | art/heroes/Lyra.webp |
| Sandro | Necropolis | 1, 0 | art/heroes/Sandro.webp |
| Vidomina | Necropolis | 1, 1 | art/heroes/Vidomina.webp |
| Sylva | Sylvan | 2, 0 | art/heroes/Sylva.webp |
| Alaron | Sylvan | 2, 1 | art/heroes/Alaron.webp |
| Xeron | Inferno | 3, 0 | art/heroes/Xeron.webp |
| Calid | Inferno | 3, 1 | art/heroes/Calid.webp |
| Tarnum | Stronghold | 4, 0 | art/heroes/Tarnum.webp |
| Crag | Stronghold | 4, 1 | art/heroes/Crag.webp |
| Gareth | Dwarf | 5, 0 | art/heroes/Gareth.webp |
| Mira | Dwarf | 5, 1 | art/heroes/Mira.webp |

## Name-pool extras (`art/heroes-extra-ui.webp`)

These names can be hired at any town (see `ALL_HERO_NAMES` in `data.js`). Give each a distinct face; faction styling is optional. Left to right on the extras strip:

| Name | Col | Filename if separate |
|---|---|---|
| Thant | 0 | art/heroes/Thant.webp |
| Moandor | 1 | art/heroes/Moandor.webp |
| Elysia | 2 | art/heroes/Elysia.webp |
| Brann | 3 | art/heroes/Brann.webp |
| Korg | 4 | art/heroes/Korg.webp |
| Nyx | 5 | art/heroes/Nyx.webp |

List extras in `art/heroes.json` as well (`src` may point at the extras strip).

## Used in game

- `#chip img` 40×40
- `.hcard img` 64×64
- Keyed by hero `name` only (same portrait for player/AI of that name)

## Delivered by Broz (2026-11-22)
- art/heroes-ui.webp (384x1152, rows castle..dwarf), art/heroes-extra-ui.webp (1152x192), art/heroes/<Name>.webp (18 files, 192x192), art/heroes.json (extras under "extras").
- Soft rounded alpha corners (r=18) so it sits in the gold frame; background is dark navy vignette, not fully transparent (reads better at 40px).

- Wired in 1.5.5: HUD chip, hero panel, side card, level-up, town army / in-town picker, meet columns, battle header. Sheets + json only (SW cache: heroes.json, heroes-ui.webp, heroes-extra-ui.webp).
