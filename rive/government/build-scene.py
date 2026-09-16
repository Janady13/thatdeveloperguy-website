#!/usr/bin/env python3
"""Government Solutions room → scene.rml, authored to TDG_GOVERNMENT_SOLUTIONS_ANIMATION_KIT (build-spec inputs, hotspots, ambient, motion classes)
on the Adobe-vectorized movers over the clean 4x raster plate (hybrid). Run from rive/government: python3 build-scene.py && rive . --verify"""
import json, os, random
from pathlib import Path
HERE=Path(__file__).parent; OUT=Path(os.environ.get("OUT",str(HERE/"scene.rml"))); MODE=os.environ.get("MODE","embedded")
P=HERE/"../../creative-source/plates/government"; M=json.load(open(P/"2x/manifest.json"))["layers"]; FX=json.load(open(P/"fixtures.json")); VECRML=P/"vec"/"rml"
W,H=1672,941; FPS=60; KX,KY=1672/1648,941/928
ids={"n":0}
def nid(): ids["n"]+=1; return f"0:{ids['n']+100}"
out=[]; assets=[]; anims={}
def emit(s): out.append(s)
def key(anim,obj,prop,frames): anims.setdefault(anim,[]).append((obj,prop,frames))
KEYS={"x":13,"y":14,"rotation":15,"scaleX":16,"scaleY":17,"opacity":18}; EASE='<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
def vec(name,x,y):
    """Adobe-vectorized layer placed with its top-left at (x,y) of the parent (fragment shapes are in artboard space)."""
    i=nid(); frag=json.load(open(VECRML/f"{name}.json")); l=M[name]
    emit(f'<Node x="{x-l["x"]:.2f}" y="{y-l["y"]:.2f}" name="{name}" id="{i}">'+"".join(frag["shapes"])+'</Node>'); return i
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
# ---------- view model: the kit's inputs + host-tweened amounts ----------
VM=nid(); VMI=nid()
bools=["doorOpen","drawer1Open","drawer2Open","drawer3Open","drawer4Open","drawer5Open","chairsNudged","globeTilted","bookLifted","checklistHidden","ambientEnabled","reducedMotion","refreshPresentation"]
nums=["hoverTarget","doorAmount","chairsAmount","globeAmount","bookAmount","checklistAmount","walk"]+[f"drawer{i}Amount" for i in range(1,6)]
props={n:nid() for n in bools+nums}
def bind(prop,k,conv=None):
    c=f' converterId="{conv}"' if conv else ""
    return f'<DataBindContext sourcePathIds="{VM}-{props[prop]}" propertyKey="{k}"{c}/>'
convs=[]
def mapper(name,mi,ma,o0,o1): c=nid(); convs.append(f'    <DataConverterRangeMapper minInput="{mi}" maxInput="{ma}" minOutput="{o0:.3f}" maxOutput="{o1:.3f}" clampLower="true" clampUpper="true" name="{name}" id="{c}"/>'); return c
AB=nid(); SM=nid(); STYLE=nid(); CAMX,CAMY=836,400
walk_s=mapper("walk_scale",0,1,1,1.16); walk_y=mapper("walk_y",0,1,CAMY,CAMY+18)
CAM=nid(); emit(f'<Node x="{CAMX}" y="{CAMY}" name="Camera" id="{CAM}">{bind("walk",16,walk_s)}{bind("walk",17,walk_s)}{bind("walk",14,walk_y)}')
dim=rect("room_dim",-CAMX-40,-CAMY-40,W+80,H+80,solid("FF2A1F4A"),"multiply",0.6)
key("Lights On",dim,"opacity",[(0,0.6,"hold"),(14,0.6,"hold"),(18,0.3,"hold"),(22,0.56,"hold"),(28,0.2,"cubic"),(60,0.4,"cubic"),(104,0,"linear"),(None,0,"hold")]); key("Lights Breathe",dim,"opacity",[(0,0,"hold")])
ROOM=nid(); emit(f'<Node x="{-CAMX}" y="{-CAMY}" name="Room" id="{ROOM}">')
glows=[]
SW=0.0044   # kit ambient: foliage ±0.25°, 9 s
def sway(name,anim,phase):
    l=M[name]; px,py=l["x"]+l["w"]/2,l["y"]+l["h"]; n=nid(); emit(f'<Node x="{px:.2f}" y="{py:.2f}" name="pivot_{name}" id="{n}">'); vec(name,-l["w"]/2,-l["h"]); emit('</Node>')
    if phase==0: key(anim,n,"rotation",[(0,-SW,"cubic"),(None,SW,"linear")])
    elif phase==1: key(anim,n,"rotation",[(0,SW,"cubic"),(None,-SW,"linear")])
    else: key(anim,n,"rotation",[(0,0,"cubic"),(0.5,SW,"cubic"),(None,-SW*0.7,"linear")])
