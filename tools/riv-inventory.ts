/** Inventory any .riv with the pinned Canvas runtime (no DOM): artboards, animations, state machines, view models, sha256.  node --import tsx tools/riv-inventory.ts <file.riv> */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
export interface RivInventory { file: string; bytes: number; sha256: string; runtime: string; artboards: Array<{ name: string; width: number; height: number; animations: string[]; stateMachines: string[] }>; viewModels: Array<{ name: string; properties: Array<{ name: string; type: string }> }> }

export async function inventory(path: string): Promise<RivInventory> {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 4).toString() !== 'RIVE') throw new Error(`${path} is not a RIVE file`);
  if (!('document' in globalThis)) Object.assign(globalThis, { window: globalThis, self: globalThis, document: { createElement: () => ({ getContext: () => null, width: 0, height: 0, style: {} }) }, requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16), cancelAnimationFrame: (id: number) => clearTimeout(id) });
  if (!('Image' in globalThis)) {
    Object.assign(globalThis, {
      Image: class {
        width = 1;
        height = 1;
        onload?: () => void;
        set src(_value: string) { setTimeout(() => this.onload?.(), 0); }
      },
    });
  }
  const RiveCanvas = (await import('@rive-app/canvas-advanced')).default as (o: { locateFile: (f: string) => string; wasmBinary?: ArrayBuffer }) => Promise<any>;
  const wasm = readFileSync(require.resolve('@rive-app/canvas-advanced/rive.wasm'));
  const rive = await RiveCanvas({ locateFile: f => f, wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer });
  const file = await rive.load(new Uint8Array(bytes));
  const artboards = [];
  for (let i = 0; i < file.artboardCount(); i++) {
    const ab = file.artboardByIndex(i);
    const animations = []; for (let a = 0; a < ab.animationCount(); a++) animations.push(ab.animationByIndex(a).name as string);
    const stateMachines = []; for (let s = 0; s < ab.stateMachineCount(); s++) stateMachines.push(ab.stateMachineByIndex(s).name as string);
    artboards.push({ name: ab.name as string, width: ab.bounds.maxX - ab.bounds.minX, height: ab.bounds.maxY - ab.bounds.minY, animations, stateMachines });
    ab.delete?.();
  }
  const viewModels = [];
  for (let i = 0; i < file.viewModelCount(); i++) { const vm = file.viewModelByIndex(i); viewModels.push({ name: vm.name as string, properties: vm.getProperties().map((p: any) => ({ name: p.name as string, type: String(p.type) })) }); }
  file.delete?.(); rive.cleanup?.();
  return { file: path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), runtime: `@rive-app/canvas-advanced ${require('@rive-app/canvas-advanced/package.json').version}`, artboards, viewModels };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const target = process.argv[2]; if (!target) throw new Error('usage: riv-inventory <file.riv>');
  console.log(JSON.stringify(await inventory(resolve(target)), null, 2));
}
