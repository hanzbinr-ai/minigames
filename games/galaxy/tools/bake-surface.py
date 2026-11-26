#!/usr/bin/env python3
"""Bake Broz's planet-surface art (art-src/surface/, git-ignored originals) to committed WebP in art/surface/.
Surfaces (surface-*.png/jpg, portrait 1080x1440) -> 810 px wide; buildings bld-*-N / scaffold -> 320 px; layout json copied.
Run from anywhere: python3 games/galaxy/tools/bake-surface.py"""
import json, pathlib, shutil, sys
from PIL import Image
G = pathlib.Path(__file__).resolve().parent.parent
SRC, DST = G / 'art-src' / 'surface', G / 'art' / 'surface'
if not SRC.is_dir(): sys.exit(f'no {SRC}')
DST.mkdir(parents=True, exist_ok=True)
total = 0
for f in sorted(SRC.iterdir()):
    if f.name.startswith('_') or f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
    im = Image.open(f); im.load()
    surf = f.stem.startswith('surface') or f.stem in ('planet-surface',)
    w = 810 if surf else 320
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if alpha and not surf else 'RGB')
    out = DST / (f.stem + '.webp')
    im.save(out, 'WEBP', quality=80 if surf else 82, method=6, **({'alpha_quality': 90} if im.mode == 'RGBA' else {}))
    total += out.stat().st_size
    print(f'{f.name} -> {out.relative_to(G)} {im.size} {out.stat().st_size // 1024} KB')
lay = SRC / 'surface-layout.json'
if lay.exists():
    json.loads(lay.read_text())  # fail loudly on broken json
    shutil.copy(lay, DST / 'surface-layout.json'); print('copied surface-layout.json')
print(f'total {total // 1024} KB')
