#!/usr/bin/env python3
"""Digital Steward hero rig → scene.rml, built to Digital_Steward_Kit_v1.2/docs/NATIVE_RIVE_BUILD.md.
Parts are the AI-upscaled 4x plates (creative-source/steward/plates, alpha restored from the kit masks) as Rive images on the kit's
hierarchy/pivots (rigs/hero.json); the 12 registered faces and the 6 clip props are native vector paths; the 9 gloves are 4x plates.
41 clips from rigs/animation-clips.json become timelines; the state machine exposes a view model:
  gesture (number, 1..N = clip index, host resets to 0), idle (0 Idle / 1 Breathe / 2 Attentive), expression (0..11),
  blink (0 / 1 single / 2 double), lookX/lookY (-1..1), paintedFace (0 vector face, 1 painted visor).
MODE=embedded (assets/2x in the .riv, the lab build) | ref2x | ref4x (contentless images, host assetLoader supplies the set).
Run from rive/steward: python3 build-rig.py && rive . --verify"""
import json, math, os, re, sys
from pathlib import Path
HERE = Path(__file__).parent; ROOT = HERE / "../.."; sys.path.insert(0, str(ROOT.resolve()))
from tools.svg2rml import svg_to_shapes
S = ROOT / "creative-source/steward"; KIT = S / "kit"
MODE = os.environ.get("MODE", "embedded"); IMG_SCALE = {"embedded": 0.5, "ref2x": 0.5, "ref4x": 0.25}[MODE]
OUT = Path(os.environ.get("OUT", str(HERE / "scene.rml")))
PARTS = json.load(open(S / "hero-parts.json"))["parts"]
PLATES = json.load(open(S / "plates/manifest.json"))
CLIPS = json.load(open(KIT / "rigs/animation-clips.json"))["clips"]
LIB = json.load(open(KIT / "rigs/library.json"))
HANDS = {h["id"]: h for h in LIB["hands"]}
W, H = 640, 960; FPS = 60
ids = {"n": 0}
def nid(): ids["n"] += 1; return f"0:{ids['n'] + 100}"
KEYS = {"x": 13, "y": 14, "rotation": 15, "scaleX": 16, "scaleY": 17, "opacity": 18}
EASE = '<CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>'
anims = {}      # name -> [(objId, prop, [(time0..1 | frame, value, interp)])]
def key(anim, obj, prop, frames): anims.setdefault(anim, []).append((obj, prop, frames))
convs = []; assets = []; VM = nid(); VMI = nid(); props = {}; bools = set()
def prop(name, boolean=False):
    if name not in props: props[name] = nid(); (bools.add(name) if boolean else None)
    return props[name]
def bind(name, k, conv=None):
    c = f' converterId="{conv}"' if conv else ""
    return f'<DataBindContext sourcePathIds="{VM}-{prop(name)}" propertyKey="{k}"{c}/>'
def mapper(name, mi, ma, o0, o1):
    c = nid(); convs.append(f'    <DataConverterRangeMapper minInput="{mi}" maxInput="{ma}" minOutput="{o0:.3f}" maxOutput="{o1:.3f}" clampLower="true" clampUpper="true" name="{name}" id="{c}"/>'); return c
def asset(name):
    a = nid(); f = f' file="assets/2x/{name}.webp"' if MODE == "embedded" else ""; assets.append(f'    <ImageAsset{f} name="{name}" id="{a}"/>'); return a
def image(name, x, y, scale=1.0, extra="", opacity=None):
    i = nid(); op = "" if opacity is None else f' opacity="{opacity}"'
    return i, f'<Image x="{x:.2f}" y="{y:.2f}"{op} originX="0" originY="0" scaleX="{IMG_SCALE * scale:.4f}" scaleY="{IMG_SCALE * scale:.4f}" assetId="{asset(name)}" name="{name}" id="{i}">{extra}</Image>'

# ---------- hierarchy ----------
PIVOT = {"root": (336, 885), "body": (336, 492)}
PARENT = {"root": None, "body": "root"}
for p, k in PARTS.items(): PIVOT[p] = tuple(k["pivot"]); PARENT[p] = k["parent"]
prop("paintedFace")   # 0 vector face, 1 painted visor (a number: range mappers bind numbers, not booleans)
PARENT["lanyard"] = "torso"   # kit parents it to the shirt; the shirt never moves alone and z 13 must clear zip_L (11) / jacket_R (12)
children = {}
for n, par in PARENT.items():
    if par: children.setdefault(par, []).append(n)
