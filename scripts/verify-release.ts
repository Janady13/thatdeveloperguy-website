import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pages } from '../src/generated/index.ts';
import { llmsDocuments } from '../src/engines/seo/discovery/build-llms.ts';
import { PRODUCTION_ORIGIN } from '../src/engines/seo/urls/production-origin.ts';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'dist/deployment/build-manifest.json');
if (!existsSync(manifestPath)) throw new Error('No release manifest. Run npm run build or npm run build:demo first.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { kind: string; routes: string[]; files: number; checksums: Record<string, string> };
const failures: string[] = [];
const site = resolve(root, 'dist/site');
for (const [relativePath, expected] of Object.entries(manifest.checksums)) {
  const path = resolve(site, relativePath);
  if (!existsSync(path)) { failures.push(`missing ${relativePath}`); continue; }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) failures.push(`checksum mismatch ${relativePath}`);
}
if (Object.keys(manifest.checksums).length !== manifest.files) failures.push(`manifest file count ${manifest.files} does not match checksum count ${Object.keys(manifest.checksums).length}`);

const discovery = llmsDocuments(pages, manifest.kind === 'demo' ? 'demo' : 'production');
const rootDiscovery = discovery[0]!.content;
for (const document of discovery) {
  const relativePath = document.path.replace(/^\/+/, '');
  const path = resolve(site, relativePath);
  if (!existsSync(path)) { failures.push(`missing discovery document ${document.path}`); continue; }
  if (readFileSync(path, 'utf8') !== document.content) failures.push(`stale discovery document ${document.path}`);
  if (document.path !== '/llms.txt') {
    const url = new URL(document.path, PRODUCTION_ORIGIN).href;
    if (!rootDiscovery.includes(`](${url})`)) failures.push(`root discovery index does not join ${document.path}`);
    if (!document.content.includes(`](${PRODUCTION_ORIGIN}/llms.txt)`)) failures.push(`${document.path} does not link back to the root discovery index`);
  }
}
if (failures.length) throw new Error(`Release verification failed:\n${failures.join('\n')}`);
console.log(`Verified ${manifest.files} ${manifest.kind} release files across ${manifest.routes.length} routes and ${discovery.length} discovery documents.`);
