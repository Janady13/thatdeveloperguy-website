import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringArea, unionRings, cornerIndices, fitRing, contourVertexCount } from '../../tools/svg/geometry.ts';
import type { Ring } from '../../tools/svg/model.ts';

const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10]];

test('ringArea is signed and sized', () => {
  assert.equal(Math.abs(ringArea(square)), 100);
  assert.ok(Math.abs(Math.abs(ringArea([[0, 0], [0.6, 0], [0.6, 0.6], [0, 0.6]])) - 0.36) < 1e-9);
});

test('unionRings merges touching rectangles into one ring', () => {
  const merged = unionRings([square, [[10, 0], [20, 0], [20, 10], [10, 10]]]);
  assert.equal(merged.length, 1);
  assert.equal(Math.abs(ringArea(merged[0]!)), 200);
});

test('cornerIndices finds the four corners of a square and none on a dense circle', () => {
  assert.deepEqual(cornerIndices(square, 60), [0, 1, 2, 3]);
  const circle: Ring = Array.from({ length: 180 }, (_, i) => [50 + 40 * Math.cos(i * Math.PI / 90), 50 + 40 * Math.sin(i * Math.PI / 90)]);
  assert.deepEqual(cornerIndices(circle, 60), []);
});

test('fitRing keeps square corners exactly and fits a 180-point circle in few cubics', () => {
  const sq = fitRing(square, 0.75, 60);
  assert.deepEqual(sq.start, [0, 0]);
  assert.equal(sq.segments.length, 4);
  const circle: Ring = Array.from({ length: 180 }, (_, i) => [50 + 40 * Math.cos(i * Math.PI / 90), 50 + 40 * Math.sin(i * Math.PI / 90)]);
  const fitted = fitRing(circle, 0.75, 60);
  assert.ok(contourVertexCount(fitted) <= 12, `expected ≤ 12 vertices, got ${contourVertexCount(fitted)}`);
  for (const seg of fitted.segments) {
    const r = Math.hypot(seg.to[0] - 50, seg.to[1] - 50);
    assert.ok(Math.abs(r - 40) < 0.8, `endpoint drifted off the circle: ${r}`);
  }
});
