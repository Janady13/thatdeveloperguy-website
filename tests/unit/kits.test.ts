import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadKits, resolveRoom } from '../../tools/kits.ts';

test('kits config names four rooms on a 1648×928 canvas', () => {
  const kits = loadKits();
  assert.deepEqual(Object.keys(kits.rooms).sort(), ['cybersecurity', 'government-solutions', 'it-services', 'lobby']);
  assert.deepEqual(kits.canvas, { width: 1648, height: 928 });
});

test('resolveRoom returns absolute paths that exist for the lobby', () => {
  const kit = resolveRoom('lobby');
  for (const key of ['svg', 'manifest', 'hotspots', 'reference'] as const) {
    assert.ok(kit[key].startsWith('/'), `${key} must be absolute`);
    assert.ok(existsSync(kit[key]), `${key} missing: ${kit[key]}`);
  }
});
