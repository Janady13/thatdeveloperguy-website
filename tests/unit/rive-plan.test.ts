import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planRoom } from '../../tools/rive-plan.ts';

const lobby = JSON.parse(readFileSync(new URL('../../creative-source/refined/lobby/manifest.json', import.meta.url), 'utf8'));

test('the lobby plan names three doors with hinges at the package pivots and hotspots that carry the site page ids', () => {
  const plan = planRoom(lobby);
  assert.equal(plan.artboard, 'Lobby');
  assert.deepEqual(plan.doors.map(d => [d.id, d.hinge, d.trigger]), [['Door_IT', [562, 301], 'openDoor_IT'], ['Door_Gov', [803, 301], 'openDoor_Gov'], ['Door_Cyber', [1044, 301], 'openDoor_Cyber']]);
  assert.deepEqual(plan.hotspots.map(h => [h.id, h.pageId, h.trigger]), [['door-IT', 'capability.business-it', 'openDoor_IT'], ['door-Gov', 'audience.government', 'openDoor_Gov'], ['door-Cyber', 'capability.cybersecurity', 'openDoor_Cyber'], ['reception', 'contact', null], ['lounge', 'company', null]]);
  assert.deepEqual(plan.enum.values, ['none', 'door-IT', 'door-Gov', 'door-Cyber', 'reception', 'lounge']);
});

test('every door layer enters Closed and opens on its trigger; focus is driven from Any State', () => {
  const plan = planRoom(lobby);
  const door = plan.layers.find(l => l.name === 'Door_Door_IT')!;
  assert.deepEqual(door.transitions, [{ from: '{Entry State}', to: 'Closed' }, { from: 'Closed', to: 'Open', when: { property: 'openDoor_IT' } }]);
  const open = plan.animations.find(a => a.name === 'DoorOpen_Door_IT')!;
  assert.equal(open.loop, 'oneShot');
  assert.deepEqual(open.keys.slice(0, 2).map(k => [k.target, k.property, k.frame, k.value]), [['hinge:Door_IT', 'scaleX', 0, 100], ['hinge:Door_IT', 'scaleX', 26, 22]]);
  const focus = plan.layers.find(l => l.name === 'Focus')!;
  assert.ok(focus.transitions.some(t => t.from === '{Any State}' && t.to === 'Focus_door-Gov' && t.when?.equals === 'door-Gov'));
});
