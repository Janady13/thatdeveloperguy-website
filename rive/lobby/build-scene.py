#!/usr/bin/env python3
"""Generates scene.rml for the lobby from the plate manifest + fixtures. Run from rive/lobby: python3 build-scene.py && rive . --verify"""
import json, math, sys, os
from pathlib import Path
HERE=Path(__file__).parent
# MODE: embedded (default; verified by the CLI) | ref2x | ref4x (contentless ImageAssets, the page supplies /assets/<set>/<name>.webp)
MODE=os.environ.get("MODE","embedded")
IMG_SCALE={"embedded":0.5,"ref2x":0.5,"ref4x":0.25}[MODE]
OUT=Path(os.environ.get("OUT",str(HERE/"scene.rml")))
M=json.load(open(HERE/"../../creative-source/plates/lobby/2x/manifest.json"))["layers"]
FX=json.load(open(HERE/"../../creative-source/plates/lobby/fixtures.json"))
LP=json.load(open(HERE/"../../creative-source/plates/lobby/label_plates.json"))
W,H=1672,941
CAMX,CAMY=870,400            # zoom centre = the door wall
FPS=60
ids={"n":0}
def nid(): ids["n"]+=1; return f"0:{ids['n']+100}"
out=[]; assets=[]; anims={}   # anims[name] -> list of (objectId, key, [(frame,value,interp)])
def emit(s): out.append(s)
def key(anim, obj, prop, frames):
    anims.setdefault(anim,[]).append((obj,prop,frames))
KEYS={"x":13,"y":14,"rotation":15,"scaleX":16,"scaleY":17,"opacity":18}
EASE='<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
def image(name,aid,x,y,scale=None,ox=0,oy=0,extra=""):
    scale=IMG_SCALE if scale is None else scale*IMG_SCALE/0.5
    i=nid(); emit(f'<Image x="{x:.2f}" y="{y:.2f}" originX="{ox}" originY="{oy}" scaleX="{scale}" scaleY="{scale}" assetId="{aid}" name="{name}" id="{i}"{extra}/>'); return i
def asset(name):
    a=nid(); f=f' file="assets/2x/{name}.webp"' if MODE=="embedded" else ""; assets.append(f'    <ImageAsset{f} name="{name}" id="{a}"/>'); return a
def rect(name,x,y,w,h,fill,blend=None,opacity=1,ox=0,oy=0,radius=0,rotation=0,extra_paint=""):
    i=nid(); bm=f' blendModeValue="{blend}"' if blend else ""; r=f' rotation="{rotation}"' if rotation else ""
    cr=f' cornerRadiusTL="{radius}" cornerRadiusTR="{radius}" cornerRadiusBL="{radius}" cornerRadiusBR="{radius}"' if radius else ""
    emit(f'<Shape x="{x:.2f}" y="{y:.2f}" opacity="{opacity}"{bm}{r} name="{name}" id="{i}"><Rectangle width="{w:.2f}" height="{h:.2f}" originX="{ox}" originY="{oy}"{cr} name="Path"/>{fill}{extra_paint}</Shape>'); return i
def ellipse(name,cx,cy,w,h,fill,blend="screen",opacity=1):
    i=nid(); emit(f'<Shape x="{cx:.2f}" y="{cy:.2f}" opacity="{opacity}" blendModeValue="{blend}" name="{name}" id="{i}"><Ellipse width="{w:.2f}" height="{h:.2f}" originX="0.5" originY="0.5" name="Path"/>{fill}</Shape>'); return i
def solid(c): return f'<Fill name="Fill"><SolidColor colorValue="{c}" name="C"/></Fill>'
def radial(c_in,c_out,rx,ry=None,cx=0,cy=0):
    ry=rx if ry is None else ry
    return f'<Fill name="Fill"><RadialGradient startX="{cx}" startY="{cy}" endX="{cx+rx:.2f}" endY="{cy:.2f}" name="G"><GradientStop colorValue="{c_in}" position="0"/><GradientStop colorValue="{c_out}" position="1"/></RadialGradient></Fill>'
