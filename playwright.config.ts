import { defineConfig, devices } from '@playwright/test';

// Browser tests run against the Vite DEV server on purpose: the fight and ocean state hooks
// (window.__fight, window.__ocean) exist only when import.meta.env.DEV is true.
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop-chromium', testMatch: /desktop\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', testMatch: /mobile\.spec\.ts/, use: { ...devices['iPhone 13 landscape'] } },
    { name: 'mobile-chromium', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7 landscape'] } },
  ],
});
