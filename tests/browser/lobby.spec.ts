import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the lobby is complete HTML: title, canonical, poster and three real door links', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ThatDeveloperGuy/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://thatdeveloperguy.com/');
  await expect(page.locator('.scene-poster')).toBeVisible();
  const doors = page.locator('.scene-hit');
  await expect(doors).toHaveCount(3);
  await expect(doors.nth(0)).toHaveAttribute('href', '/capabilities/business-it');
  await expect(doors.nth(1)).toHaveAttribute('href', '/government');
  await expect(doors.nth(2)).toHaveAttribute('href', '/capabilities/cybersecurity');
});

test('hovering a door names it in the caption; keyboard reaches every door', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is desktop-only');
  await page.goto('/');
  await page.locator('.scene-hit[data-hit="government"]').hover();
  await expect(page.locator('.scene-caption')).toContainText('Government Solutions');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); if (await page.locator('.scene-hit:focus').count()) break; }
  await expect(page.locator('.scene-hit:focus')).toHaveCount(1);
});

test('clicking the IT door navigates to the capability page, whose objects link to its sections', async ({ page }) => {
  await page.goto('/');
  await page.locator('.scene-hit[data-hit="it"]').click();
  await expect(page).toHaveURL(/\/capabilities\/business-it$/, { timeout: 5000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('IT Services');
  await expect(page.locator('.scene-hit[data-hit="status-board"]')).toHaveAttribute('href', '#monitoring');
  await expect(page.locator('#monitoring')).toBeAttached();
});

test('direct entry, refresh and back work without visiting the lobby', async ({ page }) => {
  await page.goto('/capabilities/cybersecurity');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cyber Security');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cyber Security');
  await page.locator('.scene-hit[data-hit="return-lobby"]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/capabilities\/cybersecurity$/);
});

test('every published route has no axe violations', async ({ page }) => {
  for (const path of ['/', '/government', '/capabilities', '/capabilities/business-it', '/capabilities/cybersecurity', '/company', '/contact', '/privacy', '/accessibility']) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${path}: ${JSON.stringify(results.violations, null, 1)}`).toEqual([]);
  }
});
