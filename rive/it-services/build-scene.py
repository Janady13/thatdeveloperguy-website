#!/usr/bin/env python3
"""IT Services room → scene.rml, authored to TDG_IT_SERVICES_ANIMATION_KIT/rive/ITServicesMachine.build-spec.json (inputs, hotspots, ambient, parallel layers)
on the clean 4x plates. MODE=embedded|ref2x|ref4x. Run from rive/it-services: python3 build-scene.py && rive . --verify"""
import json, os, random
from pathlib import Path
HERE=Path(__file__).parent; MODE=os.environ.get("MODE","embedded"); IMG_SCALE={"embedded":0.5,"ref2x":0.5,"ref4x":0.25}[MODE]; OUT=Path(os.environ.get("OUT",str(HERE/"scene.rml")))
VEC=os.environ.get("VEC")=="1"   # Adobe-vectorized layers (creative-source/plates/<room>/vec/rml) instead of raster plates
P=HERE/"../../creative-source/plates/it-services"; M=json.load(open(P/"2x/manifest.json"))["layers"]; FX=json.load(open(P/"fixtures.json"))
W,H=1672,941; FPS=60; ids={"n":0}
def nid(): ids["n"]+=1; return f"0:{ids['n']+100}"
out=[]; assets=[]; anims={}
def emit(s): out.append(s)
def key(anim,obj,prop,frames): anims.setdefault(anim,[]).append((obj,prop,frames))
KEYS={"x":13,"y":14,"rotation":15,"scaleX":16,"scaleY":17,"opacity":18}; EASE='<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
VECRML=P/"vec"/"rml"
def image(name,aid,x,y,ox=0,oy=0):
    """A layer at (x,y) in the parent's space. Raster: the 2x/4x plate image. Vector: its converted path group, re-based from artboard space."""
    i=nid()
    if VEC:
        frag=json.load(open(VECRML/f"{name}.json")); l=M.get(name)
        # the fragment's shapes are in artboard coords; the parent expects the layer's top-left at (x,y)
        ax,ay=(l["x"],l["y"]) if l else (0,0)
        emit(f'<Node x="{x-ax:.2f}" y="{y-ay:.2f}" name="{name}" id="{i}">'+"".join(frag["shapes"])+'</Node>'); return i
    emit(f'<Image x="{x:.2f}" y="{y:.2f}" originX="{ox}" originY="{oy}" scaleX="{IMG_SCALE}" scaleY="{IMG_SCALE}" assetId="{aid}" name="{name}" id="{i}"/>'); return i
def asset(name):
    if VEC: return None
    a=nid(); f=f' file="assets/2x/{name}.webp"' if MODE=="embedded" else ""; assets.append(f'    <ImageAsset{f} name="{name}" id="{a}"/>'); return a
def rect(name,x,y,w,h,fill,blend=None,opacity=1,ox=0,oy=0,radius=0,rotation=0,extra=""):
    i=nid(); bm=f' blendModeValue="{blend}"' if blend else ""; r=f' rotation="{rotation}"' if rotation else ""
    cr=f' cornerRadiusTL="{radius}" cornerRadiusTR="{radius}" cornerRadiusBL="{radius}" cornerRadiusBR="{radius}"' if radius else ""
    emit(f'<Shape x="{x:.2f}" y="{y:.2f}" opacity="{opacity}"{bm}{r} name="{name}" id="{i}"><Rectangle width="{w:.2f}" height="{h:.2f}" originX="{ox}" originY="{oy}"{cr} name="Path"/>{fill}{extra}</Shape>'); return i
def ellipse(name,cx,cy,w,h,fill,blend="screen",opacity=1):
    i=nid(); emit(f'<Shape x="{cx:.2f}" y="{cy:.2f}" opacity="{opacity}" blendModeValue="{blend}" name="{name}" id="{i}"><Ellipse width="{w:.2f}" height="{h:.2f}" originX="0.5" originY="0.5" name="Path"/>{fill}</Shape>'); return i
