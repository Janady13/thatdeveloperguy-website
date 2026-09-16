#!/usr/bin/env python3
"""Extract one <g id=…> subtree from a kit assembly SVG, rasterize it alone at source resolution (1672x941), return alpha + bbox.
    from kitpart import part_alpha
    a, box = part_alpha("/…/svg/layers/lighting.svg", "ceiling_panel_1")"""
import re, subprocess, tempfile, os, numpy as np
from PIL import Image
_cache = {}
def _svg(path):
    if path not in _cache: _cache[path] = open(path).read()
    return _cache[path]
def _extract_group(svg, gid):
    """Return the <g id=gid>…</g> block (nesting-aware)."""
    m = re.search(rf'<g[^>]*\sid="{re.escape(gid)}"[^>]*>', svg)
    if not m: return None
    i = m.end(); depth = 1
    for t in re.finditer(r"<g\b[^>]*>|</g>", svg[i:]):
        depth += 1 if t.group(0).startswith("<g") else -1
        if depth == 0: return svg[m.start():i + t.end()]
    return None
def part_alpha(path, gid, w=1672, h=941):
    svg = _svg(path); head = re.search(r"<svg[^>]*>", svg).group(0); defs = "".join(re.findall(r"<defs>.*?</defs>", svg, re.S))
    g = _extract_group(svg, gid)
    if g is None: return None, None
    doc = f"{head}{defs}{g}</svg>"
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f: f.write(doc); tmp = f.name
    out = tmp + ".png"; subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), tmp, "-o", out], check=True)
    a = np.asarray(Image.open(out).convert("RGBA"))[..., 3]; os.unlink(tmp); os.unlink(out)
    ys, xs = np.where(a > 8)
    if len(xs) == 0: return a, None
    return a, (int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1))