zof = lambda n: PARTS[n]["z"] if n in PARTS else -1
node_id = {}; art_id = {}
def rel(n): px, py = PIVOT[n]; qx, qy = PIVOT[PARENT[n]] if PARENT[n] else (0, 0); return px - qx, py - qy
extra_front = {}; extra_back = {}   # node name -> xml children placed above (front) / below (back) the part's own art
def part_art(n):
    k = PARTS[n]; o = PLATES[n]["origin"]
    i, xml = image(n, o[0] - k["pivot"][0], o[1] - k["pivot"][1], opacity=0 if n == "visor_painted" else None, extra=bind("paintedFace", 18, mapper("painted", 0, 1, 0, 1)) if n == "visor_painted" else "")
    art_id[n] = i; return xml
def emit_node(n, indent=2):
    i = nid(); node_id[n] = i; x, y = rel(n); pad = "    " * indent
    kids = sorted(children.get(n, []), key=lambda c: -zof(c))   # highest z first = painted on top
    body = [emit_node(c, indent + 1) for c in kids]
    if n in extra_front: body = extra_front[n] + body
    if n in PARTS: body.append(pad + "    " + part_art(n))
    if n in extra_back: body += extra_back[n]
    return f'{pad}<Node x="{x}" y="{y}" name="{n}" id="{i}">\n' + "\n".join(body) + f'\n{pad}</Node>'
children["root"] = ["body", "hips"]   # jacket panels hang over the belt (pixel-identical at rest either way)

# ---------- faces: registered vector SVGs (artboard space) parented to head ----------
EXPR = LIB["faceBank"]["expressions"]
hx, hy = PIVOT["head"]
face_id = {}; eye_nodes = []; pupil_nodes = []
def face_xml(name):
    svg = open(KIT / "faces" / f"{name}.svg").read()
    groups = re.findall(r'<g id="([^"]+)">(.*?)</g>', svg, re.S)
    out = []
    for gid, body in reversed(groups):          # SVG paints last-on-top; RML first-on-top
        if gid in ("eye_L", "eye_R"):
            shapes, _ = svg_to_shapes(body, scale=1, dx=-hx, dy=-hy, name_prefix=f"{name}_{gid}")
            vs = re.findall(r'Vertex x="([-\d.]+)" y="([-\d.]+)"', "".join(shapes)); xs = [float(a) for a, _ in vs]; ys = [float(b) for _, b in vs]
            cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2   # blink scales Y about the eye centre; gaze moves the pupil inside
            pm = re.search(r'<path id="[^"]*pupil"[^>]*/>', body)
            oshapes, _ = svg_to_shapes(body.replace(pm.group(0), "") if pm else body, scale=1, dx=-hx - cx, dy=-hy - cy, name_prefix=f"{name}_{gid}")
            e = nid(); eye_nodes.append(e); pupil_xml = ""
            if pm:
                pshapes, _ = svg_to_shapes(pm.group(0), scale=1, dx=-hx - cx, dy=-hy - cy, name_prefix=f"{name}_{gid}_pupil")
                pu = nid(); pupil_nodes.append(pu)
                pupil_xml = f'<Node x="0" y="0" name="{name}_{gid}_pupil" id="{pu}">{bind("lookX", 13, LOOKX)}{bind("lookY", 14, LOOKY)}{"".join(pshapes)}</Node>'
            out.append(f'<Node x="{cx:.2f}" y="{cy:.2f}" name="{name}_{gid}" id="{e}">{pupil_xml}{"".join(oshapes)}</Node>')
        else:
            shapes, _ = svg_to_shapes(body, scale=1, dx=-hx, dy=-hy, name_prefix=f"{name}_{gid}")
            out.append(f'<Node x="0" y="0" name="{name}_{gid}">{"".join(shapes)}</Node>')
    f = nid(); face_id[name] = f
    return f'<Node x="0" y="0" opacity="{1 if name == "neutral" else 0}" name="face_{name}" id="{f}">{"".join(out)}</Node>'
LOOKX = mapper("lookX", -1, 1, -3.3, 3.3); LOOKY = mapper("lookY", -1, 1, -2.5, 2.5)
faces = [face_xml(n) for n in EXPR]
# the vector faces sit in one group whose opacity the host can bind away (the Face layer keys the children, so the bind lives on the parent)
extra_front["head"] = [f'<Node x="0" y="0" name="faces">{bind("paintedFace", 18, mapper("vector", 0, 1, 1, 0))}{"".join(faces)}</Node>']

