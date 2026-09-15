import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffAgainstReference, renderSvg } from '../../tools/svg/diff.ts';
import { selectParts } from '../../tools/refine-vectors.ts';

test('renderSvg produces a PNG of the requested width', () => {
  const png = renderSvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><rect width="20" height="10" fill="#fff"/></svg>', 40);
  assert.equal(png[0], 0x89); assert.equal(png[1], 0x50);
});

test('diffAgainstReference reports zero difference for an identical render', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tdg-refine-'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="0 0 20 10"><rect width="20" height="10" fill="#4a2f8a"/></svg>';
  const reference = join(dir, 'ref.png'); writeFileSync(reference, renderSvg(svg, 20));
  const result = diffAgainstReference(svg, reference, join(dir, 'diff.png'));
  assert.equal(result.differentPixels, 0); assert.equal(result.ratio, 0);
  assert.ok(existsSync(join(dir, 'diff.png')));
});

test('selectParts picks door leaves and moving layers from a kit manifest', () => {
  const manifest = { doors: [{ id: 'it', leafId: 'door_it_leaf', pivot: [564, 529] }], layers: [
    { id: 'architecture_back_wall', pivot: [0, 0], motion: 'parallax_small' },
    { id: 'plant_left', pivot: [400, 500], motion: 'sway' },
    { id: 'door_it_frame', pivot: [0, 0], motion: 'static' },
  ] };
  assert.deepEqual(selectParts(manifest as any), [
    { id: 'door_it_leaf', pivot: [564, 529], motion: 'door' },
    { id: 'plant_left', pivot: [400, 500], motion: 'sway' },
  ]);
});
