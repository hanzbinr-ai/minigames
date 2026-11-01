#!/usr/bin/env python3
"""Mini Heroes art build.
1) Cuts the painted unit lineups in src/ (white background, 7 figures per row) into one WebP sprite atlas per
   faction: one row per unit (base, upgrade, mythic), 16 frames per row (idle 4, attack 4, hit 3, death 5).
2) Writes art/units.json (rows, frames, per-unit visual size) for render-pixi.js.
3) Makes town backdrops (art/town-<faction>.webp) and lineup preview images (lineups/<faction>.png).
Usage: python3 build_atlas.py      (run from anywhere; writes into games/miniheroes/art/)"""
import json, math, os, random
from collections import deque
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'games', 'miniheroes', 'art')
PREV = os.path.join(HERE, 'lineups')
CELL, BASE = 128, 122           # frame size and feet baseline; figures get >= 10px headroom (no cropped lances)
MAXH, MAXW = 110, 122
CELLS = {'castle': 192}      # chibi Castle: bigger frames so battle sprites are downscaled < 2x (crisp without mipmaps)
UI = 96                       # pre-baked UI portraits: 96px source, shown at 48 CSS px (2x)
def setcell(c):
    global CELL, BASE, MAXH, MAXW
    CELL, BASE, MAXH, MAXW = c, round(c * 122 / 128), round(c * 110 / 128), round(c * 122 / 128)
ANIMS = {'idle': 4, 'attack': 4, 'hit': 3, 'death': 5}
FACTIONS = {
  'castle': (['Peasant', 'Pikeman', 'Crossbowman', 'Griffin', 'Swordsman', 'Monk', 'Paladin'], ['Militia', 'Halberdier', 'Arbalester', 'Royal Griffin', 'Crusader', 'Zealot', 'Champion'], 'Archangel'),
  'necro': (['Skeleton', 'Zombie', 'Ghost', 'Vampire', 'Lich', 'Wraith Knight', 'Bone Dragon'], ['Skeleton Warrior', 'Plague Zombie', 'Spectre', 'Vampire Lord', 'Archlich', 'Dread Knight', 'Ghost Dragon'], 'Lich King'),
  'sylvan': (['Sprite', 'Wolf Rider', 'Elf Archer', 'Druid', 'Unicorn', 'Treant', 'Green Dragon'], ['Faerie', 'Moon Rider', 'Grand Elf', 'Elder Druid', 'Silver Unicorn', 'Ancient Treant', 'Emerald Dragon'], 'Phoenix'),
  'inferno': (['Imp', 'Hell Hound', 'Succubus', 'Demon', 'Efreet', 'Pit Fiend', 'Devil'], ['Familiar', 'Cerberus', 'Temptress', 'Horned Demon', 'Efreet Sultan', 'Pit Lord', 'Arch Devil'], 'Arch Fiend'),
  'stronghold': (['Goblin', 'Wolf Raider', 'Orc Axeman', 'Ogre Shaman', 'Roc', 'Cyclops', 'Behemoth'], ['Hobgoblin', 'Warg Raider', 'Orc Chieftain', 'Ogre Magi', 'Thunderbird', 'Cyclops King', 'Ancient Behemoth'], 'Thunder Titan'),
  'dwarf': (['Miner', 'Shieldbearer', 'Crossbow Engineer', 'Runesmith', 'Bear Rider', 'Steam Golem', 'Iron Dreadnought'], ['Foreman', 'Shieldguard', 'Siege Engineer', 'Runelord', 'Bear Lord', 'Iron Golem', 'Thunder Dreadnought'], 'Forge Colossus'),
}
MYTHIC_ORDER = ['castle', 'necro', 'sylvan', 'inferno', 'stronghold', 'dwarf']
CUTS = {'castle-base': [172, 352, 481, 700, 875, 1019], 'castle-up': [185, 362, 506, 722, 893, 1030],
        'mythic': [231, 425, 648, 854, 1054], 'stronghold-base': [135, 312, 506, 710, 890, 1078]}  # hand-measured where shadows touch