# ---------- gloves: beneath the cuff, pivot on the painted hand's pivot, scale 1.68 ----------
GS = 1.68; cx_, cy_ = PIVOT["cuff_L"]; hpx, hpy = PIVOT["hand_L_thumb"]
glove_id = {}; gloves = []
for hid, h in HANDS.items():
    for mir in (False, True):
        if mir and hid != "point": continue          # PointLeft is the one mirrored clip
        piv = h["mirroredPivot"] if mir else h["pivot"]
        gn = nid(); key_ = f"{hid}{'_m' if mir else ''}"; glove_id[key_] = gn
        # image includes a 4 px pad: pivot in image px = piv + 4. The mirrored variant is the same plate under a scaleX=-1 node,
        # so it flips about the painted hand's pivot -- which is where the kit's mirroredPivot lands.
        piv = h["pivot"]; px, py = (piv[0] + 4) * GS, (piv[1] + 4) * GS
        _, img = image(f"glove_{hid}", -px, -py, scale=GS)
        img = img.replace(f'name="glove_{hid}"', f'name="glove_{key_}_img"')
        sx = ' scaleX="-1"' if mir else ""
        gloves.append(f'<Node x="{hpx - cx_}" y="{hpy - cy_}"{sx} opacity="0" name="glove_{key_}" id="{gn}">{img}</Node>')
extra_back["cuff_L"] = gloves

# ---------- props: vector, 0.49 scale, positions per kit §6 ----------
UPRIGHT = {"thumbs_up", "wave", "ok", "peace", "focus"}
prop_id = {}; prop_xml = []
for c in CLIPS:
    if not c.get("prop"): continue
    pos = (34, 198) if c.get("hand") in UPRIGHT else (105, 190)
    shapes, _ = svg_to_shapes(open(KIT / "props" / f"{c['prop']}.svg").read(), scale=0.49, name_prefix=f"prop_{c['prop']}")
    pid = nid(); prop_id[c["id"]] = (pid, pos)
    prop_xml.append(f'<Node x="{pos[0]}" y="{pos[1]}" opacity="0" name="prop_{c["prop"]}_{c["id"]}" id="{pid}">{"".join(shapes)}</Node>')

# ---------- life beyond the kit: LED glow pulses on the cyan accents, a sheen sweep across the visor, a breath ----------
LEDS = [("shoe_R", 390.6, 810.4, 26, 34), ("shoe_R", 363.9, 844.7, 52, 34), ("shoe_L", 265.6, 817.2, 22, 38), ("shoe_L", 268.7, 857.5, 30, 34),
        ("arm_R_fore", 487.0, 515.8, 44, 26), ("arm_L_fore", 122.3, 311.0, 22, 52), ("ear_L", 225.0, 128.0, 24, 46), ("ear_L", 205.1, 181.5, 24, 28),
        ("ear_R", 455.5, 207.0, 16, 34), ("ear_R", 448.1, 234.0, 20, 28), ("crown", 325.0, 67.5, 34, 14)]
glow_ids = []
for i, (part, gx, gy, gw, gh) in enumerate(LEDS):
    px, py = PIVOT[part]; g = nid(); glow_ids.append(g)
    extra_front.setdefault(part, []).append(f'<Shape x="{gx - px:.1f}" y="{gy - py:.1f}" opacity="0.3" blendModeValue="screen" name="glow_{part}_{i}" id="{g}"><Ellipse width="{gw}" height="{gh}" name="E"/><Fill name="F"><RadialGradient startX="0" startY="0" endX="{gw / 2:.1f}" endY="0" name="G"><GradientStop colorValue="FF7FF4FF" position="0"/><GradientStop colorValue="0000E5FF" position="1"/></RadialGradient></Fill></Shape>')
