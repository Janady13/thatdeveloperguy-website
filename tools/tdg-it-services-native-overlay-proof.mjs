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
const runtime = path.resolve(require.resolve('@rive-app/webgl2'), '..');
const riveFile = path.join(repo, 'rive/it-services-overlay/build/tsc_it_services_overlay.riv');
const out = path.join(repo, 'evidence/rive/it-services/scriptless-overlay');
const timelines = ['FocusStatus', 'FocusHelpdesk', 'FocusWorkstations', 'FocusRacks', 'FocusDeployment', 'FocusToolcart'];
await mkdir(out, { recursive: true });

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://local');
  const file = url.pathname === '/harness.html'
    ? path.join(repo, 'tools/rive-harness/harness.html')
    : url.pathname === '/runtime/rive.js'
      ? path.join(runtime, 'rive.js')
      : url.pathname === '/runtime/rive.wasm'
        ? path.join(runtime, 'rive.wasm')
        : url.pathname === '/overlay.riv'
          ? riveFile
          : null;
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' });
  createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

async function changedPixels(beforePath, afterPath) {
  const before = PNG.sync.read(await readFile(beforePath));
  const after = PNG.sync.read(await readFile(afterPath));
  return pixelmatch(before.data, after.data, undefined, before.width, before.height, { threshold: .03 });
}

const results = [];
try {
  const context = await browser.newContext({ viewport: { width: 1648, height: 928 } });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`); });
  const query = new URLSearchParams({ src: '/overlay.riv', artboard: 'ITServicesOverlay', sm: 'ITServicesOverlayMachine' });
  await page.goto(`http://127.0.0.1:${port}/harness.html?${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__proof.loaded || window.__proof.error, null, { timeout: 12000 });
  const structure = await page.evaluate(() => ({ loaded: window.__proof.loaded, error: window.__proof.error, artboards: window.__proof.artboards }));
  await page.waitForTimeout(100);
  const ambientA = path.join(out, 'ambient-a.png');
  await page.screenshot({ path: ambientA });
  await page.waitForTimeout(1250);
  const ambientB = path.join(out, 'ambient-b.png');
  await page.screenshot({ path: ambientB });
  results.push({ name: 'Ambient', changedPixels: await changedPixels(ambientA, ambientB) });

  for (const timeline of timelines) {
    for (const other of timelines) await page.evaluate(name => window.__proof.stop(name), other);
    await page.waitForTimeout(80);
    const before = path.join(out, `${timeline}-before.png`);
    await page.screenshot({ path: before });
    const playing = await page.evaluate(name => window.__proof.playAlso(name), timeline);
    await page.waitForTimeout(430);
    const after = path.join(out, `${timeline}-after.png`);
    await page.screenshot({ path: after });
    results.push({ name: timeline, playing, changedPixels: await changedPixels(before, after) });
  }

  const frames = await page.evaluate(() => window.__proof.frames);
  const report = { generatedAt: new Date().toISOString(), runtime: require('@rive-app/webgl2/package.json').version, structure, frames, consoleMessages, results };
  await writeFile(path.join(out, 'proof.json'), `${JSON.stringify(report, null, 2)}\n`);
  const failed = !structure.loaded || structure.error || consoleMessages.length || frames < 2 || results.some(result => result.changedPixels === 0);
  console.log(JSON.stringify({ ...report, passed: !failed }, null, 2));
  if (failed) process.exitCode = 1;
  await context.close();
} finally {
  await browser.close();
  server.close();
}
