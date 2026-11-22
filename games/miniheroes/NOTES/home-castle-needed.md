# Home portrait castle scene — paint request (Broz)

Hanz (2026-11-22): on portrait home, put a castle scene at the top (behind the MINI HEROES title) and move the character lineup down to the middle, just above the buttons. No blurred fill.

## Meanwhile (shipped in this patch)

- Top: existing painted `art/town-castle.webp` (Castle town backdrop, 960×540). It is a full town-on-a-hill, including scaffolding and a grassy foreground — good art, but not designed as a title backdrop.
- Title: CSS `Cinzel Decorative` over the castle (the painted logo in `home.webp` is baked into the sky and cannot be cleanly cut out).
- Characters: crop of the lineup from `home.webp`, saved as `art/home-heroes.webp` (1280×367, top faded), placed just above the buttons at 100% width so all six stay in frame.
- Desktop (landscape) still uses the original `home.webp` cover composition.

## Please paint

1. **Portrait home top** — `art/home-castle.webp`
   - Painted fantasy castle scene (sky + castle), no characters, no title.
   - Suggested size: **768×1024** or **1080×1440** (portrait-friendly). Transparent not required.
   - Lighting: warm sunset / golden hour, so it can sit above the existing character strip (sunset left, cooler mountains right) without a hard lighting break.
   - Keep the upper third relatively open (sky / towers) so the title can sit on it with margin.
   - Lower third can fade into dusk or a ridge, to meet the character strip.
   - Navy-gold palette, same world as town-castle / home.webp.

2. **Transparent painted title** — `art/home-logo.webp`
   - The existing “MINI HEROES” stone-and-gold logo, cut out of `home.webp` (or redrawn to match).
   - **Transparent WebP**, no sky. Enough padding around the wings and diamond.
   - Suggested width **1400–1600 px** so it stays sharp on a 3× 412 CSS px screen.

Optional instead of (1)+(2): one **full portrait home sheet** (`art/home-portrait.webp`, e.g. 1080×1920) with castle in the top, title baked or left open, character lineup in the middle, and dark clear space in the bottom third for the five menu buttons.

When these land, Code should swap them in for `town-castle.webp` + the CSS title, and keep desktop on `home.webp` unless a new landscape sheet is provided.

## Delivered by Broz (2026-11-22)

- `art/home-castle.webp` — 768×1024, golden-hour castle on a cliff, open sky in the upper third, bottom fades to dark navy. No characters, no title.
- `art/home-logo.webp` — 1438×838 transparent WebP, redrawn MINI HEROES stone-and-gold logo (wings + blue diamond), ~60 px padding, green-keyed and despilled. Checked on navy: clean edges.
