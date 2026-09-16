import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PATCH_ONLY_RIV = new URL('../../evidence/rive/tdg-patch-mcp.riv', import.meta.url); // a real .riv without the Lobby artboard

test('on a software renderer the page stays poster-only and responsive', async ({ page, isMobile }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'only the GPU-less Chromium project exercises SwiftShader');
  test.skip(isMobile);
  await page.goto('/');
  await page.waitForTimeout(3000);
  await expect(page.locator('.scene')).toHaveAttribute('data-renderer', /software|no hardware/);
  await expect(page.locator('.scene-rive')).toHaveCount(0);
  await expect(page.locator('.scene-poster')).toBeVisible();
  const t = Date.now(); await page.evaluate(() => 1 + 1); expect(Date.now() - t).toBeLessThan(500); // main thread free
});

test.describe('native lobby layer', () => {
  test.beforeEach(async ({ isMobile }, testInfo) => {
    test.skip(isMobile, 'the native layer is desktop-only by design');
    test.skip(testInfo.project.name === 'chromium', 'needs a hardware renderer; see the chromium-gpu project');
  });

  test('poster-to-native handover keeps the poster and the real links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-poster')).toBeVisible();
    await expect(page.locator('.scene-live')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.scene-rive canvas')).toHaveCount(1);
    await expect(page.locator('.scene-poster')).toBeAttached();
    await expect(page.locator('.scene-hit')).toHaveCount(3);
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'true');
  });

  test('a missing .riv leaves the poster and links working', async ({ page }) => {
    await page.route('**/animation/rooms/lobby.riv', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('.scene-live')).toHaveCount(0);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await expect(page.locator('.scene-poster')).toBeVisible();
    await page.locator('.scene-hit[data-hit="it"]').click();
    await expect(page).toHaveURL(/\/capabilities\/business-it$/);
  });

  test('an incompatible file (no Lobby artboard) falls back the same way', async ({ page }) => {
    const bytes = readFileSync(PATCH_ONLY_RIV);
    await page.route('**/animation/rooms/lobby.riv', route => route.fulfill({ status: 200, contentType: 'application/octet-stream', body: bytes }));
    await page.goto('/');
    await page.waitForTimeout(3000);
    await expect(page.locator('.scene-live')).toHaveCount(0);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    await expect(page.locator('.scene-hit')).toHaveCount(3);
  });

  test('reduced motion disables the native layer and door clicks navigate immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await expect(page.locator('.scene-rive')).toHaveCount(0);
    const t = Date.now();
    await page.locator('.scene-hit[data-hit="government"]').click();
    await expect(page).toHaveURL(/\/government$/);
    expect(Date.now() - t).toBeLessThan(2000);
  });

  test('playback pauses offscreen and when the document is hidden, and resumes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'true', { timeout: 15_000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'false');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.scene-rive')).toHaveAttribute('data-playing', 'true');
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
    await expect(page.locator('.consultant')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('canvas')).toHaveCount(2); // room + Consultant, nothing left over from the previous visit
  });
});

test.describe('consultant', () => {
  test.beforeEach(async ({ isMobile }, testInfo) => {
    test.skip(isMobile, 'the Consultant is desktop-only by design');
    test.skip(testInfo.project.name === 'chromium', 'needs a hardware renderer; see the chromium-gpu project');
  });

  test('Patch stands in the lobby, pays attention to a hovered door, and never receives pointer events', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.consultant')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.tdg-patch-rive')).toHaveAttribute('data-expression', 'neutral');
    await page.locator('.scene-hit[data-hit="cyber"]').hover();
    await expect(page.locator('.tdg-patch-rive')).toHaveAttribute('data-expression', 'focused');
    await expect(page.locator('.tdg-patch-rive')).toHaveAttribute('data-gesture', 'wave');
    await expect(page.locator('.consultant')).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('canvas')).toHaveCount(2);
  });

  test('a missing Consultant file leaves the room and its links intact', async ({ page }) => {
    await page.route('**/animation/consultant/patch.riv', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('.consultant')).toHaveCount(0);
    await expect(page.locator('.scene-hit')).toHaveCount(3);
    await expect(page.locator('.scene-live')).toHaveCount(1);
  });

  test('on the contact page Patch acknowledges only a backend provider_accepted, never the click', async ({ page }) => {
    await page.route('**/api/inquiries', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ outcome: 'provider_rejected', requestId: 'x', title: 'Message not sent', message: 'refused', fields: {}, duplicate: false }) }));
    await page.goto('/contact?project=security');
    await expect(page.locator('.contact-consultant')).toHaveAttribute('data-acknowledged', 'false');
    await page.getByLabel('Your name').fill('Pat Example'); await page.getByLabel('Email for the reply').fill('pat@example.org'); await page.getByLabel('Message').fill('We need a security review of two offices and a small data center.');
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByRole('alert')).toContainText('Message not sent');
    await expect(page.locator('.contact-consultant')).toHaveAttribute('data-acknowledged', 'false');
    await page.unroute('**/api/inquiries');
    await page.route('**/api/inquiries', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outcome: 'provider_accepted', requestId: 'y', title: 'Message received', message: 'accepted', fields: {}, duplicate: false }) }));
    await page.getByLabel('Your name').fill('Pat Example'); await page.getByLabel('Email for the reply').fill('pat@example.org'); await page.getByLabel('Message').fill('We need a security review of two offices and a small data center.');
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByRole('status')).toContainText('Message received');
    await expect(page.locator('.contact-consultant')).toHaveAttribute('data-acknowledged', 'true');
    await expect(page.locator('.tdg-patch-rive')).toHaveAttribute('data-gesture', 'thumbs-up');
  });
});
