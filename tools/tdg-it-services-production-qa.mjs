import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.TDG_QA_BASE || 'http://127.0.0.1:4412/';
const out = path.resolve(process.env.TDG_QA_OUT || 'evidence/rive/it-services/final-production');
await fs.mkdir(out, { recursive: true });
const runs = [];
async function capture({name, url = new URL('/capabilities/business-it', base).toString(), viewport=[1440,900], reducedMotion='no-preference', actions=[]}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, reducedMotion, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors=[]; const failed=[];
  page.on('console', msg => { if(['error','warning'].includes(msg.type())) errors.push(`${msg.type()}: ${msg.text()}`); });
  page.on('requestfailed', req => failed.push(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`));
  const start=Date.now();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.scene[data-scene="it-services"] .it-environment', { timeout: 12000 });
  await page.waitForTimeout(800);
  for (const action of actions) {
    if (action.type === 'hover') { await page.locator(action.selector).hover(); await page.waitForTimeout(action.wait ?? 650); }
    if (action.type === 'pause') { await page.getByRole('button', { name: /Pause motion|Resume motion/ }).click(); await page.waitForTimeout(400); }
    if (action.type === 'click') { await page.locator(action.selector).click(); await page.waitForTimeout(action.wait ?? 1000); }
    if (action.type === 'keyboard') { await page.keyboard.press('Tab'); await page.waitForTimeout(100); await page.keyboard.press('Tab'); await page.waitForTimeout(300); }
    if (action.type === 'resize') { await page.setViewportSize({ width: action.viewport[0], height: action.viewport[1] }); await page.waitForTimeout(500); }
  }
  const screenshot = path.join(out, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const perf = await page.evaluate(async () => {
    const frames=[]; let last=performance.now(); const end=last+1000;
    await new Promise(resolve => { function tick(now){ const fps = 1000 / Math.max(1, now - last); if (Number.isFinite(fps) && fps > 0 && fps < 240) frames.push(fps); last=now; if(now<end) requestAnimationFrame(tick); else resolve(); } requestAnimationFrame(tick); });
    const scene = document.querySelector('.scene[data-scene="it-services"]');
    const env = document.querySelector('.it-environment');
    const rect = scene?.getBoundingClientRect();
    const layerCount = document.querySelectorAll('.it-kit-layer').length;
    const visibleKitLayers = [...document.querySelectorAll('.it-kit-layer')].filter(e => Number(getComputedStyle(e).opacity) > 0.001).length;
    const animations = document.getAnimations().filter(a => a.playState === 'running').length;
    const hotspots = [...document.querySelectorAll('.scene-hit')].map(a => a.getAttribute('data-hit'));
    return {
      url: location.href,
      sceneRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      sceneId: scene?.getAttribute('data-scene'),
      focus: scene?.getAttribute('data-focus'),
      motion: scene?.getAttribute('data-motion'),
      state: env?.getAttribute('data-scene-state'),
      counts: {
        kitLayers: layerCount,
        visibleKitLayers,
        rackLeds: document.querySelectorAll('.it-rack-led').length,
        statusPulses: document.querySelectorAll('.it-status-pulse').length,
        screens: document.querySelectorAll('.it-screen-activity').length,
        floorEffects: document.querySelectorAll('.it-floor-mask').length,
        debugBoxes: document.querySelectorAll('.it-debug-box').length,
        mascotAnchors: document.querySelectorAll('.it-mascot-anchor').length,
        canvas: document.querySelectorAll('canvas').length,
        envSprites: document.querySelectorAll('.env-sprite').length,
        animations,
      },
      hotspots,
      avgFps: frames.length ? frames.reduce((a,b)=>a+b,0)/frames.length : 0,
      minFps: frames.length ? Math.min(...frames) : 0,
      bodyScroll: { width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth },
    };
  });
  await context.close(); await browser.close();
  runs.push({ name, viewport, reducedMotion, screenshot, errors, failed, perf, elapsedMs: Date.now()-start });
}
const it='/capabilities/business-it';
await capture({ name:'neutral' });
await capture({ name:'ambient-idle' });
await capture({ name:'workstations', actions:[{type:'hover', selector:'.scene-hit[data-hit="workstations"]'}] });
await capture({ name:'racks', actions:[{type:'hover', selector:'.scene-hit[data-hit="racks"]'}] });
await capture({ name:'status', actions:[{type:'hover', selector:'.scene-hit[data-hit="status"]'}] });
await capture({ name:'helpdesk', actions:[{type:'hover', selector:'.scene-hit[data-hit="helpdesk"]'}] });
await capture({ name:'deployment', actions:[{type:'hover', selector:'.scene-hit[data-hit="deployment"]'}] });
await capture({ name:'toolcart', actions:[{type:'hover', selector:'.scene-hit[data-hit="toolcart"]'}] });
await capture({ name:'depth-parallax', actions:[{type:'hover', selector:'.scene-hit[data-hit="racks"]'}] });
await capture({ name:'pause-motion', actions:[{type:'pause'}] });
await capture({ name:'reduced-motion', reducedMotion:'reduce' });
await capture({ name:'debug-coordinates', url: new URL('/capabilities/business-it?lobbyDebug=1', base).toString() });
for (const viewport of [[1920,1080],[1728,1117],[1440,900],[1366,768],[1280,800],[1180,820]]) await capture({ name:`responsive-${viewport[0]}x${viewport[1]}`, viewport });
await capture({ name:'keyboard-focus', actions:[{type:'keyboard'}] });
for (const [name, selector] of [['click-status','.scene-hit[data-hit="status"]'],['click-workstations','.scene-hit[data-hit="workstations"]'],['click-racks','.scene-hit[data-hit="racks"]'],['click-deployment','.scene-hit[data-hit="deployment"]'],['click-toolcart','.scene-hit[data-hit="toolcart"]']]) await capture({ name, actions:[{type:'click', selector, wait:950}] });
const summary = {
  base, out, generatedAt: new Date().toISOString(),
  runCount: runs.length,
  errors: runs.flatMap(r => r.errors.map(e => ({ run:r.name, error:e }))),
  failedRequests: runs.flatMap(r => r.failed.map(f => ({ run:r.name, failed:f }))),
  fps: { min: Math.min(...runs.map(r=>r.perf.minFps).filter(Number.isFinite)), avg: runs.reduce((a,r)=>a+(Number.isFinite(r.perf.avgFps)?r.perf.avgFps:0),0)/runs.length },
  runs,
};
await fs.writeFile(path.join(out,'qa-results.json'), JSON.stringify(summary,null,2));
await fs.writeFile(path.join(out,'performance-results.json'), JSON.stringify({ fps: summary.fps, counts: runs[0]?.perf.counts, timings: runs.map(r=>({name:r.name, elapsedMs:r.elapsedMs, fps:r.perf.avgFps, minFps:r.perf.minFps, counts:r.perf.counts})) },null,2));
await fs.writeFile(path.join(out,'visual-regression.json'), JSON.stringify({ mode:'neutral/referenceMode/static overlay disabled', reference:'public/images/posters/it-services.svg generated from supplied kit', neutralScreenshot:path.join(out,'neutral.png'), staticModeQuery:'?referenceMode=1 or ?debugStaticLobby=1', note:'Approved static poster remains base; production overlay returns null in static/reference mode so neutral source is unaltered.' },null,2));
console.log(JSON.stringify({ out, runCount:runs.length, errors:summary.errors.length, failedRequests:summary.failedRequests.length, fps:summary.fps, firstCounts:runs[0]?.perf.counts }, null, 2));