def linear(stops,x0,y0,x1,y1):
    st="".join(f'<GradientStop colorValue="{c}" position="{p}"/>' for c,p in stops)
    return f'<Fill name="Fill"><LinearGradient startX="{x0}" startY="{y0}" endX="{x1}" endY="{y1}" name="G">{st}</LinearGradient></Fill>'

# ---------- view model ----------
VM=nid(); VMI=nid()
props={n:nid() for n in ["hoverIt","hoverGov","hoverCyber","openIt","openGov","openCyber","parallaxX","parallaxY","walk","doorIt","doorGov","doorCyber"]}
def bind(prop,keyid,conv=None):
    c=f' converterId="{conv}"' if conv else ""
    return f'<DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="{keyid}"{c}/>'
# range mappers: parallax -1..1 -> plane offset around its base
convs=[]
def mapper(name,mi,ma,mo0,mo1):
    c=nid(); convs.append(f'    <DataConverterRangeMapper minInput="{mi}" maxInput="{ma}" minOutput="{mo0:.2f}" maxOutput="{mo1:.2f}" clampLower="true" clampUpper="true" name="{name}" id="{c}"/>'); return c
PL={"near":(-8,-4),"mid":(-3,-1.5),"far":(-2,-1),"room":(0,0)}
mappers={}
for plane,(kx,ky) in PL.items():
    mappers[plane]=(mapper(f"px_{plane}",-1,1,-CAMX-kx,-CAMX+kx), mapper(f"py_{plane}",-1,1,-CAMY-ky,-CAMY+ky))
walk_scale=mapper("walk_scale",0,1,1.0,1.24); walk_y=mapper("walk_y",0,1,CAMY,CAMY+28)
door_scale=mapper("door_scale",0,1,1.0,0.07); door_shade=mapper("door_shade",0,1,0.0,0.45); door_far=mapper("door_far",0,1,0.0,1.0)

# ---------- artboard ----------
AB=nid(); SM=nid(); STYLE=nid()
CAM=nid()
def plane_open(plane):
    p=nid(); mx,my=mappers[plane]
    emit(f'<Node x="{-CAMX}" y="{-CAMY}" name="Plane_{plane}" id="{p}">{bind("parallaxX",13,mx)}{bind("parallaxY",14,my)}'); return p

emit(f'<Node x="{CAMX}" y="{CAMY}" name="Camera" id="{CAM}">{bind("walk",16,walk_scale)}{bind("walk",17,walk_scale)}{bind("walk",14,walk_y)}')
dim=rect("room_dim",-CAMX-40,-CAMY-40,W+80,H+80,solid("FF2A1F4A"),"multiply",0.62)
key("Lights On",dim,"opacity",[(0,0.62,"hold"),(16,0.62,"hold"),(20,0.3,"hold"),(24,0.58,"hold"),(30,0.2,"cubic"),(64,0.42,"cubic"),(110,0,"linear"),(None,0,"hold")])
key("Lights Breathe",dim,"opacity",[(0,0,"hold")])

# ===== NEAR plane (front) =====
plane_open("near")
def sway_plant(name,anim,amp,phase):
    l=M[name]; px,py=l["x"]+l["w"]/2, l["y"]+l["h"]; n=nid()
    emit(f'<Node x="{px:.2f}" y="{py:.2f}" name="pivot_{name}" id="{n}">'); image(name,A[name],-l["w"]/2,-l["h"]); emit('</Node>')
    a=amp
    if phase==0: key(anim,n,"rotation",[(0,-a,"cubic"),(None,a,"linear")])
    elif phase==1: key(anim,n,"rotation",[(0,a,"cubic"),(None,-a,"linear")])
    else: key(anim,n,"rotation",[(0,0,"cubic"),(0.5,a*0.9,"cubic"),(None,-a*0.6,"linear")])
