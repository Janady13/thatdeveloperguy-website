/** Bundle the private Fastify service to dist/api/server.mjs (one file, Node 24 target, no credentials inside). */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
mkdirSync(resolve(root, 'dist/api'), { recursive: true });
await build({ entryPoints: [resolve(root, 'server/main.ts')], outfile: resolve(root, 'dist/api/server.mjs'), bundle: true, platform: 'node', target: 'node24', format: 'esm', sourcemap: false, minify: false, legalComments: 'none',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
const bytes = readFileSync(resolve(root, 'dist/api/server.mjs'));
if (/SMTP_PASS\s*=\s*['"][^'"]+/.test(bytes.toString())) throw new Error('a credential-looking string is in the bundle');
writeFileSync(resolve(root, 'dist/api/build-manifest.json'), JSON.stringify({ bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), builtAt: new Date().toISOString() }, null, 2) + '\n');
console.log(`dist/api/server.mjs ${bytes.length} bytes`);
