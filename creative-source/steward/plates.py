#!/usr/bin/env python3
"""Digital Steward raster plates. Restores alpha on the Cloudinary 4x upscales (up4x/<part>.png, magenta composites): colour from
the upscale, alpha from the kit's own 1x mask resampled 4x (exact registration), magenta de-spilled by pulling the nearest interior
colour. Writes plates/4x/<part>.webp and plates/2x/<part>.webp; gloves the same way from up4x/hands. Run: python3 plates.py"""
import json, os, glob, io, urllib.request
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
KIT_ALIGNED = os.environ.get("KIT_ALIGNED", "/private/tmp/claude-501/-Users-josephanady/37e3a1fc-29bb-4d9e-9566-24f7fbdd7522/scratchpad/steward/Digital_Steward_Kit_v1.2/art/hero/aligned")
PARTS = json.load(open(f"{HERE}/hero-parts.json"))["parts"]
MAG = np.array([255, 0, 255], dtype=np.float32)

def restore(rgb_up, alpha1x, pad):
    """rgb_up: HxWx3 upscale of (part crop + pad) ; alpha1x: 1x alpha of the same crop (with pad). Returns RGBA at 4x."""
    h, w = rgb_up.shape[:2]
    a = np.array(Image.fromarray(alpha1x).resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    rgb = rgb_up.astype(np.float32)
    mag = np.clip((np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]) / 255, 0, 1)   # magenta-ness: R and B above G (key = 1, greys/blues/navy = 0)
    interior = (mag < 0.08) & (a > 0.5)
    idx = ndimage.distance_transform_edt(~interior, return_distances=False, return_indices=True)
    filled = rgb[idx[0], idx[1]]                                   # every pixel takes the nearest interior colour
    spill = np.clip(mag / 0.3, 0, 1)[..., None]                    # any key tint inside the soft edge blends toward the fill
    out = rgb * (1 - spill) + filled * spill
    out[~interior & (a <= 0.5)] = filled[~interior & (a <= 0.5)]
    return np.dstack([np.clip(out, 0, 255).astype(np.uint8), (a * 255).astype(np.uint8)])

os.makedirs(f"{HERE}/plates/4x", exist_ok=True); os.makedirs(f"{HERE}/plates/2x", exist_ok=True)
report = {}
for p, k in PARTS.items():
    src = np.array(Image.open(f"{KIT_ALIGNED}/{p}.png").convert("RGBA"))
    x, y, w, h = k["x"], k["y"], k["w"], k["h"]
    x0, y0, x1, y1 = x, y, x + w, y + h   # the chroma crops are the kit rects exactly
    a1 = src[y0:y1, x0:x1, 3]
    up = np.array(Image.open(f"{HERE}/up4x/{p}.png").convert("RGB"))
    assert up.shape[0] == (y1 - y0) * 4 and up.shape[1] == (x1 - x0) * 4, (p, up.shape, (x1 - x0, y1 - y0))
    rgba = restore(up, a1, 4)
    im = Image.fromarray(rgba); im.save(f"{HERE}/plates/4x/{p}.webp", quality=92, method=6)
    im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(f"{HERE}/plates/2x/{p}.webp", quality=92, method=6)
    report[p] = dict(origin=[x0, y0], size4x=[im.width, im.height])
# gloves: kit PNG (RGBA) padded 4 px; up4x/hands/<glove>.png from Cloudinary
os.makedirs(f"{HERE}/up4x/hands", exist_ok=True)
for f in sorted(glob.glob(f"{HERE}/kit/hands/*.png")):
    n = os.path.basename(f)[:-4]
    if n.endswith("-mirrored"): continue
    src = Image.open(f).convert("RGBA"); pad = Image.new("RGBA", (src.width + 8, src.height + 8), (0, 0, 0, 0)); pad.alpha_composite(src, (4, 4))
    upf = f"{HERE}/up4x/hands/{n}.png"
    if not os.path.exists(upf):
        open(upf, "wb").write(urllib.request.urlopen(f"https://res.cloudinary.com/uwsblrdv/image/upload/e_upscale/tdg/steward/hands/{n}.png", timeout=120).read())
    up = np.array(Image.open(upf).convert("RGB"))
    rgba = restore(up, np.array(pad)[:, :, 3], 4)
    im = Image.fromarray(rgba); im.save(f"{HERE}/plates/4x/glove_{n}.webp", quality=92, method=6)
    im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(f"{HERE}/plates/2x/glove_{n}.webp", quality=92, method=6)
    report[f"glove_{n}"] = dict(origin=[-4, -4], size4x=[im.width, im.height])   # origin relative to the glove's own image
json.dump(report, open(f"{HERE}/plates/manifest.json", "w"), indent=1)
print(len(report), "plates;", sum(os.path.getsize(f) for f in glob.glob(f"{HERE}/plates/2x/*.webp")) // 1024, "KB 2x,", sum(os.path.getsize(f) for f in glob.glob(f"{HERE}/plates/4x/*.webp")) // 1024, "KB 4x")