def solid(c): return f'<Fill name="Fill"><SolidColor colorValue="{c}" name="C"/></Fill>'
def radial(ci,co,rx,ry=None): ry=rx if ry is None else ry; return f'<Fill name="Fill"><RadialGradient startX="0" startY="0" endX="{rx:.2f}" endY="0" name="G"><GradientStop colorValue="{ci}" position="0"/><GradientStop colorValue="{co}" position="1"/></RadialGradient></Fill>'
def linear(stops,x0,y0,x1,y1):
    st="".join(f'<GradientStop colorValue="{c}" position="{p}"/>' for c,p in stops)
    return f'<Fill name="Fill"><LinearGradient startX="{x0}" startY="{y0}" endX="{x1}" endY="{y1}" name="G">{st}</LinearGradient></Fill>'
# ---------- view model (kit inputs + host-tweened amounts) ----------
VM=nid(); VMI=nid()
bools=["doorOpen","drawer1Open","drawer2Open","drawer3Open","drawer4Open","drawer5Open","laptopTilted","chairNudged","ambientEnabled","reducedMotion","refreshDisplay"]
nums=["hoverTarget","doorAmount","laptopAmount","chairAmount","drawer1Amount","drawer2Amount","drawer3Amount","drawer4Amount","drawer5Amount","walk"]
props={n:nid() for n in bools+nums}
def bind(prop,k,conv=None):
    c=f' converterId="{conv}"' if conv else ""
    return f'<DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="{k}"{c}/>'
convs=[]
def mapper(name,mi,ma,o0,o1): c=nid(); convs.append(f'    <DataConverterRangeMapper minInput="{mi}" maxInput="{ma}" minOutput="{o0:.3f}" maxOutput="{o1:.3f}" clampLower="true" clampUpper="true" name="{name}" id="{c}"/>'); return c
# ---------- artboard ----------
AB=nid(); SM=nid(); STYLE=nid()
CAMX,CAMY=836,400
walk_s=mapper("walk_scale",0,1,1,1.18); walk_y=mapper("walk_y",0,1,CAMY,CAMY+20)
CAM=nid(); emit(f'<Node x="{CAMX}" y="{CAMY}" name="Camera" id="{CAM}">{bind("walk",16,walk_s)}{bind("walk",17,walk_s)}{bind("walk",14,walk_y)}')
dim=rect("room_dim",-CAMX-40,-CAMY-40,W+80,H+80,solid("FF2A1F4A"),"multiply",0.6)
key("Lights On",dim,"opacity",[(0,0.6,"hold"),(14,0.6,"hold"),(18,0.3,"hold"),(22,0.56,"hold"),(28,0.2,"cubic"),(60,0.4,"cubic"),(104,0,"linear"),(None,0,"hold")]); key("Lights Breathe",dim,"opacity",[(0,0,"hold")])
ROOM=nid(); emit(f'<Node x="{-CAMX}" y="{-CAMY}" name="Room" id="{ROOM}">')
A={n:asset(n) for n in M}; A["bg_plate"]=asset("bg_plate")
glows=[]   # (id, lo, hi) keyed by the Lights layer
# --- front: foreground plant, steam, motes ---
def sway(name,anim,amp,phase):
    l=M[name]; px,py=l["x"]+l["w"]/2,l["y"]+l["h"]; n=nid(); emit(f'<Node x="{px:.2f}" y="{py:.2f}" name="pivot_{name}" id="{n}">'); image(name,A[name],-l["w"]/2,-l["h"]); emit('</Node>')
    if phase==0: key(anim,n,"rotation",[(0,-amp,"cubic"),(None,amp,"linear")])
    elif phase==1: key(anim,n,"rotation",[(0,amp,"cubic"),(None,-amp,"linear")])
    else: key(anim,n,"rotation",[(0,0,"cubic"),(0.5,amp,"cubic"),(None,-amp*0.7,"linear")])
SW=0.0049   # kit: ±0.28°
sway("plant_front_left","Sway A",SW,0)
mug=FX["mug"]; mx,my=mug[0]+mug[2]/2,mug[1]+4
for i,(dx,ph) in enumerate([(-8,0),(3,1/3),(12,2/3)]):   # kit: 3 wisps, 5 s, stagger 1.667 s
    w=ellipse(f"mug_steam_{i+1}",mx+dx,my,12,30,radial("FFFFFFFF","00FFFFFF",6),"screen",0)
    key("Steam",w,"y",[(0,my+2,"linear"),(None,my-42,"linear")]); key("Steam",w,"x",[(0,mx+dx,"cubic"),(0.5,mx+dx+4,"cubic"),(None,mx+dx-3,"linear")])
    key("Steam",w,"opacity",[(0,0,"cubic"),(0.3,0.5,"cubic"),(None,0,"linear")]); key("Steam",w,"scaleX",[(0,0.6,"linear"),(None,1.5,"linear")])
