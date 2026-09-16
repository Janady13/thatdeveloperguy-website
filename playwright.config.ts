import { defineConfig, devices } from '@playwright/test';
const remote = process.env.TDG_BASE_URL; // e.g. https://tdg.thatwebhostingguy.com — tests the deployed candidate
const auth = process.env.TDG_STAGING_AUTH?.split(':'); // user:pass for the staging access gate
export default defineConfig({
  testDir: 'tests/browser', timeout: 30_000, retries: 0, reporter: 'list',
  use: { baseURL: remote ?? 'http://127.0.0.1:4411', trace: 'retain-on-failure', ...(remote && auth ? { httpCredentials: { username: auth[0]!, password: auth[1]! } } : {}) },
  webServer: remote ? undefined : { command: 'npm run serve:dist', url: 'http://127.0.0.1:4411/', reuseExistingServer: true, timeout: 30_000 },
  projects: [
    // Default Chromium has no GPU (SwiftShader): the site must stay poster-only and responsive there.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Real GPU (ANGLE Metal on this Mac): the native layer must go live and pass its checks. Emulated desktop, not a physical device.
    { name: 'chromium-gpu', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] } }, testMatch: /animation\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
});
