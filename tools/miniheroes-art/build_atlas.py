#!/usr/bin/env python3
"""Mini Heroes art build: cut the Castle unit lineups (white background) into per-unit WebP sprite sheets
with idle / attack / hit / death frames, plus a JSON manifest the Pixi renderer reads.
Usage: python3 build_atlas.py   (writes games/miniheroes/art/)"""
import json, math, os
from collections import deque
from PIL import Image, ImageChops, ImageEnhance, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'games', 'miniheroes', 'art')
CELL, BASE = 128, 124          # frame size, feet baseline
SHEETS = {'castle-base.jpg': ['Peasant', 'Pikeman', 'Crossbowman', 'Griffin', 'Swordsman', 'Monk', 'Paladin'],
          'castle-up.jpg': ['Militia', 'Halberdier', 'Arbalester', 'Royal Griffin', 'Crusader', 'Zealot', 'Champion']}
ANIMS = {'idle': 4, 'attack': 4, 'hit': 3, 'death': 4}

def cut_background(im):
    """alpha = 0 for the white background connected to the border (flood fill), soft 1px edge"""
    im = im.convert('RGB'); w, h = im.size; px = im.load()
    bg = bytearray(w * h); q = deque()
    white = lambda p: min(p) > 225 and max(p) - min(p) < 28
    for x in range(w):
        for y in (0, h - 1): q.append((x, y))
    for y in range(h):
        for x in (0, w - 1): q.append((x, y))
    while q:
        x, y = q.popleft(); i = y * w + x
        if bg[i] or not white(px[x, y]): continue
        bg[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx]: q.append((nx, ny))
    # enclosed white pockets (between legs, under arms): pure-white regions bigger than a few pixels are background too
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i0 = sy * w + sx
            if bg[i0] or seen[i0] or not (min(px[sx, sy]) > 236 and max(px[sx, sy]) - min(px[sx, sy]) < 14): continue
            comp, q2 = [], deque([(sx, sy)]); seen[i0] = 1
            while q2:
                x, y = q2.popleft(); comp.append(y * w + x)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and not bg[j]:
                        p = px[nx, ny]
                        if min(p) > 228 and max(p) - min(p) < 20: seen[j] = 1; q2.append((nx, ny))
            if len(comp) > 25:
                for j in comp: bg[j] = 1
    a = Image.frombytes('L', (w, h), bytes(0 if b else 255 for b in bg)).filter(ImageFilter.GaussianBlur(0.5))
    out = im.convert('RGBA'); out.putalpha(a); return out

CUTS = {'castle-base.jpg': [152, 300, 452, 706, 875, 1037], 'castle-up.jpg': [160, 306, 475, 712, 881, 1044]}
def segments(rgba, n, src):
    """split the lineup at the emptiest column near each hand-measured cut (shadows ignored)"""
    a = rgba.split()[3]; w, h = a.size; ap = a.load()
    dens = [sum(1 for y in range(0, int(h * 0.78), 2) if ap[x, y] > 40) for x in range(w)]
    cuts = [min(range(c - 40, c + 41), key=lambda x: (dens[x], abs(x - c))) for c in CUTS[src]]
    return list(zip([0] + cuts, cuts + [w]))
def _old_segments(rgba, n):
    a = rgba.split()[3]; w, h = a.size; col = [0] * w; ap = a.load()
    for x in range(w):
        col[x] = sum(1 for y in range(0, h, 2) if ap[x, y] > 40)
    runs, x = [], 0
    while x < w:
        if col[x] > 1:
            s = x
            while x < w and col[x] > 1: x += 1
            runs.append([s, x])
        x += 1
    runs = [r for r in runs if r[1] - r[0] > 4]
    while len(runs) > n:  # merge the closest pair (spear tips, wing gaps)
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = gaps.index(min(gaps)); runs[i] = [runs[i][0], runs[i + 1][1]]; del runs[i + 1]
    assert len(runs) == n, (len(runs), runs)
    return runs

def clean(fig):
    """drop small detached bits (neighbour spear tips, specks): keep components >= 3% of the biggest"""
    a = fig.split()[3]; w, h = a.size; ap = a.load(); lab = [0] * (w * h); comps = []
    for sy in range(h):
        for sx in range(w):
            if ap[sx, sy] < 60 or lab[sy * w + sx]: continue
            n = len(comps) + 1; q = deque([(sx, sy)]); lab[sy * w + sx] = n; cnt = 0
            while q:
                x, y = q.popleft(); cnt += 1
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not lab[ny * w + nx] and ap[nx, ny] >= 60: lab[ny * w + nx] = n; q.append((nx, ny))
            comps.append(cnt)
    if not comps: return fig
    keep = {i + 1 for i, c in enumerate(comps) if c >= 0.12 * max(comps)}
    na = Image.new('L', (w, h), 0); nap = na.load()
    for y in range(h):
        for x in range(w):
            l = lab[y * w + x]
            if l in keep or (l == 0 and ap[x, y] > 0 and any(lab[yy * w + xx] in keep for xx, yy in ((min(w - 1, x + 1), y), (max(0, x - 1), y), (x, min(h - 1, y + 1)), (x, max(0, y - 1))))): nap[x, y] = ap[x, y]
    fig = fig.copy(); fig.putalpha(na); return fig

