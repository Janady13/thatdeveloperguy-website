import { test, expect } from '@playwright/test';

const fill = async (page: import('@playwright/test').Page) => {
  await page.goto('/contact?project=security&from=capability.cybersecurity');
  await page.getByLabel('Your name').fill('Pat Example');
  await page.getByLabel('Email for the reply').fill('pat@example.org');
  await page.getByLabel('Message').fill('We need a security review of two offices and a small data center.');
};
const api = (outcome: string, status: number, extra: Record<string, unknown> = {}) => (route: import('@playwright/test').Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ outcome, requestId: 'test-req', title: 't', message: 'm', fields: {}, duplicate: false, ...extra }) });

test.describe('inquiry form', () => {
  test('the service selection follows the door the visitor came through', async ({ page }) => {
    await fill(page);
    await expect(page.getByLabel('What is this about')).toHaveValue('security');
    await expect(page.locator('input[name="from"]')).toHaveValue('capability.cybersecurity');
    await expect(page.locator('form.inquiry-form')).toHaveAttribute('action', '/api/inquiries');
    await expect(page.locator('form.inquiry-form')).toHaveAttribute('method', 'post');
  });

  test('success is shown only for provider_accepted; the form clears', async ({ page }) => {
    await page.route('**/api/inquiries', api('provider_accepted', 200, { title: 'Message received', message: 'The email service accepted your message for delivery.' }));
    await fill(page);
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByRole('status')).toContainText('Message received');
    await expect(page.getByLabel('Your name')).toHaveValue('');
  });

  test('a provider rejection is shown as failure, never success', async ({ page }) => {
    await page.route('**/api/inquiries', api('provider_rejected', 502, { title: 'Message not sent', message: 'The email service refused the message.' }));
    await fill(page);
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByRole('alert')).toContainText('Message not sent');
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByLabel('Your name')).toHaveValue('Pat Example');
  });

  test('delivery_unknown is shown as uncertain, not success', async ({ page }) => {
    await page.route('**/api/inquiries', api('delivery_unknown', 504, { title: 'Delivery uncertain', message: 'The email service did not confirm within the time allowed.' }));
    await fill(page);
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByRole('alert')).toContainText('Delivery uncertain');
  });

  test('validation failures mark the fields', async ({ page }) => {
    await page.route('**/api/inquiries', api('validation_failed', 422, { title: 'Check the form', message: 'Some fields need attention.', fields: { email: 'Enter one valid email address for the reply.' } }));
    await fill(page);
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page.getByLabel('Email for the reply')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#err-email')).toContainText('valid email');
  });

  test('opening the receipt page directly does not claim anything was sent', async ({ page }) => {
    await page.goto('/contact/received');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Message received');
    await expect(page.locator('body')).toContainText('not yet proof it has been read');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('the form submits natively without JavaScript (the live 303 is verified by the HTTP tests)', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    let posted: { method: string; body: string; type: string } | null = null;
    await page.route('**/api/inquiries', route => { const r = route.request(); posted = { method: r.method(), body: r.postData() ?? '', type: r.headers()['content-type'] ?? '' }; return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>ok</title>received' }); });
    await page.goto('/contact');
    await page.getByLabel('Your name').fill('Pat Example');
    await page.getByLabel('Email for the reply').fill('pat@example.org');
    await page.getByLabel('Message').fill('We need a security review of two offices and a small data center.');
    await page.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(page).toHaveURL(/\/api\/inquiries$/);
    expect(posted!.method).toBe('POST');
    expect(posted!.type).toContain('application/x-www-form-urlencoded');
    expect(posted!.body).toContain('name=Pat+Example');
    expect(posted!.body).toContain('website=');
    await context.close();
  });
});
