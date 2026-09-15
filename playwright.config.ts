import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser', timeout: 30_000, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4410', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:4410', reuseExistingServer: true, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }, { name: 'mobile', use: { ...devices['iPhone 14'] } }],
});
