import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const require = createRequire(import.meta.url);
const repo = path.resolve(import.meta.dirname, '..');
const kit = '/Users/josephanady/Desktop/ThatDeveloperGuy/TDG_IT_SERVICES_ANIMATION_KIT/rive/production-rive/dist';
const runtime = path.resolve(require.resolve('@rive-app/webgl2'), '..');
const out = path.resolve(repo, 'evidence/rive/it-services/native-overlays');
await mkdir(out, { recursive: true });

const systems = [
  { id: 'display-systems', file: 'tdg-it-services-display-systems.riv', artboard: 'ITServicesDisplaySystems', machine: 'ITServicesDisplaySystemsMachine', focus: 1 },
  { id: 'environment-fx', file: 'tdg-it-services-environment-fx.riv', artboard: 'ITServicesEnvironmentFX', machine: 'ITServicesEnvironmentFXMachine', focus: 2 },
  { id: 'mechanics', file: 'tdg-it-services-mechanics.riv', artboard: 'ITServicesMechanics', machine: 'ITServicesMechanicsMachine', focus: 5 },
  { id: 'rack-systems', file: 'tdg-it-services-rack-systems.riv', artboard: 'ITServicesRackSystems', machine: 'ITServicesRackSystemsMachine', focus: 4 },
];

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://local');
  const system = systems.find(candidate => `/rive/${candidate.file}` === url.pathname);
  const file = url.pathname === '/harness.html'
    ? path.join(repo, 'tools/rive-harness/harness.html')
    : url.pathname === '/runtime/rive.js'
      ? path.join(runtime, 'rive.js')
      : url.pathname === '/runtime/rive.wasm'
        ? path.join(runtime, 'rive.wasm')
        : system
          ? path.join(kit, system.file)
          : null;
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];

try {
  for (const system of systems) {
    const context = await browser.newContext({ viewport: { width: 1648, height: 928 } });
    const page = await context.newPage();
    const consoleMessages = [];
    page.on('console', message => consoleMessages.push(`${message.type()}: ${message.text()}`));
    const query = new URLSearchParams({ src: `/rive/${system.file}`, artboard: system.artboard, sm: system.machine });
    await page.goto(`http://127.0.0.1:${port}/harness.html?${query}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__proof.loaded || window.__proof.error, null, { timeout: 12000 });
    const state = await page.evaluate(() => ({ loaded: window.__proof.loaded, error: window.__proof.error, frames: window.__proof.frames, artboards: window.__proof.artboards, vm: window.__proof.vm() }));
    await page.waitForTimeout(350);
    const idlePath = path.join(out, `${system.id}-idle.png`);
    await page.screenshot({ path: idlePath });
    if (state.loaded) {
      await page.evaluate(focus => {
        window.__proof.setNumber('focusTarget', focus);
        window.__proof.setNumber('selectedTarget', focus);
      }, system.focus);
      await page.waitForTimeout(900);
    }
    const focusedPath = path.join(out, `${system.id}-focused.png`);
    await page.screenshot({ path: focusedPath });
    const idle = PNG.sync.read(await readFile(idlePath));
    const focused = PNG.sync.read(await readFile(focusedPath));
    const changed = pixelmatch(idle.data, focused.data, undefined, idle.width, idle.height, { threshold: .05 });
    results.push({ ...system, ...state, consoleMessages, changedPixels: changed, changedRatio: changed / (idle.width * idle.height) });
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const report = { generatedAt: new Date().toISOString(), runtime: require('@rive-app/webgl2/package.json').version, results };
await writeFile(path.join(out, 'proof.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) console.log(`${result.loaded && !result.error && result.changedPixels > 0 ? 'PASS' : 'FAIL'} ${result.id}: loaded=${result.loaded} error=${result.error ?? 'none'} changed=${result.changedPixels} console=${result.consoleMessages.length}`);
if (results.some(result => !result.loaded || result.error || result.changedPixels === 0)) process.exitCode = 1;