random.seed(11)
for i in range(12):
    x0=random.uniform(60,420); y0=random.uniform(150,620); r=random.uniform(2,4); mote=ellipse(f"mote_{i}",x0,y0,r*2,r*2,radial("FFFFFFFF","00FFFFFF",r),"screen",0)
    an=["Motes A","Motes B","Motes C"][i%3]; dr=random.uniform(-35,-60); sd=random.uniform(-20,20)
    key(an,mote,"y",[(0,y0,"linear"),(None,y0+dr,"linear")]); key(an,mote,"x",[(0,x0,"cubic"),(0.5,x0+sd,"cubic"),(None,x0-sd*0.5,"linear")]); key(an,mote,"opacity",[(0,0,"cubic"),(0.5,random.uniform(0.3,0.6),"cubic"),(None,0,"linear")])
# --- chair (kit: chairNudged → translate -4,+2) ---
l=M["chair_near"]; cn=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="chair_near" id="{cn}">{bind("chairAmount",13,mapper("chair_x",0,1,l["x"],l["x"]-4))}{bind("chairAmount",14,mapper("chair_y",0,1,l["y"],l["y"]+2))}'); image("chair_near",A["chair_near"],0,0); emit('</Node>')
# --- phone (kit: phone_ring) ---
l=M["phone"]; ph=nid(); emit(f'<Node x="{l["x"]+l["w"]/2:.2f}" y="{l["y"]+l["h"]:.2f}" name="phone_ring" id="{ph}">'); image("phone",A["phone"],-l["w"]/2,-l["h"]); emit('</Node>')
key("Phone Ring",ph,"rotation",[(0,0,"hold"),(560,0,"hold")]+[(560+i*4,(0.05 if i%2==0 else -0.05),"hold") for i in range(1,13)]+[(612,0,"hold"),(None,0,"hold")])
# --- plants in the room (kit sway_small) ---
sway("plant_low_left","Sway B",SW,1); sway("plant_desk_left","Sway C",SW,2); sway("plant_back_left","Sway A",SW,1); sway("plant_counter","Sway B",SW,2); sway("plant_right","Sway C",SW,0)
# --- hanging sign on its cables (kit: cable loops sway_small) ---
sp=M["sign_panel"]; sn=nid(); emit(f'<Node x="{sp["x"]+sp["w"]/2:.2f}" y="0" name="sign_swing" id="{sn}">')
for n in ("cable_left","cable_right","sign_panel"): l=M[n]; image(n,A[n],l["x"]-(sp["x"]+sp["w"]/2),l["y"])
emit('</Node>'); key("Sway B",sn,"rotation",[(0,-0.003,"cubic"),(None,0.003,"linear")])
# --- tool cart drawers (kit: translate -19,+9 per drawer) ---
for i in range(1,6):
    l=M[f"drawer_{i}"]; dn=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="tool_cart_drawer_{i}" id="{dn}">{bind(f"drawer{i}Amount",13,mapper(f"drawer{i}_x",0,1,l["x"],l["x"]-19))}{bind(f"drawer{i}Amount",14,mapper(f"drawer{i}_y",0,1,l["y"],l["y"]+9))}'); image(f"drawer_{i}",A[f"drawer_{i}"],0,0); emit('</Node>')
