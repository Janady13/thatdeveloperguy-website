import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveDestination } from '../../app/experience/resolve-destination.ts';

const lobby = JSON.parse(readFileSync(new URL('../../app/experience/scenes/lobby/scene.json', import.meta.url), 'utf8'));

test('lobby hotspots resolve to registry URLs: three doors, reception → contact, lounge → company', () => {
  const hrefs = lobby.hotspots.map((h: any) => resolveDestination(h.target, 'home'));
  assert.deepEqual(hrefs, ['/capabilities/business-it', '/government', '/capabilities/cybersecurity', '/contact', '/company']);
});

test('room hotspots resolve to anchors and contact intents; a draft page resolves to null', () => {
  const it = JSON.parse(readFileSync(new URL('../../app/experience/scenes/it-services/scene.json', import.meta.url), 'utf8'));
  assert.equal(resolveDestination(it.hotspots[0].target, 'capability.business-it'), '#overview');
  assert.equal(resolveDestination({ kind: 'anchor', anchor: 'overview', pageId: 'capability.business-it' }, 'home'), '/capabilities/business-it#overview');
  assert.equal(resolveDestination({ kind: 'page', pageId: 'contact', project: 'itsupport' }, 'capability.business-it'), '/contact?project=itsupport&from=capability.business-it');
  assert.equal(resolveDestination({ kind: 'page', pageId: 'audience.business' }, 'home'), null);
});
