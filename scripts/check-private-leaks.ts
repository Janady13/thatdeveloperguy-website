/** dist/site must contain only the approved public build. Fails the release on anything private. */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
const site = resolve(import.meta.dirname, '../dist/site');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(site).map(f => relative(site, f));
const banned = files.filter(f => /\.map$|^creative-source\/|^build-inputs\/|^content\/|^records\/|^evidence\/|\.md$|authoring-log|state-machine\.json|rive-manifest|\.env|manifest\.json$|__spa-fallback/.test(f));
if (banned.length) { console.error('private material in dist/site:\n' + banned.join('\n')); process.exit(1); }
console.log(`no private material in ${files.length} public files`);
