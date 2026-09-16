import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const base = process.env.TDG_QA_BASE ?? 'http://127.0.0.1:4414';
const route = `${base}/capabilities/cybersecurity?v=${Date.now()}`;
const evidence = resolve('evidence/rive/cybersecurity/browser');
mkdirSync(evidence, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const failedRequests = [];
const findings = {};

async function open(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForSelector('.scene-cybersecurity[data-vector="ready"]', { timeout: 20000 });
  return { context, page };
}

const desktop = await open({ width: 1440, height: 1000 });
const page = desktop.page;
await page.waitForTimeout(1200);
findings.initial = await page.locator('.scene-cybersecurity').evaluate(scene => ({
  vector: scene.getAttribute('data-vector'),
  native: scene.getAttribute('data-native'),
  renderer: scene.getAttribute('data-renderer'),
  motion: scene.getAttribute('data-motion'),
  hotspots: scene.querySelectorAll('.scene-hit').length,
  paths: scene.querySelectorAll('.cybersecurity-vector path').length,
  canvases: scene.querySelectorAll('canvas').length,
  documentAnimations: document.getAnimations().length,
  vectorAnimations: Array.from(scene.querySelectorAll('.cybersecurity-vector svg')).reduce((total, pass) => total + pass.getAnimations({ subtree: true }).length, 0),
  vectorPasses: Array.from(scene.querySelectorAll('.cybersecurity-vector-pass')).map(pass => pass.getAttribute('data-pass')),
}));
await page.screenshot({ path: resolve(evidence, 'desktop-idle.png'), fullPage: true });

async function select(id, expected) {
  const hit = page.locator(`[data-hit="${id}"]`);
  await hit.hover();
  await page.waitForTimeout(180);
  const hover = await page.locator('.scene-cybersecurity').getAttribute('data-focus');
  await hit.click();
  await page.waitForTimeout(180);
  const selected = await page.locator('.scene-cybersecurity').getAttribute('data-selected');
  const caption = await page.locator('.scene-caption').textContent();
  await page.screenshot({ path: resolve(evidence, `desktop-${id}.png`), fullPage: true });
  if (hover !== id || selected !== id || !caption?.includes(expected)) throw new Error(`Interaction contract failed for ${id}: hover=${hover}, selected=${selected}, caption=${caption}`);
}

await select('monitoring', 'illustrative');
findings.monitoring = await page.evaluate(() => ({
  sweepDuration: getComputedStyle(document.querySelector('#threat_sweep')).animationDuration,
  sweepName: getComputedStyle(document.querySelector('#threat_sweep')).animationName,
  refreshDuration: getComputedStyle(document.querySelector('#monitor_refresh_1')).animationDuration,
}));
await select('health', 'human security review');
findings.health = await page.evaluate(() => ({
  checkOpacity: getComputedStyle(document.querySelector('#health_row_networks_check')).opacity,
  checks: document.querySelectorAll('[id^="health_row_"][id$="_check"]').length,
}));
await select('response', 'Decide who');
findings.response = await page.evaluate(() => ({ cameraTransform: getComputedStyle(document.querySelector('#camera_head')).transform }));
await select('infrastructure', 'Protect the foundations');
findings.infrastructure = await page.evaluate(() => ({ rackTransform: getComputedStyle(document.querySelector('#server_rack_middle_door')).transform }));
await select('briefing', 'Request a human');
findings.briefing = await page.evaluate(() => ({
  chairTransform: getComputedStyle(document.querySelector('#console_chair_1')).transform,
  drawerTransform: getComputedStyle(document.querySelector('#console_1_left_cabinet_drawer_1')).transform,
  centerMonitorFilter: getComputedStyle(document.querySelector('#monitor_2_2')).filter,
  drawers: Array.from(document.querySelectorAll('[id*="_cabinet_drawer_"]')).filter(element => /_cabinet_drawer_[123]$/.test(element.id)).length,
}));

// The briefing target navigates after its authored transition; return to validate remaining in-room states.
await page.waitForURL(/\/contact/, { timeout: 3000 });
await page.goto(route, { waitUntil: 'networkidle' });
await page.waitForSelector('.scene-cybersecurity[data-vector="ready"]', { timeout: 20000 });

async function hoverScenePoint(x, y, settle = 460) {
  const box = await page.locator('.scene-cybersecurity .scene-plane').boundingBox();
  if (!box) throw new Error('Cybersecurity scene plane has no bounding box.');
  await page.mouse.move(box.x + x / 1648 * box.width, box.y + y / 928 * box.height);
  await page.waitForTimeout(settle);
}

const chairPoints = [
  ['console_chair_1', 511, 531],
  ['console_chair_2', 820, 531],
  ['console_chair_3', 1132, 531],
];
const drawerPoints = [];
for (const [consoleNumber, leftX, rightX] of [[1, 381, 615], [2, 704, 931], [3, 1019, 1249]]) {
  for (const [side, x] of [['left', leftX], ['right', rightX]]) {
    for (const [drawerNumber, y] of [[1, 514], [2, 530], [3, 547]]) {
      drawerPoints.push([`console_${consoleNumber}_${side}_cabinet_drawer_${drawerNumber}`, x, y]);
    }
  }
}

findings.objectInteractions = { chairs: {}, drawers: {} };
for (const [id, x, y] of chairPoints) {
  await hoverScenePoint(x, y, 540);
  findings.objectInteractions.chairs[id] = await page.evaluate(targetId => {
    const targets = Array.from(document.querySelectorAll('[id^="console_chair_"]')).filter(element => /^console_chair_[123]$/.test(element.id));
    const visiblyTranslated = element => {
      const transform = getComputedStyle(element).transform;
      if (transform === 'none') return false;
      const matrix = new DOMMatrix(transform);
      return Math.hypot(matrix.e, matrix.f) > 0.1;
    };
    return {
      sceneFocus: document.querySelector('.scene-cybersecurity')?.getAttribute('data-object-focus'),
      vectorFocus: document.querySelector('.cybersecurity-vector svg')?.getAttribute('data-object-focus'),
      targetTransform: getComputedStyle(document.getElementById(targetId)).transform,
      activeTargets: targets.filter(visiblyTranslated).map(target => target.id),
    };
  }, id);
}
for (const [id, x, y] of drawerPoints) {
  await hoverScenePoint(x, y);
  findings.objectInteractions.drawers[id] = await page.evaluate(targetId => {
    const targets = Array.from(document.querySelectorAll('[id*="_cabinet_drawer_"]')).filter(element => /_cabinet_drawer_[123]$/.test(element.id));
    const visiblyTranslated = element => {
      const transform = getComputedStyle(element).transform;
      if (transform === 'none') return false;
      const matrix = new DOMMatrix(transform);
      return Math.hypot(matrix.e, matrix.f) > 0.1;
    };
    return {
      sceneFocus: document.querySelector('.scene-cybersecurity')?.getAttribute('data-object-focus'),
      vectorFocus: document.querySelector('.cybersecurity-vector svg')?.getAttribute('data-object-focus'),
      targetTransform: getComputedStyle(document.getElementById(targetId)).transform,
      activeTargets: targets.filter(visiblyTranslated).map(target => target.id),
    };
  }, id);
}
await hoverScenePoint(820, 820);
findings.objectInteractions.cleared = await page.locator('.scene-cybersecurity').evaluate(scene => ({
  sceneFocus: scene.getAttribute('data-object-focus'),
  activeChairs: Array.from(scene.querySelectorAll('[id^="console_chair_"]')).filter(element => /^console_chair_[123]$/.test(element.id) && getComputedStyle(element).transform !== 'none').length,
  activeDrawers: Array.from(scene.querySelectorAll('[id*="_cabinet_drawer_"]')).filter(element => /_cabinet_drawer_[123]$/.test(element.id) && getComputedStyle(element).transform !== 'none').length,
}));
await select('process', 'Scope, collect');
findings.process = await page.evaluate(() => ({ binderTransform: getComputedStyle(document.querySelector('#reference_binder_3')).transform }));
findings.kitTiming = await page.evaluate(() => ({
  signalDuration: getComputedStyle(document.querySelector('#node_pulse_1')).animationDuration,
  signalStartOpacity: getComputedStyle(document.querySelector('#node_pulse_1')).opacity,
  foliageDuration: getComputedStyle(document.querySelector('[data-motion="sway_small"]')).animationDuration,
  foliageTargets: document.querySelectorAll('[data-motion="sway_small"]').length,
  doorOrigin: getComputedStyle(document.querySelector('#secure_door_leaf')).transformOrigin,
}));

const idleA = await page.screenshot();
findings.ambientSample = await page.evaluate(async () => {
  const pulse = document.querySelector('#node_pulse_1');
  const camera = document.querySelector('#camera_head');
  const before = { pulse: getComputedStyle(pulse).opacity, camera: getComputedStyle(camera).transform };
  await new Promise(resolve => setTimeout(resolve, 1200));
  const after = { pulse: getComputedStyle(pulse).opacity, camera: getComputedStyle(camera).transform };
  return { before, after };
});
await page.waitForTimeout(900);
const idleB = await page.screenshot();
const a = PNG.sync.read(idleA);
const b = PNG.sync.read(idleB);
const diff = new PNG({ width: a.width, height: a.height });
findings.ambientChangedPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
writeFileSync(resolve(evidence, 'desktop-ambient-diff.png'), PNG.sync.write(diff));

await page.locator('.motion-control').click();
await page.waitForTimeout(120);
findings.paused = await page.locator('.scene-cybersecurity').evaluate(scene => ({
  motion: scene.getAttribute('data-motion'),
  vectorPaused: scene.querySelector('.cybersecurity-vector svg')?.getAttribute('data-paused'),
  nativePlaying: scene.querySelector('.cybersecurity-rive')?.getAttribute('data-playing') ?? 'not-mounted',
  button: scene.querySelector('.motion-control')?.textContent,
}));
await page.screenshot({ path: resolve(evidence, 'desktop-paused.png'), fullPage: true });

await page.locator('.motion-control').click();
await page.waitForTimeout(80);
await page.locator('[data-hit="return-lobby"]').click();
await page.waitForTimeout(260);
findings.door = await page.evaluate(() => ({ doorTransform: getComputedStyle(document.querySelector('#secure_door_leaf')).transform }));
await page.waitForURL(url => url.pathname === '/', { timeout: 3000 });
await desktop.context.close();

const mobile = await open({ width: 390, height: 844 });
await mobile.page.screenshot({ path: resolve(evidence, 'mobile-idle.png'), fullPage: true });
findings.mobile = await mobile.page.locator('.scene-cybersecurity').evaluate(scene => {
  const rect = scene.getBoundingClientRect();
  return { width: rect.width, height: rect.height, hotspots: scene.querySelectorAll('.scene-hit').length, vector: scene.getAttribute('data-vector') };
});
await mobile.context.close();

const reduced = await open({ width: 1280, height: 800 }, 'reduce');
findings.reduced = await reduced.page.locator('.scene-cybersecurity').evaluate(scene => ({
  motion: scene.getAttribute('data-motion'),
  vectorPaused: scene.querySelector('.cybersecurity-vector svg')?.getAttribute('data-paused'),
  button: scene.querySelector('.motion-control')?.textContent,
}));
await reduced.context.close();
await browser.close();

const assertions = {
  exactHotspotCount: findings.initial.hotspots === 7,
  suppliedVectorLoaded: findings.initial.paths > 5000,
  singleAuthoritativeSceneAssembled: JSON.stringify(findings.initial.vectorPasses) === JSON.stringify(['scene']),
  nativeRiveReadyOrCorrectFallback: findings.initial.native === 'ready' && findings.initial.canvases === 1 || findings.initial.native === 'fallback' && findings.initial.renderer.startsWith('software renderer'),
  ambientMotionActive: findings.ambientChangedPixels > 100 || findings.ambientSample.before.pulse !== findings.ambientSample.after.pulse || findings.ambientSample.before.camera !== findings.ambientSample.after.camera,
  kitMapSweep: findings.monitoring.sweepDuration === '1.45s' && findings.monitoring.refreshDuration === '1.45s',
  kitAmbientSignals: findings.kitTiming.signalDuration === '4s',
  kitFoliage: findings.kitTiming.foliageDuration === '9s' && findings.kitTiming.foliageTargets > 0,
  kitChecks: findings.health.checks === 5 && Number(findings.health.checkOpacity) < 0.2,
  kitCamera: findings.response.cameraTransform !== 'none',
  kitRackGlass: findings.infrastructure.rackTransform !== 'none',
  independentFurnitureLayers: findings.briefing.drawers === 18 && findings.briefing.chairTransform === 'none' && findings.briefing.drawerTransform === 'none',
  allChairsIndependentlyInteractive: Object.entries(findings.objectInteractions.chairs).length === 3 && Object.entries(findings.objectInteractions.chairs).every(([id, result]) => result.sceneFocus === id && result.vectorFocus === id && result.targetTransform !== 'none' && result.activeTargets.length === 1 && result.activeTargets[0] === id),
  allDrawersIndependentlyInteractive: Object.entries(findings.objectInteractions.drawers).length === 18 && Object.entries(findings.objectInteractions.drawers).every(([id, result]) => result.sceneFocus === id && result.vectorFocus === id && result.targetTransform !== 'none' && result.activeTargets.length === 1 && result.activeTargets[0] === id),
  objectMotionClearsCleanly: findings.objectInteractions.cleared.sceneFocus === '' && findings.objectInteractions.cleared.activeChairs === 0 && findings.objectInteractions.cleared.activeDrawers === 0,
  briefingTargetsCenterScreensOnly: findings.briefing.centerMonitorFilter !== 'none',
  kitBinder: findings.process.binderTransform !== 'none',
  kitDoor: findings.door.doorTransform !== 'none',
  pauseStopsBothLayers: findings.paused.motion === 'reduced' && findings.paused.vectorPaused === 'true' && (findings.paused.nativePlaying === 'false' || findings.paused.nativePlaying === 'not-mounted'),
  reducedMotionHonored: findings.reduced.motion === 'reduced' && findings.reduced.vectorPaused === 'true',
  responsiveMobile: findings.mobile.width === 390 && findings.mobile.height === 844 && findings.mobile.hotspots === 7,
  noConsoleErrors: errors.length === 0,
  noFailedRequests: failedRequests.length === 0,
};

const report = { route, findings, assertions, errors, failedRequests, passed: Object.values(assertions).every(Boolean) };
writeFileSync(resolve(evidence, 'qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