# ===== FRONT: foreground plants, books (bookLifted: covers lift), mug steam, motes =====
sway("plant_fg_left","Sway A",0); sway("plant_fg_right","Sway B",1)
for i,nm in enumerate(["book_1","book_2","book_3","book_4"]):
    l=M[nm]; bn=nid(); lift=mapper(f"book{i}_y",0,1,l["y"],l["y"]-(6+i*2))
    emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="{nm}" id="{bn}">{bind("bookAmount",14,lift)}'); vec(nm,0,0); emit('</Node>')
mug=M["mug"] if "mug" in M else None
mx,my=(1582,560)
for i,(dx,ph) in enumerate([(-10,0),(4,1/3),(16,2/3)]):   # kit: mug_steam_1..3, 5 s
    w=ellipse(f"mug_steam_{i+1}",mx+dx,my,14,34,radial("FFFFFFFF","00FFFFFF",7),"screen",0)
    key("Steam",w,"y",[(0,my+2,"linear"),(None,my-48,"linear")]); key("Steam",w,"x",[(0,mx+dx,"cubic"),(0.5,mx+dx+5,"cubic"),(None,mx+dx-4,"linear")])
    key("Steam",w,"opacity",[(0,0,"cubic"),(0.3,0.5,"cubic"),(None,0,"linear")]); key("Steam",w,"scaleX",[(0,0.6,"linear"),(None,1.5,"linear")])
random.seed(5)
for i in range(12):
    x0=random.uniform(1300,1660); y0=random.uniform(120,520); r=random.uniform(2,4); mote=ellipse(f"mote_{i}",x0,y0,r*2,r*2,radial("FFFFFFFF","00FFFFFF",r),"screen",0)
    an=["Motes A","Motes B","Motes C"][i%3]; dr=random.uniform(-35,-60); sd=random.uniform(-20,20)
    key(an,mote,"y",[(0,y0,"linear"),(None,y0+dr,"linear")]); key(an,mote,"x",[(0,x0,"cubic"),(0.5,x0+sd,"cubic"),(None,x0-sd*0.5,"linear")]); key(an,mote,"opacity",[(0,0,"cubic"),(0.5,random.uniform(0.3,0.6),"cubic"),(None,0,"linear")])
# ===== MID: office chair, conference chairs (chairsNudged), globe (globeTilted), room plants =====
l=M["office_chair"]; oc=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="office_chair" id="{oc}">{bind("chairsAmount",13,mapper("oc_x",0,1,l["x"],l["x"]-3))}'); vec("office_chair",0,0); emit('</Node>')
for nm,dx in [("chair_left_near",-4),("chair_right_near",4),("chair_left_mid",-3),("chair_right_mid",3),("chair_left_far",-2),("chair_right_far",2),("chair_head",0)]:
    l=M[nm]; cn=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="{nm}" id="{cn}">{bind("chairsAmount",13,mapper(f"{nm}_x",0,1,l["x"],l["x"]+dx))}{bind("chairsAmount",14,mapper(f"{nm}_y",0,1,l["y"],l["y"]+2))}'); vec(nm,0,0); emit('</Node>')