# sheen: a soft white band clipped to the visor screen (kit faceBank.screens.hero), sweeping left→right every ~7 s
screen_d = LIB["faceBank"]["screens"]["hero"]
clip_shapes, _ = svg_to_shapes(f'<path d="{screen_d}" fill="#000000"/>', scale=1, dx=-hx, dy=-hy, name_prefix="visor_clip")
CLIP = nid(); clip_xml = clip_shapes[0].replace('<Shape x="0" y="0" name="visor_clip_1">', f'<Shape x="0" y="0" name="visor_clip" id="{CLIP}">').replace(re.search(r'<Fill name="F">.*?</Fill>', clip_shapes[0]).group(0), "")
SHEEN = nid()
sheen_xml = f'<Node x="-160" y="0" opacity="0" name="sheen" id="{SHEEN}"><Shape x="0" y="-20" rotation="0.35" blendModeValue="screen" name="sheen_band"><Rectangle width="46" height="260" name="R"/><Fill name="F"><LinearGradient startX="-23" startY="0" endX="23" endY="0" name="G"><GradientStop colorValue="00FFFFFF" position="0"/><GradientStop colorValue="66FFFFFF" position="0.5"/><GradientStop colorValue="00FFFFFF" position="1"/></LinearGradient></Fill><ClippingShape sourceId="{CLIP}" name="Clip"/></Shape></Node>'
extra_front["head"] = [sheen_xml, clip_xml] + extra_front["head"]

tree = emit_node("root")
shadow = '<Shape x="325" y="884" name="ground_shadow"><Ellipse width="376" height="28" name="E"/><Fill name="F"><SolidColor colorValue="1F163653" name="C"/></Fill></Shape>'

# ---------- timelines ----------
DUR = {}; LOOP = {}
def clip_frames(c): return max(2, int(round(c["duration"] * FPS)))
GESTURES = []   # clips selectable through `gesture` (1-based)
IDLES = ["Idle", "Breathe", "Attentive"]
for c in CLIPS:
    tr = c["tracks"].get("hero", []); name = c["id"]
    if name in ("Rest", "StepInPlace"): continue
    dur = clip_frames(c); DUR[name] = dur; LOOP[name] = "loop" if c["loop"] else "oneShot"
    if name not in IDLES: GESTURES.append(name)
    for t in tr:
        n = t["node"]; obj = node_id[n]; px, py = rel(n)
        frames = []
        for tt, v in t["keys"]:
            val = math.radians(v) if t["property"] == "rotation" else (px + v if t["property"] == "x" else py + v)
            frames.append((tt, val, "cubic"))
        key(name, obj, t["property"], frames)
    if name in IDLES: continue
    # expression during the clip (the Gesture layer sits after the Face layer, so this wins while the clip plays)
    ex = c.get("expression")
    if ex and ex != "blink" and ex in face_id:
        for n2 in EXPR:
            on = 1 if n2 == ex else 0; off = 1 if n2 == "neutral" else 0   # neutral is the rest face; other layers restore theirs after
            key(name, face_id[n2], "opacity", [(0, off, "linear"), (0.08, on, "linear"), (0.92, on, "linear"), (1.0, off, "linear")])
    # glove swap 0.17..0.82: hide the painted thumbs-up, show the glove beneath the cuff (kit §5)
    hand = c.get("hand")
    if hand and hand != "thumbs_up":
        gk = f"{hand}_m" if c.get("mirrorHand") else hand
        key(name, glove_id[gk], "opacity", [(0, 0, "hold"), (0.17, 1, "hold"), (0.82, 0, "hold")])
        key(name, art_id["hand_L_thumb"], "opacity", [(0, 1, "hold"), (0.17, 0, "hold"), (0.82, 1, "hold")])
    # prop 0.20..0.82, 0.12 fades, 4 px rise at mid clip
    if c.get("prop"):
        pid, pos = prop_id[name]
        key(name, pid, "opacity", [(0.2, 0, "linear"), (0.32, 1, "linear"), (0.70, 1, "linear"), (0.82, 0, "linear")])
        key(name, pid, "y", [(0.2, pos[1] - 2.35, "cubic"), (0.5, pos[1] - 4, "cubic"), (0.82, pos[1] - 2.2, "cubic")])
