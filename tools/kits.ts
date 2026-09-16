import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RoomId = 'lobby' | 'it-services' | 'government-solutions' | 'cybersecurity';
export interface KitEntry { dir: string; svg: string; manifest: string; hotspots: string; reference: string }
export interface KitsConfig { root: string; canvas: { width: number; height: number }; rooms: Record<RoomId, KitEntry> }
export interface RoomKit { room: RoomId; dir: string; svg: string; manifest: string; hotspots: string; reference: string }

export const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export function loadKits(): KitsConfig {
  return JSON.parse(readFileSync(resolve(repoRoot, 'creative-source/kits.config.json'), 'utf8')) as KitsConfig;
}

/** Absolute paths for one room's kit files. The kit directory is read-only input. */
export function resolveRoom(room: RoomId, kits: KitsConfig = loadKits()): RoomKit {
  const entry = kits.rooms[room];
  if (!entry) throw new Error(`Unknown room ${room}`);
  const dir = resolve(kits.root, entry.dir);
  return { room, dir, svg: resolve(dir, entry.svg), manifest: resolve(dir, entry.manifest), hotspots: resolve(dir, entry.hotspots), reference: resolve(dir, entry.reference) };
}