# --- laptop lid (kit: pivot at hinge, scaleY 1→0.84) ---
l=M["laptop_lid"]; ln=nid(); emit(f'<Node x="{l["x"]+l["w"]/2:.2f}" y="{l["y"]+l["h"]:.2f}" name="laptop_lid" id="{ln}">{bind("laptopAmount",17,mapper("laptop_sy",0,1,1,0.84))}'); image("laptop_lid",A["laptop_lid"],-l["w"]/2,-l["h"]); emit('</Node>')
lap=rect("laptop_screen_glow",l["x"]+8,l["y"]+8,l["w"]-16,l["h"]*0.6,solid("FF9FB8FF"),"screen",0,radius=3); key("Screen Refresh",lap,"opacity",[(0,0.12,"hold"),(80,0.2,"hold"),(84,0.1,"hold"),(None,0.12,"hold")])
# --- deployment door (kit: pivot left edge, scaleX 1→0.08, 650 ms) with shade + corridor reveal ---
l=M["door_leaf"]; hinge=nid(); dsc=mapper("door_sx",0,1,1,0.08); dsh=mapper("door_shade",0,1,0,0.45)
emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]+l["h"]/2:.2f}" name="deployment_door_leaf" id="{hinge}">{bind("doorAmount",16,dsc)}')
rect("door_shade",0,-l["h"]/2,l["w"],l["h"],solid("FF0D0A14"),None,0,extra=bind("doorAmount",18,dsh)); image("door_leaf",A["door_leaf"],0,-l["h"]/2); emit('</Node>')
rv=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" opacity="0" name="door_reveal" id="{rv}">{bind("doorAmount",18,mapper("door_reveal",0,1,0,1))}')
rect("reveal_far",l["w"]*0.5,l["h"]*0.5,l["w"]*0.34,l["h"]*0.4,radial("FFC9BEF2","00C9BEF2",l["w"]*0.3),"screen",1,ox=0.5,oy=0.5)
rect("reveal_floor",0,l["h"]*0.82,l["w"],l["h"]*0.18,linear([("FF2A1856",0),("FF150E2A",1)],0,0,0,l["h"]*0.18)); rect("reveal_wall",0,0,l["w"],l["h"]*0.84,linear([("FF1C1338",0),("FF0D0A14",1)],0,0,0,l["h"]*0.84)); emit('</Node>')
# --- status board: signal pulses, operational glow, display sweep (kit DisplaySweep 0→0.72→0, y 0→169, 1300 ms) ---
bd=FX["board"]
for i,(cx,cy) in enumerate([(657,246),(661,290),(663,322),(663,354),(663,386)]):
    g=ellipse(f"board_signal_{i}",cx,cy,34,30,radial("FF4CF08F","0031E07F",17,15),"screen",0); glows.append((g,0.35,0.85))
    key("Board Pulse",g,"opacity",[(0,0.35,"hold"),(i*22,0.35,"cubic"),(i*22+14,0.95,"cubic"),(i*22+40,0.35,"hold"),(None,0.35,"hold")])
for i,cy in enumerate([290,322,354,386]):
    t=rect(f"board_row_{i+1}_value_glow",790,cy-9,84,18,radial("FF31E07F","0031E07F",42,9),"screen",0,radius=9); glows.append((t,0.15,0.4))
sweep=rect("board_scan_sweep",bd[0]+6,bd[1]+8,bd[2]-12,26,linear([("00FFFFFF",0),("B8FFFFFF",0.5),("00FFFFFF",1)],0,-13,0,13),"screen",0)
key("Display Sweep",sweep,"y",[(0,bd[1]+8,"linear"),(None,bd[1]+8+169,"linear")]); key("Display Sweep",sweep,"opacity",[(0,0,"cubic"),(0.5,0.72,"cubic"),(None,0,"linear")])
bglow=rect("board_backlight",bd[0]-16,bd[1]-16,bd[2]+32,bd[3]+32,radial("66DACFFF","00DACFFF",bd[2]*0.6),"screen",0,radius=20); glows.append((bglow,0.4,0.7))
# --- workstation + desk screens: refresh flashes + code lines on the big code monitor ---
for k in ("screen_code","screen_doc_l","screen_doc_r","screen_wall","screen_desk_l","screen_desk_r"):
    x,y,w,h=FX[k]; sg=rect(f"{k}_refresh",x+4,y+4,w-8,h-8,solid("FFB9C8FF"),"screen",0,radius=3)
    ph=hash(k)%140; key("Screen Refresh",sg,"opacity",[(0,0,"hold"),(ph,0,"hold"),(ph+3,0.35,"hold"),(ph+9,0,"hold"),(None,0,"hold")])
