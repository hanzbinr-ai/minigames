"""Slice Broz UI sheets (src/broz/*.jpg, navy bg) into transparent WebP atlases + art/ui.json.
Coordinates are in a reference display size (sheet scaled to width 1024) so they read straight off a preview."""
import json, os
from collections import deque
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(HERE, 'src', 'broz'); OUT = os.path.join(HERE, '..', '..', 'games', 'miniheroes', 'art')
def sheet(i): im = Image.open(os.path.join(SRC, f'{i}.jpg')).convert('RGB'); return im, im.width / 1024
def crop(i, cx, cy, bw, bh=None):
    im, k = sheet(i); bh = bh or bw
    return im.crop((round((cx - bw / 2) * k), round((cy - bh / 2) * k), round((cx + bw / 2) * k), round((cy + bh / 2) * k)))
def unnavy(im, tol=40):
    """flood the navy backdrop from the border -> alpha 0, soft 1px edge"""
    im = im.convert('RGB'); w, h = im.size; px = im.load(); bgc = px[1, 1]
    near = lambda p: sum(abs(p[c] - bgc[c]) for c in range(3)) < tol and max(p) < 90
    m = Image.new('L', (w, h), 255); mp = m.load(); seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y * w + x]: continue
        seen[y * w + x] = 1
        if not near(px[x, y]): continue
        mp[x, y] = 0; q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = im.convert('RGBA'); out.putalpha(m.filter(ImageFilter.GaussianBlur(0.8))); return out
def circle(im):
    s = min(im.size); im = im.crop((0, 0, s, s)).convert('RGBA'); m = Image.new('L', (s * 4, s * 4), 0)
    ImageDraw.Draw(m).ellipse((6, 6, s * 4 - 6, s * 4 - 6), fill=255); im.putalpha(m.resize((s, s), Image.LANCZOS)); return im