FLY = {'Griffin', 'Royal Griffin', 'Ghost', 'Spectre', 'Sprite', 'Faerie', 'Phoenix', 'Roc', 'Thunderbird', 'Vampire', 'Vampire Lord', 'Efreet', 'Efreet Sultan', 'Bone Dragon', 'Ghost Dragon', 'Green Dragon', 'Emerald Dragon', 'Archangel'}

def is_white(p, lo=226, spread=26): return min(p) > lo and max(p) - min(p) < spread

def cut_background(im):
    im = im.convert('RGB'); w, h = im.size; px = im.load(); bg = bytearray(w * h); q = deque()
    for x in range(w): q.extend(((x, 0), (x, h - 1)))
    for y in range(h): q.extend(((0, y), (w - 1, y)))
    while q:
        x, y = q.popleft(); i = y * w + x
        if bg[i] or not is_white(px[x, y]): continue
        bg[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx]: q.append((nx, ny))
    seen = bytearray(w * h)  # enclosed pure-white pockets (between legs / under wings)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or seen[i0] or not is_white(px[sx, sy], 236, 14): continue
            comp, q2 = [], deque([(sx, sy)]); seen[i0] = 1
            while q2:
                x, y = q2.popleft(); comp.append(y * w + x)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and not bg[j] and is_white(px[nx, ny], 228, 20): seen[j] = 1; q2.append((nx, ny))
            if len(comp) > 25:
                for j in comp: bg[j] = 1
    a = Image.frombytes('L', (w, h), bytes(0 if b else 255 for b in bg)).filter(ImageFilter.GaussianBlur(0.5))
    out = im.convert('RGBA'); out.putalpha(a); return out

