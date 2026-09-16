import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const baseUrl = process.env.TDG_QA_BASE ?? 'http://127.0.0.1:4411';
const outputDir = path.resolve(process.env.TDG_QA_OUT ?? 'evidence/rive/it-services/native-page');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

const results = [];
const failures = [];

async function verifyViewport(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    requestFailures.push(`${request.url()} ${request.failure()?.errorText ?? ''}`);
  });

  await page.goto(`${baseUrl}/capabilities/business-it`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.scene[data-scene="it-services"]');
  await page.waitForFunction(() => document.querySelector('.scene')?.getAttribute('data-native') !== 'loading');

  const scene = page.locator('.scene[data-scene="it-services"]');
  const nativeState = await scene.getAttribute('data-native');
  if (nativeState !== 'ready') failures.push(`${name}: native Rive state was ${nativeState}`);

  const interactions = [];
  for (const hotspot of ['status', 'deployment', 'toolcart']) {
    // Dispatch the same bubbling event React uses without asking Playwright to pan an
    // overflow-hidden, cover-cropped mobile artboard to an offscreen SVG rectangle.
    await page.locator(`.scene-hit[data-hit="${hotspot}"]`).dispatchEvent('mouseover');
    await page.waitForTimeout(350);
    const state = await scene.getAttribute('data-focus');
    const nativeFocus = await page.locator('.it-services-rive').getAttribute('data-native-focus');
    interactions.push({ hotspot, state, nativeFocus });
    if (state !== hotspot || nativeFocus !== hotspot) {
      failures.push(`${name}: ${hotspot} focus did not reach both DOM and native layers`);
    }
  }

  await page.mouse.move(2, 2);
  await page.waitForTimeout(300);
  const screenshot = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const pixels = PNG.sync.read(await readFile(screenshot));
  let luma = 0;
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    luma += pixels.data[offset] * .2126 + pixels.data[offset + 1] * .7152 + pixels.data[offset + 2] * .0722;
  }
  const averageLuma = luma / (pixels.width * pixels.height);

  const evidence = await page.evaluate(() => {
    const sceneElement = document.querySelector('.scene[data-scene="it-services"]');
    const plane = document.querySelector('.scene-plane');
    const canvas = document.querySelector('.it-services-rive canvas');
    const riveLayer = document.querySelector('.it-services-rive');
    const poster = document.querySelector('.scene-poster');
    const glCanvas = document.createElement('canvas');
    const gl = glCanvas.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    const rect = sceneElement?.getBoundingClientRect();
    return {
      renderer: extension && gl ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      native: sceneElement?.getAttribute('data-native'),
      motion: sceneElement?.getAttribute('data-motion'),
      rivePlaying: document.querySelector('.it-services-rive')?.getAttribute('data-playing'),
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      canvasRect: canvas ? { width: canvas.getBoundingClientRect().width, height: canvas.getBoundingClientRect().height, left: canvas.getBoundingClientRect().left, right: canvas.getBoundingClientRect().right } : null,
      riveRect: riveLayer ? { width: riveLayer.getBoundingClientRect().width, height: riveLayer.getBoundingClientRect().height, left: riveLayer.getBoundingClientRect().left, right: riveLayer.getBoundingClientRect().right } : null,
      bodyRect: { width: document.body.getBoundingClientRect().width, left: document.body.getBoundingClientRect().left, right: document.body.getBoundingClientRect().right },
      posterVisibility: poster ? getComputedStyle(poster).visibility : null,
      posterOpacity: poster ? getComputedStyle(poster).opacity : null,
      sceneRect: rect ? { width: rect.width, height: rect.height, top: rect.top, left: rect.left } : null,
      planeRect: plane ? { width: plane.getBoundingClientRect().width, height: plane.getBoundingClientRect().height, left: plane.getBoundingClientRect().left, right: plane.getBoundingClientRect().right, transform: getComputedStyle(plane).transform, cssLeft: getComputedStyle(plane).left, marginLeft: getComputedStyle(plane).marginLeft, offsetLeft: plane.offsetLeft, offsetParent: plane.offsetParent?.className ?? null } : null,
      hotspots: document.querySelectorAll('.scene-hit').length,
      bodyOverflow: getComputedStyle(document.body).overflow,
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
    };
  });

  if (!evidence.canvas) failures.push(`${name}: native canvas missing`);
  if (evidence.posterVisibility !== 'visible' || evidence.posterOpacity !== '1') failures.push(`${name}: authoritative room plate is not visible beneath native motion`);
  if (averageLuma < 110) failures.push(`${name}: composed room is too dark (${averageLuma.toFixed(1)} average luma)`);
  if (evidence.hotspots !== 6) failures.push(`${name}: expected 6 hotspots, found ${evidence.hotspots}`);
  if (evidence.scroll.width > evidence.scroll.clientWidth + 1 || evidence.scroll.height > evidence.scroll.clientHeight + 1) {
    failures.push(`${name}: page scrolls outside its full-viewport scene`);
  }
  if (consoleErrors.length) failures.push(`${name}: ${consoleErrors.length} console errors`);
  if (requestFailures.length) failures.push(`${name}: ${requestFailures.length} failed requests`);

  results.push({ name, viewport, screenshot, averageLuma, interactions, consoleErrors, requestFailures, evidence });
  await context.close();
}

try {
  await verifyViewport('desktop-1440x900', { width: 1440, height: 900 });
  await verifyViewport('mobile-390x844', { width: 390, height: 844 });
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  pass: failures.length === 0,
  failures,
  results,
};
await writeFile(path.join(outputDir, 'qa-results.json'), `${JSON.stringify(report, null, 2)}\n`);

for (const result of results) {
  console.log(`${result.name}: ${result.evidence.native}, ${result.evidence.renderer}, ${result.evidence.hotspots} hotspots`);
}
if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log('PASS native IT Services page at desktop and mobile viewports');
}
