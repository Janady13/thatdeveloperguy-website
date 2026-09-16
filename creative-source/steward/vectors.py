#!/usr/bin/env python3
"""Digital Steward vector upgrade. `pack`: shelf-packs the 4x chroma parts (up4x/<part>.png) into <=2040px magenta sheets for
Adobe image_vectorize (Adobe downsamples anything over 2047px), writing sheets/sheet_N.png + sheets/layout.json.
`consume`: splits each downloaded sheets/sheet_N.svg back into per-part RML shape fragments (rml/<part>.json) in artboard
space (1x kit coordinates, part origin at its kit rect) using tools/svg2rml.py; paths are assigned by bbox centre cell."""
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, ROOT)
WORK = os.environ.get("STEWARD_WORK", HERE)
MAGENTA = (255, 0, 255)
MAX, GUT = 2040, 40


def pack():
    parts = json.load(open(f"{WORK}/hero-parts.json"))["parts"]
    items = []
    for p in parts:
        im = Image.open(f"{WORK}/up4x/{p}.png").convert("RGB")
        items.append((p, im))
    items.sort(key=lambda t: -t[1].height)
    sheets, layout = [], {}
    for p, im in items:
        placed = False
        for si, s in enumerate(sheets):
            for shelf in s["shelves"]:
                if shelf["x"] + im.width + GUT <= MAX and im.height <= shelf["h"]:
                    layout[p] = dict(sheet=si, x=shelf["x"], y=shelf["y"], w=im.width, h=im.height)
                    shelf["x"] += im.width + GUT; placed = True; break
            if placed: break
            ny = s["shelves"][-1]["y"] + s["shelves"][-1]["h"] + GUT if s["shelves"] else GUT
            if ny + im.height + GUT <= MAX:
                s["shelves"].append(dict(x=GUT + im.width + GUT, y=ny, h=im.height))
                layout[p] = dict(sheet=si, x=GUT, y=ny, w=im.width, h=im.height); placed = True; break
        if not placed:
            sheets.append(dict(shelves=[dict(x=GUT + im.width + GUT, y=GUT, h=im.height)]))
            layout[p] = dict(sheet=len(sheets) - 1, x=GUT, y=GUT, w=im.width, h=im.height)
    os.makedirs(f"{WORK}/sheets", exist_ok=True)
    for si, s in enumerate(sheets):
        w = max(l["x"] + l["w"] for l in layout.values() if l["sheet"] == si) + GUT
        h = max(l["y"] + l["h"] for l in layout.values() if l["sheet"] == si) + GUT
        canvas = Image.new("RGB", (w, h), MAGENTA)
        for p, im in items:
            l = layout[p]
            if l["sheet"] == si: canvas.paste(im, (l["x"], l["y"]))
        canvas.save(f"{WORK}/sheets/sheet_{si}.png", optimize=True)
        print(f"sheet_{si}.png {w}x{h} parts={sum(1 for l in layout.values() if l['sheet']==si)} bytes={os.path.getsize(f'{WORK}/sheets/sheet_{si}.png')}")
    json.dump(dict(sheets=len(sheets), gutter=GUT, layout=layout), open(f"{WORK}/sheets/layout.json", "w"), indent=1)


def consume():
    from tools.svg2rml import svg_to_shapes
    lay = json.load(open(f"{WORK}/sheets/layout.json"))
    parts = json.load(open(f"{WORK}/hero-parts.json"))["parts"]
    min_area = float(os.environ.get("MIN_AREA", "2"))
    os.makedirs(f"{WORK}/rml", exist_ok=True)
    counter = [0]
    def nid():
        counter[0] += 1; return f"v{counter[0]}"
    out = {}
    for si in range(lay["sheets"]):
        svg = open(f"{WORK}/sheets/sheet_{si}.svg").read()
        sw = float(re.search(r'<svg[^>]*\swidth="([\d.]+)"', svg).group(1))
        pw = Image.open(f"{WORK}/sheets/sheet_{si}.png").width
        scale = pw / sw            # Adobe may resample; back to sheet px
        # sheet px -> 1x kit px: /4 ; then each part is re-based to its own kit rect origin later
        shapes, stats = svg_to_shapes(svg, scale=scale, dx=0, dy=0, nid=None, name_prefix="s", drop_fill=MAGENTA, min_area=min_area * 16)
        cells = {p: l for p, l in lay["layout"].items() if l["sheet"] == si}
        per = {p: [] for p in cells}
        orphan = 0
        for sh in shapes:
            vs = re.findall(r'Vertex x="([-\d.]+)" y="([-\d.]+)"', sh)   # vertices only; the Shape itself sits at 0,0
            xs = [float(x) for x, _ in vs]; ys = [float(y) for _, y in vs]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            hit = None
            for p, l in cells.items():
                if l["x"] - GUT / 2 <= cx <= l["x"] + l["w"] + GUT / 2 and l["y"] - GUT / 2 <= cy <= l["y"] + l["h"] + GUT / 2:
                    hit = p; break
            if not hit: orphan += 1; continue
            per[hit].append(sh)
        print(f"sheet_{si}: paths={stats['paths']} dropped={stats['dropped']} verts={stats['vertices']} orphans={orphan}")
        for p, shs in per.items():
            l = cells[p]; k = parts[p]
            # re-base: sheet px -> part-local 1x px (origin = the kit rect's top-left), i.e. x' = (x - l.x)/4
            def rebase(sh):
                sh = sh.replace('<Shape x="0" y="0" ', '<Shape ')   # keep the Shape at the origin; only vertices/gradients move
                def fx(m): return f' {m.group(1)}="{(float(m.group(2)) - (l["x"] if m.group(1) in ("x","startX","endX") else l["y"])) / 4:.2f}"'
                sh = re.sub(r' (x|y|startX|startY|endX|endY)="([-\d.]+)"', fx, sh)
                sh = re.sub(r' (inDistance|outDistance)="([-\d.]+)"', lambda m: f' {m.group(1)}="{float(m.group(2)) / 4:.2f}"', sh)
                return sh
            shs = [rebase(s) for s in shs]
            json.dump(dict(part=p, rect=[k["x"], k["y"], k["w"], k["h"]], shapes=shs, count=len(shs)), open(f"{WORK}/rml/{p}.json", "w"))
            out[p] = len(shs)
    print(json.dumps(out))


if __name__ == "__main__":
    {"pack": pack, "consume": consume}[sys.argv[1]]()
