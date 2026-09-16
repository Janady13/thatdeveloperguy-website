import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'dist/deployment/build-manifest.json');
if (!existsSync(manifestPath)) throw new Error('No release manifest. Run npm run build or npm run build:demo first.');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { kind: string; routes: string[]; files: number; checksums: Record<string, string> };
const failures: string[] = [];
for (const [relativePath, expected] of Object.entries(manifest.checksums)) {
  const path = resolve(root, 'dist/site', relativePath);
  if (!existsSync(path)) { failures.push(`missing ${relativePath}`); continue; }
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) failures.push(`checksum mismatch ${relativePath}`);
}
if (Object.keys(manifest.checksums).length !== manifest.files) failures.push(`manifest file count ${manifest.files} does not match checksum count ${Object.keys(manifest.checksums).length}`);
if (failures.length) throw new Error(`Release verification failed:\n${failures.join('\n')}`);
console.log(`Verified ${manifest.files} ${manifest.kind} release files across ${manifest.routes.length} routes.`);
