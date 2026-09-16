import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScene, parsePathData, countRings } from '../../tools/svg/parse.ts';

const fixture = readFileSync(new URL('../fixtures/mini-scene.svg', import.meta.url), 'utf8');

test('parsePathData handles M/L/H/V/Z absolute and relative, multiple subpaths', () => {
  assert.deepEqual(parsePathData('M0 0H100V50H0Z'), [[[0, 0], [100, 0], [100, 50], [0, 50]]]);
  assert.deepEqual(parsePathData('M15 15h10v10h-10z'), [[[15, 15], [25, 15], [25, 25], [15, 25]]]);
  assert.equal(parsePathData('M10 10L30 10L30 40L10 40ZM12.7 12.7L12.7 13.3L13.3 13.3L13.3 12.7Z').length, 2);
  assert.equal(parsePathData('M0 0C1 1 2 2 3 3L3 0Z')[0]!.length, 1 + 8 + 1); // cubic flattened to 8 points
  assert.throws(() => parsePathData('M0 0Q1 1 2 2Z'), /unsupported/);
});

test('parseScene keeps the group tree, ids, labels and fills', () => {
  const doc = parseScene(fixture);
  assert.equal(doc.width, 100); assert.equal(doc.height, 50); assert.equal(doc.title, 'mini');
  assert.equal(doc.children.length, 2);
  const door = doc.children[1]!;
  assert.equal(door.kind, 'group'); assert.equal(door.id, 'door_it'); assert.equal((door as any).label, '10 — door');
  const leaf = (door as any).children[0];
  assert.equal(leaf.id, 'door_it_leaf');
  assert.equal(leaf.children[0].fill, '#3b2a6e');
  assert.equal(leaf.children[0].rings.length, 2);
  assert.deepEqual(countRings(doc), { paths: 3, rings: 4, vertices: 16 });
});
