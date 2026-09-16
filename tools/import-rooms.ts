/**
 * v3 vector package → creative-source/refined/<room>/ (scene.svg = the hand-authored master, poster.svg = the same file, manifest.json).
 * No refinement: these masters are clean vector already. Nothing is unioned, simplified or re-fitted.
 *   npm run rooms [-- --room lobby]
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadKits, repoRoot, resolveRoom, ROOM_IDS, type RoomId } from './kits.ts';

export interface V3Hotspot { id: string; label: string; rect: [number, number, number, number]; pageId: string; section: string }
export interface V3MotionTarget { id: string; kind: 'door' | 'opacity' | 'rotate' | 'translateY' | 'steam' | string; pivotLocal: [number, number]; amount: number; restTransform: string; activeByDefault: boolean }
export interface RoomManifest {
  room: RoomId; canvas: { width: number; height: number }; package: string;
  source: { svg: string; sha256: string; paths: number; bytes: number };
  floorAnchor: [number, number];
  doors: Array<{ id: string; leafId: string; pivot: [number, number]; accessLightId: string | null; hotspotId: string | null }>;
  ambient: Array<{ id: string; kind: string; pivot: [number, number]; amount: number }>;
  hotspots: V3Hotspot[];
  lettering: Array<{ id: string; text: string }>;
}

export function importRoom(room: RoomId): RoomManifest {
  const kits = loadKits();
  const kit = resolveRoom(room, kits);
  const out = resolve(repoRoot, 'creative-source/refined', room); mkdirSync(out, { recursive: true });
  const svg = readFileSync(kit.svg, 'utf8');
  if (/<image|<filter|<text|skew/i.test(svg)) throw new Error(`${room}: master contains unsupported content (image/filter/text/skew)`);
  copyFileSync(kit.svg, join(out, 'scene.svg')); copyFileSync(kit.svg, join(out, 'poster.svg'));
  const manifest = JSON.parse(readFileSync(kit.manifest, 'utf8'));
  const hotspots = JSON.parse(readFileSync(kit.hotspots, 'utf8')) as V3Hotspot[];
  const pivots = Object.fromEntries((JSON.parse(readFileSync(kit.pivots, 'utf8')) as Array<{ id: string; pivotArtboard: [number, number] }>).map(p => [p.id, p.pivotArtboard]));
  const targets = manifest.motionTargets as V3MotionTarget[];
  const doors = targets.filter(t => t.kind === 'door').map(t => {
    const stem = t.id.replace(/_Leaf$/, '');
    const light = targets.find(x => x.id === `${stem}_AccessLight`)?.id ?? null;
    const shortName = stem.split('__')[1] ?? stem; // Door_IT → door-IT hotspot id in the lobby; other rooms map by name below
    const hotspot = hotspots.find(h => h.id.toLowerCase() === shortName.toLowerCase().replace('door_', 'door-')) ?? hotspots.find(h => shortName.toLowerCase().includes(h.id.toLowerCase().replace('-', ''))) ?? null;
    return { id: shortName, leafId: t.id, pivot: pivots[t.id] ?? [0, 0], accessLightId: light, hotspotId: hotspot?.id ?? null };
  });
  const ambient = targets.filter(t => t.kind !== 'door').map(t => ({ id: t.id, kind: t.kind, pivot: pivots[t.id] ?? [0, 0], amount: t.amount }));
  const record: RoomManifest = {
    room, canvas: kits.canvas, package: kits.package,
    source: { svg: kit.svg.replace(kits.root + '/', ''), sha256: createHash('sha256').update(svg).digest('hex'), paths: (svg.match(/<path/g) ?? []).length, bytes: svg.length },
    floorAnchor: manifest.floorAnchor, doors, ambient, hotspots, lettering: (manifest.lettering as Array<{ id: string; text: string }>).map(l => ({ id: l.id, text: l.text })),
  };
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(record, null, 2) + '\n');
  return record;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const rooms = index > 0 ? [process.argv[index + 1] as RoomId] : ROOM_IDS;
  for (const room of rooms) { const m = importRoom(room); console.log(`${room}: ${m.source.paths} paths, ${(m.source.bytes / 1024).toFixed(0)} KB, ${m.doors.length} door(s) ${m.doors.map(d => `${d.id}@${d.pivot.join(',')}${d.hotspotId ? '→' + d.hotspotId : ''}`).join(' ')}, ${m.ambient.length} ambient targets, ${m.hotspots.length} hotspots, floor ${m.floorAnchor.join(',')}`); }
}
