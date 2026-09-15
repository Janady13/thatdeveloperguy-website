import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(import.meta.url);
const reactEntry = require.resolve('@rive-app/react-webgl2');
const runtimeEntry = createRequire(reactEntry).resolve('@rive-app/webgl2');
let dir = dirname(runtimeEntry);
while (!existsSync(join(dir, 'package.json'))) { const parent = dirname(dir); if (parent === dir) throw new Error('runtime package root not found'); dir = parent; }
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
if (pkg.name !== '@rive-app/webgl2') throw new Error('unexpected runtime package');
const out = 'apps/web/public/animation/runtime'; mkdirSync(out, { recursive: true });
copyFileSync(join(dir, 'rive.wasm'), join(out, 'rive.wasm'));
writeFileSync(join(out, 'version.json'), JSON.stringify({ name: pkg.name, version: pkg.version, wasmSHA256: createHash('sha256').update(readFileSync(join(dir, 'rive.wasm'))).digest('hex') }, null, 2));
console.log(`self-hosted Rive WebGL2 runtime ${pkg.version}`);
