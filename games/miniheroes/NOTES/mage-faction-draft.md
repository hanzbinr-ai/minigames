# Mage faction draft (approved by Hanz 2026-11-22, implemented in 1.6.0)

Implemented as written except: costs use Mage HEX_TUNE [0.85, 0.92, 0.89] (sim), Library study = 2 gems → 0.5 RP, battle spells +0.2 RP each, Codex = Guild 1 also teaches Lightning Bolt, Archon move 5 (standard T8 formula). Key `mage`. Town **Starhold**. Col `#98b0fc`. Pal: marble wall `#d8d0c8`, blue roof `#3c5ca8`, sky `[140,180,230]`, ground `#6c8c6c`, emb `#f8e0a0`. Identity: Heroes 3 Tower — wizards, constructs, djinn. Not a second Stronghold (no Thunder Titan) and not Dwarf machines (no Iron Golem).

**Unique mechanic — Leyline:** all Mage heroes +2 Spell Power (same size as Bastion +1 def / Warchief +1 att; distinct from Inferno’s +25% spell damage). Hex sim clears hero SP, so unit balance is tuned separately.

**Research (rp):** Study — gems spent at the Library, plus spells the hero casts in battle.

**Mage-only building (like Inferno’s Pit):** Library — `{gold:1000, gems:2}`, req none. Spend gems for research.

**Mage-only policies (2, like the others):** `codex` (arcane) Mage Guilds teach 1 extra spell; `constructs` (military) Machine stacks +2 defense. AI_POLICY_PREF: `['tax','codex','conscript','constructs','warchest','manafont']`.

## Existing stat curves (base units, after HEX_TUNE)

Template T1–T7: HP 6/14/18/30/50/85/170 · atk 4/6/8/10/13/16/20 · dmg mid 2/3/4.5/8/12.5/19.5/35 · cost 50/130/220/400/750/1350/2900 · growth 14/9/7/5/3/2/1. Cross-faction averages sit on that line. Faction flavour: Castle/Dwarf tanky (avg HP ~59, Dwarf def 12.7); Stronghold cheap glass (HP 49, def 8, dmg 13.2, cost 704); Necro cheapest (cost 714) with raise; Sylvan pricey (865); Inferno late-game costly (924). T8 is not in UNIT_DEFS: campaign.js clones the T7 *upgrade* with +6 att/def, HP ×1.8, dmg ×1.5, move +1, add Fly+SpellImm, cost 9000, growth 0.

Mage starts HEX_TUNE `[1,1,1]`. Costs stay near the template. Upgrades use the global rule (+2 att/def, HP/dmg ×1.2; +1 move on odd tiers).

## Roster (UNIT_DEFS mods → these base stats)

Tier | Base → Upgrade | Role | HP | A/D | Dmg | Spd | Cost | Gr | Special (base / +upgrade)
---|---|---|---:|---|---|---:|---:|---:|---
T1 | Gremlin → Master Gremlin | melee → ranged | 6 | 4/2 | 1–3 | 3 | 50 | 14 | Swarm / **upgrade-only range 5** (needs a small `upRange` hook; today `range` applies to both forms)
T2 | Stone Gargoyle → Obsidian Gargoyle | flyer | 13 | 6/7 | 2–4 | 5 | 130 | 9 | Fly, Machine / Tough
T3 | Stone Golem → Marble Golem | melee tank | 21 | 8/9 | 3–5 | 2 | 225 | 7 | Machine, Tough / SpellImm
T4 | Mage → Arch Mage | ranged | 26 | 10/8 | 6–10 | 4 | 415 | 5 | range 6, ManaSteal / Splash
T5 | Djinn → Elder Djinn | flyer | 48 | 13/12 | 10–15 | 6 | 750 | 3 | Fly, NoRetal / Blind
T6 | Naga → Naga Queen | melee | 85 | 18/16 | 16–26 | 4 | 1415 | 2 | NoRetal / Cleave
T7 | Giant → Storm Giant | ranged | 178 | 20/21 | 28–42 | 4 | 2960 | 1 | range 5, RockThrow / SpellImm
T8 | **Archon** (mythic, from Storm Giant) | flyer | ~385 | 28/29 | 51–75 | 6 | 9000 | 0 | standard T8 formula + inherited SpellImm (not “Thunder Titan”)

Machines (Gargoyles, Golems) are luck/morale-immune, same as Dwarf golems. T4 is the glass shooter; T3/T6 hold the line; T5/T2 fly; T7 is a shooting giant (H3 Titan role, fresh name).