l=M["globe"]; gn=nid(); emit(f'<Node x="{l["x"]+l["w"]/2:.2f}" y="{l["y"]+l["h"]*0.92:.2f}" name="globe" id="{gn}">{bind("globeAmount",15,mapper("globe_rot",0,1,0,-0.28))}'); vec("globe",-l["w"]/2,-l["h"]*0.92); emit('</Node>')
key("Globe Idle",gn,"rotation",[(0,-0.01,"cubic"),(None,0.01,"linear")])
sway("plant_window_tall","Sway C",2); sway("plant_window_floor","Sway A",1); sway("plant_office","Sway B",2); sway("plant_printer","Sway C",0); sway("plant_rear_cabinet","Sway A",2); sway("plant_rear_left","Sway B",0); sway("plant_rear_right","Sway C",1)
# ===== WALL: contract drawers (kit: 5 drawer_pull), briefing door (door_hinge, scaleX 1→0.08) + reveal =====
for i in range(1,6):
    l=M[f"drawer_{i}"]; dn=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="contract_drawer_{i}" id="{dn}">{bind(f"drawer{i}Amount",13,mapper(f"drawer{i}_x",0,1,l["x"],l["x"]+16))}{bind(f"drawer{i}Amount",14,mapper(f"drawer{i}_y",0,1,l["y"],l["y"]+6))}'); vec(f"drawer_{i}",0,0); emit('</Node>')
l=M["door_leaf"]; hinge=nid()
emit(f'<Node x="{l["x"]+l["w"]:.2f}" y="{l["y"]+l["h"]/2:.2f}" name="briefing_door_leaf" id="{hinge}">{bind("doorAmount",16,mapper("door_sx",0,1,1,0.08))}')
rect("door_shade",-l["w"],-l["h"]/2,l["w"],l["h"],solid("FF0D0A14"),None,0,extra=bind("doorAmount",18,mapper("door_shade",0,1,0,0.45))); vec("door_leaf",-l["w"],-l["h"]/2); emit('</Node>')
rv=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" opacity="0" name="door_reveal" id="{rv}">{bind("doorAmount",18,mapper("door_reveal",0,1,0,1))}')
rect("reveal_far",l["w"]*0.5,l["h"]*0.5,l["w"]*0.34,l["h"]*0.4,radial("FFC9BEF2","00C9BEF2",l["w"]*0.3),"screen",1,ox=0.5,oy=0.5)
rect("reveal_floor",0,l["h"]*0.82,l["w"],l["h"]*0.18,linear([("FF2A1856",0),("FF150E2A",1)],0,0,0,l["h"]*0.18)); rect("reveal_wall",0,0,l["w"],l["h"]*0.84,linear([("FF1C1338",0),("FF0D0A14",1)],0,0,0,l["h"]*0.84)); emit('</Node>')
# ===== BOARDS: check reveals (checklistHidden), presentation refresh sweep, process column step highlight =====
for pre in ("policy","review"):
    for i in range(1,6):
        x,y,w,h=FX[f"{pre}_row_{i}_check"]; c=ellipse(f"{pre}_check_{i}",x+w/2,y+h/2,w*2.6,h*2.6,radial("FF4CF08F","0031E07F",w*1.3,h*1.3),"screen",0); glows.append((c,0.25,0.7))
        key("Check Pulse",c,"opacity",[(0,0.25,"hold"),(i*16,0.25,"cubic"),(i*16+12,0.9,"cubic"),(i*16+36,0.25,"hold"),(None,0.25,"hold")])
        cover=rect(f"{pre}_check_cover_{i}",x-2,y-2,w+4,h+4,solid("FFF2F0FA"),None,0,radius=3,extra=bind("checklistAmount",18,mapper(f"{pre}{i}_cover",0,1,0,1)))