def segments(rgba, n, key):
    a = rgba.split()[3]; w, h = a.size; ap = a.load()
    dens = [sum(1 for y in range(0, int(h * 0.80), 2) if ap[x, y] > 40) for x in range(w)]
    if key in CUTS:
        R = 3 if key.startswith('castle') else 40; cuts = [min(range(c - R, c + R + 1), key=lambda x: (dens[x], abs(x - c))) for c in CUTS[key]]
    else:  # the n-1 widest empty column gaps between the first and last figure
        xs = [x for x in range(w) if dens[x] > 0]; lo, hi = xs[0], xs[-1]; gaps, x = [], lo
        while x < hi:
            if dens[x] == 0:
                s = x
                while x < hi and dens[x] == 0: x += 1
                gaps.append((x - s, (s + x) // 2))
            x += 1
        if len(gaps) < n - 1:  # touching figures: fall back to the emptiest columns near even spacing
            step = (hi - lo) / n; gaps += [(0, min(range(int(lo + step * i - step * 0.3), int(lo + step * i + step * 0.3)), key=lambda x: dens[x])) for i in range(1, n)]
        cuts = sorted(c for _, c in sorted(gaps, reverse=True)[:n - 1])
    return list(zip([0] + cuts, cuts + [w]))

def degreen(fig):
    fig = fig.copy(); px = fig.load()
    for y in range(fig.height):
        for x in range(fig.width):
            r, g, b, a = px[x, y]
            if a and g > r + 12 and g > b + 12: px[x, y] = (0, 0, 0, 0)
    return fig

def clean(fig):
    a = fig.split()[3]; w, h = a.size; ap = a.load(); lab = [0] * (w * h); comps = []
    for sy in range(h):
        for sx in range(w):
            if ap[sx, sy] < 60 or lab[sy * w + sx]: continue
            n = len(comps) + 1; q = deque([(sx, sy)]); lab[sy * w + sx] = n; cnt = 0
            while q:
                x, y = q.popleft(); cnt += 1
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not lab[ny * w + nx] and ap[nx, ny] >= 60: lab[ny * w + nx] = n; q.append((nx, ny))
            comps.append(cnt)
    if not comps: return fig
    keep = {i + 1 for i, c in enumerate(comps) if c >= 0.12 * max(comps)}
    na = Image.new('L', (w, h), 0); nap = na.load()
    for y in range(h):
        for x in range(w):
            l = lab[y * w + x]
            if l in keep or (l == 0 and ap[x, y] > 0 and any(lab[yy * w + xx] in keep for xx, yy in ((min(w - 1, x + 1), y), (max(0, x - 1), y), (x, min(h - 1, y + 1)), (x, max(0, y - 1))))): nap[x, y] = ap[x, y]
    fig = fig.copy(); fig.putalpha(na); return fig.crop(fig.getbbox())

def scale_row(figs):
    """one scale per lineup (keeps relative sizes: an imp stays smaller than a devil), never too tiny, never cropped"""
    hs = sorted(f.height for f in figs); kc = MAXH / hs[len(hs) // 2] * 0.98
    out = []
    for f in figs:
        k = min(kc, MAXH / f.height, MAXW / (f.width * 1.08))
        k = max(k, min(0.62 * MAXH / f.height, MAXW / (f.width * 1.08)))
        out.append(f.resize((max(1, round(f.width * k * 1.08)), max(1, round(f.height * k))), Image.LANCZOS))  # 8% wider: reads better beside pixel art
    return out

def put(fig, dx=0, dy=0, sx=1.0, sy=1.0, rot=0.0, tint=None, tk=0.0, alpha=1.0, dissolve=0.0, seed=0):
    f = fig
    if sx != 1 or sy != 1: f = f.resize((max(1, round(f.width * sx)), max(1, round(f.height * sy))), Image.LANCZOS)
    if tint and tk:
        col = Image.new('RGBA', f.size, tint + (255,)); r = Image.blend(f, col, tk); r.putalpha(f.split()[3]); f = r
    layer = Image.new('RGBA', (CELL * 2, CELL * 2), (0, 0, 0, 0)); fx, fy = CELL - f.width // 2 + round(dx), CELL + (BASE - CELL) - f.height + round(dy) + CELL // 2
    layer.paste(f, (fx, fy - CELL // 2), f)
    if rot: layer = layer.rotate(rot, resample=Image.BICUBIC, center=(CELL + round(dx), BASE + round(dy)))
    cell = layer.crop((CELL // 2, 0, CELL // 2 + CELL, CELL)) if False else layer.crop((CELL - CELL // 2, 0, CELL + CELL // 2, CELL))
    a = cell.split()[3]
    if dissolve > 0:  # pixel dissolve: random holes that grow
        rnd = random.Random(seed); ap = a.load()
        for y in range(CELL):
            for x in range(CELL):
                if ap[x, y] and rnd.random() < dissolve: ap[x, y] = 0
    if alpha < 1: a = a.point(lambda v: round(v * alpha))
    cell.putalpha(a); return cell

def frames(fig, fly):
    out = []
    for i in range(4):
        t = i / 4 * 2 * math.pi
        out.append(put(fig, dy=(-3 * math.sin(t)) if fly else -1.5 * (1 - math.cos(t)), sy=1 + 0.02 * math.sin(t), sx=1 - 0.008 * math.sin(t)))
    for dx, rot, sx, sy in ((-4, 5, 0.97, 1.02), (7, -6, 1.04, 0.98), (11, -9, 1.06, 0.97), (3, -2, 1.0, 1.0)):
        out.append(put(fig, dx=dx, rot=rot, sx=sx, sy=sy))
    out.append(put(fig, dx=-7, rot=6, tint=(255, 255, 255), tk=0.85))         # hit: white flash + knockback
    out.append(put(fig, dx=-5, rot=4, tint=(255, 40, 40), tk=0.45))
    out.append(put(fig, dx=-2, rot=1, tint=(255, 40, 40), tk=0.15))
    for i, (rot, dis) in enumerate(((12, 0.0), (40, 0.0), (75, 0.15), (88, 0.45), (90, 0.8))):  # death: topple, then dissolve
        out.append(put(fig, dx=-4 * i, dy=1.5 * i, rot=rot, tint=(30, 20, 40), tk=0.1 * i, dissolve=dis, seed=i))
    return out

def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(PREV, exist_ok=True)
    man = {'cell': CELL, 'base': BASE, 'anims': {}, 'atlases': {}, 'cells': {}, 'ui': {}, 'units': {}}
    o = 0
    for k, n in ANIMS.items(): man['anims'][k] = [o, n]; o += n
    nfr = o; myth = {}
    mfigs = None
    mr = cut_background(Image.open(os.path.join(HERE, 'src', 'mythic.jpg')))
    mraw = [clean(mr.crop((max(0, a - 2), 0, min(mr.width, b + 2), mr.height))) for a, b in segments(mr, 6, 'mythic')]
    for fac, (base, up, mname) in FACTIONS.items():
        setcell(CELLS.get(fac, 128)); myth[fac] = scale_row(mraw)[MYTHIC_ORDER.index(fac)]
        rows = []
        for key, names in ((fac + '-base', base), (fac + '-up', up)):
            rgba = cut_background(Image.open(os.path.join(HERE, 'src', key + '.jpg')))
            crops = [rgba.crop((max(0, a - 2), 0, min(rgba.width, b + 2), rgba.height)) for a, b in segments(rgba, 7, key)]
            if key == 'castle-up': crops[1] = degreen(crops[1])  # neighbour's quiver arrows overlap the halberd
            figs = scale_row([clean(c) for c in crops])
            rows += list(zip(names, figs)); raws = None
        rows.append((mname, myth[fac]))
        atlas = Image.new('RGBA', (CELL * nfr, CELL * len(rows)), (0, 0, 0, 0)); ui = Image.new('RGBA', (UI * len(rows), UI), (0, 0, 0, 0))
        prev = Image.new('RGBA', (CELL * 8, CELL * 2 + 24), (34, 40, 52, 255))
        for r, (name, fig) in enumerate(rows):
            for i, fr in enumerate(frames(fig, name in FLY)): atlas.paste(fr, (i * CELL, r * CELL), fr)
            man['units'][name] = {'atlas': fac, 'row': r, 'w': fig.width, 'h': fig.height}
            k = (UI - 6) / max(fig.width, fig.height); pf = fig.resize((max(1, round(fig.width * k)), max(1, round(fig.height * k))), Image.LANCZOS)
            pf = pf.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2)); ui.paste(pf, (r * UI + (UI - pf.width) // 2, UI - 3 - pf.height), pf)
            pi = r if r < 7 else r - 7 if r < 14 else 7
            idle = frames(fig, False)[0]; prev.alpha_composite(idle, (pi * CELL, (0 if r < 7 else CELL) + (CELL if r == 14 else 0) * 0 + 12))
        fn = 'units-' + fac + '.webp'; atlas.save(os.path.join(OUT, fn), 'WEBP', quality=74, method=6, alpha_quality=85)
        man['atlases'][fac] = 'art/' + fn; man['cells'][fac] = CELL
        un = 'units-' + fac + '-ui.webp'; ui.save(os.path.join(OUT, un), 'WEBP', quality=86, method=6, alpha_quality=95); man['ui'][fac] = {'src': 'art/' + un, 'cell': UI}
        prev.convert('RGB').save(os.path.join(PREV, fac + '.png'))
        setcell(128)
        print(fac, len(rows), 'units', os.path.getsize(os.path.join(OUT, fn)) // 1024, 'KB')
    with open(os.path.join(OUT, 'units.json'), 'w') as f: json.dump(man, f, separators=(',', ':'))
    for fac in FACTIONS:  # town backdrops: 960 wide WebP
        src = os.path.join(HERE, 'src', 'town', fac + '.jpg')
        if os.path.exists(src):
            im = Image.open(src).convert('RGB'); im = im.resize((960, round(960 * im.height / im.width)), Image.LANCZOS)
            im.save(os.path.join(OUT, 'town-' + fac + '.webp'), 'WEBP', quality=72, method=6)

if __name__ == '__main__':
    main()
