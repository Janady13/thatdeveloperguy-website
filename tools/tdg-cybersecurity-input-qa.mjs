import { chromium, webkit } from '@playwright/test';

const base = process.env.TDG_QA_BASE ?? 'http://127.0.0.1:4414';
const route = `${base}/capabilities/cybersecurity?input-qa=${Date.now()}`;
const engines = { chromium, webkit };
const results = {};

for (const [name, engine] of Object.entries(engines)) {
  const browser = await engine.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(route, { waitUntil: 'networkidle' });
  await page.waitForSelector('.scene-cybersecurity[data-vector="ready"]', { timeout: 20000 });
  await page.evaluate(() => {
    window.__cyberInputEvents = [];
    for (const type of ['dragstart', 'dragend', 'click']) {
      document.addEventListener(type, event => {
        window.__cyberInputEvents.push({
          type,
          hit: event.target.closest?.('.scene-hit')?.getAttribute('data-hit') ?? null,
        });
      }, true);
    }
  });

  const target = page.locator('[data-hit="process"]');
  const box = await target.boundingBox();
  if (!box) throw new Error(`${name}: process hotspot has no bounding box`);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = { x: Math.min(1370, start.x + 430), y: Math.min(920, start.y + 250) };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  const events = await page.evaluate(() => window.__cyberInputEvents);
  const inputContract = await page.locator('.scene-cybersecurity').evaluate(scene => {
    const poster = scene.querySelector('.scene-poster');
    const hit = scene.querySelector('.scene-hit');
    const sceneStyle = getComputedStyle(scene);
    const hitStyle = getComputedStyle(hit);
    return {
      posterDraggable: poster.draggable,
      sceneUserSelect: sceneStyle.userSelect,
      hitUserSelect: hitStyle.userSelect,
      hitTouchAction: hitStyle.touchAction,
      hitWebkitUserDrag: hitStyle.getPropertyValue('-webkit-user-drag'),
    };
  });

  await target.click();
  await page.waitForTimeout(120);
  const selected = await page.locator('.scene-cybersecurity').getAttribute('data-selected');
  const assertions = {
    noNativeDrag: !events.some(event => event.type === 'dragstart' || event.type === 'dragend'),
    posterNotDraggable: inputContract.posterDraggable === false,
    roomNotSelectable: inputContract.sceneUserSelect === 'none' && inputContract.hitUserSelect === 'none',
    hotspotDragDisabled: inputContract.hitWebkitUserDrag === 'none',
    touchInputIntentional: inputContract.hitTouchAction === 'manipulation',
    clickStillWorks: selected === 'process',
    noConsoleErrors: errors.length === 0,
  };
  results[name] = { events, inputContract, selected, assertions, errors };
  await context.close();
  await browser.close();
}

const report = {
  route,
  results,
  passed: Object.values(results).every(result => Object.values(result.assertions).every(Boolean)),
};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
