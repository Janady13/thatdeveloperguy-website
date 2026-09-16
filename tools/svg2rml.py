#!/usr/bin/env python3
"""Adobe Illustrator image-trace SVG -> RML shapes (native Rive paths; the CLI cannot import SVG).

Handles the trace's dialect exactly: absolute M/C/Z only, no transforms/clips/strokes, fills as rgb()/url(#gradient),
linear/radial gradients in userSpaceOnUse. Output: a list of <Shape> strings, FRONT-MOST FIRST (RML paint order is the
reverse of SVG document order), with vertices in artboard space after (scale, dx, dy). Verify with rive . --verify / inspect.

    from tools.svg2rml import svg_to_shapes
    shapes, stats = svg_to_shapes(svg_text, scale=0.25, dx=100, dy=50, nid=idgen, name_prefix="door")
"""
import math, re

_num = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"


def _rgb(text):
    m = re.search(r"rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)", text)
    if m:
        return tuple(int(v) for v in m.groups())
    m = re.search(r"#([0-9a-fA-F]{6})", text)
    if m:
        h = m.group(1)
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return None


def _argb(rgb, alpha=1.0):
    return "%02X%02X%02X%02X" % (round(alpha * 255), rgb[0], rgb[1], rgb[2])


def parse_gradients(svg):
    grads = {}
    for kind, attrs, body in re.findall(r"<(linear|radial)Gradient([^>]*)>(.*?)</\1Gradient>", svg, re.S):
        a = dict(re.findall(r'([\w:-]+)="([^"]*)"', attrs))
        stops = []
        for s_attrs in re.findall(r"<stop([^>]*)/?>", body):
            sa = dict(re.findall(r'([\w:-]+)="([^"]*)"', s_attrs))
            off = sa.get("offset", "0").strip()
            pos = float(off[:-1]) / 100 if off.endswith("%") else float(off)
            style = sa.get("style", "")
            col = _rgb(style) or _rgb(sa.get("stop-color", "")) or (0, 0, 0)
            om = re.search(r"stop-opacity:\s*([\d.]+)", style)
            op = float(om.group(1)) if om else float(sa.get("stop-opacity", 1))
            stops.append((pos, col, op))
        grads[a["id"]] = dict(kind=kind, attrs=a, stops=stops)
    return grads


def _subpaths(d):
    """Split an M/C/Z path into contours: list of (points, controls) where controls[i] = (c1, c2) for segment i->i+1."""
    tokens = re.findall(r"[MCZmcz]|" + _num, d)
    contours = []
    i = 0
    cur = None
    pts, ctrls = [], []
    while i < len(tokens):
        t = tokens[i]
        if t in "Mm":
            if pts:
                contours.append((pts, ctrls, False))
            x, y = float(tokens[i + 1]), float(tokens[i + 2])
            cur = (x, y); pts, ctrls = [cur], []; i += 3
        elif t in "Cc":
            i += 1
            while i + 5 < len(tokens) + 0 and i + 5 <= len(tokens) - 1 and re.match(_num, tokens[i]):
                c1 = (float(tokens[i]), float(tokens[i + 1])); c2 = (float(tokens[i + 2]), float(tokens[i + 3])); p = (float(tokens[i + 4]), float(tokens[i + 5]))
                ctrls.append((c1, c2)); pts.append(p); cur = p; i += 6
        elif t in "Zz":
            if pts:
                # closing segment: if the last point duplicates the first, drop it and keep its incoming controls for the wrap
                if len(pts) > 1 and abs(pts[-1][0] - pts[0][0]) < 1e-6 and abs(pts[-1][1] - pts[0][1]) < 1e-6:
                    pts.pop()
                else:
                    ctrls.append((pts[-1], pts[0]))  # straight close
                contours.append((pts, ctrls, True))
            pts, ctrls = [], []; i += 1
        else:
            i += 1
    if pts:
        contours.append((pts, ctrls, False))
    return contours


def _vertex(prev_c2, p, next_c1, T):
    x, y = T(*p)
    ins = T(*prev_c2) if prev_c2 else (x, y)
    outs = T(*next_c1) if next_c1 else (x, y)
    din = math.hypot(ins[0] - x, ins[1] - y); dout = math.hypot(outs[0] - x, outs[1] - y)
    if din < 0.05 and dout < 0.05:
        return f'<StraightVertex x="{x:.2f}" y="{y:.2f}"/>'
    rin = math.atan2(ins[1] - y, ins[0] - x); rout = math.atan2(outs[1] - y, outs[0] - x)
    return f'<CubicDetachedVertex x="{x:.2f}" y="{y:.2f}" inRotation="{rin:.4f}" inDistance="{din:.2f}" outRotation="{rout:.4f}" outDistance="{dout:.2f}"/>'