A={n:asset(n) for n in M}; A["bg_plate"]=asset("bg_plate")   # all image assets
sway_plant("plant_right_fg","Sway A",0.010,0)
# camera REC dots (front so nothing covers them)
recs=[]
for k in ("cam_left","cam_right"):
    cx,cy,w,h=FX[k]; recs.append(ellipse(f"rec_{k}",cx-w*0.22,cy+h*0.12,22,22,radial("FFFF5A5A","00FF3B3B",11),"screen",0))
for r in recs: key("Camera Blink",r,"opacity",[(0,0,"hold"),(4,1,"hold"),(14,0,"hold"),(24,1,"hold"),(34,0,"hold"),(None,0,"hold")])
emit('</Node>')

# ===== MID plane: free-standing plants only (in front of the wall) =====
plane_open("mid")
sway_plant("plant_left_rear","Sway C",0.011,2); sway_plant("plant_gov_left","Sway A",0.009,1); sway_plant("plant_gov_right","Sway B",0.010,2)
sway_plant("plant_cyber_right","Sway C",0.008,0); sway_plant("plant_window_mid","Sway A",0.012,2); sway_plant("plant_table","Sway B",0.007,0)
emit('</Node>')  # mid

# ===== FAR plane: clouds =====
plane_open("far")
cl=M["clouds"]; cnode=nid(); emit(f'<Node x="{cl["x"]:.2f}" y="{cl["y"]:.2f}" name="clouds_drift" id="{cnode}">'); image("clouds",A["clouds"],0,0); emit('</Node>')
key("Clouds",cnode,"x",[(0,cl["x"],"cubic"),(None,cl["x"]+18,"linear")])
emit('</Node>')

# ===== ROOM plane: wall fixtures, doors, readers, light, and the plate =====
plane_open("room")
image("plant_left_fg",A["plant_left_fg"],M["plant_left_fg"]["x"],M["plant_left_fg"]["y"])
image("arch_right_fg",A["arch_right_fg"],M["arch_right_fg"]["x"],M["arch_right_fg"]["y"])
# sun shaft from the window across the lounge
shaft=rect("sun_shaft",1440,300,330,900,linear([("00FFFFFF",0),("8AF1EDFF",0.5),("00FFFFFF",1)],-165,0,165,0),"screen",0,ox=0.5,oy=0,rotation=0.42)
key("Lights On",shaft,"opacity",[(0,0,"cubic"),(110,0.5,"linear"),(None,0.5,"hold")]); key("Lights Breathe",shaft,"opacity",[(0,0.35,"cubic"),(None,0.6,"linear")])
# window light wash on the floor (right side), breathes with the clouds
wash=rect("window_wash",1120,430,552,511,linear([("8CEDE7FF",0),("2AEDE7FF",0.45),("00EDE7FF",1)],552,0,0,511),"screen",0.6)
key("Lights On",wash,"opacity",[(0,0,"cubic"),(90,0.6,"linear"),(None,0.6,"hold")])
key("Lights Breathe",wash,"opacity",[(0,0.55,"cubic"),(None,0.85,"linear")])
# floor shimmer band sweeping across the floor
sh=rect("floor_shimmer",380,730,240,560,linear([("00FFFFFF",0),("66FFFFFF",0.5),("00FFFFFF",1)],-120,0,120,0),"screen",0,ox=0.5,oy=0.5,rotation=-0.32)
key("Floor Shimmer",sh,"x",[(0,300,"linear"),(None,1420,"linear")]); key("Floor Shimmer",sh,"opacity",[(0,0,"cubic"),(0.5,0.55,"cubic"),(None,0,"linear")])
image("window_frames",A["window_frames"],M["window_frames"]["x"],M["window_frames"]["y"])
# ceiling light glows
lin=FX["linear"]; g=ellipse("glow_linear",lin[0]+lin[2]/2,lin[1]+lin[3]/2+10,lin[2]*1.4,200,radial("FFF6F2FF","00F6F2FF",lin[2]*0.7,100),"screen",0)
glows=[(g,0.7,1.0)]
cone=rect("light_cone",lin[0]+lin[2]/2,20,lin[2]*1.1,600,linear([("66F3EEFF",0),("00F3EEFF",1)],0,0,0,600),"screen",0,ox=0.5,oy=0); glows.append((cone,0.35,0.6))
for i,(cx,cy,w,h) in enumerate(FX["recessed"]):
    glows.append((ellipse(f"glow_recessed_{i}",cx,cy+6,max(w*4,130),max(h*4,70),radial("FFFFF6E8","00FFF6E8",max(w*2,65),max(h*2,35)),"screen",0),0.7,1.0))
