import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PATCH_ONLY_RIV = new URL('../../evidence/rive/tdg-patch-mcp.riv', import.meta.url); // a real .riv without the Lobby artboard

test('the lobby stays responsive and interactive on the software renderer', async ({ page, isMobile }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'only the GPU-less Chromium project exercises SwiftShader');
  test.skip(isMobile);
  await page.goto('/');
  await page.waitForTimeout(3000);
  await expect(page.locator('.scene')).toHaveAttribute('data-native', /ready|failed|fallback/, { timeout: 15_000 });
  await expect(page.locator('.scene-hit')).toHaveCount(5);
  const t = Date.now(); await page.evaluate(() => 1 + 1); expect(Date.now() - t).toBeLessThan(500); // main thread free
});

test.describe('native lobby layer', () => {
  test.beforeEach(async ({ isMobile }, testInfo) => {
    test.skip(isMobile, 'the native layer is desktop-only by design');
    test.skip(testInfo.project.name === 'chromium', 'needs a hardware renderer; see the chromium-gpu project');
  });

  test('poster-to-native handover keeps the poster and the real links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-live')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.scene-rive canvas')).toHaveCount(1);
    await expect(page.locator('.scene-poster')).toBeAttached();
    await expect(page.locator('.scene-hit')).toHaveCount(5);
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'true');
  });

  test('a missing .riv leaves the poster and links working', async ({ page }) => {
    await page.route('**/animation/rooms/lobby*.riv', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('.scene-live')).toHaveCount(0);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await expect(page.locator('.scene-poster')).toBeVisible();
    await page.locator('.scene-hit[data-hit="door-IT"]').click();
    await expect(page).toHaveURL(/\/capabilities\/business-it$/);
  });

  test('an incompatible file (no Lobby artboard) falls back the same way', async ({ page }) => {
    const bytes = readFileSync(PATCH_ONLY_RIV);
    await page.route('**/animation/rooms/lobby*.riv', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: bytes }));
    await page.goto('/');
    await page.waitForTimeout(3000);
    await expect(page.locator('.scene-live')).toHaveCount(0);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await expect(page.locator('.scene-hit')).toHaveCount(5);
  });

  test('reduced motion disables the native layer and door clicks navigate immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    const t = Date.now();
    await page.locator('.scene-hit[data-hit="door-Gov"]').click();
    await expect(page).toHaveURL(/\/government$/);
    expect(Date.now() - t).toBeLessThan(3000);
  });

  test('playback pauses when the document is hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'true', { timeout: 15_000 });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'false');
  });

  test('the motion control stops the native layer and persists; route changes clean the canvas up', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-live')).toHaveCount(1, { timeout: 15_000 });
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await page.getByRole('button', { name: 'Resume motion' }).click();
    await expect(page.locator('.scene-live')).toHaveCount(1, { timeout: 15_000 });
    await page.locator('.site-nav').getByRole('link', { name: 'Company' }).click();
    await expect(page).toHaveURL(/\/company$/);
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('.scene-live')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(1); // the remounted room, with no canvas leaked from the previous visit
  });
});
