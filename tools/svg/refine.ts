import type { PathNode, SceneDoc, SvgNode } from './model.ts';
import { countRings } from './parse.ts';
import { fitRing, ringArea, unionRings, type Contour } from './geometry.ts';
export { serializeScene, extractPart, listGroupIds } from './serialize.ts';

export interface RefineOptions { minArea: number; tolerance: number; minTurnDeg: number; union: boolean }
/**
 * minArea 1 px²: the traces' 0.6 px dither squares (0.36 px²) go, two-pixel lettering fragments stay.
 * union stays off: the tracer draws lettering and cut-outs as opposite-wound holes, which a union fills in,
 * and measured on the lobby it removed under 4% of vertices anyway.
 */
export const DEFAULT_REFINE: RefineOptions = { minArea: 1, tolerance: 0.75, minTurnDeg: 60, union: false };

export interface RefinedPath { kind: 'path'; id: string; fill: string; contours: Contour[] }
export interface RefinedGroup { kind: 'group'; id: string; label?: string; children: RefinedNode[] }
export type RefinedNode = RefinedPath | RefinedGroup;
export interface RefinedDoc { width: number; height: number; title: string; children: RefinedNode[] }
export interface RefineStats {
  before: { paths: number; rings: number; vertices: number };
  after: { paths: number; contours: number; vertices: number };
  dropped: { rings: number; paths: number };
}

function refinePath(path: PathNode, options: RefineOptions, stats: RefineStats): RefinedPath | null {
  const kept = path.rings.filter(ring => Math.abs(ringArea(ring)) >= options.minArea);
  stats.dropped.rings += path.rings.length - kept.length;
  if (kept.length === 0) { stats.dropped.paths++; return null; }
  const rings = options.union ? unionRings(kept) : kept;
  const contours = rings.map(ring => fitRing(ring, options.tolerance, options.minTurnDeg));
  stats.after.paths++;
  stats.after.contours += contours.length;
  for (const contour of contours) stats.after.vertices += 1 + contour.segments.length;
  return { kind: 'path', id: path.id, fill: path.fill, contours };
}

function refineNodes(nodes: SvgNode[], options: RefineOptions, stats: RefineStats): RefinedNode[] {
  const out: RefinedNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'path') { const refined = refinePath(node, options, stats); if (refined) out.push(refined); continue; }
    const group: RefinedGroup = { kind: 'group', id: node.id, children: refineNodes(node.children, options, stats) };
    if (node.label) group.label = node.label;
    out.push(group); // empty groups stay: the manifest names them and Rive nodes may need them as pivots
  }
  return out;
}

/** Speckle drop → same-paint union → corner-aware cubic fit. Ids, labels, fills and tree order are untouched. */
export function refineScene(doc: SceneDoc, options: RefineOptions = DEFAULT_REFINE): { doc: RefinedDoc; stats: RefineStats } {
  const stats: RefineStats = { before: countRings(doc), after: { paths: 0, contours: 0, vertices: 0 }, dropped: { rings: 0, paths: 0 } };
  const children = refineNodes(doc.children, options, stats);
  return { doc: { width: doc.width, height: doc.height, title: doc.title, children }, stats };
}