# sign halo
halo=ellipse("sign_halo",852,135,820,230,radial("FFDACFFF","00DACFFF",410,115),"screen",0); glows.append((halo,0.55,0.85))
# monitor screen glow
ms=FX["monitor_screen"]; mon=rect("monitor_glow",ms[0],ms[1],ms[2],ms[3],solid("FF8FB3FF"),"screen",0,radius=4)
key("Lights On",mon,"opacity",[(0,0,"hold"),(70,0,"hold"),(72,0.22,"hold"),(None,0.18,"hold")])
key("Screen Flicker",mon,"opacity",[(0,0.16,"hold"),(40,0.22,"hold"),(70,0.15,"hold"),(110,0.2,"hold"),(None,0.16,"hold")])
# monitor screen content: five "code lines" typing in, then clearing (loop)
for i in range(5):
    ln=rect(f"code_line_{i}",ms[0]+14,ms[1]+18+i*17,ms[2]*(0.45+0.11*((i*3)%5)),6,solid("FFD9CFFF"),"screen",0,radius=3)
    key("Screen Flicker",ln,"opacity",[(0,0,"hold"),(14+i*18,0,"hold"),(16+i*18,0.75,"hold"),(150,0.75,"hold"),(156,0,"hold"),(None,0,"hold")])
# mug steam: three wisps rising from the mug, staggered
mug=(185,478)
for i,(dx,dur,ph) in enumerate([(-10,190,0),(4,230,70),(16,210,140)]):
    w=ellipse(f"steam_{i}",mug[0]+dx,mug[1],14,34,radial("FFFFFFFF","00FFFFFF",7,17),"screen",0)
    key("Steam",w,"y",[(0,mug[1]+2,"linear"),(None,mug[1]-46,"linear")])
    key("Steam",w,"x",[(0,mug[0]+dx,"cubic"),(0.5,mug[0]+dx+5,"cubic"),(None,mug[0]+dx-4,"linear")])
    key("Steam",w,"opacity",[(0,0,"cubic"),(0.25,0.55,"cubic"),(None,0,"linear")])
    key("Steam",w,"scaleX",[(0,0.6,"linear"),(None,1.6,"linear")]); key("Steam",w,"scaleY",[(0,0.7,"linear"),(None,1.3,"linear")])