def fit(im, S):
    im = im.convert('RGBA'); bb = im.getchannel('A').getbbox() or (0, 0, *im.size); im = im.crop(bb); im.thumbnail((S, S), Image.LANCZOS)
    c = Image.new('RGBA', (S, S)); c.paste(im, ((S - im.width) // 2, (S - im.height) // 2), im); return c
def hue(im, deg):
    a = im.getchannel('A'); h, s, v = im.convert('RGB').convert('HSV').split(); h = h.point(lambda x: (x + int(deg * 255 / 360)) % 256)
    o = Image.merge('HSV', (h, s, v)).convert('RGBA'); o.putalpha(a); return o
def pack(name, items, S, cols):
    rows = (len(items) + cols - 1) // cols; at = Image.new('RGBA', (cols * S, rows * S)); meta = {}
    for n, (key, im) in enumerate(items):
        x, y = n % cols * S, n // cols * S; at.paste(fit(im, S), (x, y)); meta[key] = [x, y]
    at.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=86, method=6); return {'img': name + '.webp', 'size': S, 'cells': meta}
J = {}
# --- 64px icon atlas: resources, skills, magic schools, policies, spells (sheet 14), artifacts (5), talents (6)
icons = []
for k, x in zip(['gold', 'wood', 'ore', 'gems', 'crystal'], [126, 317, 516, 705, 897]): icons.append((k, crop(14, x, 67, 112)))
XS = [103, 268, 432, 597, 760, 920]
for r, (y, keys, rnd) in enumerate([(217, ['attack', 'defense', 'archery', 'leadership', 'logistics', 'wisdom'], 0), (365, ['fire', 'water', 'earth', 'air', 'necromancy', 'manaregen'], 1),
                                     (512, ['tax', 'research', 'growth', 'construction', 'militia', 'trade'], 0), (657, ['fireball', 'lightning', 'heal', 'haste', 'shield', 'curse'], 1)]):
    for k, x in zip(keys, XS):
        im = crop(14, x, y, 110); icons.append((k, circle(crop(14, x, y, 104)) if rnd else im))
d = dict(icons)
# Hanz: Tax != Gold, Militia != Attack, Earth != Gems -> distinct variants
d['tax'] = Image.alpha_composite(d['tax'].convert('RGBA'), Image.new('RGBA', d['tax'].size)); d['tax'] = d['research'].copy() if False else d['tax']
tx = d['tax'].convert('RGBA').copy(); coin = d['gold'].convert('RGBA').resize((tx.width * 6 // 10,) * 2); tx = ImageEnhance.Color(tx).enhance(0.25)
scale = crop(14, 920, 512, 110).convert('RGBA'); d['tax'] = Image.blend(scale, Image.new('RGBA', scale.size), 0); d['tax'].alpha_composite(coin.resize((scale.width // 2,) * 2), (scale.width // 2 - 4, scale.height // 2 - 4))
d['militia'] = hue(d['militia'].convert('RGBA'), 0); dm = ImageDraw.Draw(d['militia']); w_ = d['militia'].width
sh = crop(14, 268, 217, 110).convert('RGBA').resize((w_ // 2, w_ // 2)); d['militia'].alpha_composite(sh, (4, w_ // 2 - 6))
d['earth'] = hue(d['earth'], -75)
icons = [(k, d[k]) for k, _ in icons]
for r, (y, keys) in enumerate([(85, ['helm', 'armor', 'sword', 'shieldA', 'boots', 'ring']), (265, ['amulet', 'cloak', 'staff', 'orb', 'book', 'crown']),
                               (450, ['gloves', 'belt', 'bow', 'axe', 'potion', 'scroll']), (632, ['skull', 'dragonheart', 'feather', 'horn', 'horseshoe', 'crystalball'])]):
    for k, x in zip(keys, [105, 269, 432, 594, 757, 920]): icons.append(('art_' + k, crop(5, x, y, 132)))
FAC = ['castle', 'necro', 'sylvan', 'inferno', 'stronghold', 'dwarf']
for r, (f, y) in enumerate(zip(FAC, [108, 268, 430, 590, 752, 913])):
    for c, x in enumerate([140, 298, 458, 618, 775, 932]): icons.append((f'tal_{f}_{c}', circle(crop(6, x, y, 126))))
J['icons'] = pack('icons', icons, 64, 16)
# --- 256px battle atlas: obstacles, siege, spell fx (sheet 7)
bt = []
for k, x, bw in zip(['boulder', 'rocks', 'stump', 'crater', 'bush', 'crystal', 'bones', 'lava'], [67, 200, 327, 455, 590, 723, 842, 952], [128, 128, 128, 128, 128, 104, 120, 96]): bt.append((k, unnavy(crop(7, x, 72, bw, 112))))
for k, x in zip(['wall', 'wall_dmg', 'wall_rubble', 'gate', 'gate_broken', 'tower', 'moat'], [75, 225, 372, 522, 668, 805, 940]): bt.append((k, unnavy(crop(7, x, 240, 146 if k != 'tower' else 120, 150 if k != 'tower' else 170))))
for k, x in zip(['fx_fireball', 'fx_lightning', 'fx_ice', 'fx_heal', 'fx_haste', 'fx_shield', 'fx_curse', 'fx_meteor'], [67, 200, 327, 455, 590, 702, 835, 950]): bt.append((k, unnavy(crop(7, x, 440, 124, 118))))
J['battle'] = pack('battle-props', bt, 256, 8)
# --- full images: home backdrop, win/lose art, event popups art
im, k = sheet(16); im.crop((0, 0, im.width, int(470 * k))).save(os.path.join(OUT, 'home.webp'), 'WEBP', quality=80, method=6)
for n, x in enumerate([160, 343, 528, 698, 880]): fit(crop(16, x - 52, 511, 34, 34), 48).save(os.path.join(OUT, f'home-i{n}.webp'), 'WEBP', quality=90)
crop(4, 255, 175, 500, 340).save(os.path.join(OUT, 'win.webp'), 'WEBP', quality=80); crop(4, 767, 185, 494, 360).save(os.path.join(OUT, 'lose.webp'), 'WEBP', quality=80)
ev = [(k, unnavy(crop(3, x, 190, 230, 180), 46)) for k, x in [('chest', 183), ('monster', 512), ('shrine', 835)]]
J['events'] = pack('events', ev, 256, 3)
open(os.path.join(OUT, '..', 'ui-art-data.js'), 'w').write('// generated by tools/miniheroes-art/build_ui.py\nconst UIA = ' + json.dumps(J, separators=(',', ':')) + ';\n')
for f in ['icons', 'battle-props', 'events']: print(f, os.path.getsize(os.path.join(OUT, f + '.webp')) // 1024, 'KB')
# --- fog edge strip (sheet 24, white bg): dark at the left fading right; alpha from darkness, tinted fog colour.
fe = Image.open(os.path.join(SRC, '24.jpg')).convert('L'); fw, fh = fe.size
fe = fe.crop((0, int(fh * 0.12), int(fw * 0.62), int(fh * 0.88))).resize((128, 256), Image.LANCZOS)
al = fe.point(lambda v: max(0, min(255, int((235 - v) * 1.35))))
ramp = Image.linear_gradient('L').rotate(90, expand=True).resize((128, 256)).point(lambda v: max(0, 255 - v * 6))  # solid at the fog side so it meets the opaque fog
from PIL import ImageChops
al = ImageChops.lighter(al, ramp); fog = Image.new('RGBA', fe.size, (5, 5, 12, 255)); fog.putalpha(al); fog.save(os.path.join(OUT, 'fog-edge.webp'), 'WEBP', quality=85)
print('fog-edge', os.path.getsize(os.path.join(OUT, 'fog-edge.webp')) // 1024, 'KB')
