import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadKits, resolveRoom, ROOM_IDS } from '../../tools/kits.ts';

test('the kit config points at the v3 vector package: four rooms on a 1648×928 canvas', () => {
  const kits = loadKits();
  assert.deepEqual(Object.keys(kits.rooms).sort(), [...ROOM_IDS].sort());
  assert.deepEqual(kits.canvas, { width: 1648, height: 928 });
  assert.match(kits.package, /v3/);
});

test('every room resolves to files that exist', () => {
  for (const room of ROOM_IDS) {
    const kit = resolveRoom(room);
    for (const key of ['svg', 'manifest', 'hotspots', 'pivots', 'preview'] as const) assert.ok(existsSync(kit[key]), `${room} ${key} missing: ${kit[key]}`);
  }
});