# security pillar: a soft highlight stepping DETECT -> PROTECT -> RESPOND
scan=rect("pillar_scan",1381,230,96,48,radial("FFDACFFF","00DACFFF",48,24),"screen",0,ox=0.5,oy=0.5,radius=10)
key("Pillar Scan",scan,"y",[(0,232,"hold"),(70,232,"cubic"),(92,318,"hold"),(162,318,"cubic"),(184,405,"hold"),(254,405,"hold"),(None,405,"hold")])
key("Pillar Scan",scan,"opacity",[(0,0,"cubic"),(12,0.55,"hold"),(66,0.55,"cubic"),(70,0.2,"cubic"),(92,0.55,"hold"),(158,0.55,"cubic"),(162,0.2,"cubic"),(184,0.55,"hold"),(250,0.55,"cubic"),(266,0,"hold"),(None,0,"hold")])
# camera lens glint: a quick sparkle on each dome
for k in ("cam_left","cam_right"):
    cx,cy,w,h=FX[k]; gl=ellipse(f"glint_{k}",cx+w*0.12,cy-h*0.1,10,10,radial("FFFFFFFF","00FFFFFF",5),"screen",0)
    key("Camera Blink",gl,"opacity",[(0,0,"hold"),(200,0,"cubic"),(206,0.95,"cubic"),(222,0,"hold"),(None,0,"hold")])
    key("Camera Blink",gl,"scaleX",[(0,0.4,"hold"),(200,0.4,"cubic"),(222,2.2,"hold")]); key("Camera Blink",gl,"scaleY",[(0,0.4,"hold"),(200,0.4,"cubic"),(222,2.2,"hold")])
# mission poster backlight breathing
post=rect("poster_glow",18,195,162,255,linear([("40FFFFFF",0),("00FFFFFF",1)],0,0,162,0),"screen",0)
glows.append((post,0.25,0.6))
# window glass glint: a diagonal band sweeping the glazing, clipped to the glass
gclip=nid(); emit(f'<Shape x="1462" y="60" name="glass_clip" id="{gclip}"><Rectangle width="210" height="500" originX="0" originY="0" name="Path"/></Shape>')
glint=nid(); emit(f'<Shape x="1420" y="300" opacity="0" blendModeValue="screen" rotation="0.6" name="glass_glint" id="{glint}"><Rectangle width="70" height="700" originX="0.5" originY="0.5" name="Path"/>{linear([("00FFFFFF",0),("99FFFFFF",0.5),("00FFFFFF",1)],-35,0,35,0)}<ClippingShape sourceId="{gclip}" name="Clip"/></Shape>')
key("Glass Glint",glint,"x",[(0,1400,"linear"),(None,1760,"linear")]); key("Glass Glint",glint,"opacity",[(0,0,"cubic"),(0.5,0.45,"cubic"),(None,0,"linear")])
# dust motes drifting in the sun shaft
import random; random.seed(7)
for i in range(14):
    x0=random.uniform(1330,1660); y0=random.uniform(280,900); r=random.uniform(2.2,4.5); mote=ellipse(f"mote_{i}",x0,y0,r*2,r*2,radial("FFFFFFFF","00FFFFFF",r),"screen",0)
    an=["Motes A","Motes B","Motes C"][i%3]; drift=random.uniform(-40,-70); side=random.uniform(-25,25); ph=random.random()
    key(an,mote,"y",[(0,y0,"linear"),(None,y0+drift,"linear")]); key(an,mote,"x",[(0,x0,"cubic"),(0.5,x0+side,"cubic"),(None,x0-side*0.5,"linear")])
    key(an,mote,"opacity",[(0,0,"cubic"),(min(0.95,ph*0.5+0.15),random.uniform(0.35,0.7),"cubic"),(None,0,"linear")])
