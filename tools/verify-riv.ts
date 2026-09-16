import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot, type RoomId } from './kits.ts';

const require = createRequire(import.meta.url);

/** Loads the runtime file with the low-level Canvas WASM in Node (no DOM) and reads back what the editor exported. */
export async function verifyRiv(room: RoomId) {
  const dir = resolve(repoRoot, 'creative-source/rive', room);
  const manifest = JSON.parse(readFileSync(resolve(dir, 'rive-manifest.json'), 'utf8'));
  const bytes = readFileSync(resolve(dir, manifest.file));
  if (bytes.subarray(0, 4).toString() !== 'RIVE') throw new Error('not a RIVE file');
  // The runtime probes a canvas at module load; verification never draws, so a context-less canvas satisfies it.
  if (!('document' in globalThis)) Object.assign(globalThis, { window: globalThis, self: globalThis, document: { createElement: () => ({ getContext: () => null, width: 0, height: 0, style: {} }) }, requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16), cancelAnimationFrame: (id: number) => clearTimeout(id) });
  const RiveCanvas = (await import('@rive-app/canvas-advanced')).default as (options: { locateFile: (file: string) => string; wasmBinary?: ArrayBuffer }) => Promise<any>;
  // Node's fetch cannot read a path, so hand the runtime its own rive.wasm bytes directly.
  const wasm = readFileSync(require.resolve('@rive-app/canvas-advanced/rive.wasm'));
  const rive = await RiveCanvas({ locateFile: file => file, wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer });
  const file = await rive.load(new Uint8Array(bytes));
  const artboard = file.artboardByName(manifest.artboard);
  if (!artboard) throw new Error(`artboard ${manifest.artboard} not in ${manifest.file}`);
  const animations: string[] = []; for (let i = 0; i < artboard.animationCount(); i++) animations.push(artboard.animationByIndex(i).name);
  const stateMachines: string[] = []; for (let i = 0; i < artboard.stateMachineCount(); i++) stateMachines.push(artboard.stateMachineByIndex(i).name);
  const viewModel = file.viewModelByName(manifest.viewModel);
  const viewModelProperties: string[] = viewModel ? viewModel.getProperties().map((p: any) => p.name) : [];
  for (const name of manifest.animations) if (!animations.includes(name)) throw new Error(`animation ${name} missing; file has ${animations.join(', ')}`);
  if (!stateMachines.includes(manifest.stateMachine)) throw new Error(`state machine ${manifest.stateMachine} missing; file has ${stateMachines.join(', ')}`);
  for (const name of Object.keys(manifest.inputs)) if (!viewModelProperties.includes(name)) throw new Error(`view-model property ${name} missing; file has ${viewModelProperties.join(', ')}`);
  artboard.delete?.(); file.delete?.(); rive.cleanup?.();
  return { ok: true as const, artboard: manifest.artboard, animations, stateMachines, viewModelProperties, bytes: bytes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const index = process.argv.indexOf('--room');
  const result = await verifyRiv((index > 0 ? process.argv[index + 1] : 'lobby') as RoomId);
  console.log(JSON.stringify(result, null, 2));
}
