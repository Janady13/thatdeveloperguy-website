/** Fast, dependency-free repository invariants. Deeper behavior belongs in unit/browser tests. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { PageRecord } from '../src/contracts/page.ts';

const root = resolve(import.meta.dirname, '..');
const failures: string[] = [];
const fail = (message: string) => failures.push(message);
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(path => path && existsSync(join(root, path)));

for (const path of tracked) {
  if (/(__pycache__\/|\.py[co]$|\.DS_Store$)/.test(path)) fail(`generated cache is tracked: ${path}`);
  if (path.startsWith('creative-source/consultant/react-archive/')) fail(`retired runtime archive is tracked: ${path}`);
  if (/^(\.env($|\.)|private\/)|\.(pem|p12|key)$/.test(path)) fail(`credential-shaped file is tracked: ${path}`);
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
for (const [name, version] of Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) fail(`dependency is not exactly pinned: ${name}@${version}`);
}
for (const retired of ['gsap', 'lenis']) if (packageJson.dependencies[retired]) fail(`unused dependency returned: ${retired}`);

for (const path of tracked.filter(path => path.startsWith('src/') && /\.[cm]?[jt]sx?$/.test(path))) {
  const source = readFileSync(join(root, path), 'utf8');
  if (/from\s+['"][^'"]*app\//.test(source)) fail(`src must not depend on app: ${path}`);
}

const publicSourceExtensions = new Set(['.rml', '.rev', '.psd', '.ai', '.blend', '.kra']);
for (const path of tracked.filter(path => path.startsWith('public/'))) {
  if (publicSourceExtensions.has(extname(path).toLowerCase())) fail(`editable source leaked into public/: ${path}`);
}

const layerContract = readFileSync(join(root, 'app/experience/it-services-scene-graph.ts'), 'utf8');
const requiredLayers = [...layerContract.matchAll(/layer\('([^']+)'/g)].map(match => `${match[1]}.svg`).sort();
const sourceLayers = readdirSync(join(root, 'creative-source/runtime/it-services/layers')).filter(file => file.endsWith('.svg')).sort();
for (const missing of requiredLayers.filter(file => !sourceLayers.includes(file))) fail(`IT runtime layer source is missing: ${missing}`);
for (const extra of sourceLayers.filter(file => !requiredLayers.includes(file))) fail(`unused IT runtime layer source: ${extra}`);

const contentRoots = ['pages', 'capabilities'].map(name => join(root, 'content', name));
const pageFiles = contentRoots.flatMap(dir => readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(dir, entry.name, 'page.json'))).filter(existsSync);
const ids = new Set<string>(), paths = new Set<string>();
for (const file of pageFiles) {
  const page = JSON.parse(readFileSync(file, 'utf8')) as PageRecord;
  if (ids.has(page.id)) fail(`duplicate page id: ${page.id}`); else ids.add(page.id);
  if (paths.has(page.path)) fail(`duplicate page path: ${page.path}`); else paths.add(page.path);
  if (page.publicationStatus !== 'draft' && !page.approvalReference.trim()) fail(`releasable page has no approvalReference: ${page.id}`);
  if (page.publicationStatus === 'published' && !page.publishedAt) fail(`published page has no publishedAt: ${page.id}`);
}

if (failures.length) {
  console.error(`Repository audit failed (${failures.length}):\n${failures.map(item => `- ${item}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Repository audit passed: ${tracked.length} tracked files, ${pageFiles.length} page records, ${Object.keys(packageJson.dependencies).length} runtime dependencies.`);
}
