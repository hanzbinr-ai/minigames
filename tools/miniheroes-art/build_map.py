#!/usr/bin/env python3
"""Mini Heroes map + battlefield art (painted, chibi style). Run after build_atlas.py.
src/map/ground.jpg (2x2 textures: grass, rough, road, water) -> art/map-ground.webp (4 seamless 256px tiles)
src/map/{towns,objects,deco}.jpg (white-background lineups) -> art/map-sprites.webp + art/map.json (packed, 3x display size)
src/map/battle.jpg -> art/battle-field.webp (1024x800; battlefield is 256x200 logical -> 4x)"""
import json, os
from PIL import Image, ImageChops, ImageFilter
import build_atlas as BA
HERE = BA.HERE; OUT = BA.OUT; SRC = os.path.join(HERE, 'src', 'map'); K = 3  # sprites baked at 3x their logical size

def seamless(im):
    w, h = im.size; sh = ImageChops.offset(im, w // 2, h // 2)
    m = Image.new('L', (w, h)); mp = m.load()
    for y in range(h):
        for x in range(w):
            d = min(x, w - 1 - x, y, h - 1 - y) / (w * 0.25); mp[x, y] = round(255 * min(1, d))
    return Image.composite(im, sh, m)

def ground():
    g = Image.open(os.path.join(SRC, 'ground.jpg')).convert('RGB'); q = g.width // 2; out = Image.new('RGB', (1024, 256))
    for i, (cx, cy) in enumerate(((0, 0), (1, 0), (0, 1), (1, 1))):
        t = g.crop((cx * q + 24, cy * q + 24, cx * q + q - 24, cy * q + q - 24)).resize((256, 256), Image.LANCZOS)
        out.paste(seamless(t), (i * 256, 0))
    out.save(os.path.join(OUT, 'map-ground.webp'), 'WEBP', quality=80, method=6)

def figs(name, rows, n):
    rgba = BA.cut_background(Image.open(os.path.join(SRC, name + '.jpg'))); h = rgba.height; out = []
    for r in range(rows):
        band = rgba.crop((0, r * h // rows, rgba.width, (r + 1) * h // rows)); bb = band.getbbox(); band = band.crop((0, bb[1], band.width, bb[3]))
        for a, b in BA.segments(band, n, name + str(r)): out.append(BA.clean(band.crop((max(0, a - 2), 0, min(band.width, b + 2), band.height))))
    return out

# logical display size (max side, px at TS=16) of each sprite
SIZES = {'town': 40, 'mine': 28, 'grove': 28, 'chest': 17, 'pile': 17, 'art': 16, 'hero': 26, 'tree': 24, 'rock': 22}
def main():
    ground()
    names = [('town', f) for f in BA.MYTHIC_ORDER] + [('mine', 'gold'), ('mine', 'wood'), ('mine', 'ore'), ('mine', 'gems'), ('grove', ''), ('chest', ''),
             ('pile', 'gold'), ('pile', 'wood'), ('pile', 'ore'), ('pile', 'gems'), ('art', ''), ('hero', 'player')] + [('tree', str(i)) for i in range(4)] + [('rock', str(i)) for i in range(4)]
    fs = figs('towns', 1, 6) + figs('objects', 2, 6) + figs('deco', 2, 4)
    items = []
    for (kind, v), f in zip(names, fs):
        s = SIZES[kind] * K / max(f.width, f.height); f = f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1, 50, 2))
        items.append((kind + (':' + v if v else ''), f))
        if kind == 'hero':  # AI hero: red banner instead of blue
            r = f.copy(); px = r.load()
            for y in range(r.height):
                for x in range(r.width):
                    R, G, B, A = px[x, y]
                    if A and B > R + 30 and B > G + 10: px[x, y] = (B, G // 2, R // 2, A)
            items.append(('hero:ai', r))
    W = 1024; x = y = rh = 0; pos = {}
    for k, f in items:
        if x + f.width > W: x = 0; y += rh + 2; rh = 0
        pos[k] = [x, y, f.width, f.height]; x += f.width + 2; rh = max(rh, f.height)
    sheet = Image.new('RGBA', (W, y + rh), (0, 0, 0, 0))
    for k, f in items: sheet.paste(f, tuple(pos[k][:2]), f)
    sheet.save(os.path.join(OUT, 'map-sprites.webp'), 'WEBP', quality=86, method=6, alpha_quality=95)
    b = Image.open(os.path.join(SRC, 'battle.jpg')).convert('RGB').resize((1024, 800), Image.LANCZOS)
    b.save(os.path.join(OUT, 'battle-field.webp'), 'WEBP', quality=78, method=6)
    json.dump({'k': K, 'ground': 'art/map-ground.webp', 'sprites': 'art/map-sprites.webp', 'field': 'art/battle-field.webp', 'frames': pos}, open(os.path.join(OUT, 'map.json'), 'w'), separators=(',', ':'))
    prev = Image.new('RGBA', sheet.size, (34, 40, 52, 255)); prev.alpha_composite(sheet); prev.convert('RGB').save(os.path.join(HERE, 'lineups', 'map-sprites.png'))
    print('sheet', sheet.size, len(items))
if __name__ == '__main__': main()
