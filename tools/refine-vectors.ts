import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKits, repoRoot, resolveRoom, type RoomId } from './kits.ts';
import { parseScene } from './svg/parse.ts';
import { DEFAULT_REFINE, extractPart, refineScene, serializeScene, type RefineOptions, type RefineStats } from './svg/refine.ts';
import { diffAgainstReference, type DiffResult } from './svg/diff.ts';

export interface KitManifest { doors?: Array<{ id: string; leafId: string; pivot: [number, number] }>; layers: Array<{ id: string; pivot: [number, number]; motion: string }> }
export interface PartSpec { id: string; pivot: [number, number]; motion: string }
export interface RefinedManifest {
  room: RoomId; canvas: { width: number; height: number };
  source: { svg: string; sha256: string; manifest: string; hotspots: string };
  stats: RefineStats; options: RefineOptions;
  parts: PartSpec[]; hotspots: unknown; diff: DiffResult;
}

const STATIC = new Set(['static', 'parallax_small']);

/** Door leaves first (motion "door"), then every layer the kit marks as moving. */
export function selectParts(manifest: KitManifest): PartSpec[] {
  const parts: PartSpec[] = (manifest.doors ?? []).map(door => ({ id: door.leafId, pivot: door.pivot, motion: 'door' }));
  const seen = new Set(parts.map(p => p.id));
  for (const layer of manifest.layers) if (!STATIC.has(layer.motion) && !seen.has(layer.id)) { parts.push({ id: layer.id, pivot: layer.pivot, motion: layer.motion }); seen.add(layer.id); }
  return parts;
}

export function refineRoom(room: RoomId, options: RefineOptions = DEFAULT_REFINE): RefinedManifest {
  const kits = loadKits();
  const kit = resolveRoom(room, kits);
  const out = resolve(repoRoot, 'creative-source/refined', room);
  mkdirSync(join(out, 'parts'), { recursive: true });
  const svgText = readFileSync(kit.svg, 'utf8');
  const kitManifest = JSON.parse(readFileSync(kit.manifest, 'utf8')) as KitManifest;
  const hotspots = JSON.parse(readFileSync(kit.hotspots, 'utf8')) as unknown;
  const { doc, stats } = refineScene(parseScene(svgText), options);
  const scene = serializeScene(doc);
  writeFileSync(join(out, 'scene.svg'), scene);
  const parts = selectParts(kitManifest).filter(part => { try { extractPart(doc, part.id); return true; } catch { console.warn(`part ${part.id} not in SVG; skipped`); return false; } });
  for (const part of parts) writeFileSync(join(out, 'parts', `${part.id}.svg`), serializeScene(extractPart(doc, part.id)));
  const diff = diffAgainstReference(scene, kit.reference, join(out, 'diff.png'));
  const manifest: RefinedManifest = {
    room, canvas: kits.canvas,
    source: { svg: relative(kits.root, kit.svg), sha256: createHash('sha256').update(svgText).digest('hex'), manifest: relative(kits.root, kit.manifest), hotspots: relative(kits.root, kit.hotspots) },
    stats, options, parts, hotspots, diff,
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const room = (index > 0 ? process.argv[index + 1] : 'lobby') as RoomId;
  const t = Date.now();
  const m = refineRoom(room);
  console.log(`${room}: ${m.stats.before.vertices} → ${m.stats.after.vertices} vertices (${(m.stats.before.vertices / m.stats.after.vertices).toFixed(1)}×), ${m.stats.after.paths} paths, ${m.parts.length} parts, diff ${(m.diff.ratio * 100).toFixed(2)}% of pixels, ${Date.now() - t} ms`);
}