x,y,w,h=FX["screen_code"]
for i in range(6):
    ln=rect(f"code_line_{i}",x+12,y+14+i*11,w*(0.35+0.12*((i*3)%5)),4,solid("FFD9CFFF"),"screen",0,radius=2)
    key("Screen Refresh",ln,"opacity",[(0,0,"hold"),(20+i*14,0,"hold"),(22+i*14,0.7,"hold"),(150,0.7,"hold"),(156,0,"hold"),(None,0,"hold")])
# --- server racks: LED rows pulse 0.62→1 over 4 s in three phase groups (kit ledRows) ---
leds=sorted(FX["rack_leds"],key=lambda t:(t[1],t[0]))[::3][:80]
for i,(cx,cy,w,h) in enumerate(leds):
    c=["FF31E07F","FF5AA8FF","FFE6F0FF"][i%3]; d=ellipse(f"rack_led_{i}",cx,cy,9,9,radial(c,"00"+c[2:],4.5),"screen",0.62)
    key(["LED A","LED B","LED C"][i%3],d,"opacity",[(0,0.62,"cubic"),(0.5,1,"cubic"),(None,0.62,"linear")])
# --- small status lights: printer, radio ---
for k,c in (("printer","FF31E07F"),("radio","FF5AA8FF")):
    x,y,w,h=FX[k]; d=ellipse(f"{k}_led",x+w*0.7,y+h*0.12,8,8,radial(c,"00"+c[2:],4),"screen",0.3); key("Phone Ring",d,"opacity",[(0,0.3,"hold"),(30,1,"hold"),(60,0.3,"hold"),(None,0.3,"hold")])
# --- ceiling light strips + recessed (kit light_intensity) ---
for k in ("strip_left","strip_center","strip_right"):
    x,y,w,h=FX[k]; g=ellipse(f"glow_{k}",x+w/2,y+h/2+6,max(w,80)*1.5,max(h,40)*1.2,radial("FFF6F2FF","00F6F2FF",max(w,80)*0.75),"screen",0); glows.append((g,0.6,0.95))
for k in ("rec_left","rec_center","rec_right"):
    x,y,w,h=FX[k]; g=ellipse(f"glow_{k}",x+w/2,y+h+6,120,60,radial("FFFFF6E8","00FFF6E8",60),"screen",0); glows.append((g,0.55,0.9))
cone=rect("light_cone",836,0,700,520,linear([("55F3EEFF",0),("00F3EEFF",1)],0,0,0,520),"screen",0,ox=0.5,oy=0); glows.append((cone,0.3,0.5))
# window light wash (left windows) + floor shimmer
wash=rect("window_wash",0,380,560,561,linear([("70EDE7FF",0),("00EDE7FF",1)],0,0,560,0),"screen",0); glows.append((wash,0.4,0.7))
sh=rect("floor_shimmer",600,760,220,520,linear([("00FFFFFF",0),("55FFFFFF",0.5),("00FFFFFF",1)],-110,0,110,0),"screen",0,ox=0.5,oy=0.5,rotation=-0.3)
key("Floor Shimmer",sh,"x",[(0,200,"linear"),(None,1500,"linear")]); key("Floor Shimmer",sh,"opacity",[(0,0,"cubic"),(0.5,0.5,"cubic"),(None,0,"linear")])
# --- hotspot hit targets + hover rings (kit hitboxes; hoverTarget 1..6) ---
KX,KY=1672/1648,941/928   # kit hitboxes are in the kit artboard space (1648x928); the plates are source pixels (1672x941)
HOT=[(h,n,[round(b[0]*KX),round(b[1]*KY),round(b[2]*KX),round(b[3]*KY)]) for h,n,b in [("status-board",1,[615,213,420,200]),("helpdesk",2,[568,473,511,142]),("workstations",3,[112,413,280,126]),("infrastructure",4,[1351,258,195,274]),("deployment",5,[1062,282,126,272]),("toolkit",6,[1377,545,160,248])]]
rings={}; hits={}
for hid,n,(x,y,w,h) in HOT:
    rid=nid(); emit(f'<Shape x="{x-4}" y="{y-4}" opacity="0" name="ring_{hid}" id="{rid}"><Rectangle width="{w+8}" height="{h+8}" originX="0" originY="0" cornerRadiusTL="6" cornerRadiusTR="6" cornerRadiusBL="6" cornerRadiusBR="6" name="Path"/><Stroke thickness="6" name="Glow"><SolidColor colorValue="FF31E07F" name="C"/><Feather strength="12" name="F"/></Stroke><Stroke thickness="1.5" name="Crisp"><SolidColor colorValue="FFB9F5D3" name="C"/></Stroke></Shape>')
    rings[hid]=rid; hits[hid]=rect(f"hit_{hid}",x,y,w,h,solid("00FFFFFF"))
    key(f"Hover {n}",rid,"opacity",[(0,0,"cubic"),(12,1,"linear")]); key("Hover 0",rid,"opacity",[(0,0,"hold")])
