import { defineConfig, devices } from '@playwright/test';
const remote = process.env.TDG_BASE_URL; // e.g. https://tdg.thatwebhostingguy.com — tests the deployed candidate
export default defineConfig({
  testDir: 'tests/browser', timeout: 30_000, retries: 0, reporter: 'list',
  use: { baseURL: remote ?? 'http://127.0.0.1:4411', trace: 'retain-on-failure' },
  webServer: remote ? undefined : { command: 'npm run serve:dist', url: 'http://127.0.0.1:4411/', reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }, { name: 'mobile', use: { ...devices['iPhone 14'] } }],
});
