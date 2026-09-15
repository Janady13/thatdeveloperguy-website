import fitCurve from 'fit-curve';
import polygonClipping from 'polygon-clipping';
import type { Point, Ring } from './model.ts';

export type Cubic = { c1: Point; c2: Point; to: Point };
export interface Contour { start: Point; segments: Cubic[] }

export function ringArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!; const [x2, y2] = ring[(i + 1) % ring.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/** Union of rings that share one paint. polygon-clipping returns exteriors and holes with opposite winding, which the nonzero fill rule renders correctly. */
export function unionRings(rings: Ring[]): Ring[] {
  if (rings.length <= 1) return rings;
  const polygons = rings.map(ring => [ring.map(p => [p[0], p[1]] as [number, number])]);
  const result = polygonClipping.union(polygons[0]!, ...polygons.slice(1));
  const out: Ring[] = [];
  for (const polygon of result) for (const ring of polygon) {
    const pts = ring.map(p => [p[0], p[1]] as Point);
    if (pts.length > 1 && pts[0]![0] === pts[pts.length - 1]![0] && pts[0]![1] === pts[pts.length - 1]![1]) pts.pop();
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}

function turn(a: Point, b: Point, c: Point): number {
  const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
  const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
  if (l1 === 0 || l2 === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
  return Math.acos(cos) * 180 / Math.PI;
}

function pointLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  let index = 0, max = 0;
  const a = points[0]!, b = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i++) { const d = pointLineDistance(points[i]!, a, b); if (d > max) { max = d; index = i; } }
  if (max <= epsilon) return [a, b];
  const left = douglasPeucker(points.slice(0, index + 1), epsilon), right = douglasPeucker(points.slice(index), epsilon);
  return left.slice(0, -1).concat(right);
}

/** Douglas-Peucker on a closed ring: split at the two points farthest apart so the pixel staircase collapses to its straight and curved runs. */
export function simplifyRing(ring: Ring, epsilon: number): Ring {
  if (ring.length <= 4) return ring;
  let i0 = 0, i1 = 0, far = -1;
  for (let i = 0; i < ring.length; i++) { const p = ring[i]!, d = Math.hypot(p[0] - ring[0]![0], p[1] - ring[0]![1]); if (d > far) { far = d; i1 = i; } }
  far = -1;
  for (let i = 0; i < ring.length; i++) { const p = ring[i]!, d = Math.hypot(p[0] - ring[i1]![0], p[1] - ring[i1]![1]); if (d > far) { far = d; i0 = i; } }
  if (i0 > i1) [i0, i1] = [i1, i0];
  const first = douglasPeucker(ring.slice(i0, i1 + 1), epsilon);
  const second = douglasPeucker(ring.slice(i1).concat(ring.slice(0, i0 + 1)), epsilon);
  const out = first.slice(0, -1).concat(second.slice(0, -1));
  return out.length >= 3 ? out : ring;
}

/** Indices where the polyline turns more than `minTurnDeg`; those stay sharp through fitting. */
export function cornerIndices(ring: Ring, minTurnDeg: number): number[] {
  const out: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n]!, b = ring[i]!, c = ring[(i + 1) % n]!;
    if (turn(a, b, c) >= minTurnDeg) out.push(i);
  }
  return out;
}

/** fit-curve measures error only at sample points, so a sparse polyline lets a cubic bulge between them. Resample every `step` px first. */
export function densify(points: Point[], step: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!, b = points[i + 1]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  out.push(points[points.length - 1]!);
  return out;
}

function fitOpen(sparse: Point[], tolerance: number): Cubic[] {
  if (sparse.length < 2) return [];
  if (sparse.length === 2) { const [a, b] = sparse as [Point, Point]; return [{ c1: a, c2: b, to: b }]; }
  const points = densify(sparse, 2);
  const curves = fitCurve(points.map(p => [p[0], p[1]]), tolerance);
  return curves.map(c => ({ c1: [c[1]![0]!, c[1]![1]!], c2: [c[2]![0]!, c[2]![1]!], to: [c[3]![0]!, c[3]![1]!] }));
}

/** Schneider fitting per corner-to-corner run. A ring with no corners is fitted as one closed run starting at index 0. */
export function fitRing(source: Ring, tolerance: number, minTurnDeg: number): Contour {
  const ring = simplifyRing(source, tolerance);
  const n = ring.length;
  const corners = cornerIndices(ring, minTurnDeg);
  const anchors = corners.length ? corners : [0];
  const start = ring[anchors[0]!]!;
  const segments: Cubic[] = [];
  for (let k = 0; k < anchors.length; k++) {
    const from = anchors[k]!, to = anchors[(k + 1) % anchors.length]!;
    const run: Point[] = [];
    let i = from;
    do { run.push(ring[i]!); i = (i + 1) % n; } while (i !== to);
    run.push(ring[to]!);
    if (anchors.length === 1) run[run.length - 1] = ring[from]!; // closed run back to its own start
    segments.push(...fitOpen(run, tolerance));
  }
  return { start, segments };
}

export function contourVertexCount(contour: Contour): number { return 1 + contour.segments.length; }
