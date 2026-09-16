import { test, expect } from '@playwright/test';

test('unknown URLs are real 404s with navigation, not a 200 shell', async ({ request, page }) => {
  const response = await request.get('/no-such-page');
  expect(response.status()).toBe(404);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Page not found');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('trailing slashes redirect to the canonical form; the receipt is noindex; drafts are not served', async ({ request }) => {
  const slash = await request.get('/government/', { maxRedirects: 0 });
  expect(slash.status()).toBe(301);
  expect(slash.headers()['location']).toMatch(/\/government$/);
  const receipt = await request.get('/contact/received');
  expect(receipt.status()).toBe(200);
  expect(await receipt.text()).toContain('name="robots" content="noindex"');
  expect((await request.get('/business')).status()).toBe(404);
  expect((await request.get('/capability-statement')).status()).toBe(404);
});

test('the demo host is not indexable and serves the runtime WASM', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
  const wasm = await request.get('/animation/runtime/rive.wasm');
  expect(wasm.status()).toBe(200);
  expect(wasm.headers()['content-type']).toContain('application/wasm');
});