# door header green strips + reader LEDs + hover rings + leaves + reveals
DOORS=[("it","door_it_leaf","reader_it","024_it_header",636,239),("gov","door_gov_leaf","reader_gov","027_gov_header",883,240),("cyber","door_cyber_leaf","reader_cyber","030_cyber_header",1131,241)]
door_objs={}
for d,leaf,reader,plate,gx,gy in DOORS:
    l=M[leaf]; rd=M[reader]
    P=d.capitalize() if d!="it" else "It"
    # hit target: frame + label plate (transparent fill is hit-testable)
    hit=rect(f"hit_{d}",l["x"]-10,l["y"]-82,l["w"]+20,l["h"]+96,solid("00FFFFFF"))
    # hover ring: feathered stroke around the frame
    ring_id=nid()
    emit(f'<Shape x="{l["x"]-5:.2f}" y="{l["y"]-5:.2f}" opacity="0" name="ring_{d}" id="{ring_id}"><Rectangle width="{l["w"]+10:.2f}" height="{l["h"]+10:.2f}" originX="0" originY="0" cornerRadiusTL="3" cornerRadiusTR="3" name="Path"/>'
         f'<Stroke thickness="7" name="Glow"><SolidColor colorValue="FF31E07F" name="C"/><Feather strength="14" name="F"/></Stroke><Stroke thickness="2" name="Crisp"><SolidColor colorValue="FFB9F5D3" name="C"/></Stroke></Shape>')
    # green strip glow (lights layer) + hover boost glow (door layer)
    strip=ellipse(f"strip_{d}",gx,gy+1,96,30,radial("FF7CF0AE","0031E07F",48,15),"screen",0); glows.append((strip,0.7,1.0))
    pool=ellipse(f"pool_{d}",l["x"]+l["w"]/2,l["y"]+l["h"]+22,l["w"]*1.9,70,radial("FFF7F3FF","00F7F3FF",l["w"]*0.95,35),"screen",0); glows.append((pool,0.45,0.75))
    gref=ellipse(f"green_ref_{d}",l["x"]+l["w"]/2,l["y"]+l["h"]+14,l["w"]*1.1,26,radial("FF31E07F","0031E07F",l["w"]*0.55,13),"screen",0); glows.append((gref,0.18,0.35))
    boost=ellipse(f"strip_boost_{d}",gx,gy+1,110,34,radial("FF7CF0AE","0031E07F",55,17),"screen",0)
    led=ellipse(f"led_{d}",rd["x"]+rd["w"]/2,rd["y"]+7,14,14,radial("FF31E07F","0031E07F",7),"screen",0); glows.append((led,0.5,0.95))
    # leaf on a hinge at its left edge, with a shade rect that scales with it
    dn=f"door{P}"
    hinge=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]+l["h"]/2:.2f}" name="hinge_{d}" id="{hinge}">{bind(dn,16,door_scale)}')
    shade=rect(f"shade_{d}",0,-l["h"]/2,l["w"],l["h"],solid("FF0D0A14"),None,0,extra_paint=bind(dn,18,door_shade))
    image(leaf,A[leaf],0,-l["h"]/2)
    emit('</Node>')
    # reveal: corridor behind the leaf
    rv=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="reveal_{d}" id="{rv}">')
    far=rect(f"reveal_far_{d}",l["w"]*0.5,l["h"]*0.52,l["w"]*0.34,l["h"]*0.42,radial("FFC9BEF2","00C9BEF2",l["w"]*0.3,l["h"]*0.3),"screen",0.0,ox=0.5,oy=0.5,extra_paint=bind(dn,18,door_far))
    rect(f"reveal_floor_{d}",0,l["h"]*0.82,l["w"],l["h"]*0.18,linear([("FF2A1856",0),("FF150E2A",1)],0,0,0,l["h"]*0.18))
    rect(f"reveal_wall_{d}",0,0,l["w"],l["h"]*0.84,linear([("FF1C1338",0),("FF0D0A14",1)],0,0,0,l["h"]*0.84))
    emit('</Node>')
    door_objs[d]=dict(hit=hit,ring=ring_id,boost=boost,hinge=hinge,shade=shade,far=far,leaf=leaf)
    key(f"Door {P} Closed",ring_id,"opacity",[(0,0,"hold")]); key(f"Door {P} Closed",boost,"opacity",[(0,0,"hold")])
    key(f"Door {P} Hover",ring_id,"opacity",[(0,0,"cubic"),(14,1,"linear")]); key(f"Door {P} Hover",boost,"opacity",[(0,0,"cubic"),(14,0.9,"linear")])
# readers on the wall (static images above the reveals but below plants? they're beside doors)
for d,leaf,reader,plate,gx,gy in DOORS:
    rd=M[reader]; image(reader,A[reader],rd["x"],rd["y"])