ZOOM = {'Paladin': 1.3, 'Champion': 1.12}  # mounted: lance/banner tips may leave the frame, the horse should read big
def fit(fig, name=''):
    fig = clean(fig); bb = fig.getbbox(); fig = fig.crop(bb)
    k = min((CELL - 6) / fig.width, (BASE - 4) * ZOOM.get(name, 1) / fig.height)
    return fig.resize((max(1, round(fig.width * k)), max(1, round(fig.height * k))), Image.LANCZOS)

def place(fig, dx=0, dy=0, sx=1.0, sy=1.0, rot=0.0, alpha=1.0, tint=None, tk=0.0):
    f = fig
    if sx != 1 or sy != 1: f = f.resize((max(1, round(f.width * sx)), max(1, round(f.height * sy))), Image.LANCZOS)
    if tint:
        col = Image.new('RGBA', f.size, tint + (255,)); r = Image.blend(f, col, tk); r.putalpha(f.split()[3]); f = r
    if rot:  # rotate around the feet
        pad = Image.new('RGBA', (f.width * 3, f.height * 2), (0, 0, 0, 0)); pad.paste(f, (f.width, 0), f)
        f = pad.rotate(rot, resample=Image.BICUBIC, center=(f.width * 1.5, f.height)); bb = f.getbbox(); ox = f.width / 3
        cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); x0 = round((CELL - fig.width * sx) / 2 + dx - ox); y0 = round(BASE - f.height / 2 + dy)
        cell.alpha_composite(f, (0, 0), (max(0, -x0), max(0, -y0))) if False else cell.paste(f, (x0, y0), f)
    else:
        cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); cell.alpha_composite(f, (round((CELL - f.width) / 2 + dx), 0), (0, max(0, f.height - BASE - round(dy)))) if f.height > BASE + dy else cell.paste(f, (round((CELL - f.width) / 2 + dx), round(BASE - f.height + dy)), f)
    if alpha < 1:
        a = cell.split()[3].point(lambda v: round(v * alpha)); cell.putalpha(a)
    return cell

def frames(fig, flyer):
    out = []
    for i in range(4):  # idle: breathing + gentle bob (wing flap for flyers)
        t = i / 4 * 2 * math.pi
        out.append(place(fig, dy=round(-1.5 * (1 - math.cos(t))) if not flyer else round(-3 * math.sin(t)), sy=1 + 0.018 * math.sin(t), sx=1 - 0.006 * math.sin(t)))
    for dx, rot, sx in ((-3, 4, 1.0), (6, -7, 1.03), (10, -10, 1.05), (3, -3, 1.0)):  # attack: wind up, lunge, strike, recover
        out.append(place(fig, dx=dx, rot=rot, sx=sx))
    for dx, tk in ((-5, 0.38), (-3, 0.18), (-1, 0.0)):  # hit: knocked back + red flash
        out.append(place(fig, dx=dx, tint=(255, 60, 60), tk=tk))
    for i, (rot, a) in enumerate(((10, 1.0), (35, 0.9), (65, 0.75), (85, 0.5))):  # death: topple backwards and fade
        out.append(place(fig, dx=-4 * i, dy=2 * i, rot=rot, alpha=a, tint=(40, 40, 60), tk=0.08 * i))
    return out

def main():
    os.makedirs(OUT, exist_ok=True); man = {'cell': CELL, 'base': BASE, 'anims': {}, 'units': {}}
    o = 0
    for k, n in ANIMS.items(): man['anims'][k] = [o, n]; o += n
    for src, names in SHEETS.items():
        rgba = cut_background(Image.open(os.path.join(HERE, 'src', src)))
        for name, (x0, x1) in zip(names, segments(rgba, len(names), src)):
            fig = fit(name=name, fig=rgba.crop((max(0, x0 - 2), 0, min(rgba.width, x1 + 2), rgba.height)))
            fr = frames(fig, 'Griffin' in name)
            sheet = Image.new('RGBA', (CELL * len(fr), CELL), (0, 0, 0, 0))
            for i, f in enumerate(fr): sheet.paste(f, (i * CELL, 0), f)
            fn = name.lower().replace(' ', '_') + '.webp'
            sheet.save(os.path.join(OUT, fn), 'WEBP', quality=82, method=6, alpha_quality=90)
            man['units'][name] = {'file': 'art/' + fn, 'w': fig.width, 'h': fig.height}
            print(name, fig.size, os.path.getsize(os.path.join(OUT, fn)), 'bytes')
    with open(os.path.join(OUT, 'castle.json'), 'w') as f: json.dump(man, f, indent=1)

if __name__ == '__main__':
    main()
