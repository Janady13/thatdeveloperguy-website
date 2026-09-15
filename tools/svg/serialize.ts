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