# the plate, slightly oversized so parallax never shows an edge
image("bg_plate",A["bg_plate"],0,0)
emit('</Node>')  # room
emit('</Node>')  # camera

# lights: intro + breathe keys for every glow
for i,(g,lo,hi) in enumerate(glows):
    on=[(0,0,"hold"),(18+i*3,0,"hold"),(20+i*3,hi,"hold"),(26+i*3,lo*0.4,"hold"),(34+i*3,hi,"cubic"),(70+i*3,lo,"cubic"),(None,(lo+hi)/2,"linear")]
    key("Lights On",g,"opacity",on)
    key("Lights Breathe",g,"opacity",[(0,lo,"cubic"),(None,hi,"linear")])

# ---------- animations ----------
DUR={"Sway A":324,"Sway B":390,"Sway C":456,"Clouds":2880,"Lights On":150,"Lights Breathe":330,"Floor Shimmer":1440,"Camera Blink":480,"Screen Flicker":240,"Steam":210,"Pillar Scan":360,"Glass Glint":840,"Motes A":540,"Motes B":690,"Motes C":810}
LOOP={"Sway A":"pingPong","Sway B":"pingPong","Sway C":"pingPong","Clouds":"pingPong","Lights On":"oneShot","Lights Breathe":"pingPong","Floor Shimmer":"loop","Camera Blink":"loop","Screen Flicker":"loop","Steam":"loop","Pillar Scan":"loop","Glass Glint":"loop","Motes A":"loop","Motes B":"loop","Motes C":"loop"}
for d,*_ in DOORS:
    P=d.capitalize() if d!="it" else "It"
    for s,n,lp in [("Closed",1,"oneShot"),("Hover",16,"oneShot")]: DUR[f"Door {P} {s}"]=n; LOOP[f"Door {P} {s}"]=lp
