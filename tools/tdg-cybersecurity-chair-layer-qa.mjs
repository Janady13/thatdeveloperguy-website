import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.TDG_QA_BASE ?? 'https://tdg.thatwebhostingguy.com';
const route = `${base}/capabilities/cybersecurity?v=${Date.now()}`;
const evidence = resolve('evidence/rive/cybersecurity/browser');
mkdirSync(evidence, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(route, { waitUntil: 'networkidle' });
await page.waitForSelector('.scene-cybersecurity[data-vector="ready"]', { timeout: 20000 });

const passes = await page.locator('.cybersecurity-vector-pass').evaluateAll(elements =>
  elements.map(element => element.getAttribute('data-pass')),
);
const plane = await page.locator('.scene-cybersecurity .scene-plane').boundingBox();
if (!plane) throw new Error('Cybersecurity scene plane has no bounding box.');
await page.mouse.move(plane.x + 511 / 1648 * plane.width, plane.y + 531 / 928 * plane.height);
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(evidence, 'chair-layer-regression.png'), fullPage: true });

const finding = await page.evaluate(() => ({
  focus: document.querySelector('.scene-cybersecurity')?.getAttribute('data-object-focus'),
  chairTransform: getComputedStyle(document.querySelector('#console_chair_1')).transform,
  vectorPasses: document.querySelectorAll('.cybersecurity-vector-pass').length,
}));
await browser.close();

const assertions = {
  singleAuthoritativeScene: JSON.stringify(passes) === JSON.stringify(['scene']),
  chairInteractionStillActive: finding.focus === 'console_chair_1' && finding.chairTransform !== 'none',
};
const report = { route, passes, finding, assertions, passed: Object.values(assertions).every(Boolean) };
writeFileSync(resolve(evidence, 'chair-layer-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
