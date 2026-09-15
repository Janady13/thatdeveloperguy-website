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
  const result = polygonClipping.union(...rings.map(ring => [ring.map(p => [p[0], p[1]] as [number, number])]));
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

function fitOpen(points: Point[], tolerance: number): Cubic[] {
  if (points.length < 2) return [];
  if (points.length === 2) { const [a, b] = points as [Point, Point]; return [{ c1: a, c2: b, to: b }]; }
  const curves = fitCurve(points.map(p => [p[0], p[1]]), tolerance);
  return curves.map(c => ({ c1: [c[1]![0]!, c[1]![1]!], c2: [c[2]![0]!, c[2]![1]!], to: [c[3]![0]!, c[3]![1]!] }));
}

/** Schneider fitting per corner-to-corner run. A ring with no corners is fitted as one closed run starting at index 0. */
export function fitRing(ring: Ring, tolerance: number, minTurnDeg: number): Contour {
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