def svg_to_shapes(svg, scale=1.0, dx=0.0, dy=0.0, nid=None, name_prefix="p", drop_fill=None, drop_tolerance=90, min_area=0.0):
    """Returns (shapes_front_to_back, stats). drop_fill=(r,g,b) removes chroma-key paths (Manhattan distance < drop_tolerance)."""
    grads = parse_gradients(svg)
    T = lambda x, y: (x * scale + dx, y * scale + dy)
    shapes = []
    stats = dict(paths=0, dropped=0, vertices=0, gradients=0)
    for attrs in re.findall(r"<path([^>]*)/?>", svg):
        a = dict(re.findall(r'([\w:-]+)="([^"]*)"', attrs))
        d = a.get("d"); fill = a.get("fill", "#000000")
        if not d or fill == "none":
            continue
        op = float(a.get("opacity", a.get("fill-opacity", 1)))
        solid = _rgb(fill) if not fill.startswith("url(") else None
        if drop_fill and solid and sum(abs(solid[i] - drop_fill[i]) for i in range(3)) < drop_tolerance:
            stats["dropped"] += 1; continue
        paths_xml = []
        for pts, ctrls, closed in _subpaths(d):
            if len(pts) < 2:
                continue
            n = len(pts)
            vs = []
            for i, p in enumerate(pts):
                prev_c2 = ctrls[i - 1][1] if (i > 0 and i - 1 < len(ctrls)) else (ctrls[-1][1] if (closed and len(ctrls) == n) else None)
                next_c1 = ctrls[i][0] if i < len(ctrls) else None
                vs.append(_vertex(prev_c2, p, next_c1, T))
            stats["vertices"] += len(vs)
            paths_xml.append(f'<PointsPath isClosed="{"true" if closed else "false"}" name="P">{"".join(vs)}</PointsPath>')
        if not paths_xml:
            continue
        if min_area > 0:   # drop trace shards: bbox (artboard px) below the floor
            xs = [float(v) for v in re.findall(r' x="([-\d.]+)"', "".join(paths_xml))]; ys = [float(v) for v in re.findall(r' y="([-\d.]+)"', "".join(paths_xml))]
            if xs and (max(xs) - min(xs)) * (max(ys) - min(ys)) < min_area:
                stats["dropped"] += 1; continue
        if solid:
            paint = f'<Fill name="F"><SolidColor colorValue="{_argb(solid, op)}" name="C"/></Fill>'
        else:
            gid = re.search(r"url\(#([^)]+)\)", fill).group(1); g = grads.get(gid)
            if not g:
                continue
            stats["gradients"] += 1
            ga = g["attrs"]
            stops = "".join(f'<GradientStop colorValue="{_argb(c, o * op)}" position="{pos:.3f}"/>' for pos, c, o in g["stops"])
            if g["kind"] == "linear":
                x1, y1 = T(float(ga.get("x1", 0)), float(ga.get("y1", 0))); x2, y2 = T(float(ga.get("x2", 0)), float(ga.get("y2", 0)))
                paint = f'<Fill name="F"><LinearGradient startX="{x1:.2f}" startY="{y1:.2f}" endX="{x2:.2f}" endY="{y2:.2f}" name="G">{stops}</LinearGradient></Fill>'
            else:
                cx, cy = T(float(ga.get("cx", 0)), float(ga.get("cy", 0))); r = float(ga.get("r", 1)) * scale
                paint = f'<Fill name="F"><RadialGradient startX="{cx:.2f}" startY="{cy:.2f}" endX="{cx + r:.2f}" endY="{cy:.2f}" name="G">{stops}</RadialGradient></Fill>'
        stats["paths"] += 1
        sid = nid() if nid else ""
        idattr = f' id="{sid}"' if sid else ""
        shapes.append(f'<Shape x="0" y="0" name="{name_prefix}_{stats["paths"]}"{idattr}>{"".join(paths_xml)}{paint}</Shape>')
    shapes.reverse()  # SVG paints last-on-top; RML paints first-on-top
    return shapes, stats


if __name__ == "__main__":
    import sys, json
    svg = open(sys.argv[1]).read()
    shapes, stats = svg_to_shapes(svg)
    print(json.dumps(stats))
