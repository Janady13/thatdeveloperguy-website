import { DOMParser } from '@xmldom/xmldom';
import type { GroupNode, PathNode, Ring, SceneDoc, SvgNode } from './model.ts';
import { walkPaths } from './model.ts';

const INKSCAPE = 'http://www.inkscape.org/namespaces/inkscape';
const TOKEN = /([MmLlHhVvZzCcSsQqTtAa])|(-?\d*\.?\d+(?:e-?\d+)?)/g;

const CUBIC_STEPS = 8;
function cubicPoints(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): Ring {
  const out: Ring = [];
  for (let i = 1; i <= CUBIC_STEPS; i++) {
    const t = i / CUBIC_STEPS, u = 1 - t;
    out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
  }
  return out;
}

/** Kit path grammar is polygons (M/L/H/V/Z) plus a handful of hand-drawn cubics (C/c), which are flattened to points here and re-fitted later. Anything else is a bug upstream. */
export function parsePathData(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring = [];
  let cmd = ''; let x = 0; let y = 0; let startX = 0; let startY = 0;
  const flush = () => { if (ring.length >= 3) rings.push(ring); ring = []; };
  const tokens = [...d.matchAll(TOKEN)];
  let i = 0;
  const num = () => { const t = tokens[i++]; if (!t || t[2] === undefined) throw new Error(`path data: expected number in "${d.slice(0, 40)}"`); return Number(t[2]); };
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t[1]) {
      cmd = t[1]; i++;
      if (cmd === 'Z' || cmd === 'z') { flush(); x = startX; y = startY; continue; }
      if ('SsQqTtAa'.includes(cmd)) throw new Error(`path data: unsupported command ${cmd}`);
    }
    switch (cmd) {
      case 'M': flush(); x = num(); y = num(); startX = x; startY = y; ring.push([x, y]); cmd = 'L'; break;
      case 'm': flush(); x += num(); y += num(); startX = x; startY = y; ring.push([x, y]); cmd = 'l'; break;
      case 'L': x = num(); y = num(); ring.push([x, y]); break;
      case 'l': x += num(); y += num(); ring.push([x, y]); break;
      case 'H': x = num(); ring.push([x, y]); break;
      case 'h': x += num(); ring.push([x, y]); break;
      case 'V': y = num(); ring.push([x, y]); break;
      case 'v': y += num(); ring.push([x, y]); break;
      case 'C': { const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num(); ring.push(...cubicPoints(x, y, x1, y1, x2, y2, x3, y3)); x = x3; y = y3; break; }
      case 'c': { const x1 = x + num(), y1 = y + num(), x2 = x + num(), y2 = y + num(), x3 = x + num(), y3 = y + num(); ring.push(...cubicPoints(x, y, x1, y1, x2, y2, x3, y3)); x = x3; y = y3; break; }
      default: throw new Error(`path data: unexpected token near "${d.slice(0, 40)}"`);
    }
  }
  flush();
  return rings;
}

function element(node: Element): SvgNode | null {
  if (node.localName === 'g') {
    const children: SvgNode[] = [];
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child && child.nodeType === 1) { const parsed = element(child as unknown as Element); if (parsed) children.push(parsed); }
    }
    const group: GroupNode = { kind: 'group', id: node.getAttribute('id') ?? '', children };
    const label = node.getAttributeNS(INKSCAPE, 'label');
    if (label) group.label = label;
    return group;
  }
  if (node.localName === 'path') {
    const path: PathNode = { kind: 'path', id: node.getAttribute('id') ?? '', fill: (node.getAttribute('fill') ?? '#000000').toLowerCase(), rings: parsePathData(node.getAttribute('d') ?? '') };
    return path;
  }
  if (['image', 'text', 'filter', 'mask', 'use'].includes(node.localName ?? '')) throw new Error(`kit SVG contains <${node.localName}>; the pipeline only accepts groups and polygon paths`);
  return null;
}

export function parseScene(svgText: string): SceneDoc {
  const dom = new DOMParser({ onError: (level, message) => { if (level === 'fatalError') throw new Error(message); } }).parseFromString(svgText, 'image/svg+xml');
  const svg = dom.documentElement!;
  const children: SvgNode[] = [];
  let title = '';
  for (let i = 0; i < svg.childNodes.length; i++) {
    const child = svg.childNodes[i];
    if (!child || child.nodeType !== 1) continue;
    const el = child as unknown as Element;
    if (el.localName === 'title') { title = el.textContent ?? ''; continue; }
    if (el.localName === 'desc') continue;
    const parsed = element(el);
    if (parsed) children.push(parsed);
  }
  return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')), title, children };
}

export function countRings(doc: SceneDoc): { paths: number; rings: number; vertices: number } {
  let paths = 0, rings = 0, vertices = 0;
  for (const path of walkPaths(doc.children)) { paths++; for (const ring of path.rings) { rings++; vertices += ring.length; } }
  return { paths, rings, vertices };
}
