/**
 * Rendered proof of a room .riv with the pinned WebGL2 runtime in headless Chrome (real GPU):
 * loads, renders, then a view-model change and a trigger must visibly change the frame.
 *   node --import tsx tools/rive-proof.ts --room lobby
 * Writes evidence/rive/<room>/{frame-*.png,proof.json}. Exit 1 on any failed check.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { repoRoot } from './kits.ts';
import { renderSvg } from './svg/diff.ts';

const require = createRequire(import.meta.url);
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1]! : d; };
const room = arg('--room', 'lobby');
const dir = room === 'consultant' ? resolve(repoRoot, 'creative-source/consultant/patch') : resolve(repoRoot, 'creative-source/rive', room);
const manifest = JSON.parse(readFileSync(join(dir, 'rive-manifest.json'), 'utf8'));
const runtimeDir = resolve(require.resolve('@rive-app/webgl2'), '..');
const runtimeVersion = require('@rive-app/webgl2/package.json').version as string;
const out = resolve(repoRoot, 'evidence/rive', room); mkdirSync(out, { recursive: true });

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const files: Record<string, string> = { '/harness.html': resolve(repoRoot, 'tools/rive-harness/harness.html'), '/runtime/rive.js': join(runtimeDir, 'rive.js'), '/runtime/rive.wasm': join(runtimeDir, 'rive.wasm'), '/scene.riv': join(dir, manifest.file) };
  const file = files[url.pathname];
  if (!file || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': url.pathname.endsWith('.html') ? 'text/html' : url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'tdg-proof-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1700,1000', '--hide-scrollbars', '--use-angle=metal', '--ignore-gpu-blocklist'], { stdio: 'ignore' });
const portFile = join(profile, 'DevToolsActivePort');
for (let i = 0; i < 100 && !existsSync(portFile); i++) await new Promise(r => setTimeout(r, 100));
const devPort = readFileSync(portFile, 'utf8').split('\n')[0]!.trim();
const target = await (await fetch(`http://127.0.0.1:${devPort}/json/new?about:blank`, { method: 'PUT' })).json() as { webSocketDebuggerUrl: string };
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', rej); });
let id = 0; const waits = new Map<number, (v: any) => void>();
ws.addEventListener('message', e => { const m = JSON.parse(String(e.data)); if (m.id && waits.has(m.id)) { waits.get(m.id)!(m); waits.delete(m.id); } });
const send = (method: string, params: Record<string, unknown> = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method, params })); return new Promise<any>(r => waits.set(n, r)); };
const ev = async (expr: string) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed'); return r.result?.result?.value; };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1000, deviceScaleFactor: 1, mobile: false });
const timelines = room === 'consultant'; // Patch is driven by timelines; its state machine is not run (see its manifest)
await send('Page.navigate', { url: `http://127.0.0.1:${port}/harness.html?src=/scene.riv&artboard=${encodeURIComponent(manifest.artboard)}${timelines ? '' : `&sm=${encodeURIComponent(manifest.stateMachine)}`}` });
let loaded = false; for (let i = 0; i < 100; i++) { await wait(200); if (await ev('window.__proof.loaded || window.__proof.error')) { loaded = Boolean(await ev('window.__proof.loaded')); break; } }
const error = await ev('window.__proof.error');
const artboards = await ev('JSON.stringify(window.__proof.artboards || null)');
/** WebGL canvases read back blank after present; the compositor screenshot is what the visitor sees. */
const clip = room === 'consultant' ? { x: 0, y: 0, width: 1648, height: 928, scale: 1 } : { x: 0, y: 0, width: 1648, height: 928, scale: 1 };
const screenshot = async () => { const r = await send('Page.captureScreenshot', { format: 'png', clip }); return PNG.sync.read(Buffer.from(r.result.data, 'base64')); };
const diff = (a: PNG, b: PNG) => pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 }) / (a.width * a.height);
const save = (name: string, image: PNG) => writeFileSync(join(out, name), PNG.sync.write(image));
const checks: Record<string, { ok: boolean; detail: string }> = {};
checks.loads = { ok: loaded && !error, detail: error ?? `loaded with ${runtimeVersion}` };
let frames = 0, idle: PNG | null = null, focused: PNG | null = null, opened: PNG | null = null;
if (loaded) {
  await wait(1200); frames = await ev('window.__proof.frames');
  idle = await screenshot(); save('frame-idle.png', idle);
  const nonWhite = (() => { let n = 0; for (let i = 0; i < idle!.data.length; i += 4) if (idle!.data[i]! < 250 || idle!.data[i + 1]! < 250 || idle!.data[i + 2]! < 250) n++; return n / (idle!.width * idle!.height); })();
  checks.renders = { ok: frames > 10 && nonWhite > (timelines ? 0.02 : 0.3), detail: `${frames} frames advanced in 1.2 s; ${(nonWhite * 100).toFixed(1)}% of pixels drawn` };
  if (timelines) {
    const names = JSON.parse(await ev('JSON.stringify(window.__proof.artboards)'))?.[0]?.animations ?? [];
    const required = ['Patch_Idle', 'Patch_Walk', 'Patch_Wave', 'Patch_Work', 'Patch_Enter', 'Patch_Exit', 'Patch_Blink', 'Patch_Neutral', 'Patch_Happy', 'Patch_Focused', 'Patch_Talking', 'Patch_WaveGesture', 'Patch_ThumbsUp'];
    checks.contract = { ok: required.every(n => names.includes(n)), detail: `${required.filter(n => names.includes(n)).length}/${required.length} controller-required timelines present` };
    await ev(`window.__proof.play(['Patch_Wave', 'Patch_Happy', 'Patch_WaveGesture'])`); await wait(600);
    focused = await screenshot(); save('frame-wave.png', focused);
    const waveDiff = diff(idle, focused);
    checks.timelineTransition = { ok: waveDiff > 0.002, detail: `Patch_Wave + Happy + WaveGesture changed ${(waveDiff * 100).toFixed(3)}% of pixels` };
    await ev(`window.__proof.play(['Patch_Walk', 'Patch_Focused'])`); await wait(600);
    opened = await screenshot(); save('frame-walk.png', opened);
    const walkDiff = diff(focused, opened);
    checks.secondTransition = { ok: walkDiff > 0.002, detail: `Patch_Walk + Focused changed ${(walkDiff * 100).toFixed(3)}% of pixels` };
  } else {
    const poster = PNG.sync.read(Buffer.from(renderSvg(readFileSync(resolve(repoRoot, 'creative-source/refined', room === 'lobby' ? 'lobby' : room, 'scene.svg'), 'utf8'), idle.width)));
    const posterDiff = poster.height === idle.height ? diff(idle, poster) : NaN;
    checks.matchesPoster = { ok: !Number.isNaN(posterDiff) && posterDiff < 0.25, detail: `idle frame differs from the vector poster on ${(posterDiff * 100).toFixed(1)}% of pixels` };
    checks.viewModel = { ok: Boolean((await ev('JSON.stringify(window.__proof.vm())')).includes('"ok":true')), detail: 'autoBind view-model instance present' };
    await ev(`window.__proof.setEnum('focus', 'government')`); await wait(500);
    focused = await screenshot(); save('frame-focus-government.png', focused);
    const focusDiff = diff(idle, focused);
    checks.focusTransition = { ok: focusDiff > 0.0005, detail: `focus=government changed ${(focusDiff * 100).toFixed(3)}% of pixels` };
    await ev(`window.__proof.fire('openGovernment')`); await wait(800);
    opened = await screenshot(); save('frame-open-government.png', opened);
    const openDiff = diff(focused, opened);
    checks.doorTransition = { ok: openDiff > 0.002, detail: `openGovernment changed ${(openDiff * 100).toFixed(3)}% of pixels after 0.8 s` };
  }
}
const proof = { room, file: manifest.file, sha256: manifest.sha256, bytes: manifest.bytes, runtime: `@rive-app/webgl2 ${runtimeVersion}`, renderer: await ev(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl2'; })()`), artboards: artboards ? JSON.parse(artboards) : null, checks, at: new Date().toISOString() };
writeFileSync(join(out, 'proof.json'), JSON.stringify(proof, null, 2) + '\n');
ws.close(); chrome.kill(); await new Promise(r => chrome.once('exit', r)); rmSync(profile, { recursive: true, force: true }); server.close();
for (const [name, c] of Object.entries(checks)) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${name}: ${c.detail}`);
if (Object.values(checks).some(c => !c.ok)) process.exit(1);
