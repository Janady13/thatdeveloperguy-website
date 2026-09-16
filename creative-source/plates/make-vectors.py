#!/usr/bin/env python3
"""Vector prep/consume for one room. `prep`: writes <room>/vec/upload/*.png (2x clean plate + chroma-keyed 4x movers) for Adobe image_vectorize.
`consume`: reads <room>/vec/svg/<name>.svg (downloaded Adobe outputs), converts to RML shape fragments in <room>/vec/rml/<name>.rml.json.
    python3 make-vectors.py it-services.json prep | consume"""
import json, sys, os, numpy as np
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
from svg2rml import svg_to_shapes
cfg = json.load(open(sys.argv[1])); mode = sys.argv[2]; out = Path(sys.argv[1]).parent / cfg["name"]; vec = out / "vec"
KEY = (255, 0, 255)
if mode == "prep":
    (vec / "upload").mkdir(parents=True, exist_ok=True)
    p4 = Image.open(out / "bg_plate_4x.png"); p4.resize((p4.width // 2, p4.height // 2), Image.LANCZOS).save(vec / "upload" / "bg_plate.png")
    man = json.load(open(out / "layers4x" / "manifest.json"))
    for name in man["layers"]:
        im = np.asarray(Image.open(out / "layers4x" / f"{name}.png").convert("RGBA")).astype(np.float32)
        a = im[..., 3:] / 255; rgb = im[..., :3] * a + np.array(KEY, np.float32) * (1 - a)
        Image.fromarray(rgb.round().astype(np.uint8)).save(vec / "upload" / f"{name}.png")
    sizes = {f: os.path.getsize(vec / "upload" / f) for f in sorted(os.listdir(vec / "upload"))}
    json.dump(sizes, open(vec / "upload" / "sizes.json", "w"), indent=1); print(json.dumps(sizes, indent=1))
elif mode == "consume":
    (vec / "rml").mkdir(parents=True, exist_ok=True)
    man = json.load(open(out / "layers4x" / "manifest.json")); report = {}
    for svg_file in sorted((vec / "svg").glob("*.svg")):
        name = svg_file.stem; svg = svg_file.read_text()
        import re as _re
        sw = float(_re.search(r'<svg[^>]*\swidth="([\d.]+)"', svg).group(1))   # Adobe may resample; scale from the SVG's own width
        if name == "bg_plate":
            shapes, st = svg_to_shapes(svg, scale=1672 / sw, dx=0, dy=0, name_prefix="bg", min_area=float(os.environ.get("MIN_AREA","8")))
        else:
            l = man["layers"][name]
            shapes, st = svg_to_shapes(svg, scale=(l["w"] / 4) / sw, dx=l["x"] / 4, dy=l["y"] / 4, name_prefix=name, drop_fill=KEY, drop_tolerance=90, min_area=float(os.environ.get("MIN_AREA","8")))
        json.dump({"name": name, "shapes": shapes, "stats": st}, open(vec / "rml" / f"{name}.json", "w"))
        report[name] = st
    print(json.dumps(report, indent=1))
