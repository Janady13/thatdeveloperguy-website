import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseScene } from '../../tools/svg/parse.ts';
import { refineScene, serializeScene, extractPart, listGroupIds } from '../../tools/svg/refine.ts';

const doc = parseScene(readFileSync(new URL('../fixtures/mini-scene.svg', import.meta.url), 'utf8'));

test('refineScene drops speckle, keeps ids and fills, reports stats', () => {
  const { doc: refined, stats } = refineScene(doc);
  assert.equal(stats.before.rings, 4);
  assert.equal(stats.dropped.rings, 1);                 // the 0.36 px² speck
  assert.equal(stats.after.paths, 3);
  assert.deepEqual(listGroupIds(refined), ['cleanplates', 'door_it', 'door_it_leaf']);
  const leaf = (refined.children[1] as any).children[0];
  assert.equal(leaf.children[0].id, 'door_it_leaf__p00001');
  assert.equal(leaf.children[0].fill, '#3b2a6e');
  assert.equal(leaf.children[0].contours.length, 1);
});

test('serializeScene writes cubic path data with ids and no raster/filter/text', () => {
  const svg = serializeScene(refineScene(doc).doc);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="100" height="50" viewBox="0 0 100 50">/);
  assert.match(svg, /<g id="door_it_leaf">/);
  assert.match(svg, /<path id="door_it_leaf__p00001" fill="#3b2a6e" d="M10 10C/);
  assert.doesNotMatch(svg, /<image|<filter|<text|inkscape/);
});

test('extractPart keeps only the named group on the same canvas', () => {
  const part = extractPart(refineScene(doc).doc, 'door_it_leaf');
  assert.equal(part.width, 100);
  assert.deepEqual(listGroupIds(part), ['door_it_leaf']);
});

test('the compact poster form renders the same geometry: no ids, relative cubics, same precision', async () => {
  const { serializePoster } = await import('../../tools/svg/serialize.ts');
  const { renderSvg } = await import('../../tools/svg/diff.ts');
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  const refined = refineScene(doc).doc;
  const full = serializeScene(refined), poster = serializePoster(refined, 10);
  assert.doesNotMatch(poster, /id="|inkscape/);
  assert.match(poster, /<path fill="#3b2a6e" d="M10 10c/);
  const a = PNG.sync.read(Buffer.from(renderSvg(full, 400))), b = PNG.sync.read(Buffer.from(renderSvg(poster, 400)));
  assert.equal(pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 }), 0);
});
