#!/usr/bin/env python3
"""Bake Broz's UI icons (art-src/ui/, git-ignored) to committed WebP in art/ui/ at 64 px.
Uses the @2x (128 px) master when present for a cleaner downscale. Run: python3 games/galaxy/tools/bake-ui.py"""
import pathlib, sys
from PIL import Image
G = pathlib.Path(__file__).resolve().parent.parent
SRC, DST, PX = G / 'art-src' / 'ui', G / 'art' / 'ui', 64
if not SRC.is_dir(): sys.exit(f'no {SRC}')
DST.mkdir(parents=True, exist_ok=True)
for f in sorted(SRC.glob('*.png')):
    if f.name.startswith('_') or '@2x' in f.stem: continue
    m = f.with_name(f.stem + '@2x.png'); src = m if m.exists() else f
    im = Image.open(src).convert('RGBA')
    if im.width != PX: im = im.resize((PX, round(im.height * PX / im.width)), Image.LANCZOS)
    out = DST / (f.stem + '.webp'); im.save(out, 'WEBP', quality=90, alpha_quality=95, method=6)
    print(f'{src.name} -> {out.relative_to(G)} {im.size} {out.stat().st_size} B')