## Buildings

Shared tree unchanged: fort, tavern, hall, capitol, market, citadel, guild1, guild2, dw1–dw7, up1–up7. Plus **Library** (`faction:'mage'`). No Mage Guild 3 (game only has two spell levels). AI_BUILD_ORDER already skips unknown/other-faction buildings.

## Heroes

Faction spec is shared (Leyline), same as the other six. Classes are flavour; start skills are the real hook. Official: **Solmyr** (Wizard) `{wisdom:1, scholar:1}`; **Josephine** (Alchemist) `{wisdom:1, armorer:1}`. Tavern pool adds Astral, Iona, Cyra (avoid names already in ALL_HERO_NAMES).

**Tech** (6×3, keys `m1a`…`m6c`): T1 economy/growth/build-cost; T2 mana or Library RP / growth / cheaper units; T3 Gremlins+Gargoyles / Golems / Mages; T4 Djinn / Naga / Giants; T5 all +SP-adjacent or +def / +dmg / Machines +HP; capstone **ARCANUM** (after a spell is cast, all Mage stacks +15% dmg that battle) or all +15% HP / Giants+Archon +att.

## Art for Broz

Live pipeline (not the stale “256px, separate baked upgrade sheet” line in units.md / PROGRESS): Broz paints source lineups; `tools/miniheroes-art/build_atlas.py` bakes the atlas. Chibi, painted, thick outline, **white background**.

- `tools/miniheroes-art/src/mage-base.jpg` and `mage-up.jpg`: **1280×720**, 7 figures left-to-right T1–T7 (base, then upgrades).
- Add **Archon** to `src/mythic.jpg` (1280×720, current 6 T8s) or supply a same-style crop. Baked atlas: `art/units-mage.webp` **3072×2880**, 16×15 cells of **192px**, rows 0–6 base, 7–13 upgrades, 14 Archon; frames idle 4 / attack 4 / hit 3 / death 5.
- UI strip `art/units-mage-ui.webp` **1440×96** (15×96px, same order) — usually baked from the atlas.
- Town: source `src/town/mage.jpg` **1280×720** (marble spire / observatory); baked `art/town-mage.webp` **960×540**.
- Heroes: 192×192 bust, navy vignette, rounded alpha (r=18), same as NOTES/hero-portraits-needed.md. Append row 6 to `art/heroes-ui.webp` (**384×1344**): Solmyr col 0, Josephine col 1. Also `art/heroes/Solmyr.webp`, `Josephine.webp`, and optional extras on a new strip or an extended `heroes-extra-ui.webp`. Update `art/heroes.json`.
- Home: add a 7th Mage character to `art/home-heroes.webp` (now 1280×367, six figures) and desktop `art/home.webp` (1280×587).

## Balance and sim

Target **44–59%** wins in the hex sim, early (T1–3), mid (T1–5), late (T1–7 upgraded). Sim: `/workspace/minigames/balance/sim.js` (Puppeteer vs local game; matrix already loops `FACTION_KEYS`, so adding `mage` to UNIT_DEFS + FACTIONS is enough). Logs: `/workspace/minigames/balance/runs/`. N=40, luck 0 (sim clears skills/arts). Gate is already missed on 1.5.1 (Necro ~73%, Sylvan ~25%); do not block Mage on that retune. Start HEX_TUNE `[1,1,1]`, then nudge cost bands or mods.

## Implementation (after approval)

1. data.js: UNIT_DEFS + `upRange` hook, FACTIONS.mage (spec Leyline, rp, pal, heroes), HEX_TUNE, Library, 2 policies, AI_POLICY_PREF, TECH.mage, START_SKILLS, ALL_HERO_NAMES.
2. game.js: apply +2 SP from Leyline; Library gem-for-RP (mirror Inferno Pit); research tick; procedural sprite fallback until art lands.
3. campaign.js: MYTHIC / MYTHIC_BASE Archon ← Storm Giant. No new campaign mission in this patch (current 6 stay Castle-led). Random maps / duel / AI pick Mage via FACTION_KEYS.
4. Art: Broz sources → build_atlas.py → units.json + SW cache (`units-mage.webp`, `-ui`, `town-mage`, hero sheets, home). Home grid is already data-driven.
5. Hex sim N=40; tune; screenshot pass; phone test; push only when Hanz says push.
