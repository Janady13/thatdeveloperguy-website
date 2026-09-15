import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { verifyRiv } from '../../tools/verify-riv.ts';

const manifestUrl = new URL('../../scenes/rive/lobby/rive-manifest.json', import.meta.url);
const exportedBy = existsSync(manifestUrl) ? JSON.parse(readFileSync(manifestUrl, 'utf8')).exportedBy : null;

// The editor MCP's own export omits MCP-created artboards; only a UI export can pass. `npm run rive:verify` reports the raw state.
test('the exported lobby.riv matches its rive-manifest', { skip: exportedBy !== 'editor-ui' ? `lobby.riv exportedBy=${exportedBy}; needs an editor-UI export` : false }, async () => {
  const result = await verifyRiv('lobby');
  assert.equal(result.artboard, 'Lobby');
  for (const name of ['Ambient', 'DoorOpenIt', 'DoorOpenGovernment', 'DoorOpenCyber', 'FocusIt', 'FocusGovernment', 'FocusCyber']) assert.ok(result.animations.includes(name), `missing animation ${name}`);
  assert.equal(result.stateMachines.length, 1);
  for (const name of ['focus', 'openIt', 'openGovernment', 'openCyber', 'reducedMotion']) assert.ok(result.viewModelProperties.includes(name), `missing view-model property ${name}`);
});
