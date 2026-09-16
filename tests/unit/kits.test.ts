import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadKits, repoRoot, resolveRoom, ROOM_IDS } from '../../tools/kits.ts';

test('the kit config points at the v3 vector package: four rooms on a 1648×928 canvas', () => {
  const kits = loadKits();
  assert.deepEqual(Object.keys(kits.rooms).sort(), [...ROOM_IDS].sort());
  assert.deepEqual(kits.canvas, { width: 1648, height: 928 });
  assert.match(kits.package, /v3/);
});

test('every tracked refined room has the runtime sources required by staging', () => {
  for (const room of ROOM_IDS) {
    const source = resolve(repoRoot, 'creative-source/refined', room);
    for (const file of ['manifest.json', 'scene.svg', 'poster.svg']) assert.ok(existsSync(resolve(source, file)), `${room} tracked runtime source missing: ${file}`);
  }
});

const externalKitAvailable = existsSync(loadKits().root);
test('every original v3 authoring room resolves when the external kit is available', { skip: !externalKitAvailable ? 'external v3 authoring kit is not present in this checkout' : false }, () => {
  for (const room of ROOM_IDS) {
    const kit = resolveRoom(room);
    for (const key of ['svg', 'manifest', 'hotspots', 'pivots', 'preview'] as const) assert.ok(existsSync(kit[key]), `${room} ${key} missing: ${kit[key]}`);
  }
});