# blink: kit pulse -- 1 → 0.04 over the closing window, hold, reopen; idle loop blinks at 0.73..0.8 of a 4.8 s cycle
def blink_keys(a, b, d, e): return [(a, 1, "linear"), (b, 0.04, "linear"), (d, 0.04, "linear"), (e, 1, "linear")]
DUR["BlinkIdle"] = 288; LOOP["BlinkIdle"] = "loop"
DUR["Blink"] = clip_frames(next(c for c in CLIPS if c["id"] == "Blink")); DUR["DoubleBlink"] = clip_frames(next(c for c in CLIPS if c["id"] == "DoubleBlink"))
for e in eye_nodes:
    key("BlinkIdle", e, "scaleY", [(0, 1, "linear")] + blink_keys(0.73, 0.75, 0.765, 0.8))
    key("Blink", e, "scaleY", blink_keys(0.08, 0.3, 0.55, 0.9))
    key("DoubleBlink", e, "scaleY", blink_keys(0.08, 0.18, 0.26, 0.4) + blink_keys(0.54, 0.64, 0.73, 0.9))
# face select: one held frame per expression
for n2 in EXPR:
    DUR[f"Face {n2}"] = 1; LOOP[f"Face {n2}"] = "oneShot"
    for n3 in EXPR: key(f"Face {n2}", face_id[n3], "opacity", [(0, 1 if n3 == n2 else 0, "hold")])
DUR["None"] = 1; LOOP["None"] = "oneShot"
# ambient: badge pendulum + tablet screen sheen live on their own layer so they never stop
DUR["Ambient"] = 312; LOOP["Ambient"] = "pingPong"
key("Ambient", node_id["badge"], "rotation", [(0, math.radians(-2.2), "cubic"), (1.0, math.radians(2.2), "cubic")])
key("Ambient", node_id["torso"], "scaleY", [(0, 1.0, "cubic"), (1.0, 1.012, "cubic")])   # breath: chest rises about the torso pivot
DUR["Pulse"] = 200; LOOP["Pulse"] = "pingPong"
for i, g in enumerate(glow_ids):
    ph = (i * 37) % 120
    key("Pulse", g, "opacity", [(0, 0.18, "cubic"), (min(199, 60 + ph), 0.6, "cubic"), (200, 0.22, "cubic")])
DUR["Sheen"] = 420; LOOP["Sheen"] = "loop"
key("Sheen", SHEEN, "x", [(0, -160, "hold"), (330, -160, "linear"), (400, 150, "linear")])
key("Sheen", SHEEN, "opacity", [(0, 0, "hold"), (330, 0, "linear"), (350, 0.7, "linear"), (390, 0.7, "linear"), (400, 0, "linear")])

anim_ids = {}; anim_xml = []
def frame_of(f, dur): return dur if f is None else (int(round(f * dur)) if isinstance(f, float) and f <= 1 else int(f))
for name, dur in DUR.items():
    aid = nid(); anim_ids[name] = aid; ko = {}
    for obj, p, frames in anims.get(name, []):
        kf = []
        for f, v, interp in frames:
            fr = min(frame_of(f, dur), dur)
            kf.append(f'<KeyFrameDouble value="{v:.4f}" frame="{fr}" interpolationType="cubic">{EASE}</KeyFrameDouble>' if interp == "cubic" else f'<KeyFrameDouble value="{v:.4f}" frame="{fr}" interpolationType="{interp}"/>')
        ko.setdefault(obj, []).append(f'<KeyedProperty propertyKey="{KEYS[p]}">{"".join(kf)}</KeyedProperty>')
    anim_xml.append(f'<LinearAnimation loopValue="{LOOP[name]}" duration="{dur}" fps="{FPS}" name="{name}" id="{aid}">' + "".join(f'<KeyedObject objectId="{o}">{"".join(k)}</KeyedObject>' for o, k in ko.items()) + '</LinearAnimation>')

# ---------- state machine ----------
SM = nid(); AB = nid(); STYLE = nid()
def ncond(p, op, val): return f'<TransitionViewModelCondition opValue="{op}"><TransitionPropertyViewModelComparator><BindablePropertyNumber><DataBindContext sourcePathIds="{VM}-{prop(p)}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator><TransitionValueNumberComparator value="{val}"/></TransitionViewModelCondition>'
def layer(name, states, entry, transitions):
    """states: {key: anim}; transitions: [(from, to, xml)]"""
    sid = {k: nid() for k in states}; body = ""
    for i, (k, an) in enumerate(states.items()):
        tr = "".join(x for f, t, x in transitions if f == k for x in [x.replace("TO", sid[t])])
        body += f'<AnimationState x="{160 + (i % 8) * 130}" y="{(i // 8) * 120}" animationId="{anim_ids[an]}" id="{sid[k]}">{tr}</AnimationState>'
    return f'<StateMachineLayer name="{name}" id="{nid()}"><AnyState x="60" y="-140"/><ExitState x="1300" y="-140"/><EntryState x="-60" y="0"><StateTransition stateToId="{sid[entry]}"/></EntryState>{body}</StateMachineLayer>'
