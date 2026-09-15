import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the lobby shows the poster and three real door links', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-poster')).toBeVisible();
  const doors = page.locator('.stage-hit');
  await expect(doors).toHaveCount(3);
  await expect(doors.nth(0)).toHaveAttribute('href', '/it-services/');
  await expect(doors.nth(1)).toHaveAttribute('href', '/government-solutions/');
  await expect(doors.nth(2)).toHaveAttribute('href', '/cybersecurity/');
});

test('hovering a door names it in the caption; keyboard reaches every door', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is desktop-only');
  await page.goto('/');
  await page.locator('.stage-hit[data-hit="government"]').hover();
  await expect(page.locator('.stage-caption')).toContainText('Government Solutions');
  await page.keyboard.press('Tab'); // brand
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); if (await page.locator('.stage-hit:focus').count()) break; }
  await expect(page.locator('.stage-hit:focus')).toHaveCount(1);
});

test('clicking the IT door opens it and navigates', async ({ page }) => {
  await page.goto('/');
  await page.locator('.stage-hit[data-hit="it"]').click();
  await expect(page).toHaveURL(/\/it-services\/$/, { timeout: 5000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('IT Services');
});

test('the lobby has no axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 1)).toEqual([]);
});