image("bg_plate",A["bg_plate"],0,0)
emit('</Node>'); emit('</Node>')   # room, camera
for i,(g,lo,hi) in enumerate(glows):
    key("Lights On",g,"opacity",[(0,0,"hold"),(16+i*2,0,"hold"),(18+i*2,hi,"hold"),(24+i*2,lo*0.4,"hold"),(32+i*2,hi,"cubic"),(66+i*2,lo,"cubic"),(None,(lo+hi)/2,"linear")]); key("Lights Breathe",g,"opacity",[(0,lo,"cubic"),(None,hi,"linear")])
# ---------- timelines ----------
DUR={"Sway A":540,"Sway B":540,"Sway C":540,"Lights On":140,"Lights Breathe":330,"Floor Shimmer":1500,"Steam":300,"Motes A":540,"Motes B":690,"Motes C":810,"Phone Ring":720,"Screen Refresh":180,"Board Pulse":240,"LED A":240,"LED B":240,"LED C":240,"Display Sweep":78,"Hover 0":1}
LOOP={k:"loop" for k in DUR}; LOOP.update({"Sway A":"pingPong","Sway B":"pingPong","Sway C":"pingPong","Lights On":"oneShot","Lights Breathe":"pingPong","Display Sweep":"oneShot","Hover 0":"oneShot"})
for n in range(1,7): DUR[f"Hover {n}"]=14; LOOP[f"Hover {n}"]="oneShot"
anim_ids={}; anim_xml=[]
for name,dur in DUR.items():
    aid=nid(); anim_ids[name]=aid; ko=[]
    for obj,prop,frames in anims.get(name,[]):
        kf=[]
        for f,v,interp in frames:
            fr=dur if f is None else (int(round(f*dur)) if isinstance(f,float) and f<1 else int(f)); fr=min(fr,dur)
            kf.append(f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="cubic">{EASE}</KeyFrameDouble>' if interp=="cubic" else f'<KeyFrameDouble value="{v}" frame="{fr}" interpolationType="{interp}"/>')
        ko.append(f'<KeyedObject objectId="{obj}"><KeyedProperty propertyKey="{KEYS[prop]}">{"".join(kf)}</KeyedProperty></KeyedObject>')
    anim_xml.append(f'<LinearAnimation loopValue="{LOOP[name]}" duration="{dur}" fps="{FPS}" name="{name}" id="{aid}">{"".join(ko)}</LinearAnimation>')
# ---------- state machine ----------
def ncond(prop,op,val): return f'<TransitionViewModelCondition opValue="{op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="{val}"/></TransitionViewModelCondition>'
def bcond(prop,val): return f'<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyBoolean><DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="634"/></BindablePropertyBoolean></TransitionPropertyViewModelComparator><TransitionValueBooleanComparator value="{val}"/></TransitionViewModelCondition>'
layers=[]
def simple(name,anim):
    s=nid(); return f'<StateMachineLayer name="{name}" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="420" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{s}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids[anim]}" id="{s}"/></StateMachineLayer>'
for n in ["Sway A","Sway B","Sway C","Floor Shimmer","Steam","Motes A","Motes B","Motes C","Phone Ring","Screen Refresh","Board Pulse","LED A","LED B","LED C"]: layers.append(simple(n,n))
s_on=nid(); s_br=nid()
layers.append(f'<StateMachineLayer name="Lights" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="520" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{s_on}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids["Lights On"]}" id="{s_on}"><StateTransition stateToId="{s_br}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="400"/></AnimationState><AnimationState x="360" y="0" animationId="{anim_ids["Lights Breathe"]}" id="{s_br}"/></StateMachineLayer>')
# hover layer: Hover 0 (idle) ↔ Hover n on hoverTarget
h0=nid(); hs={n:nid() for n in range(1,7)}
tr0="".join(f'<StateTransition stateToId="{hs[n]}" duration="100">{ncond("hoverTarget","equal",n)}</StateTransition>' for n in range(1,7))
hover=f'<StateMachineLayer name="Hover" id="{nid()}"><AnyState x="60" y="-140"/><ExitState x="900" y="-140"/><EntryState x="-60" y="0"><StateTransition stateToId="{h0}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids["Hover 0"]}" id="{h0}">{tr0}</AnimationState>'
for n in range(1,7): hover+=f'<AnimationState x="{160+n*120}" y="160" animationId="{anim_ids[f"Hover {n}"]}" id="{hs[n]}"><StateTransition stateToId="{h0}" duration="180">{ncond("hoverTarget","notEqual",n)}</StateTransition></AnimationState>'
layers.append(hover+'</StateMachineLayer>')
# display sweep: idle → Sweep when refreshDisplay, back at exit time
sw0=nid(); sw1=nid(); idle_anim=anim_ids["Hover 0"]
layers.append(f'<StateMachineLayer name="DisplaySweep" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="520" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{sw0}"/></EntryState><AnimationState x="160" y="0" animationId="{idle_anim}" id="{sw0}"><StateTransition stateToId="{sw1}" duration="0">{bcond("refreshDisplay","true")}</StateTransition></AnimationState><AnimationState x="360" y="0" animationId="{anim_ids["Display Sweep"]}" id="{sw1}"><StateTransition stateToId="{sw0}" duration="0" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/></AnimationState></StateMachineLayer>')
listeners=[]
for hid,n,_ in HOT:
    for ev,val in (("enter",n),("exit",0)):
        listeners.append(f'<StateMachineListenerSingle targetId="{hits[hid]}" listenerTypeValue="{ev}" name="{ev}_{hid}" id="{nid()}"><ListenerViewModelChange><BindablePropertyNumber propertyValue="{val}"><DataBindContext sourcePathIds="{VM}-{props["hoverTarget"]}" propertyKey="636" direction="true"/></BindablePropertyNumber></ListenerViewModelChange></StateMachineListenerSingle>')
vm_props="".join((f'<ViewModelPropertyBoolean name="{n}" id="{i}"/>' if n in bools else f'<ViewModelPropertyNumber name="{n}" id="{i}"/>') for n,i in props.items())
vm_vals="".join((f'<ViewModelInstanceBoolean propertyValue="{"true" if n=="ambientEnabled" else "false"}" viewModelPropertyId="{i}"/>' if n in bools else f'<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{i}"/>') for n,i in props.items())
rml=f'''<Rive version="1" kind="fragment">
    <Artboard defaultStateMachineId="{SM}" styleId="{STYLE}" viewModelId="{VM}" viewModelInstanceId="{VMI}" width="{W}" height="{H}" name="ITServices" id="{AB}">
        <LayoutComponentStyle name="Artboard Style" id="{STYLE}"/>
        <Fill name="Background"><SolidColor colorValue="FFE9E5F3" name="C"/></Fill>
{chr(10).join("        "+l for l in out)}
{chr(10).join("        "+a for a in anim_xml)}
        <StateMachine name="ITServicesMachine" id="{SM}">
{chr(10).join("            "+l for l in listeners)}
{chr(10).join("            "+l for l in layers)}
        </StateMachine>
    </Artboard>
{chr(10).join(assets)}
{chr(10).join(convs)}
    <ViewModel defaultInstanceId="{VMI}" name="ITServices" id="{VM}">{vm_props}<ViewModelInstance exports="true" name="Default" id="{VMI}">{vm_vals}</ViewModelInstance></ViewModel>
</Rive>
'''
OUT.write_text(rml); print("scene.rml:",len(out),"elements,",len(anim_xml),"timelines,",len(layers),"layers,",len(listeners),"listeners")
