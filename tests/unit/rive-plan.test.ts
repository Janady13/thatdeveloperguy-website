import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planLobby } from '../../tools/rive-plan.ts';

const manifest = JSON.parse(readFileSync(new URL('../../creative-source/refined/lobby/manifest.json', import.meta.url), 'utf8'));

test('planLobby derives three doors with hinges, hits and routes from the kit hotspots', () => {
  const plan = planLobby(manifest);
  assert.equal(plan.artboard, 'Lobby');
  assert.deepEqual(plan.doors.map(d => d.id), ['it', 'government', 'cyber']);
  assert.deepEqual(plan.doors[0], { id: 'it', leafId: 'door_it_leaf', hinge: [564, 529], hit: { x: 542, y: 229, width: 176, height: 302 }, href: '/it-services/', label: 'IT SERVICES' });
});

test('planLobby names every animation, view-model property and state-machine layer the site relies on', () => {
  const plan = planLobby(manifest);
  assert.deepEqual(plan.animations.map(a => a.name), ['Ambient', 'DoorOpenIt', 'DoorOpenGovernment', 'DoorOpenCyber', 'FocusIt', 'FocusGovernment', 'FocusCyber']);
  assert.deepEqual(plan.viewModel.properties, [
    { name: 'focus', type: 'enum' }, { name: 'openIt', type: 'trigger' }, { name: 'openGovernment', type: 'trigger' }, { name: 'openCyber', type: 'trigger' }, { name: 'reducedMotion', type: 'boolean' },
  ]);
  assert.deepEqual(plan.layers.map(l => l.name), ['Ambient', 'DoorIt', 'DoorGovernment', 'DoorCyber', 'Focus']);
  const door = plan.layers[1]!;
  assert.deepEqual(door.transitions, [{ from: '{Entry State}', to: 'Closed' }, { from: 'Closed', to: 'Open', when: { property: 'openIt' } }]); // a layer without an Entry transition never enters Closed, so the trigger never fires
  const open = plan.animations.find(a => a.name === 'DoorOpenIt')!;
  assert.equal(open.loop, 'oneShot');
  assert.deepEqual(open.keys[0], { target: 'hinge', door: 'it', property: 'scaleX', frame: 0, value: 100, interpolation: 'cubic' });
  assert.deepEqual(open.keys[1], { target: 'hinge', door: 'it', property: 'scaleX', frame: 26, value: 22, interpolation: 'cubic' });
});
