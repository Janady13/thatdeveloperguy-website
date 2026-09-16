import type { Contour } from './geometry.ts';
import type { RefinedDoc, RefinedGroup, RefinedNode } from './refine.ts';

const fmt = (n: number) => { const r = Math.round(n * 10) / 10; return Object.is(r, -0) ? '0' : String(r); };

export function contourToPathData(contour: Contour): string {
  let d = `M${fmt(contour.start[0])} ${fmt(contour.start[1])}`;
  for (const s of contour.segments) d += `C${fmt(s.c1[0])} ${fmt(s.c1[1])} ${fmt(s.c2[0])} ${fmt(s.c2[1])} ${fmt(s.to[0])} ${fmt(s.to[1])}`;
  return d + 'Z';
}

function node(n: RefinedNode): string {
  if (n.kind === 'path') return `<path id="${n.id}" fill="${n.fill}" d="${n.contours.map(contourToPathData).join('')}"/>`;
  return `<g id="${n.id}">${n.children.map(node).join('')}</g>`;
}

/** Plain SVG 1.1, no namespaces beyond svg, no styles, nonzero fill rule (the default). */
export function serializeScene(doc: RefinedDoc): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${doc.title}</title>${doc.children.map(node).join('')}</svg>`;
}

function find(nodes: RefinedNode[], id: string): RefinedGroup | null {
  for (const n of nodes) {
    if (n.kind !== 'group') continue;
    if (n.id === id) return n;
    const inner = find(n.children, id); if (inner) return inner;
  }
  return null;
}

export function extractPart(doc: RefinedDoc, id: string): RefinedDoc {
  const group = find(doc.children, id);
  if (!group) throw new Error(`part ${id} not found`);
  return { width: doc.width, height: doc.height, title: `${doc.title} — ${id}`, children: [group] };
}

export function listGroupIds(doc: RefinedDoc): string[] {
  const out: string[] = [];
  const walk = (nodes: RefinedNode[]) => { for (const n of nodes) if (n.kind === 'group') { out.push(n.id); walk(n.children); } };
  walk(doc.children);
  return out;
}

/**
 * Public poster form of the same geometry: whole-pixel coordinates, relative cubic commands, no ids, no labels.
 * The editable rig source (scene.svg at 0.1 px) is untouched; this only changes how the bytes are written.
 */
export function serializePoster(doc: RefinedDoc, precision = 1): string {
  const r = (n: number) => Math.round(n * precision) / precision;
  const num = (n: number) => { const v = Math.round(n * precision) / precision; return Object.is(v, -0) ? '0' : String(v); };
  const path = (contours: Contour[]) => contours.map(contour => {
    let x = r(contour.start[0]), y = r(contour.start[1]);
    let d = `M${num(x)} ${num(y)}`;
    for (const s of contour.segments) {
      const c1x = r(s.c1[0]) - x, c1y = r(s.c1[1]) - y, c2x = r(s.c2[0]) - x, c2y = r(s.c2[1]) - y, tx = r(s.to[0]) - x, ty = r(s.to[1]) - y;
      d += `c${num(c1x)} ${num(c1y)} ${num(c2x)} ${num(c2y)} ${num(tx)} ${num(ty)}`;
      x += tx; y += ty;
    }
    return d + 'z';
  }).join('');
  const node = (n: RefinedNode): string => n.kind === 'path' ? `<path fill="${n.fill}" d="${path(n.contours)}"/>` : `<g>${n.children.map(node).join('')}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${doc.title}</title>${doc.children.map(node).join('')}</svg>`;
}