pd=(714*KX,186*KY,350*KX,210*KY)
sweep=rect("presentation_sweep",pd[0]+6,pd[1]+6,pd[2]-12,30,linear([("00FFFFFF",0),("B0FFFFFF",0.5),("00FFFFFF",1)],0,-15,0,15),"screen",0)
key("Presentation Refresh",sweep,"y",[(0,pd[1]+6,"linear"),(None,pd[1]+pd[3]-30,"linear")]); key("Presentation Refresh",sweep,"opacity",[(0,0,"cubic"),(0.5,0.7,"cubic"),(None,0,"linear")])
pglow=rect("presentation_backlight",pd[0]-18,pd[1]-18,pd[2]+36,pd[3]+36,radial("66DACFFF","00DACFFF",pd[2]*0.6),"screen",0,radius=22); glows.append((pglow,0.4,0.7))
for i,k in enumerate(["process_plan_icon","process_procure_icon","process_implement_icon","process_coordinate_icon","process_deliver_icon"]):
    x,y,w,h=FX[k]; s=ellipse(f"{k}_glow",x+w/2,y+h/2,w*2.2,h*2.2,radial("FFDACFFF","00DACFFF",w*1.1,h*1.1),"screen",0)
    key("Process Steps",s,"opacity",[(0,0,"hold"),(i*60,0,"cubic"),(i*60+14,0.8,"hold"),(i*60+52,0.8,"cubic"),(i*60+66,0,"hold"),(None,0,"hold")])
# ===== SCREENS, PRINTER, TABLE PORTS =====
for k in ("office_monitor_left_screen","office_monitor_right_screen","office_monitor_rear_screen"):
    x,y,w,h=FX[k]; sg=rect(f"{k}_refresh",x+3,y+3,w-6,h-6,solid("FFB9C8FF"),"screen",0,radius=3); ph=hash(k)%150
    key("Screen Refresh",sg,"opacity",[(0,0,"hold"),(ph,0,"hold"),(ph+3,0.35,"hold"),(ph+9,0,"hold"),(None,0,"hold")])
x,y,w,h=FX["printer_indicator"]; pi=ellipse("printer_led",x+w/2,y+h/2,10,10,radial("FF31E07F","0031E07F",5),"screen",0.3); key("Pulse",pi,"opacity",[(0,0.3,"cubic"),(0.5,1,"cubic"),(None,0.3,"linear")])
x,y,w,h=FX["table_connection_ports"]; tp=rect("table_ports_glow",x-4,y-3,w+8,h+6,radial("FF5AA8FF","005AA8FF",w*0.6,6),"screen",0.3,radius=4); key("Pulse",tp,"opacity",[(0,0.25,"cubic"),(0.5,0.8,"cubic"),(None,0.25,"linear")])
# ===== LIGHTS (kit light_intensity: 8 panels + 6 downlights) + sun shaft + wash + shimmer =====
for i in range(1,9):
    x,y,w,h=FX[f"ceiling_panel_{i}"]; g=ellipse(f"glow_panel_{i}",x+w/2,y+h/2+6,max(w,60)*1.4,max(h,30)*1.4,radial("FFF6F2FF","00F6F2FF",max(w,60)*0.7),"screen",0); glows.append((g,0.55,0.9))
for i in range(1,7):
    x,y,w,h=FX[f"ceiling_downlight_{i}"]; g=ellipse(f"glow_downlight_{i}",x+w/2,y+h+6,110,56,radial("FFFFF6E8","00FFF6E8",55),"screen",0); glows.append((g,0.5,0.85))
