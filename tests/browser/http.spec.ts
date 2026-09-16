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

test('the root AI index joins every scoped llms.txt document', async ({ request }) => {
  const paths = ['/accessibility', '/capabilities', '/capabilities/business-it', '/capabilities/cybersecurity', '/company', '/contact', '/government', '/privacy'];
  const root = await request.get('/llms.txt');
  expect(root.status()).toBe(200);
  expect(root.headers()['content-type']).toContain('text/plain');
  const index = await root.text();
  for (const path of paths) {
    const scoped = await request.get(`${path}/llms.txt`);
    expect(scoped.status(), path).toBe(200);
    expect(scoped.headers()['content-type'], path).toContain('text/plain');
    expect(index, path).toContain(`https://thatdeveloperguy.com${path}/llms.txt`);
    expect(await scoped.text(), path).toContain('https://thatdeveloperguy.com/llms.txt');
  }
  expect((await request.get('/contact/received/llms.txt')).status()).toBe(404);
});