layers = []
# Presence: idle number picks the loop
layers.append(layer("Presence", {n: n for n in IDLES}, "Idle",
    [(f, t, f'<StateTransition stateToId="TO" duration="400">{ncond("idle", "equal", IDLES.index(t))}</StateTransition>') for f in IDLES for t in IDLES if f != t]))
layers.append(layer("Ambient", {"Ambient": "Ambient"}, "Ambient", []))
layers.append(layer("Pulse", {"Pulse": "Pulse"}, "Pulse", []))
layers.append(layer("Sheen", {"Sheen": "Sheen"}, "Sheen", []))
layers.append(layer("Face", {n: f"Face {n}" for n in EXPR}, "neutral",
    [(f, t, f'<StateTransition stateToId="TO" duration="120">{ncond("expression", "equal", EXPR.index(t))}</StateTransition>') for f in EXPR for t in EXPR if f != t]))
layers.append(layer("Blink", {"idle": "BlinkIdle", "one": "Blink", "two": "DoubleBlink"}, "idle",
    [("idle", "one", f'<StateTransition stateToId="TO" duration="0">{ncond("blink", "equal", 1)}</StateTransition>'),
     ("idle", "two", f'<StateTransition stateToId="TO" duration="0">{ncond("blink", "equal", 2)}</StateTransition>'),
     ("one", "idle", '<StateTransition stateToId="TO" duration="0" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>'),
     ("two", "idle", '<StateTransition stateToId="TO" duration="0" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>')]))
gest_states = {"None": "None"}; gest_states.update({g: g for g in GESTURES})
gest_tr = [("None", g, f'<StateTransition stateToId="TO" duration="150">{ncond("gesture", "equal", i + 1)}</StateTransition>') for i, g in enumerate(GESTURES)]
gest_tr += [(g, "None", '<StateTransition stateToId="TO" duration="250" enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"/>') for g in GESTURES]
layers.append(layer("Gesture", gest_states, "None", gest_tr))

for n in ("gesture", "idle", "expression", "blink", "lookX", "lookY"): prop(n)
prop("paintedFace")   # 0 vector face, 1 painted visor (a number: range mappers bind numbers, not booleans)
vm_props = "".join((f'<ViewModelPropertyBoolean name="{n}" id="{i}"/>' if n in bools else f'<ViewModelPropertyNumber name="{n}" id="{i}"/>') for n, i in props.items())
vm_vals = "".join((f'<ViewModelInstanceBoolean propertyValue="false" viewModelPropertyId="{i}"/>' if n in bools else f'<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{i}"/>') for n, i in props.items())
BG = '<Fill name="Background"><SolidColor colorValue="FFFFFFFF" name="C"/></Fill>' if os.environ.get("BG") else ""
rml = f'''<Rive version="1" kind="fragment">
    <Artboard defaultStateMachineId="{SM}" styleId="{STYLE}" viewModelId="{VM}" viewModelInstanceId="{VMI}" width="{W}" height="{H}" name="Hero" id="{AB}">
        <LayoutComponentStyle name="Artboard Style" id="{STYLE}"/>{BG}
        {"".join(prop_xml)}
{tree}
        {shadow}
{chr(10).join("        " + a for a in anim_xml)}
        <StateMachine name="HeroMachine" id="{SM}">
{chr(10).join("            " + l for l in layers)}
        </StateMachine>
    </Artboard>
{chr(10).join(assets)}
{chr(10).join(convs)}
    <ViewModel defaultInstanceId="{VMI}" name="Hero" id="{VM}">{vm_props}<ViewModelInstance exports="true" name="Default" id="{VMI}">{vm_vals}</ViewModelInstance></ViewModel>
</Rive>
'''
OUT.write_text(rml)
json.dump({"gestures": {g: i + 1 for i, g in enumerate(GESTURES)}, "idles": IDLES, "expressions": EXPR, "artboard": "Hero", "stateMachine": "HeroMachine"}, open(HERE / "contract.json", "w"), indent=1)
print("scene.rml:", len(rml) // 1024, "KB,", len(anim_xml), "timelines,", len(layers), "layers,", len(GESTURES), "gestures, props", list(props))
