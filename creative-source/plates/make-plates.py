#!/usr/bin/env python3
"""Clean-plate pipeline for one room (see rive-expert skill local-facts). Usage: python3 make-plates.py <room.json>
room.json: {"name","source","layers_dir","public_id","removals":[{"prompt":..,"layers":[..],"dilate":4}],"movers":{"out_name":"layer_name",..},"text_inpaint":[layer,...]}
Steps: upload source (must already be on Cloudinary as public_id) → gen_remove per removal prompt, composited only inside the removal layers' masks →
optional text inpaint → 4x tiled upscale of plate and of the untouched master → movers cut from the 4x master → 2x/4x WebP sets + manifests."""
import json, sys, subprocess, os, numpy as np, cv2
from pathlib import Path
from PIL import Image
cfg=json.load(open(sys.argv[1])); here=Path(sys.argv[1]).parent; out=here/cfg["name"]; out.mkdir(exist_ok=True)
B="https://res.cloudinary.com/uwsblrdv/image/upload"; pid=cfg["public_id"]; L=Path(cfg["layers_dir"])
src=np.asarray(Image.open(cfg["source"]).convert("RGB")); H,W=src.shape[:2]
def alpha(n):   # a layer name, or a list of names (union); "kitmasks/x" reads from the room dir
    if isinstance(n,list): return np.max([alpha(x) for x in n],axis=0)
    return np.asarray(Image.open((out/f"{n}.png") if "/" in n else (L/f"{n}.png")).convert("RGBA"))[...,3]
def dil(m,r): return cv2.dilate((m>8).astype(np.uint8)*255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1)))
def blend(base,fill,mask,feather=3):
    m=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),feather)[...,None]; return (base*(1-m)+fill*m).round().astype(np.uint8)
def fetch(url,path):
    for _ in range(3):
        r=subprocess.run(["curl","-sS","-o",str(path),"-w","%{http_code}",url],capture_output=True,text=True)
        if r.stdout=="200": return
    raise SystemExit(f"fetch failed {r.stdout} {url}")
plate=src.copy()
for i,rm in enumerate(cfg["removals"]):
    p=out/f"_rm{i}.png"
    m=np.zeros((H,W),np.uint8)
    for n in rm["layers"]: m=np.maximum(m,dil(alpha(n),rm.get("dilate",4)))
    if rm.get("inpaint"):   # extend the surroundings inward (only the edge band is ever exposed; the layer covers the rest)
        plate=cv2.inpaint(plate,(m>0).astype(np.uint8),9,cv2.INPAINT_TELEA); print("inpaint",i,rm["layers"],"px",int((m>0).sum())); continue
    if "cavity" in rm:   # deterministic dark backplate (drawer cavities): vertical gradient inside the mask
        ys,xs=np.where(m>0); y0,y1=ys.min(),ys.max(); g=np.linspace(0,1,y1-y0+1)[:,None]
        c0=np.array(rm["cavity"][0]); c1=np.array(rm["cavity"][1]); fill=plate.copy(); fill[y0:y1+1]=(c0*(1-g)+c1*g)[:,None,:].round().astype(np.uint8)
        plate=blend(plate,fill,m,1.2); print("cavity",i,rm["layers"],"px",int((m>0).sum())); continue
    if not p.exists():
        if "region" in rm: x,y,w,h=rm["region"]; fetch(f"{B}/e_gen_remove:region_(x_{x};y_{y};w_{w};h_{h})/{pid}.png",p)
        else: fetch(f"{B}/e_gen_remove:prompt_({rm['prompt'].replace(' ','%20')});multiple_true;remove-shadow_true/{pid}.png",p)
    plate=blend(plate,np.asarray(Image.open(p).convert("RGB")),m); print("removal",i,rm.get("prompt") or rm.get("region"),"px",int((m>0).sum()))