shaft=rect("sun_shaft",1500,120,380,900,linear([("00FFFFFF",0),("7AF1EDFF",0.5),("00FFFFFF",1)],-190,0,190,0),"screen",0,ox=0.5,oy=0,rotation=0.35); glows.append((shaft,0.3,0.55))
wash=rect("window_wash",1180,430,492,511,linear([("70EDE7FF",0),("00EDE7FF",1)],492,0,0,511),"screen",0); glows.append((wash,0.35,0.65))
sh=rect("floor_shimmer",600,760,220,520,linear([("00FFFFFF",0),("55FFFFFF",0.5),("00FFFFFF",1)],-110,0,110,0),"screen",0,ox=0.5,oy=0.5,rotation=-0.3)
key("Floor Shimmer",sh,"x",[(0,200,"linear"),(None,1500,"linear")]); key("Floor Shimmer",sh,"opacity",[(0,0,"cubic"),(0.5,0.5,"cubic"),(None,0,"linear")])
# ===== WINDOW: clouds drift behind the mullions =====
l=M["clouds"]; cn=nid(); emit(f'<Node x="{l["x"]:.2f}" y="{l["y"]:.2f}" name="window_clouds" id="{cn}">'); vec("clouds",0,0); emit('</Node>')
key("Clouds",cn,"x",[(0,l["x"],"cubic"),(None,l["x"]+16,"linear")])
# ===== HOTSPOTS (kit hitboxes → plate space) with hover rings =====
HOT=[("presentation",1,[714,186,350,210]),("planning",2,[570,191,130,230]),("requirements",3,[1075,191,132,230]),("contracting",4,[329,443,93,166]),("briefing",5,[687,480,392,153]),("process",6,[431,155,78,351]),("return-lobby",7,[196,242,129,397]),("workstations",8,[1357,398,124,129])]
HOT=[(h,n,[round(b[0]*KX),round(b[1]*KY),round(b[2]*KX),round(b[3]*KY)]) for h,n,b in HOT]
rings={}; hits={}
for hid,n,(x,y,w,h) in HOT:
    rid=nid(); emit(f'<Shape x="{x-4}" y="{y-4}" opacity="0" name="ring_{hid}" id="{rid}"><Rectangle width="{w+8}" height="{h+8}" originX="0" originY="0" cornerRadiusTL="6" cornerRadiusTR="6" cornerRadiusBL="6" cornerRadiusBR="6" name="Path"/><Stroke thickness="6" name="Glow"><SolidColor colorValue="FF31E07F" name="C"/><Feather strength="12" name="F"/></Stroke><Stroke thickness="1.5" name="Crisp"><SolidColor colorValue="FFB9F5D3" name="C"/></Stroke></Shape>')
    rings[hid]=rid; hits[hid]=rect(f"hit_{hid}",x,y,w,h,solid("00FFFFFF"))
    key(f"Hover {n}",rid,"opacity",[(0,0,"cubic"),(12,1,"linear")]); key("Hover 0",rid,"opacity",[(0,0,"hold")])
# ===== PLATE =====
BG=nid(); assets.append(f'    <ImageAsset{" file=\"assets/2x/bg_plate.webp\"" if MODE=="embedded" else ""} name="bg_plate" id="{BG}"/>')
emit(f'<Image x="0" y="0" originX="0" originY="0" scaleX="0.5" scaleY="0.5" assetId="{BG}" name="bg_plate" id="{nid()}"/>')
emit('</Node>'); emit('</Node>')
for i,(g,lo,hi) in enumerate(glows):
    key("Lights On",g,"opacity",[(0,0,"hold"),(16+i,0,"hold"),(18+i,hi,"hold"),(24+i,lo*0.4,"hold"),(32+i,hi,"cubic"),(66+i,lo,"cubic"),(None,(lo+hi)/2,"linear")]); key("Lights Breathe",g,"opacity",[(0,lo,"cubic"),(None,hi,"linear")])
