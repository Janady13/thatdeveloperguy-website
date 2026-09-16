"""Tile-upscale a 1672x941 image 4x through Cloudinary e_upscale (10MB output cap => 2x2 tiles, 48px overlap, feathered)."""
import subprocess, sys, json, numpy as np
from PIL import Image
src, public_id, out = sys.argv[1], sys.argv[2], sys.argv[3]
B="https://res.cloudinary.com/uwsblrdv/image/upload"
W,H,O,S=1672,941,48,4; hw,hh=W//2,H//2
tiles={"tl":(0,0,hw+O,hh+O),"tr":(hw-O,0,W-(hw-O),hh+O),"bl":(0,hh-O,hw+O,H-(hh-O)),"br":(hw-O,hh-O,W-(hw-O),H-(hh-O))}
ims={}
for k,(x,y,w,h) in tiles.items():
    url=f"{B}/c_crop,x_{x},y_{y},w_{w},h_{h}/e_upscale/{public_id}.png"
    for attempt in range(3):
        r=subprocess.run(["curl","-sS","-o",f"_t_{k}.png","-w","%{http_code}",url],capture_output=True,text=True)
        if r.stdout=="200": break
    assert r.stdout=="200", (k, r.stdout)
    ims[k]=np.asarray(Image.open(f"_t_{k}.png").convert("RGB"),np.float64)
WW,HH,OO=W*S,H*S,O*S
canvas=np.zeros((HH,WW,3)); weight=np.zeros((HH,WW,1))
def feather(w,h,l,t,r,b):
    wx=np.ones(w); wy=np.ones(h); ramp=np.linspace(0,1,OO)
    if l: wx[:OO]=ramp
    if r: wx[-OO:]=ramp[::-1]
    if t: wy[:OO]=ramp
    if b: wy[-OO:]=ramp[::-1]
    return (wy[:,None]*wx[None,:])[...,None]
for k,(x,y,w,h) in tiles.items():
    im=ims[k]; X,Y=x*S,y*S; th,tw=min(im.shape[0],HH-Y),min(im.shape[1],WW-X); im=im[:th,:tw]
    f=feather(tw,th,k in("tr","br"),k in("bl","br"),k in("tl","bl"),k in("tl","tr"))
    canvas[Y:Y+th,X:X+tw]+=im*f; weight[Y:Y+th,X:X+tw]+=f
res=(canvas/np.maximum(weight,1e-6)).round().clip(0,255).astype(np.uint8)
Image.fromarray(res).save(out); print(out, res.shape)