anim_ids={}
anim_xml=[]
for name,dur in DUR.items():
    aid=nid(); anim_ids[name]=aid
    ko=[]
    for obj,prop,frames in anims.get(name,[]):
        kf=[]
        for f,v,interp in frames:
            fr = dur if f is None else (int(round(f*dur)) if isinstance(f,float) and f<1 else int(f))
            fr=min(fr,dur)
            if interp=="cubic": kf.append(f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="cubic">{EASE}</KeyFrameDouble>')
            else: kf.append(f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="{interp}"/>')
        ko.append(f'<KeyedObject objectId="{obj}"><KeyedProperty propertyKey="{KEYS[prop]}">{"".join(kf)}</KeyedProperty></KeyedObject>')
    anim_xml.append(f'<LinearAnimation loopValue="{LOOP[name]}" duration="{dur}" fps="{FPS}" name="{name}" id="{aid}">{"".join(ko)}</LinearAnimation>')

# ---------- state machine ----------
def cond(prop,val):  # boolean view-model condition
    return f'<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyBoolean><DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="634"/></BindablePropertyBoolean></TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="{val}"/></TransitionViewModelCondition>'
inputs={d:nid() for d,*_ in DOORS}
def icond(d,val): return f'<TransitionBoolCondition inputId="{inputs[d]}" opValue="{"equal" if val=="true" else "notEqual"}"/>'
layers=[]
def simple_layer(name,anim):
    s=nid(); return f'<StateMachineLayer name="{name}" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="420" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{s}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids[anim]}" id="{s}"/></StateMachineLayer>'
for n in ["Sway A","Sway B","Sway C","Clouds","Floor Shimmer","Camera Blink","Screen Flicker","Steam","Pillar Scan","Glass Glint","Motes A","Motes B","Motes C"]: layers.append(simple_layer(n,n))
s_on=nid(); s_br=nid()
layers.append(f'<StateMachineLayer name="Lights" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="520" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{s_on}"/></EntryState>'
              f'<AnimationState x="160" y="0" animationId="{anim_ids["Lights On"]}" id="{s_on}"><StateTransition stateToId="{s_br}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="400"/></AnimationState>'
              f'<AnimationState x="360" y="0" animationId="{anim_ids["Lights Breathe"]}" id="{s_br}"/></StateMachineLayer>')
listeners=[]
for d,*_ in DOORS:
    P=d.capitalize() if d!="it" else "It"; hv=f"hover{P}"; op=f"open{P}"
    sc,sh=nid(),nid()
    layers.append(f'<StateMachineLayer name="Door {P}" id="{nid()}"><AnyState x="60" y="-140"/><ExitState x="620" y="-140"/>'
                  f'<EntryState x="-60" y="0"><StateTransition stateToId="{sc}"/></EntryState>'
                  f'<AnimationState x="160" y="0" animationId="{anim_ids[f"Door {P} Closed"]}" id="{sc}"><StateTransition stateToId="{sh}" duration="120">{cond(hv,"true")}</StateTransition></AnimationState>'
                  f'<AnimationState x="360" y="0" animationId="{anim_ids[f"Door {P} Hover"]}" id="{sh}"><StateTransition stateToId="{sc}" duration="220">{cond(hv,"false")}</StateTransition></AnimationState>'
                  f'</StateMachineLayer>')
    hit=door_objs[d]["hit"]
    for ev,val in [("enter","true"),("exit","false")]:
        listeners.append(f'<StateMachineListenerSingle targetId="{hit}" listenerTypeValue="{ev}" name="{ev}_{d}" id="{nid()}"><ListenerViewModelChange><BindablePropertyBoolean propertyValue="{val}"><DataBindContext sourcePathIds="{VM}-{props[hv]}" propertyKey="634" direction="true"/></BindablePropertyBoolean></ListenerViewModelChange></StateMachineListenerSingle>')
    listeners.append(f'<StateMachineListenerSingle targetId="{hit}" listenerTypeValue="click" name="click_{d}" id="{nid()}"><ListenerViewModelChange><BindablePropertyBoolean propertyValue="true"><DataBindContext sourcePathIds="{VM}-{props[op]}" propertyKey="634" direction="true"/></BindablePropertyBoolean></ListenerViewModelChange></StateMachineListenerSingle>')

vm_props="".join(f'<ViewModelPropertyBoolean name="{n}" id="{i}"/>' if not n.startswith(("parallax","walk","door")) else f'<ViewModelPropertyNumber name="{n}" id="{i}"/>' for n,i in props.items())
vm_vals="".join(f'<ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="{i}"/>' if not n.startswith(("parallax","walk","door")) else f'<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{i}"/>' for n,i in props.items())

rml=f'''<Rive version="1" kind="fragment">
    <Artboard defaultStateMachineId="{SM}" styleId="{STYLE}" viewModelId="{VM}" viewModelInstanceId="{VMI}" width="{W}" height="{H}" name="Lobby" id="{AB}">
        <LayoutComponentStyle name="Artboard Style" id="{STYLE}"/>
        <Fill name="Background"><SolidColor colorValue="FFE9E5F3" name="C"/></Fill>
        {chr(10).join("        "+l for l in out)}

        {chr(10).join("        "+a for a in anim_xml)}

        <StateMachine name="Lobby" id="{SM}">
            {chr(10).join("            "+l for l in listeners)}
            {chr(10).join("            "+l for l in layers)}
        </StateMachine>
    </Artboard>

{chr(10).join(assets)}
{chr(10).join(convs)}

    <ViewModel defaultInstanceId="{VMI}" name="Lobby" id="{VM}">
        {vm_props}
        <ViewModelInstance exports="true" name="Default" id="{VMI}">{vm_vals}</ViewModelInstance>
    </ViewModel>
</Rive>
'''
OUT.write_text(rml)
print("scene.rml:", len(out), "scene elements,", len(anim_xml), "animations,", len(layers), "layers,", len(listeners), "listeners,", ids["n"], "ids")