Image.fromarray(plate).save(out/"bg_plate_src.png")
# --- 4x upscale (tiled) of the clean plate and of the master ---
def up4(pid_,dst):
    if dst.exists(): return np.asarray(Image.open(dst).convert("RGB"))
    O,S=48,4; hw,hh=W//2,H//2
    tiles={"tl":(0,0,hw+O,hh+O),"tr":(hw-O,0,W-(hw-O),hh+O),"bl":(0,hh-O,hw+O,H-(hh-O)),"br":(hw-O,hh-O,W-(hw-O),H-(hh-O))}
    canvas=np.zeros((H*S,W*S,3)); weight=np.zeros((H*S,W*S,1)); OO=O*S
    for k,(x,y,w,h) in tiles.items():
        t=out/f"_tile_{dst.stem}_{k}.png"; fetch(f"{B}/c_crop,x_{x},y_{y},w_{w},h_{h}/e_upscale/{pid_}.png",t)
        im=np.asarray(Image.open(t).convert("RGB"),np.float64); X,Y=x*S,y*S; th,tw=min(im.shape[0],H*S-Y),min(im.shape[1],W*S-X); im=im[:th,:tw]
        wx=np.ones(tw); wy=np.ones(th); ramp=np.linspace(0,1,OO)
        if k in("tr","br"): wx[:OO]=ramp
        if k in("tl","bl"): wx[-OO:]=ramp[::-1]
        if k in("bl","br"): wy[:OO]=ramp
        if k in("tl","tr"): wy[-OO:]=ramp[::-1]
        f=(wy[:,None]*wx[None,:])[...,None]; canvas[Y:Y+th,X:X+tw]+=im*f; weight[Y:Y+th,X:X+tw]+=f
    res=(canvas/np.maximum(weight,1e-6)).round().clip(0,255).astype(np.uint8); Image.fromarray(res).save(dst); return res
print("upscaling master…"); master=up4(pid,out/"master_4x.png")
print("upscaling plate… (upload bg_plate_src.png as", pid+"_plate", "first)"); plate4=up4(pid+"_plate",out/"bg_plate_4x.png")
# --- movers cut from the 4x master ---
S=4; man4={"scale":4,"artboard":{"w":W,"h":H},"layers":{}}; (out/"layers4x").mkdir(exist_ok=True)
for name,layer in cfg["movers"].items():
    a=Image.fromarray(alpha(layer))
    a4=np.clip((np.asarray(a.resize((a.width*S,a.height*S),Image.LANCZOS)).astype(np.float32)-20)*1.15,0,255)
    ys,xs=np.where(a4>4); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    Image.fromarray(np.dstack([master[y0:y1,x0:x1],a4[y0:y1,x0:x1].astype(np.uint8)])).save(out/"layers4x"/f"{name}.png")
    man4["layers"][name]={"x":int(x0),"y":int(y0),"w":int(x1-x0),"h":int(y1-y0),"src_layer":layer}
json.dump(man4,open(out/"layers4x"/"manifest.json","w"),indent=1)
for scale,d in [(2,"2x"),(4,"4x")]:
    (out/d).mkdir(exist_ok=True); man={"scale":scale,"artboard":{"w":W,"h":H},"layers":{}}
    bg=Image.fromarray(plate4); bg=bg.resize((bg.width//2,bg.height//2),Image.LANCZOS) if scale==2 else bg; bg.save(out/d/"bg_plate.webp",quality=90,method=6)
    for name,l in man4["layers"].items():
        im=Image.open(out/"layers4x"/f"{name}.png"); im=im.resize((im.width//2,im.height//2),Image.LANCZOS) if scale==2 else im
        im.save(out/d/f"{name}.webp",quality=90,method=6); man["layers"][name]={"x":l["x"]/4,"y":l["y"]/4,"w":l["w"]/4,"h":l["h"]/4}
    json.dump(man,open(out/d/"manifest.json","w"),indent=1); print(d,"set", round(sum(os.path.getsize(out/d/f) for f in os.listdir(out/d))/1e6,2),"MB")
