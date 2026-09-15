import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hotspotsFromManifest } from '../../apps/web/src/rooms/lobby/hotspots.ts';

test('lobby hotspots come from the rive manifest doors, with focus values and triggers', () => {
  const list = hotspotsFromManifest({ doors: [{ id: 'it', leafId: 'door_it_leaf', hinge: [564, 529], hit: { x: 542, y: 229, width: 176, height: 302 }, href: '/it-services/', label: 'IT SERVICES' }] } as any);
  assert.deepEqual(list, [{ id: 'it', label: 'IT SERVICES', href: '/it-services/', hit: { x: 542, y: 229, width: 176, height: 302 }, focusValue: 'it', trigger: 'openIt' }]);
});