# ---------- timelines ----------
DUR={"Sway A":540,"Sway B":540,"Sway C":540,"Lights On":140,"Lights Breathe":330,"Floor Shimmer":1500,"Steam":300,"Motes A":540,"Motes B":690,"Motes C":810,"Screen Refresh":180,"Check Pulse":330,"Pulse":150,"Process Steps":330,"Clouds":2400,"Globe Idle":600,"Presentation Refresh":78,"Hover 0":1}
LOOP={k:"loop" for k in DUR}; LOOP.update({"Sway A":"pingPong","Sway B":"pingPong","Sway C":"pingPong","Lights On":"oneShot","Lights Breathe":"pingPong","Clouds":"pingPong","Globe Idle":"pingPong","Presentation Refresh":"oneShot","Hover 0":"oneShot"})
for n in range(1,9): DUR[f"Hover {n}"]=14; LOOP[f"Hover {n}"]="oneShot"
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
for n in ["Sway A","Sway B","Sway C","Floor Shimmer","Steam","Motes A","Motes B","Motes C","Screen Refresh","Check Pulse","Pulse","Process Steps","Clouds","Globe Idle"]: layers.append(simple(n,n))
s_on=nid(); s_br=nid()
layers.append(f'<StateMachineLayer name="Lights" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="520" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{s_on}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids["Lights On"]}" id="{s_on}"><StateTransition stateToId="{s_br}" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100" duration="400"/></AnimationState><AnimationState x="360" y="0" animationId="{anim_ids["Lights Breathe"]}" id="{s_br}"/></StateMachineLayer>')
h0=nid(); hs={n:nid() for n in range(1,9)}
tr0="".join(f'<StateTransition stateToId="{hs[n]}" duration="100">{ncond("hoverTarget","equal",n)}</StateTransition>' for n in range(1,9))
hover=f'<StateMachineLayer name="Hover" id="{nid()}"><AnyState x="60" y="-140"/><ExitState x="1100" y="-140"/><EntryState x="-60" y="0"><StateTransition stateToId="{h0}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids["Hover 0"]}" id="{h0}">{tr0}</AnimationState>'
for n in range(1,9): hover+=f'<AnimationState x="{160+n*110}" y="160" animationId="{anim_ids[f"Hover {n}"]}" id="{hs[n]}"><StateTransition stateToId="{h0}" duration="180">{ncond("hoverTarget","notEqual",n)}</StateTransition></AnimationState>'
layers.append(hover+'</StateMachineLayer>')
sw0=nid(); sw1=nid()
layers.append(f'<StateMachineLayer name="PresentationRefresh" id="{nid()}"><AnyState x="60" y="-120"/><ExitState x="520" y="-120"/><EntryState x="-60" y="0"><StateTransition stateToId="{sw0}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids["Hover 0"]}" id="{sw0}"><StateTransition stateToId="{sw1}" duration="0">{bcond("refreshPresentation","true")}</StateTransition></AnimationState><AnimationState x="360" y="0" animationId="{anim_ids["Presentation Refresh"]}" id="{sw1}"><StateTransition stateToId="{sw0}" duration="0" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/></AnimationState></StateMachineLayer>')
listeners=[]
for hid,n,_ in HOT:
    for ev,val in (("enter",n),("exit",0)):
        listeners.append(f'<StateMachineListenerSingle targetId="{hits[hid]}" listenerTypeValue="{ev}" name="{ev}_{hid}" id="{nid()}"><ListenerViewModelChange><BindablePropertyNumber propertyValue="{val}"><DataBindContext sourcePathIds="{VM}-{props["hoverTarget"]}" propertyKey="636" direction="true"/></BindablePropertyNumber></ListenerViewModelChange></StateMachineListenerSingle>')
vm_props="".join((f'<ViewModelPropertyBoolean name="{n}" id="{i}"/>' if n in bools else f'<ViewModelPropertyNumber name="{n}" id="{i}"/>') for n,i in props.items())
vm_vals="".join((f'<ViewModelInstanceBoolean propertyValue="{"true" if n=="ambientEnabled" else "false"}" viewModelPropertyId="{i}"/>' if n in bools else f'<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{i}"/>') for n,i in props.items())
rml=f'''<Rive version="1" kind="fragment">
    <Artboard defaultStateMachineId="{SM}" styleId="{STYLE}" viewModelId="{VM}" viewModelInstanceId="{VMI}" width="{W}" height="{H}" name="GovernmentSolutions" id="{AB}">
        <LayoutComponentStyle name="Artboard Style" id="{STYLE}"/>
        <Fill name="Background"><SolidColor colorValue="FFE9E5F3" name="C"/></Fill>
{chr(10).join("        "+l for l in out)}
{chr(10).join("        "+a for a in anim_xml)}
        <StateMachine name="GovernmentSolutionsMachine" id="{SM}">
{chr(10).join("            "+l for l in listeners)}
{chr(10).join("            "+l for l in layers)}
        </StateMachine>
    </Artboard>
{chr(10).join(assets)}
{chr(10).join(convs)}
    <ViewModel defaultInstanceId="{VMI}" name="GovernmentSolutions" id="{VM}">{vm_props}<ViewModelInstance exports="true" name="Default" id="{VMI}">{vm_vals}</ViewModelInstance></ViewModel>
</Rive>
'''
OUT.write_text(rml); print("scene.rml:",len(out),"elements,",len(anim_xml),"timelines,",len(layers),"layers,",len(listeners),"listeners")
